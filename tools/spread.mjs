// Rival finish spread on the Grand Prix courses: node tools/spread.mjs [skilled|casual] [runs]
// Prints, per course, the gap between the first and last rival across the line and the player's place.
import { makeRace, stepRace, ranking, startRace, useItem, useAbility } from '../dist/race-model.js';
import { makeBrain, aiInput } from '../dist/race-ai.js';
import { stepEncounters, bumpRivals } from '../dist/kart-encounters.js';
import { makeTrack } from '../dist/kart-world.js';
import { makeShortcuts, routeBend } from '../dist/kart-routes.js';
import { levelById } from '../dist/kart-levels.js';
import { GP_RACES } from '../dist/gp.js';

const mode = process.argv[2] ?? 'skilled',
  runs = Number(process.argv[3] ?? 6);
const profiles = {
  skilled: { greed: 0.6, risk: 0.1, drift: 3, line: 0.97 },
  casual: { greed: 0.4, risk: 0.45, drift: 0, line: 0.75 }
};
for (const id of GP_RACES) {
  const track = makeTrack(id),
    level = levelById(id);
  track.shortcuts = id === 'jerusalem' ? makeShortcuts(track) : [];
  const spreads = [],
    places = [];
  for (let run = 0; run < runs; run++) {
    const race = makeRace(run % 8, level.difficulty, 900 + run * 13, track.length, track.shortcuts, id, {
      bend: s => track.bend(s)
    });
    const p = race.racers[0],
      brain = makeBrain(1, race.random);
    brain.personality = { ...brain.personality, aggression: 0.3, patience: 0.1, ...profiles[mode] };
    startRace(race, mode === 'skilled');
    for (let i = 0; i < 60 * 400 && !race.done; i++) {
      const before = p.s,
        wasRoute = !!p.routeId,
        curve = routeBend(track, p);
      p.brain = brain;
      const input = aiInput(race, p, 1 / 60, curve);
      p.brain = null;
      if (input.useItem) useItem(race, p);
      if (input.useAbility) useAbility(race, p);
      stepRace(race, 1 / 60, mode === 'casual' ? { steer: input.steer, accelerate: true } : input, curve);
      stepEncounters(race, before, wasRoute);
      bumpRivals(race);
    }
    const times = race.racers.filter(r => !r.player).map(r => r.finish ?? r.projected);
    spreads.push(Math.max(...times) - Math.min(...times));
    places.push(ranking(race).indexOf(p) + 1);
  }
  const avg = a => a.reduce((t, x) => t + x, 0) / a.length;
  console.log(
    `${id.padEnd(10)} ${level.difficulty.padEnd(7)} rival spread ${avg(spreads).toFixed(1)}s ` +
      `(${spreads.map(s => s.toFixed(1)).join(' ')})  player place ${places.join(' ')}`
  );
}
