// Campaign items, leader abilities and vehicle stats. Pure simulation: no rendering here.
import { emitRace, ranking, hitRacer, clamp, allied } from './race-model.js';

export const ITEMS = {
  boost: { name: 'טורבו הבטחות', short: 'טורבו', glyph: '↯' },
  shield: { name: 'חסינות', short: 'חסינות', glyph: '◉' },
  poll: { name: 'סקר מפתיע', short: 'סקר', glyph: '↝' },
  magnet: { name: 'מגנט מנדטים', short: 'מגנט', glyph: '∩' },
  leak: { name: 'הדלפה לעיתונות', short: 'הדלפה', glyph: '✎' },
  filibuster: { name: 'פיליבסטר', short: 'פיליבסטר', glyph: '▤' },
  spin: { name: 'ספין דוקטור', short: 'ספין', glyph: '↻' },
  budget: { name: 'העברה תקציבית', short: 'תקציב', glyph: '₪' },
  noconf: { name: 'הצבעת אי־אמון', short: 'אי־אמון', glyph: '⚖' }
};

// Weights by position: leaders get defensive items, the back of the pack gets the big guns.
const TABLE = [
  { shield: 30, filibuster: 30, magnet: 15, budget: 10, poll: 15 },
  { poll: 25, filibuster: 15, leak: 10, boost: 20, shield: 15, budget: 10, magnet: 5 },
  { poll: 25, filibuster: 10, leak: 10, boost: 25, shield: 10, budget: 15, magnet: 5 },
  { boost: 33, poll: 20, leak: 12, spin: 15, budget: 10, noconf: 5, magnet: 5 },
  { boost: 32, poll: 15, leak: 15, spin: 15, budget: 10, noconf: 8, magnet: 5 },
  { boost: 35, noconf: 15, spin: 15, leak: 15, budget: 10, poll: 10 }
];

export function grantItem(race, racer) {
  if (racer.item) return;
  // Time trials keep it clean: every box is a turbo.
  if (race.trial) {
    racer.item = 'boost';
    return void emitRace(race, 'item-get', racer, { item: 'boost' });
  }
  const rank = clamp(ranking(race).indexOf(racer), 0, TABLE.length - 1),
    weights = Object.entries(TABLE[rank]),
    total = weights.reduce((s, [, w]) => s + w, 0);
  let roll = race.random() * total;
  for (const [item, w] of weights) {
    roll -= w;
    if (roll <= 0) {
      racer.item = item;
      break;
    }
  }
  racer.item ??= 'boost';
  if (racer.player && racer.item === 'noconf' && race.handicap.noNoconf) racer.item = 'boost';
  emitRace(race, 'item-get', racer, { item: racer.item });
}

// Rivals never aim at their coalition partners; the player can, at a cost to loyalty.
const ahead = (race, racer, range) =>
  race.racers
    .filter(r => r !== racer && r.finish === null && r.s > racer.s && r.s - racer.s < range)
    .filter(r => racer.player || !allied(race, racer, r))
    .sort((a, b) => a.s - b.s);

