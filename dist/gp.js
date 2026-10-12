// "The Race to 61": three races hand out the Knesset's 120 seats by finishing position. Nobody wins
// a majority alone, so between races the player negotiates a coalition. Partners stop attacking
// and cover the player's back, but each brings a demand that handicaps the player while they stay.
// Partners who are hit by the player, or who start to outrun them, may walk out.
import { PARTIES } from './race-model.js';

export const GP_RACES = ['jerusalem', 'market', 'midnight'];
export const SEATS_BY_PLACE = [12, 9, 7, 5, 4, 3];
export const MAJORITY = 61;
export const MAX_PARTNERS = 2;
// How many more seats than the player a party may hold and still agree to join.
export const JUNIOR_MARGIN = 4;
const VERSION = 2;

export const DEMANDS = {
  grid: { name: 'תיק האוצר', cost: 'אתם מזנקים מהשורה האחרונה' },
  cap: { name: 'כספים קואליציוניים', cost: 'תקרת פתקים: 6 במקום 10' },
  drift: { name: 'ועדת חקירה', cost: 'בוסט הדריפט שלכם קצר ברבע' },
  veto: { name: 'זכות וטו', cost: 'כל קופסת קמפיין שלישית ריקה' },
  launch: { name: 'הסכם רוטציה', cost: 'בלי זינוק טורבו בפתיחה' },
  item: { name: 'חלוקת תיקים', cost: 'בלי הצבעות אי־אמון בקופסאות' }
};
// What each party asks for when invited.
const ASKS = ['cap', 'launch', 'drift', 'grid', 'veto', 'item'];

export function newGrandPrix(player) {
  return {
    version: VERSION,
    player,
    round: 0,
    seats: PARTIES.map(() => 0),
    history: [],
    coalition: [],
    loyalty: {},
    left: [],
    done: false
  };
}

export function restore(json) {
  try {
    const gp = JSON.parse(json);
    return gp?.version === VERSION && Array.isArray(gp.seats) ? gp : null;
  } catch {
    return null;
  }
}

export const currentLevel = gp => GP_RACES[Math.min(gp.round, GP_RACES.length - 1)];
export const isFinalRound = gp => gp.round >= GP_RACES.length - 1;
export const coalitionSeats = gp => [gp.player, ...gp.coalition].reduce((sum, id) => sum + gp.seats[id], 0);

// order: party ids in finishing order. hits: { [partyId]: times the player hit them this race }.
export function awardSeats(gp, order, hits = {}) {
  const gained = PARTIES.map(() => 0);
  order.forEach((id, place) => {
    gained[id] = SEATS_BY_PLACE[place] ?? 0;
    gp.seats[id] += gained[id];
  });
  const mine = order.indexOf(gp.player);
  for (const id of gp.coalition) {
    const place = order.indexOf(id);
    let delta = place > mine ? 0.1 : place < mine - 1 ? -0.3 : -0.05;
    delta -= (hits[id] ?? 0) * 0.22;
    gp.loyalty[id] = Math.max(0, Math.min(1, (gp.loyalty[id] ?? 0.6) + delta));
  }
  gp.history.push({ round: gp.round, level: currentLevel(gp), order: [...order], gained });
  gp.round++;
  if (gp.round >= GP_RACES.length) gp.done = true;
  return gained;
}

// Partners whose loyalty has collapsed walk out before the next race.
export function defections(gp) {
  const leaving = gp.coalition.filter(id => (gp.loyalty[id] ?? 0.6) < 0.25);
  gp.coalition = gp.coalition.filter(id => !leaving.includes(id));
  gp.left.push(...leaving);
  return leaving;
}

export function offers(gp) {
  return PARTIES.map((p, id) => id)
    .filter(id => id !== gp.player && !gp.coalition.includes(id))
    .map(id => ({
      id,
      seats: gp.seats[id],
      demand: ASKS[id],
      // Parties that already walked out once need convincing: they bring less loyalty.
      burned: gp.left.includes(id),
      // Nobody joins as a junior partner to a smaller party: they must not outweigh you by much.
      willing: gp.seats[id] <= gp.seats[gp.player] + JUNIOR_MARGIN
    }))
    .sort((a, b) => b.seats - a.seats);
}

export function invite(gp, id) {
  if (gp.coalition.includes(id) || id === gp.player || gp.coalition.length >= MAX_PARTNERS) return false;
  if (gp.seats[id] > gp.seats[gp.player] + JUNIOR_MARGIN) return false;
  gp.coalition.push(id);
  gp.loyalty[id] = gp.left.includes(id) ? 0.4 : 0.65;
  return true;
}

export function dismiss(gp, id) {
  gp.coalition = gp.coalition.filter(x => x !== id);
}

// Race options for the next race: allies and the handicaps their demands impose.
export function raceOptions(gp) {
  const asks = new Set(gp.coalition.map(id => ASKS[id]));
  return {
    coalition: [gp.player, ...gp.coalition],
    handicap: {
      grid: asks.has('grid'),
      ballotCap: asks.has('cap') ? 6 : 10,
      driftScale: asks.has('drift') ? 0.75 : 1,
      vetoEvery: asks.has('veto') ? 3 : 0,
      noLaunch: asks.has('launch'),
      noNoconf: asks.has('item')
    }
  };
}

export function verdict(gp) {
  const mine = coalitionSeats(gp),
    others = PARTIES.map((_, id) => id).filter(id => id !== gp.player && !gp.coalition.includes(id));
  const opposition = others.reduce((sum, id) => sum + gp.seats[id], 0);
  return {
    seats: mine,
    formed: mine >= MAJORITY,
    // Without 61 the other side may manage it instead; otherwise it's back to the ballot box.
    outcome: mine >= MAJORITY ? 'government' : opposition >= MAJORITY ? 'opposition' : 'elections',
    opposition
  };
}
