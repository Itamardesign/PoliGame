// Course content shared by the simulation and the renderer: every racer sees the same pickups and hazards.

// Moving spin balls ("ball") and bonus gates ("gate"), placed by lap fraction u.
export const ENCOUNTERS = [
  { id: 'ballot', kind: 'ball', u: 0.075 },
  { id: 'gate', kind: 'gate', u: 0.3 },
  { id: 'market', kind: 'ball', u: 0.6 },
  { id: 'prize', kind: 'gate', u: 0.7 },
  { id: 'final', kind: 'ball', u: 0.89 }
];

export function encountersFor(levelId = 'jerusalem') {
  if (levelId === 'market')
    return [
      ...ENCOUNTERS,
      { id: 'market-entry', kind: 'ball', u: 0.43 },
      { id: 'market-exit', kind: 'ball', u: 0.78 }
    ].sort((a, b) => a.u - b.u);
  if (levelId === 'midnight')
    return [
      ...ENCOUNTERS,
      { id: 'night-1', kind: 'ball', u: 0.18 },
      { id: 'night-2', kind: 'ball', u: 0.42 },
      { id: 'night-3', kind: 'ball', u: 0.78 }
    ].sort((a, b) => a.u - b.u);
  return ENCOUNTERS;
}

export function encounterAt(e, time, lap = 0) {
  return e.kind === 'ball'
    ? { x: Math.sin(time * 1.3 + e.u * 19) * 6.8, radius: 1.8 }
    : { x: ((lap + Math.round(e.u * 10)) % 2 ? 1 : -1) * 5.6, radius: 2.1 };
}

// Pickup radius by type; coins widen under a magnet.
export const PICKUP_RADIUS = { coin: 1.6, box: 1.6, ramp: 2.5, boost: 1.8, barrier: 1.45 };
// Seconds a collected ballot box or ballot slip stays gone.
export const RESPAWN = { coin: 7, box: 2.2 };

export function layoutPickups(length, bend = () => 0) {
  const list = [];
  const add = (type, s, x) => list.push({ type, s, x, hiddenUntil: -1 });
  for (let s = 35; s < length; s += 67) for (const x of [-6.5, 0, 6.5]) add('box', s, x);
  for (let s = 19; s < length; s += 28)
    for (let j = 0; j < 3; j++) add('coin', s + j * 3.5, Math.sin(s * 0.06) * 6.2);
  for (let s = 68; s < length; s += 84) add('barrier', s, Math.sin(s * 0.2) * 6.2);
  for (let s = 95; s < length; s += 150) add('boost', s, Math.sign(bend(s) || 1) * -7.3);
  for (const u of [0.33, 0.73]) add('ramp', length * u, 0);
  return list;
}
