import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRace, stepRace } from '../dist/race-model.js';
import { makeRecorder, sampleGhost, loadGhost } from '../dist/ghost.js';

test('a recorded run replays where the kart actually was', () => {
  const race = makeRace(0, 'normal', 3, 760, [], 'jerusalem', { solo: true, pickups: false }),
    p = race.racers[0],
    rec = makeRecorder();
  const truth = [];
  for (let i = 0; i < 600; i++) {
    stepRace(race, 1 / 60, { accelerate: true, steer: Math.sin(i / 40) });
    rec.record(p, race.time);
    if (i % 120 === 0) truth.push({ t: race.time, s: p.s, x: p.x });
  }
  const ghost = rec.finish(race.time, 0, [12.5]);
  // Through JSON, as it is stored.
  const back = loadGhost(() => JSON.stringify(ghost), 'jerusalem');
  assert.ok(back);
  for (const { t, s, x } of truth.slice(1)) {
    const g = sampleGhost(back, t);
    assert.ok(Math.abs(g.s - s) < 1.2, `s ${g.s} vs ${s}`);
    assert.ok(Math.abs(g.x - x) < 0.4, `x ${g.x} vs ${x}`);
  }
  assert.equal(sampleGhost(back, 999).finished, true);
});

test('time trials race alone and every ballot box is a turbo', async () => {
  const { grantItem } = await import('../dist/race-items.js');
  const race = makeRace(3, 'normal', 9, 760, [], 'jerusalem', { solo: true });
  assert.equal(race.racers.length, 1);
  for (let i = 0; i < 20; i++) {
    race.racers[0].item = null;
    grantItem(race, race.racers[0]);
    assert.equal(race.racers[0].item, 'boost');
  }
});

test('corrupt or foreign ghost data is ignored', () => {
  assert.equal(
    loadGhost(() => 'not json', 'x'),
    null
  );
  assert.equal(
    loadGhost(() => JSON.stringify({ version: 9, frames: [] }), 'x'),
    null
  );
  assert.equal(
    loadGhost(() => '', 'x'),
    null
  );
});
