# OpenDesign Prompt: Planetwood Component Documentation Reference

## Mission
Create a comprehensive, interactive component documentation page that documents every Planetwood UI component in every state (default, hover, focus, active, disabled, error, loading, empty). This will serve as the single source of truth for all engineers integrating UI components into the Three.js game engine.

## Brand Tokens (Planetwood)
```css
:root {
  --primary-green: #4e8c6d;
  --dark-bg: #283436;
  --surface: rgba(60, 72, 74, 0.9);
  --lighter-surface: rgba(60, 72, 74, 0.95);
  --white-text: #ffffff;
  --muted-text: rgba(255, 255, 255, 0.6);
  --accent-hover: #5da37d;
  --border-color: rgba(255, 255, 255, 0.1);
  --radius: 8px;
  --font-body: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'SF Mono', 'Fira Code', monospace;
  --focus-outline: 2px solid var(--primary-green);
  --error-red: #c0392b;
  --warning-amber: #f39c12;
  --success-green: #4e8c6d;
}
```

## Components to Document (11 total)

### 1. LoadingScreen
**File**: `public/ui/loading-screen.html`
**Exports**: `window.LoadingScreen`
**API**:
```javascript
window.LoadingScreen.show()
window.LoadingScreen.hide()
window.LoadingScreen.setProgress(value) // 0-100
```

**States to document**:
- ✅ Initial (hidden) — nothing visible
- ✅ Active — full overlay with planet animation + progress bar at 0%
- ✅ Mid-progress — progress at 47% with status text
- ✅ Near-complete — progress at 92%, "Building world..." text
- ✅ Complete — progress at 100%, fading out
- ✅ Error — progress bar turns red, retry button visible

**CSS highlight**: Animated rotating planet (border-radius + conic-gradient rotation), progress bar with shimmer effect, status text with cycling animation.

**Integration code**:
```javascript
// In src/main.js during scene load
const loadScreen = window.LoadingScreen;
loadScreen.show();
const loadManager = new THREE.LoadingManager();
loadManager.onProgress = (url, loaded, total) => {
  loadScreen.setProgress((loaded / total) * 100);
};
sceneSystem.loadScene().then(() => loadScreen.hide());
```

**Accessibility notes**: `role="progressbar"`, `aria-valuenow`, `aria-live="polite"` on status text, `aria-busy="true"` on container, focus trapping during loading, reduced-motion disables planet rotation.

**Edge cases**: 
- Tab hidden during load — continue loading silently, complete on visibility change
- Load completes before show() called — queue hide
- Multiple show() calls — idempotent, only first takes effect
- HTML injection in status text — use textContent not innerHTML

### 2. HUD
**File**: `public/ui/hud.html`
**Exports**: `window.HUD`
**API**:
```javascript
window.HUD.init()
window.HUD.setPlayerCount(n)
window.HUD.setFPS(n)
window.HUD.setConnectionQuality("good" | "fair" | "poor")
window.HUD.destroy()
```

**States to document**:
- ✅ Default — player count 1, FPS 60, connection good (green dot)
- ✅ Low FPS — player count 1, FPS 18 (red text or warning color)
- ✅ High player count — player count 24, FPS 55, connection good
- ✅ Poor connection — connection indicator red
- ✅ Muted player count — extremely high count "99+"

**CSS highlight**: `tabular-nums` for stable FPS display, `pointer-events: none` for click-through, `gap: 1rem` pill layout with `--dark-bg` surface.

**Integration code**:
```javascript
// Game loop integration
window.HUD.setFPS(Math.round(1 / delta));
window.HUD.setPlayerCount(multiplayerSystem.getPlayerCount());
window.HUD.setConnectionQuality(networkManager.getQuality());
```

**Accessibility notes**: `role="status"`, `aria-live="polite"` on container, `aria-hidden="true"` on count values (text in aria-label instead), dynamic `aria-label` updates track all three values.

**Edge cases**: 
- FPS = 0 (tab hidden) — show last known value, don't animate
- destroy() called before init() — silent no-op
- requestAnimationFrame stops when tab hidden — resume on show

