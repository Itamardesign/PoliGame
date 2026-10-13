// Plays whole "Race to 61" seasons headlessly: node tools/gp-sim.mjs [skilled|casual] [seasons] [strategy]
// strategy: greedy (invite the biggest parties) | smart (the partners that add most seats, vetoes
// considered) | lean (one partner) | solo (no partners)
import { makeRace, stepRace, ranking, startRace, useItem, useAbility } from '../dist/race-model.js';
import { makeBrain, aiInput } from '../dist/race-ai.js';
import { stepEncounters, bumpRivals } from '../dist/kart-encounters.js';
import { makeTrack } from '../dist/kart-world.js';
import { makeShortcuts, routeBend } from '../dist/kart-routes.js';
import { levelById } from '../dist/kart-levels.js';
import * as GP from '../dist/gp.js';
import { PARTIES } from '../dist/race-model.js';

const mode = process.argv[2] ?? 'skilled',
  seasons = Number(process.argv[3] ?? 6),
  strategy = process.argv[4] ?? 'greedy';
const tracks = {};
for (const id of GP.GP_RACES) {
  tracks[id] = makeTrack(id);
  tracks[id].shortcuts = id === 'jerusalem' ? makeShortcuts(tracks[id]) : [];
}
const profiles = {
  skilled: { greed: 0.6, risk: 0.1, drift: 3, line: 0.97 },
  casual: { greed: 0.4, risk: 0.45, drift: 0, line: 0.75 }
};
function runRace(party, levelId, seed, options) {
  const track = tracks[levelId],
    level = levelById(levelId);
  const race = makeRace(party, level.difficulty, seed, track.length, track.shortcuts, levelId, {
    bend: s => track.bend(s),
    ...options
  });
  const p = race.racers[0],
    brain = makeBrain(1, race.random);
  brain.personality = { ...brain.personality, aggression: 0.3, patience: 0.1, ...profiles[mode] };
  startRace(race, mode === 'skilled');
  const hits = {};
  let seen = 0;
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
    for (const e of race.events)
      if (e.seq > seen) {
        seen = e.seq;
        const victim =
          e.type === 'ram' && e.player ? e.target : e.from === party && e.type === 'hit' ? e.id : null;
        if (victim !== null && victim !== undefined) hits[victim] = (hits[victim] ?? 0) + 1;
      }
  }
  return {
    order: ranking(race).map(r => r.id),
    hits,
    votes: PARTIES.map((_, id) => race.racers.find(r => r.id === id).votes)
  };
}
const outcomes = {},
  seatsList = [];
for (let n = 0; n < seasons; n++) {
  const party = n % PARTIES.length,
    gp = GP.newGrandPrix(party);
  while (!gp.done) {
    const level = GP.currentLevel(gp);
    const { order, hits, votes } = runRace(party, level, 500 + n * 7 + gp.round, GP.raceOptions(gp));
    GP.awardSeats(gp, order, hits, votes);
    if (gp.done) break;
    GP.defections(gp);
    const want = strategy === 'solo' ? 0 : strategy === 'lean' ? 1 : GP.MAX_PARTNERS;
    if (strategy === 'smart') {
      // Start over and take the compatible set of partners (up to the cap) that adds the most seats.
      gp.coalition = [];
      const open = GP.offers(gp).filter(o => o.willing).map(o => o.id),
        sum = ids => ids.reduce((t, id) => t + gp.seats[id], 0);
      let best = [];
      for (let mask = 1; mask < 1 << open.length; mask++) {
        const pick = open.filter((_, i) => mask & (1 << i));
        if (pick.length > GP.MAX_PARTNERS) continue;
        if (pick.some((a, i) => pick.slice(i + 1).some(b => GP.vetoed(a, b)))) continue;
        if (sum(pick) > sum(best)) best = pick;
      }
      for (const id of best) GP.invite(gp, id);
      continue;
    }
    // Offers change with every invitation (vetoes), so ask again each time.
    while (gp.coalition.length < want) {
      const offer = GP.offers(gp).find(o => o.willing);
      if (!offer || !GP.invite(gp, offer.id)) break;
    }
  }
  const v = GP.verdict(gp);
  outcomes[v.role] = (outcomes[v.role] ?? 0) + 1;
  seatsList.push(`${v.seats}(${gp.coalition.length + 1}p,${gp.left.length}out)`);
}
console.log(mode, strategy, JSON.stringify(outcomes), seatsList.join(' '));
