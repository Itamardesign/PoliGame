import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../dist/kart-levels.js';
import { makeTrack } from '../dist/kart-world.js';
import { makeRace, ROAD, stepRace } from '../dist/race-model.js';
import { encountersFor } from '../dist/kart-encounters.js';

test('each course is a distinct closed road with safe inner edges', () => {
  const lengths = [];
  for (const level of LEVELS) {
    const track = makeTrack(level.id);
    lengths.push(track.length);
    assert.equal(track.id, level.id);
    assert.equal(track.sectors.length, 4);
    assert.ok(track.at(0).p.distanceTo(track.at(track.length).p) < 0.001);
    for (let s = 0; s < track.length; s += 2)
      assert.ok(Math.abs(track.bend(s)) * ROAD.halfWidth < 0.95, `${level.id} folds near ${s}`);
  }
  assert.equal(new Set(lengths.map(Math.round)).size, 3);
});

test('the new courses increase pressure through hazards and rival pace', () => {
  assert.ok(encountersFor('market').length > encountersFor('jerusalem').length);
  assert.ok(encountersFor('midnight').length > encountersFor('market').length);
  const distances = [];
  for (const level of LEVELS) {
    const race = makeRace(0, level.difficulty, 6161, makeTrack(level.id).length, [], level.id);
    for (let i = 0; i < 240; i++) stepRace(race, 1 / 60, {});
    // Average the whole field: individual rivals now collect, crash and boost.
    distances.push(race.racers.slice(1).reduce((sum, r) => sum + r.s, 0) / 5);
  }
  assert.ok(distances[0] < distances[1] && distances[1] < distances[2]);
});

test('both added courses can finish all three laps', () => {
  for (const level of LEVELS.slice(1)) {
    const track = makeTrack(level.id),
      race = makeRace(0, level.difficulty, 6161, track.length, [], level.id);
    for (let i = 0; i < 18000 && !race.done; i++)
      stepRace(race, 1 / 60, { accelerate: true }, track.bend(race.racers[0].s));
    assert.equal(race.done, true, level.id);
    assert.equal(race.racers[0].s, track.length * 3);
  }
});
