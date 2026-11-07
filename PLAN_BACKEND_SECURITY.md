# Planetwood Backend P0 Security Implementation Plan

**Target**: `server/index.js` (WebSocket relay server, port 3005)
**Client**: `src/systems/MultiplayerSystem.js` (connects to `ws://localhost:3005`)
**Status**: Planning only — do not implement yet

## 📋 P0 Items Identified by Backend Architect

| # | Item | File(s) | Dependency On |
|---|------|---------|---------------|
| 1 | Authentication (JWT) — validate identity on WebSocket upgrade | `server/index.js` | None (foundation) |
| 2 | Server-side rate limiting — token bucket per IP/client for connections and messages | `server/index.js` | Item 3 (input validation must exist first to classify messages) |
| 3 | Input validation & size limits — JSON schema for control messages, max binary payload size | `server/index.js` | Item 1 (authenticated client context) |
| 4 | TLS/WSS termination — move from `ws://` to `wss://` | `server/index.js`, dev config | None (can run in parallel) |
| 5 | Graceful shutdown + error handling — SIGTERM handler, structured error responses | `server/index.js` | None (can run in parallel) |

## 🗂 Suggested New Files

| File | Purpose | P0 Items |
|------|---------|----------|
| `server/middleware/auth.js` | JWT issuance, verification, WebSocket upgrade auth middleware | Item 1 |
| `server/middleware/rateLimit.js` | Token-bucket rate limiter per IP/client (connections + messages) | Item 2 |
| `server/middleware/validate.js` | JSON schema validation for control messages, binary payload size limit | Item 3 |
| `server/middleware/errors.js` | Structured error response formatter + error-handling middleware | Item 5 |
| `server/config/tls.js` | Self-signed cert generation (dev) + production TLS config loader | Item 4 |
| `server/utils/logger.js` | Structured JSON logger (request-id correlated) | Item 5 |

## 🔐 Dependency Ordering (Implementation Sequence)

The 5 P0 items must be implemented in this order due to dependencies:

```
Phase A (foundation, no dependencies):
  ├─ Item 4: TLS/WSS termination        (parallel-safe)
  ├─ Item 5: Graceful shutdown + errors  (parallel-safe)
  └─ Item 1: Authentication (JWT)        (must come before Items 2 & 3)

Phase B (depends on Phase A):
  └─ Item 3: Input validation & size limits  (depends on Item 1 auth context)

Phase C (depends on Phase B):
  └─ Item 2: Rate limiting                  (depends on Item 3 to classify messages)
```

**Key dependency rationale**:
- **Item 3 → Item 2**: Rate limiting needs to distinguish "control messages" from "state updates" to apply different buckets. Input validation defines the message schemas that rate limiting keys off.
- **Item 1 → Item 3**: Validation can attach authenticated client identity (userId/deviceId) to message context, enabling per-user validation rules.
- **Item 1 → Item 2**: Rate limit buckets are per authenticated client (not just IP), so auth must identify the client before rate limiting assigns a bucket.

## 📅 Phase-by-Phase Breakdown

### Phase A — Foundation (no cross-item dependencies)

#### Item 4: TLS/WSS termination — `ws://` → `wss://`

**Steps**:
1. Create `server/config/tls.js` — load/create self-signed cert for dev, production cert loader (env vars for cert/key paths).
2. Replace `new WebSocketServer({ port: PORT })` with `https.createServer(tlsOptions)` + `WebSocketServer({ server: httpsServer })`.
3. Add `wss://` URL derivation from PORT (default 3005 → wss port).
4. Dev config: generate self-signed cert on first run; log the wss URL; add exception/browser-trust note.
5. Update server startup log line from `ws://localhost:${PORT}` to `wss://localhost:${WSS_PORT}`.
6. Test: client connects via `wss://` (browser accepts self-signed dev cert after exception).

**Testable outcomes**:
- Server starts with `wss://` listener.
- `ws://` connections are rejected (or redirected) in production.
- Dev self-signed cert generates without manual openssl steps.

#### Item 5: Graceful shutdown + structured error handling

**Steps**:
1. Create `server/middleware/errors.js` — `sendError(ws, code, message, status?)` helper that sends `{ type: 'error', payload: { code, message, timestamp, requestId? } }` and closes with appropriate WebSocket close code.
2. Replace all ad-hoc `ws.send(JSON.stringify({ type: 'error', ... }))` calls with the structured helper (SESSION_FULL already exists; add others as needed).
3. Add `ws.on('error')` handler that logs structured error and closes cleanly.
4. Implement SIGTERM/SIGINT handler:
   - Stop accepting new WebSocket connections (`wss.close()`).
   - Send `server_shutdown` structured error to all connected clients.
   - Close all client sockets after a short grace period (e.g., 5s).
   - Exit process.
