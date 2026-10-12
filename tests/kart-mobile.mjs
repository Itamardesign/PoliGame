import { chromium } from 'file:///C:/Users/ASUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
  args: ['--enable-unsafe-swiftshader']
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true
});
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => {
  if (m.type() === 'error') errors.push(m.text());
});
await page.goto('http://127.0.0.1:4173');
await page.waitForFunction(() => window.readKartState);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: 'test-results/kart-mobile-home.png', fullPage: true });
await page.getByRole('button', { name: 'אריה דרעי — ש״ס', exact: true }).click();
assert.equal((await page.evaluate(() => readKartState())).selected, 'shas');
await page.locator('#play').click();
await page.waitForTimeout(4500);
await page.screenshot({ path: 'test-results/kart-mobile-race.png', fullPage: true });
await page.locator('#pause').click();
let state = await page.evaluate(() => readKartState());
assert.equal(state.state, 'paused');
await page.waitForTimeout(200);
assert.equal((await page.evaluate(() => readKartState())).race.time, state.race.time);
await page.locator('#resume').click();
assert.equal((await page.evaluate(() => readKartState())).state, 'running');
await page.keyboard.down('ArrowRight');
await page.keyboard.down('Shift');
await page.waitForTimeout(1000);
await page.keyboard.up('Shift');
await page.keyboard.up('ArrowRight');
console.log('Mobile state', await page.evaluate(() => readKartState()));
console.log('Overflow', await page.evaluate(() => document.documentElement.scrollWidth > innerWidth));
console.log('Errors', errors);
assert.deepEqual(errors, []);
await browser.close();
