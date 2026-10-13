// Fixed views of points on the course: node tools/views.mjs level u[,back,up,x] ...
import { chromium } from 'file:///C:/Users/ASUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const level = process.argv[2] ?? 'jerusalem';
const views = process.argv.slice(3).map(v => v.split(',').map(Number));
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
  args: ['--use-angle=d3d11', '--enable-gpu']
});
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(`http://127.0.0.1:4173/?qa=1&level=${level}`);
await page.waitForFunction(() => window.__ck && !document.querySelector('#play').disabled);
await page.evaluate(() => document.getElementById('home').classList.add('hidden'));
for (const [u, back = 30, up = 9, x = 0] of views) {
  await page.evaluate(([u, b, h, x]) => __ck.view(u, b, h, x), [u, back, up, x]);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `test-results/qa/view-${level}-${u}.png` });
}
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
