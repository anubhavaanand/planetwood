import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:5173/planetwood/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => { const l = document.getElementById('loading'); return l && l.style.display === 'none' && !!document.getElementById('title-screen'); }, null, { timeout: 90000 });

const probe = () => p.evaluate(() => {
  // locate the scene through a nameplate's CSS2DObject parent chain? Instead find via renderer canvas: use __THREE__ not available.
  // Traverse from a nameplate div: CSS2DObject stores element; we can't reach object.
  // Instead: monkeypatch WebGLRenderingContext.drawElements to count calls per rAF tick.
  const gl = document.querySelector('canvas').getContext('webgl2') || document.querySelector('canvas').getContext('webgl');
  if (!gl.__patched) {
    window.__dc = 0;
    const de = gl.drawElements.bind(gl), da = gl.drawArrays.bind(gl);
    gl.drawElements = (...a) => { window.__dc++; return de(...a); };
    gl.drawArrays = (...a) => { window.__dc++; return da(...a); };
    gl.__patched = true;
  }
  return { dc: window.__dc };
});

const sample = async (label) => {
  await p.evaluate(() => { window.__dc = 0; });
  const t0 = Date.now();
  await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const dt = Date.now() - t0;
  const dc = await p.evaluate(() => window.__dc);
  console.log(label, 'drawCalls(2 frames)=', dc, 'msFor2Frames=', dt);
};

await sample('title  ');
// advance to playing
await p.locator('button:has-text("BEGIN")').click({ timeout: 30000 });
for (let i = 0; i < 8; i++) { if (!(await p.locator('#intro-box').isVisible().catch(()=>false))) break; await p.keyboard.press('Enter'); await p.waitForTimeout(400); }
for (let i = 0; i < 7; i++) { if (await p.evaluate(() => getComputedStyle(document.getElementById('dialogue-container')).display) === 'none') break; await p.keyboard.press('KeyE'); await p.waitForTimeout(400); }
await p.waitForTimeout(1500);
await sample('playing');
console.log('nameplates', await p.evaluate(() => document.querySelectorAll('.nameplate').length));
console.log('chat visible', await p.evaluate(() => getComputedStyle(document.getElementById('chat-input-container')).display));
await b.close();
