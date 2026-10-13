// Rival drivers. Each AI produces the same inputs a player would (steer, drift, items) and is
// simulated by the same physics, so rivals obey the same rules: corners push them wide, hazards
// spin them, drifts charge boosts and ballots raise their top speed.
import { encountersFor, encounterAt } from './race-course.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const EDGE = 8.4;

// One temperament per leader. line: how tight the racing line is; drift: highest drift tier the
// driver holds for; aggression: rams and targets the leader; block: covers the line of whoever is
// right behind; greed: detours for ballots and boxes; risk: chance of missing a hazard; patience:
// how long items are saved for a better moment.
export const PERSONALITIES = [
  {
    id: 'tactician',
    line: 0.92,
    drift: 3,
    aggression: 0.45,
    block: 0.9,
    greed: 0.5,
    risk: 0.18,
    patience: 0.9
  },
  { id: 'anchor', line: 0.97, drift: 3, aggression: 0.2, block: 0.3, greed: 0.45, risk: 0.12, patience: 0.5 },
  {
    id: 'charger',
    line: 0.86,
    drift: 2,
    aggression: 0.85,
    block: 0.2,
    greed: 0.35,
    risk: 0.3,
    patience: 0.2
  },
  { id: 'wall', line: 0.88, drift: 2, aggression: 0.6, block: 0.75, greed: 0.3, risk: 0.22, patience: 0.6 },
  {
    id: 'collector',
    line: 0.84,
    drift: 2,
    aggression: 0.3,
    block: 0.35,
    greed: 0.95,
    risk: 0.2,
    patience: 0.4
  },
  { id: 'hothead', line: 0.8, drift: 3, aggression: 1, block: 0.4, greed: 0.4, risk: 0.4, patience: 0.1 }
];

// Difficulty scales awareness and drift quality on top of each temperament.
const SHARPNESS = { normal: 0.78, hard: 0.9, insane: 1 };
// How often rivals commit to a drift in a corner, and the best boost tier they will charge.
const DRIFT_RATE = { normal: 0.5, hard: 0.8, insane: 1 };
const DRIFT_TIER = { normal: 1, hard: 2, insane: 3 };

export function makeBrain(id, random) {
  return {
    personality: PERSONALITIES[id] ?? PERSONALITIES[0],
    lane: (random() - 0.5) * 3,
    laneClock: 2 + random() * 4,
    wobble: 0,
    drifting: false,
    noticed: new Map(),
    itemHeld: 0,
    trickDone: false,
    shortcutPlan: new Map()
  };
}

function bendAhead(race, r, from, to, step = 6) {
  let sum = 0,
    n = 0;
  for (let d = from; d <= to; d += step) {
    sum += race.bend(r.s + d);
    n++;
  }
  return sum / n;
}

// Each hazard is noticed once per pass; whether the driver sees it depends on sharpness and risk.
function notices(race, r, key) {
  const brain = r.brain;
  if (!brain.noticed.has(key)) {
    const sharp = SHARPNESS[race.difficulty] ?? 0.8;
    brain.noticed.set(key, race.random() > brain.personality.risk * (1.25 - sharp));
    if (brain.noticed.size > 40) brain.noticed.delete(brain.noticed.keys().next().value);
  }
  return brain.noticed.get(key);
}

function rankOf(race, r) {
  let rank = 1;
  for (const o of race.racers) if (o !== r && (o.finish !== null || o.s > r.s)) rank++;
  return rank;
}

