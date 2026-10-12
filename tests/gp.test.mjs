import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newGrandPrix,
  awardSeats,
  offers,
  invite,
  defections,
  raceOptions,
  verdict,
  coalitionSeats,
  restore,
  currentLevel,
  GP_RACES,
  SEATS_BY_PLACE,
  SEATS_BY_VOTE,
  voteSeats,
  MAX_PARTNERS
} from '../dist/gp.js';
import { makeRace, stepRace, useItem } from '../dist/race-model.js';

test('three races hand out exactly the 120 seats of the Knesset', () => {
  const gp = newGrandPrix(0);
  for (let r = 0; r < GP_RACES.length; r++) awardSeats(gp, [0, 1, 2, 3, 4, 5]);
  assert.equal(
    gp.seats.reduce((a, b) => a + b),
    120
  );
  assert.equal((SEATS_BY_PLACE.reduce((a, b) => a + b) + SEATS_BY_VOTE) * GP_RACES.length, 120);
  assert.equal(gp.done, true);
  // Winning every race alone is still not a majority.
  assert.ok(gp.seats[0] < 61);
});

test('a coalition counts its partners, and invitations are capped', () => {
  const gp = newGrandPrix(2);
  awardSeats(gp, [0, 2, 1, 3, 4, 5]);
  assert.equal(currentLevel(gp), GP_RACES[1]);
  const [best] = offers(gp);
  assert.equal(best.id, 0);
  assert.ok(invite(gp, 0));
  assert.equal(coalitionSeats(gp), gp.seats[2] + gp.seats[0]);
  for (const id of [1, 3, 4]) invite(gp, id);
  // You plus two partners: three of six parties average exactly 60 seats.
  assert.equal(gp.coalition.length, MAX_PARTNERS);
  assert.equal(invite(gp, 5), false);
});

test("partners' demands become handicaps; allies stop aiming at each other", () => {
  const gp = newGrandPrix(0);
  awardSeats(gp, [1, 0, 2, 3, 4, 5]);
  invite(gp, 3); // grid demand
  invite(gp, 1); // no launch boost
  const options = raceOptions(gp);
  assert.equal(options.handicap.grid, true);
  assert.equal(options.handicap.noLaunch, true);
  const race = makeRace(0, 'normal', 5, 760, [], 'jerusalem', { ...options, pickups: false });
  assert.equal(race.racers[0].s, Math.min(...race.racers.map(r => r.s)));
  // An allied rival with a poll does not fire it at the player directly ahead.
  const ally = race.racers.find(r => r.id === 1);
  const p = race.racers[0];
  p.s = 50;
  ally.s = 40;
  race.racers.filter(r => r !== p && r !== ally).forEach(r => (r.s = -500));
  ally.item = 'poll';
  useItem(race, ally);
  assert.ok(!race.projectiles.some(x => x.to === p.id));
});

test('partners who are hit or who outrun the player walk out', () => {
  const gp = newGrandPrix(0);
  awardSeats(gp, [0, 1, 2, 3, 4, 5]);
  invite(gp, 4);
  invite(gp, 5);
  // Partner 4 wins while the player is last, and was hit twice by the player.
  awardSeats(gp, [4, 1, 2, 3, 5, 0], { 4: 2 });
  const gone = defections(gp);
  assert.deepEqual(gone, [4]);
  assert.ok(!gp.coalition.includes(4) && gp.coalition.includes(5));
  assert.ok(offers(gp).find(o => o.id === 4).burned);
});

test('the verdict reports government, opposition or a 60-60 deadlock', () => {
  const gp = newGrandPrix(0);
  gp.seats = [30, 20, 11, 20, 20, 19];
  gp.coalition = [1, 2];
  assert.equal(verdict(gp).outcome, 'government');
  gp.coalition = [1];
  assert.equal(verdict(gp).outcome, 'opposition');
  gp.seats = [30, 20, 10, 20, 20, 20];
  gp.coalition = [1, 2];
  assert.equal(verdict(gp).outcome, 'elections');
});

test('a saved Grand Prix survives the reload between races', () => {
  const gp = newGrandPrix(3);
  awardSeats(gp, [3, 2, 1, 0, 4, 5]);
  invite(gp, 2);
  const back = restore(JSON.stringify(gp));
  assert.deepEqual(back, gp);
  assert.equal(restore('nonsense'), null);
  assert.equal(restore(JSON.stringify({ version: 1 })), null);
});

test('ballot slips become seats: six per race shared by largest remainder', () => {
  assert.deepEqual(voteSeats([30, 0, 0, 0, 0, 0]), [6, 0, 0, 0, 0, 0]);
  assert.deepEqual(voteSeats([10, 10, 10, 10, 10, 10]), [1, 1, 1, 1, 1, 1]);
  assert.equal(
    voteSeats([17, 3, 9, 0, 22, 5]).reduce((a, b) => a + b),
    6
  );
  assert.deepEqual(voteSeats([0, 0, 0, 0, 0, 0]), [0, 0, 0, 0, 0, 0]);
  const gp = newGrandPrix(0);
  // Last place, but the most votes: votes still pay.
  const gained = awardSeats(gp, [1, 2, 3, 4, 5, 0], {}, [40, 5, 5, 5, 5, 0]);
  assert.ok(gained[0] >= SEATS_BY_PLACE[5] + 4);
  assert.equal(
    gained.reduce((a, b) => a + b),
    40
  );
});
