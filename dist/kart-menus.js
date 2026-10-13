// Menus and between-race screens: garage, track picker, results, coalition talks, final count.
import { PARTIES } from './race-model.js';
import { ITEMS, ABILITIES } from './race-items.js';
import { LEVELS } from './kart-levels.js';
import * as GP from './gp.js';
import { chamberSVG } from './ui-chamber.js';
import { icon } from './ui-icons.js';
import { formatTime } from './kart-hud.js';
import { FACES } from './kart-faces.js';

const $ = id => document.getElementById(id);
// What each vehicle is, plainly.
export const RIDES = [
  'לימוזינה ממשלתית משוריינת',
  'מכונית GT נמוכה עם כנף אחורית',
  'באגי שטח עם כלוב גלגול ומגפון',
  'מאסל־קאר עם מגדש על',
  'כרכרה מוזהבת עם כס מלכות',
  'ג׳יפ סיור 4×4 עם סירנה',
  'רכב פיקוד פתוח עם אנטנות ומפת מבצע',
  'טרקטור חקלאי עם כספת על הוו'
];

// Driver cards use the same face photos as the 3D heads (already cropped ear to ear, hair to chin).
const FACE_KEYS = Object.keys(FACES);

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
    b.style.setProperty('--i', i);
    b.innerHTML = `<span class="driver-photo"><img src="./assets/faces/${FACE_KEYS[i]}.jpg" alt="" draggable="false"></span><span class="driver-name">${p.short}</span>`;
    b.onclick = () => onChoose(i);
    list.append(b);
  });
}

export function renderGarage(i) {
  const p = PARTIES[i],
    card = $('garageCard');
  $('home').style.setProperty('--party', p.color);
  $('garageLogo').src = './assets/' + p.logo;
  $('garageLogo').alt = 'סמל ' + p.name;
  $('garageLeader').textContent = p.leader;
  $('garageRide').textContent = `${p.ride} · ${RIDES[i]}`;
  $('garageAbility').textContent = ABILITIES[i].name;
  $('garageAbilityHint').textContent = ABILITIES[i].hint;
  [...$('drivers').children].forEach((b, j) => b.setAttribute('aria-checked', String(j === i)));
  // Replay the entrance animation on every pick.
  card.classList.remove('swap');
  void card.offsetWidth;
  card.classList.add('swap');
}

export function renderTracks(current, onPick) {
  $('trackPicker').innerHTML = LEVELS.map(
    l =>
      `<button class="track" data-level="${l.id}" aria-current="${l.id === current}" style="--track-color:${l.color}"><b>${l.name}</b><small>${l.subtitle}</small><span class="cc">${l.speed}</span></button>`
  ).join('');
  for (const b of $('trackPicker').children) b.onclick = () => onPick(b.dataset.level);
}

// Seats in seating order: the coalition first, then a party being considered (drawn as a ghost),
// then everyone else by size.
export function blocsFor(gp, highlight = true, preview = null) {
  const inside = [gp.player, ...gp.coalition],
    outside = PARTIES.map((_, id) => id)
      .filter(id => !inside.includes(id) && id !== preview)
      .sort((a, b) => gp.seats[b] - gp.seats[a]);
  return [...inside, ...(preview === null ? [] : [preview]), ...outside].map(id => ({
    id,
    color: PARTIES[id].color,
    seats: gp.seats[id],
    ghost: id === preview,
    faded: highlight && !inside.includes(id) && id !== preview
  }));
}

