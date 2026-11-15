import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:5173/planetwood/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => { const l = document.getElementById('loading'); return l && l.style.display === 'none' && !!document.getElementById('title-screen'); }, null, { timeout: 90000 });
await p.waitForTimeout(2500);
const fps = (ms) => p.evaluate((ms) => new Promise((res) => {
  const ts = []; const t0 = performance.now();
  const loop = (t) => { ts.push(t); if (t - t0 < ms) requestAnimationFrame(loop); else {
    const d = ts.slice(1).map((x,i)=>Math.round(x-ts[i])); const avg = d.reduce((a,b)=>a+b,0)/d.length;
    res(+(1000/avg).toFixed(1));
  }};
  requestAnimationFrame(loop);
}), ms);
console.log('A: composer path', await fps(3000));

// Swap composer.render for renderer.render by monkeypatching the composer's render
await p.evaluate(() => {
  const cv = document.querySelector('canvas');
  // find composer through the WebGLRenderer? Not exposed. Instead: intercept gl.drawBuffers calls
});
// Count blits (gl.blitFramebuffer) per second as proxy for postprocessing
const blits = await p.evaluate(() => new Promise((res) => {
  const cv = document.querySelector('canvas');
  const gl = cv.getContext('webgl2') || cv.getContext('webgl');
  let n = 0;
  const orig = gl.blitFramebuffer ? gl.blitFramebuffer.bind(gl) : null;
  if (orig) gl.blitFramebuffer = (...a) => { n++; return orig(...a); };
  setTimeout(() => res({ blits: n }), 3000);
}));
console.log('blit count over 3s', JSON.stringify(blits));
await b.close();
