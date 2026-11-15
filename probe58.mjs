import { chromium, devices } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Desktop Chrome'] });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

await page.goto('http://localhost:5173/planetwood/', { waitUntil: 'domcontentloaded' });

// expose module state
await page.addInitScript(() => {
  window.__probe = { gs: () => null };
});
await page.waitForFunction(() => {
  const l = document.getElementById('loading');
  return l && l.style.display === 'none' && !!document.getElementById('title-screen');
}, null, { timeout: 90000 });

// Hook keydown capture to see what the game sees
await page.evaluate(() => {
  window.__keys = [];
  window.addEventListener('keydown', (e) => window.__keys.push({ k: e.key, code: e.code, t: Math.round(performance.now()), target: e.target?.id || e.target?.tagName, defaultPrevented: e.defaultPrevented }), true);
});
await page.locator('button:has-text("BEGIN")').click({ timeout: 60000 });
await page.waitForTimeout(2000);

const info = await page.evaluate(() => {
  const d = document.getElementById('dialogue-container');
  const c = document.getElementById('chat-input-container');
  const daily = document.getElementById('daily-reward-ui');
  const cs = (e) => e ? { d: getComputedStyle(e).display, z: getComputedStyle(e).zIndex, pe: getComputedStyle(e).pointerEvents, pos: getComputedStyle(e).position, rect: JSON.stringify(e.getBoundingClientRect()) } : null;
  return {
    intro: cs(document.getElementById('intro-box')),
    dialogue: cs(d),
    chat: cs(c),
    daily: cs(daily),
    dialogueText: d ? d.textContent.replace(/\s+/g, ' ').slice(0, 90) : null,
    keys: window.__keys,
  };
});
console.log(JSON.stringify(info, null, 1));

// advance intro lines with Enter until intro-box gone
for (let i = 0; i < 10; i++) {
  if (!(await page.locator('#intro-box').isVisible().catch(() => false))) break;
  await page.keyboard.press('Enter');
  await page.waitForTimeout(900);
}
await page.waitForTimeout(3000);
const info2 = await page.evaluate(() => {
  const cs = (id) => { const e = document.getElementById(id); if (!e) return 'MISSING'; const s = getComputedStyle(e); return { d: s.display, z: s.zIndex, pe: s.pointerEvents, text: e.textContent.replace(/\s+/g, ' ').slice(0, 80) }; };
  return {
    keys: window.__keys.slice(-10),
    dialogue: cs('dialogue-container'),
    chat: cs('chat-input-container'),
    daily: cs('daily-reward-ui'),
    title: cs('title-screen'),
    intro: cs('intro-box'),
  };
});
console.log(JSON.stringify(info2, null, 1));

// press Enter for chat
await page.keyboard.press('Enter');
await page.waitForTimeout(2000);
const info3 = await page.evaluate(() => {
  const e = document.getElementById('chat-input-container');
  const s = getComputedStyle(e);
  return { chat: { d: s.display, rect: JSON.stringify(e.getBoundingClientRect()) }, inputVisible: !!document.getElementById('chat-input').offsetParent, keys: window.__keys.slice(-6) };
});
console.log(JSON.stringify(info3, null, 1));
await browser.close();