function chooseLine(race, r, dt) {
  const brain = r.brain,
    P = brain.personality,
    sharp = SHARPNESS[race.difficulty] ?? 0.8,
    lap = Math.floor(Math.max(0, r.s) / race.length);
  brain.laneClock -= dt;
  if (brain.laneClock <= 0) {
    brain.lane = (race.random() - 0.5) * 4;
    brain.laneClock = 2.5 + race.random() * 4;
  }
  // Racing line: drift wide before a corner, clip the inside through it.
  const near = bendAhead(race, r, 4, 16),
    far = bendAhead(race, r, 20, 40, 10);
  const apex = -Math.sign(near) * clamp(Math.abs(near) / 0.022, 0, 1) * 6.2 * P.line;
  const setup =
    Math.sign(far) * clamp(Math.abs(far) / 0.03, 0, 1) * 3 * (1 - clamp(Math.abs(near) / 0.012, 0, 1));
  let x = apex + setup + brain.lane * (1 - clamp(Math.abs(near) / 0.015, 0, 1));
  let committed = false;

  // Shortcuts: line up on the hidden entrance if this driver has decided to take it this lap.
  for (const route of race.routes) {
    const gate = lap * race.length + route.start,
      d = gate - r.s;
    if (d < 0 || d > 55) continue;
    const key = route.id + lap;
    if (!brain.shortcutPlan.has(key))
      brain.shortcutPlan.set(
        key,
        race.random() < 0.25 + 0.5 * sharp * P.line - (race.difficulty === 'normal' ? 0.15 : 0)
      );
    if (brain.shortcutPlan.get(key)) {
      x = route.entryX;
      committed = true;
    }
  }

  // Detour for a ballot box, a slip or a bonus gate when it is cheap to do so.
  if (!committed) {
    let best = null;
    for (const p of race.pickups) {
      if (p.hiddenUntil > race.time) continue;
      if (p.type === 'box' && r.item) continue;
      if (p.type !== 'box' && p.type !== 'coin' && p.type !== 'boost') continue;
      const d = (((p.s - r.s) % race.length) + race.length) % race.length;
      if (d < 3 || d > 32) continue;
      const cost = Math.abs(p.x - x) / 6 + d / 60,
        value = (p.type === 'box' ? 1.1 : p.type === 'boost' ? 0.9 : 0.55) * P.greed;
      if (value - cost * 0.6 > 0.15 && (!best || value - cost > best.score))
        best = { x: p.x, score: value - cost };
    }
    for (const e of encountersFor(race.levelId)) {
      if (e.kind !== 'gate' || r.routeId) continue;
      const d = (((e.u * race.length - r.s) % race.length) + race.length) % race.length;
      if (d > 3 && d < 40 && P.greed > 0.3 && notices(race, r, 'gate' + e.id + lap)) {
        const g = encounterAt(e, race.time, lap);
        best = { x: g.x, score: 2 };
      }
    }
    if (best) x = best.x;
  }

  // Racecraft: overtake around a slower car, draft, block the one behind, ram while boosting.
  if (r.boost <= 0) brain.ram = null;
  else brain.ram ??= race.random() < P.aggression * 0.2;
  const partner = race.coalition?.has(r.id),
    player = race.racers.find(o => o.player);
  for (const o of race.racers) {
    if (o === r || o.finish !== null || o.routeId) continue;
    const gap = o.s - r.s,
      dx = o.x - x,
      friend = partner && race.coalition.has(o.id);
    if (
      gap > 0 &&
      gap < (r.boost > 0 ? 16 : 9) &&
      Math.abs(dx) < 2.4 &&
      r.speed > o.speed - 0.5 &&
      !brain.ram
    )
      x = o.x + (o.x > 0 ? -2.8 : 2.8);
    else if (gap > 4 && gap < 16 && Math.abs(dx) < 4 && r.boost <= 0) x += dx * 0.35;
    if (brain.ram && gap > 1 && gap < 14 && !friend) x = o.x;
    if (
      gap < -3 &&
      gap > -14 &&
      !friend &&
      P.block > 0.5 &&
      rankOf(race, r) <= 3 &&
      (o.player || P.block > 0.85)
    )
      x += (o.x - x) * 0.45 * P.block;
    // A coalition partner just behind the player sits on the line of whoever is chasing them.
    if (
      partner &&
      player &&
      !friend &&
      player.s - r.s > 0 &&
      player.s - r.s < 18 &&
      o.s < player.s &&
      o.s > r.s - 10
    )
      x += (o.x - x) * 0.6;
  }

  // Occasional lapses keep the pack from looking robotic; a leaked headline over the windscreen
  // makes one certain.
  if (brain.wobble > 0) {
    brain.wobble -= dt;
    x += Math.sin(race.time * 5 + r.id) * 3.2;
  } else if (r.blind > 0) {
    x += Math.sin(race.time * 3.3 + r.id) * 1.6;
  } else if (race.random() < dt * 0.07 * (1.2 - sharp) * (1 + P.risk))
    brain.wobble = 0.5 + race.random() * 0.7;
  x = clamp(x, -EDGE, EDGE);

  // Last word goes to safety: among a few candidate lines, take the one closest to the plan that
  // clears every noticed barrier and spin ball arriving within the next ~1.4 seconds.
  if (brain.wobble <= 0 && !r.routeId) {
    // Blinded drivers still react, just late.
    const reach = (6 + Math.max(r.speed, 20) * 1.4) * (r.blind > 0 ? 0.55 : 1),
      hazards = [];
    for (const p of race.pickups) {
      if (p.type !== 'barrier') continue;
      const d = (((p.s - r.s) % race.length) + race.length) % race.length;
      if (d > 1.5 && d < reach && notices(race, r, 'b' + p.s + lap)) hazards.push({ x: p.x, clear: 3.1, d });
    }
    if (r.item)
      for (const c of race.checkpoints ?? []) {
        const d = (((c.s - r.s) % race.length) + race.length) % race.length;
        if (d > 1.5 && d < reach) hazards.push({ x: (c.x0 + c.x1) / 2, clear: (c.x1 - c.x0) / 2 + 1.4, d });
      }
    for (const drop of race.drops ?? []) {
      const d = drop.s - r.s;
      if (d > 1.5 && d < reach && notices(race, r, 'd' + drop.id)) hazards.push({ x: drop.x, clear: 3, d });
    }
    for (const e of encountersFor(race.levelId)) {
      if (e.kind !== 'ball') continue;
      const d = (((e.u * race.length - r.s) % race.length) + race.length) % race.length;
      if (d < 1.5 || d > reach) continue;
      const ball = encounterAt(e, race.time + d / Math.max(r.speed, 12), lap);
      // Pass just outside the ball: a close dodge is worth a mini boost.
      if (notices(race, r, 'e' + e.id + lap)) hazards.push({ x: ball.x, clear: 3.5, d });
    }
    if (hazards.length) {
      const candidates = [x, -EDGE, EDGE, 0, r.x];
      for (const h of hazards) candidates.push(h.x - h.clear, h.x + h.clear);
      let best = x,
        bestCost = Infinity;
      for (const c of candidates) {
        if (c < -EDGE || c > EDGE) continue;
        let cost = Math.abs(c - x) * 0.4 + Math.abs(c - r.x) * 0.25;
        for (const h of hazards) {
          // Where the kart can actually be when it reaches the hazard, given its sideways speed.
          const move = Math.max(0, h.d / Math.max(r.speed, 12) - 0.12) * 8.5,
            arrive = r.x + clamp(c - r.x, -move, move);
          if (Math.abs(arrive - h.x) < h.clear) cost += 40 / (1 + h.d / 25);
        }
        if (cost < bestCost) {
          bestCost = cost;
          best = c;
        }
      }
      x = best;
    }
  }

  return { x: r.routeId ? 0 : clamp(x, -EDGE, EDGE), committed };
}

