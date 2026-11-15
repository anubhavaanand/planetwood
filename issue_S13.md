## File: src/systems/DialogueSystem.js:214-225

### Trigger
`showTextSequence(npc, texts, onComplete)` at line 214 creates `this.currentStep = { texts }` — a plain object with only `texts` array, **no `id` property**.

### Impact
When `advance()` is called (line 250-272) and reaches the end of the sequence:
- Line 262: `this.currentStep && !this.currentStep.choices && this.onStepComplete` — `onStepComplete` fires
- Line 263: `this.onStepComplete(this.currentNpc.questId, this.currentStep.id)` — **passes `undefined` as stepId**
- QuestSystem receives `stepId === undefined` → cannot track completion properly

This breaks any quest flow that uses `showTextSequence` for non-quest dialogue (e.g., prestige dialogue).

### Root Cause
`showTextSequence` creates step object without `id`:
```javascript
showTextSequence(npc, texts, onComplete) {
  this.currentNpc = npc;
  this.currentStep = { texts };  // Missing: id property
  ...
}
```

### Suggested Fix
Add an `id` to the step object:
```javascript
showTextSequence(npc, texts, onComplete) {
  this.currentNpc = npc;
  this.currentStep = { id: 'text-sequence', texts };
  ...
}
```

Or in `advance()`, handle missing id:
```javascript
if (this.currentStep && !this.currentStep.choices && this.onStepComplete) {
  this.onStepComplete(this.currentNpc.questId, this.currentStep.id || 'text-sequence');
}
```

### Verdict
**Suggestion** — text sequence dialogue breaks quest step completion tracking.