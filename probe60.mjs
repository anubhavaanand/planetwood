import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

await page.goto('http://localhost:5173/planetwood/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => {
  const l = document.getElementById('loading');
  return l && l.style.display === 'none' && !!document.getElementById('title-screen');
}, null, { timeout: 90000 });
await page.waitForTimeout(2500);

const info = await page.evaluate(() => {
  const cv = document.querySelector('canvas');
  const gl = cv.getContext('webgl2') || cv.getContext('webgl');
  // Count draw calls per frame by wrapping
  const counts = {};
  const origDrawElements = gl.drawElements;
  const origDrawArrays = gl.drawArrays;
  gl.drawElements = function (...a) { counts.drawElements = (counts.drawElements || 0) + 1; return origDrawElements.apply(this, a); };
  gl.drawArrays = function (...a) { counts.drawArrays = (counts.drawArrays || 0) + 1; return origDrawArrays.apply(this, a); };
  window.__counts = counts;

  let meshes = 0, instanced = 0, tris = 0, geoms = 0, tex = 0, lights = 0, visibleMeshes = 0;
  // find the scene via the canvas' parent's sibling? use the FPS renderer info via WebGL only.
  return {
    canvas: { w: cv.width, h: cv.height, cssW: cv.clientWidth, cssH: cv.clientHeight },
    dpr: window.devicePixelRatio,
    drawingBuffer: gl.drawingBufferWidth + 'x' + gl.drawingBufferHeight,
    maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    renderer: gl.getParameter(gl.RENDERER),
  };
});
console.log('GL', JSON.stringify(info, null, 1));

// Wait one second and read draw counts
await page.waitForTimeout(1000);
console.log('draw counts over ~1s:', JSON.stringify(await page.evaluate(() => window.__counts)));
await browser.close();