### 3. Notifications (Toast System)
**File**: `public/ui/notifications.html`
**Exports**: `window.Notifications`
**API**:
```javascript
window.Notifications.notify({ type, title, message, duration })
```
- `type`: `"join"` (green) | `"leave"` (red) | `"system"` (amber) | `"achievement"` (purple) | `"default"` (green)
- `duration`: ms, default 4000

**States to document**:
- ✅ Join toast — green left border: "🎮 CalmOwl joined the world"
- ✅ Leave toast — red left border: "🎮 MightyWhale left the world"
- ✅ System toast — amber left border: "⏰ Saving in 30s..."
- ✅ Achievement toast — purple left border: "🏆 You walked 1000 steps!"
- ✅ Error toast — red left border: "❌ Connection lost. Retrying..."
- ✅ Multi-line toast — long message wraps at max-width
- ✅ Max visible (3) — excess queued, shown as older ones dismiss
- ✅ Empty queue — nothing visible

**CSS highlight**: Slide-in-right animation, `backdrop-filter: blur(8px)`, colored left border per type, auto-dismiss with `transitionend` listener.

**Integration code**:
```javascript
// Player joined event
networkManager.on('player_joined', (player) => {
  window.Notifications.notify({
    type: 'join',
    title: `${player.name} joined`,
    message: '',
    duration: 4000
  });
});
```

**Accessibility notes**: `role="alert"`, `aria-live="assertive"`, colored left border + not just color (has text prefix), dismissible by click/keyboard.

**Edge cases**:
- 50 rapid notifications — queue management, max 3 visible
- Back-to-back identical notifications — deduplicate if same title+message in last 2s
- Notify during reduce-motion — skip slide animation, just opacity

### 4. ChatInput Panel
**File**: `public/ui/chat-input-panel.html`
**Exports**: `window.ChatPanel`
**API**:
```javascript
window.ChatPanel.open()
window.ChatPanel.close()
window.ChatPanel.isOpen // boolean
```

**Events**: Listens for Enter key globally, dispatches `chat:send` CustomEvent with `{ message }` detail.

**States to document**:
- ✅ Closed — hidden at bottom of screen
- ✅ Open (empty) — visible, input focused, send button disabled
- ✅ Open (typing) — input has text, send button enabled
- ✅ Open (too long) — character count, visual warning near limit
- ✅ Sending — sends, shows brief confirmation, closes

**CSS highlight**: Slide-up animation from bottom, input styling with green border on focus, disabled send button styling, keyboard-accessible send.

**Integration code**:
```javascript
document.addEventListener('chat:send', (e) => {
  multiplayerSystem.sendChat(e.detail.message);
});
```

**Accessibility notes**: Auto-focus on open, Escape to close, Enter to send, `aria-label` on input, focus returns to trigger element on close.

**Edge cases**: 
- Rapid open/close — debounce prevents race, always ends closed
- Empty send — prevented by button disabled state
- Rate limit (1 msg/2s) — visual indicator in panel, button disabled briefly

### 5. Chat Bubbles
**File**: `public/ui/chat-bubbles.html`
**Exports**: `window.ChatBubbles`
**API**:
```javascript
window.ChatBubbles.showMessage({ name, text })
window.ChatBubbles.updatePositions(updates)
window.ChatBubbles.clearAll()
```

**States to document**:
- ✅ Single bubble — one player chatting, bubble above their area
- ✅ Multiple bubbles — multiple players chatting simultaneously
- ✅ Bubble fade — 5s auto-fade, sliding out
- ✅ Clear all — all bubbles removed instantly
- ✅ Long text — bubble wraps, max-width clamp, scrollable if excessive

**CSS highlight**: `transition: opacity 0.3s, transform 0.3s`, fade-out class, `::before` pseudo-element for speech tail, semi-transparent background.

