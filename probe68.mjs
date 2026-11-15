import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
await p.goto('http://localhost:5173/planetwood/', { waitUntil: 'domcontentloaded' });
const t0 = Date.now();
try {
  await p.waitForFunction(() => { const l = document.getElementById('loading'); return l && l.style.display === 'none' && !!document.getElementById('title-screen'); }, null, { timeout: 120000 });
  console.log('title ready at', Date.now() - t0, 'ms');
} catch (e) {
  console.log('TIMEOUT at', Date.now() - t0);
  console.log(await p.evaluate(() => ({ loading: document.getElementById('loading')?.outerHTML.slice(0,200), title: !!document.getElementById('title-screen'), body: document.body.children.length })));
}
await b.close();
