import { chromium, devices } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Desktop Chrome'] });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

await page.addInitScript(() => { window.__dbg = {}; });
await page.goto('http://localhost:5173/planetwood/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => {
  const l = document.getElementById('loading');
  return l && l.style.display === 'none' && !!document.getElementById('title-screen');
}, null, { timeout: 90000 });
await page.locator('button:has-text("BEGIN")').click({ timeout: 60000 });
await page.waitForTimeout(1500);

const snap = () => page.evaluate(() => {
  const c = (id) => { const e = document.getElementById(id); if (!e) return null; const s = getComputedStyle(e); return { d: s.display, t: (e.textContent || '').replace(/\s+/g, ' ').slice(0, 60) }; };
  return {
    intro: c('intro-box'),
    dialogue: c('dialogue-container'),
    dtext: c('dialogue-text'),
    dname: c('dialogue-name'),
    chat: c('chat-input-container'),
    daily: c('daily-reward-ui'),
  };
});

// Advance intro lines with Enter, recording which advance happened
for (let i = 0; i < 10; i++) {
  const s = await snap();
  console.log(`pre-advance ${i}: intro=${s.intro ? s.intro.d : 'none'} introText="${s.intro ? s.intro.t : ''}"`);
  if (!(await page.locator('#intro-box').isVisible().catch(() => false))) break;
  await page.keyboard.press('Enter');
  await page.waitForTimeout(800);
  const s2 = await snap();
  console.log(`  post: intro=${s2.intro ? s2.intro.d : 'none'} dlg=${s2.dialogue ? s2.dialogue.d : 'none'} dlgText="${s2.dtext ? s2.dtext.t : ''}"`);
}

await page.waitForTimeout(2500);
const s3 = await snap();
console.log('FINAL', JSON.stringify(s3, null, 1));

// Try clicking the dialogue continue button if present
const cont = page.locator('#dialogue-continue');
if (await cont.isVisible().catch(() => false)) {
  console.log('continue button visible');
  for (let i = 0; i < 8; i++) {
    await cont.click({ force: true }).catch(() => {});
    await page.waitForTimeout(700);
    const s = await snap();
    console.log(`  after cont ${i}: dlg=${s.dialogue ? s.dialogue.d : 'none'} text="${s.dtext ? s.dtext.t : ''}"`);
    if (!(await cont.isVisible().catch(() => false))) break;
  }
}
await page.waitForTimeout(2500);
console.log('AFTER-CONT', JSON.stringify(await snap(), null, 1));
console.log('chat visible?', await page.locator('#chat-input').isVisible().catch(() => false));
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
console.log('chat after Enter?', await page.locator('#chat-input').isVisible().catch(() => false));
await browser.close();