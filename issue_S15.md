## File: server/middleware/validate.js:282-283

### Trigger
Schema selection logic at lines 270-288 falls through to `chat` schema for any message with a `data` field:
```javascript
} else if ('data' in obj) {
  schemaKey = 'chat';
}
```

### Impact
A malicious client can send:
```json
{ "data": { "text": "x".repeat(1000000) } }
```
This passes the `chat` schema validation (which only validates `data.text` maxLength 1024) but the outer object could have additional large fields that bypass validation because `additionalProperties: false` is on the `chat` schema but the schema selection happens AFTER the `data` check.

Actually wait - the `chat` schema has `additionalProperties: false` at the top level, so extra fields on the root object would be rejected. But what if someone sends:
```json
{ "type": "chat", "data": { "text": "hello" }, "malicious": "large_payload" }
```
This would match `obj.type && CONTROL_MESSAGE_TYPES.has(obj.type)` at line 270-271 first, and use the `chat` schema which has `additionalProperties: false` — so extra properties rejected. That's correct.

But what about:
```json
{ "data": { "text": "hello" }, "other": "huge_data" }
```
This falls to line 282-283, uses `chat` schema which has `additionalProperties: false` at root — `other` would be rejected. So this is actually handled correctly.

However, there's a more subtle issue: the `signal` schema (lines 112-128) has `additionalProperties: false` at the root, but `payload.data` is `{}` (no validation). An attacker could stuff arbitrary large data in `payload.data`.

### Root Cause
`signal` schema at line 122: `"data": {}` — no constraints on signaling payload.

### Suggested Fix
Add size limits to WebRTC signaling payload:
```javascript
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
        data: { 
          type: 'object',
          additionalProperties: { type: 'string', maxLength: 1024 }, // or limit total size
        },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
},
```

Or at minimum, add a max size check in the message handler for signals.

### Verdict
**Suggestion** — WebRTC signaling payload (`signal.data`) has no size validation, allowing DoS via large signaling messages.