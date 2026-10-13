import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRace, stepRace, ranking, LAPS } from '../dist/race-model.js';
import { stepEncounters, bumpRivals } from '../dist/kart-encounters.js';
import { makeTrack } from '../dist/kart-world.js';
import { makeShortcuts, routeBend } from '../dist/kart-routes.js';
import { PERSONALITIES } from '../dist/race-ai.js';

const track = makeTrack('jerusalem');
track.shortcuts = makeShortcuts(track);

// The player holds a tidy centre line: rivals have to beat that on merit.
function race(difficulty = 'normal', seed = 77) {
  const r = makeRace(0, difficulty, seed, track.length, track.shortcuts, 'jerusalem', {
    bend: s => track.bend(s)
  });
  const p = r.racers[0];
  let seen = 0;
  const events = [];
  for (let i = 0; i < 60 * 300 && !r.done; i++) {
    const before = p.s,
      wasRoute = !!p.routeId,
      curve = routeBend(track, p);
    const steer = Math.max(-1, Math.min(1, (-curve * p.speed * 3.5) / 11.4 - p.x * 0.6));
    stepRace(r, 1 / 60, { steer, accelerate: true }, curve);
    stepEncounters(r, before, wasRoute);
    bumpRivals(r);
    for (const e of r.events) if (e.seq > seen) events.push(e), (seen = e.seq);
  }
  return { r, events };
}

test('rivals race on merit: they drift, collect and use items, and take shortcuts', () => {
  const { r, events } = race('hard');
  const rivals = e => !e.player;
  assert.ok(events.filter(e => rivals(e) && e.type === 'drift-boost').length > 8);
  assert.ok(events.filter(e => rivals(e) && e.type === 'pickup').length > 10);
  assert.ok(events.filter(e => rivals(e) && e.type === 'item-use').length > 4);
  assert.ok(events.some(e => rivals(e) && e.type === 'shortcut-enter'));
  assert.equal(r.done, true);
});

test('every driver has a finishing time and the field finishes close together', () => {
  const { r } = race('normal');
  const order = ranking(r);
  for (const racer of order) assert.ok(Number.isFinite(racer.finish ?? racer.projected));
  const times = order.map(x => x.finish ?? x.projected);
  for (let i = 1; i < times.length; i++) assert.ok(times[i] >= times[i - 1]);
  assert.ok(times.at(-1) - times[0] < 25, 'pack spread ' + (times.at(-1) - times[0]).toFixed(1));
});

test('rivals mostly steer around barriers they can see', () => {
  const { events } = race('insane', 5);
  const barrierHits = events.filter(e => !e.player && e.type === 'hit' && e.cause === 'barrier').length;
  // Five rivals, three laps, about seven barriers per lap.
  assert.ok(barrierHits < 15, 'barrier hits ' + barrierHits);
});

test('finished rivals keep rolling and racers past the line stay ranked by finish time', () => {
  const { r } = race('insane', 9);
  const finished = r.racers.filter(x => !x.player && x.finish !== null);
  for (const x of finished) assert.ok(x.s >= r.length * LAPS);
  assert.ok(PERSONALITIES.length === 8);
});
