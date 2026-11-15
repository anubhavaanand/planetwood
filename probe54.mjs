import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

await page.goto('http://localhost:5173/planetwood/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => {
  const l = document.getElementById('loading');
  return l && l.style.display === 'none' && !!document.getElementById('title-screen');
}, null, { timeout: 90000 });
await page.waitForTimeout(3000);

const measure = () => page.evaluate(() => new Promise((res) => {
  const ts = [];
  const t0 = performance.now();
  const loop = (t) => { ts.push(t); if (t - t0 < 4000) requestAnimationFrame(loop); else {
    const d = ts.slice(1).map((x, i) => Math.round(x - ts[i]));
    res({ frames: d.length, avg: Math.round(d.reduce((a, b) => a + b, 0) / d.length), ms: d });
  } };
  requestAnimationFrame(loop);
}));

console.log('BEFORE:', JSON.stringify(await measure()));

// Now hide the entire canvas and every CSS2D label to see if rAF speeds up
await page.evaluate(() => {
  document.querySelectorAll('canvas').forEach(c => c.style.display = 'none');
});
console.log('NO CANVAS:', JSON.stringify(await measure()));

await page.evaluate(() => {
  document.querySelectorAll('canvas').forEach(c => c.style.display = 'block');
  document.querySelectorAll('.nameplate,.interact-prompt').forEach(e => e.style.display = 'none');
});
console.log('NO LABELS:', JSON.stringify(await measure()));

await browser.close();