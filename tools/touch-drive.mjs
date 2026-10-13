// Drives a race with real touch drags on an emulated phone: node tools/touch-drive.mjs [WxH]
import { chromium } from 'file:///C:/Users/ASUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const [w, h] = (process.argv[2] ?? '390x844').split('x').map(Number);
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
  args: ['--use-angle=d3d11', '--enable-gpu']
});
const context = await browser.newContext({
  viewport: { width: w, height: h },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 2
});
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.addInitScript(() => {
  localStorage.setItem('ck-mode', 'single');
  localStorage.setItem('ck-steer-mode', 'drag');
});
await page.goto('http://127.0.0.1:4173/?level=jerusalem');
await page.waitForFunction(() => window.readKartState && !document.querySelector('#play').disabled);
await page.locator('#play').tap();
await page.waitForFunction(() => readKartState().state === 'intro');
const zone = await page.locator('#steerZone').boundingBox();
const cx = zone.x + zone.width * 0.5,
  cy = zone.y + zone.height * 0.6;
const touch = (type, x, y) =>
  cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
// Tap skips the flyover.
await touch('touchStart', cx, cy);
await touch('touchEnd');
await page.waitForFunction(() => readKartState().state === 'countdown');
await page.screenshot({ path: `test-results/qa/touch-${w}x${h}-countdown.png` });
await page.waitForFunction(() => readKartState().state === 'running', null, { timeout: 15000 });
// Hold a thumb down and steer by dragging; push hard in long bends to trigger auto-drift.
await touch('touchStart', cx, cy);
let shot = false,
  drifted = false,
  steered = 0;
const t0 = Date.now();
while (Date.now() - t0 < 26000) {
  const st = await page.evaluate(() => {
    const s = readKartState(),
      p = s.race.racers[0];
    return { x: p.x, l: p.lateral, steer: p.steer, drifting: p.drifting, time: s.race.time };
  });
  // Mostly keep centre; every few seconds yank hard to one side for a second to drift.
  const yank = st.time % 6 > 4.6;
  const want = yank ? -Math.sign(st.x || 1) : Math.max(-1, Math.min(1, -st.x * 0.35 - st.l * 0.12));
  await touch('touchMove', cx + want * 62, cy);
  if (Math.abs(st.steer) > 0.3) steered++;
  if (st.drifting) drifted = true;
  if (drifted && !shot) {
    await page.screenshot({ path: `test-results/qa/touch-${w}x${h}-drift.png` });
    shot = true;
  }
  await page.waitForTimeout(50);
}
await touch('touchEnd');
// A quick tap uses the item, if one is held.
const before = await page.evaluate(() => readKartState().race.racers[0].item);
await touch('touchStart', cx, cy);
await touch('touchEnd');
await page.waitForTimeout(200);
const after = await page.evaluate(() => readKartState().race.racers[0].item);
await page.screenshot({ path: `test-results/qa/touch-${w}x${h}-race.png` });
console.log(
  JSON.stringify({ steeredFrames: steered, autoDrift: drifted, itemBefore: before, itemAfter: after })
);
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
