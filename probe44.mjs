import { chromium, devices } from 'playwright';
const t0 = Date.now();
const log = (m, ...a) => console.log(`[${String(Date.now() - t0).padStart(6)}ms]`, m, ...a);

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Desktop Chrome'] });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

const marks = [];
await page.addInitScript(() => {
  window.__marks = [];
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => {
    window.__rafCount = (window.__rafCount || 0) + 1;
    return raf((ts) => { (window.__rafTs ||= []).push(Math.round(ts)); cb(ts); });
  };
  try {
    new PerformanceObserver((l) => { (window.__lt ||= []).push(l.getEntries().map(e => ({ d: Math.round(e.duration), s: Math.round(e.startTime) }))); }).observe({ type: 'longtask', buffered: true });
  } catch {}
  new MutationObserver((ms) => {
    for (const m of ms) {
      const t = m.target;
      const id = t.id ? '#' + t.id : t.className && typeof t.className === 'string' ? '.' + t.className.split(' ')[0] : t.nodeName;
      window.__marks.push({ at: Math.round(performance.now()), kind: m.type, target: id, added: [...m.addedNodes].map(n => n.id ? '#' + n.id : n.className || n.nodeName), removed: [...m.removedNodes].map(n => n.id ? '#' + n.id : n.className || n.nodeName) });
    }
  }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'display', 'id'] });
});

await page.goto('http://localhost:5173/planetwood/', { waitUntil: 'domcontentloaded' });
log('goto done');

// Wait for title using the test's own wait condition
await page.waitForFunction(() => {
  const l = document.getElementById('loading');
  return l && (l.style.display === 'none' || l.style.display === '') && !!document.getElementById('title-screen');
}, null, { timeout: 60000 });
log('title visible');

log('BEGIN boundingBox', JSON.stringify(await page.locator('button:has-text("BEGIN")').boundingBox()));
log('clicking BEGIN via locator.click');
try {
  await page.locator('button:has-text("BEGIN")').click({ timeout: 10000 });
  log('click OK');
} catch (e) {
  log('click FAILED:', String(e).split('\n')[0]);
}
log('title screen present?', await page.evaluate(() => !!document.getElementById('title-screen')));
log('rafCount', await page.evaluate(() => window.__rafCount || 0));
log('rafTs', await page.evaluate(() => JSON.stringify(window.__rafTs || [])));
log('longtasks', await page.evaluate(() => JSON.stringify(window.__lt || [])));

const allMarks = await page.evaluate(() => window.__marks || []);
const interesting = allMarks.filter(m => /title|loading|intro|BEGIN|begin/i.test(m.target + ' ' + m.added.join(' ') + ' ' + m.removed.join(' ')));
log('marks(title/loading/intro/begin):', JSON.stringify(interesting.slice(-25)));
await browser.close();