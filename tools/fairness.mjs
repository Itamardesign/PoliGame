// Car balance: every party driven by the same skilled bot, on every course. A fair roster puts each
// car's average place near the middle of the field: node tools/fairness.mjs [runs per party]
import { makeRace, stepRace, ranking, startRace, useItem, useAbility, PARTIES } from '../dist/race-model.js';
import { makeBrain, aiInput } from '../dist/race-ai.js';
import { stepEncounters, bumpRivals } from '../dist/kart-encounters.js';
import { makeTrack } from '../dist/kart-world.js';
import { makeShortcuts, routeBend } from '../dist/kart-routes.js';
import { LEVELS } from '../dist/kart-levels.js';

const runs = Number(process.argv[2] ?? 3);
const places = PARTIES.map(() => []);
for (const level of LEVELS) {
  const track = makeTrack(level.id);
  track.shortcuts = level.id === 'jerusalem' ? makeShortcuts(track) : [];
  for (let party = 0; party < PARTIES.length; party++)
    for (let run = 0; run < runs; run++) {
      const race = makeRace(party, level.difficulty, 5000 + run * 31, track.length, track.shortcuts, level.id, {
        bend: s => track.bend(s)
      });
      const p = race.racers[0],
        brain = makeBrain(party, race.random);
      brain.personality = { ...brain.personality, greed: 0.6, risk: 0.1, drift: 3, line: 0.97 };
      startRace(race, true);
      for (let i = 0; i < 60 * 400 && !race.done; i++) {
        const before = p.s,
          wasRoute = !!p.routeId,
          curve = routeBend(track, p);
        p.brain = brain;
        const input = aiInput(race, p, 1 / 60, curve);
        p.brain = null;
        if (input.useItem) useItem(race, p);
        if (input.useAbility) useAbility(race, p);
        stepRace(race, 1 / 60, input, curve);
        stepEncounters(race, before, wasRoute);
        bumpRivals(race);
      }
      places[party].push(ranking(race).indexOf(p) + 1);
    }
}
const avg = a => a.reduce((s, x) => s + x, 0) / a.length;
for (const [i, p] of PARTIES.entries())
  console.log(`${p.short.padEnd(10)} avg place ${avg(places[i]).toFixed(2)}  (${places[i].join(',')})`);
