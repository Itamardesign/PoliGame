// Menus and between-race screens: garage, track picker, results, coalition talks, final count.
import { PARTIES } from './race-model.js';
import { ITEMS, ABILITIES, statBars } from './race-items.js';
import { LEVELS } from './kart-levels.js';
import * as GP from './gp.js';
import { chamberSVG } from './ui-chamber.js';
import { icon } from './ui-icons.js';
import { formatTime } from './kart-hud.js';

const $ = id => document.getElementById(id);
const STAT_NAMES = { speed: 'מהירות', accel: 'תאוצה', handling: 'שליטה', offroad: 'שטח', weight: 'משקל' };
// What each vehicle is, plainly.
export const RIDES = [
  'לימוזינה ממשלתית משוריינת',
  'מכונית GT נמוכה עם כנף אחורית',
  'באגי שטח עם כלוב גלגול ומגפון',
  'מאסל־קאר עם מגדש על',
  'כרכרה מוזהבת עם כס מלכות',
  'ג׳יפ סיור 4×4 עם סירנה'
];

export function renderDrivers(images, selected, onChoose) {
  const list = $('drivers');
  list.innerHTML = '';
  PARTIES.forEach((p, i) => {
    const b = document.createElement('button');
    b.className = 'driver';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(i === selected));
    b.setAttribute('aria-label', `${p.leader} — ${p.name}`);
    b.style.setProperty('--party', p.color);
    b.innerHTML = `<img src="${images[i]}" alt="">`;
    b.onclick = () => onChoose(i);
    list.append(b);
  });
}

export function renderGarage(i) {
  const p = PARTIES[i],
    bars = statBars(i);
  $('garageLogo').src = './assets/' + p.logo;
  $('garageLogo').alt = 'סמל ' + p.name;
  $('garageLeader').textContent = p.leader;
  $('garageRide').textContent = `${p.ride} · ${RIDES[i]}`;
  $('garageStats').style.setProperty('--party', p.color);
  $('garageStats').innerHTML = Object.entries(STAT_NAMES)
    .map(
      ([k, label]) =>
        `<dt>${label}</dt><dd aria-label="${label} ${bars[k]} מתוך 5">${[1, 2, 3, 4, 5].map(n => `<i class="${n <= bars[k] ? 'on' : ''}"></i>`).join('')}</dd>`
    )
    .join('');
  $('garageAbility').textContent = ABILITIES[i].name;
  $('garageAbilityHint').textContent = ABILITIES[i].hint;
  [...$('drivers').children].forEach((b, j) => b.setAttribute('aria-checked', String(j === i)));
}

export function renderTracks(current, onPick) {
  $('trackPicker').innerHTML = LEVELS.map(
    l =>
      `<button class="track" role="radio" data-level="${l.id}" aria-checked="${l.id === current}" style="--track-color:${l.color}"><b>${l.name}</b><small>${l.subtitle}</small><span class="cc">${l.speed}</span></button>`
  ).join('');
  for (const b of $('trackPicker').children) b.onclick = () => onPick(b.dataset.level);
}

// Seats in seating order: the coalition first, then everyone else by size.
export function blocsFor(gp, highlight = true) {
  const inside = [gp.player, ...gp.coalition],
    outside = PARTIES.map((_, id) => id)
      .filter(id => !inside.includes(id))
      .sort((a, b) => gp.seats[b] - gp.seats[a]);
  return [...inside, ...outside].map(id => ({
    id,
    color: PARTIES[id].color,
    seats: gp.seats[id],
    faded: highlight && !inside.includes(id)
  }));
}

