// "The Race to 61": three races hand out the Knesset's 120 seats by finishing position. Nobody wins
// a majority alone, so between races the player negotiates a coalition. Partners stop attacking
// and cover the player's back, but each brings a demand that handicaps the player while they stay,
// and the bigger the partner, the heavier the demand. Some parties will not sit together at all.
// The biggest party in the government names the prime minister, so a big partner is also a rival
// for the chair; close enough, and the two share it by rotation. Partners the player hits walk out.
import { PARTIES } from './race-model.js';

export const GP_RACES = ['jerusalem', 'market', 'midnight'];
// Each race is worth 40 seats: 34 by finishing place, and 6 shared out in proportion to the
// ballot slips each party collected, by largest remainder — the way real seats follow votes.
export const SEATS_BY_PLACE = [9, 7, 6, 4, 3, 2, 2, 1];
export const SEATS_BY_VOTE = 6;
export function voteSeats(votes, seats = SEATS_BY_VOTE) {
  const total = votes.reduce((a, b) => a + b, 0);
  if (!total) return votes.map(() => 0);
  const quota = votes.map(v => (v * seats) / total),
    out = quota.map(Math.floor);
  const order = quota
    .map((q, i) => [q - Math.floor(q), votes[i], i])
    .sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const left = seats - out.reduce((a, b) => a + b, 0);
  for (let k = 0; k < left; k++) out[order[k][2]]++;
  return out;
}
export const MAJORITY = 61;
// Four of the eight parties average exactly 60 seats: a majority needs a real coalition.
export const MAX_PARTNERS = 3;
// How many more seats than the player a party may hold and still agree to join.
export const JUNIOR_MARGIN = 4;
// Version 3: eight parties. Older saves hold six seat counts and are dropped.
const VERSION = 3;

// Parties that refuse to sit in the same government, by index into PARTIES
// (0 likud, 1 together, 2 democrats, 3 beytenu, 4 shas, 5 otzma, 6 yashar, 7 religious zionism).
// It applies to the player too.
export const VETOES = [
  [3, 4],
  [1, 4],
  [1, 5],
  [2, 5],
  [0, 2],
  [6, 5],
  [6, 7],
  [2, 7]
];
export const vetoed = (a, b) => VETOES.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

// Each demand comes in three weights: light, standard, heavy. `costs` are what the player reads.
export const TIERS = ['קלה', 'רגילה', 'כבדה'];
export const DEMANDS = {
  grid: {
    name: 'תיק האוצר',
    costs: ['מזנקים מהמקום הרביעי', 'מזנקים מהמקום החמישי', 'מזנקים מהשורה האחרונה'],
    values: [3, 4, 5]
  },
  cap: {
    name: 'כספים קואליציוניים',
    costs: ['תקרת פתקים: 8 במקום 10', 'תקרת פתקים: 6 במקום 10', 'תקרת פתקים: 4 במקום 10'],
    values: [8, 6, 4]
  },
  drift: {
    name: 'ועדת חקירה',
    costs: ['בוסט הדריפט קצר ב־10%', 'בוסט הדריפט קצר ברבע', 'בוסט הדריפט קצר ב־40%'],
    values: [0.9, 0.75, 0.6]
  },
  veto: {
    name: 'זכות וטו',
    costs: ['כל קופסה רביעית ריקה', 'כל קופסה שלישית ריקה', 'כל קופסה שנייה ריקה'],
    values: [4, 3, 2]
  },
  launch: {
    name: 'הסכם רוטציה',
    costs: ['זינוק טורבו חלש יותר', 'זינוק טורבו חלש מאוד', 'בלי זינוק טורבו'],
    values: [0.6, 0.3, 0]
  },
  item: {
    name: 'חלוקת תיקים',
    costs: ['בלי הצבעות אי־אמון', 'בלי אי־אמון וסקרים', 'בלי אי־אמון, סקרים והעברות תקציב'],
    values: [['noconf'], ['noconf', 'poll'], ['noconf', 'poll', 'budget']]
  }
};
// What each party asks for when invited.
// Yashar wants a commission of inquiry; Religious Zionism wants the Treasury.
export const ASKS = ['cap', 'launch', 'drift', 'grid', 'veto', 'item', 'drift', 'grid'];

