import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:5173/planetwood/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => { const l = document.getElementById('loading'); return l && l.style.display === 'none' && !!document.getElementById('title-screen'); }, null, { timeout: 90000 });
const measure = () => p.evaluate(() => new Promise((res) => {
  const ts = []; const t0 = performance.now();
  const loop = (t) => { ts.push(t); if (t - t0 < 2500) requestAnimationFrame(loop); else {
    const d = ts.slice(1).map((x,i)=>Math.round(x-ts[i])); const avg = d.reduce((a,b)=>a+b,0)/d.length;
    res({ fps: +(1000/avg).toFixed(1) });
  }};
  requestAnimationFrame(loop);
}));
console.log('baseline', JSON.stringify(await measure()));
// look for rAF loop that can be stopped: expose via a global hook. Try to find three renderer on window
const globals = await p.evaluate(() => Object.keys(window).filter(k => /scene|render|planet|three|__|game|app/i.test(k)).slice(0, 40));
console.log('globals', JSON.stringify(globals));
await b.close();
