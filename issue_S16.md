## File: src/main.js:1157-1158

### Trigger
Planet transition at line 1149 triggers when `playerZ > 160` (entering planet) and `playerZ <= 160` (exiting planet). The same threshold (160) is used for both directions.

### Impact
When player crosses z=160 back and forth (e.g., walking near the arch), the scene toggles rapidly:
- Player at z=160.1 → planet shows
- Player at z=159.9 → street shows
- Player oscillates → **rapid scene switching**, camera mode flipping, controls toggling

This causes visual glitches, camera jitter, and control instability.

### Root Cause
No hysteresis — same threshold for enter and exit:
```javascript
if (!inPlanetScene && playerZ > 160) { inPlanetScene = true; ... }
else if (inPlanetScene && playerZ <= 160) { inPlanetScene = false; ... }
```

### Suggested Fix
Add hysteresis with separate thresholds:
```javascript
const ENTER_PLANET_Z = 160;
const EXIT_PLANET_Z = 150;  // 10 units of hysteresis

if (!inPlanetScene && playerZ > ENTER_PLANET_Z) {
  inPlanetScene = true;
  // ...
} else if (inPlanetScene && playerZ < EXIT_PLANET_Z) {
  inPlanetScene = false;
  // ...
}
```

### Verdict
**Suggestion** — no hysteresis on planet transition causes rapid scene toggling near boundary.