// A partner asks more the more it weighs against the player: under 60% of the player's seats is
// light, under 100% standard, as big or bigger heavy. Renegotiated every round.
export function demandTier(gp, id) {
  const ratio = gp.seats[id] / Math.max(1, gp.seats[gp.player]);
  return ratio < 0.6 ? 0 : ratio < 1 ? 1 : 2;
}
export function demandOf(gp, id) {
  const d = DEMANDS[ASKS[id]],
    tier = demandTier(gp, id);
  return { key: ASKS[id], name: d.name, tier, weight: TIERS[tier], cost: d.costs[tier], value: d.values[tier] };
}

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
    return gp?.version === VERSION && gp.seats?.length === PARTIES.length ? gp : null;
  } catch {
    return null;
  }
}

export const currentLevel = gp => GP_RACES[Math.min(gp.round, GP_RACES.length - 1)];
export const isFinalRound = gp => gp.round >= GP_RACES.length - 1;
export const coalitionSeats = gp => [gp.player, ...gp.coalition].reduce((sum, id) => sum + gp.seats[id], 0);

// order: party ids in finishing order. hits: { [partyId]: times the player hit them this race }.
// votes: ballot slips collected, indexed by party id.
export function awardSeats(gp, order, hits = {}, votes = null) {
  const gained = PARTIES.map(() => 0),
    byVote = voteSeats(votes ?? PARTIES.map(() => 1));
  order.forEach((id, place) => {
    gained[id] = (SEATS_BY_PLACE[place] ?? 0) + byVote[id];
    gp.seats[id] += gained[id];
  });
  gp.lastVoteSeats = byVote;
  // A race together builds a little trust; every hit from the player costs a lot of it.
  for (const id of gp.coalition) {
    const delta = 0.05 - (hits[id] ?? 0) * 0.22;
    gp.loyalty[id] = Math.max(0, Math.min(1, (gp.loyalty[id] ?? 0.6) + delta));
  }
  gp.history.push({ round: gp.round, level: currentLevel(gp), order: [...order], gained });
  gp.round++;
  if (gp.round >= GP_RACES.length) gp.done = true;
  return gained;
}

// The government's top jobs. The biggest party names the prime minister; if the runner-up is within
// ROTATION_MARGIN seats, the two rotate (the bigger one first; a tie goes to the player). The rest
// take portfolios in order of size: finance, defence, justice.
export const ROTATION_MARGIN = 2;
export const ROLES = {
  pm: { title: 'ראש הממשלה', short: 'ראש ממשלה' },
  'rotation-first': { title: 'ראש הממשלה ברוטציה · ראשון', short: 'רוטציה, ראשונים' },
  'rotation-second': { title: 'ראש הממשלה ברוטציה · שני', short: 'רוטציה, שניים' },
  finance: { title: 'שר האוצר', short: 'שר האוצר' },
  defense: { title: 'שר הביטחון', short: 'שר הביטחון' },
  justice: { title: 'שר המשפטים', short: 'שר המשפטים' },
  opposition: { title: 'אופוזיציה', short: 'אופוזיציה' },
  elections: { title: 'בחירות חוזרות', short: 'בחירות' }
};
// From best to worst for the player: the ladder shown at the end of the season.
export const LADDER = [
  'pm',
  'rotation-first',
  'rotation-second',
  'finance',
  'defense',
  'justice',
  'opposition',
  'elections'
];

export function cabinet(gp, members) {
  const sorted = [...members].sort(
    (a, b) => gp.seats[b] - gp.seats[a] || (b === gp.player) - (a === gp.player) || a - b
  );
  const rotation = sorted.length > 1 && gp.seats[sorted[0]] - gp.seats[sorted[1]] <= ROTATION_MARGIN;
  // Up to four parties: the fourth gets Justice (or Defence, under a rotation).
  const keys = rotation
    ? ['rotation-first', 'rotation-second', 'finance', 'defense']
    : ['pm', 'finance', 'defense', 'justice'];
  return sorted.map((id, i) => ({ id, seats: gp.seats[id], role: keys[i], ...ROLES[keys[i]] }));
}
// The player's job in the coalition as it stands (or with `extra` added), and who leads it.
export function standing(gp, extra = null) {
  const members = [gp.player, ...gp.coalition, ...(extra === null ? [] : [extra])],
    seats = members.reduce((sum, id) => sum + gp.seats[id], 0),
    list = cabinet(gp, members),
    me = list.find(m => m.id === gp.player),
    leader = list[0];
  // Seats between the player and whoever they would have to catch (or who is chasing them).
  const rival = me === leader ? list[1] : leader;
  return { role: me.role, leader: leader.id, rival: rival?.id ?? null, gap: rival ? gp.seats[gp.player] - rival.seats : null, seats, cabinet: list };
}