function decideItem(race, r, dt) {
  const brain = r.brain,
    P = brain.personality;
  if (!r.item) {
    brain.itemHeld = 0;
    return false;
  }
  brain.itemHeld += dt;
  const rank = rankOf(race, r),
    impatience = brain.itemHeld > 3 + P.patience * 10;
  const curve = Math.abs(bendAhead(race, r, 0, 20, 10));
  switch (r.item) {
    case 'boost':
      return curve < 0.01 || rank >= 4 || impatience;
    case 'magnet':
      return r.coins < 8 || impatience;
    case 'shield': {
      const incoming = race.projectiles.some(p => p.to === r.id);
      const threat = race.racers.some(o => o !== r && o.boost > 0 && r.s - o.s > 0 && r.s - o.s < 12);
      return incoming || threat || brain.itemHeld > 6 + P.patience * 14;
    }
    case 'poll': {
      const ahead = race.racers.filter(o => o !== r && o.finish === null && o.s > r.s && o.s - r.s < 160);
      if (!ahead.length) return false;
      // Tacticians wait until the shot lands on the race leader or the player.
      const target = ahead.reduce((a, b) => (b.s < a.s ? b : a));
      return target.player || rank === 2 || P.patience < 0.5 || impatience;
    }
    case 'noconf':
      return rank > 1;
    case 'leak':
      return rank > 1 || impatience;
    case 'spin': {
      const target = race.racers.some(o => o !== r && o.finish === null && o.s > r.s && o.s - r.s < 80);
      return target && (P.patience < 0.6 || rank <= 3 || impatience);
    }
    case 'budget':
      return race.racers.some(o => o !== r && o.s > r.s && o.s - r.s < 55 && o.coins >= 3) || impatience;
    case 'filibuster': {
      // Drop it on someone's line: wait for a rival close behind.
      const chaser = race.racers.some(o => o !== r && o.finish === null && r.s - o.s > 4 && r.s - o.s < 30);
      return chaser || brain.itemHeld > 8 + P.patience * 10;
    }
    default:
      return impatience || race.random() < 0.01 + P.aggression * 0.01;
  }
}

