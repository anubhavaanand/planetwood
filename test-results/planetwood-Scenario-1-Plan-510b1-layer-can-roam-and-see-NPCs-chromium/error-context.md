# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: planetwood.spec.ts >> Scenario 1: Planet Loads & Player Roams (P1) >> page loads, title screen appears, player can roam and see NPCs
- Location: tests/e2e/planetwood.spec.ts:69:3

# Error details

```
TimeoutError: locator.click: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('button:has-text("BEGIN")')
    - locator resolved to <button>BEGIN</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic:
    - generic: Caveman
    - generic "Interact": E
    - generic: Young Lady
    - generic "Interact": E
    - generic: Scout
    - generic "Interact": E
    - generic: Threekid
    - generic "Interact": E
    - generic: Factory Worker A
    - generic "Interact": E
    - generic: Factory Worker B
    - generic "Interact": E
    - generic: Female Sci
    - generic "Interact": E
    - generic: Factory Worker C
    - generic "Interact": E
    - generic: Mountainman
    - generic "Interact": E
    - generic: Oldwoman
    - generic "Interact": E
  - generic: 1 FPS | 1 draw | 1 tri | 15 tex | 57 geo | ~506.0ms
  - generic [ref=e4]:
    - generic [ref=e5]: Avatar
    - generic [ref=e6]:
      - generic [ref=e7]:
        - generic [ref=e8]: Hair
        - combobox [ref=e9]:
          - option "None" [selected]
          - option "hair1"
          - option "hair2"
          - option "hair3"
          - option "hair4"
          - option "hair5"
          - option "hair6"
          - option "hair7"
      - generic [ref=e10]:
        - generic [ref=e11]: Top
        - generic "Locked — reach Acquaintance tier (10 reputation)" [ref=e12]: 🔒
        - combobox [disabled] [ref=e13]:
          - option "None" [selected]
          - option "top1"
          - option "top2"
          - option "top3"
          - option "top4"
          - option "top5"
          - option "top6"
          - option "top7"
          - option "top8"
          - option "top9"
      - generic [ref=e14]:
        - generic [ref=e15]: Bottom
        - generic "Locked — reach Friend tier (25 reputation)" [ref=e16]: 🔒
        - combobox [disabled] [ref=e17]:
          - option "None" [selected]
          - option "bottom1"
          - option "bottom2"
          - option "bottom3"
          - option "bottom4"
          - option "bottom5"
          - option "bottom6"
          - option "bottom7"
      - generic [ref=e18]:
        - generic [ref=e19]: Shoes
        - generic "Locked — reach Confidant tier (50 reputation)" [ref=e20]: 🔒
        - combobox [disabled] [ref=e21]:
          - option "None" [selected]
          - option "shoes1"
          - option "shoes2"
          - option "shoes3"
          - option "shoes4"
          - option "shoes5"
          - option "shoes6"
          - option "shoes7"
      - button "Reset to default" [ref=e22] [cursor=pointer]
  - generic [ref=e23]:
    - button "Send Wave emote" [ref=e24] [cursor=pointer]: Wave (1)
    - button "Send Stretch emote" [ref=e25] [cursor=pointer]: Stretch (2)
    - button "Send Look emote" [ref=e26] [cursor=pointer]: Look (3)
  - generic:
    - button "Checklist" [ref=e27] [cursor=pointer]: ☰
    - button "Music" [ref=e28] [cursor=pointer]: ♪
    - button "Appearance" [ref=e29] [cursor=pointer]: 👕
    - button "Emote" [ref=e30] [cursor=pointer]: 💩
  - generic [ref=e31]:
    - generic [ref=e32]: messenger
    - button "BEGIN" [ref=e33] [cursor=pointer]
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | /**
  4   |  * Planetwood E2E tests — validates all 5 quickstart scenarios:
  5   |  *
  6   |  *   Scenario 1: Planet Loads & Player Roams
  7   |  *   Scenario 2: Two Players See Each Other (multiplayer presence)
  8   |  *   Scenario 3: Proximity Chat
  9   |  *   Scenario 4: Disconnection Handling
  10  |  *   Scenario 5: Single-Player Fallback
  11  |  *
  12  |  * These tests drive a real Vite dev server + WebSocket relay, simulating
  13  |  * keyboard input against the Three.js WebGL canvas and asserting on DOM
  14  |  * elements (nameplates, chat log, chat bubbles, notifications).
  15  |  */
  16  | 
  17  | const PLAY_TIMEOUT = 10000; // ms allowed for a player to move into range
  18  | const DISCONNECT_TIMEOUT = 5000; // ms allowed for an avatar to disappear
  19  | const LOAD_TIMEOUT = 30000; // ms allowed for the app to finish loading
  20  | 
  21  | // Wait for the app to finish loading (loading overlay hidden, title screen shown).
  22  | async function waitForReady(page) {
  23  |   await expect(page.locator('#loading')).toBeHidden({ timeout: LOAD_TIMEOUT });
  24  |   await expect(page.locator('#title-screen')).toBeVisible({ timeout: LOAD_TIMEOUT });
  25  | }
  26  | 
  27  | // Click BEGIN and wait for the title screen to close / intro to play / playing state.
  28  | async function startPlaying(page) {
> 29  |   await page.locator('button:has-text("BEGIN")').click();
      |                                                  ^ TimeoutError: locator.click: Timeout 10000ms exceeded.
  30  |   await expect(page.locator('#title-screen')).toBeHidden({ timeout: 10000 });
  31  |   // Intro dialogue plays automatically; advance through all lines to reach 'playing'.
  32  |   for (let i = 0; i < 6; i++) {
  33  |     const box = page.locator('#intro-box');
  34  |     if (await box.isVisible().catch(() => false)) {
  35  |       await page.keyboard.press('Enter');
  36  |       await page.waitForTimeout(250);
  37  |     }
  38  |   }
  39  |   // Give the animate loop a frame to settle.
  40  |   await page.waitForTimeout(500);
  41  | }
  42  | 
  43  | // Press a movement key, hold briefly, release — moves the avatar in-world.
  44  | async function moveKey(page, key, holdMs = 800) {
  45  |   await page.keyboard.down(key);
  46  |   await page.waitForTimeout(holdMs);
  47  |   await page.keyboard.up(key);
  48  |   await page.waitForTimeout(200);
  49  | }
  50  | 
  51  | // Open chat input, type a message, send it.
  52  | async function sendChat(page, text) {
  53  |   await page.keyboard.press('Enter');
  54  |   await page.waitForTimeout(200);
  55  |   const input = page.locator('#chat-input');
  56  |   await expect(input).toBeVisible();
  57  |   await input.fill(text);
  58  |   await page.keyboard.press('Enter');
  59  |   await page.waitForTimeout(300);
  60  | }
  61  | 
  62  | // Trigger an emote via keyboard (1=wave, 2=stretch, 3=look).
  63  | async function triggerEmote(page, key = '1') {
  64  |   await page.keyboard.press(key);
  65  |   await page.waitForTimeout(500);
  66  | }
  67  | 
  68  | test.describe('Scenario 1: Planet Loads & Player Roams (P1)', () => {
  69  |   test('page loads, title screen appears, player can roam and see NPCs', async ({ page }) => {
  70  |     await page.goto('/');
  71  |     await waitForReady(page);
  72  | 
  73  |     // Loading bar should reach 100% and disappear.
  74  |     await expect(page.locator('#loading-bar')).toBeHidden({ timeout: 15000 });
  75  | 
  76  |     // Start playing — BEGIN button visible on title screen.
  77  |     await startPlaying(page);
  78  | 
  79  |     // Nameplate for local player ("You") should exist.
  80  |     const localNameplate = page.locator('.nameplate').filter({ hasText: /You \(You\)/ });
  81  |     await expect(localNameplate).toBeVisible({ timeout: 10000 });
  82  | 
  83  |     // NPC nameplates should be present (NPCs placed along the street).
  84  |     const npcNameplates = page.locator('.nameplate').filter({ hasNotText: /You/ });
  85  |     await expect(npcNameplates.first()).toBeVisible({ timeout: 10000 });
  86  | 
  87  |     // Move the player forward with W.
  88  |     await moveKey(page, 'KeyW', 1000);
  89  | 
  90  |     // After moving, nameplates should still be present (scene still rendering).
  91  |     await expect(page.locator('.nameplate').first()).toBeVisible();
  92  |   });
  93  | 
  94  |   test('orbit camera via mouse drag on the planet (z > 160 transition)', async ({ page }) => {
  95  |     await page.goto('/');
  96  |     await waitForReady(page);
  97  |     await startPlaying(page);
  98  | 
  99  |     // Move forward far enough to cross z = 160 into the planet scene.
  100 |     // Walk forward in chunks to reach the arch at z ≈ 170.
  101 |     for (let i = 0; i < 8; i++) {
  102 |       await moveKey(page, 'KeyW', 400);
  103 |     }
  104 | 
  105 |     // Planet arch should be in the scene — orbit controls become enabled.
  106 |     // The canvas should still be rendering (no crash).
  107 |     await expect(page.locator('canvas')).toBeVisible();
  108 | 
  109 |     // Drag the canvas to orbit the camera (only works in planet mode).
  110 |     const canvas = page.locator('canvas');
  111 |     const box = await canvas.boundingBox();
  112 |     await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  113 |     await page.mouse.down();
  114 |     await page.mouse.move(box!.x + box!.width / 2 + 100, box!.y + box!.height / 2 + 50);
  115 |     await page.mouse.up();
  116 |     await page.waitForTimeout(500);
  117 |     // No error — test passes if we reach here without a crash.
  118 |   });
  119 | });
  120 | 
  121 | test.describe('Scenario 2: Two Players See Each Other (P2)', () => {
  122 |   test('two browser windows see each other within 500ms', async ({ context, browser }) => {
  123 |     // Player A opens the app.
  124 |     const pageA = await context.newPage();
  125 |     await pageA.goto('/');
  126 |     await waitForReady(pageA);
  127 |     await startPlaying(pageA);
  128 | 
  129 |     // Player B opens a second browser context (different storage = different player ID).
```