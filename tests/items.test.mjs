import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRace, stepRace, useItem, useAbility, grantItem, ranking } from '../dist/race-model.js';
import { ITEMS, ABILITIES, statBars } from '../dist/race-items.js';

function lineup(party = 0, seed = 4242) {
  const race = makeRace(party, 'normal', seed, 760, [], 'jerusalem', { pickups: false });
  // Player at the back of a spaced-out pack.
  race.racers.forEach((r, i) => {
    r.s = i === 0 ? 100 : 100 + i * 12;
    r.speed = 30;
  });
  return race;
}

test('the back of the pack draws stronger items than the leader', () => {
  const counts = { front: {}, back: {} };
  for (let i = 0; i < 400; i++) {
    const race = lineup(0, 1000 + i);
    const back = race.racers[0],
      front = race.racers[5];
    grantItem(race, back);
    grantItem(race, front);
    counts.back[back.item] = (counts.back[back.item] ?? 0) + 1;
    counts.front[front.item] = (counts.front[front.item] ?? 0) + 1;
  }
  assert.ok((counts.back.noconf ?? 0) > 20, JSON.stringify(counts.back));
  assert.equal(counts.front.noconf ?? 0, 0);
  assert.ok((counts.front.shield ?? 0) > (counts.back.shield ?? 0));
  for (const item of Object.keys({ ...counts.front, ...counts.back })) assert.ok(ITEMS[item], item);
});

test('a no-confidence vote finds the leader and ignores shields', () => {
  const race = lineup(),
    p = race.racers[0],
    leader = ranking(race)[0];
  leader.shield = 5;
  p.item = 'noconf';
  useItem(race, p);
  assert.equal(race.projectiles[0].to, leader.id);
  for (let i = 0; i < 130; i++) stepRace(race, 1 / 60, {});
  assert.ok(race.events.some(e => e.type === 'hit' && e.id === leader.id && e.cause === 'noconf'));
});

test('a leak blinds rivals ahead, spin doctor reverses steering, budget steals ballots', () => {
  const race = lineup(),
    p = race.racers[0];
  p.item = 'leak';
  useItem(race, p);
  assert.ok(race.racers.slice(1).filter(r => r.blind > 0).length >= 1);
  const victim = race.racers.find(r => r.s > p.s && r.s - p.s < 90 && r.shield <= 0);
  p.item = 'spin';
  useItem(race, p);
  assert.ok(race.racers.some(r => r.confused > 0));
  victim.coins = 6;
  p.coins = 0;
  p.item = 'budget';
  useItem(race, p);
  assert.ok(p.coins > 0);
});

test('a confused player steers the wrong way', () => {
  const race = lineup(),
    p = race.racers[0];
  p.x = 0;
  p.confused = 2;
  for (let i = 0; i < 20; i++) stepRace(race, 1 / 60, { steer: 1 });
  assert.ok(p.x < -0.3);
});

test('a filibuster stops the kart that runs into it', () => {
  const race = lineup(),
    p = race.racers[0],
    rival = race.racers[1];
  p.x = rival.x = 0;
  rival.item = 'filibuster';
  useItem(race, rival);
  const drop = race.drops[0];
  assert.ok(drop.s < rival.s && drop.s > p.s);
  drop.armed = 0;
  for (let i = 0; i < 40; i++) stepRace(race, 1 / 60, {});
  assert.ok(race.events.some(e => e.type === 'drop-hit' && e.id === p.id));
  assert.equal(race.drops.length, 0);
});

test('every leader has a distinct ability that only fires when charged', () => {
  assert.equal(ABILITIES.length, 6);
  for (let party = 0; party < 6; party++) {
    const race = lineup(party),
      p = race.racers[0];
    assert.equal(useAbility(race, p), null);
    p.ability = 1;
    assert.equal(useAbility(race, p), ABILITIES[party].id);
    assert.equal(p.ability, 0);
  }
});

test('drifting and dodging charge the ability meter', () => {
  const race = lineup(),
    p = race.racers[0];
  p.speed = 32;
  for (let k = 0; k < 6; k++) {
    for (let i = 0; i < 160; i++)
      stepRace(race, 1 / 60, { steer: Math.sin(i * 0.3) > 0 ? 1 : -1, drift: true });
    stepRace(race, 1 / 60, {});
  }
  assert.ok(p.ability > 0.3, String(p.ability));
});

test('super immunity shrugs off hits and flattens karts on contact', async () => {
  const { bumpRivals } = await import('../dist/kart-encounters.js');
  const race = lineup(),
    p = race.racers[0],
    r = race.racers[1];
  p.ability = 1;
  useAbility(race, p);
  assert.ok(p.star > 0);
  r.s = p.s;
  r.x = p.x;
  bumpRivals(race);
  assert.ok(r.stun > 0);
  assert.ok(p.stun === 0);
});

test('vehicle stat bars run from 1 to 5 and no vehicle tops every category', () => {
  const bars = [0, 1, 2, 3, 4, 5].map(statBars);
  for (const b of bars) for (const v of Object.values(b)) assert.ok(v >= 1 && v <= 5);
  for (const b of bars) assert.ok(Object.values(b).some(v => v <= 2));
});
