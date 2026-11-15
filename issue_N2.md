## File: src/main.js:1193-1209 (Interact proximity prompt loop)

### Trigger
The interact prompt visibility loop at lines 1197-1209 iterates ALL NPCs every frame:
```javascript
if (canMove && !dialogueActive && playerAvatar && npcSys) {
  const playerPos = playerAvatar.group.position;
  for (const npc of npcSys.npcs) {
    const d = npc.group.position.distanceTo(playerPos);
    // ...
    ui.setInteractPromptVisible(npc, show);
  }
}
```

### Impact
- O(N) distance calculations per frame (N = number of NPCs)
- With ~20 NPCs, that's 20 sqrt operations per frame
- CSS2DObject visibility toggles trigger DOM updates
- Minor but measurable performance cost on low-end devices

### Root Cause
No spatial partitioning or distance culling — all NPCs checked every frame.

### Suggested Fix
Option A: Only check NPCs within a larger radius (e.g., 20 units) using a spatial grid or quadtree.

Option B: Throttle to 10Hz instead of every frame:
```javascript
this._interactCheckTimer = (this._interactCheckTimer || 0) + delta;
if (this._interactCheckTimer > 0.1) { // 10Hz
  this._interactCheckTimer = 0;
  // check NPCs
}
```

Option C: Use frustum culling — only check NPCs in camera view.

### Verdict
**Nit** — O(N) per-frame loop for interact prompts; minor perf cost.