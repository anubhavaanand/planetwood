import { chromium, devices } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Desktop Chrome'] });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

await page.goto('http://localhost:5173/planetwood/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => {
  const l = document.getElementById('loading');
  return l && l.style.display === 'none' && !!document.getElementById('title-screen');
}, null, { timeout: 90000 });

const gs = () => page.evaluate(() => {
  const fs = (q) => { const e = document.querySelector(q); if (!e) return 'MISSING'; const s = getComputedStyle(e); return `${s.display}/${s.visibility}/${s.opacity}`; };
  return {
    intro: fs('#intro-box'),
    dialogue: fs('#dialogue-container'),
    chat: fs('#chat-input'),
    chatLog: fs('#chat-log'),
    title: fs('#title-screen'),
    daily: fs('#daily-reward-ui'),
    shop: fs('#shop-ui'),
    active: document.activeElement ? document.activeElement.tagName + '#' + document.activeElement.id : null,
  };
});
console.log('0 title', JSON.stringify(await gs()));

await page.locator('button:has-text("BEGIN")').click({ timeout: 60000 });
await page.waitForTimeout(1500);
console.log('1 after begin', JSON.stringify(await gs()));

for (let i = 0; i < 8; i++) {
  const vis = await page.locator('#intro-box').isVisible().catch(() => false);
  console.log(`  loop ${i} introVisible=${vis}`, JSON.stringify(await gs()));
  if (vis) { await page.keyboard.press('Enter'); await page.waitForTimeout(600); }
  else break;
}
await page.waitForTimeout(3000);
console.log('2 after intro', JSON.stringify(await gs()));

// Try pressing Enter to open chat
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
console.log('3 after enter', JSON.stringify(await gs()));

await browser.close();