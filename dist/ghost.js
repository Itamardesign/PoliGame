// Time-trial ghosts: the player's run sampled 20 times a second, saved per course, and replayed
// as a translucent kart. Samples carry everything the kart animation needs to look alive.
const RATE = 20;
const KEYS = [
  's',
  'x',
  'steer',
  'drifting',
  'air',
  'airTotal',
  'boost',
  'route',
  'routeDistance',
  'speed',
  'lateral'
];

export function makeRecorder(routes = []) {
  let clock = 0;
  const frames = [];
  return {
    record(racer, time) {
      if (time < clock) return;
      clock = time + 1 / RATE;
      frames.push([
        +racer.s.toFixed(2),
        +racer.x.toFixed(2),
        +racer.steer.toFixed(2),
        racer.drifting ? 1 : 0,
        +racer.air.toFixed(2),
        +racer.airTotal.toFixed(2),
        +racer.boost.toFixed(2),
        racer.routeId ? routes.findIndex(r => r.id === racer.routeId) : -1,
        +racer.routeDistance.toFixed(2),
        +racer.speed.toFixed(1),
        +racer.lateral.toFixed(1)
      ]);
    },
    finish(time, party, laps = []) {
      return { version: 1, time, party, laps, rate: RATE, frames };
    }
  };
}

// A racer-shaped object at a moment of the recorded run (linear interpolation between samples).
export function sampleGhost(ghost, time, routes = []) {
  const f = ghost.frames;
  if (!f.length) return null;
  const at = Math.min(f.length - 1.001, Math.max(0, time * ghost.rate)),
    i = Math.floor(at),
    k = at - i,
    a = f[i],
    b = f[Math.min(f.length - 1, i + 1)];
  const lerp = n => a[n] + (b[n] - a[n]) * k;
  const sameRoute = a[7] === b[7];
  const r = {};
  KEYS.forEach((key, n) => (r[key] = n === 3 || n === 7 ? a[n] : lerp(n)));
  r.drifting = !!a[3];
  r.routeId = a[7] >= 0 ? (routes[a[7]]?.id ?? null) : null;
  if (!sameRoute) r.routeDistance = a[8];
  r.finished = time * ghost.rate >= f.length - 1;
  r.stun = 0;
  r.trick = false;
  r.hop = 0;
  r.player = false;
  return r;
}

export function loadGhost(read, levelId) {
  try {
    const g = JSON.parse(read('ck-ghost-' + levelId, '') || 'null');
    return g?.version === 1 && Array.isArray(g.frames) ? g : null;
  } catch {
    return null;
  }
}
