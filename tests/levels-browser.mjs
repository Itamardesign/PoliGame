import { chromium } from 'file:///C:/Users/ASUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
  args: ['--enable-unsafe-swiftshader']
});
try {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 }
  ]) {
    const page = await browser.newPage({
      viewport,
      deviceScaleFactor: 1,
      isMobile: viewport.width < 500,
      hasTouch: viewport.width < 500
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:4173');
    await page.waitForFunction(() => window.readKartState, { timeout: 60000 });
    await page.screenshot({ path: `test-results/levels-home-${viewport.width}.png`, fullPage: true });
    const metrics = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      level: readKartState().level,
      arena: document.querySelector('#arena').getBoundingClientRect().toJSON(),
      play: document.querySelector('#play').getBoundingClientRect().toJSON(),
      garage: document.querySelector('.select-garage').getBoundingClientRect().toJSON()
    }));
    console.log(viewport.width, metrics);
    assert.equal(metrics.overflow, false);
    assert.equal(metrics.level, 'jerusalem');
    await page.locator('[data-level="market"]').click();
    await page.waitForFunction(() => window.readKartState?.().level === 'market', { timeout: 60000 });
    assert.equal(await page.locator('[data-level="market"]').getAttribute('aria-pressed'), 'true');
    await page.locator('[data-level="midnight"]').click();
    await page.waitForFunction(() => window.readKartState?.().level === 'midnight', { timeout: 60000 });
    await page.screenshot({ path: `test-results/levels-midnight-${viewport.width}.png`, fullPage: true });
    await page.locator('#play').click();
    const state = await page.evaluate(() => readKartState());
    assert.equal(state.race.levelId, 'midnight');
    assert.equal(state.race.difficulty, 'insane');
    assert.equal(state.state, 'countdown');
    await page.waitForTimeout(4200);
    assert.equal((await page.evaluate(() => readKartState())).state, 'running');
    await page.screenshot({ path: `test-results/levels-race-${viewport.width}.png`, fullPage: false });
    assert.deepEqual(errors, []);
    await page.close();
  }
} finally {
  await browser.close();
}
