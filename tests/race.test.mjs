import test from 'node:test';
import assert from 'node:assert/strict';
import { ROAD, makeRace, stepRace, ranking, useItem, hitRacer, grantItem } from '../dist/race-model.js';
import { makeTrack } from '../dist/kart-world.js';
const track = makeTrack();
function simulate(difficulty, drive) {
  const race = makeRace(0, difficulty, 6161, track.length);
  for (let i = 0; i < 20000 && !race.done; i++) {
    const p = race.racers[0],
      input = drive(race, i);
    stepRace(race, 1 / 60, input, track.bend(p.s));
  }
  return race;
}

test('a completed race takes three laps and freezes its results', () => {
  const r = simulate('normal', () => ({ steer: 0 }));
  assert.equal(r.done, true);
  assert.equal(r.racers[0].s, track.length * 3);
  const time = r.time;
  stepRace(r, 1 / 60, {});
  assert.equal(r.time, time);
});
test('steering can overcome corners; going idle loses', () => {
  const idle = simulate('normal', () => ({}));
  const skilled = simulate('normal', r => {
    const p = r.racers[0];
    return { steer: Math.max(-1, Math.min(1, (-track.bend(p.s) * p.speed * 3.5) / 11.4 - p.x * 0.6)) };
  });
  assert.equal(ranking(idle).indexOf(idle.racers[0]) + 1, 6);
  assert.ok(skilled.time < idle.time * 0.8);
  console.log('Driving balance:', {
    idle: idle.time.toFixed(1),
    steered: skilled.time.toFixed(1),
    steeredPlace: ranking(skilled).indexOf(skilled.racers[0]) + 1
  });
});
test('drift must charge before release; release grants finite boost', () => {
  const r = makeRace();
  const p = r.racers[0];
  p.speed = 32;
  for (let i = 0; i < 55; i++) stepRace(r, 1 / 60, { steer: Math.sin(i * 0.3) > 0 ? 1 : -1, drift: true }, 0);
  assert.ok(p.charge > 0.65);
  stepRace(r, 1 / 60, {}, 0);
  assert.ok(p.boost > 0);
  assert.equal(r.drifts, 1);
  for (let i = 0; i < 200; i++) stepRace(r, 1 / 60, {}, 0);
  assert.equal(p.boost, 0);
});
test('shield absorbs one hazard; collision cooldown prevents repeated hits', () => {
  const r = makeRace(),
    p = r.racers[0];
  p.shield = 6;
  assert.equal(hitRacer(p), false);
  assert.equal(p.shield, 0);
  assert.equal(p.stun, 0);
  assert.equal(hitRacer(p), false);
  p.hitCooldown = 0;
  assert.equal(hitRacer(p), true);
  assert.ok(p.stun > 0);
});
test('poll travels before impact and a shield can block it', () => {
  // Rivals here hold no pickups, so the projectile mechanics are tested in isolation.
  const r = makeRace(0, 'normal', 6161, 760, [], 'jerusalem', { pickups: false }),
    p = r.racers[0],
    a = r.racers[1],
    b = r.racers[2];
  p.s = 10;
  a.s = 20;
  b.s = 40;
  a.shield = 4;
  p.item = 'poll';
  assert.equal(useItem(r, p), 'poll');
  assert.equal(r.projectiles[0].to, a.id);
  assert.equal(a.shield, 4);
  for (let i = 0; i < 64; i++) stepRace(r, 1 / 60, {});
  assert.equal(a.shield, 0);
  assert.equal(a.stun, 0);
  p.item = 'poll';
  useItem(r, p);
  for (let i = 0; i < 64; i++) stepRace(r, 1 / 60, {});
  assert.ok(a.stun > 0);
  assert.equal(b.stun, 0);
});
test('an occupied item slot cannot be overwritten; all racers can use items', () => {
  const r = makeRace(),
    p = r.racers[0];
  p.item = 'shield';
  grantItem(r, p);
  assert.equal(p.item, 'shield');
  useItem(r, p);
  assert.equal(p.item, null);
  assert.equal(p.shield, 6);
  assert.equal(r.used, 1);
  const rival = r.racers[1];
  rival.item = 'boost';
  useItem(r, rival);
  assert.ok(rival.boost > 0);
});
test('200cc rivals are faster than 150cc; all parties share player baseline', () => {
  const a = makeRace(0, 'normal', 5),
    b = makeRace(4, 'hard', 5);
  for (let i = 0; i < 200; i++) {
    stepRace(a, 1 / 60, {});
    stepRace(b, 1 / 60, {});
  }
  assert.equal(a.racers[0].speed, b.racers[0].speed);
  assert.ok(b.racers[1].s > a.racers[1].s);
});
test('offroad and braking reduce speed, positions stay bounded', () => {
  const r = makeRace(),
    p = r.racers[0];
  p.x = 10;
  p.speed = 32;
  for (let i = 0; i < 60; i++) stepRace(r, 1 / 60, { steer: 1 });
  assert.ok(p.speed < 21);
  assert.ok(p.x <= ROAD.maxOffset);
  p.x = 0;
  for (let i = 0; i < 60; i++) stepRace(r, 1 / 60, { brake: true });
  assert.ok(p.speed < 20);
});

