import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:5173/planetwood/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => { const l = document.getElementById('loading'); return l && l.style.display === 'none' && !!document.getElementById('title-screen'); }, null, { timeout: 90000 });

// time the BEGIN click exactly like the spec does
const t0 = Date.now();
await p.locator('button:has-text("BEGIN")').click({ timeout: 15000 });
console.log('BEGIN click took', Date.now() - t0, 'ms');
await p.waitForTimeout(500);
console.log('title hidden:', await p.locator('#title-screen').isHidden().catch(() => 'err'));

// time the nameplate visibility check exactly like the spec
const t1 = Date.now();
try {
  await p.locator('.nameplate').filter({ hasText: /You \(You\)/ }).first().waitFor({ state: 'visible', timeout: 15000 });
  console.log('You nameplate appeared in', Date.now() - t1, 'ms');
} catch (e) { console.log('You nameplate FAIL after', Date.now() - t1, 'ms'); }

const t2 = Date.now();
try {
  await p.locator('.nameplate').filter({ hasNotText: /You/ }).first().waitFor({ state: 'visible', timeout: 15000 });
  console.log('NPC nameplate appeared in', Date.now() - t2, 'ms');
} catch (e) { console.log('NPC nameplate FAIL after', Date.now() - t2, 'ms'); }

console.log('counts:', await p.evaluate(() => ({
  plates: document.querySelectorAll('.nameplate').length,
  you: [...document.querySelectorAll('.nameplate')].filter(e => /You \(You\)/.test(e.textContent)).length,
})));
await b.close();
