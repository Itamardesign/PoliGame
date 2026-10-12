// Visual QA: plays a race in headless Chromium with real keyboard input and saves screenshots.
// Usage: node tools/shoot.mjs [level] [width]x[height] [seconds...]
import { chromium } from 'file:///C:/Users/ASUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs';

const level = process.argv[2] ?? 'jerusalem';
const [w, h] = (process.argv[3] ?? '1440x900').split('x').map(Number);
const shots = (process.argv.slice(4).length ? process.argv.slice(4) : ['0', '6', '20', 'end']).map(x =>
  x === 'end' ? Infinity : Number(x)
);
const out = 'test-results/qa';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']
});
const page = await browser.newPage({ viewport: { width: w, height: h } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => m.type() === 'error' && errors.push(m.text()));
await page.goto(`http://127.0.0.1:4173/?level=${level}`);
await page.waitForFunction(() => window.readKartState && !document.querySelector('#play').disabled, null, {
  timeout: 60000
});
const tag = `${level}-${w}x${h}`;
if (shots.includes(0)) await page.screenshot({ path: `${out}/${tag}-home.png` });
await page.locator('#play').click();
await page.waitForFunction(() => readKartState().state === 'running', null, { timeout: 20000 });
await page.keyboard.down('KeyW');
let held = null,
  shiftHeld = false;
const taken = new Set();
let fps = null;
const t0 = Date.now();
while (true) {
  const st = await page.evaluate(() => {
    const s = readKartState();
    const p = s.race.racers[0];
    return {
      state: s.state,
      time: s.race.time,
      x: p.x,
      rank: s.race.rank,
      lateral: p.lateral,
      charge: p.charge,
      drifting: p.drifting
    };
  });
  if (st.state !== 'running') break;
  // Simple lane keeper: aim for the centre line, steering with the arrow keys.
  const want = -st.x * 0.35 - st.lateral * 0.12;
  const key = want > 0.25 ? 'ArrowRight' : want < -0.25 ? 'ArrowLeft' : null;
  if (key !== held) {
    if (held) await page.keyboard.up(held);
    if (key) await page.keyboard.down(key);
    held = key;
  }
  if (Math.random() < 0.05) await page.keyboard.press('Space');
  if (Math.random() < 0.05) await page.keyboard.press('KeyE');
  // Drift in bursts: hold Shift for ~1.5 s whenever steering, then release for the boost.
  const wantDrift = !!key && st.time % 5 < 1.6;
  if (wantDrift !== shiftHeld) {
    await (wantDrift ? page.keyboard.down('ShiftLeft') : page.keyboard.up('ShiftLeft'));
    shiftHeld = wantDrift;
  }
  for (const t of shots)
    if (Number.isFinite(t) && t > 0 && st.time >= t && !taken.has(t)) {
      taken.add(t);
      await page.screenshot({ path: `${out}/${tag}-t${t}.png` });
    }
  if (fps === null && st.time > 6) {
    fps = await page.evaluate(
      () =>
        new Promise(done => {
          let n = 0;
          const start = performance.now();
          const tick = () => (
            ++n, performance.now() - start < 2000 ? requestAnimationFrame(tick) : done(n / 2)
          );
          requestAnimationFrame(tick);
        })
    );
    console.log('fps', fps, 'drawCalls', await page.evaluate(() => readKartState().renderCalls));
  }
  if (Date.now() - t0 > 420000) break;
  await page.waitForTimeout(40);
}
await page.waitForTimeout(1500);
const final = await page.evaluate(() => {
  const s = readKartState();
  return {
    state: s.state,
    rank: s.race.rank,
    time: s.race.time.toFixed(1),
    board: [...document.querySelectorAll('#resultsBoard li')].map(li => li.innerText.replace(/\s+/g, ' '))
  };
});
if (shots.includes(Infinity)) await page.screenshot({ path: `${out}/${tag}-end.png` });
console.log(JSON.stringify(final, null, 1));
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
