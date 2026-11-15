import { chromium, devices } from '@playwright/test';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Desktop Chrome'] });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR', e.message));
await page.goto('http://localhost:5173/planetwood/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#title-screen', { timeout: 60000 });
await page.waitForTimeout(2000);
const t = Date.now();
try {
  await page.locator('button:has-text("BEGIN")').click({ timeout: 15000 });
  console.log('CLICK OK', Date.now() - t, 'ms');
} catch (e) {
  console.log('CLICK FAIL', Date.now() - t, 'ms');
  console.log(e.message.split('\n').slice(0, 20).join('\n'));
}
await browser.close();