export function useItem(race, racer) {
  if (!racer.item || race.done) return null;
  const item = racer.item;
  racer.item = null;
  if (racer.player) race.used++;
  if (item === 'boost') racer.boost = Math.max(racer.boost, 2.6);
  if (item === 'shield') racer.shield = 6;
  if (item === 'magnet') racer.magnet = 7;
  emitRace(race, 'item-use', racer, { item });
  if (item === 'poll') {
    // The poll flies to the closest rival ahead.
    const target = ahead(race, racer, 160)[0];
    if (target) {
      race.projectiles.push({ kind: 'poll', from: racer.id, to: target.id, remaining: 1.05, total: 1.05 });
      emitRace(race, 'poll-fired', racer, { target: target.id });
    } else emitRace(race, 'no-target', racer);
  }
  if (item === 'noconf') {
    // A no-confidence vote always goes for the race leader, wherever they are.
    const leader = ranking(race).find(r => r.finish === null);
    if (leader && leader !== racer) {
      race.projectiles.push({ kind: 'noconf', from: racer.id, to: leader.id, remaining: 1.9, total: 1.9 });
      emitRace(race, 'noconf-fired', racer, { target: leader.id });
    } else {
      racer.boost = Math.max(racer.boost, 2);
      emitRace(race, 'no-target', racer);
    }
  }
  if (item === 'leak') {
    // Headlines splash over every rival ahead within range; shields block it.
    for (const r of ahead(race, racer, 140).slice(0, 3)) {
      if (r.shield > 0) continue;
      r.blind = Math.max(r.blind, 2.8);
      emitRace(race, 'leaked', r, { from: racer.id });
    }
  }
  if (item === 'spin') {
    const target = ahead(race, racer, 90)[0];
    if (target && target.shield <= 0) {
      target.confused = Math.max(target.confused, 2.4);
      emitRace(race, 'spun', target, { from: racer.id });
    } else if (target) {
      target.shield = 0;
      emitRace(race, 'shield-break', target);
    } else emitRace(race, 'no-target', racer);
  }
  if (item === 'filibuster') dropBlock(race, racer, 'filibuster', [racer.x]);
  if (item === 'budget') {
    const target = ahead(race, racer, 60).find(r => r.coins > 0);
    if (target) {
      const amount = Math.min(4, target.coins);
      target.coins -= amount;
      racer.coins = Math.min(10, racer.coins + amount);
      racer.boost = Math.max(racer.boost, 0.8);
      emitRace(race, 'budget', racer, { target: target.id, amount });
    } else emitRace(race, 'no-target', racer);
  }
  return item;
}

// Roadblocks dropped behind a kart. They stay until hit or until they time out.
function dropBlock(race, racer, kind, xs, back = 5, life = 22) {
  for (const x of xs) {
    const drop = {
      id: ++race.dropSeq,
      kind,
      owner: racer.id,
      s: racer.s - back,
      x: clamp(x, -8.5, 8.5),
      until: race.time + life,
      armed: race.time + 0.6
    };
    race.drops.push(drop);
    emitRace(race, 'drop', racer, { drop: drop.id, kind, at: drop.s, dx: drop.x });
  }
}

export function stepProjectiles(race, dt) {
  for (const p of race.projectiles) {
    p.remaining -= dt;
    if (p.remaining > 0) continue;
    const target = race.racers.find(r => r.id === p.to);
    if (!target || target.finish !== null) continue;
    if (target.shield > 0 && p.kind !== 'noconf') {
      target.shield = 0;
      emitRace(race, 'shield-break', target);
      continue;
    }
    if (target.star > 0) continue;
    target.shield = 0;
    target.stun = p.kind === 'noconf' ? 2.2 : 1.8;
    target.charge = 0;
    target.drifting = false;
    if (p.kind === 'noconf') target.speed *= 0.3;
    emitRace(race, 'hit', target, { from: p.from, cause: p.kind });
    if (p.kind === 'noconf')
      for (const r of race.racers)
        if (r !== target && r.finish === null && Math.abs(r.s - target.s) < 7 && Math.abs(r.x - target.x) < 5)
          hitRacer(r, race, 'noconf');
  }
  race.projectiles = race.projectiles.filter(p => p.remaining > 0);
}

export function stepDrops(race) {
  race.drops = race.drops.filter(d => d.until > race.time);
  for (const d of race.drops) {
    if (d.hit || race.time < d.armed) continue;
    for (const r of race.racers) {
      if (r.finish !== null || r.routeId || r.air > 0) continue;
      if (r.prevS < d.s && r.s >= d.s && Math.abs(r.x - d.x) < 1.7) {
        d.hit = true;
        hitRacer(r, race, d.kind);
        emitRace(race, 'drop-hit', r, { drop: d.id, from: d.owner });
        break;
      }
    }
  }
  race.drops = race.drops.filter(d => !d.hit);
}

// Vehicle character. top: extra top speed; accel: faster pick-up; grip: steering grip;
// offroad: less grass slowdown; weight: who gets pushed in contact; ballot: speed per ballot.
export const STATS = [
  { top: 0.7, accel: -0.4, grip: -0.5, offroad: 0, weight: 1.35, ballot: 0.2 },
  { top: 0.65, accel: -0.05, grip: 0, offroad: -0.08, weight: 0.85, ballot: 0.2 },
  { top: -0.5, accel: 0.3, grip: 1, offroad: 0.12, weight: 0.8, ballot: 0.2 },
  { top: 0.2, accel: 0.5, grip: -0.7, offroad: 0, weight: 1.2, ballot: 0.2 },
  { top: -0.35, accel: 0, grip: 0.4, offroad: 0, weight: 1, ballot: 0.25 },
  { top: -0.35, accel: 0.2, grip: -0.2, offroad: 0.22, weight: 1.3, ballot: 0.2 }
];

