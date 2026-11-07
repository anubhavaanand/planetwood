// Structured error response helper for Planetwood relay server.
// All WebSocket error responses follow: { type: 'error', payload: { code, message, timestamp, requestId } }

/**
 * Send a structured JSON error over a WebSocket and close with an appropriate code.
 * @param {WebSocket} ws - the client WebSocket
 * @param {string} code - machine-readable error code (e.g. 'SESSION_FULL', 'AUTH_REQUIRED', 'RATE_LIMITED')
 * @param {string} message - human-readable error message
 * @param {object} opts - { status (HTTP-ish close code), requestId, closeCode, closeReason }
 */
export function sendError(ws, code, message, opts = {}) {
  const { status, requestId, closeCode, closeReason } = opts;
  const payload = {
    code,
    message,
    timestamp: new Date().toISOString(),
  };
  if (requestId) payload.requestId = requestId;

  const envelope = { type: 'error', payload };

  try {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(envelope));
    }
  } catch {
    // Best-effort send; ignore if socket is already closing/closed.
  }

  // Map common error codes to WebSocket close codes (RFC 6455 / close-event registry).
  const defaultCloseCode = closeCode ?? status ?? errorCodeToCloseCode(code);
  const reason = closeReason ?? message;
  try {
    if (ws.readyState === 1 || ws.readyState === 0) {
      ws.close(defaultCloseCode, reason);
    }
  } catch {
    // Ignore close errors on already-closing sockets.
  }
}

/**
 * Map structured error codes to WebSocket close codes.
 * 1000 = normal closure; 1001 = going away; 1002 = protocol error;
 * 1003 = unsupported data; 1008 = policy violation; 1011 = internal error.
 * 4xxx = application-specific codes (per RFC 6455 reserved range).
 */
function errorCodeToCloseCode(code) {
  const map = {
    AUTH_REQUIRED: 4001,
    AUTH_INVALID: 4003,
    RATE_LIMITED: 4029,
    SESSION_FULL: 1001,
    VALIDATION_ERROR: 1003,
    SERVER_SHUTDOWN: 1001,
    INTERNAL_ERROR: 1011,
    PROTOCOL_ERROR: 1002,
  };
  return map[code] ?? 1000;
}

/**
 * Convenience: structured error with standard close code for each category.
 */
export const ErrorCodes = {
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_INVALID: 'AUTH_INVALID',
  RATE_LIMITED: 'RATE_LIMITED',
  SESSION_FULL: 'SESSION_FULL',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SERVER_SHUTDOWN: 'SERVER_SHUTDOWN',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  PROTOCOL_ERROR: 'PROTOCOL_ERROR',
};
