## File: src/main.js:1053-1069 (NPC placement)

### Trigger
`NPC_STREET_POS` object at lines 91-112 defines positions for all NPCs. Some NPC types in the map (lines 104-112) were added for "Issue #48" but may not have corresponding quest steps or dialogue.

### Impact
NPCs placed on street but no quest interaction defined:
- `alien`, `chef`, `fox`, `owl`, `scout`, `threekid`, `factory-worker-b`, `factory-worker-c`
- These NPCs have interact prompts but `questSys.interact()` returns nothing → "There's nothing to say right now."
- Wasted NPC entities, confusing UX

### Verdict
**Nit / Needs Runtime Check** — verify if these NPCs should have quest content or be removed.