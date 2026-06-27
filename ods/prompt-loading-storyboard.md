# OpenDesign Prompt: Planetwood Loading Storyboard

## Mission
Create a visual storyboard document showing every loading state, transition, and error recovery flow in Planetwood. This will guide the implementation of `LoadingScreen` integration in `index.html` + `src/main.js` (T012) and the single-player fallback mode (T016).

## Brand Tokens (Planetwood)
```css
:root {
  --primary-green: #4e8c6d;
  --dark-bg: #283436;
  --surface: rgba(60, 72, 74, 0.95);
  --white-text: #ffffff;
  --muted-text: rgba(255, 255, 255, 0.6);
  --accent-hover: #5da37d;
  --border-color: rgba(255, 255, 255, 0.1);
  --error-red: #c0392b;
  --warning-amber: #f39c12;
  --success-green: #4e8c6d;
  --info-blue: #3498db;
  --radius: 12px;
  --font-body: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'SF Mono', 'Fira Code', monospace;
}
```

## Loading Flow States

### Phase 0: Pre-Load (0-100ms)
**Trigger**: User opens `index.html`
**UI**: 
- Minimal HTML shell loads instantly (inline critical CSS)
- Shows Planetwood logo (SVG) centered on `--dark-bg`
- No JS executed yet
- **Target**: First paint < 100ms

### Phase 1: App Bootstrap (100-500ms)
**Trigger**: Vite entry point (`src/main.js`) executes
**UI**:
- Logo scales down slightly, moves to top-center
- Progress bar appears below logo (0% → 15%)
- Status text: "Initializing engine..."
- Three.js + core modules loading

### Phase 2: Asset Discovery (500ms-1.5s)
**Trigger**: `SceneSystem.js` starts loading manifest
**UI**:
- Progress: 15% → 30%
- Status: "Discovering world assets..."
- Subtle particle animation around logo (CSS-only, reduced-motion safe)
- Shows asset count: "47 assets queued"

### Phase 3: Critical Assets (1.5s-3.5s)
**Trigger**: glTF scene + decoded_animations.json start loading
**UI**:
- Progress: 30% → 70%
- Status cycles every 800ms:
  - "Loading terrain..." (scene.gltf)
  - "Loading animations..." (decoded_animations.json - 21MB)
  - "Loading textures..." (KTX2 files)
- Progress bar shows **two layers**:
  - Primary: overall progress
  - Secondary (thin): current file progress
- **Cancel button** appears (returns to Phase 0 with "Load cancelled" toast)

### Phase 4: Scene Processing (3.5s-4.5s)
**Trigger**: Assets loaded, Three.js parsing + AnimationSystem init
**UI**:
- Progress: 70% → 90%
- Status: "Building world..."
- Logo pulses gently (CSS animation)
- Shows processing steps:
  - ✓ Parsing glTF
  - ✓ Building bone hierarchies
  - ✓ Creating animation clips
  - ⏳ Spawning NPCs...

### Phase 5: Ready (4.5s-5s)
**Trigger**: First render frame complete
**UI**:
- Progress: 90% → 100% (smooth ease-out)
- Status: "Welcome to Planetwood!"
- Logo + progress bar **fade out** (300ms)
- **HUD fades in** (top-center, 400ms delay)
- **Nameplates appear** (staggered 100ms each)
- World becomes interactive

---

## Error & Recovery States

### E1: Network Failure (Asset Load)
**Trigger**: Any critical asset fails to load (timeout > 15s or HTTP error)
**UI**:
- Progress bar turns `--error-red`
- Status: "Connection lost. Retrying..."
- **Retry button** appears (primary action)
- **Offline mode button** (secondary) → triggers single-player fallback
- Auto-retry every 5s (max 3 attempts)
- Toast notification via `Notifications.notify({ type: 'error', ... })`

### E2: glTF Parse Error
**Trigger**: `scene.gltf` or `scene.bin` corrupted/invalid
**UI**:
- Modal overlay (z-index 10000) with `--error-red` accent
- Title: "World Data Corrupted"
- Message: "The planet data couldn't be read. Please refresh or contact support."
- Buttons: "Refresh Page" | "Report Issue"
- Logs error to console with `ErrorScreen` component integration

### E3: Animation Data Mismatch
**Trigger**: `decoded_animations.json` schema version mismatch or bone count mismatch
**UI**:
- Inline warning in loading screen (not modal)
- Status: "Animation data outdated — using fallback idle"
- Continues loading with reduced NPC animations
- Logs detailed diff to console (dev only)

