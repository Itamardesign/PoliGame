import { chromium } from 'file:///C:/Users/ASUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
  args: ['--enable-unsafe-swiftshader']
});
try {
  for (const { width, height } of [
    { width: 320, height: 480 },
    { width: 320, height: 640 },
    { width: 390, height: 844 },
    { width: 568, height: 320 },
    { width: 844, height: 390 }
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true
    });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/kart.js', async route => {
      const response = await route.fetch();
      const body = await response.text();
      await route.fulfill({
        response,
        body:
          body +
          '\nwindow.showTestResults=()=>{race.time=62.07;race.racers[0].finish=62.07;race.racers[1].finish=66.31;race.racers[2].finish=70.42;finish();};'
      });
    });
    await page.goto('http://127.0.0.1:4173');
    await page.waitForFunction(() => window.showTestResults);
    await page.locator('#play').tap();
    await page.evaluate(() => window.showTestResults());
    const layout = await page.evaluate(() => {
      const rect = selector => {
        const r = document.querySelector(selector).getBoundingClientRect();
        return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
      };
      return {
        card: rect('.results-card'),
        again: rect('#again'),
        home: rect('#homeButton'),
        rows: document.querySelectorAll('#resultsBoard .results-row').length,
        faces: [...document.querySelectorAll('#resultsBoard img')].map(
          img => img.complete && img.naturalWidth > 0
        ),
        scrollWidth: document.documentElement.scrollWidth
      };
    });
    assert.equal(layout.rows, 6);
    assert.ok(layout.faces.every(Boolean), 'all six portraits load');
    for (const key of ['card', 'again', 'home']) {
      const r = layout[key];
      assert.ok(
        r.x >= 0 && r.y >= 0 && r.right <= width && r.bottom <= height,
        `${key} outside ${width}x${height}`
      );
    }
    assert.ok(layout.scrollWidth <= width, 'no horizontal overflow');
    assert.deepEqual(errors, []);
    await page.screenshot({ path: `test-results/kart-results-${width}x${height}.png` });
    await page.close();
  }
  console.log('PASS mobile results portraits, six standings, visible actions, no overflow');
} finally {
  await browser.close();
}
