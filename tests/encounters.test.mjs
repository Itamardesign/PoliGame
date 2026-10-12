import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRace } from '../dist/race-model.js';
import { ENCOUNTERS, encounterAt, stepEncounters, bumpRivals } from '../dist/kart-encounters.js';
function crossing(kind, offset = 0) {
  const race = makeRace(),
    e = ENCOUNTERS.find(e => e.kind === kind),
    p = race.racers[0],
    s = e.u * race.length;
  p.s = s + 0.5;
  p.speed = 35;
  p.x = encounterAt(e, 0).x + offset;
  return { race, p, before: s - 0.5 };
}
test('moving obstacle hits, shield absorbs, close dodge rewards and jump clears it', () => {
  for (const mode of ['hit', 'shield', 'dodge', 'air']) {
    const { race, p, before } = crossing('ball', mode === 'dodge' ? 3 : 0);
    if (mode === 'shield') p.shield = 4;
    if (mode === 'air') p.air = 0.5;
    stepEncounters(race, before, false);
    if (mode === 'hit') assert.ok(p.stun > 0);
    if (mode === 'shield') {
      assert.equal(p.stun, 0);
      assert.equal(p.shield, 0);
    }
    if (mode === 'dodge') assert.ok(p.boost > 0);
    if (mode === 'air') assert.equal(p.stun, 0);
  }
});
test('bonus gates reward crossing once, change sides each lap, and cannot be collected on shortcuts', () => {
  const { race, p, before } = crossing('gate');
  stepEncounters(race, before, false);
  assert.equal(p.coins, 3);
  assert.ok(p.boost > 0);
  stepEncounters(race, p.s, false);
  assert.equal(p.coins, 3);
  const e = ENCOUNTERS.find(e => e.kind === 'gate');
  assert.equal(encounterAt(e, 0, 0).x, -encounterAt(e, 0, 1).x);
  const a = crossing('gate');
  a.p.routeId = 'garden';
  stepEncounters(a.race, a.before, false);
  assert.equal(a.p.coins, 0);
});
test('ordinary contact moves and gently slows both cars', () => {
  const race = makeRace(),
    p = race.racers[0],
    r = race.racers[1];
  p.s = r.s = 20;
  p.x = -0.3;
  r.x = 0.3;
  p.speed = r.speed = 32;
  bumpRivals(race);
  assert.ok(p.x < -0.3);
  assert.ok(r.x > 0.3);
  assert.ok(p.speed < 32 && p.speed > 30);
  assert.ok(r.speed < 32 && r.speed > 30);
  assert.equal(race.events.at(-1).type, 'bump');
});
test('AI cars also bump each other, without repeated impact events while touching', () => {
  const race = makeRace(),
    a = race.racers[1],
    b = race.racers[2];
  a.s = b.s = 20;
  a.x = -0.2;
  b.x = 0.2;
  race.racers[0].s = -20;
  bumpRivals(race);
  assert.ok(a.x < -0.2 && b.x > 0.2);
  const count = race.events.length;
  bumpRivals(race);
  assert.equal(race.events.length, count);
});
test('turbo ramming stuns an opponent, shield protects and contact cooldown prevents repeat hits', () => {
  const race = makeRace(),
    p = race.racers[0],
    r = race.racers[1];
  p.boost = 2;
  p.speed = 45;
  r.speed = 32;
  r.s = p.s;
  r.x = p.x;
  bumpRivals(race);
  assert.ok(r.stun > 0);
  assert.ok(race.events.some(e => e.type === 'ram'));
  const count = race.events.length;
  bumpRivals(race);
  assert.equal(race.events.length, count);
  race.time = 1;
  p.hitCooldown = 0;
  r.hitCooldown = 0;
  r.stun = 0;
  r.shield = 4;
  r.x = p.x;
  r.speed = 32;
  bumpRivals(race);
  assert.equal(r.stun, 0);
  assert.equal(r.shield, 0);
});
test('cars on shortcuts, in the air or past the finish do not collide', () => {
  for (const state of ['routeId', 'air', 'finish']) {
    const race = makeRace(),
      p = race.racers[0],
      r = race.racers[1];
    p.s = r.s = 20;
    p.x = r.x = 0;
    r[state] = state === 'routeId' ? 'garden' : state === 'air' ? 0.5 : 15;
    bumpRivals(race);
    assert.equal(p.x, 0);
    assert.equal(r.x, 0);
    assert.equal(race.events.length, 0);
  }
});
