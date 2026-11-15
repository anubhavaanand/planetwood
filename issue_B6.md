## File: server/index.js:493

### Trigger
When a client joins a room, they send `{ r: [prefix, roomName], rejoinId?: string }`. The server uses `msg.rejoinId` to look up `lastKnownPositions` and restore position/rotation.

### Impact
A brand-new client (first time ever) has no legitimate `rejoinId`. However, if `localStorage` has a stale `rejoinId` from a **different previous session/client**, the server will restore **that other client's last position** to this new client.

This causes:
- New players spawning at wrong locations (possibly inside walls, underground, or far from spawn)
- Position desync between client and server
- Potential exploit: malicious client could send crafted `rejoinId` to spawn anywhere

### Root Cause
Server trusts client-provided `rejoinId` without verifying it belongs to the authenticated client identity (`client.id` from JWT).

### Suggested Fix
Only use `rejoinId` if it matches the authenticated client's ID:
```javascript
const rejoinId = msg.rejoinId;
if (rejoinId && typeof rejoinId === 'string' && rejoinId === client.id) {
  // Safe to restore — rejoinId matches this client's identity
  const entry = lastKnownPositions.get(rejoinId);
  // ...
}
```

Or: store last-known positions keyed by JWT `id` claim, not by client-provided string.

### Verdict
**Confirmed Blocker** — trust boundary violation, position spoofing possible.