import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

const t0 = Date.now();
await page.goto('http://localhost:5173/planetwood/', { waitUntil: 'domcontentloaded' });

// Time the raw parse of decoded_animations.json in-page
const parseMs = await page.evaluate(async () => {
  const t = performance.now();
  const r = await fetch('./decoded_animations.json');
  const text = await r.text();
  const t2 = performance.now();
  const obj = JSON.parse(text);
  const t3 = performance.now();
  return { fetchMs: Math.round(t2 - t), parseMs: Math.round(t3 - t2), bytes: text.length, keys: Object.keys(obj).length };
});
console.log('anim json:', JSON.stringify(parseMs), 'at', Date.now() - t0, 'ms');

// Instrument gltf loader timing by patching fetch
const gltfMs = await page.evaluate(async () => {
  const t = performance.now();
  const r = await fetch('./scene.gltf');
  const txt = await r.text();
  const t2 = performance.now();
  const b = await (await fetch('./scene.bin')).arrayBuffer();
  const t3 = performance.now();
  return { gltfFetchMs: Math.round(t2 - t), gltfKB: txt.length, binFetchMs: Math.round(t3 - t2), binMB: +(b.byteLength / 1048576).toFixed(1) };
});
console.log('scene files:', JSON.stringify(gltfMs), 'at', Date.now() - t0, 'ms');

await browser.close();