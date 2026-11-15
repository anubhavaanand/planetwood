import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:5173/planetwood/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => { const l = document.getElementById('loading'); return l && l.style.display === 'none' && !!document.getElementById('title-screen'); }, null, { timeout: 90000 });

const measure = () => p.evaluate(() => new Promise((res) => {
  const ts = []; const t0 = performance.now();
  const loop = (t) => { ts.push(t); if (t - t0 < 3000) requestAnimationFrame(loop); else {
    const d = ts.slice(1).map((x,i)=>Math.round(x-ts[i])); const avg = d.reduce((a,b)=>a+b,0)/d.length;
    res({ frames: d.length, avg: Math.round(avg), fps: +(1000/avg).toFixed(1) });
  }};
  requestAnimationFrame(loop);
}));
console.log('as-is', JSON.stringify(await measure()));

// Hide every mesh by setting scene override through renderer info isn't exposed.
// Instead: remove canvas from DOM but keep loop -> tests pure JS/CPU cost
await p.evaluate(() => { const c = document.querySelector('canvas'); c.parentNode.removeChild(c); });
console.log('canvas removed', JSON.stringify(await measure()));
await b.close();
