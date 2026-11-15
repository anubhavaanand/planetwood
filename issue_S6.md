## File: src/systems/QuestSystem.js:309-332

### Trigger
`prestige()` method at line 309 resets all quest progress but explicitly excludes `quest-planet` at line 326:
```javascript
if (quest.id !== 'quest-planet') {
  // reset logic
}
```

### Impact
- `quest-planet` (planet guardian encounter) **never resets on prestige**
- Player can only experience planet guardian dialogue **once per account**
- No way to replay the "first contact" moment after prestige
- If intentional (planet remembers visit), should be documented; if bug, planet quest stuck completed

### Root Cause
Hardcoded exclusion of `quest-planet` in prestige reset loop.

### Suggested Fix
If intentional: add comment explaining planet remembers visit across prestiges.

If bug: remove the exclusion or make it configurable:
```javascript
const NON_PRESTIGE_QUESTS = ['quest-planet']; // configurable
if (!NON_PRESTIGE_QUESTS.includes(quest.id)) {
  // reset
}
```

### Verdict
**Suggestion** — unclear if intentional; needs design decision. Currently blocks replay of planet quest.