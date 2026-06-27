# OpenDesign Prompt: Planetwood Interactive Prototype

## Mission
Create a single, self-contained HTML file that simulates the full Planetwood game UI flow. All 9 components wired together with fake game state, timers, and UI transitions. The user should be able to "play through" the game experience in a browser without any game engine.

## Brand
- Primary green: `#4e8c6d`
- Dark background: `#283436`
- Surface: `rgba(60, 72, 74, 0.9)`
- White text: `#ffffff`
- Muted text: `rgba(255, 255, 255, 0.6)`
- Accent hover: `#5da37d`
- Border: `rgba(255, 255, 255, 0.1)`
- Radius: `8px`
- Font: `system-ui, -apple-system, sans-serif`
- Favicon: use a 🌳 emoji or inline SVG planet icon

## UI Flow (Automated Timeline + User Interaction)

The prototype progresses through these states automatically with clickable interactions:

### Phase 1: LOADING (0-4s)
- Full-screen loading overlay with animated CSS planet (rotating circle with gradient)
- Progress bar advances: 0% → 30% → 60% → 90% → 100%
- Fake status text: "Loading terrain..." → "Loading models..." → "Spawning NPCs..." → "Connecting..." → "Ready!"
- At 100%: loading screen fades out, HUD fades in

### Phase 2: EXPLORE (4s onward — sandbox mode)
- HUD visible at top center: 👥 1 (player count), 🎯 60 (FPS), 📶 (green dot = connected)
- A simple "world" visualization: a dark gradient background with floating CSS circles representing other players/NPCs (abstract, not 3D)
- 3 floating nameplates visible in the "world" area (positioned like 3D space using CSS absolute positioning):
  - **BraveFox** (You) — center, has "You" badge, green status dot
  - **MightyWhale** — upper left, green status dot
  - **ShyPanda** — lower right, amber status dot (away)

### Phase 3: PLAYER JOINS (click "Simulate Join" button OR auto after 5s)
- Player count updates to 2, 3, 4 with animation
- Toast notification slides in: "🎮 CalmOwl joined the world"
- New nameplate appears at a random position
- Player list panel can be toggled via the toggle button (top-right area)
- Player list shows: BraveFox (You, online), MightyWhale (online), ShyPanda (away), CalmOwl (online)

### Phase 4: CHAT (click "Simulate Chat" or auto after 8s)
- Chat bubble appears above the nameplate with sender info (e.g. MightyWhale says "Hey everyone!")
- Chat log panel (bottom-right corner) can be toggled via a chat icon button
- Chat log shows timestamped messages with sender names
- Chat input panel opens when user clicks the message area or presses Enter
- User can type a message and "send" it (shows as own bubble + logged)
- Chat bubbles fade out after 5 seconds

### Phase 5: EMOTE (click "Simulate Emote" or auto after 12s)
- Emote picker opens as overlay with 3×3 grid:
  👋 Wave | 💃 Dance | 👆 Point | 👏 Clap | 😂 Laugh | 🪑 Sit | 😴 Sleep | ❤️ Heart | 🙋 Bye
- Clicking an emote selects it, dispatches a custom event, shows toast "You waved!" and closes picker
- Other player nameplates show random emote reactions

### Phase 6: SETTINGS (click the settings gear icon or press Escape)
- Settings panel opens as centered modal with backdrop
- Tabs: Audio (volume slider FFX, mute toggle), Video (quality dropdown), General (FPS toggle)
- Close button, Escape key, or backdrop click closes it
- Changes dispatch custom events (logged to console for demo)

### Phase 7: ERROR (click "Simulate Error" button)
- Error screen overlay appears with:
  - Predefined error types: disconnect, timeout, error, kicked
  - Shows appropriate icon, title, message
  - Countdown timer (auto-reconnect in 10s)
  - "Reconnect" button
  - "Back to Menu" button
- Clicking Reconnect simulates reconnection → error hides → toast "Reconnected!"

### Phase 8: DISCONNECT (click "Leave World" button)
- Player count decreases
- Toast: "MightyWhale left the world"
- That player's nameplate fades out and is removed
- Player list updates

## Component API Reference

### HUD (`window.HUD`)
- `init()` — Initialize DOM references, start FPS tracker
- `setPlayerCount(n)` — Update player count display
- `setFPS(n)` — Update FPS display (auto-calculates if not set externally)
- `setConnectionQuality("good"|"fair"|"poor")` — Update connection indicator color
- `destroy()` — Stop FPS tracker

### LoadingScreen (`window.LoadingScreen`)
- `show()` — Show the loading overlay
- `hide()` — Fade out the loading overlay
- `setProgress(value)` — Set progress bar (0-100)

### Notifications (`window.Notifications`)
- `notify({ type, title, message, duration })` — Show a toast
  - type: "join" | "leave" | "system" | "achievement" | "default"
  - duration: ms (default 4000)

