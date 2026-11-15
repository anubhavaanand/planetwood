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

console.log('detector says:', JSON.stringify(await p.evaluate(() => {
  const c = document.createElement('canvas');
  const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
  return { RENDERER: gl.getParameter(gl.RENDERER), VENDOR: gl.getParameter(gl.VENDOR), mem: navigator.deviceMemory || null };
})));
console.log('baseline', JSON.stringify(await measure()));
await p.evaluate(() => { document.querySelector('canvas').style.display = 'none'; });
console.log('canvas hidden', JSON.stringify(await measure()));
await p.evaluate(() => { document.querySelector('canvas').style.display = 'block'; });
// Force canvas to 1x1 CSS but keep buffer
await p.evaluate(() => { const c = document.querySelector('canvas'); c.style.width = '1px'; c.style.height = '1px'; });
console.log('canvas 1px css', JSON.stringify(await measure()));
await b.close();
