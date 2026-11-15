import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:5173/planetwood/?quality=low', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => { const l = document.getElementById('loading'); return l && l.style.display === 'none' && !!document.getElementById('title-screen'); }, null, { timeout: 90000 });
await p.waitForTimeout(2500);
const fps = (ms) => p.evaluate((ms) => new Promise((res) => {
  const ts = []; const t0 = performance.now();
  const loop = (t) => { ts.push(t); if (t - t0 < ms) requestAnimationFrame(loop); else {
    const d = ts.slice(1).map((x,i)=>Math.round(x-ts[i])); const avg = d.reduce((a,b)=>a+b,0)/d.length;
    res({fps:+(1000/avg).toFixed(1), buffer: (()=>{const c=document.querySelector('canvas');return c.width+'x'+c.height})()});
  }};
  requestAnimationFrame(loop);
}), ms);
console.log('forced low', JSON.stringify(await fps(4000)));
await b.close();
