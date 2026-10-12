import { chromium } from 'file:///C:/Users/ASUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { makeTrack } from '../dist/kart-world.js';
import assert from 'node:assert/strict';
const track = makeTrack(),
  browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--enable-unsafe-swiftshader']
  });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } }),
  errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => {
  if (m.type() === 'error') errors.push(m.text());
});
await page.goto('http://127.0.0.1:4173');
await page.waitForFunction(() => window.readKartState);
await page.screenshot({ path: 'test-results/circuit-home.png', fullPage: true });
await page.locator('#play').click();
await page.waitForFunction(() => readKartState().state === 'running');
await page.waitForTimeout(700);
const cdp = await page.context().newCDPSession(page),
  before = await page.evaluate(() => readKartState().race.racers[0].x);
await cdp.send('Input.dispatchKeyEvent', {
  type: 'keyDown',
  key: 'ג',
  code: 'KeyD',
  windowsVirtualKeyCode: 68
});
await page.waitForTimeout(320);
let r = await page.evaluate(() => readKartState());
assert.equal(r.controls.right, true);
assert.ok(r.race.racers[0].x > before + 0.5);
await cdp.send('Input.dispatchKeyEvent', {
  type: 'keyUp',
  key: 'ג',
  code: 'KeyD',
  windowsVirtualKeyCode: 68
});
await page.keyboard.down('ArrowRight');
await page.keyboard.down('d');
await page.keyboard.up('d');
assert.equal((await page.evaluate(() => readKartState())).controls.right, true);
await page.keyboard.up('ArrowRight');
await page.waitForTimeout(400);
assert.equal((await page.evaluate(() => readKartState())).controls.right, false);
await page.keyboard.press('c');
assert.equal((await page.evaluate(() => readKartState())).wideCamera, false);
await page.keyboard.press('c');
await page.keyboard.press('Escape');
assert.equal((await page.evaluate(() => readKartState())).state, 'paused');
const pauseTime = (await page.evaluate(() => readKartState())).race.time;
await page.locator('#steeringSensitivity').fill('0.8');
await page.waitForTimeout(200);
assert.equal((await page.evaluate(() => readKartState())).race.time, pauseTime);
assert.equal((await page.evaluate(() => readKartState())).sensitivity, 0.8);
await page.locator('#steeringSensitivity').fill('1');
await page.locator('#quit').click();
await page.locator('#play').click();
await page.waitForFunction(() => readKartState().state === 'running');
await page.keyboard.down('w');
let iterations = 0,
  held = '',
  finished = false;
const captures = new Set();
while (iterations++ < 1800) {
  const { state, race } = await page.evaluate(() => readKartState());
  if (state === 'results') {
    finished = true;
    console.log('FINISH', { time: race.time, place: race.rank });
    break;
  }
  if (state === 'running') {
    const p = race.racers[0],
      bend = track.bend(p.s),
      desired = (-bend * p.speed * 3.5) / 11.4 - p.x * 0.7;
    const key = desired > 0.18 ? 'ArrowRight' : desired < -0.18 ? 'ArrowLeft' : '';
    if (key !== held) {
      if (held) await page.keyboard.up(held);
      if (key) await page.keyboard.down(key);
      held = key;
    }
    if (p.item) await page.keyboard.press('Space');
    const u = p.s / track.length;
    for (const [name, start] of [
      ['straight', 0.1],
      ['bridge', 0.28],
      ['market', 0.56],
      ['park', 0.82]
    ])
      if (u > start && !captures.has(name)) {
        captures.add(name);
        await page.screenshot({ path: 'test-results/circuit-' + name + '.png' });
      }
    if (iterations % 170 === 0) console.log('PROGRESS', race.time.toFixed(1));
  }
  await page.waitForTimeout(65);
}
assert.equal(finished, true);
assert.equal(await page.locator('#results').isVisible(), true);
await page.screenshot({ path: 'test-results/circuit-finish.png' });
await page.keyboard.up('w');
if (held) await page.keyboard.up(held);
await page.locator('#again').click();
assert.equal((await page.evaluate(() => readKartState())).state, 'countdown');
await page.keyboard.press('Escape');
await page.locator('#quit').click();
assert.equal((await page.evaluate(() => readKartState())).state, 'home');
assert.deepEqual(errors, []);
console.log(
  'PASS physical Hebrew layout, steering/release, camera, sensitivity, pause, full lap districts, finish/replay; no browser errors'
);
await browser.close();
