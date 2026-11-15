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

// hide 3D meshes: walk scene via renderer? use a hook: find canvas parent's canvas
// Instead: try disabling composer by hiding bloom - we can access via window? no.
// Try setting canvas buffer smaller
await p.evaluate(() => { const c = document.querySelector('canvas'); c.width = 640; c.height = 360; c.style.width='1280px'; c.style.height='720px'; });
console.log('buffer 640x360 (css upscaled)', JSON.stringify(await measure()));

await p.evaluate(() => { const c = document.querySelector('canvas'); c.width = 320; c.height = 180; });
console.log('buffer 320x180', JSON.stringify(await measure()));

await p.evaluate(() => { const c = document.querySelector('canvas'); c.width = 160; c.height = 90; });
console.log('buffer 160x90', JSON.stringify(await measure()));

// hide canvas -> upper bound
await p.evaluate(() => { document.querySelector('canvas').style.display = 'none'; });
console.log('canvas hidden (no GL)', JSON.stringify(await measure()));
await b.close();
