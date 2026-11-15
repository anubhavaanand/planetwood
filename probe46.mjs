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
await page.waitForTimeout(1500);
await page.screenshot({ path: '/tmp/shot-title.png' });
console.log('title shot');

await page.locator('button:has-text("BEGIN")').click({ timeout: 60000 });
await page.waitForTimeout(1500);
for (let i = 0; i < 6; i++) {
  if (await page.locator('#intro-box').isVisible().catch(() => false)) { await page.keyboard.press('Enter'); await page.waitForTimeout(300); }
}
await page.waitForTimeout(6000);
await page.screenshot({ path: '/tmp/shot-play.png' });

const info = await page.evaluate(() => {
  const fpsEl = [...document.querySelectorAll('div')].find(d => /FPS/.test(d.textContent || ''));
  const gl = document.createElement('canvas').getContext('webgl2');
  const dbg = gl && gl.getExtension('WEBGL_debug_renderer_info');
  return {
    fps: fpsEl ? fpsEl.textContent : null,
    gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : null,
    gpuVendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : null,
    nameplates: [...document.querySelectorAll('.nameplate')].map(n => n.textContent),
  };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();