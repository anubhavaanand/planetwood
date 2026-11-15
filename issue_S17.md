## File: src/systems/NPCSystem.js:65-89

### Trigger
`_npcNameToType()` maps glTF node names to NPC types using a hardcoded map. If a name isn't in the map, it falls back to:
```javascript
return map[name] || name.replace(/^NPC_/, '').replace(/_/g, '-');
```

### Impact
New NPC types added to the glTF scene but not in the map will get auto-converted names (e.g., `NPC_new_type` → `new-type`). This may not match the actual NPC type keys used in:
- `QUEST_NPC_TYPES` (quests.js:357-370)
- `SHOP_CATALOG` / `AvatarCustomizationSystem` slot configs
- Animation data keys
- Asset paths (`./assets/npcs/${npcType}/${npcType}.drc`)

Result: NPC loads but animations/mesh fail to find matching data → invisible or broken NPC.

### Root Cause
Fallback assumes naming convention matches asset/animation keys, but the mapping is not 1:1 (e.g., `NPC_office_worker2` → `office-worker` but both map to same type).

### Suggested Fix
Option A: Throw/warn on unknown NPC type instead of silent fallback:
```javascript
_npcNameToType(name) {
  const map = { ... };
  if (!map[name]) {
    console.warn(`[NPCSystem] Unknown NPC name: ${name} — add to map`);
    return 'alien'; // or throw
  }
  return map[name];
}
```

Option B: Maintain a separate asset/animation key map and validate at load time.

### Verdict
**Suggestion** — silent fallback for unknown NPC types causes mismatched assets/animations.