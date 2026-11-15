import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

await page.goto('http://localhost:5173/planetwood/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => {
  const l = document.getElementById('loading');
  return l && l.style.display === 'none' && !!document.getElementById('title-screen');
}, null, { timeout: 90000 });
await page.locator('button:has-text("BEGIN")').click({ timeout: 60000 });
await page.waitForTimeout(1500);

// advance intro with Enter (5 lines) until intro gone
for (let i = 0; i < 8; i++) {
  if (!(await page.locator('#intro-box').isVisible().catch(() => false))) break;
  await page.keyboard.press('Enter');
  await page.waitForTimeout(700);
}
await page.waitForTimeout(2000);

const before = await page.evaluate(() => {
  const d = document.getElementById('dialogue-container');
  const c = document.getElementById('dialogue-continue');
  return {
    containerDisplay: getComputedStyle(d).display,
    continueDisplay: c ? getComputedStyle(c).display : 'MISSING',
    continueRect: c ? JSON.stringify(c.getBoundingClientRect()) : null,
    continueZ: c ? getComputedStyle(c).zIndex : null,
    containerZ: getComputedStyle(d).zIndex,
    elementAtContinue: c ? (() => {
      const r = c.getBoundingClientRect();
      const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return e ? e.tagName + '#' + e.id + '.' + e.className : null;
    })() : null,
  };
});
console.log('BEFORE', JSON.stringify(before, null, 1));

// click and immediately read text
for (let i = 0; i < 4; i++) {
  await page.locator('#dialogue-continue').click({ force: true }).catch((e) => console.log('click err', e.message.split('\n')[0]));
  await page.waitForTimeout(500);
  const t = await page.evaluate(() => ({
    text: document.getElementById('dialogue-text').textContent.slice(0, 50),
    disp: getComputedStyle(document.getElementById('dialogue-container')).display,
  }));
  console.log('click', i, JSON.stringify(t));
}
await browser.close();