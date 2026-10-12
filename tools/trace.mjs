import { makeRace, stepRace } from '../dist/race-model.js';
import { stepEncounters, bumpRivals } from '../dist/kart-encounters.js';
import { makeTrack } from '../dist/kart-world.js';
const level = process.argv[2] ?? 'market';
const track = makeTrack(level);
track.shortcuts = [];
const race = makeRace(0, 'hard', 1001, track.length, [], level, { bend: s => track.bend(s) });
const hist = new Map();
let seen = 0,
  shown = 0;
for (let i = 0; i < 60 * 200 && !race.done && shown < 6; i++) {
  const p = race.racers[0],
    before = p.s;
  stepRace(race, 1 / 60, { steer: 0 }, track.bend(p.s));
  stepEncounters(race, before, false);
  bumpRivals(race);
  for (const r of race.racers) {
    const h = hist.get(r.id) ?? [];
    h.push([
      race.time.toFixed(2),
      r.s.toFixed(1),
      r.x.toFixed(2),
      r.lateral.toFixed(1),
      r.steer.toFixed(2),
      r.drifting ? 'D' : '-',
      'T' + (r.brain?.target ?? 0).toFixed(1),
      r.speed.toFixed(1),
      track.bend(r.s).toFixed(4)
    ]);
    if (h.length > 50) h.shift();
    hist.set(r.id, h);
  }
  for (const e of race.events)
    if (e.seq > seen) {
      seen = e.seq;
      if (e.type === 'hit' && e.cause === 'barrier' && !e.player) {
        shown++;
        const b = race.pickups
          .filter(q => q.type === 'barrier')
          .map(q => [q.s.toFixed(0), q.x.toFixed(1)])
          .find(q => Math.abs((e.s % track.length) - q[0]) < 3);
        console.log('HIT', e.id, 'at s', (e.s % track.length).toFixed(1), 'x', e.x.toFixed(2), 'barrier', b);
        console.log(
          hist
            .get(e.id)
            .filter((_, k) => k % 5 === 0)
            .map(h => h.join(' '))
            .join('\n')
        );
      }
    }
}
