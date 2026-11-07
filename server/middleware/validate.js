// Input validation & size limits for Planetwood WebSocket control messages.
// Defines JSON schemas for each control message type, a lightweight validator,
// the maximum binary payload size, and a string sanitizer.
//
// No external schema library (e.g. ajv) is added — validation is dependency-free
// and runs inline on every incoming message.

// Maximum size for an incoming binary (protobuf) message before any decode.
// 64 KiB = 65,536 bytes. Oversized payloads are rejected before slicing/decoding,
// which avoids allocating/decompressing attacker-controlled bytes.
export const MAX_BINARY_PAYLOAD_BYTES = 64 * 1024;

// Maximum length applied to any single string field (after sanitization).
const MAX_STRING_LENGTH = 1024;

// Allowed control message `type` values used by the JSON control-message path.
const CONTROL_MESSAGE_TYPES = new Set([
  'chat',
  'ping',
  'pong',
  'leave',
  'networkEvent',
  'join',
  'signal',
  'peer_joined',
  'peer_left',
]);

// ---------------------------------------------------------------------------
// JSON Schema definitions (lightweight subset)
// Each schema declares: type, required fields, per-field type/limits.
// ---------------------------------------------------------------------------

const schemas = {
  // Join room: { r: [prefix, roomName], rejoinId? }
  join: {
    type: 'object',
    required: ['r'],
    properties: {
      r: {
        type: 'array',
        items: { type: 'string', minLength: 1, maxLength: 128 },
        minItems: 2,
        maxItems: 2,
      },
      rejoinId: { type: 'string', minLength: 1, maxLength: 64 },
    },
    additionalProperties: false,
  },

  // Ping client -> server: { ping: <timestamp> }
  ping: {
    type: 'object',
    required: ['ping'],
    properties: {
      ping: { type: 'number', minimum: 0, maximum: 8640000000000 }, // ~100 years in ms
    },
    additionalProperties: false,
  },

  // Pong server -> client (validated if ever received from client): { PONG: <ts>, t: <ts> }
  pong: {
    type: 'object',
    required: ['PONG'],
    properties: {
      PONG: { type: 'number', minimum: 0, maximum: 8640000000000 },
      t: { type: 'number', minimum: 0, maximum: 8640000000000 },
    },
    additionalProperties: false,
  },

  // Leave: { leave: <any string marker> }
  leave: {
    type: 'object',
    required: ['leave'],
    properties: {
      leave: { type: 'string', minLength: 1, maxLength: 32 },
    },
    additionalProperties: false,
  },

  // Chat message: { data: { text: string, timestamp?: number } }
  chat: {
    type: 'object',
    required: ['data'],
    properties: {
      data: {
        type: 'object',
        required: ['text'],
        properties: {
          text: { type: 'string', minLength: 0, maxLength: MAX_STRING_LENGTH },
          timestamp: { type: 'number', minimum: 0, maximum: 8640000000000 },
        },
        additionalProperties: false,
      },
    },
    additionalProperties: false,
  },

  // Network event / emote (binary decoded, but schema kept for symmetry):
  // { networkEvent: '<emote name>' }
  networkEvent: {
    type: 'object',
    required: ['networkEvent'],
    properties: {
      networkEvent: { type: 'string', minLength: 1, maxLength: 64 },
    },
    additionalProperties: false,
  },

  // WebRTC signal: { type: 'signal', payload: { to: string, data: any } }
  signal: {
    type: 'object',
    required: ['type', 'payload'],
    properties: {
      type: { type: 'string', enum: ['signal'] },
      payload: {
        type: 'object',
        required: ['to'],
        properties: {
          to: { type: 'string', minLength: 1, maxLength: 64 },
          data: {}, // opaque signaling payload, not deeply validated
        },
        additionalProperties: false,
      },
    },
    additionalProperties: false,
  },

  // Peer joined (P2P signaling): { type: 'peer_joined' }
  peer_joined: {
    type: 'object',
    required: ['type'],
    properties: {
      type: { type: 'string', enum: ['peer_joined'] },
    },
    additionalProperties: false,
  },

  // Peer left (P2P signaling): { type: 'peer_left' }
  peer_left: {
    type: 'object',
    required: ['type'],
    properties: {
      type: { type: 'string', enum: ['peer_left'] },
    },
    additionalProperties: false,
  },
};

// ---------------------------------------------------------------------------
// Lightweight JSON-schema validator (subset: type, required, properties,
// items, minItems, maxItems, minLength, maxLength, minimum, maximum, enum,
// additionalProperties).
// ---------------------------------------------------------------------------

const TYPE_CHECKS = {
  string: (v) => typeof v === 'string',
  number: (v) => typeof v === 'number' && Number.isFinite(v),
  integer: (v) => Number.isInteger(v),
  boolean: (v) => typeof v === 'boolean',
  object: (v) => v !== null && typeof v === 'object' && !Array.isArray(v),
  array: (v) => Array.isArray(v),
  null: (v) => v === null,
};

function checkType(value, expected) {
  if (Array.isArray(expected)) {
    return expected.some((t) => TYPE_CHECKS[t]?.(value) ?? false);
  }
  const check = TYPE_CHECKS[expected];
  return check ? check(value) : true;
}

