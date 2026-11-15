import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', (e) => console.log('PAGEERROR:', e.message.split('\n')[0]));
await p.goto('http://localhost:5173/planetwood/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => { const l = document.getElementById('loading'); return l && l.style.display === 'none' && !!document.getElementById('title-screen'); }, null, { timeout: 90000 });
await p.locator('button:has-text("BEGIN")').click({ timeout: 15000 });
await p.waitForTimeout(500);

// record all mutations of the CSS2D container
await p.evaluate(() => {
  window.__ev = [];
  const obs = new MutationObserver((muts) => {
    for (const m of muts) {
      for (const n of m.addedNodes) {
        if (n.nodeType === 1) window.__ev.push({ t: 'add', text: (n.textContent || '').slice(0, 24), t0: Math.round(performance.now()) });
      }
      for (const n of m.removedNodes) {
        if (n.nodeType === 1) window.__ev.push({ t: 'remove', text: (n.textContent || '').slice(0, 24), t0: Math.round(performance.now()) });
      }
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });
  window.__obs = obs;
});

for (let i = 0; i < 6; i++) {
  const vis = await p.locator('#intro-box').isVisible().catch(() => false);
  if (vis) { await p.keyboard.press('Enter'); await p.waitForTimeout(400); } else break;
}
await p.waitForTimeout(2500);

// also poll for the You plate over time
for (let i = 0; i < 12; i++) {
  const s = await p.evaluate(() => ({
    plates: document.querySelectorAll('.nameplate').length,
    you: [...document.querySelectorAll('.nameplate')].filter(e => /You/.test(e.textContent)).length,
    ev: window.__ev.length,
    last: window.__ev.slice(-2),
  }));
  console.log(i, JSON.stringify(s));
  await p.waitForTimeout(1500);
}
const all = await p.evaluate(() => window.__ev.filter(e => /You/i.test(e.text)));
console.log('events mentioning You:', JSON.stringify(all));
await b.close();
