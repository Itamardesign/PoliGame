import { chromium } from 'file:///C:/Users/ASUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { makeTrack } from '../dist/kart-world.js';
import assert from 'node:assert/strict';
const track = makeTrack();
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
  args: ['--enable-unsafe-swiftshader']
});
const page = await browser.newPage({ viewport: { width: 1100, height: 920 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto('http://127.0.0.1:4173');
await page.waitForFunction(() => window.readKartState);
await page.locator('#play').click();
let iterations = 0,
  held = '',
  finished = false;
while (iterations++ < 1900) {
  const { state, race } = await page.evaluate(() => readKartState());
  if (state === 'results') {
    finished = true;
    console.log('FINISH', race);
    break;
  }
  if (state === 'running') {
    const p = race.racers[0],
      b = track.bend(p.s);
    const target = p.item ? 0 : Math.sin(Math.floor((p.s + 7) / 28) * 28 * 0.06) * 2;
    const desired = (-b * p.speed * 3.5) / 11.4 + (target - p.x) * 0.8;
    const key = desired > 0.2 ? 'ArrowRight' : desired < -0.2 ? 'ArrowLeft' : '';
    if (key !== held) {
      if (held) await page.keyboard.up(held);
      if (key) await page.keyboard.down(key);
      held = key;
    }
    if (p.item) await page.keyboard.press('Space');
  }
  if (iterations % 150 === 0) console.log('Progress', race?.time?.toFixed(1));
  await page.waitForTimeout(60);
}
assert.equal(finished, true);
assert.equal(await page.locator('#results').isVisible(), true);
await page.screenshot({ path: 'test-results/kart-finish.png' });
await page.locator('#again').click();
assert.equal((await page.evaluate(() => readKartState())).state, 'countdown');
await page.locator('#pause').click();
await page.locator('#quit').click();
assert.equal((await page.evaluate(() => readKartState())).state, 'home');
assert.deepEqual(errors, []);
console.log('PASS complete race, results, replay, pause, home; no runtime errors');
await browser.close();
