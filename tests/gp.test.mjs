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
  MAX_PARTNERS,
  demandOf,
  vetoed,
  standing,
  cabinet
} from '../dist/gp.js';
import { makeRace, stepRace, useItem } from '../dist/race-model.js';

test('three races hand out exactly the 120 seats of the Knesset', () => {
  const gp = newGrandPrix(0);
  for (let r = 0; r < GP_RACES.length; r++) awardSeats(gp, [0, 1, 2, 3, 4, 5, 6, 7]);
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
  awardSeats(gp, [1, 2, 0, 3, 4, 5, 6, 7]);
  assert.equal(currentLevel(gp), GP_RACES[1]);
  const [best] = offers(gp);
  assert.equal(best.id, 1);
  assert.equal(best.total, gp.seats[2] + gp.seats[1]);
  assert.ok(invite(gp, 1));
  assert.equal(coalitionSeats(gp), gp.seats[2] + gp.seats[1]);
  for (const id of [0, 3, 4, 6]) invite(gp, id);
  // You plus three partners: four of eight parties average exactly 60 seats.
  assert.equal(gp.coalition.length, MAX_PARTNERS);
  assert.equal(invite(gp, 5), false);
});

test("partners' demands become handicaps; allies stop aiming at each other", () => {
  const gp = newGrandPrix(0);
  awardSeats(gp, [1, 0, 2, 3, 4, 5, 6, 7]);
  invite(gp, 3); // grid demand, standard: smaller than the player
  invite(gp, 1); // launch demand, heavy: bigger than the player
  const options = raceOptions(gp);
  assert.equal(options.handicap.gridSlot, 4);
  assert.equal(options.handicap.launchScale, 0);
  assert.equal(options.handicap.owners.launch, 1);
  const race = makeRace(0, 'normal', 5, 760, [], 'jerusalem', { ...options, pickups: false });
  assert.equal(race.racers[0].s, race.racers.map(r => r.s).sort((a, b) => b - a)[4]);
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

test('partners the player keeps hitting walk out; outrunning the player is not a betrayal', () => {
  const gp = newGrandPrix(0);
  awardSeats(gp, [0, 1, 2, 3, 4, 5, 6, 7]);
  invite(gp, 4);
  invite(gp, 5);
  // Partner 5 wins while the player is last: still loyal. Partner 4 was hit three times.
  awardSeats(gp, [5, 1, 2, 3, 4, 0, 6, 7], { 4: 3 });
  const gone = defections(gp);
  assert.deepEqual(gone, [4]);
  assert.ok(!gp.coalition.includes(4) && gp.coalition.includes(5));
  assert.ok(gp.loyalty[5] > 0.65);
  assert.ok(offers(gp).find(o => o.id === 4).burned);
});

test('the verdict reports government, opposition or a 60-60 deadlock', () => {
  const gp = newGrandPrix(0);
  gp.seats = [30, 20, 11, 20, 20, 19];
  gp.coalition = [1, 3];
  assert.equal(verdict(gp).outcome, 'government');
  // 70 seats outside, but their vetoes cap any coalition they can build at 39.
  gp.coalition = [1];
  assert.equal(verdict(gp).outcome, 'elections');
  assert.equal(verdict(gp).rival, 39);
  gp.seats = [10, 30, 25, 20, 20, 15];
  gp.coalition = [];
  assert.equal(verdict(gp).outcome, 'opposition');
  gp.seats = [30, 20, 10, 10, 30, 20];
  gp.coalition = [1, 3];
  assert.equal(verdict(gp).outcome, 'elections');
});

test('a saved Grand Prix survives the reload between races', () => {
  const gp = newGrandPrix(3);
  awardSeats(gp, [3, 2, 1, 0, 4, 5, 6, 7]);
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
  const gained = awardSeats(gp, [1, 2, 3, 4, 5, 6, 7, 0], {}, [40, 5, 5, 5, 5, 0, 0, 0]);
  assert.ok(gained[0] >= SEATS_BY_PLACE[7] + 4);
  assert.equal(
    gained.reduce((a, b) => a + b),
    40
  );
});

test('parties that veto each other cannot sit together, and the offer says who blocks it', () => {
  assert.ok(vetoed(3, 4) && vetoed(4, 3));
  assert.ok(!vetoed(0, 4));
  const gp = newGrandPrix(0);
  awardSeats(gp, [0, 1, 2, 3, 4, 5, 6, 7]);
  // Likud will not sit with the Democrats at all.
  const democrats = offers(gp).find(o => o.id === 2);
  assert.equal(democrats.blockedBy, 0);
  assert.equal(democrats.willing, false);
  assert.equal(invite(gp, 2), false);
  // With Shas inside, Yisrael Beytenu refuses.
  assert.ok(invite(gp, 4));
  assert.equal(offers(gp).find(o => o.id === 3).blockedBy, 4);
  assert.equal(invite(gp, 3), false);
  assert.ok(invite(gp, 5));
});

test('the bigger the partner, the heavier its demand', () => {
  const gp = newGrandPrix(0);
  gp.seats = [20, 22, 15, 8, 20, 5];
  assert.equal(demandOf(gp, 3).tier, 0); // 8 of 20: light
  assert.equal(demandOf(gp, 2).tier, 1); // 15 of 20: standard
  assert.equal(demandOf(gp, 4).tier, 2); // as big as the player: heavy
  assert.equal(demandOf(gp, 1).tier, 2);
  gp.coalition = [3, 4];
  const { handicap } = raceOptions(gp);
  assert.equal(handicap.gridSlot, 3);
  assert.equal(handicap.vetoEvery, 2);
  assert.deepEqual(handicap.owners, { grid: 3, veto: 4 });
});

test('the biggest party takes the chair, close rivals rotate, the rest take portfolios', () => {
  const gp = newGrandPrix(0);
  gp.seats = [30, 20, 11, 15, 20, 24];
  gp.coalition = [4, 3];
  assert.deepEqual(
    cabinet(gp, [0, 4, 3]).map(m => m.role),
    ['pm', 'finance', 'defense']
  );
  assert.equal(standing(gp).role, 'pm');
  assert.equal(standing(gp).gap, 10);
  // Inviting Otzma (24) would leave the player six ahead: still prime minister. At 28, rotation.
  gp.coalition = [4];
  assert.equal(standing(gp, 5).role, 'pm');
  gp.seats[5] = 28;
  assert.equal(standing(gp, 5).role, 'rotation-first');
  gp.seats[5] = 32;
  assert.equal(standing(gp, 5).role, 'rotation-second');
  gp.seats[5] = 34;
  assert.equal(standing(gp, 5).role, 'finance');
  assert.equal(standing(gp, 5).leader, 5);
  // A tie in the rotation goes to the player.
  gp.seats[5] = 30;
  assert.equal(standing(gp, 5).role, 'rotation-first');
});

test('the verdict places the player on the ladder', () => {
  const gp = newGrandPrix(1);
  gp.seats = [18, 20, 30, 17, 20, 15];
  gp.coalition = [2, 3];
  const v = verdict(gp);
  assert.equal(v.outcome, 'government');
  assert.equal(v.role, 'finance');
  assert.equal(v.cabinet[0].id, 2);
  assert.equal(v.cabinet[0].role, 'pm');
  // Outside the government, the rivals' cabinet is the one shown.
  gp.seats = [25, 20, 10, 10, 20, 35];
  gp.coalition = [];
  const o = verdict(gp);
  assert.equal(o.role, 'opposition');
  assert.deepEqual(
    o.cabinet.map(m => m.id),
    [5, 0, 4]
  );
});

test('a four-party government gives every member a portfolio', () => {
  const gp = newGrandPrix(0);
  gp.seats = [30, 20, 6, 15, 12, 9, 18, 10];
  const list = cabinet(gp, [0, 6, 3, 4]);
  assert.deepEqual(
    list.map(m => m.role),
    ['pm', 'finance', 'defense', 'justice']
  );
  gp.seats[6] = 29;
  assert.deepEqual(
    cabinet(gp, [0, 6, 3, 4]).map(m => m.role),
    ['rotation-first', 'rotation-second', 'finance', 'defense']
  );
});