5. Handle uncaught exceptions / unhandled rejections with structured logging and controlled exit.
6. Test: send SIGTERM → all clients receive `server_shutdown` → server exits.

**Testable outcomes**:
- All error responses follow `{ type: 'error', payload: { code, message, timestamp } }` schema.
- SIGTERM → clients notified → process exits within grace period.
- Unhandled errors do not crash the server silently.

#### Item 1: Authentication (JWT) — validate identity on WebSocket upgrade

**Steps**:
1. Create `server/middleware/auth.js`:
   - `generateToken(payload)` — sign JWT (HS256, secret from env, configurable expiry).
   - `verifyToken(token)` — verify + return payload or throw.
   - `authenticateUpgrade(req)` — middleware for `ws` upgrade: read `Authorization: Bearer <token>` or `?token=` query param; verify; attach `req.user` (userId, deviceId).
2. In `server/index.js`, wire auth into the `wss.on('connection', (ws) => ...)` handler:
   - `ws` upgrade is intercepted before `Client` construction.
   - Missing/invalid token → send structured `AUTH_REQUIRED` error → close connection (code 4001/4003).
   - Valid token → attach `client.userId` / `client.deviceId` from token payload.
3. Backward-compat dev mode: allow `ALLOW_UNAUTHENTICATED_DEV=true` to skip auth (log warning).
4. Test: connect without token → rejected; connect with valid token → accepted with `client.userId` set.

**Testable outcomes**:
- Unauthorized WebSocket upgrade is rejected before any client state is created.
- Valid JWT yields an authenticated `client` object with identity fields.
- Dev-mode opt-out works with explicit env flag.

---

### Phase B — Input Validation (depends on Item 1)

#### Item 3: Input validation & size limits — JSON schema + max binary payload

**Steps**:
1. Create `server/middleware/validate.js`:
   - Define JSON schema for each control message type: `join` (`{r: [prefix, room], rejoinId?}`), `ping`, `leave`, `data` (chat), `signal`, `peer_joined`, `peer_left`.
   - `validateControlMessage(msg)` — returns `{ valid, errors }` using a lightweight schema validator (or ajv if added as dependency).
   - `MAX_BINARY_PAYLOAD_BYTES` constant (e.g., 64 KiB) — reject binary messages exceeding it before protobuf decode.
   - Attach validation result to client context (authenticated userId from Item 1).
2. In `server/index.js` message handler:
   - **Binary path**: check `raw.byteLength <= MAX_BINARY_PAYLOAD_BYTES` before slicing/decoding; oversized → structured error + close.
   - **JSON path**: run `validateControlMessage(msg)` before processing; invalid → structured error (do not process).
   - Unknown message types → structured error (ignore silently or close).
3. Test: oversized binary rejected; malformed JSON control message rejected with schema errors; valid messages pass through.

**Testable outcomes**:
- Binary payloads over the size cap are rejected before any decode.
- Every JSON control message type has a schema; invalid messages return structured errors.
- Validation runs after auth (authenticated client context available).

---

### Phase C — Rate Limiting (depends on Item 3)

#### Item 2: Server-side rate limiting — token bucket per IP/client

**Steps**:
1. Create `server/middleware/rateLimit.js`:
   - Token-bucket implementation: `checkBucket(key, capacity, refillRate)` → `{ allowed, remaining, resetAt }`.
   - Two buckets per client:
     - **Connection bucket**: per IP (or per authenticated userId if available), limits new WebSocket upgrades per minute.
     - **Message bucket**: per authenticated client (userId/deviceId from Item 1, fallback to IP), limits messages per second.
   - Different limits for control messages vs. binary state updates (schemas from Item 3 define the class).
2. In `server/index.js`:
   - Connection handler: check connection bucket before `new Client(ws)`; rejected → structured `RATE_LIMITED` error + close.
   - Message handler: check message bucket on every incoming message; rejected → structured `RATE_LIMITED` error (do not process message).
3. Test: burst of connections from one IP is throttled; rapid messages from one client are throttled with `Retry-After`-style response.

**Testable outcomes**:
- Connection attempts beyond the bucket are rejected before client creation.
- Message rate exceeding the bucket returns structured errors with retry timing.
- Per-client (not just per-IP) limiting works once auth is in place.

---

## ⚡ Parallel Work Items

The following items can be implemented **in parallel** (no shared files, no ordering dependencies):

| Parallel Group | Items | Reason |
|----------------|-------|--------|
| Group 1 | Item 4 (TLS/WSS) + Item 5 (graceful shutdown + errors) | Both touch `server/index.js` startup/shutdown but concern different concerns (transport vs. lifecycle). No shared new files. |
| Item 1 (auth) | Runs after Group 1 completes | Needs `server/middleware/auth.js` only; no dependency on Items 4/5 code. |