export function renderResults({ race, order, images, place, best, level, gp, gained }) {
  const me = race.racers[0];
  const titles = gp
    ? ['ניצחון במרוץ', 'מקום שני', 'מקום שלישי', 'מקום רביעי', 'מקום חמישי', 'מקום שישי']
    : ['ניצחתם', 'מקום שני', 'מקום שלישי', 'מקום רביעי', 'מקום חמישי', 'מקום אחרון'];
  $('resultKicker').textContent = gp
    ? `המרוץ ל־61 · מרוץ ${gp.history.length} מתוך ${GP.GP_RACES.length} · ${level.name}`
    : `${level.name} · ${level.speed}`;
  $('resultTitle').textContent = titles[place - 1];
  $('resultLine').textContent = gp
    ? `${gained[me.id]} מנדטים במרוץ הזה. לקואליציה שלכם יש עכשיו ${GP.coalitionSeats(gp)} מתוך 61 הדרושים.`
    : place === 1
      ? `${formatTime(me.finish)} — ${((order[1].finish ?? order[1].projected) - me.finish).toFixed(2)} שניות לפני ${PARTIES[order[1].id].short}.`
      : `${(me.finish - (order[0].finish ?? order[0].projected)).toFixed(2)} שניות אחרי ${PARTIES[order[0].id].short}.`;
  const lead = order[0].finish ?? order[0].projected;
  $('resultsBoard').innerHTML = order
    .map((r, i) => {
      const p = PARTIES[r.id],
        t = r.finish ?? r.projected;
      return `<li class="${r.player ? 'me' : ''}" style="--party:${p.color}"><span class="rank">${i + 1}</span><i></i><img src="${images[r.id]}" alt=""><span class="who"><b>${p.leader}${r.player ? ' · אתם' : ''}</b><small>${p.name}${gp && gp.coalition.includes(r.id) ? ' · שותפה' : ''}</small></span><span class="time">${i === 0 ? formatTime(t) : '+' + (t - lead).toFixed(2)}</span>${gp ? `<span class="seats">+${gained[r.id]}</span>` : ''}</li>`;
    })
    .join('');
  $('resultTime').textContent = formatTime(me.finish);
  $('resultDrifts').textContent = race.drifts;
  $('resultSecrets').textContent = race.shortcuts;
  $('resultBest').textContent = best ? formatTime(best) : '—';
  const seatPanel = $('resultSeats');
  seatPanel.classList.toggle('hidden', !gp);
  document.querySelector('.sheet.results').classList.toggle('with-seats', !!gp);
  if (gp) {
    const seats = GP.coalitionSeats(gp);
    seatPanel.innerHTML = `<div class="chamber">${chamberSVG(blocsFor(gp), { label: `${seats} מנדטים לקואליציה` })}</div><div class="chamber-sum${seats >= 61 ? ' majority' : ''}"><b>${seats}</b> / 61<small>${gp.coalition.length ? 'אתם ו' + gp.coalition.map(id => PARTIES[id].name).join(' ו') : 'לבד, בינתיים'}</small></div>`;
  }
}

export function renderTalks(gp, { notices = [], onInvite, onDismiss }) {
  const seats = GP.coalitionSeats(gp),
    remaining = GP.GP_RACES.length - gp.round;
  $('talksKicker').textContent =
    `אחרי מרוץ ${gp.round} מתוך ${GP.GP_RACES.length} · ${remaining === 1 ? 'נשאר מרוץ אחד' : 'נשארו ' + remaining + ' מרוצים'}`;
  $('talksChamber').innerHTML = chamberSVG(blocsFor(gp), { label: `${seats} מנדטים לקואליציה` });
  $('talksSum').className = 'chamber-sum' + (seats >= 61 ? ' majority' : '');
  $('talksSum').innerHTML =
    `<b>${seats}</b> / 61<small>${seats >= 61 ? 'יש רוב — עכשיו צריך לשמור עליו' : `חסרים ${61 - seats} מנדטים`}</small>`;
  $('talksNotice').classList.toggle('hidden', !notices.length);
  $('talksNotice').textContent = notices.join(' ');
  const full = gp.coalition.length >= GP.MAX_PARTNERS;
  const partners = gp.coalition.map(id => ({ id, seats: gp.seats[id], joined: true }));
  const rows = [...partners, ...GP.offers(gp)];
  $('offers').innerHTML = rows
    .map(o => {
      const p = PARTIES[o.id],
        demand = GP.DEMANDS[GP.ASKS[o.id]];
      const loyalty = gp.loyalty[o.id];
      let action;
      if (o.joined) action = `<button class="secondary" data-dismiss="${o.id}">פירוק</button>`;
      else if (!o.willing)
        action = `<button class="secondary" disabled title="גדולים מכם ביותר מ־${GP.JUNIOR_MARGIN} מנדטים">לא מעוניינים</button>`;
      else action = `<button class="primary" data-invite="${o.id}"${full ? ' disabled' : ''}>הזמנה</button>`;
      const status = o.joined
        ? `שותפה · נאמנות ${Math.round((loyalty ?? 0.6) * 100)}%`
        : !o.willing
          ? `גדולים מכם ב־${o.seats - gp.seats[gp.player]} מנדטים`
          : o.burned
            ? 'פרשו פעם — נאמנות נמוכה'
            : '';
      return `<li class="offer${o.joined ? ' joined' : ''}" style="--party:${p.color}"><i></i><img src="./assets/${p.logo}" alt=""><div class="who"><b>${p.name} · <span class="seats">${o.seats}</span> מנדטים</b><small class="ask">דורשים: <em>${demand.name}</em> — ${demand.cost}</small>${status ? `<small>${status}</small>` : ''}</div>${action}</li>`;
    })
    .join('');
  for (const b of $('offers').querySelectorAll('[data-invite]'))
    b.onclick = () => onInvite(Number(b.dataset.invite));
  for (const b of $('offers').querySelectorAll('[data-dismiss]'))
    b.onclick = () => onDismiss(Number(b.dataset.dismiss));
}

