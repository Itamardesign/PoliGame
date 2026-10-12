import { emitRace, hitRacer, clamp } from './race-model.js';
import { ENCOUNTERS, encountersFor, encounterAt } from './race-course.js';
export { ENCOUNTERS, encountersFor, encounterAt };
// Spin balls and bonus gates apply to every racer. The player's previous position is passed in
// (the renderer tracks it across shortcut transitions); rivals use the position from their last step.
export function stepEncounters(race, before, wasRoute) {
  if (race.done) return;
  for (const r of race.racers) {
    if (r.finish !== null || r.routeId) continue;
    if (r.player ? wasRoute : r.prevS === undefined) continue;
    crossEncounters(race, r, r.player ? before : r.prevS);
  }
}
function crossEncounters(race, p, before) {
  const lap = Math.floor(Math.max(0, before) / race.length);
  for (const e of encountersFor(race.levelId)) {
    const s = lap * race.length + e.u * race.length;
    if (before >= s || p.s < s) continue;
    const at = encounterAt(e, race.time, lap),
      dx = Math.abs(p.x - at.x);
    if (e.kind === 'gate') {
      if (dx < at.radius) {
        p.boost = Math.max(p.boost, 2.1);
        p.coins = clamp(p.coins + 3, 0, 10);
        emitRace(race, 'jackpot', p);
      }
    } else if (p.air <= 0) {
      if (dx < at.radius + 0.75) {
        hitRacer(p, race, 'ball');
      } else if (dx < at.radius + 2) {
        p.boost = Math.max(p.boost, 1.15);
        emitRace(race, 'near-miss', p);
      }
    }
  }
}
export function bumpRivals(race) {
  const racers = race.racers,
    contacts = (race.bumpTimes ??= new Map());
  for (let i = 0; i < racers.length; i++)
    for (let j = i + 1; j < racers.length; j++) {
      const a = racers[i],
        b = racers[j];
      if (a.finish !== null || b.finish !== null || a.routeId || b.routeId || a.air > 0 || b.air > 0)
        continue;
      const dx = a.x - b.x;
      if (Math.abs(a.s - b.s) >= 2.3 || Math.abs(dx) >= 1.85) continue;
      const side = dx !== 0 ? Math.sign(dx) : a.id < b.id ? -1 : 1;
      // A ram needs a boosting kart closing in hard on one that is not boosting.
      const attacker =
        a.boost > 0 && b.boost <= 0 && a.speed - b.speed > 5
          ? a
          : b.boost > 0 && a.boost <= 0 && b.speed - a.speed > 5
            ? b
            : null;
      const aShare = attacker === a ? 0.2 : attacker === b ? 0.8 : 0.5;
      const separation = Math.min(1.85 - Math.abs(dx), attacker ? 1.25 : 0.9);
      a.x = clamp(a.x + side * separation * aShare, -14.5, 14.5);
      b.x = clamp(b.x - side * separation * (1 - aShare), -14.5, 14.5);
      const key = `${Math.min(a.id, b.id)}:${Math.max(a.id, b.id)}`;
      if (race.time - (contacts.get(key) ?? -Infinity) < 0.7) continue;
      contacts.set(key, race.time);
      if (attacker) {
        const victim = attacker === a ? b : a;
        if (hitRacer(victim, race, 'ram')) {
          emitRace(race, 'ram', attacker, { target: victim.id });
          continue;
        }
      }
      a.speed *= 0.96;
      b.speed *= 0.96;
      const source = a.player ? a : b.player ? b : a;
      emitRace(race, 'bump', source, { target: source === a ? b.id : a.id });
    }
}
