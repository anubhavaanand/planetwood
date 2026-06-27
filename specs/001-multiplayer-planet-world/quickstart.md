# Quickstart: Multiplayer Planet World

## Prerequisites

- Node.js 18+
- npm
- Modern browser with WebGL2 + WebRTC

## Setup

```bash
# Install client dependencies
cd /path/to/planetwood
npm install

# Install relay server dependencies
cd server && npm install && cd ..
```

## Running

```bash
# Terminal 1: Start the WebSocket relay
cd server && node index.js

# Terminal 2: Start the Vite dev server
cd /path/to/planetwood && npm run dev
```

Open `http://localhost:5173` in your browser.

## Validation Scenarios

### Scenario 1: Planet Loads & Player Roams (P1)

1. Open `http://localhost:5173` in a browser
2. Wait for loading to finish (≤5 seconds)
3. Press W/A/S/D to move around the planet
4. Click and drag to rotate the camera
5. **Expected**: 3D planet visible with terrain, sky, grass, butterflies. Player avatar moves smoothly. NPCs play idle animations nearby.

### Scenario 2: Two Players See Each Other (P2)

1. Complete Scenario 1 in two browser windows (side-by-side)
2. Move Player A to a visible landmark
3. Check Player B's view
4. **Expected**: Player B sees Player A's avatar at the correct position. Movement updates appear within 500ms.

### Scenario 3: Proximity Chat (P3)

1. Complete Scenario 2 with three browser windows
2. Move two players close together, one far away
3. Press Enter to open chat, type a message, press Enter again
4. **Expected**: Nearby players see the message bubble + chat log. Distant player sees nothing.

### Scenario 4: Disconnection Handling

1. Complete Scenario 2
2. Close one browser window
3. **Expected**: The disconnected player's avatar disappears from the other player's view within 3 seconds.

### Scenario 5: Single-Player Fallback

1. Start the Vite dev server without starting the relay (`npm run dev`)
2. Open the browser
3. **Expected**: Planet loads in single-player mode. Notification shown: "Multiplayer unavailable — exploring alone."

## Quick Reference

| Command | Description |
|---------|-------------|
| `W/A/S/D` | Move player |
| Mouse drag | Rotate camera |
| Enter | Open/send chat |
| Tab | Navigate UI elements |
