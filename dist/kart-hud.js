// In-race HUD: position and live standings, lap clock, item and ability, drift meter, minimap and
// a broadcast-style ticker that turns race events into one-line news.
import * as T from './vendor/three.module.min.js';
import { PARTIES, LAPS, ROAD, ranking, sectorAt } from './race-model.js';
import { ITEMS, ABILITIES } from './race-items.js';
import { racerFrame } from './kart-routes.js';
import { icon } from './ui-icons.js';

const $ = id => document.getElementById(id);
export const formatTime = t => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;
const name = id => PARTIES[id].short;

const compactBallots = () => innerWidth <= 760;
export function makeHud({ arena, track, reduced, touch }) {
  // Ticker: one headline at a time, each held long enough to read.
  const queue = [];
  let showing = null,
    shownAt = -10,
    lastOrder = null,
    lastLeader = null;
  function tick(text, priority = 1, now = 0) {
    if (queue.some(q => q.text === text) || showing?.text === text) return;
    queue.push({ text, priority, at: now });
    queue.sort((a, b) => b.priority - a.priority);
    if (queue.length > 6) queue.length = 6;
  }
  function pumpTicker(now) {
    if (showing && now - shownAt < 2.6) return;
    const next = queue.shift();
    if (!next) return;
    showing = next;
    shownAt = now;
    const el = $('ticker');
    el.textContent = next.text;
    el.classList.remove('fresh');
    void el.offsetWidth;
    el.classList.add('fresh');
  }
  function resetTicker(text = '') {
    queue.length = 0;
    showing = null;
    lastOrder = null;
    lastLeader = null;
    $('ticker').textContent = text;
  }

  // Race events become headlines. Only things a viewer would care about make the cut.
  function eventHeadline(e, race) {
    const who = e.player ? 'אתם' : name(e.id);
    const target =
      e.target !== undefined
        ? race.racers.find(r => r.id === e.target)?.player
          ? 'אתכם'
          : name(e.target)
        : '';
    switch (e.type) {
      case 'hit':
        if (e.cause === 'noconf')
          return [`הצבעת אי־אמון: ${e.player ? 'אתם סופגים' : name(e.id) + ' סופג'} את המכה`, 3];
        if (e.cause === 'poll')
          return [e.player ? 'סקר מפתיע מפיל אתכם' : `סקר מפתיע מפיל את ${name(e.id)}`, 2];
        if (e.cause === 'ram') return null;
        return e.player ? null : [`${name(e.id)} מסתחרר`, 0];
      case 'ram':
        return [`${who} ${e.player ? 'מעיפים' : 'מעיף'} את ${target} מהכביש`, 2];
      case 'leaked':
        return e.player ? [`הדלפה! ${name(e.from)} הדליף עליכם`, 3] : null;
      case 'spun':
        return [`ספין דוקטור: ${e.player ? 'ההגה שלכם הפוך' : 'ההגה של ' + name(e.id) + ' הפוך'}`, 2];
      case 'budget':
        return [`העברה תקציבית: ${who} ${e.player ? 'לוקחים' : 'לוקח'} ${e.amount} פתקים מ${target}`, 2];
      case 'ability':
        return [`${who}: ${ABILITIES[e.id].name}`, 3];
      case 'drop-hit':
        return [`${who} ${e.player ? 'נתקעים' : 'נתקע'} בחסימה`, 1];
      case 'shortcut-enter':
        return e.player ? null : [`${name(e.id)} נכנס לדרך סודית`, 0];
      case 'finish':
        return [`${who} ${e.player ? 'חוצים' : 'חוצה'} את קו הסיום — מקום ${e.place}`, 3];
      case 'noconf-fired':
        return [`${who} ${e.player ? 'מגישים' : 'מגיש'} הצבעת אי־אמון נגד ${target}`, 3];
      default:
        return null;
    }
  }
  function onEvent(e, race, now) {
    const h = eventHeadline(e, race);
    if (h) tick(h[0], h[1], now);
  }

  // Standings changes: overtakes involving the player and a new race leader.
  function watchOrder(race, now) {
    const order = ranking(race).map(r => r.id),
      me = race.racers[0].id;
    if (lastOrder && race.time > 3) {
      const before = lastOrder.indexOf(me),
        after = order.indexOf(me);
      if (after < before) tick(`עקפתם את ${name(lastOrder[after])} · מקום ${after + 1}`, 2, now);
      else if (after > before) tick(`${name(order[before])} עוקף אתכם`, 2, now);
      if (order[0] !== lastLeader && lastLeader !== null)
        tick(order[0] === me ? 'אתם מובילים את המרוץ' : `${name(order[0])} עולה למקום הראשון`, 2, now);
    }
    lastOrder = order;
    lastLeader = order[0];
  }

  // Minimap.
  const map = $('minimap').getContext('2d'),
    bounds = new T.Box3().setFromPoints(
      Array.from({ length: 120 }, (_, i) => track.at((i / 120) * track.length).p)
    );
  const project = p => ({
    x: 18 + ((p.x - bounds.min.x) / (bounds.max.x - bounds.min.x || 1)) * 204,
    y: 166 - ((p.z - bounds.min.z) / (bounds.max.z - bounds.min.z || 1)) * 152
  });
  const roadPath = new Path2D();
  for (let i = 0; i <= 120; i++) {
    const p = project(track.at((i / 120) * track.length).p);
    i ? roadPath.lineTo(p.x, p.y) : roadPath.moveTo(p.x, p.y);
  }
  function drawMap(race) {
    map.clearRect(0, 0, 240, 180);
    map.lineJoin = map.lineCap = 'round';
    map.strokeStyle = 'rgba(11,20,34,0.7)';
    map.lineWidth = 12;
    map.stroke(roadPath);
    map.strokeStyle = '#e8ecf2';
    map.lineWidth = 6;
    map.stroke(roadPath);
    map.save();
    map.setLineDash([3, 4]);
    map.lineWidth = 2;
    map.strokeStyle = '#f2c14e';
    for (const route of track.shortcuts) {
      map.beginPath();
      for (let i = 0; i <= 30; i++) {
        const p = project(route.at((i / 30) * route.length).p);
        i ? map.lineTo(p.x, p.y) : map.moveTo(p.x, p.y);
      }
      map.stroke();
    }
    map.restore();
    for (const r of [...race.racers].reverse()) {
      const p = project(racerFrame(track, r).p);
      map.beginPath();
      map.arc(p.x, p.y, r.player ? 7 : 5, 0, Math.PI * 2);
      map.fillStyle = PARTIES[r.id].color;
      map.fill();
      map.strokeStyle = r.player ? '#ffffff' : 'rgba(11,20,34,0.9)';
      map.lineWidth = r.player ? 2.5 : 1.5;
      map.stroke();
    }
  }

  let lastItem = undefined,
    lastSlips = -1,
    lastCap = 10;
  function update(race, { selected, gp, coalitionSeats, now }) {
    const p = race.racers[0],
      order = ranking(race),
      position = order.indexOf(p) + 1,
      lap = Math.min(LAPS, Math.floor(Math.max(0, p.s) / track.length) + 1);
    $('position').textContent = position;
    $('lap').textContent = `הקפה ${lap}/${LAPS}`;
    $('clock').textContent = formatTime(race.time);
    const sector = track.sectors[sectorAt(p.s, track.length)];
    const sectorName = p.routeId ? track.shortcuts.find(r => r.id === p.routeId).name : sector.name;
    if ($('sectorName').textContent !== sectorName) $('sectorName').textContent = sectorName;
    $('sectorName').style.setProperty('--sector', p.routeId ? '#f2c14e' : sector.color);

    // Live standings with the gap to the car ahead, in seconds at current pace.
    const leader = order[0];
    $('leaderboard').innerHTML = order
      .map((r, i) => {
        const gap =
          i === 0
            ? ''
            : r.finish !== null
              ? '✓'
              : '+' + ((leader.s - r.s) / Math.max(leader.speed, 25)).toFixed(1);
        const ally = gp && race.coalition.has(r.id) && !r.player ? ' ally' : '';
        return `<li class="${r.player ? 'me' : ''}${ally}" style="--party:${PARTIES[r.id].color}"><b>${i + 1}</b><i></i><span>${r.player ? 'אתם' : name(r.id)}</span><small>${gap}</small></li>`;
      })
      .join('');
    if (gp) {
      $('coalitionMeter').classList.remove('hidden');
      $('coalitionMeter').textContent = `קואליציה ${coalitionSeats}/61`;
    }

    // Item tile.
    if (p.item !== lastItem) {
      lastItem = p.item;
      const item = ITEMS[p.item];
      $('itemIcon').innerHTML = icon(p.item ?? 'empty');
      $('itemName').textContent = item ? item.name : 'אין אביזר';
      $('item').classList.toggle('ready', !!item);
      $('item').setAttribute('aria-label', item ? 'הפעלת ' + item.name : 'אין אביזר — אספו קלפי');
    }

    // Ability ring.
    const ability = $('ability');
    ability.style.setProperty('--charge', p.ability.toFixed(3));
    ability.classList.toggle('ready', p.ability >= 1);
    $('abilityName').textContent = ABILITIES[selected].name;
    ability.setAttribute(
      'aria-label',
      ABILITIES[selected].name + (p.ability >= 1 ? ' — מוכנה' : ' — ' + Math.round(p.ability * 100) + '%')
    );

    // Drift meter and status line.
    const tier = p.charge > 2.4 ? 3 : p.charge > 1.6 ? 2 : p.charge > 0.65 ? 1 : 0;
    $('driftFill').style.width = (p.charge / 3) * 100 + '%';
    $('driftFill').style.background = ['#9aa8bd', '#7fe9ff', '#ffb14a', '#ee8dff'][tier];
    document.querySelector('.hud-drive').classList.toggle('active', p.drifting);
    $('driftLabel').textContent = p.drifting
      ? ['', 'מיני טורבו', 'סופר טורבו', 'אולטרה טורבו'][tier]
      : Math.abs(p.x) > (p.routeId ? 2.1 : ROAD.driveEdge)
        ? 'חזרה לכביש'
        : '';
    const cap = race.handicap.ballotCap ?? 10;
    // Ballot meter: ten slots, each carried slip a little more top speed; votes tally beside it.
    const carried = Math.min(p.coins, cap);
    if (carried !== lastSlips || cap !== lastCap) {
      lastSlips = carried;
      lastCap = cap;
      $('ballotSlots').innerHTML = Array.from(
        { length: 10 },
        (_, i) => `<i class="${i < carried ? 'on' : i >= cap ? 'off' : ''}"></i>`
      ).join('');
    }
    const bonus = Math.round(((carried * (p.stats?.ballot ?? 0.2)) / 35) * 100);
    $('coins').textContent = compactBallots()
      ? `${p.votes} קולות`
      : `${bonus ? '+' + bonus + '% מהירות · ' : ''}${p.votes} קולות`;
    $('effectStatus').textContent =
      p.confused > 0
        ? 'ההגה הפוך'
        : p.star > 0
          ? 'חסינות־על ' + Math.ceil(p.star)
          : p.shield > 0
            ? 'חסינות ' + Math.ceil(p.shield)
            : p.magnet > 0
              ? 'מגנט ' + Math.ceil(p.magnet)
              : p.routeId
                ? 'דרך סודית'
                : '';

    arena.classList.toggle('boosting', p.boost > 0 && !reduced);
    arena.classList.toggle('hit-flash', p.stun > 0 && !reduced);
    arena.classList.toggle('leaked', p.blind > 0 && !reduced);
    arena.classList.toggle('confused', p.confused > 0);
    arena.classList.toggle('starred', p.star > 0);
    arena.classList.toggle('item-ready', !!p.item);

    watchOrder(race, now);
    pumpTicker(now);
    drawMap(race);
    return position;
  }

  return {
    update,
    onEvent,
    tick,
    resetTicker,
    pumpTicker,
    drawMap,
    reset: () => {
      lastItem = undefined;
      lastSlips = -1;
    }
  };
}
