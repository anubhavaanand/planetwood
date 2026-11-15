## File: src/systems/DailyRewardSystem.js:58

### Trigger
`checkDailyReward()` at line 58 uses `Date.now()` (local system time) to compare against `lastClaimed` which is stored as UTC date string via `new Date().toISOString().split('T')[0]` (line 126).

### Impact
- **DST transitions**: When clocks spring forward/back, `Date.now()` local midnight ≠ UTC midnight
- Player claims reward at 11:30 PM local (UTC next day) → `lastClaimed` = tomorrow UTC
- Next day at 12:30 AM local (still same UTC day) → `checkDailyReward` thinks already claimed
- Or reverse: player claims at 12:30 AM local (UTC previous day) → can claim again 23.5 hours later

### Root Cause
Mixing local time (`Date.now()`) for comparison with UTC-stored dates.

### Suggested Fix
Use UTC consistently:
```javascript
checkDailyReward(progressionSys = null) {
  const now = new Date();
  const todayUTC = now.toISOString().split('T')[0]; // UTC date string
  const lastClaimed = this.data.lastClaimed; // already UTC
  // ...
}
```

Or use `Date.UTC()` for all comparisons.

### Verdict
**Suggestion** — DST/zone mismatch can allow double-claim or block valid claim.