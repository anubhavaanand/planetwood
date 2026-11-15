## File: server/index.js:221-231 (broadcastRealmData) and line 193 (sendProtobufToClient)

### Trigger
`broadcastRealmData` is called for every binary state update from a client. It iterates all clients in the room and for **each recipient**:
1. Creates a new TextEncoder
2. Encodes the recipient's ID as prefix
3. Encodes the full protobuf message
4. Combines prefix + protobuf bytes
5. Sends

### Impact
For a room with N clients, each state update triggers **N protobuf encodings** (O(N²) CPU). With 15 max players and 35 updates/sec, that's 15 × 35 = 525 encodings/sec, each allocating new Uint8Arrays.

`sendProtobufToClient` at line 193 has the same issue — encodes per recipient.

### Root Cause
Protobuf message is identical for all recipients (same state data), only the ID prefix differs. Encoding is repeated unnecessarily.

### Suggested Fix
Encode protobuf **once**, then prepend each recipient's ID prefix:
```javascript
function broadcastRealmData(room, excludeId, dataObj) {
  if (!RealmData) return;
  const verification = RealmData.verify(dataObj);
  if (verification) return;
  
  const msg = RealmData.create(dataObj);
  const protobufBytes = RealmData.encode(msg).finish(); // ENCODE ONCE
  
  for (const [id, client] of room.clients) {
    if (id !== excludeId && client.ws.readyState === 1) {
      const prefix = new TextEncoder().encode(id);
      const combined = new Uint8Array(prefix.length + protobufBytes.length);
      combined.set(prefix, 0);
      combined.set(protobufBytes, prefix.length);
      client.ws.send(combined);
    }
  }
}
```

Same fix for `sendProtobufToClient`.

### Verdict
**Confirmed Blocker** — O(N²) CPU scaling, unnecessary allocations, limits max players.