## File: src/systems/ChatSystem.js:26-38

### Trigger
`isInRange(posA, posB)` and `getVisibleMessages(localPos)` calculate distance using `senderPosition` from chat messages.

### Impact
Messages without `senderPosition` (or with undefined x/z) default to `(0, 0)` due to `m.senderPosition?.x || 0` at lines 34-35. This means:
- Chat messages from players who haven't sent position yet appear **in-range for everyone at origin**
- Proximity chat broken for new joiners or players with stale position data
- Messages appear to come from world origin (0,0) for proximity calculations

### Root Cause
No validation that `senderPosition` exists and has valid coordinates before using it for range checks.

### Suggested Fix
Require valid position for proximity chat:
```javascript
isInRange(posA, posB) {
  if (!posA || !posB) return false;
  if (typeof posA.x !== 'number' || typeof posA.z !== 'number') return false;
  if (typeof posB.x !== 'number' || typeof posB.z !== 'number') return false;
  const dx = posA.x - posB.x;
  const dz = posA.z - posB.z;
  return (dx * dx + dz * dz) <= this.proximityRadius * this.proximityRadius;
}

getVisibleMessages(localPos) {
  if (!localPos || typeof localPos.x !== 'number' || typeof localPos.z !== 'number') {
    return [];
  }
  return this.messages.filter(m => {
    const sp = m.senderPosition;
    if (!sp || typeof sp.x !== 'number' || typeof sp.z !== 'number') return false;
    const dx = localPos.x - sp.x;
    const dz = localPos.z - sp.z;
    return (dx * dx + dz * dz) <= this.proximityRadius * this.proximityRadius;
  });
}
```

### Verdict
**Confirmed Blocker** — proximity chat fundamentally broken for players without position data.