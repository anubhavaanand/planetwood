import { chromium, devices } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Desktop Chrome'] });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
page.on('console', (m) => { if (/TUTORIAL|Error/i.test(m.text())) console.log('CONSOLE:', m.text()); });

await page.goto('http://localhost:5173/planetwood/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => {
  const l = document.getElementById('loading');
  return l && l.style.display === 'none' && !!document.getElementById('title-screen');
}, null, { timeout: 90000 });
await page.locator('button:has-text("BEGIN")').click({ timeout: 60000 });

const TUT = ['Welcome to Planetwood! I\'m your first stop on the street.', 'Your job is simple: deliver messages between everyone on this street.', 'Walk up to a glowing NPC and press E to read their request.', 'Come back here when you\'re done — I\'ll point you at the next one.', 'You can press 1, 2, or 3 to wave, stretch, or look around.', 'That\'s everything. Happy delivering!'];

for (let i = 0; i < TUT.length; i++) {
  const vis = await page.locator('#dialogue-container').isVisible().catch(() => false);
  const txt = await page.locator('#dialogue-container').textContent().catch(() => '');
  console.log(`step ${i} visible=${vis} text="${(txt || '').replace(/\s+/g, ' ').slice(0, 70)}"`);
  // press E (game handles tutorial dialogue advance with KeyE)
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(1200);
}

await page.waitForTimeout(3000);
const st = await page.evaluate(() => {
  const d = document.getElementById('dialogue-container');
  const c = document.getElementById('chat-input');
  const dr = document.getElementById('daily-reward-ui');
  return {
    dialogue: d ? getComputedStyle(d).display : 'MISSING',
    chatInputDisplay: getComputedStyle(document.getElementById('chat-input-container')).display,
    dailyReward: dr ? getComputedStyle(dr).display : 'MISSING',
    dailyRewardText: (dr ? dr.textContent : '').replace(/\s+/g, ' ').slice(0, 120),
  };
});
console.log('STATE', JSON.stringify(st, null, 1));

// Now press Enter and see if chat opens
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
console.log('chat visible after Enter:', await page.locator('#chat-input').isVisible().catch(() => false));
await browser.close();