// Partners whose loyalty has collapsed walk out before the next race.
export function defections(gp) {
  const leaving = gp.coalition.filter(id => (gp.loyalty[id] ?? 0.6) < 0.25);
  gp.coalition = gp.coalition.filter(id => !leaving.includes(id));
  gp.left.push(...leaving);
  return leaving;
}

// Who in the coalition (the player first) a party refuses to sit with, or null.
export function blocker(gp, id) {
  return [gp.player, ...gp.coalition].find(other => vetoed(id, other)) ?? null;
}

export function offers(gp) {
  return PARTIES.map((p, id) => id)
    .filter(id => id !== gp.player && !gp.coalition.includes(id))
    .map(id => {
      const blockedBy = blocker(gp, id),
        tooBig = gp.seats[id] > gp.seats[gp.player] + JUNIOR_MARGIN;
      return {
        id,
        seats: gp.seats[id],
        demand: demandOf(gp, id),
        // Parties that already walked out once need convincing: they bring less loyalty.
        burned: gp.left.includes(id),
        // Nobody joins as a junior partner to a smaller party: they must not outweigh you by much.
        tooBig,
        // Someone already inside (or the player) is a party this one will not sit with.
        blockedBy,
        // The coalition this partner would make.
        total: coalitionSeats(gp) + gp.seats[id],
        willing: !tooBig && blockedBy === null
      };
    })
    .sort((a, b) => b.seats - a.seats);
}

export function invite(gp, id) {
  if (gp.coalition.includes(id) || id === gp.player || gp.coalition.length >= MAX_PARTNERS) return false;
  if (gp.seats[id] > gp.seats[gp.player] + JUNIOR_MARGIN) return false;
  if (blocker(gp, id) !== null) return false;
  gp.coalition.push(id);
  gp.loyalty[id] = gp.left.includes(id) ? 0.4 : 0.65;
  return true;
}

export function dismiss(gp, id) {
  gp.coalition = gp.coalition.filter(x => x !== id);
}

// Race options for the next race: allies and the handicaps their demands impose. `owners` names
// the partner behind each handicap so the race can say who did it.
export function raceOptions(gp) {
  const handicap = {
      gridSlot: 0,
      ballotCap: 10,
      driftScale: 1,
      vetoEvery: 0,
      launchScale: 1,
      banned: [],
      owners: {}
    },
    set = { grid: 'gridSlot', cap: 'ballotCap', drift: 'driftScale', veto: 'vetoEvery', launch: 'launchScale', item: 'banned' };
  for (const id of gp.coalition) {
    const d = demandOf(gp, id);
    handicap[set[d.key]] = d.value;
    handicap.owners[d.key] = id;
  }
  return { coalition: [gp.player, ...gp.coalition], handicap };
}

// The largest coalition the parties outside the player's can build: up to four parties
// (a leader and three partners, like the player) with no vetoes between them.
function bestRivalCoalition(gp, others) {
  let best = 0,
    members = [];
  const n = others.length;
  for (let mask = 1; mask < 1 << n; mask++) {
    const pick = others.filter((_, i) => mask & (1 << i));
    if (pick.length > MAX_PARTNERS + 1) continue;
    if (pick.some((a, i) => pick.slice(i + 1).some(b => vetoed(a, b)))) continue;
    const sum = pick.reduce((t, id) => t + gp.seats[id], 0);
    if (sum > best) [best, members] = [sum, pick];
  }
  return { seats: best, members };
}

export function verdict(gp) {
  const mine = coalitionSeats(gp),
    others = PARTIES.map((_, id) => id).filter(id => id !== gp.player && !gp.coalition.includes(id));
  const opposition = others.reduce((sum, id) => sum + gp.seats[id], 0),
    rival = bestRivalCoalition(gp, others);
  // Without 61 the other side may manage it instead, if its own vetoes allow; otherwise it's back
  // to the ballot box.
  const outcome = mine >= MAJORITY ? 'government' : rival.seats >= MAJORITY ? 'opposition' : 'elections';
  const gov =
    outcome === 'government'
      ? cabinet(gp, [gp.player, ...gp.coalition])
      : outcome === 'opposition'
        ? cabinet(gp, rival.members)
        : [];
  const role = outcome === 'government' ? gov.find(m => m.id === gp.player).role : outcome;
  return {
    seats: mine,
    formed: outcome === 'government',
    outcome,
    opposition,
    rival: rival.seats,
    cabinet: gov,
    role,
    rank: LADDER.indexOf(role)
  };
}
