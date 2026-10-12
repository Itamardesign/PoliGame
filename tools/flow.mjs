// Screenshots of the Grand Prix screens and the HUD at a given size: node tools/flow.mjs [WxH] [touch]
import { chromium } from 'file:///C:/Users/ASUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const [w, h] = (process.argv[2] ?? '1440x900').split('x').map(Number);
const touch = process.argv[3] === 'touch';
fs.mkdirSync('test-results/qa', { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']
});
const page = await browser.newPage({
  viewport: { width: w, height: h },
  hasTouch: touch,
  isMobile: touch,
  deviceScaleFactor: touch ? 2 : 1
});
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => m.type() === 'error' && errors.push(m.text()));
const tag = `${process.argv[4] ?? ''}${w}x${h}${touch ? '-touch' : ''}`;
await page.goto('http://127.0.0.1:4173/?qa=1' + (process.argv[4] ? '&level=' + process.argv[4] : ''));
await page.waitForFunction(() => window.__ck && !document.querySelector('#play').disabled, null, {
  timeout: 60000
});
await page.waitForTimeout(800);
await page.screenshot({ path: `test-results/qa/flow-${tag}-home.png` });
// After race 1: player (Likud, id 0) third.
await page.evaluate(() => {
  const gp = {
    version: 2,
    player: 0,
    round: 1,
    seats: [7, 12, 9, 5, 4, 3],
    history: [],
    coalition: [],
    loyalty: {},
    left: [],
    done: false,
    talksPending: true
  };
  __ck.setGp(gp);
  __ck.showTalks();
});
await page.waitForTimeout(500);
await page.screenshot({ path: `test-results/qa/flow-${tag}-talks.png` });
await page.locator('[data-invite="2"]').click();
await page.waitForTimeout(300);
await page.screenshot({ path: `test-results/qa/flow-${tag}-talks-joined.png` });
await page.evaluate(() => {
  const gp = {
    version: 2,
    player: 0,
    round: 3,
    seats: [27, 22, 19, 21, 16, 15],
    history: [],
    coalition: [2, 4],
    loyalty: { 2: 0.7, 4: 0.5 },
    left: [],
    done: true
  };
  __ck.setGp(gp);
  __ck.showFinal();
});
await page.waitForTimeout(500);
await page.screenshot({ path: `test-results/qa/flow-${tag}-final.png` });
await page.evaluate(() => __ck.goHome());
await page.locator('[data-mode="single"]').click();
await page.waitForTimeout(300);
await page.screenshot({ path: `test-results/qa/flow-${tag}-single.png` });
await page.locator('#play').click();
await page.waitForFunction(() => readKartState().state === 'running', null, { timeout: 20000 });
await page.waitForTimeout(3500);
await page.screenshot({ path: `test-results/qa/flow-${tag}-race.png` });
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