**Integration code**:
```javascript
chatSystem.on('message', ({ senderId, senderName, text }) => {
  // Show bubble above nameplate area (positioned via updatePositions)
  window.ChatBubbles.showMessage({ name: senderName, text: text });
});
```

**Accessibility notes**: `aria-live="polite"` on bubble container, role="status", sanitize text content via textContent, `aria-label` includes sender name.

**Edge cases**: 
- 20 rapid messages — queue, show latest 5, older fade faster
- Zero-width content — sanitize, don't render empty bubbles
- Off-screen avatar — bubble still renders on screen edge with arrow

### 6. Chat Log
**File**: `public/ui/chat-log.html`
**Exports**: `window.ChatLog`
**API**:
```javascript
window.ChatLog.add({ name, text, timestamp })
window.ChatLog.toggle()
window.ChatLog.clear()
```

**States to document**:
- ✅ Hidden — collapsed, only toggle icon visible
- ✅ Empty (open) — "No messages yet. Start chatting!" placeholder
- ✅ With messages — scrollable list, newest at bottom, auto-scroll
- ✅ Many messages — scroll history, manual scroll disables auto-scroll
- ✅ Toggle closed — smooth slide-out

**CSS highlight**: Slide-in from right, `scroll-behavior: smooth`, alternating row shading? (no — single color), timestamp muted, sender name brighter.

**Integration code**:
```javascript
window.ChatLog.add({
  name: 'MightyWhale',
  text: 'Hey everyone!',
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
});
```

**Accessibility notes**: `aria-live="polite"`, max-height with keyboard scrollable, focus trap when open, toggle button has aria-expanded.

**Edge cases**: 
- 1000+ messages — virtual scroll or cap at 200, oldest removed
- Negative/zero height — minimum 40px shown
- Chat log open + emote picker opens — chat log closes first

### 7. Emote Picker
**File**: `public/ui/emote-picker.html`
**Exports**: `window.emotePickerInstance`
**API**:
```javascript
window.emotePickerInstance.open()
window.emotePickerInstance.close()
window.emotePickerInstance.isOpen // boolean
```

**Events**: Dispatches `emote:select` CustomEvent with `{ emoji, name }` detail.

**Emote grid** (3×3):
| 👋 Wave | 💃 Dance | 👆 Point |
| 👏 Clap | 😂 Laugh | 🪑 Sit |
| 😴 Sleep | ❤️ Heart | 🙋 Bye |

**States to document**:
- ✅ Closed — hidden
- ✅ Open — overlay backdrop + grid centered, dark backdrop
- ✅ Select — selected emoji highlights briefly, dispatches event, closes
- ✅ Hover — emoji slightly larger, glow effect
- ✅ Focus — keyboard nav, arrow keys move between grid cells
- ✅ Inactive/disabled — future feature (emotes on cooldown)

**CSS highlight**: Grid layout, backdrop blur, emoji enlarge on hover, smooth transitions, focus-visible ring.

**Integration code**:
```javascript
document.addEventListener('emote:select', (e) => {
  // Trigger animation on avatar
  multiplayerSystem.sendEmote(e.detail.name);
  // Show notification
  window.Notifications.notify({
    type: 'system',
    title: `You ${e.detail.name.toLowerCase()}ed!`
  });
});
```

**Accessibility notes**: `role="grid"` + `role="gridcell"`, arrow key navigation, Tab wraps inside grid, Escape closes, aria-label on each button describes emoji.

**Edge cases**:
- Emote picker + chat input both open — resolve z-order (picker wins)
- 9 emotes max — extendable (up to 12 = 3×4) in future
- First interaction — create singleton if not exists

### 8. Player List
**File**: `public/ui/player-list.html`
**Exports**: `window.PlayerList`
**API**:
```javascript
window.PlayerList.togglePanel()
window.PlayerList.closePanel()
window.PlayerList.toggleList()
window.PlayerList.addPlayer({ name, status })
window.PlayerList.removePlayer(name)
window.PlayerList.updatePlayerStatus(name, status)
```

