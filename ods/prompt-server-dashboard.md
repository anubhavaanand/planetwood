# OpenDesign Prompt: Planetwood Server Dashboard

## Mission
Create a web-based admin dashboard for the Planetwood WebSocket relay server (`server/index.js`). This dashboard monitors connected players, sessions, connection quality, and game events in real-time. It communicates with the relay server via WebSocket (port 3001) using a separate admin protocol.

## Brand Tokens (Planetwood - Admin Variant)
```css
:root {
  --primary-green: #4e8c6d;
  --dark-bg: #1a1a1a;
  --surface: #2a2a2a;
  --surface-alt: #333333;
  --white-text: #ffffff;
  --muted-text: #888888;
  --accent-hover: #5da37d;
  --border-color: #444;
  --error-red: #e74c3c;
  --warning-amber: #f39c12;
  --success-green: #2ecc71;
  --info-blue: #3498db;
  --font-mono: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  --font-body: system-ui, -apple-system, sans-serif;
}
```

## Tech Stack
- **Single HTML file** — no external dependencies
- **WebSocket** client connects to `ws://localhost:3001` with `{ type: "admin_auth", token: "planetwood-admin" }`
- **Real-time updates** via WebSocket messages
- **Charts**: Canvas 2D or inline SVG (no Chart.js/library)
- **Auto-reconnect** with exponential backoff

## Admin Protocol (WebSocket Messages)

### Client → Server
```json
{ "type": "admin_auth", "token": "planetwood-admin" }
{ "type": "admin_subscribe", "events": ["join", "leave", "chat", "sync", "error"] }
{ "type": "admin_get_state" }
{ "type": "admin_broadcast", "message": "Server maintenance in 5min" }
{ "type": "admin_kick", "playerId": "abc123" }
```

### Server → Client
```json
{ "type": "admin_auth_ok", "sessionId": "admin-001" }
{ "type": "admin_auth_fail", "reason": "Invalid token" }
{ "type": "admin_state", "players": [...], "sessions": {...}, "uptime": 12345 }
{ "type": "admin_event", "event": "player_joined", "data": {...} }
{ "type": "admin_broadcast_ack", "sent": true }
```

## Required Dashboard Sections

### 1. Connection Status Bar (Top)
- Status indicator: Connected (green) / Disconnected (red) / Connecting (amber pulse)
- Session ID display
- Reconnect button
- "Connect" form: host input (default `localhost:3001`), auth token input
- Connection latency (ping/pong roundtrip, updated every 5s)

### 2. Player Overview Panel (Top Row, 4 Cards)
- **Active Players**: current count / max (e.g., "4 / 10") with sparkline mini-chart (last 60s)
- **Total Sessions**: all-time connections since server start
- **Peak Concurrent**: highest simultaneous player count
- **Uptime**: server uptime in HH:MM:SS format, ticking

### 3. Player Table (Main Content)
sortable, filterable table with columns:

| # | Player ID | Name | IP | Status | Latency | Anim State | Position (x,y,z) | Connected Since | Actions |
|---|---|---|---|---|---|---|---|---|---|
| 1 | abc123 | BraveFox | 192.168.1.5 | 🟢 Online | 45ms | idle_01 | (12.3, 0.5, -8.1) | 12:34:56 | [Kick] [Message] |
| 2 | def456 | ShyPanda | 192.168.1.8 | 🟡 Away (30s) | 120ms | away | (-5.2, 0.3, 15.7) | 12:36:10 | [Kick] [Message] |
| 3 | ghi789 | CalmOwl | 192.168.1.12 | 🔴 Disconnected | — | disconnected | — | 12:38:22 | [Remove] |

Features:
- Click column header to sort (asc/desc)
- Filter by name (text input), status (dropdown), IP
- Row highlight on hover
- Status color: green=online, amber=away (>30s idle), red=disconnected
- Latency color: green<100ms, amber<300ms, red≥300ms
- "Kick" button shows confirmation dialog
- "Message" opens inline text input to send broadcast

