// Close-up of every driver's head, for judging the portraits: node tools/faces.mjs
import { chromium } from 'file:///C:/Users/ASUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
  args: ['--use-angle=d3d11', '--enable-gpu']
});
const page = await browser.newPage({ viewport: { width: 1200, height: 700 } });
await page.goto('http://127.0.0.1:4173/?qa=1');
await page.waitForFunction(() => window.__ck && !document.querySelector('#play').disabled, null, {
  timeout: 60000
});
// The garage tiles are rendered from the 3D models; lay them out large on a plain sheet.
await page.evaluate(() => {
  const imgs = [...__ck.faces, ...[...document.querySelectorAll('#drivers img')].map(i => i.src)];
  const faces = document.getElementById('driverFace').src;
  document.body.innerHTML =
    '<div id="sheet" style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px;padding:8px;background:#ddd"></div>';
  for (const src of imgs)
    document
      .getElementById('sheet')
      .insertAdjacentHTML('beforeend', `<img src="${src}" style="width:100%;background:#9fb4c4">`);
});
await page.waitForTimeout(300);
await page.screenshot({ path: 'test-results/qa/faces-karts.png' });
await browser.close();
