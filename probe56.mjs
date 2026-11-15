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

// Force-end the intro the same way finishIntro does, by clicking the last line fast.
for (let i = 0; i < 12; i++) {
  if (await page.locator('#intro-box').isVisible().catch(() => false)) {
    await page.keyboard.press('Enter');
  }
  await page.waitForTimeout(700);
}
await page.waitForTimeout(4000);
console.log('intro gone?', !(await page.locator('#intro-box').isVisible().catch(() => false)));

// Enter should open chat if gameState==='playing'
await page.keyboard.press('Enter');
await page.waitForTimeout(2000);
const chatVis = await page.locator('#chat-input').isVisible().catch(() => false);
console.log('chat-input visible after Enter:', chatVis);

// fallback: click input directly
const box = await page.locator('#chat-input').boundingBox();
console.log('chat-input box', JSON.stringify(box));
if (box) {
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(1500);
  console.log('after click chat-input visible:', await page.locator('#chat-input').isVisible().catch(() => false));
}
await browser.close();