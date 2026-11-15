import { chromium } from 'playwright';

const mode = process.argv[2] || 'main';
const browser = await chromium.launch({ args: mode === 'main' ? [] : ['--disable-frame-rate-limit', '--disable-gpu-vsync'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

await page.goto('http://localhost:5173/planetwood/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => {
  const l = document.getElementById('loading');
  return l && l.style.display === 'none' && !!document.getElementById('title-screen');
}, null, { timeout: 90000 });

// measure rAF cadence over 10s, split into chunks, plus longtasks
const res = await page.evaluate(() => new Promise((resolve) => {
  const ts = [];
  const lts = [];
  const po = new PerformanceObserver((l) => { for (const e of l.getEntries()) lts.push({ d: Math.round(e.duration), s: Math.round(e.startTime) }); });
  try { po.observe({ type: 'longtask' }); } catch {}
  const t0 = performance.now();
  const loop = (t) => {
    ts.push(Math.round(t));
    if (t - t0 < 10000) requestAnimationFrame(loop);
    else { po.disconnect(); resolve({ ts, lts, span: Math.round(t - t0) }); }
  };
  requestAnimationFrame(loop);
}));
const d = res.ts.slice(1).map((t, i) => t - res.ts[i]);
const avg = d.reduce((a, b) => a + b, 0) / d.length;
const sorted = [...d].sort((a, b) => a - b);
console.log(JSON.stringify({
  mode,
  frames: d.length,
  span: res.span,
  avgMs: Math.round(avg),
  fps: +(1000 / avg).toFixed(1),
  p50: sorted[Math.floor(sorted.length * 0.5)],
  p90: sorted[Math.floor(sorted.length * 0.9)],
  max: sorted[sorted.length - 1],
  longTasks: res.lts.length,
  longTaskTotalMs: res.lts.reduce((a, b) => a + b.d, 0),
}, null, 1));
await browser.close();