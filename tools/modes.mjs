// Plays the time trial twice (the second run races the first one's ghost) and the daily
// challenge, saving screenshots along the way: node tools/modes.mjs
import { chromium } from 'file:///C:/Users/ASUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs';

const out = 'test-results/qa';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => m.type() === 'error' && errors.push(m.text()));

async function drive(tag, shotAt = []) {
  await page.waitForFunction(
    () => window.readKartState && ['intro', 'countdown', 'running'].includes(readKartState().state),
    null,
    {
      timeout: 60000
    }
  );
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => readKartState().state === 'running', null, { timeout: 20000 });
  await page.keyboard.down('KeyW');
  let held = null;
  const taken = new Set();
  while (true) {
    const st = await page.evaluate(() => {
      const s = readKartState(),
        p = s.race.racers[0];
      return { state: s.state, time: s.race.time, x: p.x, lateral: p.lateral };
    });
    if (st.state !== 'running') break;
    const want = -st.x * 0.35 - st.lateral * 0.12,
      key = want > 0.25 ? 'ArrowRight' : want < -0.25 ? 'ArrowLeft' : null;
    if (key !== held) {
      if (held) await page.keyboard.up(held);
      if (key) await page.keyboard.down(key);
      held = key;
    }
    if (Math.random() < 0.06) await page.keyboard.press('Space');
    for (const t of shotAt)
      if (st.time >= t && !taken.has(t)) {
        taken.add(t);
        await page.screenshot({ path: `${out}/modes-${tag}-t${t}.png` });
      }
    await page.waitForTimeout(40);
  }
  if (held) await page.keyboard.up(held);
  await page.keyboard.up('KeyW');
  await page.waitForFunction(() => readKartState().state === 'results', null, { timeout: 20000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/modes-${tag}-results.png` });
  return page.evaluate(() => ({
    title: document.getElementById('resultTitle').textContent,
    line: document.getElementById('resultLine').textContent
  }));
}

await page.goto('http://127.0.0.1:4173/?qa=1&level=jerusalem');
const onlyDaily = process.argv[2] === 'daily';
await page.waitForFunction(() => window.__ck && !document.querySelector('#play').disabled, null, {
  timeout: 60000
});
await page.evaluate(() => localStorage.removeItem('ck-ghost-jerusalem'));
if (!onlyDaily) {
  await page.locator('[data-mode="trial"]').click();
  await page.screenshot({ path: `${out}/modes-home-trial.png` });
  await page.locator('#play').click();
  console.log('trial 1:', await drive('trial1', [10]));
  await page.locator('#again').click();
  console.log('trial 2:', await drive('trial2', [8, 30]));
  await page.locator('#homeButton').click();
}
await page.locator('[data-mode="daily"]').click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/modes-home-daily.png` });
await page.locator('#play').click();
console.log('daily:', await drive('daily', [12]));
console.log('share visible:', await page.locator('#share').isVisible());
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