**Sequential chain**: Item 1 → Item 3 → Item 2 (each depends on the prior).

**Estimated implementation order**:
1. Item 4 + Item 5 (parallel)
2. Item 1
3. Item 3
4. Item 2

## 🌐 Client-Side Changes Needed

### `src/systems/MultiplayerSystem.js`

The client currently connects to `ws://localhost:3005` with no token. After server-side auth (Item 1) and WSS (Item 4), the client needs:

1. **URL change**: `ws://localhost:3005` → `wss://localhost:3005` (or configurable `import.meta.env.VITE_WS_URL`).
2. **Token storage & retrieval**: Read JWT from `localStorage` (or a new `planetwood_auth_token` key) at connection time.
3. **Token on connect**: Pass token in WebSocket URL query param (`wss://...?token=xxx`) or as the first message after `open`. Note: `ws` library upgrade auth typically reads headers/query at upgrade time, so query-param token is the simplest client-side approach compatible with server-side `authenticateUpgrade`.
4. **Reconnect with token**: On reconnect (existing `_close` → `_createSocket` retry loop), resend the stored token so the server can re-authenticate and restore the session/rejoinId.
5. **Auth error handling**: Handle server `AUTH_REQUIRED` / `RATE_LIMITED` structured errors:
   - `AUTH_REQUIRED` → clear stored token, prompt login/refresh, stop retrying.
   - `RATE_LIMITED` → back off retries per `Retry-After`/`resetAt`.
6. **Token refresh**: If the server issues short-lived tokens, client needs a refresh mechanism (out of scope for P0 but noted).

### Reconnect flow with token (MultiplayerSystem.js)

Current flow (lines 104–158): `_createSocket()` → `_open()` → `_requestRoom(room, rejoinId)`.

New flow:
1. `_createSocket()` → connect with `?token=<storedToken>` in URL.
2. `_open()` → server validates token during upgrade → if valid, proceed; if invalid, server closes with `AUTH_REQUIRED`.
3. On `AUTH_REQUIRED` error → clear `localStorage` token + `planetwood_client_id`, notify UI, stop reconnect retries.
4. On successful auth → `_requestRoom(room, rejoinId)` as before.

## 🧪 Testability Checklist (per P0 item)

| Item | Test | Pass Criteria |
|------|------|---------------|
| 4 TLS/WSS | Connect via `wss://` in dev | Handshake succeeds, self-signed cert accepted |
| 4 TLS/WSS | Connect via `ws://` in prod | Rejected / redirected |
| 5 Shutdown | Send `SIGTERM` to server process | All clients receive `server_shutdown`, process exits ≤ 5s |
| 5 Errors | Malformed JSON message | Structured `{ type: 'error', payload: { code, message, timestamp } }` |
| 1 Auth | Connect without token | Connection closed, `AUTH_REQUIRED` error |
| 1 Auth | Connect with expired/invalid token | Connection closed, `AUTH_REQUIRED` error |
| 1 Auth | Connect with valid token | `client.userId` set, connection proceeds |
| 3 Validation | Binary payload > MAX_BYTES | Rejected before decode, structured error |
| 3 Validation | Invalid JSON control message schema | Structured validation errors, message not processed |
| 2 Rate limit | Burst connections from one IP | Excess connections rejected with `RATE_LIMITED` |
| 2 Rate limit | Rapid messages from one client | Excess messages rejected with `RATE_LIMITED` + retry info |
| Client | Reconnect after disconnect | Resends stored token, server re-authenticates, rejoin works |

## ⚠️ Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Dev self-signed cert causes browser WebSocket errors | Document manual exception step; or use `wss://` only in prod, keep `ws://` behind `ALLOW_INSECURE_DEV` flag |
| Existing clients break when auth is required | `ALLOW_UNAUTHENTICATED_DEV=true` dev opt-out; client and server deployed together |
| Token in query param logged by intermediaries | Short token expiry; recommend `Authorization` header in production if `ws` library supports custom headers on upgrade |
| Rate limiting false positives during bursty gameplay | Generous message bucket for binary state updates; separate tighter bucket for control messages |

## 📊 Success Metrics

- 100% of WebSocket upgrades require valid JWT (dev opt-out excepted).
- 0 unstructured `ws.send(...)` error responses remain in `server/index.js` — all go through `sendError()` helper.
- Server survives `SIGTERM` with client notification.
- No binary payload over `MAX_BINARY_PAYLOAD_BYTES` is decoded.
- Rate-limited clients receive structured `RATE_LIMITED` errors with retry timing.

---

**Next step**: Review this plan with the Backend Architect, then implement in Phase A order (Items 4 & 5 in parallel, then Item 1, Item 3, Item 2).
