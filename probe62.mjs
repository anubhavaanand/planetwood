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
await page.locator('button:has-text("BEGIN")').click({ timeout: 60000 });
await page.waitForTimeout(1200);

const st = () => page.evaluate(() => {
  const d = document.getElementById('dialogue-container');
  return {
    dlg: getComputedStyle(d).display,
    text: (document.getElementById('dialogue-text')?.textContent || '').slice(0, 45),
    chat: getComputedStyle(document.getElementById('chat-input-container')).display,
  };
});

for (let i = 0; i < 8; i++) {
  if (!(await page.locator('#intro-box').isVisible().catch(() => false))) break;
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);
}
await page.waitForTimeout(1500);
console.log('tutorial start:', JSON.stringify(await st()));

for (let i = 0; i < 7; i++) {
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(900);
  const s = await st();
  console.log(`KeyE ${i}:`, JSON.stringify(s));
  if (s.dlg === 'none') break;
}
await page.waitForTimeout(2000);
console.log('final:', JSON.stringify(await st()));
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
console.log('after Enter chat:', await page.evaluate(() => getComputedStyle(document.getElementById('chat-input-container')).display));
await browser.close();