import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:5173/planetwood/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => { const l = document.getElementById('loading'); return l && l.style.display === 'none' && !!document.getElementById('title-screen'); }, null, { timeout: 90000 });

const r = await p.evaluate(() => new Promise((resolve) => {
  const out = { progress: [], timings: [] };
  const t0 = performance.now();
  // sample renderer.info via the fps element text every 200ms
  const fpsEl = [...document.querySelectorAll('div')].find(d => /FPS/.test(d.textContent || '') && d.style.position === 'fixed');
  const iv = setInterval(() => { if (fpsEl) out.progress.push(fpsEl.textContent); }, 200);
  // Hook console
  setTimeout(() => { clearInterval(iv); out.timings.push(['total', Math.round(performance.now() - t0)]); resolve(out); }, 6000);
}));
console.log(JSON.stringify(r, null, 1));
await b.close();