export function renderFinal(gp) {
  const v = GP.verdict(gp),
    me = PARTIES[gp.player];
  $('finalTitle').textContent =
    v.outcome === 'government'
      ? `${me.leader} מקים ממשלה`
      : v.outcome === 'elections'
        ? 'תיקו 60–60. הולכים לבחירות.'
        : 'האופוזיציה מקימה ממשלה';
  $('finalLine').textContent =
    v.outcome === 'government'
      ? `קואליציה של ${v.seats} מנדטים${gp.coalition.length ? ' עם ' + gp.coalition.map(id => PARTIES[id].name).join(' ו') : ''}.`
      : v.outcome === 'elections'
        ? 'אף גוש לא הגיע ל־61. הקלפיות נפתחות שוב.'
        : `לקואליציה שלכם ${v.seats} מנדטים. ליריבים ${v.opposition}.`;
  $('finalChamber').innerHTML = chamberSVG(blocsFor(gp), { label: `${v.seats} מנדטים` });
  $('finalParties').innerHTML = blocsFor(gp, false)
    .map(
      b =>
        `<li class="${b.id === gp.player || gp.coalition.includes(b.id) ? 'in' : ''}" style="--party:${b.color}"><i></i>${PARTIES[b.id].name}<b>${b.seats}</b></li>`
    )
    .join('');
  return v;
}