### 4. Live Event Log (Bottom Panel)
Scrollable log of all server events, newest at top:

```
[12:38:22] 🚪 CalmOwl (ghi789) disconnected — idle timeout
[12:36:10] 🎮 ShyPanda (def456) joined from 192.168.1.8
[12:35:00] 💬 BraveFox › "Hey everyone!"
[12:34:56] 🎮 BraveFox (abc123) joined from 192.168.1.5
[12:34:50] ⚡ Server started — ws://0.0.0.0:3001
```

Features:
- Auto-scroll to bottom; pause on manual scroll-up
- Filter by event type (join/leave/chat/sync/error)
- Clear log button
- Export log as JSON
- Error events highlighted with red left border
- Rate-limited: max 10 events/second display (buffer excess)

### 5. Performance Charts (Sidebar or Below)
#### Player Count Over Time
- Area chart: last 5 minutes, 1s intervals
- X-axis: time, Y-axis: count
- Max line visible, current peak labeled

#### Message Rate
- Area chart: messages/second over last 5 minutes
- Separate lines for: state sync, chat, system events
- Y-axis auto-scales

#### Latency Distribution
- Bar chart: players grouped by latency range (<50ms, 50-100, 100-200, 200-500, >500)
- Updates every 10s
- Count per bucket + percentage

### 6. Server Controls Panel (Right Sidebar)
- **Broadcast message** — text input + "Send to All" button
  - Optional: styled message (system/announcement/alert)
- **Kick player** — dropdown select + "Kick" button
- **Server command** — text input for raw admin commands
- **Restart signaling** — "Restart Relay" button (sends admin_restart)
- **Log level** — dropdown (debug/info/warn/error)

### 7. Session Details Modal (click player row)
- Player name, ID, IP, connection time
- Latency history (mini sparkline, last 60 pings)
- Position history trail (last 10 positions plotted on tiny 2D map)
- Chat history (last 20 messages from/to this player)
- Current animation state + clip name
- Actions: Kick, Message, View Logs

## Responsive Layout
- **Desktop (>1200px)**: Full layout — top bar, 4 cards, player table full width, sidebar on right
- **Tablet (768-1200px)**: Stacked cards, player table scrolls horizontally, charts below
- **Mobile (<768px)**: Single column, cards at top, compact player list with slide-out detail panel
- Admin dashboard dark theme (different from game — more "ops" feel)

## Data Persistence
- All data is ephemeral (server doesn't store history)
- Dashboard stores recent events in memory buffer (max 1000)
- No localStorage required
- On disconnect: show "Reconnecting..." overlay, data preserved, resume on reconnect

## Accessibility
- All tables have proper `<th>` scope
- Sort/filter controls have labels
- Live region for new events: `aria-live="polite"` on event log
- Charts have text fallback (data table below)
- Keyboard navigation: Tab through all controls, Enter to activate
- Focus management: new player modal traps focus

## Edge Cases
- Server not running — show "Connection refused" with retry button
- Auth fails — show error with "Settings" button (not auto-retry)
- 100 players — table virtual scroll, charts downsample to 5s intervals
- Tab hidden — throttle chart updates to 1s, keep connection alive
- Multiple tabs — each admin session gets own ID, no conflict
- Admin connects but no players — show "No players connected" empty state

## Interactive Features
- Full keyboard shortcuts: `Ctrl+K` = focus search, `Ctrl+B` = broadcast, `Ctrl+L` = clear log, `?` = show help overlay
- Real-time updates without page refresh
- Export data as CSV/JSON from any view
- Player count sparkline animates smoothly (requestAnimationFrame interpolation)

## Output File
`public/ui/server-dashboard.html` — admin dashboard for monitoring Planetwood relay server.

## Visual Notes
- Dark ops-theme (dark gray, not pure black)
- Monospace font for all data/player IDs
- Green/amber/red consistent with Planetwood status conventions
- Charts: translucent fills, solid strokes, gridlines subtle
- No animations or transitions when `prefers-reduced-motion: reduce`