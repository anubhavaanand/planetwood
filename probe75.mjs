import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:5173/planetwood/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => { const l = document.getElementById('loading'); return l && l.style.display === 'none' && !!document.getElementById('title-screen'); }, null, { timeout: 90000 });
await p.waitForTimeout(3000);

const countProj = () => p.evaluate(() => {
  const v = new (window.__THREE__?.Vector3 || Object)();
  let total = 0, inFront = 0;
  // access scene via the renderer's info? use canvas's parent children
  return null;
});
const c0 = await p.evaluate(() => document.querySelector('canvas').width);
console.log('canvas w', c0);

// patch: read renderer info via WebGL? Simpler: use __THREE__ to construct a raycaster? 
// Use scene graph traversal through labelRenderer? Labels are CSS2DObjects parented to scene.
// We can find scene via a nameplate object: document.querySelector('.nameplate') -> its CSS2DObject is stored? no.
// Try: WebGL context count of drawElements per frame
const r = await p.evaluate(() => new Promise((res) => {
  const cv = document.querySelector('canvas');
  const gl = cv.getContext('webgl2');
  let de = 0;
  const orig = gl.drawElements.bind(gl);
  gl.drawElements = (...a) => { de++; return orig(...a); };
  requestAnimationFrame(() => requestAnimationFrame(() => { res({ drawsPer2Frames: de }); }));
}));
console.log('draws', JSON.stringify(r));
await b.close();
