## File: src/systems/SceneSystem.js:109-107 (low-end device detection)

### Trigger
`_detectLowEndDevice()` at lines 94-107 uses WebGL renderer string heuristics and `navigator.deviceMemory` to detect low-end devices.

### Impact
- `navigator.deviceMemory` is not supported in all browsers (Safari, Firefox behind flag)
- WebGL renderer string varies wildly across drivers — false positives/negatives
- Incorrect classification affects: pixel ratio, shadow map quality, tone mapping, bloom enable
- User on high-end device classified as low-end → degraded visuals unnecessarily

### Root Cause
Heuristic-based detection is unreliable. No fallback or user override.

### Suggested Fix
Add localStorage override for user preference:
```javascript
_detectLowEndDevice() {
  // User override
  const pref = localStorage.getItem('planetwood.lowEndMode');
  if (pref === 'true') return true;
  if (pref === 'false') return false;
  // ... existing heuristics
}
```

And expose a UI toggle in settings.

### Verdict
**Nit** — unreliable low-end detection with no user override.