export function helpHTML(touch) {
  const keys = touch
    ? [
        ['steer', 'היגוי', 'החזיקו את החצים בצד שמאל.'],
        ['boost', 'גז', 'הקארט מאיץ לבד; גז מוסיף מהירות. הקישו עליו כשמופיע 1 לזינוק טורבו.'],
        ['drift', 'דריפט', 'החזיקו דריפט עם חץ בפנייה, שחררו לטורבו. כחול, כתום, סגול — כל צבע חזק יותר.'],
        ['ballot', 'אביזר', 'אספו קלפי והקישו על האביזר או על המסלול.'],
        ['ability', 'יכולת מיוחדת', 'הטבעת סביב הפנים מתמלאת מנהיגה טובה. הקישו עליה כשהיא מלאה.']
      ]
    : [
        ['steer', 'היגוי', '<kbd>A</kbd><kbd>D</kbd> או <kbd>←</kbd><kbd>→</kbd>. גם במקלדת עברית.'],
        [
          'boost',
          'גז ובלם',
          'הקארט מאיץ לבד; <kbd>W</kbd> מוסיף, <kbd>S</kbd> בולם. <kbd>W</kbd> בדיוק על 1 = זינוק טורבו.'
        ],
        [
          'drift',
          'דריפט',
          'החזיקו <kbd>Shift</kbd> עם כיוון ושחררו לטורבו. כחול, כתום, סגול. <kbd>Shift</kbd> באוויר = תרגיל.'
        ],
        ['ballot', 'אביזר', 'אספו קלפי והפעילו ב־<kbd>רווח</kbd>.'],
        [
          'ability',
          'יכולת מיוחדת',
          'הטבעת סביב הפנים מתמלאת מדריפטים, תרגילים והתחמקויות. <kbd>E</kbd> כשהיא מלאה.'
        ]
      ];
  const items = Object.entries(ITEMS)
    .map(([k, v]) => `<li>${icon(k)}<b>${v.name}</b><small>${ITEM_HELP[k]}</small></li>`)
    .join('');
  return `<h2>איך משחקים</h2>
<ul class="help-grid">${keys.map(([i, t, d]) => `<li>${icon(i)}<b>${t}</b><small>${d}</small></li>`).join('')}</ul>
<h3>המרוץ ל־61</h3>
<p>שלושה מרוצים מחלקים את 120 המנדטים לפי מקום: 12, 9, 7, 5, 4, 3. אף אחד לא מגיע ל־61 לבד. בין המרוצים מזמינים עד שני שותפים — רק מפלגות שלא גדולות מכם ביותר מארבעה מנדטים. שותפים לא תוקפים אתכם ושומרים לכם על הגב, אבל כל אחד מביא דרישה שמכבידה עליכם. פגעתם בשותף, או שהוא עוקף אתכם שוב ושוב? הוא עלול לפרוש.</p>
<h3>אביזרים</h3>
<p>המקום שלכם קובע מה תקבלו: המובילים מקבלים הגנה, מי שמאחור מקבל את הנשק הכבד.</p>
<ul class="help-grid">${items}</ul>
<h3>במסלול</h3>
<p>פתקים מעלים את המהירות המרבית. משטחי טורבו בצד הפנימי של הפניות. מחסומים וכדורים מסתחררים עוצרים — התחמקות צמודה נותנת טורבו. במסלול הראשון יש שתי דרכים סודיות: חפשו שער עם סימן שאלה.</p>
<p><kbd>Esc</kbd> משהה. <kbd>C</kbd> מחליף מצלמה. תוצאות ושיאים נשמרים רק במכשיר הזה.</p>`;
}
const ITEM_HELP = {
  boost: 'טורבו קצר.',
  shield: 'שש שניות של הגנה ממכה אחת.',
  poll: 'עף אל הנהג שלפניכם.',
  magnet: 'אוסף פתקים מרחוק.',
  leak: 'עיתונים מכסים את המסך של מי שלפניכם.',
  filibuster: 'דוכן נאומים חוסם את הנתיב מאחוריכם.',
  spin: 'ההגה של הנהג שלפניכם מתהפך.',
  budget: 'לוקח פתקים מהנהג שלפניכם.',
  noconf: 'פטיש שנוחת על המוביל. גם חסינות לא עוזרת.'
};

export const CREDITS_HTML = `<h2>מקורות וזכויות</h2>
<p>משחק סאטירי עצמאי, ללא שיוך מפלגתי. הנהגים הם קריקטורות של דמויות ציבוריות; הרכבים, היכולות, האביזרים והתוצאות בדיוניים, ואינם סקר או תחזית בחירות. מבחר הנהגים הוא לצורכי המשחק ואינו רשימת מועמדים.</p>
<p>סמלי המפלגות שייכים לבעליהם ואינם מעידים על חסות: <a href="https://www.likud.org.il/" target="_blank" rel="noopener noreferrer">הליכוד</a>, <a href="https://yeshatid.org.il/" target="_blank" rel="noopener noreferrer">יש עתיד</a>, <a href="https://democrats.org.il/" target="_blank" rel="noopener noreferrer">הדמוקרטים</a>, <a href="https://beytenu.org.il/" target="_blank" rel="noopener noreferrer">ישראל ביתנו</a>, <a href="https://en.wikipedia.org/wiki/Shas" target="_blank" rel="noopener noreferrer">ש״ס</a>, <a href="https://en.wikipedia.org/wiki/Otzma_Yehudit" target="_blank" rel="noopener noreferrer">עוצמה יהודית</a>.</p>
<p>דיוקנאות הנהגים מבוססים על תמונות בוויקיפדיה ברישיונות חופשיים (CC BY-SA ונחלת הכלל); הפירוט המלא בקובץ README. גופן Heebo ברישיון SIL OFL. Three.js ברישיון MIT. העולם, הקארטים והאנימציה נבנו בקוד.</p>`;
