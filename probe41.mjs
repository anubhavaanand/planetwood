import { chromium, devices } from '@playwright/test';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Desktop Chrome'] });
const page = await ctx.newPage();
await page.goto('http://localhost:5173/planetwood/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#title-screen', { timeout: 60000 });
await page.waitForTimeout(1500);
// measure animation frame cadence over 5s with rAF
const r = await page.evaluate(() => new Promise(res => {
  const ts = [];
  function tick(t){ ts.push(Math.round(t)); if (t - ts[0] < 5000) requestAnimationFrame(tick); else res(ts); }
  requestAnimationFrame(tick);
}));
console.log('RAF timestamps', JSON.stringify(r));
console.log('deltas', JSON.stringify(r.slice(1).map((t,i)=>t-r[i])));
await browser.close();
