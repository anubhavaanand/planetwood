import { defineConfig, devices } from '@playwright/test';

/**
 * Cross-browser Playwright configuration for Planetwood E2E tests.
 * Tests the app against Chrome, Firefox, and Edge.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? 'html' : 'list',

  // Each test file gets its own browser context and storage state.
  use: {
    baseURL: 'http://localhost:5173/planetwood/',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  // Projects for cross-browser testing.
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
  ],

  // Start the Vite dev server before running tests and stop it after.
  // The WebSocket relay server (server/index.js) must be started separately
  // in a terminal before running tests (it is a WebSocket-only server with no
  // HTTP health endpoint for Playwright to poll).
  // Note: we run `vite --host` directly, not `npm run dev`, because `npm run dev`
  // uses `concurrently` to also start the relay server which is already running.
  webServer: {
    command: 'npx vite --host',
    url: 'http://localhost:5173/planetwood/',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },

  // Maximum time for the whole test run.
  maxTimeout: process.env.CI ? 30 * 60 * 1000 : 0,
  globalTimeout: process.env.CI ? 40 * 60 * 1000 : 0,
});