export function renderResults({
  race,
  order,
  images,
  place,
  best,
  level,
  gp,
  gained,
}) {
  const me = race.racers[0];
  const titles = gp
    ? ['ניצחון במרוץ', 'מקום שני', 'מקום שלישי', 'מקום רביעי', 'מקום חמישי', 'מקום שישי']
    : ['ניצחתם', 'מקום שני', 'מקום שלישי', 'מקום רביעי', 'מקום חמישי', 'מקום אחרון'];
  $('resultKicker').textContent = gp
    ? `המרוץ ל־61 · מרוץ ${gp.history.length} מתוך ${GP.GP_RACES.length} · ${level.name}`
    : `${level.name} · ${level.speed}`;
  $('resultTitle').textContent = titles[place - 1];
  let line;
  if (gp)
    line = `${gained[me.id]} מנדטים במרוץ הזה. לקואליציה שלכם יש עכשיו ${GP.coalitionSeats(gp)} מתוך 61 הדרושים.`;
  else if (place === 1)
    line = `${formatTime(me.finish)} — ${((order[1].finish ?? order[1].projected) - me.finish).toFixed(2)} שניות לפני ${PARTIES[order[1].id].short}.`;
  else
    line = `${(me.finish - (order[0].finish ?? order[0].projected)).toFixed(2)} שניות אחרי ${PARTIES[order[0].id].short}.`;
  $('resultLine').textContent = line;
  const lead = order[0].finish ?? order[0].projected;
  $('resultsBoard').innerHTML = order
    .map((r, i) => {
      const p = PARTIES[r.id],
        t = r.finish ?? r.projected;
      return `<li class="${r.player ? 'me' : ''}" style="--party:${p.color}"><span class="rank">${i + 1}</span><i></i><img src="${images[r.id]}" alt=""><span class="who"><b>${p.leader}${r.player ? ' · אתם' : ''}</b><small>${p.name} · ${r.votes} קולות${gp && gp.coalition.includes(r.id) ? ' · שותפה' : ''}</small></span><span class="time">${i === 0 ? formatTime(t) : '+' + (t - lead).toFixed(2)}</span>${gp ? `<span class="seats">+${gained[r.id]}</span>` : ''}</li>`;
    })
    .join('');
  $('resultTime').textContent = formatTime(me.finish);
  $('resultDrifts').textContent = race.drifts;
  $('resultBest').textContent = best ? formatTime(best) : '—';
  const seatPanel = $('resultSeats');
  seatPanel.classList.toggle('hidden', !gp);
  document.querySelector('.sheet.results').classList.toggle('with-seats', !!gp);
  if (gp) {
    const seats = GP.coalitionSeats(gp);
    seatPanel.innerHTML = `<div class="chamber">${chamberSVG(blocsFor(gp), { label: `${seats} מנדטים לקואליציה` })}</div><div class="chamber-sum${seats >= 61 ? ' majority' : ''}"><b>${seats}</b> / 61<small>${gp.coalition.length ? 'אתם ו' + gp.coalition.map(id => PARTIES[id].name).join(' ו') : 'לבד, בינתיים'}</small></div>${gp.coalition.length ? `<div class="role-pill r-${GP.standing(gp).role}">${roleText(gp)}</div>` : ''}`;
  }
}

// Where the player stands in the race for the chair, in one line.
export function roleText(gp, st = GP.standing(gp)) {
  const other = st.rival === null ? '' : PARTIES[st.rival].name,
    gap = Math.abs(st.gap ?? 0);
  switch (st.role) {
    case 'pm':
      return st.rival === null ? 'אתם ראש הממשלה' : `אתם ראש הממשלה · ${gap} מנדטים לפני ${other}`;
    case 'rotation-first':
      return `רוטציה עם ${other} — אתם ראשונים${gap ? ` (פער ${gap})` : ''}`;
    case 'rotation-second':
      return `רוטציה עם ${other} — הם ראשונים, ${gap} מנדטים מכם`;
    default:
      return `${PARTIES[st.leader].name} ראש הממשלה, אתם ${GP.ROLES[st.role].title} · ${gap} מנדטים מהכיסא`;
  }
}

