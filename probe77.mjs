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

console.log('baseline', await fps(3000));

// Find the scene: three stores it on renderer? use __THREE__? Try devtools hook: scene via composer passes.
// Workaround: patch WebGLRenderingContext.prototype.uniform1f to count; instead just count ANGLE calls.
const info = await p.evaluate(() => {
  const cv = document.querySelector('canvas');
  const gl = cv.getContext('webgl2') || cv.getContext('webgl');
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  return {
    unmaskedRenderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'n/a',
    unmaskedVendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : 'n/a',
    drawingBuffer: gl.drawingBufferWidth + 'x' + gl.drawingBufferHeight,
  };
});
console.log(JSON.stringify(info));
await b.close();
