import { chromium } from 'playwright';

const url = process.argv[2] || 'data:text/html,<canvas id=c></canvas><script>const gl=document.getElementById("c").getContext("webgl2");gl.clearColor(1,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);</script>';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(url);
const info = await page.evaluate(() => {
  const c = document.createElement('canvas');
  const gl = c.getContext('webgl2');
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  return {
    gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : null,
    vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : null,
    cores: navigator.hardwareConcurrency,
  };
});
console.log(JSON.stringify(info));
await browser.close();