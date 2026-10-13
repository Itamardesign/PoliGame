// Track layout lab: draws a candidate base layout and reports its shape.
// node tools/track-lab.mjs layout.json  (JSON array of [x, y, z] points)  -> test-results/qa/track-lab.png
import { chromium } from 'file:///C:/Users/ASUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { makeTrack } from '../dist/kart-world.js';

const points = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) : null;
const track = makeTrack('jerusalem', points);
const N = 600,
  L = track.length,
  pts = Array.from({ length: N }, (_, i) => track.at((i / N) * L).p);
let maxBend = 0,
  at = 0;
for (let i = 0; i < N; i++) {
  const b = Math.abs(track.bend((i / N) * L));
  if (b > maxBend) [maxBend, at] = [b, i / N];
}
// Closest approach between parts of the road more than 80 m apart along the track.
let minSep = Infinity,
  sepAt = null;
for (let i = 0; i < N; i++)
  for (let j = i + 1; j < N; j++) {
    const along = Math.min(j - i, N - (j - i)) * (L / N);
    if (along < 80) continue;
    const d = Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z);
    if (d < minSep)
      [minSep, sepAt] = [
        d,
        [(i / N).toFixed(2), (j / N).toFixed(2), Math.abs(pts[i].y - pts[j].y).toFixed(1)]
      ];
  }
const ys = pts.map(p => p.y);
console.log(
  JSON.stringify({
    length: L.toFixed(0),
    maxBend: maxBend.toFixed(4),
    maxBendAt: at.toFixed(2),
    minSeparation: minSep.toFixed(1),
    sepAt,
    yRange: [Math.min(...ys).toFixed(1), Math.max(...ys).toFixed(1)]
  })
);

const xs = pts.map(p => p.x),
  zs = pts.map(p => p.z);
const minX = Math.min(...xs) - 30,
  maxX = Math.max(...xs) + 30,
  minZ = Math.min(...zs) - 30,
  maxZ = Math.max(...zs) + 30;
const W = 900,
  H = Math.round((W * (maxZ - minZ)) / (maxX - minX));
const px = p => [((p.x - minX) / (maxX - minX)) * W, H - ((p.z - minZ) / (maxZ - minZ)) * H];
const sc = W / (maxX - minX);
const segs = pts
  .map((p, i) => {
    const q = pts[(i + 1) % N],
      [x1, y1] = px(p),
      [x2, y2] = px(q),
      h = Math.max(0, Math.min(1, p.y / 12));
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="hsl(${210 - h * 190},70%,${45 + h * 10}%)" stroke-width="${20 * sc}" stroke-linecap="round"/>`;
  })
  .join('');
const marks = [0, 0.12, 0.25, 0.38, 0.48, 0.6, 0.76, 0.85, 0.92]
  .map(u => {
    const [x, y] = px(track.at(u * L).p);
    return `<circle cx="${x}" cy="${y}" r="5" fill="#000"/><text x="${x + 8}" y="${y - 8}" font-size="15" font-family="Arial" font-weight="700">${u}</text>`;
  })
  .join('');
const [kx, ky] = px({ x: 44, z: 10 });
const html = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" style="background:#eef0e6">${segs}${marks}<rect x="${kx - 23 * sc}" y="${ky - 15 * sc}" width="${46 * sc}" height="${30 * sc}" fill="none" stroke="#a33" stroke-width="2"/><text x="${kx}" y="${ky}" font-size="12" text-anchor="middle">Knesset</text></svg>`;
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe'
});
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.setContent(html);
await page.screenshot({ path: 'test-results/qa/track-lab.png' });
await browser.close();