### E4: WebGL Context Lost
**Trigger**: `webglcontextlost` event during load
**UI**:
- Full-screen overlay: "Graphics Device Reset"
- Message: "Your graphics driver reset. Reloading in 3s..."
- Auto-reload after 3s (or manual button)
- Preserves no state (fresh load)

### E5: Single-Player Fallback (Multiplayer Failed)
**Trigger**: WebSocket relay connection fails after 5s timeout (T016)
**UI**:
- **Non-blocking** — loading continues to Phase 5
- Toast: `Notifications.notify({ type: 'warning', title: 'Multiplayer Unavailable', message: 'Exploring alone today. Retry in background...', duration: 8000 })`
- HUD connection indicator shows `--warning-amber` (fair)
- Background retry every 30s
- On reconnect: toast "Multiplayer restored!" + HUD turns `--success-green`

---

## Transition Specifications

| Transition | Duration | Easing | Details |
|---|---|---|---|
| Phase 0→1 | 200ms | ease-out | Logo scale 1→0.8, translateY -20px |
| Phase 1→2 | 300ms | ease-in-out | Progress bar appears (height 0→4px) |
| Phase 2→3 | 400ms | ease-out | Sub-text fades in, particle burst |
| Phase 3→4 | 300ms | ease-in | Status cycling starts |
| Phase 4→5 | 500ms | cubic-bezier(0.25, 0.46, 0.45, 0.94) | Progress 90→100, logo+bar fade, HUD fade-in |
| Error overlay | 250ms | ease-out | Backdrop blur(4px), modal scale 0.95→1 |
| Toast in | 200ms | ease-out | Slide from right + fade |
| Toast out | 300ms | ease-in | Slide right + fade |
| Retry button pulse | 1.5s | infinite | `box-shadow` pulse on `--error-red` |

---

## Responsive Behavior
- **Mobile (< 640px)**: Logo smaller (80px), progress bar full-width, status text 14px, buttons stacked
- **Tablet (640-1024px)**: Two-column layout for error modals
- **Desktop (> 1024px)**: Centered card (480px max-width), comfortable reading

---

## Accessibility
- `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- `aria-live="polite"` on status text
- `aria-busy="true"` on loading container
- Focus order: Cancel → Retry → Offline Mode
- Screen reader announces phase changes
- Reduced motion: disables logo pulse, particle animation, progress bar shimmer
- High contrast: `--border-color` → `rgba(255,255,255,0.3)`, focus outlines 3px

---

## Integration Points (for Engineers)

### LoadingScreen API (existing component)
```javascript
window.LoadingScreen.show()
window.LoadingScreen.hide()
window.LoadingScreen.setProgress(0.47) // 0-1
window.LoadingScreen.setStatus("Loading terrain...")
window.LoadingScreen.setSubProgress(0.8) // current file
window.LoadingScreen.showError({ message, retry, retryable: true })
window.LoadingScreen.showOfflineButton()
```

### Notifications API
```javascript
window.Notifications.notify({
  type: 'warning', // 'join' | 'leave' | 'system' | 'achievement' | 'error' | 'warning'
  title: 'Multiplayer Unavailable',
  message: 'Exploring alone today...',
  duration: 8000
})
```

### HUD API (connection indicator)
```javascript
window.HUD.setConnectionQuality('fair') // 'good' | 'fair' | 'poor'
```

---

## Visual Deliverables (in the HTML)

### 1. Flow Diagram (Mermaid.js or SVG)
- Full flowchart with all phases, errors, retries, fallbacks
- Clickable nodes → highlight in timeline below

### 2. Timeline Scrubber
- Horizontal timeline: 0ms → 5000ms (+ error branches)
- Scrubber handle shows exact UI at that timestamp
- Hover any phase → shows spec panel on right
- Play/pause auto-play through happy path

### 3. State Gallery (Grid)
- Each phase/error as a card with:
  - Screenshot/mockup of exact UI
  - CSS snippets for key styles
  - Timing specs
  - Code integration snippet

### 4. Asset Loading Waterfall (Mock)
- Visual waterfall chart of asset loads
- Shows parallel vs sequential loads
- Highlights critical path (decoded_animations.json = 21MB)

### 5. Copy-Paste Code Blocks
- `index.html` critical CSS + shell
- `src/main.js` loading orchestration
- Error handling wrapper
- Single-player fallback trigger

---

## Output File
`public/ui/loading-storyboard.html` — interactive storyboard with timeline scrubber, state gallery, and copy-paste code blocks.