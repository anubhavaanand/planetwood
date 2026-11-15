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

// What does the game's own detector see?
console.log('detector inputs:', JSON.stringify(await p.evaluate(() => {
  const c = document.createElement('canvas');
  const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
  return { RENDERER: gl.getParameter(gl.RENDERER), VENDOR: gl.getParameter(gl.VENDOR), mem: navigator.deviceMemory || null };
})));

console.log('baseline     ', JSON.stringify(await measure()));

// Hide canvas -> upper bound of non-render work
await p.evaluate(() => document.querySelector('canvas').style.display = 'none');
console.log('no canvas    ', JSON.stringify(await measure()));
await p.evaluate(() => document.querySelector('canvas').style.display = 'block');

// Kill bloom + shadows via renderer: reach through __THREE__? try sceneSys global
console.log('globals:', JSON.stringify(await p.evaluate(() => Object.keys(window).filter(k => /scene|sys|game|three/i.test(k)).slice(0, 20))));
await b.close();
