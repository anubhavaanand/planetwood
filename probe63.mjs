import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:5173/planetwood/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => { const l = document.getElementById('loading'); return l && l.style.display === 'none' && !!document.getElementById('title-screen'); }, null, { timeout: 90000 });
const measure = () => p.evaluate(() => new Promise((res) => {
  const ts = []; const t0 = performance.now();
  const loop = (t) => { ts.push(t); if (t - t0 < 4000) requestAnimationFrame(loop); else {
    const d = ts.slice(1).map((x,i)=>Math.round(x-ts[i]));
    const avg = d.reduce((a,b)=>a+b,0)/d.length;
    res({ frames: d.length, avg: Math.round(avg), fps: +(1000/avg).toFixed(1) });
  }};
  requestAnimationFrame(loop);
}));
console.log('baseline', JSON.stringify(await measure()));
console.log('canvas', JSON.stringify(await p.evaluate(() => ({ n: document.querySelectorAll('canvas').length, w: document.querySelector('canvas').width, h: document.querySelector('canvas').height }))));
await b.close();
