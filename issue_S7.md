## File: src/systems/QuestUI.js:85-100

### Trigger
Prestige button rendered at lines 85-100 has click handler that calls `questSys.prestige()` directly with **no confirmation dialog**.

### Impact
- Accidental click on prestige button **immediately resets all quest progress**
- No undo, no "Are you sure?" — permanent data loss in one click
- Button positioned in sidebar where misclicks likely (near other UI)

### Root Cause
Direct callback without confirmation:
```javascript
prestigeBtn.addEventListener('click', () => {
  if (this.questSys) this.questSys.prestige();
});
```

### Suggested Fix
Add confirmation modal:
```javascript
prestigeBtn.addEventListener('click', () => {
  if (confirm('Reset ALL quest progress? This cannot be undone.')) {
    if (this.questSys) this.questSys.prestige();
  }
});
```
Or a custom modal matching game UI style.

### Verdict
**Suggestion** — UX safety issue; destructive action without confirmation.