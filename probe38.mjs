import { chromium, devices } from '@playwright/test';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Desktop Chrome'] });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto('http://localhost:5173/planetwood/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#title-screen', { timeout: 60000 });
await page.waitForTimeout(2000);
const box = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(x => x.textContent === 'BEGIN');
  const r = b.getBoundingClientRect();
  const cs = getComputedStyle(b);
  const topEl = document.elementFromPoint(r.x + r.width/2, r.y + r.height/2);
  return { rect: {x:r.x,y:r.y,w:r.width,h:r.height}, display: cs.display, vis: cs.visibility, opacity: cs.opacity, topEl: topEl ? topEl.tagName + '.' + topEl.className + '#' + topEl.id + ' text=' + topEl.textContent.slice(0,20) : null };
});
console.log('BEGINBOX', JSON.stringify(box, null, 1));
console.log('ERRORS', JSON.stringify(errs));
await browser.close();