**States**:
- ✅ Closed — only toggle button visible top-right
- ✅ Open (collapsed) — shows player count + toggle chevron
- ✅ Open (expanded) — full list with name, status dot, "You" badge
- ✅ 1-3 players, 4-6 players, 7-10 players
- ✅ "You" badge on local player
- ✅ Status: online (green), away (amber), disconnected (red)
- ✅ Empty state: "No other players nearby"

**CSS highlight**: Panel slides from right, status dots with box-shadow glow, "You" badge green pill.

**Integration code**:
```javascript
multiplayerSystem.on('peer_joined', (player) => {
  window.PlayerList.addPlayer({ name: player.name, status: 'online' });
});
multiplayerSystem.on('peer_left', (playerId) => {
  window.PlayerList.removePlayer(playerId);
});
```

**Accessibility notes**: `aria-expanded` on toggle button, `role="list"` on player list, `aria-live="polite"` updates, keyboard navigable.

### 9. Settings Panel
**File**: `public/ui/settings-panel.html`
**Exports**: `window.SettingsPanel`
**API**:
```javascript
window.SettingsPanel.open()
window.SettingsPanel.close()
window.SettingsPanel.isOpen // boolean
```

**Events**: `settings:volume`, `settings:mute`, `settings:quality`, `settings:fps`

**States**:
- ✅ Closed — hidden
- ✅ Open — centered modal with backdrop
- ✅ Audio tab — volume slider FFX + mute toggle
- ✅ Video tab — quality dropdown (Low/Medium/High/Ultra)
- ✅ General tab — FPS toggle, language (future), reset button
- ✅ Focus trap — Tab cycles within modal

**Integration**:
```javascript
document.addEventListener('settings:volume', (e) => {
  audioSystem.setVolume(e.detail.value / 100);
});
document.addEventListener('settings:quality', (e) => {
  rendererSystem.setQuality(e.detail.level);
});
```

### 10. Error Screen
**File**: `public/ui/error-screen.html`
**Exports**: `window.ErrorScreen`
**API**:
```javascript
window.ErrorScreen.show({ type, title, message, icon, countdown })
window.ErrorScreen.hide()
window.ErrorScreen.updateCountdown(n)
```

**Predefined types**: `disconnect`, `timeout`, `error`, `kicked`

**States**:
- ✅ Disconnect — full overlay, "Connection Lost", 10s countdown
- ✅ Timeout — same but amber icon
- ✅ Error — no auto-countdown, requires manual action
- ✅ Kicked — red icon, "You were removed"
- ✅ Reconnect clicked — countdown stops, attempts reconnect
- ✅ Reconnected — counts down, error hides, toast appears

### 11. Nameplate
**File**: `public/ui/nameplate-mockup.html`
**HTML structure**:
```html
<div class="nameplate" id="nameplate-{id}">
  <div class="status-dot online"></div>
  <div class="player-name">BraveFox</div>
  <div class="you-badge">You</div>
</div>
```

**States**: online (green dot), away (amber), offline (red)

---

## Page Layout

### Left Sidebar (sticky, 300px)
- Component navigation list (all 11)
- Search/filter by name, state
- "Export all as JSON" button
- "Copy integration code" button

### Main Content Area
Each component section has:

1. **Component title** + file path + `window.*` export name
2. **State gallery** — visual grid of all states (2-3 columns)
3. **API table** — method signatures, descriptions, return types
4. **Events table** — event names, detail shape, dispatched by
5. **Integration code** — copy-paste-ready JavaScript for each event/method
6. **CSS architecture** — key class names, BEM-ish pattern, CSS custom properties used
7. **Accessibility checklist** — what's implemented, what's planned
8. **Edge cases** — specific edge case handling per component

---

## Interactive Features
- Search bar filters components and states
- Click a state preview → opens isolated demo of that component in that state
- "Copy code" buttons for every integration snippet
- Theme toggle? Optional — or just use Planetwood dark theme everywhere
- Expandable "Edge Cases" and "Accessibility" sections

---

## Output File
`public/ui/component-docs.html` — single, complete reference HTML file for all 11 components.