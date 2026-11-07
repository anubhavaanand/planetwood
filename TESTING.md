# Planetwood E2E Testing Guide

This document describes how to run the cross-browser Playwright E2E tests for
Planetwood, covering all 5 quickstart scenarios from `specs/001-multiplayer-planet-world/quickstart.md`.

## Test Coverage

| Scenario | Description | Test |
|----------|-------------|------|
| **1** | Planet Loads & Player Roams | Page loads, title screen, BEGIN, player roams, NPC nameplates visible |
| **2** | Two Players See Each Other | Two browser windows, both see each other's nameplates within 500ms, position sync |
| **3** | Proximity Chat | Nearby players see chat messages; distant player sees nothing; rate limit (1 msg/2s) |
| **4** | Disconnection Handling | Disconnected player's avatar disappears from peer view within ~3s |
| **5** | Single-Player Fallback | Planet loads without relay; "Multiplayer unavailable — exploring alone" notification |

Plus emote tests (local + remote emote visibility).

## Prerequisites

- Node.js 18+
- npm
- Playwright browsers installed (Chrome, Firefox, Edge)

## Installation

```bash
# From the planetwood project root
npm install

# Install Playwright browsers (required once, or after updates)
npx playwright install --with-deps

# Install server dependencies (required for multiplayer scenarios)
cd server && npm install && cd ..
```

## Running Tests Locally

### Option A: All browsers (recommended)

The Playwright config (`playwright.config.ts`) starts the Vite dev server automatically before tests run. **You must start the WebSocket relay server separately** in a terminal before running tests:

```bash
# Terminal 1: WebSocket relay (required for multiplayer scenarios)
cd server && node index.js

# Terminal 2: Run all tests on all 3 browsers (Chromium, Firefox, Edge)
npx playwright test
```

The config's `webServer` only manages the Vite dev server because Playwright's readiness check requires an HTTP endpoint, and the relay is WebSocket-only.


### Option B: Headed mode (watch the browser)

```bash
npx playwright test --headed
```

### Option C: Debug mode (step through tests)

```bash
npx playwright test --debug
```

### Option D: Manual dev servers (if you want to control the servers yourself)

Start the relay and Vite dev server in separate terminals, then run tests
against the already-running servers:

```bash
# Terminal 1: WebSocket relay
cd server && node index.js

# Terminal 2: Vite dev server
npm run dev

# Terminal 3: Run tests (servers already running, reuseExistingServer=true)
npx playwright test
```
## Viewing Test Results

After a test run, Playwright generates:

- **HTML report**: `playwright-report/index.html` — open it with:
  ```bash
  npx playwright show-report
  ```
- **Traces**: captured on first retry, viewable in the HTML report
- **Screenshots & videos**: captured on failure, stored in `test-results/`

## CI Configuration

Cross-browser tests run on GitHub Actions in `.github/workflows/test.yml`:

- Triggers: push/PR to `main`, and manual dispatch
- Matrix: Chromium, Firefox, Edge on `ubuntu-latest`
- Artifacts: test results and HTML report uploaded for 7 days

## Writing New Tests

Tests live in `tests/e2e/planetwood.spec.ts`. Key helpers already defined:

- `waitForReady(page)` — waits for loading to finish and title screen to appear
- `startPlaying(page)` — clicks BEGIN and advances intro dialogue
- `moveKey(page, key, holdMs)` — holds a movement key then releases
- `sendChat(page, text)` — opens chat input, types, sends
- `triggerEmote(page, key)` — triggers an emote (1=wave, 2=stretch, 3=look)

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `npx playwright test` fails to connect to `ws://localhost:3005` | Make sure `server/node_modules` exists: `cd server && npm install` |
| Tests time out on loading | The Vite dev server may still be starting; increase `webServer` timeout in `playwright.config.ts` |
| Firefox/Edge browsers not found | Run `npx playwright install --with-deps firefox edge` |
| Multiplayer scenarios flaky | Ensure both pages reach the `playing` state before asserting; use `waitForTimeout(1000)` after `startPlaying` |
| `MSEdge` channel missing on Linux | Edge may not be available on all runners; the config falls back gracefully |

## Project Structure

```
planetwood/
├── playwright.config.ts          # Cross-browser Playwright config
├── tests/e2e/planetwood.spec.ts   # E2E tests for all 5 quickstart scenarios
├── .github/workflows/test.yml     # CI: cross-browser E2E on push/PR
├── TESTING.md                     # This file
├── specs/001-multiplayer-planet-world/quickstart.md  # Source scenarios
├── server/index.js                # WebSocket relay (started by webServer)
└── vite.config.js                 # Vite dev server (started by webServer)
```
