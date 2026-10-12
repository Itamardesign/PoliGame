// Headless balance check: full races on every course with the real track geometry, encounters and
// pickups. The "player" is driven either by a skilled bot (the same AI brain) or a basic bot.
import {
  makeRace,
  stepRace,
  ranking,
  startRace,
  useItem,
  useAbility,
  PACE,
  CATCH_UP
} from '../dist/race-model.js';
if (process.env.PACE) Object.assign(PACE, JSON.parse(process.env.PACE));
if (process.env.CATCH) Object.assign(CATCH_UP, JSON.parse(process.env.CATCH));
import { makeBrain, aiInput } from '../dist/race-ai.js';
import { stepEncounters, bumpRivals } from '../dist/kart-encounters.js';
import { makeTrack } from '../dist/kart-world.js';
import { makeShortcuts, routeBend } from '../dist/kart-routes.js';
import { LEVELS } from '../dist/kart-levels.js';

const mode = process.argv[2] ?? 'skilled',
  runs = Number(process.argv[3] ?? 8);
for (const level of LEVELS) {
  const track = makeTrack(level.id);
  track.shortcuts = level.id === 'jerusalem' ? makeShortcuts(track) : [];
  const places = [],
    gaps = [],
    hits = {},
    events = {};
  for (let run = 0; run < runs; run++) {
    const race = makeRace(run % 6, level.difficulty, 1000 + run, track.length, track.shortcuts, level.id, {
      bend: s => track.bend(s)
    });
    const p = race.racers[0];
    const brain = makeBrain(1, race.random);
    const profiles = {
      skilled: { greed: 0.6, risk: 0.1, drift: 3, line: 0.97 },
      casual: { greed: 0.4, risk: 0.45, drift: 0, line: 0.75 },
      basic: { greed: 0, risk: 0.6, drift: 0, line: 0.6 }
    };
    brain.personality = { ...brain.personality, aggression: 0.3, patience: 0.1, ...profiles[mode] };
    let seen = 0;
    startRace(race, mode === 'skilled');
    for (let i = 0; i < 60 * 400 && !race.done; i++) {
      const before = p.s,
        wasRoute = !!p.routeId,
        curve = routeBend(track, p);
      let input;
      if (mode === 'idle') input = {};
      else {
        p.brain = brain;
        input = aiInput(race, p, 1 / 60, curve);
        p.brain = null;
        if (mode === 'basic') input = { steer: input.steer, accelerate: true };
        if (input.useItem) useItem(race, p);
        if (input.useAbility) useAbility(race, p);
      }
      stepRace(race, 1 / 60, input, curve);
      stepEncounters(race, before, wasRoute);
      bumpRivals(race);
      for (const e of race.events)
        if (e.seq > seen) {
          seen = e.seq;
          events[e.type] = (events[e.type] ?? 0) + 1;
          if (e.cause) events['hit-' + e.cause] = (events['hit-' + e.cause] ?? 0) + 1;
          if (e.player) events['me-' + e.type] = (events['me-' + e.type] ?? 0) + 1;
          if (e.cause && e.player) events['mehit-' + e.cause] = (events['mehit-' + e.cause] ?? 0) + 1;
        }
    }
    const order = ranking(race);
    places.push(order.indexOf(p) + 1);
    gaps.push((order.at(-1).projected ?? 0) - order[0].projected);
    for (const r of race.racers) hits[r.id] = hits[r.id] ?? 0;
    race.hitLog = 0;
  }
  const avg = a => (a.reduce((s, x) => s + x, 0) / a.length).toFixed(2);
  const per = k => ((events[k] ?? 0) / runs).toFixed(1);
  console.log(
    `${level.id.padEnd(9)} ${mode}: places ${places.join(',')} avg ${avg(places)} | spread ${avg(gaps)}s | per race: hits ${per('hit')} rams ${per('ram')} polls ${per('poll-fired')} drift-boosts ${per('drift-boost')} shortcuts ${per('shortcut-enter')} near-miss ${per('near-miss')} jackpots ${per('jackpot')} | barrier ${per('hit-barrier')} ball ${per('hit-ball')} ram ${per('hit-ram')} poll ${per('hit-poll')} abilities ${per('ability')} leaks ${per('leaked')} drops ${per('drop')} noconf ${per('noconf-fired')} | me: hits ${per('me-hit')} (${Object.keys(
      events
    )
      .filter(k => k.startsWith('mehit-'))
      .map(k => k.slice(6) + ' ' + per(k))
      .join(', ')}) drift ${per('me-drift-boost')} items ${per('me-item-use')}`
  );
}