### ChatInput Panel (`window.ChatPanel`)
- `open()` — Open the chat input panel, focus the text field
- `close()` — Close the chat input panel
- `isOpen` — Boolean getter
- Dispatches `chat:send` CustomEvent with `{ message }` detail

### Chat Bubbles (`window.ChatBubbles`)
- `showMessage({ name, text })` — Show a floating chat bubble above a nameplate in the "world" area
- `updatePositions(updates)` — Update bubble positions when nameplates move
- `clearAll()` — Remove all chat bubbles

### Chat Log (`window.ChatLog`)
- `add({ name, text, timestamp })` — Add a message to the chat log
- `toggle()` — Show/hide the chat log panel
- `clear()` — Clear all messages

### EmotePicker (`EmotePicker` class via `window.emotePickerInstance`)
- `open()` — Open the emote picker overlay
- `close()` — Close the emote picker overlay
- `isOpen` — Boolean
- Dispatches `emote:select` CustomEvent with `{ emoji, name }` detail

### PlayerList (`window.PlayerList`)
- `togglePanel()` — Show/hide the player list panel
- `closePanel()` — Close the player list panel
- `toggleList()` — Expand/collapse the player list
- `addPlayer({ name, status })` — Add a player to the list
- `removePlayer(name)` — Remove a player from the list
- `updatePlayerStatus(name, status)` — Update a player's status

### SettingsPanel (`window.SettingsPanel`)
- `open()` — Open the settings modal
- `close()` — Close the settings modal
- `isOpen` — Boolean
- Dispatches: `settings:volume`, `settings:mute`, `settings:quality`, `settings:fps` CustomEvents

### ErrorScreen (`window.ErrorScreen`)
- `show({ type, title, message, icon, countdown })` — Show error overlay
  - Predefined types: "disconnect", "timeout", "error", "kicked" (have default title/message/countdown)
- `hide()` — Hide error overlay
- `updateCountdown(n)` — Update the countdown number
- Listens for `error:reconnect` and `error:dismiss` CustomEvents on document

### Nameplate (inline implementation in the prototype)
- HTML structure: `<div class="nameplate"><div class="status-dot online"></div><span class="player-name">Name</span><span class="you-badge">You</span></div>`
- States: "online" (green), "away" (amber), "offline" (red) on status-dot
- `you-badge` only shown for local player
- Positioned absolutely in the "world" area to simulate 3D overlay

## Technical Requirements

1. **Single self-contained HTML file** — no external CSS/JS/fonts
2. **Scoped CSS** — all styles inline, no leaks
3. **Vanilla JS** — no frameworks, no libraries
4. **No inline event handlers** — use `addEventListener`
5. **Accessibility**:
   - `aria-live="polite"` regions for dynamic content
   - Focus trapping on modals (emote picker, settings, error screen)
   - Keyboard navigation: Tab between interactive elements, Enter/Space to activate, Escape to close modals
   - Visible focus indicators (`:focus-visible` with outline)
   - All icons have `aria-hidden="true"` with text labels for screen readers
6. **Reduced motion**: `@media (prefers-reduced-motion: reduce)` disables animations
7. **XSS protection**: Use `textContent` not `innerHTML` for user-supplied content
8. **Z-index layering** (from bottom to top):
   - World/nameplates: z-index 50
   - HUD: z-index 150
   - Notifications: z-index 200
   - Chat log: z-index 300
   - Player list: z-index 400
   - Emote picker: z-index 500
   - Settings panel: z-index 600
   - Error screen: z-index 10000
   - Loading screen: z-index 20000

## Simulated World Area
- Full viewport dark background (`#1a2a2e`) with subtle particle/grid effect
- CSS "ground plane" at bottom with grid lines to suggest 3D space
- Nameplates float at various positions to simulate 3D depth (varying sizes for depth)
- Each nameplate should be clickable to show a chat bubble above it
- The world area should feel like a game scene even though it's pure CSS

## Control Buttons
A floating toolbar (bottom-center, z-index 100) with buttons:
- "🎮 Simulate Join" — adds a random player
- "💬 Simulate Chat" — random player says something
- "😄 Simulate Emote" — opens emote picker
- "⚙️ Settings" — opens settings panel
- "⚠️ Simulate Error" — shows error screen
- "🚪 Leave World" — removes a random player
- Auto-simulation checkboxes: toggle auto-events on/off

## Output Format
A single valid HTML file. All component implementations must be complete and functional — not stubs. Every method listed above must work when called. Test with console: `HUD.setPlayerCount(5)`, `Notifications.notify({ type: 'join', title: 'Test', message: 'Hello!' })`, etc. should all work.

Planetwood favicon (inline SVG in the HTML head):
```html
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><text y='28' font-size='28'>🌳</text></svg>">
```