// Display ratings 1-5 for the garage, derived from the numbers above.
export function statBars(id) {
  const s = STATS[id];
  const scale = (v, lo, hi) => clamp(Math.round(1 + ((v - lo) / (hi - lo)) * 4), 1, 5);
  return {
    speed: scale(s.top + (s.ballot - 0.2) * 10, -0.6, 1),
    accel: scale(s.accel, -0.5, 0.6),
    handling: scale(s.grip, -0.8, 1.1),
    offroad: scale(s.offroad, -0.1, 0.25),
    weight: scale(s.weight, 0.75, 1.4)
  };
}

// Each leader's signature move. Charged by clean driving, fired with E / the portrait button.
export const ABILITIES = [
  { id: 'immunity', name: 'חסינות־על', hint: 'בלתי פגיע · מעיף כל מי שבדרך' },
  { id: 'breaking', name: 'מהדורה מיוחדת', hint: 'כל מי שלפניך מסתנוור' },
  { id: 'protest', name: 'הפגנה', hint: 'שני מחסומי מחאה מאחוריך' },
  { id: 'resign', name: 'התפטרות', hint: 'יוצאים מהקואליציה… וחוזרים קדימה' },
  { id: 'funds', name: 'כספים קואליציוניים', hint: 'עשרה פתקים, מגנט וטורבו' },
  { id: 'siren', name: 'סירנה', hint: 'מפנה את הכביש לפניך' }
];

// Charge earned per event; a full meter is 1.
const CHARGE = {
  'drift-boost': 0.07,
  'near-miss': 0.08,
  jackpot: 0.1,
  land: 0.05,
  slipstream: 0.1,
  ram: 0.1,
  'launch-boost': 0.12,
  budget: 0.05
};
export function chargeFromEvent(race, racer, type, data) {
  if (racer.ability === undefined || racer.abilityActive > 0) return;
  let gain = CHARGE[type] ?? 0;
  if (type === 'drift-boost') gain *= data.tier ?? 1;
  if (type === 'land' && !data.trick) gain = 0;
  if (!gain) return;
  const before = racer.ability;
  racer.ability = Math.min(1, racer.ability + gain);
  if (before < 1 && racer.ability >= 1) emitRace(race, 'ability-ready', racer);
}

export function useAbility(race, racer) {
  if (racer.ability < 1 || race.done || racer.finish !== null || racer.stun > 0) return null;
  const ability = ABILITIES[racer.id];
  racer.ability = 0;
  racer.abilityActive = 1.2;
  emitRace(race, 'ability', racer, { ability: ability.id });
  if (ability.id === 'immunity') {
    racer.star = 4.5;
    racer.abilityActive = 4.5;
  }
  if (ability.id === 'breaking')
    for (const r of ahead(race, racer, 160).slice(0, 4)) {
      if (r.shield > 0 || r.star > 0) continue;
      r.blind = Math.max(r.blind, 2.6);
      emitRace(race, 'leaked', r, { from: racer.id, breaking: true });
    }
  if (ability.id === 'protest') dropBlock(race, racer, 'protest', [racer.x - 3.2, racer.x + 3.2], 6, 16);
  if (ability.id === 'resign' && !racer.routeId) {
    racer.s += 26;
    racer.boost = Math.max(racer.boost, 1);
    emitRace(race, 'warp', racer, { distance: 26 });
  }
  if (ability.id === 'funds') {
    racer.coins = 10;
    racer.magnet = Math.max(racer.magnet, 6);
    racer.boost = Math.max(racer.boost, 1.3);
  }
  if (ability.id === 'siren') {
    racer.boost = Math.max(racer.boost, 1.6);
    for (const r of ahead(race, racer, 40)) {
      if (Math.abs(r.x - racer.x) > 7 || r.star > 0) continue;
      const side = r.x >= racer.x ? 1 : -1;
      r.x = clamp(r.x + side * 4.5, -9.5, 9.5);
      r.lateral = side * 6;
      r.speed *= 0.82;
      emitRace(race, 'cleared', r, { from: racer.id });
    }
  }
  return ability.id;
}