export function renderTalks(gp, { notices = [], onInvite, onDismiss }) {
  const seats = GP.coalitionSeats(gp),
    remaining = GP.GP_RACES.length - gp.round;
  $('talksKicker').textContent =
    `אחרי מרוץ ${gp.round} מתוך ${GP.GP_RACES.length} · ${remaining === 1 ? 'נשאר מרוץ אחד' : 'נשארו ' + remaining + ' מרוצים'}`;
  // The chamber shows the coalition as it stands, or as it would be with the party under the pointer.
  const drawChamber = (preview = null) => {
    const total = seats + (preview === null ? 0 : gp.seats[preview]);
    $('talksChamber').innerHTML = chamberSVG(blocsFor(gp, true, preview), { label: `${total} מנדטים לקואליציה` });
    $('talksSum').className = 'chamber-sum' + (total >= 61 ? ' majority' : '') + (preview === null ? '' : ' preview');
    $('talksSum').innerHTML =
      preview === null
        ? `<b>${seats}</b> / 61<small>${seats >= 61 ? 'יש רוב — עכשיו צריך לשמור עליו' : `חסרים ${61 - seats} מנדטים`}</small>`
        : `<b>${total}</b> / 61<small>עם ${PARTIES[preview].name}: ${total >= 61 ? 'רוב!' : `עדיין חסרים ${61 - total}`}</small>`;
    const st = GP.standing(gp, preview);
    $('talksRole').className = 'role-pill r-' + st.role;
    $('talksRole').textContent = roleText(gp, st);
  };
  drawChamber();
  $('talksNotice').classList.toggle('hidden', !notices.length);
  $('talksNotice').textContent = notices.join(' ');
  const full = gp.coalition.length >= GP.MAX_PARTNERS;
  const partners = gp.coalition.map(id => ({ id, seats: gp.seats[id], joined: true, demand: GP.demandOf(gp, id) }));
  const rows = [...partners, ...GP.offers(gp)];
  $('offers').innerHTML = rows
    .map(o => {
      const p = PARTIES[o.id],
        demand = o.demand;
      let action;
      if (o.joined) action = `<button class="secondary" data-dismiss="${o.id}">פירוק</button>`;
      else if (!o.willing) action = `<button class="secondary" disabled>לא מעוניינים</button>`;
      else action = `<button class="primary" data-invite="${o.id}"${full ? ' disabled' : ''}>הזמנה</button>`;
      let status = '';
      // What this partner would do to the player's claim on the chair.
      const chair = o.joined ? GP.standing(gp) : GP.standing(gp, o.id),
        chairNote =
          chair.leader === o.id && chair.role !== 'rotation-first'
            ? `<small class="warn">${chair.role === 'rotation-second' ? 'קרובים אליכם בגודל — רוטציה, והם ראשונים' : 'גדולים מכם — הם יהיו ראש הממשלה'}</small>`
            : chair.rival === o.id && chair.role === 'rotation-first'
              ? '<small class="warn">קרובים אליכם בגודל — רוטציה, אתם ראשונים</small>'
              : '';
      if (o.joined)
        status = `<small class="contract">נאמנות ${Math.round((gp.loyalty[o.id] ?? 0.6) * 100)}% · אל תפגעו בהם, אחרת יפרשו</small>${chairNote}`;
      else if (o.blockedBy !== null)
        status = `<small class="warn">${o.blockedBy === gp.player ? 'לא יושבים איתכם בממשלה' : `לא יושבים עם ${PARTIES[o.blockedBy].name}`}</small>`;
      else if (o.tooBig)
        status = `<small class="warn">גדולים מכם ב־${o.seats - gp.seats[gp.player]} מנדטים — לא יצטרפו כשותפה זוטרה</small>`;
      else if (o.burned) status = '<small class="warn">פרשו פעם — יחזרו עם נאמנות נמוכה</small>' + chairNote;
      else if (full) status = '<small>יש לכם כבר שלושה שותפים — פרקו אחד כדי להזמין</small>';
      else status = chairNote;
      const gain = o.joined
        ? ''
        : `<small class="gain${o.total >= 61 ? ' majority' : ''}">איתם: <b>${o.total}</b>/61${o.total >= 61 ? ' · רוב' : ''}</small>`;
      const seatsLine = o.joined ? `${o.seats} מנדטים` : `<span class="seats">+${o.seats}</span> מנדטים`;
      return `<li class="offer${o.joined ? ' joined' : ''}${!o.joined && !o.willing ? ' blocked' : ''}" data-preview="${o.joined ? '' : o.id}" style="--party:${p.color}"><i></i><img src="./assets/${p.logo}" alt=""><div class="who"><b>${p.name} · ${seatsLine}</b>${gain}<small class="ask">דורשים: <em>${demand.name}</em> <span class="tier t${demand.tier}">דרישה ${demand.weight}</span> — ${demand.cost}</small>${status}</div>${action}</li>`;
    })
    .join('');
  for (const b of $('offers').querySelectorAll('[data-invite]'))
    b.onclick = () => onInvite(Number(b.dataset.invite));
  for (const b of $('offers').querySelectorAll('[data-dismiss]'))
    b.onclick = () => onDismiss(Number(b.dataset.dismiss));
  for (const li of $('offers').querySelectorAll('[data-preview]:not([data-preview=""])')) {
    const show = () => drawChamber(Number(li.dataset.preview)),
      hide = () => drawChamber();
    li.addEventListener('pointerenter', show);
    li.addEventListener('pointerleave', hide);
    li.addEventListener('focusin', show);
    li.addEventListener('focusout', hide);
  }
}

