import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', (e) => console.log('PAGEERROR:', e.message.split('\n')[0]));
await p.goto('http://localhost:5173/planetwood/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => { const l = document.getElementById('loading'); return l && l.style.display === 'none' && !!document.getElementById('title-screen'); }, null, { timeout: 90000 });
await p.locator('button:has-text("BEGIN")').click({ timeout: 20000 });
await p.waitForTimeout(400);

// Poll aggressively with a fast loop inside the page (not round-tripping)
const r = await p.evaluate(() => new Promise((res) => {
  const t0 = performance.now();
  const samples = [];
  const tick = () => {
    const plates = document.querySelectorAll('.nameplate').length;
    const you = [...document.querySelectorAll('.nameplate')].filter(e => /You/.test(e.textContent)).length;
    samples.push({ t: Math.round(performance.now() - t0), plates, you });
    if (performance.now() - t0 < 20000) setTimeout(tick, 400);
    else res(samples.filter((s, i) => i % 3 === 0 || s.you !== (samples[i-1]?.you ?? -1)));
  };
  tick();
}));
console.log(JSON.stringify(r.map(s => `${s.t}ms plates=${s.plates} you=${s.you}`), null, 0).replace(/","/g, '\n'));
await b.close();