function validateValue(value, schema, path, errors) {
  // type
  if (schema.type && !checkType(value, schema.type)) {
    errors.push(`${path}: expected type ${schema.type}`);
    return; // stop deeper checks on type mismatch
  }

  // enum
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path}: value not in allowed enum`);
  }

  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${path}: string length ${value.length} < minLength ${schema.minLength}`);
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push(`${path}: string length ${value.length} > maxLength ${schema.maxLength}`);
    }
  }

  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${path}: number ${value} < minimum ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`${path}: number ${value} > maximum ${schema.maximum}`);
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${path}: array length ${value.length} < minItems ${schema.minItems}`);
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push(`${path}: array length ${value.length} > maxItems ${schema.maxItems}`);
    }
    if (schema.items) {
      value.forEach((item, i) => validateValue(item, schema.items, `${path}[${i}]`, errors));
    }
  }

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    // required
    if (schema.required) {
      for (const key of schema.required) {
        if (!(key in value)) {
          errors.push(`${path}: missing required property '${key}'`);
        }
      }
    }
    // properties
    if (schema.properties) {
      for (const [key, subSchema] of Object.entries(schema.properties)) {
        if (key in value) {
          validateValue(value[key], subSchema, `${path}.${key}`, errors);
        }
      }
    }
    // additionalProperties
    if (schema.additionalProperties === false) {
      const known = schema.properties ? Object.keys(schema.properties) : [];
      for (const key of Object.keys(value)) {
        if (!known.includes(key)) {
          errors.push(`${path}: additional property '${key}' not allowed`);
        }
      }
    }
  }
}

/**
 * Validate a parsed control message object against its schema.
 * The schema is selected by the message's discriminating field/type.
 *
 * @param {object} obj - parsed JSON message object
 * @returns {{ valid: true } | { valid: false, errors: string[] }}
 */
export function validateMessage(obj) {
  const errors = [];

  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { valid: false, errors: ['message: must be a non-null object'] };
  }

  // Determine the message type / schema key.
  // - `type` field discriminates signal / peer_joined / peer_left / chat-ish
  // - `r` field => join
  // - `ping` field => ping
  // - `PONG` field => pong
  // - `leave` field => leave
  // - `networkEvent` field => networkEvent
  // - `data` field with text => chat
  let schemaKey = null;

  if (obj.type && CONTROL_MESSAGE_TYPES.has(obj.type)) {
    schemaKey = obj.type;
  } else if ('r' in obj && Array.isArray(obj.r)) {
    schemaKey = 'join';
  } else if ('ping' in obj) {
    schemaKey = 'ping';
  } else if ('PONG' in obj) {
    schemaKey = 'pong';
  } else if ('leave' in obj) {
    schemaKey = 'leave';
  } else if ('networkEvent' in obj) {
    schemaKey = 'networkEvent';
  } else if ('data' in obj) {
    schemaKey = 'chat';
  } else {
    return {
      valid: false,
      errors: ['message: unknown control message type; no matching schema'],
    };
  }

  const schema = schemas[schemaKey];
  if (!schema) {
    return { valid: false, errors: [`message: no schema for type '${schemaKey}'`] };
  }

  validateValue(obj, schema, '', errors);
  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

// ---------------------------------------------------------------------------
// String sanitization
// ---------------------------------------------------------------------------

// Control characters (U+0000–U+001F and U+007F) other than common whitespace
// are escaped to their Unicode escape form so they cannot be injected into
// logs or forwarded payloads verbatim.
const CONTROL_CHAR_RE = /[\u0000-\u001f\u007f]/g;
const NULL_BYTE_RE = /\0/g;

const CONTROL_CHAR_MAP = {
  '\t': '\\t',
  '\n': '\\n',
  '\r': '\\r',
};

function escapeControlChar(ch) {
  if (CONTROL_CHAR_MAP[ch]) return CONTROL_CHAR_MAP[ch];
  return `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`;
}

/**
 * Sanitize a string value for safe use in logs, payloads, and broadcasts.
 *
 * - Strips null bytes (U+0000).
 * - Escapes control characters (tab/newline preserved as escape sequences;
 *   other control chars become \\uXXXX).
 * - Limits length to MAX_STRING_LENGTH (truncates).
 *
 * @param {any} str - value to sanitize (non-strings returned as-is)
 * @param {number} [maxLength=MAX_STRING_LENGTH] - max allowed length
 * @returns {string} sanitized string
 */
export function sanitizeString(str, maxLength = MAX_STRING_LENGTH) {
  if (str === null || str === undefined) return '';
  if (typeof str !== 'string') {
    // Coerce primitives; objects/arrays are not sanitized here.
    return String(str);
  }

  let s = str.replace(NULL_BYTE_RE, '');
  s = s.replace(CONTROL_CHAR_RE, escapeControlChar);

  if (s.length > maxLength) {
    s = s.slice(0, maxLength);
  }
  return s;
}

/**
 * Sanitize all string leaf values in an object recursively (shallow for
 * nested objects: only top-level string fields are sanitized; nested objects
 * are passed through unchanged except their string leaves one level deep).
 *
 * @param {object} obj
 * @returns {object} new object with string fields sanitized
 */
export function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      out[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      out[key] = value.map((v) => (typeof v === 'string' ? sanitizeString(v) : v));
    } else if (value && typeof value === 'object') {
      out[key] = { ...value };
      for (const [k, v] of Object.entries(value)) {
        if (typeof v === 'string') out[key][k] = sanitizeString(v);
      }
    } else {
      out[key] = value;
    }
  }
  return out;
}
