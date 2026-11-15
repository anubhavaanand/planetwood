## File: src/systems/DeliveryItemSystem.js:148

### Trigger
`DeliveryItemSystem.receiveItem()` at line 148 calls `this.multiplayer.setCarriedItems(...)` to sync carried items to other players via multiplayer.

### Impact
`MultiplayerSystem` class **has no `setCarriedItems` method**. This call fails silently (or throws), breaking:
- Delivery item pickup sync — other players don't see carried items
- Item delivery completion — server/peers never receive update
- Visual carried item on remote avatars

### Root Cause
`DeliveryItemSystem` assumes `MultiplayerSystem` exposes a `setCarriedItems` API, but it doesn't exist.

### Suggested Fix
Option A: Add `setCarriedItems(items)` to `MultiplayerSystem` that broadcasts a control message:
```javascript
// In MultiplayerSystem
setCarriedItems(items) {
  if (!this.socket || this.socket.readyState !== 1) return;
  this.socket.send(JSON.stringify({
    type: 'carriedItems',
    payload: { items }
  }));
}
```

And handle on server (broadcast to room) and client (update remote avatar visuals).

Option B: Use existing binary protocol — add `carriedItems` field to `RealmData` protobuf schema and send via binary state updates.

### Verdict
**Confirmed Blocker** — delivery system multiplayer sync completely non-functional.