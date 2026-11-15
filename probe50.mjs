import { chromium, devices } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Desktop Chrome'] });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

const t0 = Date.now();
const el = (l) => console.log(`[${String(Date.now()-t0).padStart(6)}ms]`, l);

await page.goto('http://localhost:5173/planetwood/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => {
  const l = document.getElementById('loading');
  return l && l.style.display === 'none' && !!document.getElementById('title-screen');
}, null, { timeout: 90000 });
el('title ready');

const check = async (label) => {
  const s = await page.evaluate(() => {
    const sel = ['#title-screen', '#intro-box', '#loading', '#loading-bar', '#chat-input', '#chat-log', 'canvas',
      '#daily-reward-panel', '#shop-panel', '#dialogue-box', '#quest-panel'];
    const st = {};
    for (const q of sel) {
      const e = document.querySelector(q);
      st[q] = e ? { vis: getComputedStyle(e).display !== 'none' && e.offsetParent !== null, disp: getComputedStyle(e).display } : 'MISSING';
    }
    const fps = [...document.querySelectorAll('div')].find(d => /FPS/.test(d.textContent || ''));
    return {
      st, fps: fps ? fps.textContent : null,
      nameplates: [...document.querySelectorAll('.nameplate')].map(n => n.textContent),
      bodyChildren: [...document.body.children].map(c => (c.id || c.className || c.tagName).toString().slice(0, 40)),
      loadingStyle: (() => { const l = document.getElementById('loading'); return l ? l.outerHTML.slice(0, 300) : null; })(),
    };
  });
  el(label + ' ' + JSON.stringify(s));
};

await check('after-title');
el('clicking BEGIN');
await page.locator('button:has-text("BEGIN")').click({ timeout: 60000 });
el('clicked');
await check('after-click');

for (let i = 0; i < 6; i++) {
  const vis = await page.locator('#intro-box').isVisible().catch(() => false);
  if (vis) { await page.keyboard.press('Enter'); el('enter ' + i); }
  await page.waitForTimeout(400);
}
await page.waitForTimeout(2000);
await check('after-intro');
await page.waitForTimeout(6000);
await check('settled');

// Try the test's assertions
try {
  await page.locator('.nameplate').filter({ hasText: /You \(You\)/ }).first().waitFor({ state: 'visible', timeout: 10000 });
  el('You nameplate VISIBLE');
} catch (e) { el('You nameplate FAIL ' + String(e).split('\n')[0]); }

await browser.close();