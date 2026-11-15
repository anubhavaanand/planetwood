import { chromium, devices } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Desktop Chrome'] });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

await page.goto('http://localhost:5173/planetwood/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => {
  const l = document.getElementById('loading');
  return l && l.style.display === 'none' && !!document.getElementById('title-screen');
}, null, { timeout: 90000 });
await page.locator('button:has-text("BEGIN")').click({ timeout: 60000 });
for (let i = 0; i < 6; i++) {
  if (await page.locator('#intro-box').isVisible().catch(() => false)) { await page.keyboard.press('Enter'); await page.waitForTimeout(300); }
}
await page.waitForTimeout(8000);

const t0 = Date.now();
const read = () => page.evaluate(() => {
  const p = (document.querySelector('.nameplate')?.textContent || '');
  const fps = [...document.querySelectorAll('div')].find(d => /FPS/.test(d.textContent || ''));
  return { n: document.querySelectorAll('.nameplate').length, first: p, fps: fps ? fps.textContent : null };
});
console.log('baseline', JSON.stringify(await read()));

// hold W for 3s then sample repeatedly (movement happens in rAF gated by canMove)
await page.keyboard.down('KeyW');
for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(1500);
  console.log('hold ' + i, JSON.stringify(await read()), 't=' + (Date.now() - t0));
}
await page.keyboard.up('KeyW');
await browser.close();