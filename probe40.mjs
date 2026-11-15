import { chromium, devices } from '@playwright/test';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Desktop Chrome'] });
const page = await ctx.newPage();
const t0 = Date.now();
await page.goto('http://localhost:5173/planetwood/', { waitUntil: 'domcontentloaded' });
console.log('goto', Date.now()-t0);
await page.locator('#title-screen').waitFor({ state: 'visible', timeout: 60000 });
console.log('title visible', Date.now()-t0);
// replicate waitForReady: expect #loading hidden, #title-screen visible
await page.locator('#loading').waitFor({ state: 'hidden', timeout: 30000 });
console.log('loading hidden', Date.now()-t0);
await page.locator('#loading-bar').waitFor({ state: 'hidden', timeout: 15000 });
console.log('loading-bar hidden', Date.now()-t0);
const ct = Date.now();
try { await page.locator('button:has-text("BEGIN")').click({ timeout: 15000 }); console.log('click', Date.now()-ct); }
catch(e){ console.log('click fail after', Date.now()-ct); console.log(e.message.split('\n').slice(0,15).join('\n')); }
await browser.close();