test('new tarmac width has usable grip beyond the original narrow road', () => {
  const r = makeRace(),
    p = r.racers[0];
  p.x = 8.5;
  for (let i = 0; i < 180; i++) stepRace(r, 1 / 60, {});
  assert.ok(p.speed > 31);
  p.x = ROAD.driveEdge + 0.6;
  for (let i = 0; i < 100; i++) stepRace(r, 1 / 60, {});
  assert.ok(p.speed < 18);
});
test('a short steering tap is precise and released steering quickly settles', () => {
  const r = makeRace(),
    p = r.racers[0];
  p.x = 0;
  p.speed = 32;
  for (let i = 0; i < 6; i++) stepRace(r, 1 / 60, { steer: 1 });
  assert.ok(p.x > 0.05 && p.x < 0.65);
  for (let i = 0; i < 25; i++) stepRace(r, 1 / 60, {});
  assert.ok(Math.abs(p.lateral) < 0.1);
  assert.ok(p.x < 1.2);
});
test('reversing direction responds promptly without oscillation', () => {
  const r = makeRace(),
    p = r.racers[0];
  p.x = 0;
  p.speed = 32;
  for (let i = 0; i < 20; i++) stepRace(r, 1 / 60, { steer: 1 });
  for (let i = 0; i < 20; i++) stepRace(r, 1 / 60, { steer: -1 });
  assert.ok(p.steer < -0.9);
  assert.ok(p.lateral < -7);
});
test('steering is consistent at 30, 60 and 120 Hz', () => {
  function drive(hz) {
    const r = makeRace(),
      p = r.racers[0];
    p.x = 0;
    p.speed = 32;
    for (let i = 0; i < hz; i++) stepRace(r, 1 / hz, { steer: i < hz * 0.5 ? 0.7 : 0 }, 0.01);
    return p.x;
  }
  assert.ok(Math.abs(drive(30) - drive(120)) < 0.22);
  assert.ok(Math.abs(drive(60) - drive(120)) < 0.12);
});
test('manual throttle accelerates and braking takes priority', () => {
  const r = makeRace(),
    p = r.racers[0];
  for (let i = 0; i < 240; i++) stepRace(r, 1 / 60, { accelerate: true });
  assert.ok(p.speed > 34.5);
  for (let i = 0; i < 40; i++) stepRace(r, 1 / 60, { accelerate: true, brake: true });
  assert.ok(p.speed < 16);
});
test('lower sensitivity supports fine corrections while high sensitivity turns faster', () => {
  const a = makeRace(),
    b = makeRace();
  for (let i = 0; i < 40; i++) {
    stepRace(a, 1 / 60, { steer: 1, sensitivity: 0.65 });
    stepRace(b, 1 / 60, { steer: 1, sensitivity: 1.35 });
  }
  assert.ok(b.racers[0].x - a.racers[0].x > 1);
});
