import { chromium, devices } from '@playwright/test';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Desktop Chrome'] });
const page = await ctx.newPage();
await page.addInitScript(() => {
  window.__caps = [];
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (t, a) {
    if (t && t.startsWith('webgl')) window.__caps.push({ t, attrs: a });
    return orig.call(this, t, a);
  };
});
await page.goto('http://localhost:5173/planetwood/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#title-screen', { timeout: 60000 });
await page.waitForTimeout(1500);
const r = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  const gl = c.getContext('webgl2');
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  return {
    caps: window.__caps,
    renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'n/a',
    vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : 'n/a',
    antialias: gl.getContextAttributes().antialias,
  };
});
console.log(JSON.stringify(r, null, 1));
await browser.close();
