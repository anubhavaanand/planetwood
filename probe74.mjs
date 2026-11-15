import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:5173/planetwood/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => { const l = document.getElementById('loading'); return l && l.style.display === 'none' && !!document.getElementById('title-screen'); }, null, { timeout: 90000 });
await p.waitForTimeout(4000);
const hud = await p.evaluate(() => { const e = [...document.querySelectorAll('div')].find(d => /FPS \|/.test(d.textContent || '')); return e ? e.textContent : 'no hud'; });
console.log('HUD', hud);
// list all meshes in scene by scanning __THREE__ ? no. Use scene through renderer? 
// Try: three's devtools hook - find via canvas' __r3f? no.
await b.close();
