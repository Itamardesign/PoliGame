import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRace, stepRace, launch, useItem, hitRacer, emitRace } from '../dist/race-model.js';
import { makeTrack } from '../dist/kart-world.js';
import { makeShortcuts, racerFrame, routeBend } from '../dist/kart-routes.js';
const track = makeTrack();
track.shortcuts = makeShortcuts(track);
const race = () => makeRace(0, 'normal', 6161, track.length, track.shortcuts);
for (const route of track.shortcuts) {
  test(route.id + ' is a shorter physical branch with continuous entrances and exits', () => {
    assert.ok(route.length < route.end - route.start);
    assert.ok(route.at(0).p.distanceTo(track.at(route.start, route.entryX).p) < 0.001);
    assert.ok(route.at(route.length).p.distanceTo(track.at(route.end, route.exitX).p) < 0.001);
    for (let d = 0; d < route.length; d += 2)
      assert.ok(Number.isFinite(routeBend(track, { routeId: route.id, routeDistance: d })));
  });
  test(route.id + ' can be entered, driven, jumped and exited without skipping laps', () => {
    const r = race(),
      p = r.racers[0];
    p.s = route.start - 0.3;
    p.x = route.entryX;
    p.speed = 35;
    stepRace(r, 0.02, {});
    assert.equal(p.routeId, route.id);
    assert.equal(r.shortcuts, 1);
    let previous = p.s,
      jumped = false;
    for (let i = 0; i < 600 && p.routeId; i++) {
      const position = racerFrame(track, p);
      assert.ok(Number.isFinite(position.p.x));
      stepRace(r, 1 / 60, {});
      assert.ok(p.s >= previous);
      previous = p.s;
      if (p.air > 0) jumped = true;
    }
    assert.equal(p.routeId, null);
    assert.equal(jumped, true);
    assert.equal(r.jumps, 1);
    assert.ok(Math.abs(p.s - route.end) < 1);
    assert.ok(Math.abs(p.x - route.exitX) < 0.1);
  });
  test(route.id + ' does not pull a centered or slow driver into the shortcut', () => {
    for (const [x, speed] of [
      [0, 35],
      [route.entryX, 15]
    ]) {
      const r = race(),
        p = r.racers[0];
      p.s = route.start - 0.01;
      p.x = x;
      p.speed = speed;
      stepRace(r, 0.02, {});
      assert.equal(p.routeId, null);
    }
  });
}
test('airborne trick grants a single landing boost; holding Shift before takeoff does not', () => {
  for (const held of [false, true]) {
    const r = race(),
      p = r.racers[0];
    p.speed = 30;
    p.lastDrift = held;
    launch(r, p);
    stepRace(r, 0.02, { drift: true });
    assert.equal(p.trick, !held);
    for (let i = 0; i < 65; i++) stepRace(r, 1 / 60, { drift: true });
    assert.equal(p.air, 0);
    assert.equal(p.boost > 0, !held);
    assert.equal(r.events.filter(e => e.type === 'land').length, 1);
  }
});
test('slipstream requires following a nearby opponent and has a cooldown', () => {
  const r = race(),
    p = r.racers[0],
    other = r.racers[1];
  p.speed = 32;
  p.x = 0;
  for (let i = 0; i < 85; i++) {
    other.s = p.s + 9;
    other.x = p.x;
    stepRace(r, 1 / 60, {});
  }
  assert.ok(p.boost > 0);
  assert.ok(p.slipCooldown > 0);
  assert.equal(r.events.filter(e => e.type === 'slipstream' && e.player).length, 1);
});
test('magnet expires and emits visible feedback events', () => {
  const r = race(),
    p = r.racers[0];
  p.item = 'magnet';
  useItem(r, p);
  assert.equal(p.magnet, 7);
  assert.ok(r.events.some(e => e.type === 'item-use' && e.item === 'magnet'));
  for (let i = 0; i < 430; i++) stepRace(r, 1 / 60, {});
  assert.equal(p.magnet, 0);
});
test('hit feedback distinguishes shield absorption from a spin', () => {
  const r = race(),
    p = r.racers[0];
  p.shield = 5;
  hitRacer(p, r);
  assert.equal(r.events.at(-1).type, 'shield-break');
  p.hitCooldown = 0;
  hitRacer(p, r);
  assert.equal(r.events.at(-1).type, 'hit');
});
test('feedback history is bounded during long races', () => {
  const r = race();
  for (let i = 0; i < 500; i++) emitRace(r, 'pickup', r.racers[0]);
  assert.equal(r.events.length, 120);
  assert.equal(r.events.at(-1).seq, 500);
});
