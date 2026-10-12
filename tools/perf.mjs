// Frame-rate sampling across a race: node tools/perf.mjs [level] [WxH]
import { chromium } from 'file:///C:/Users/ASUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const level = process.argv[2] ?? 'jerusalem';
const [w, h] = (process.argv[3] ?? '1280x800').split('x').map(Number);
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']
});
const page = await browser.newPage({ viewport: { width: w, height: h } });
await page.goto(`http://127.0.0.1:${process.env.PORT ?? 4173}/?level=${level}`);
await page.waitForFunction(() => window.readKartState && !document.querySelector('#play').disabled, null, {
  timeout: 60000
});
const sample = () =>
  page.evaluate(
    () =>
      new Promise(done => {
        const times = [];
        let last = performance.now();
        const tick = now => {
          times.push(now - last);
          last = now;
          if (times.length < 90) requestAnimationFrame(tick);
          else {
            times.sort((a, b) => a - b);
            done({
              fps: Math.round(1000 / (times.reduce((a, b) => a + b) / times.length)),
              p95: times[Math.floor(times.length * 0.95)].toFixed(1),
              calls: readKartState().renderCalls
            });
          }
        };
        requestAnimationFrame(tick);
      })
  );
console.log('home', JSON.stringify(await sample()));
await page.locator('#play').click();
await page.keyboard.down('KeyW');
for (let i = 0; i < 6; i++) {
  await page.waitForTimeout(2500);
  console.log('race', i, JSON.stringify(await sample()));
}
await browser.close();
