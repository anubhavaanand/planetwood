## File: src/systems/QuestSystem.js:76-154

### Trigger
When a quest step has `choices`, the player selects one branch via `selectNextStep(questId, nextStepId, branchTag)`. The method at lines 76-154 marks **all branches of that step as completed**, not just the chosen one.

### Impact
- Player chooses branch A → branch B, C, D also marked `completed: true`
- Those branches can never be played in future (even on prestige reset if not excluded)
- Quest replayability destroyed — "choice" is illusion, all outcomes locked immediately
- Branch-specific rewards/dialogue for unchosen paths permanently inaccessible

### Root Cause
Lines 106-113: when a choice is made, the code iterates `step.choices` and calls `completeStep(questId, choice.nextStep)` for **every choice**, not just the selected one.

```javascript
// Current code (lines 106-113):
if (step.choices) {
  for (const choice of step.choices) {
    this.completeStep(questId, choice.nextStep); // Marks ALL branches complete
  }
}
```

### Suggested Fix
Only complete the chosen branch:
```javascript
if (step.choices && branchTag) {
  const chosen = step.choices.find(c => c.tag === branchTag);
  if (chosen && chosen.nextStep) {
    this.completeStep(questId, chosen.nextStep);
  }
}
```

### Verdict
**Confirmed Suggestion** — core quest choice mechanic broken; all branches marked complete on any choice.