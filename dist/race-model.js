import { makeBrain, aiInput } from './race-ai.js';
import { layoutPickups, layoutCheckpoints, PICKUP_RADIUS, RESPAWN } from './race-course.js';
import {
  grantItem,
  useItem,
  useAbility,
  stepProjectiles,
  stepDrops,
  chargeFromEvent,
  STATS
} from './race-items.js';
export { grantItem, useItem, useAbility, STATS };
export const LAPS = 3;
export const ROAD = Object.freeze({ halfWidth: 10, driveEdge: 9.7, maxOffset: 14.5 });
export const SECTORS = [
  { name: 'שדרות הכנסת', color: '#40c9df', start: 0 },
  { name: 'גשר ההבטחות', color: '#9976ed', start: 0.23 },
  { name: 'שוק הקואליציה', color: '#f29c55', start: 0.48 },
  { name: 'פארק הספינים', color: '#a1d65d', start: 0.76 }
];
export function sectorAt(s, length) {
  const u = (((s / length) % 1) + 1) % 1;
  return SECTORS.findLastIndex(section => u >= section.start);
}
export const PARTIES = [
  {
    id: 'likud',
    name: 'הליכוד',
    leader: 'בנימין נתניהו',
    short: 'ביבי',
    ride: 'ביבי־בולט',
    tag: 'לימוזינה קטנה. תוכניות גדולות.',
    color: '#2875df',
    accent: '#b7dcff',
    hair: '#b7bdc2',
    skin: '#edbb96',
    style: 'limo',
    logo: 'likud.png'
  },
  {
    id: 'together',
    name: 'ביחד',
    leader: 'נפתלי בנט',
    short: 'בנט',
    ride: 'אקזיט GT',
    tag: 'שישה מנדטים הספיקו פעם. עכשיו עם טורבו.',
    color: '#2fbfb8',
    accent: '#c9f5f1',
    hair: '#6e5945',
    skin: '#eabb9b',
    style: 'sport',
    logo: 'together.png'
  },
  {
    id: 'democrats',
    name: 'הדמוקרטים',
    leader: 'יאיר גולן',
    short: 'גולן',
    ride: 'דמוקרטי־קארט',
    tag: 'לוקחים את הפנייה ביחד.',
    color: '#df454f',
    accent: '#ffb2b7',
    hair: '#797a72',
    skin: '#e4ad89',
    style: 'buggy',
    logo: 'democrats.svg'
  },
  {
    id: 'beytenu',
    name: 'ישראל ביתנו',
    leader: 'אביגדור ליברמן',
    short: 'ליברמן',
    ride: 'ביתנו אקספרס',
    tag: 'בלי מו״מ. עם הרבה מומנט.',
    color: '#ed9941',
    accent: '#ffda92',
    hair: '#858078',
    skin: '#e4b291',
    style: 'muscle',
    logo: 'beytenu.webp'
  },
  {
    id: 'shas',
    name: 'ש״ס',
    leader: 'אריה דרעי',
    short: 'דרעי',
    ride: 'ש״ס טורבו',
    tag: 'כל הדרך לכיסא. עם כיסא מפואר.',
    color: '#a377df',
    accent: '#e4d2ff',
    hair: '#d0c9bc',
    skin: '#cfa17f',
    style: 'royal',
    logo: 'shas.png'
  },
  {
    id: 'otzma',
    name: 'עוצמה יהודית',
    leader: 'איתמר בן גביר',
    short: 'בן גביר',
    ride: 'עוצמה 4×4',
    tag: 'עוד פנייה. עוד קצת גז.',
    color: '#71a753',
    accent: '#d4eca8',
    hair: '#4b3729',
    skin: '#ebbe96',
    style: 'offroad',
    logo: 'otzma.png'
  },
  {
    id: 'yashar',
    name: 'ישר!',
    leader: 'גדי איזנקוט',
    short: 'איזנקוט',
    ride: 'ג׳יפ המטכ״ל',
    tag: 'קו ישר. בלי פיתולים.',
    color: '#58b4f0',
    accent: '#d4ecff',
    hair: '#b8b6b2',
    skin: '#e2a890',
    style: 'command',
    logo: 'yashar.png'
  },
  {
    id: 'rz',
    name: 'הציונות הדתית',
    leader: 'בצלאל סמוטריץ׳',
    short: 'סמוטריץ׳',
    ride: 'טרקטור האוצר',
    tag: 'שר האוצר מחזיק את ההגה. ואת הארנק.',
    color: '#e3bd3a',
    accent: '#fff0b0',
    hair: '#4a3a2c',
    skin: '#dca286',
    style: 'tractor',
    logo: 'rz.png'
  }
];
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export function rng(seed) {
  let n = seed >>> 0;
  return () => {
    n += 0x6d2b79f5;
    let t = Math.imul(n ^ (n >>> 15), n | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Rival pace per difficulty, added to the shared base speed. Catch-up keeps the pack in reach:
// rivals far behind get a little extra, rivals far ahead ease off.
export const PACE = { normal: -1.6, hard: 0.2, insane: 1.7 };
export const CATCH_UP = { normal: 1, hard: 0.8, insane: 0.6 };
const BASE_SPEED = 32;
const TIMERS = [
  'boost',
  'shield',
  'stun',
  'hitCooldown',
  'magnet',
  'hop',
  'slipCooldown',
  'blind',
  'confused',
  'star',
  'abilityActive'
];

export function makeRace(
  party = 0,
  difficulty = 'normal',
  seed = Date.now(),
  length = 760,
  routes = [],
  levelId = 'jerusalem',
  options = {}
) {
  const random = rng(seed);
  // A time trial races alone; everything else runs the full field of eight.
  const order = options.solo ? [party] : [party, ...PARTIES.map((_, i) => i).filter(i => i !== party)];
  const bend = options.bend ?? (() => 0);
  const race = {
    time: 0,
    length,
    difficulty,
    levelId,
    random,
    routes,
    bend,
    // Solid sides (bridge rails, crowd barriers): distance from the centre line, or null.
    walls: options.walls ?? (() => null),
    pickups: options.pickups === false ? [] : layoutPickups(length, bend, options.height),
    checkpoints: options.pickups === false ? [] : layoutCheckpoints(length),
    events: [],
    eventSeq: 0,
    projectiles: [],
    drops: [],
    dropSeq: 0,
    // Grand Prix: parties allied with the player, and the handicaps their demands impose.
    coalition: new Set(options.coalition ?? []),
    handicap: options.handicap ?? {},
    trial: !!options.solo,
    boxes: 0,
    done: false,
    used: 0,
    drifts: 0,
    jumps: 0,
    shortcuts: 0,
    racers: order.map((id, i) => ({
      id,
      player: i === 0,
      s: -i * 4,
      prevS: -i * 4,
      speed: 0,
      x: (i % 2 ? 1 : -1) * 3.3,
      steer: 0,
      lateral: 0,
      routeId: null,
      routeDistance: 0,
      routeLap: 0,
      routeJumped: false,
      air: 0,
      airTotal: 1,
      trick: false,
      hop: 0,
      magnet: 0,
      slipstream: 0,
      slipCooldown: 0,
      boost: 0,
      shield: 0,
      stun: 0,
      charge: 0,
      drifting: false,
      lastDrift: false,
      item: null,
      coins: 0,
      votes: 0,
      finish: null,
      projected: null,
      hitCooldown: 0,
      blind: 0,
      confused: 0,
      star: 0,
      ability: 0,
      abilityActive: 0,
      stats: STATS[id],
      skill: 0.985 + random() * 0.03,
      brain: i === 0 ? null : makeBrain(id, random)
    }))
  };
  const slot = Math.min(race.handicap.gridSlot ?? 0, race.racers.length - 1);
  if (slot > 0) {
    // The player gives up pole: swap grid slots with the car on the slot the demand names.
    const p = race.racers[0],
      last = race.racers[slot];
    [p.s, last.s] = [last.s, p.s];
    [p.prevS, last.prevS] = [last.prevS, p.prevS];
    [p.x, last.x] = [last.x, p.x];
  }
  return race;
}
// Coalition partners (and the player) do not target each other on purpose.
export const allied = (race, a, b) => a !== b && race.coalition.has(a.id) && race.coalition.has(b.id);
export function ranking(race) {
  const time = r => r.finish ?? r.projected;
  return [...race.racers].sort((a, b) =>
    time(a) !== null && time(b) !== null
      ? time(a) - time(b)
      : time(a) !== null
        ? -1
        : time(b) !== null
          ? 1
          : b.s - a.s
  );
}
export function emitRace(race, type, racer, data = {}) {
  const event = {
    seq: ++race.eventSeq,
    type,
    id: racer.id,
    player: racer.player,
    s: racer.s,
    x: racer.x,
    ...data
  };
  race.events.push(event);
  if (race.events.length > 120) race.events.shift();
  chargeFromEvent(race, racer, type, data);
  return event;
}
export function launch(race, racer, airTime = 1.05) {
  if (racer.air > 0) return;
  racer.air = racer.airTotal = airTime;
  racer.trick = false;
  race.jumps += racer.player ? 1 : 0;
  emitRace(race, 'jump', racer);
}
export function hitRacer(racer, race = null, cause = 'hazard') {
  if (racer.hitCooldown > 0 || racer.star > 0) return false;
  racer.hitCooldown = 1.5;
  if (racer.shield > 0) {
    racer.shield = 0;
    if (race) emitRace(race, 'shield-break', racer);
    return false;
  }
  racer.stun = 1.25;
  racer.speed *= 0.5;
  racer.charge = 0;
  racer.drifting = false;
  if (race) {
    emitRace(race, 'hit', racer, { cause });
    loseBallots(race, racer);
  }
  return true;
}
// A spin shakes loose up to three carried slips: the speed they gave is gone (the votes stay).
export function loseBallots(race, racer, count = 3) {
  const lost = Math.min(count, racer.coins);
  if (!lost) return 0;
  racer.coins -= lost;
  emitRace(race, 'ballots-lost', racer, { count: lost });
  return lost;
}
// Rivals' starts vary: the sharper the field, the more of them nail the launch.
export function startRace(race, playerLaunch = false) {
  for (const r of race.racers) {
    const good = r.player
      ? playerLaunch
      : race.random() < { normal: 0.35, hard: 0.55, insane: 0.75 }[race.difficulty] * r.skill;
    if (!good) continue;
    // A rotation agreement weakens or cancels the player's launch.
    const scale = r.player ? (race.handicap.launchScale ?? 1) : 1;
    if (scale > 0) {
      r.boost = Math.max(r.boost, 1.9 * scale);
      emitRace(race, 'launch-boost', r, scale < 1 ? { weak: true, by: race.handicap.owners?.launch } : {});
    } else emitRace(race, 'launch-blocked', r, { by: race.handicap.owners?.launch });
  }
}
// Distance-based finish estimate for drivers still on track when the player crosses the line.
function project(race) {
  for (const r of race.racers)
    if (r.finish === null)
      r.projected = race.time + (race.length * LAPS - r.s) / Math.max(r.speed, BASE_SPEED * 0.85);
}

function collect(race, r, p) {
  if (p.type === 'coin') {
    // A ballot slip is a vote: it always counts, and up to ten carried raise top speed.
    p.hiddenUntil = race.time + RESPAWN.coin;
    r.coins = Math.min(10, r.coins + 1);
    r.votes++;
    emitRace(race, 'pickup', r, { count: r.coins, votes: r.votes });
  } else if (p.type === 'box') {
    if (r.item) return;
    p.hiddenUntil = race.time + RESPAWN.box;
    // A partner's veto: every few boxes the player opens come up empty.
    if (r.player && race.handicap.vetoEvery && ++race.boxes % race.handicap.vetoEvery === 0)
      return void emitRace(race, 'veto', r, { by: race.handicap.owners?.veto });
    grantItem(race, r);
  } else if (p.type === 'ramp') launch(race, r);
  else if (p.type === 'crest') {
    // The faster over the top, the longer the flight.
    if (r.speed > 24) launch(race, r, Math.min(1.5, 0.75 + r.speed / 60));
  } else if (p.type === 'boost') {
    r.boost = Math.max(r.boost, 1.6);
    emitRace(race, 'boost-pad', r);
  } else if (p.type === 'barrier') hitRacer(r, race, 'barrier');
}

export function stepCheckpoints(race, r, before) {
  if (r.routeId || r.finish !== null || !r.item) return;
  for (const c of race.checkpoints) {
    const lap = Math.floor(Math.max(0, before) / race.length),
      at = c.s + lap * race.length;
    if (before < at && r.s >= at && r.x >= c.x0 && r.x <= c.x1) {
      const item = r.item;
      r.item = null;
      emitRace(race, 'confiscated', r, { item });
    }
  }
}
export function stepPickups(race, r, before) {
  if (r.routeId || r.finish !== null) return;
  const lapBefore = Math.floor(Math.max(0, before) / race.length),
    lapAfter = Math.floor(Math.max(0, r.s) / race.length);
  for (const p of race.pickups) {
    if (p.hiddenUntil > race.time) continue;
    const radius = p.type === 'coin' && r.magnet > 0 ? 8 : PICKUP_RADIUS[p.type];
    if (Math.abs(r.x - p.x) > radius) continue;
    for (let lap = lapBefore; lap <= lapAfter; lap++) {
      const target = p.s + lap * race.length;
      if (before <= target && r.s >= target && before !== r.s) {
        collect(race, r, p);
        break;
      }
    }
  }
}

function routeBendOf(race, r) {
  const route = r.routeId && race.routes.find(p => p.id === r.routeId);
  return route?.bend ? route.bend(r.routeDistance) : race.bend(r.s);
}

// After the player crosses the line the results are frozen, but karts keep rolling for the camera.
export function coastRace(race, dt) {
  for (const r of race.racers) {
    const target = r.finish !== null ? 17 : r.speed;
    r.speed += (target - r.speed) * -Math.expm1(-dt * 1.2);
    r.x += (0 - r.x) * -Math.expm1(-dt * 0.8);
    r.drifting = false;
    r.steer *= 0.9;
    r.boost = Math.max(0, r.boost - dt);
    r.air = Math.max(0, r.air - dt);
    if (r.routeId) {
      const route = race.routes.find(p => p.id === r.routeId);
      r.routeDistance = Math.min(route.length, r.routeDistance + r.speed * dt);
      if (r.routeDistance >= route.length) {
        r.routeId = null;
        r.x = route.exitX;
      }
    } else r.s += r.speed * dt;
  }
}

export function stepRace(race, dt, input = {}, curve = 0) {
  if (race.done) return;
  dt = clamp(dt, 0, 0.05);
  race.time += dt;
  stepProjectiles(race, dt);
  for (const p of race.pickups) if (p.hiddenUntil > 0 && p.hiddenUntil <= race.time) p.hiddenUntil = -1;
  const lead = race.racers.find(r => r.player) ?? race.racers[0];
  for (const r of race.racers) {
    if (r.finish !== null) {
      // Finished rivals roll on through the next lap at cruising pace.
      r.speed += (17 - r.speed) * -Math.expm1(-dt);
      r.s += r.speed * dt;
      r.x += (0 - r.x) * -Math.expm1(-dt);
      r.drifting = false;
      continue;
    }
    for (const k of TIMERS) r[k] = Math.max(0, r[k] - dt);
    const bendHere = r.player ? curve : routeBendOf(race, r);
    const control = r.player ? input : aiInput(race, r, dt, bendHere);
    if (!r.player && control.useItem) useItem(race, r);
    if (!r.player && control.useAbility) useAbility(race, r);
    const wasDrifting = r.drifting,
      before = r.s,
      wasAir = r.air > 0;
    r.prevS = before;
    if (wasAir) {
      r.air = Math.max(0, r.air - dt);
      if (control.drift && !r.lastDrift && !r.trick) {
        r.trick = true;
        emitRace(race, 'trick', r);
      }
      if (r.air === 0) {
        if (r.trick) r.boost = Math.max(r.boost, 1.8);
        emitRace(race, 'land', r, { trick: r.trick });
      }
    }
    const requested = clamp(control.steer || 0, -1, 1) * (r.confused > 0 ? -1 : 1),
      sensitivity = r.player ? clamp(control.sensitivity ?? 1, 0.65, 1.35) : 1;
    // Quick turn-in, smooth velocity, and stronger damping on release. No key-repeat dependency.
    r.steer += (requested - r.steer) * -Math.expm1(-dt * (requested === 0 ? 22 : 13));
    r.drifting =
      !!control.drift &&
      Math.abs(requested) > 0.1 &&
      r.speed > 15 &&
      !wasAir &&
      r.stun <= 0 &&
      Math.abs(r.x) < (r.routeId ? 2 : ROAD.driveEdge);
    const handling = r.stats?.grip ?? 0,
      grip = (r.drifting ? 8.8 : 11.4) + handling * 0.8;
    const desired =
      r.steer * grip * sensitivity * (0.72 + Math.min(r.speed, 45) / 110) +
      bendHere * r.speed * (r.drifting ? 1.8 : 3.5);
    r.lateral += (desired - r.lateral) * -Math.expm1(-dt * (requested === 0 ? 20 : 12));
    r.x = clamp(r.x + r.lateral * dt, -ROAD.maxOffset, ROAD.maxOffset);
    if (Math.abs(r.x) >= ROAD.maxOffset) r.lateral = 0;
    // Scraping a wall: pushed back inside, sideways speed bounces off, a little pace is lost.
    const wall = r.routeId ? null : race.walls(r.s);
    if (wall !== null && Math.abs(r.x) > wall) {
      const side = Math.sign(r.x);
      r.x = side * wall;
      if (r.lateral * side > 2.5) {
        r.speed *= 0.86;
        if ((r.wallCooldown ?? 0) <= race.time) {
          r.wallCooldown = race.time + 0.45;
          emitRace(race, 'wall', r, { side });
        }
      }
      if (r.lateral * side > 0) r.lateral = -r.lateral * 0.35;
      r.drifting = false;
    }
    if (r.drifting) {
      if (!wasDrifting) {
        r.hop = 0.23;
        emitRace(race, 'drift-start', r);
      }
      const tier = Math.floor(r.charge / 0.8);
      r.charge = clamp(r.charge + dt, 0, 3);
      if (Math.floor(r.charge / 0.8) > tier)
        emitRace(race, 'drift-charge', r, { tier: Math.min(3, Math.floor(r.charge / 0.8)) });
    }
    if (wasDrifting && !r.drifting) {
      if (r.charge > 0.65) {
        const scale = r.player ? (race.handicap.driftScale ?? 1) : 1;
        r.boost = Math.max(r.boost, (r.charge > 2.4 ? 3 : r.charge > 1.6 ? 1.9 : 1.1) * scale);
        if (r.player) race.drifts++;
        emitRace(race, 'drift-boost', r, { tier: r.charge > 2.4 ? 3 : r.charge > 1.6 ? 2 : 1 });
      }
      r.charge = 0;
    }

    const stats = r.stats ?? STATS[0];
    const ballots = Math.min(r.coins, r.player ? (race.handicap.ballotCap ?? 10) : 10);
    let target = BASE_SPEED + stats.top + ballots * stats.ballot;
    if (control.accelerate && !control.brake) target += 3;
    if (!r.player) {
      target += (PACE[race.difficulty] ?? PACE.normal) + (r.skill - 1) * 30;
      if (lead.player && lead.finish === null) {
        const gap = r.s - lead.s,
          k = CATCH_UP[race.difficulty] ?? 1;
        if (gap < -25) target += Math.min(3.2, ((-gap - 25) / 70) * 3.2) * k;
        if (gap > 20) target -= Math.min(3, ((gap - 20) / 90) * 3) * k;
      }
    }
    if (r.boost > 0) target += 13;
    if (r.star > 0) target += 6;
    if (r.stun > 0) target *= 0.4;
    if (Math.abs(r.x) > (r.routeId ? 2.1 : ROAD.driveEdge) && r.star <= 0)
      target *= r.routeId ? 0.65 : 0.48 + stats.offroad;
    if (control.brake) target *= 0.48;
    const pickup = target > r.speed ? 2.3 + stats.accel : 2.3;
    r.speed += (target - r.speed) * -Math.expm1(-dt * (control.brake ? 6 : pickup));
    const distance = r.speed * dt;
    if (r.routeId) {
      const route = race.routes.find(p => p.id === r.routeId);
      r.x = clamp(r.x, -route.width / 2, route.width / 2);
      r.routeDistance = Math.min(route.length, r.routeDistance + distance);
      r.s =
        r.routeLap * race.length + route.start + ((route.end - route.start) * r.routeDistance) / route.length;
      if (!r.routeJumped && r.routeDistance > route.length * 0.57) {
        r.routeJumped = true;
        launch(race, r);
      }
      if (r.routeDistance >= route.length) {
        r.routeId = null;
        r.x = clamp(route.exitX + r.x, -ROAD.driveEdge, ROAD.driveEdge);
        r.lateral = 0;
        emitRace(race, 'shortcut-exit', r, { route: route.id });
      }
    } else {
      r.s += distance;
      const lap = Math.floor(Math.max(0, before) / race.length);
      for (const route of race.routes) {
        const gate = lap * race.length + route.start;
        if (before < gate && r.s >= gate && Math.abs(r.x - route.entryX) < 2.1 && r.speed > 22) {
          r.routeId = route.id;
          r.routeDistance = 0;
          r.routeLap = lap;
          r.routeJumped = false;
          r.s = gate;
          r.x = 0;
          r.lateral = 0;
          r.drifting = false;
          r.charge = 0;
          if (r.player) race.shortcuts++;
          emitRace(race, 'shortcut-enter', r, { route: route.id });
          break;
        }
      }
      stepPickups(race, r, before);
      stepCheckpoints(race, r, before);
    }
    if (!r.routeId) {
      const drafting = race.racers.some(
        other =>
          other !== r &&
          other.s - r.s > 3 &&
          other.s - r.s < 18 &&
          Math.abs(other.x - r.x) < 1.8 &&
          !other.routeId
      );
      r.slipstream = clamp(r.slipstream + (drafting ? dt : -dt * 2), 0, 1.25);
      if (r.slipstream >= 1.25 && r.slipCooldown === 0) {
        r.boost = Math.max(r.boost, 1.7);
        r.slipCooldown = 4;
        r.slipstream = 0;
        emitRace(race, 'slipstream', r);
      }
    }
    r.lastDrift = !!control.drift;
    if (r.s >= race.length * LAPS) {
      // Interpolate the moment the line was crossed inside this step.
      r.finish = race.time - (r.s - race.length * LAPS) / Math.max(r.speed, 1);
      r.projected = r.finish;
      r.s = race.length * LAPS;
      emitRace(race, 'finish', r, { place: race.racers.filter(o => o.finish !== null).length });
    }
  }
  stepDrops(race);
  const player = race.racers.find(r => r.player) ?? race.racers[0];
  if (player.finish !== null) {
    player.s = race.length * LAPS;
    race.done = true;
    project(race);
  }
}
