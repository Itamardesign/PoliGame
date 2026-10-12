// Screenshots of the secondary screens: help, credits, pause, countdown: node tools/screens.mjs [WxH]
import { chromium } from 'file:///C:/Users/ASUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const [w, h] = (process.argv[2] ?? '1440x900').split('x').map(Number);
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
  args: ['--use-angle=d3d11', '--enable-gpu']
});
const page = await browser.newPage({ viewport: { width: w, height: h } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.addInitScript(() => localStorage.setItem('ck-mode', 'single'));
await page.goto('http://127.0.0.1:4173/?level=jerusalem');
await page.waitForFunction(() => window.readKartState && !document.querySelector('#play').disabled);
const tag = `${w}x${h}`;
await page.locator('#help').click();
await page.waitForTimeout(300);
await page.screenshot({ path: `test-results/qa/screen-${tag}-help.png` });
await page.locator('#closeInfo').click();
await page.locator('#credits').click();
await page.waitForTimeout(300);
await page.screenshot({ path: `test-results/qa/screen-${tag}-credits.png` });
await page.locator('#closeInfo').click();
await page.locator('#play').click();
await page.waitForFunction(() => readKartState().state === 'intro');
await page.keyboard.press('Enter');
await page.waitForFunction(() => readKartState().state === 'countdown' && readKartState().countdown < 2.2);
await page.screenshot({ path: `test-results/qa/screen-${tag}-countdown.png` });
await page.waitForFunction(() => readKartState().state === 'running');
await page.keyboard.down('KeyW');
await page.waitForTimeout(2500);
await page.screenshot({ path: `test-results/qa/screen-${tag}-tags.png` });
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await page.screenshot({ path: `test-results/qa/screen-${tag}-pause.png` });
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
