## File: src/systems/AvatarCustomizationSystem.js:238

### Trigger
`isSlotUnlocked(slot)` at line 238 checks `this.progressionSys` for reputation tier:
```javascript
isSlotUnlocked(slot) {
  const req = this.getSlotRequirements(slot);
  if (!req) return true;
  return this.progressionSys?.reputationTier >= req.minRep;
}
```

### Impact
If `progressionSys` is `undefined` (not yet linked, or link broken), the optional chaining `this.progressionSys?.reputationTier` returns `undefined`, and `undefined >= req.minRep` is **always false** — wait, actually:

- `undefined >= 10` → `false` (correctly locked)
- But line 238 has `if (!req) return true;` — if slot has no requirements, it's unlocked

Actually, let me re-read... The issue is more subtle. The problem is in `getSlotRequirements` at line 227 which returns requirements for all slots. But the real issue is:

At line 174 in main.js: `avatarCustomization.progressionSys = progressionSys;` — this is set AFTER `avatarCustomization` is created. During the window before assignment, if any code calls `isSlotUnlocked`, it will see `progressionSys` as undefined.

But more critically: if `progressionSys` is never set (e.g., initialization error), **all reputation-gated slots appear locked** (correct behavior) — but the bug report says "silently unlocks everything".

Let me check again... Actually the issue might be in the Shop UI at UISystem.js:697:
```javascript
const slotUnlocked = (slot) => this.avatarCustomization?.isSlotUnlocked(slot) ?? true;
```

The nullish coalescing `?? true` means: if `avatarCustomization` is undefined OR `isSlotUnlocked` returns undefined, it defaults to `true` (unlocked).

So the bug is in **UISystem**, not AvatarCustomizationSystem. The shop shows locked slots as unlocked when avatarCustomization isn't linked.

### Corrected Impact
Shop UI displays reputation-locked slots as **purchasable/equippable** when `avatarCustomization` reference is missing (early init, or broken link).

### Suggested Fix
In UISystem.js:697, change default to `false`:
```javascript
const slotUnlocked = (slot) => this.avatarCustomization?.isSlotUnlocked(slot) ?? false;
```

And in AvatarCustomizationSystem.js:238, ensure `undefined` progressionSys means locked:
```javascript
isSlotUnlocked(slot) {
  const req = this.getSlotRequirements(slot);
  if (!req) return true; // no requirement = unlocked
  if (!this.progressionSys) return false; // no progression = locked
  return this.progressionSys.reputationTier >= req.minRep;
}
```

### Verdict
**Suggestion** — Shop UI incorrectly shows locked slots as available when avatarCustomization not linked.