function decideAbility(race, r) {
  if (r.ability < 1 || r.stun > 0 || r.air > 0) return false;
  const rank = rankOf(race, r),
    near = (lo, hi) =>
      race.racers.some(o => o !== r && o.finish === null && o.s - r.s > lo && o.s - r.s < hi);
  switch (r.id) {
    case 0:
      return rank > 1 || near(-12, 0);
    case 1:
      return near(10, 200);
    case 2:
      return near(-25, -4);
    case 3:
      return Math.abs(bendAhead(race, r, 0, 30, 10)) < 0.012;
    case 4:
      return r.coins < 6;
    case 5:
      return near(2, 35);
    default:
      return true;
  }
}

// Returns the input for one AI frame. `curve` is the bend under the kart (route-aware).
export function aiInput(race, r, dt, curve) {
  const brain = r.brain,
    P = brain.personality,
    sharp = SHARPNESS[race.difficulty] ?? 0.8;
  const { x: target } = chooseLine(race, r, dt);
  brain.target = target;
  const near = r.routeId ? curve : bendAhead(race, r, 0, 12);

  // Drift through real corners and release at the tier this driver is confident holding.
  const wantDrift =
    P.drift > 0 &&
    !r.routeId &&
    r.air <= 0 &&
    r.speed > 24 &&
    Math.abs(near) > 0.0125 &&
    Math.abs(r.x) < EDGE - 0.5;
  const tierGoal = clamp(Math.min(P.drift, DRIFT_TIER[race.difficulty] ?? 2), 1, 3);
  const releaseAt = [0.9, 1.75, 2.55][tierGoal - 1] * (0.92 + (1 - sharp) * 0.3);
  // Each corner gets one decision: drift through it or take it on grip.
  if (!wantDrift) brain.cornerPlan = null;
  else brain.cornerPlan ??= race.random() < (DRIFT_RATE[race.difficulty] ?? 0.7);
  if (brain.drifting) {
    if (!wantDrift || r.charge >= releaseAt) brain.drifting = false;
  } else if (wantDrift && brain.cornerPlan && r.charge === 0 && race.random() < dt * 6 * sharp)
    brain.drifting = true;

  const drifting = brain.drifting,
    grip = drifting ? 8.8 : 11.4,
    centrifugal = drifting ? 1.8 : 3.5,
    gain = grip * (0.72 + Math.min(r.speed, 45) / 110);
  const wantLateral = clamp((target - r.x) * 2.4, -10, 10);
  let steer = clamp((wantLateral - curve * r.speed * centrifugal) / gain, -1, 1);
  if (drifting && Math.abs(steer) < 0.15) steer = (Math.sign(steer) || -Math.sign(near) || 1) * 0.15;

  // A trick on every jump for sharp drivers, sometimes for the rest.
  let trick = false;
  if (r.air > 0) {
    if (!brain.trickDone && r.air < r.airTotal * 0.7 && race.random() < 0.6 + sharp * 0.4) trick = true;
    brain.trickDone = true;
  } else brain.trickDone = false;

  return {
    steer,
    drift: (drifting && r.air <= 0) || trick,
    accelerate: true,
    brake: false,
    useItem: decideItem(race, r, dt),
    useAbility: decideAbility(race, r),
    aggression: P.aggression
  };
}