export function renderFinal(gp, images = []) {
  const v = GP.verdict(gp),
    me = PARTIES[gp.player],
    head = v.cabinet[0] ? PARTIES[v.cabinet[0].id] : null,
    names = ids => ids.map(id => PARTIES[id].name).join(' ו');
  const titles = {
    pm: `${me.leader} — ראש הממשלה`,
    'rotation-first': 'ראש הממשלה ברוטציה — אתם ראשונים',
    'rotation-second': 'ראש הממשלה ברוטציה — אתם שניים',
    finance: `${head?.leader} ראש הממשלה. אתם שר האוצר.`,
    defense: `${head?.leader} ראש הממשלה. אתם שר הביטחון.`,
    justice: `${head?.leader} ראש הממשלה. אתם שר המשפטים.`,
    opposition: 'האופוזיציה מקימה ממשלה',
    elections: 'אין רוב לאף גוש. הולכים לבחירות.'
  };
  $('finalTitle').textContent = titles[v.role];
  $('finalLine').textContent =
    v.outcome === 'government'
      ? `קואליציה של ${v.seats} מנדטים${gp.coalition.length ? ' עם ' + names(gp.coalition) : ''}. ${
          v.role === 'pm' || v.role === 'rotation-first'
            ? 'הייתם הגדולים בקואליציה.'
            : `${PARTIES[v.cabinet[0].id].name} גדולה מכם ב־${v.cabinet[0].seats - gp.seats[gp.player]} מנדטים.`
        }`
      : v.outcome === 'elections'
        ? `לכם ${v.seats} מנדטים. היריבים, עם כל הווטו ביניהם, מגיעים לכל היותר ל־${v.rival}. הקלפיות נפתחות שוב.`
        : `לקואליציה שלכם ${v.seats} מנדטים. ${names(v.cabinet.map(m => m.id))} הרכיבו ממשלה של ${v.rival}.`;
  $('finalGovTitle').textContent = v.cabinet.length ? 'הממשלה' : 'אין ממשלה';
  $('finalCabinet').innerHTML = v.cabinet
    .map(m => {
      const p = PARTIES[m.id],
        mine = m.id === gp.player;
      return `<li class="${mine ? 'me' : ''} c-${m.role}" style="--party:${p.color}">${images[m.id] ? `<img src="${images[m.id]}" alt="">` : '<span class="noface"></span>'}<span class="job">${m.title}</span><b>${p.leader}${mine ? ' · אתם' : ''}</b><small>${p.name} · ${m.seats} מנדטים</small></li>`;
    })
    .join('');
  // The ladder: every possible ending, best first, with the player's rung marked.
  $('finalLadder').innerHTML = GP.LADDER.map(
    (key, i) =>
      `<li class="${key === v.role ? 'here' : i < v.rank ? 'above' : ''}"><span>${GP.ROLES[key].title}</span>${key === v.role ? '<em>אתם כאן</em>' : ''}</li>`
  ).join('');
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
<p>שלושה מרוצים מחלקים את 120 המנדטים לפי מקום: 9, 7, 6, 4, 3, 2, 2, 1. אף אחד לא מגיע ל־61 לבד. בין המרוצים מזמינים עד שלושה שותפים — רק מפלגות שלא גדולות מכם ביותר מארבעה מנדטים. שותפים לא תוקפים אתכם ושומרים לכם על הגב, אבל כל אחד מביא דרישה שמכבידה עליכם. פגעתם בשותף, או שהוא עוקף אתכם שוב ושוב? הוא עלול לפרוש.</p>
<h3>אביזרים</h3>
<p>המקום שלכם קובע מה תקבלו: המובילים מקבלים הגנה, מי שמאחור מקבל את הנשק הכבד.</p>
<ul class="help-grid">${items}</ul>
<h3>פתקים = קולות</h3>
<p>כל פתק שאוספים הוא קול. עד עשרה פתקים שאתם נושאים מעלים את המהירות המרבית — המד בתחתית המסך מראה כמה. ספין מפיל שלושה פתקים מהקארט (המהירות יורדת, הקולות נשארים). במרוץ ל־61 שישה מתוך 40 המנדטים בכל מרוץ מתחלקים לפי מספר הקולות.</p>
<h3>המסלול, שבועיים לפני הבחירות</h3>
<p>שדרות הכנסת עם מסך סקר חי, מחסום ועדת הבחירות (נסיעה בנתיב שלה עם אביזר ביד — והוא מוחרם, אבל יש שם משטח טורבו), עלייה לגשר המיתרים, סיבובי ה־S של מחנה יהודה, קפיצה מראש הגבעה לימין משה, הסיבוב סביב העיר העתיקה ומנהרת הכנסת חזרה לקו.</p>
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
<p>סמלי המפלגות שייכים לבעליהם ואינם מעידים על חסות: <a href="https://www.likud.org.il/" target="_blank" rel="noopener noreferrer">הליכוד</a>, <a href="https://en.wikipedia.org/wiki/Bennett_2026" target="_blank" rel="noopener noreferrer">ביחד (בנט 2026)</a>, <a href="https://democrats.org.il/" target="_blank" rel="noopener noreferrer">הדמוקרטים</a>, <a href="https://beytenu.org.il/" target="_blank" rel="noopener noreferrer">ישראל ביתנו</a>, <a href="https://en.wikipedia.org/wiki/Shas" target="_blank" rel="noopener noreferrer">ש״ס</a>, <a href="https://en.wikipedia.org/wiki/Otzma_Yehudit" target="_blank" rel="noopener noreferrer">עוצמה יהודית</a>, ישר! עם איזנקוט, <a href="https://en.wikipedia.org/wiki/Religious_Zionist_Party" target="_blank" rel="noopener noreferrer">הציונות הדתית</a>.</p>
<p>דיוקנאות הנהגים מבוססים על תמונות בוויקיפדיה ברישיונות חופשיים (CC BY-SA ונחלת הכלל); הפירוט המלא בקובץ README. גופן Heebo ברישיון SIL OFL. Three.js ברישיון MIT. העולם, הקארטים והאנימציה נבנו בקוד.</p>`;
