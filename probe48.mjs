import { chromium, devices } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Desktop Chrome'] });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

await page.goto('http://localhost:5173/planetwood/', { waitUntil: 'domcontentloaded' });

// Hook console + WebGL stats from the very start
await page.evaluate(() => {
  window.__logs = [];
  const oc = console.log.bind(console);
  const oe = console.error.bind(console);
  const ow = console.warn.bind(console);
  console.log = (...a) => { window.__logs.push(['log', a.map(String).join(' ')]); oc(...a); };
  console.error = (...a) => { window.__logs.push(['err', a.map(String).join(' ')]); oe(...a); };
  console.warn = (...a) => { window.__logs.push(['warn', a.map(String).join(' ')]); ow(...a); };

  // count three.js render calls
  const r = WebGL2RenderingContext.prototype;
  const od = r.drawElements, oda = r.drawArrays;
  window.__dc = 0;
  r.drawElements = function (...a) { window.__dc++; return od.apply(this, a); };
  r.drawArrays = function (...a) { window.__dc++; return oda.apply(this, a); };
  const oc2 = r.clear;
  window.__clears = 0;
  r.clear = function (...a) { window.__clears++; return oc2.apply(this, a); };
});

// let init run
await page.waitForTimeout(12000);

const out = await page.evaluate(() => ({
  logs: window.__logs.slice(0, 60),
  drawsTotal: window.__dc,
  clears: window.__clears,
  fps: (() => { const el = [...document.querySelectorAll('div')].find(d => /FPS/.test(d.textContent || '')); return el ? el.textContent : null; })(),
  fpsNow: (() => { const el = [...document.querySelectorAll('div')].find(d => /FPS/.test(d.textContent || '')); return el ? el.style.display : null; })(),
  canvases: [...document.querySelectorAll('canvas')].map(c => ({ w: c.width, h: c.height, css: c.style.cssText.slice(0, 120), parent: c.parentElement?.tagName })),
}));
console.log(JSON.stringify(out, null, 1));

// now sample rAF deltas over 8s to see steady-state frame rate
const deltas = await page.evaluate(() => new Promise((res) => {
  const ts = [];
  const loop = (t) => { ts.push(Math.round(t)); if (ts.length < 30) requestAnimationFrame(loop); else res(ts); };
  requestAnimationFrame(loop);
}));
const dd = deltas.slice(1).map((t, i) => t - deltas[i]);
console.log('rAF deltas:', JSON.stringify(dd));
await browser.close();