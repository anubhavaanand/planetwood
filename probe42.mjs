import { chromium, devices } from '@playwright/test';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Desktop Chrome'] });
const page = await ctx.newPage();
await page.goto('http://localhost:5173/planetwood/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#title-screen', { timeout: 60000 });
await page.waitForTimeout(1500);
await page.evaluate(() => {
  window.__long = [];
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push({ d: Math.round(e.duration), n: e.name, start: Math.round(e.startTime) }); }).observe({ entryTypes: ['longtask'] });
});
// time the click's internal steps manually
const t = Date.now();
const box = await page.locator('button:has-text("BEGIN")').boundingBox();
console.log('bbox', JSON.stringify(box), Date.now()-t);
await page.mouse.move(box.x + box.width/2, box.y + box.height/2);
console.log('moved', Date.now()-t);
await page.waitForTimeout(100);
await page.mouse.down();
console.log('down', Date.now()-t);
await page.mouse.up();
console.log('up', Date.now()-t);
await page.waitForTimeout(1000);
const st = await page.evaluate(() => ({ title: !!document.getElementById('title-screen'), intro: !!document.getElementById('intro-box'), long: window.__long }));
console.log('STATE', JSON.stringify(st));
await browser.close();
