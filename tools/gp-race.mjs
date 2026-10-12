// Plays the first race of a fresh Grand Prix and screenshots the results and the talks that follow.
import { chromium } from 'file:///C:/Users/ASUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const [w, h] = (process.argv[2] ?? '1440x900').split('x').map(Number);
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
  args: ['--use-angle=d3d11', '--enable-gpu']
});
const touch = w < h;
const page = await browser.newPage({
  viewport: { width: w, height: h },
  hasTouch: touch,
  isMobile: touch,
  deviceScaleFactor: touch ? 2 : 1
});
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.addInitScript(() => {
  if (!sessionStorage.getItem('seeded')) {
    localStorage.setItem('ck-mode', 'gp');
    localStorage.removeItem('ck-gp');
    sessionStorage.setItem('seeded', '1');
  }
});
await page.goto('http://127.0.0.1:4173/');
await page.waitForFunction(() => window.readKartState && !document.querySelector('#play').disabled);
await page.locator('#play').click();
await page.waitForFunction(
  () => window.readKartState && ['intro', 'countdown'].includes(readKartState().state),
  null,
  { timeout: 60000 }
);
await page.keyboard.press('Enter');
await page.waitForFunction(() => readKartState().state === 'running');
await page.keyboard.down('KeyW');
let held = null;
while (true) {
  const st = await page.evaluate(() => {
    const s = readKartState(),
      p = s.race.racers[0];
    return { state: s.state, x: p.x, l: p.lateral };
  });
  if (st.state !== 'running') break;
  const want = -st.x * 0.35 - st.l * 0.12,
    key = want > 0.25 ? 'ArrowRight' : want < -0.25 ? 'ArrowLeft' : null;
  if (key !== held) {
    if (held) await page.keyboard.up(held);
    if (key) await page.keyboard.down(key);
    held = key;
  }
  if (Math.random() < 0.05) await page.keyboard.press('Space');
  await page.waitForTimeout(40);
}
await page.waitForFunction(() => readKartState().state === 'results', null, { timeout: 20000 });
await page.waitForTimeout(700);
await page.screenshot({ path: `test-results/qa/gp-${w}x${h}-results.png` });
await page.locator('#again').click();
await page.waitForTimeout(500);
await page.screenshot({ path: `test-results/qa/gp-${w}x${h}-talks.png` });
console.log(await page.evaluate(() => JSON.stringify(readKartState().gp)));
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
