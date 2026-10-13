// End-to-end browser checks with real input: `npm run test:browser`.
// Starts the local server if needed, drives Chromium (GPU when available) and fails on any page
// error. Screenshots land in test-results/browser/.
import { chromium } from 'file:///C:/Users/ASUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:4173';
const out = 'test-results/browser';
fs.mkdirSync(out, { recursive: true });
let server = null;
try {
  await fetch(BASE);
} catch {
  server = spawn(process.execPath, ['server.mjs'], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
}
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']
});
const errors = [];
async function open(viewport, options = {}) {
  const page = await browser.newPage({ viewport, ...options });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  return page;
}
const ready = page =>
  page.waitForFunction(() => window.readKartState && !document.querySelector('#play').disabled, null, {
    timeout: 60000
  });
async function race(page) {
  await page.waitForFunction(
    () => window.readKartState && ['intro', 'countdown'].includes(readKartState().state),
    null,
    {
      timeout: 60000
    }
  );
  await page.keyboard.press('Enter'); // skip the flyover
  await page.waitForFunction(() => readKartState().state === 'running', null, { timeout: 20000 });
  await page.keyboard.down('KeyW');
  let held = null;
  for (let i = 0; i < 6000; i++) {
    const st = await page.evaluate(() => {
      const s = readKartState(),
        p = s.race.racers[0];
      return { state: s.state, x: p.x, lateral: p.lateral };
    });
    if (st.state !== 'running') break;
    const want = -st.x * 0.35 - st.lateral * 0.12,
      key = want > 0.25 ? 'ArrowRight' : want < -0.25 ? 'ArrowLeft' : null;
    if (key !== held) {
      if (held) await page.keyboard.up(held);
      if (key) await page.keyboard.down(key);
      held = key;
    }
    if (i % 25 === 0) await page.keyboard.press('Space');
    await page.waitForTimeout(40);
  }
  if (held) await page.keyboard.up(held);
  await page.keyboard.up('KeyW');
  await page.waitForFunction(() => readKartState().state === 'results', null, { timeout: 20000 });
}
const only = process.argv[2];
const check = async (name, fn) => {
  if (only && !name.includes(only)) return;
  const started = Date.now();
  await fn();
  console.log(`✔ ${name} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
};

try {
  await check('title screen offers four modes and six drivers', async () => {
    const page = await open({ width: 1440, height: 900 });
    await page.goto(BASE + '/?qa=1');
    await ready(page);
    assert.equal(await page.locator('.mode').count(), 4);
    assert.equal(await page.locator('#drivers .driver').count(), 6);
    await page.locator('#drivers .driver').nth(2).click();
    assert.equal(await page.locator('#garageLeader').textContent(), 'יאיר גולן');
    await page.screenshot({ path: `${out}/title.png` });
    await page.close();
  });

  await check('a single race runs to results with all six drivers timed', async () => {
    const page = await open({ width: 1280, height: 800 });
    await page.addInitScript(() => localStorage.setItem('ck-mode', 'single'));
    await page.goto(BASE + '/?level=jerusalem');
    await ready(page);
    await page.locator('#play').click();
    await race(page);
    await page.screenshot({ path: `${out}/single-results.png` });
    const rows = await page.locator('#resultsBoard li').allTextContents();
    assert.equal(rows.length, 6);
    for (const row of rows) assert.match(row, /\d:\d\d\.\d\d|\+\d+\.\d\d/);
    await page.close();
  });

  await check('Grand Prix talks accept a junior partner and the final count renders', async () => {
    const page = await open({ width: 1440, height: 900 });
    await page.goto(BASE + '/?qa=1');
    await ready(page);
    await page.evaluate(() => {
      __ck.setGp({
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
      });
      __ck.showTalks();
    });
    assert.equal(await page.locator('#offers li').count(), 5);
    assert.equal(await page.locator('[data-invite="1"]').count(), 0, 'a bigger party must refuse');
    await page.locator('[data-invite="2"]').click();
    // Continue to the next race: the page moves to the second course with the coalition in place.
    await page.locator('#nextRace').click();
    await page.waitForURL(/level=market/);
    await page.waitForFunction(
      () => window.readKartState && ['intro', 'countdown'].includes(readKartState().state),
      null,
      {
        timeout: 60000
      }
    );
    const gpState = await page.evaluate(() => readKartState());
    assert.equal(gpState.level, 'market');
    assert.deepEqual(gpState.gp.coalition, [2]);
    assert.ok(gpState.race.racers.length === 6);
    await page.goto(BASE + '/?qa=1');
    await ready(page);
    await page.evaluate(() => {
      __ck.setGp({
        version: 2,
        player: 0,
        round: 1,
        seats: [7, 12, 9, 5, 4, 3],
        history: [],
        coalition: [2],
        loyalty: { 2: 0.65 },
        left: [],
        done: false,
        talksPending: true
      });
      __ck.showTalks();
    });
    assert.match(await page.locator('#talksSum').textContent(), /16/);
    await page.evaluate(() => {
      __ck.setGp({
        version: 2,
        player: 0,
        round: 3,
        seats: [27, 22, 19, 21, 16, 15],
        history: [],
        coalition: [2, 4],
        loyalty: {},
        left: [],
        done: true
      });
      __ck.showFinal();
    });
    assert.match(await page.locator('#finalTitle').textContent(), /מקים ממשלה/);
    await page.screenshot({ path: `${out}/gp-final.png` });
    await page.close();
  });

  await check('a time trial saves a ghost the next run races against', async () => {
    const page = await open({ width: 1280, height: 800 });
    await page.addInitScript(() => localStorage.setItem('ck-mode', 'trial'));
    await page.goto(BASE + '/?level=jerusalem');
    await ready(page);
    await page.evaluate(() => localStorage.removeItem('ck-ghost-jerusalem'));
    await page.locator('#play').click();
    await race(page);
    assert.equal(await page.locator('#resultTitle').textContent(), 'שיא חדש');
    assert.ok(
      await page.evaluate(() => JSON.parse(localStorage.getItem('ck-ghost-jerusalem')).frames.length > 500)
    );
    await page.close();
  });

  await check('phone layout keeps the start button and touch controls on screen', async () => {
    const page = await open(
      { width: 390, height: 844 },
      { hasTouch: true, isMobile: true, deviceScaleFactor: 2 }
    );
    await page.addInitScript(() => localStorage.setItem('ck-mode', 'single'));
    await page.goto(BASE + '/?level=jerusalem');
    await ready(page);
    const box = await page.locator('#play').boundingBox();
    assert.ok(box && box.y + box.height <= 844, 'start button visible');
    await page.locator('#play').tap();
    await page.waitForFunction(() => ['intro', 'countdown', 'running'].includes(readKartState().state));
    await page.locator('#steerZone').tap();
    await page.waitForFunction(() => readKartState().state === 'running', null, { timeout: 20000 });
    // Drag-to-steer zone, drift button and the item and ability thumbs are all on screen.
    for (const sel of ['#steerZone', '[data-key="drift"]', '#item', '#ability'])
      assert.ok(await page.locator(sel).isVisible(), sel);
    await page.screenshot({ path: `${out}/phone-race.png` });
    await page.close();
  });

  assert.deepEqual(errors, [], 'page errors');
  console.log('browser checks passed');
} finally {
  await browser.close();
  server?.kill();
}
