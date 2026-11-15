import { chromium, devices } from 'playwright';

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Desktop Chrome'] });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

await page.addInitScript(() => {
  const oLoad = HTMLImageElement.prototype.setAttribute;
  // instrument fetch/TextureLoader timing via PerformanceObserver for resources
  window.__res = [];
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) {
      if (e.initiatorType === 'img' || e.initiatorType === 'fetch' || e.initiatorType === 'xmlhttprequest') {
        window.__res.push({ n: e.name.split('/').slice(-2).join('/'), dur: Math.round(e.duration), size: e.transferSize });
      }
    }
  }).observe({ entryTypes: ['resource'] });
  // count texture allocations by wrapping WebGL2 texImage2D
  const orig = WebGL2RenderingContext.prototype.texImage2D;
  window.__tex = [];
  WebGL2RenderingContext.prototype.texImage2D = function (...a) {
    try { const s = a[3]; if (s && s.width) window.__tex.push({ w: s.width, h: s.height, t: Math.round(performance.now()) }); } catch {}
    return orig.apply(this, a);
  };
  const origTexStore = WebGL2RenderingContext.prototype.texStorage2D;
  window.__texStore = 0;
  WebGL2RenderingContext.prototype.texStorage2D = function (...a) { window.__texStore++; return origTexStore.apply(this, a); };
  // count draw calls
  const od = WebGL2RenderingContext.prototype.drawElements;
  window.__draws = 0;
  WebGL2RenderingContext.prototype.drawElements = function (...a) { window.__draws++; return od.apply(this, a); };
});

await page.goto('http://localhost:5173/planetwood/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => {
  const l = document.getElementById('loading');
  return l && l.style.display === 'none' && !!document.getElementById('title-screen');
}, null, { timeout: 90000 });

const out = await page.evaluate(() => {
  const tex = window.__tex || [];
  const bySize = {};
  for (const t of tex) { const k = `${t.w}x${t.h}`; bySize[k] = (bySize[k] || 0) + 1; }
  const res = window.__res || [];
  const big = res.filter(r => r.dur > 100 || r.size > 500000);
  return {
    texCount: tex.length,
    texStore: window.__texStore,
    draws: window.__draws,
    texSizes: bySize,
    bigResources: big.slice(0, 40),
  };
});
console.log(JSON.stringify(out, null, 1));

// FPS after settling
await page.waitForTimeout(4000);
const fps = await page.evaluate(() => {
  const el = [...document.querySelectorAll('div')].find(d => /FPS/.test(d.textContent || ''));
  return el ? el.textContent : null;
});
console.log('FPS:', fps);
await browser.close();