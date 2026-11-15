import { chromium, devices } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Desktop Chrome'] });
const page = await ctx.newPage();

await page.goto('http://localhost:5173/planetwood/', { waitUntil: 'domcontentloaded' });

await page.evaluate(() => {
  const o = HTMLCanvasElement.prototype.getContext;
  window.__gl = new Map();
  HTMLCanvasElement.prototype.getContext = function (type, attrs) {
    if (type.startsWith('webgl')) {
      if (!window.__gl.has(this)) window.__gl.set(this, []);
      window.__gl.get(this).push({ type, attrs });
    }
    return o.call(this, type, attrs);
  };
});

// wait a bit for init
await page.waitForTimeout(9000);

const out = await page.evaluate(() => {
  const arr = [...window.__gl.entries()];
  return {
    canvasCount: arr.length,
    canvases: arr.map(([c, calls], i) => ({
      i, calls,
      cls: c.className || '(none)',
      w: c.width, h: c.height,
      cw: c.style.width, ch: c.style.height,
      connected: c.isConnected,
      parent: c.parentElement ? (c.parentElement.id || c.parentElement.className || c.parentElement.tagName) : null,
      rect: JSON.stringify(c.getBoundingClientRect()),
    })),
    rendererCanvases: document.querySelectorAll('canvas').length,
  };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();