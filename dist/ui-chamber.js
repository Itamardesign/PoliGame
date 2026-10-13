// The Knesset as a hemicycle of 120 seats. Seats fill from the right in the order of `blocs`,
// so a coalition reads as one contiguous arc that either crosses the 61st seat or doesn't.
const SEATS = 120,
  ROWS = 6,
  INNER = 0.42;

// Seat positions on a unit half-disc, sorted by angle (right to left).
const layout = (() => {
  const radii = Array.from({ length: ROWS }, (_, i) => INNER + ((1 - INNER) * (i + 0.5)) / ROWS);
  const total = radii.reduce((a, b) => a + b, 0);
  const counts = radii.map(r => Math.round((SEATS * r) / total));
  counts[ROWS - 1] += SEATS - counts.reduce((a, b) => a + b, 0);
  const seats = [];
  radii.forEach((r, row) => {
    const n = counts[row];
    for (let k = 0; k < n; k++) {
      const a = Math.PI * (n === 1 ? 0.5 : k / (n - 1));
      seats.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, a, row });
    }
  });
  return seats.sort((p, q) => p.a - q.a || q.row - p.row);
})();

// blocs: [{ color, seats, faded, ghost }] in seating order. Returns SVG markup.
export function chamberSVG(blocs, { label = '' } = {}) {
  const W = 200,
    H = 108,
    cx = W / 2,
    cy = 102,
    R = 96,
    dot = 3.3;
  const colors = [];
  for (const b of blocs) for (let i = 0; i < b.seats && colors.length < SEATS; i++) colors.push(b);
  const circles = layout
    .map((p, i) => {
      const b = colors[i];
      const fill = b ? b.color : 'rgba(255,255,255,0.12)';
      const opacity = b?.faded ? 0.35 : 1;
      // A party being considered is drawn pulsing, so the arc it would add is easy to read.
      return `<circle${b?.ghost ? ' class="ghost"' : ''} cx="${(cx + p.x * R).toFixed(2)}" cy="${(cy - p.y * R).toFixed(2)}" r="${dot}" fill="${fill}" opacity="${opacity}"/>`;
    })
    .join('');
  // Majority marker after the 61st seat: a tick at the angle where seat 61 sits.
  const m = layout[60],
    mx = cx + Math.cos(m.a) * (R + 7),
    my = cy - Math.sin(m.a) * (R + 7),
    ix = cx + Math.cos(m.a) * (R * INNER - 8),
    iy = cy - Math.sin(m.a) * (R * INNER - 8);
  return `<svg viewBox="0 0 ${W} ${H + 6}" role="img" aria-label="${label}">${circles}<line x1="${ix.toFixed(1)}" y1="${iy.toFixed(1)}" x2="${mx.toFixed(1)}" y2="${my.toFixed(1)}" stroke="#f2c14e" stroke-width="1.2" stroke-dasharray="2 2"/><text x="${mx.toFixed(1)}" y="${(my - 3).toFixed(1)}" fill="#f2c14e" font-size="8" font-weight="900" text-anchor="middle" font-family="Heebo, Arial">61</text></svg>`;
}
