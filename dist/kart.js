import * as T from './vendor/three.module.min.js';
import {
  PARTIES,
  LAPS,
  ROAD,
  SECTORS,
  sectorAt,
  makeRace,
  stepRace,
  ranking,
  grantItem,
  useItem,
  hitRacer,
  clamp,
  emitRace,
  launch
} from './race-model.js';
import {
  makeKart,
  loadLogos,
  makeTrack,
  buildWorld,
  makePickup,
  mat,
  batchStatic,
  box,
  label
} from './kart-world.js';
import { makeShortcuts, racerFrame, routeBend, buildShortcuts } from './kart-routes.js';
import { stepEncounters, bumpRivals } from './kart-encounters.js';
import { makeEncounterWorld } from './kart-encounter-world.js';
import { makeEffects } from './kart-effects.js';
import { KEY_ACTIONS, readControls } from './kart-input.js';
import { LEVELS, levelById } from './kart-levels.js';
await document.fonts.load('900 80px Heebo');
const $ = id => document.getElementById(id),
  arena = $('arena'),
  canvas = $('game');
const level = levelById(new URLSearchParams(location.search).get('level'));
arena.classList.add('level-' + level.id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let renderer;
try {
  renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  $('loading').classList.add('hidden');
  $('error').classList.remove('hidden');
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
const scene = new T.Scene();
scene.background = new T.Color(level.sky);
scene.fog = new T.Fog(level.fog, 115, 340);
scene.add(
  new T.HemisphereLight(
    level.id === 'midnight' ? '#b9cfff' : '#fff9df',
    level.id === 'midnight' ? '#455675' : '#5b7e6f',
    level.id === 'midnight' ? 1.65 : 2.0
  )
);
const sun = new T.DirectionalLight(
  level.id === 'midnight' ? '#b9bfff' : level.id === 'market' ? '#ffe1ad' : '#fff1d4',
  level.id === 'midnight' ? 2.35 : 3.1
);
sun.position.set(-25, 60, -30);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 160 });
sun.shadow.normalBias = 0.06;
scene.add(sun);
scene.add(sun.target);
const camera = new T.PerspectiveCamera(46, 1, 0.1, 420),
  track = makeTrack(level.id);
track.shortcuts = level.id === 'jerusalem' ? makeShortcuts(track) : [];
const world = new T.Group();
scene.add(world);
buildWorld(world, track);
buildShortcuts(world, track, box, label, mat);
const gantryMeshes = new Set();
world.userData.gantry.traverse(m => gantryMeshes.add(m));
batchStatic(world, gantryMeshes);
let selected = 0,
  state = 'home',
  race = null,
  count = 0,
  elapsed = 0,
  last = 0,
  toastUntil = 0,
  sound = false,
  audio,
  previousRank = 6,
  confetti = [];
const heldKeys = new Set(),
  touchKeys = new Set();
const controls = readControls(heldKeys, touchKeys);
function syncControls() {
  Object.assign(controls, readControls(heldKeys, touchKeys));
}
const compactTouchLayout = () =>
  matchMedia('(max-width:650px), (pointer:coarse) and (max-width:1024px)').matches;
function placePlay() {
  const button = $('play'),
    target = matchMedia('(max-width:650px)').matches
      ? document.querySelector('.select-garage')
      : document.querySelector('.hero-copy');
  if (button.parentElement === target) return;
  if (target.classList.contains('hero-copy')) target.insertBefore(button, target.querySelector('.micro'));
  else target.append(button);
}
placePlay();
addEventListener('resize', placePlay);
const stored = (key, fallback) => {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
};
const save = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {}
};
let sensitivity = clamp(Number(stored('ck-steering', '1')) || 1, 0.65, 1.35),
  wideCamera = stored('ck-camera', 'wide') === 'wide';
$('steeringSensitivity').value = sensitivity;
$('sensitivityValue').textContent = Math.round(sensitivity * 100) + '%';
$('steeringSensitivity').oninput = e => {
  sensitivity = Number(e.target.value);
  save('ck-steering', sensitivity);
  $('sensitivityValue').textContent = Math.round(sensitivity * 100) + '%';
};
function toggleCamera() {
  wideCamera = !wideCamera;
  save('ck-camera', wideCamera ? 'wide' : 'close');
  toast(wideCamera ? 'מצלמה רחבה · רואים את הפנייה הבאה' : 'מצלמה קרובה · ישר לאקשן');
}
$('camera').onclick = toggleCamera;
selected = clamp(Number(stored('ck-driver', '0')) || 0, 0, PARTIES.length - 1);
sound = stored('ck-sound', 'off') === 'on';
$('sound').setAttribute('aria-pressed', String(sound));
function tone(freq = 500, duration = 0.12, type = 'triangle', volume = 0.045) {
  if (!sound) return;
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') audio.resume();
    const o = audio.createOscillator(),
      g = audio.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, audio.currentTime);
    o.frequency.exponentialRampToValueAtTime(freq * 0.65, audio.currentTime + duration);
    g.gain.setValueAtTime(volume, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    o.connect(g);
    g.connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + duration);
  } catch {}
}
function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('visible');
  toastUntil = elapsed + 2.4;
}
function pulse(pattern = 16) {
  if (compactTouchLayout() && navigator.vibrate) navigator.vibrate(pattern);
}
function prepareKart(g) {
  const eyeMeshes = new Set();
  g.userData.eyes.forEach(eye => eye.traverse(m => eyeMeshes.add(m)));
  batchStatic(g.userData.head, eyeMeshes);
  const dynamic = new Set([
    g.userData.shield,
    ...g.userData.flames,
    g.userData.name,
    ...g.userData.fx.map(f => f.mesh)
  ]);
  g.userData.wheels.forEach(w => w.traverse(m => dynamic.add(m)));
  g.userData.head.traverse(m => dynamic.add(m));
  batchStatic(g, dynamic);
  return g;
}
const portraits = [];
let seenEvent = 0,
  launchPressed = 99,
  feedbackUntil = 0,
  engineOsc,
  engineGain,
  engineFilter;
const logos = await loadLogos(),
  karts = PARTIES.map((_, i) => {
    const g = makeKart(i, logos);
    prepareKart(g);
    scene.add(g);
    return g;
  });
const fx = makeEffects(scene, track, karts, reduced);
const encounters = makeEncounterWorld(scene, track, box, label, mat);
function feedback(text, kind = 'good') {
  $('feedback').textContent = text;
  $('feedback').className = 'race-feedback ' + kind;
  feedbackUntil = elapsed + 1.35;
}
function updateEngine() {
  if (!audio) return;
  if (!engineOsc) {
    engineOsc = audio.createOscillator();
    engineGain = audio.createGain();
    engineFilter = audio.createBiquadFilter();
    engineOsc.type = 'sawtooth';
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 220;
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(audio.destination);
    engineOsc.start();
  }
  const active = sound && state === 'running',
    p = race?.racers[0];
  engineOsc.frequency.setTargetAtTime(40 + (p?.speed || 0) * 2.5, audio.currentTime, 0.08);
  engineGain.gain.setTargetAtTime(active ? 0.016 : 0, audio.currentTime, 0.06);
}
// Small rendered portraits reuse the same 3D models as the race, not stock images.
const thumbRenderer = new T.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
thumbRenderer.setSize(300, 170);
thumbRenderer.setPixelRatio(1);
thumbRenderer.outputColorSpace = T.SRGBColorSpace;
thumbRenderer.toneMapping = T.ACESFilmicToneMapping;
thumbRenderer.toneMappingExposure = 1.3;
const thumbScene = new T.Scene();
thumbScene.add(new T.HemisphereLight('#fffbe2', '#94a587', 3));
const light = new T.DirectionalLight('#fff8de', 4);
light.position.set(4, 7, 5);
thumbScene.add(light);
const thumbCamera = new T.PerspectiveCamera(34, 300 / 170, 0.1, 50);
thumbCamera.position.set(5.4, 4.3, 7.8);
thumbCamera.lookAt(0, 1.5, 0);
PARTIES.forEach((p, i) => {
  const model = makeKart(i, logos);
  thumbScene.add(model);
  thumbRenderer.render(thumbScene, thumbCamera);
  const image = thumbRenderer.domElement.toDataURL('image/png');
  thumbCamera.position.set(0, 3.0, 4.9);
  thumbCamera.lookAt(0, 2.88, 0);
  thumbRenderer.render(thumbScene, thumbCamera);
  portraits[i] = thumbRenderer.domElement.toDataURL('image/png');
  thumbCamera.position.set(5.4, 4.3, 7.8);
  thumbCamera.lookAt(0, 1.5, 0);
  thumbScene.remove(model);
  const button = document.createElement('button');
  button.className = 'driver';
  button.setAttribute('aria-label', p.leader + ' — ' + p.name);
  button.setAttribute('aria-pressed', String(i === selected));
  button.innerHTML = `<img class="portrait" src="${image}" alt="קארט ${p.name}"><img class="party-mark" src="./assets/${p.logo}" alt="סמל ${p.name}"><span class="selected-tick">✓</span><strong>${p.leader}</strong><small>${p.name}</small>`;
  button.onclick = () => choose(i);
  $('drivers').append(button);
});
thumbRenderer.dispose();
const sparkGeometry = new T.SphereGeometry(0.055, 4, 3),
  sparkMaterials = [
    new T.MeshBasicMaterial({ color: '#76e8fa' }),
    new T.MeshBasicMaterial({ color: '#ffb346' }),
    new T.MeshBasicMaterial({ color: '#e897ff' })
  ];
const sparks = Array.from({ length: 38 }, () => {
  const mesh = new T.Mesh(sparkGeometry, sparkMaterials[0]);
  mesh.visible = false;
  scene.add(mesh);
  return { mesh, life: 0, v: new T.Vector3() };
});
let sparkIndex = 0,
  sparkClock = 0;
function updateSparks(dt) {
  for (const p of sparks) {
    if (p.life <= 0) continue;
    p.life -= dt;
    p.v.y -= dt * 4;
    p.mesh.position.addScaledVector(p.v, dt);
    p.mesh.scale.setScalar(Math.max(0, p.life * 3));
    p.mesh.visible = p.life > 0;
  }
  if (state !== 'running' || reduced) return;
  const r = race.racers[0];
  if (!r.drifting || r.charge < 0.25) return;
  sparkClock += dt;
  if (sparkClock < 0.035) return;
  sparkClock = 0;
  for (const side of [-1, 1]) {
    const p = sparks[sparkIndex++ % sparks.length];
    p.life = 0.32;
    p.mesh.visible = true;
    p.mesh.material = sparkMaterials[r.charge > 2.4 ? 2 : r.charge > 1.6 ? 1 : 0];
    p.mesh.position.copy(karts[r.id].localToWorld(new T.Vector3(side * 1.1, 0.35, -1.2)));
    const t = track.at(r.s).t;
    p.v.set(-t.x * 3 + side * 2, 1.3, -t.z * 3);
  }
}
const pickups = [];
const templates = Object.fromEntries(
  ['box', 'coin', 'barrier', 'boost', 'ramp'].map(k => [k, makePickup(k)])
);
function addPickup(type, s, x) {
  const mesh = templates[type].clone(true),
    { p, t } = track.at(s, x);
  mesh.position.copy(p);
  mesh.rotation.y = Math.atan2(t.x, t.z);
  scene.add(mesh);
  pickups.push({ type, s, x, mesh, lastLap: -1, baseY: p.y });
}
for (let s = 35; s < track.length; s += 67) for (const x of [-6.5, 0, 6.5]) addPickup('box', s, x);
for (let s = 19; s < track.length; s += 28)
  for (let j = 0; j < 3; j++) addPickup('coin', s + j * 3.5, Math.sin(s * 0.06) * 6.2);
for (let s = 68; s < track.length; s += 57) addPickup('barrier', s, Math.sin(s * 0.2) * 6.2);
for (let s = 95; s < track.length; s += 150) addPickup('boost', s, Math.sign(track.bend(s) || 1) * -7.3);
for (const u of [0.33, 0.73]) addPickup('ramp', track.length * u, 0);
function clearControls() {
  heldKeys.clear();
  touchKeys.clear();
  if (race) {
    race.racers[0].steer = 0;
    race.racers[0].lateral = 0;
  }
  for (const key in controls) controls[key] = false;
  document.querySelectorAll('[data-key]').forEach(b => b.classList.remove('active'));
}
function choose(i) {
  const changed = selected !== i;
  selected = i;
  save('ck-driver', i);
  [...$('drivers').children].forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)));
  $('driverFace').src = portraits[i];
  $('driverFace').alt = PARTIES[i].leader;
  $('driverNick').textContent = PARTIES[i].short;
  $('rideName').textContent = PARTIES[i].ride;
  $('rideTag').textContent = PARTIES[i].tag;
  if (changed) pulse(20);
  tone(380 + i * 60, 0.08);
}
function formatTime(t) {
  return `${Math.floor(t / 60)
    .toString()
    .padStart(2, '0')}:${(t % 60).toFixed(2).padStart(5, '0')}`;
}
function renderLevels() {
  $('levels').innerHTML = LEVELS.map(
    item =>
      `<button class="level-card" type="button" data-level="${item.id}" aria-pressed="${item.id === level.id}" style="--level-color:${item.color}"><span class="level-number">${item.number}</span><span class="level-copy"><strong>${item.name}</strong><small>${item.subtitle}</small></span><span class="level-rank"><b>${item.speed}</b><small>${item.badge}</small></span></button>`
  ).join('');
  for (const button of $('levels').children)
    button.onclick = () => {
      if (button.dataset.level === level.id) return;
      const url = new URL(location.href);
      url.searchParams.set('level', button.dataset.level);
      location.assign(url.href);
    };
  $('currentTrackName').textContent = level.name;
  $('currentTrackEnglish').textContent = level.english;
  document.querySelector('.home-kicker>span:last-child').textContent = `LEVEL ${level.number} / 03`;
  document.title = `${level.name} — קואליציה קארט`;
  document.querySelector('.race-top small').textContent = level.name;
  document.querySelector('.map-wrap>span').textContent = level.name;
}
function start() {
  clearControls();
  fx.reset();
  seenEvent = 0;
  launchPressed = 99;
  race = makeRace(selected, level.difficulty, Date.now(), track.length, track.shortcuts, level.id);
  state = 'countdown';
  count = 3.5;
  previousRank = 6;
  pickups.forEach(p => {
    p.lastLap = -1;
    p.mesh.visible = true;
  });
  confetti.forEach(p => scene.remove(p.mesh));
  confetti = [];
  for (const id of ['home', 'results', 'pauseScreen']) $(id).classList.add('hidden');
  for (const id of ['hud', 'countdown', 'touch', 'raceHint']) $(id).classList.remove('hidden');
  arena.classList.add('racing');
  $('countdown').textContent = '3';
  $('raceHint').textContent = compactTouchLayout()
    ? 'הקישו גז כשהספירה מגיעה ל־1 לזינוק טורבו!'
    : 'לחצו W / ↑ או גז כשהספירה מגיעה ל־1 לזינוק טורבו!';
  pulse(28);
  canvas.focus({ preventScroll: true });
  resize();
  updateKarts(0);
  updateHUD();
  setCamera(true);
  tone(550, 0.15);
}
function goHome() {
  fx.reset();
  arena.classList.remove('boosting', 'hit-flash', 'shielded', 'magnetized', 'item-ready', 'launch-window');
  state = 'home';
  clearControls();
  for (const id of ['hud', 'results', 'pauseScreen', 'countdown', 'touch']) $(id).classList.add('hidden');
  $('home').classList.remove('hidden');
  arena.classList.remove('racing');
  karts.forEach(k => {
    k.userData.name.visible = false;
    k.userData.shield.visible = false;
    k.userData.flames.forEach(f => (f.visible = false));
  });
  pickups.forEach(p => (p.mesh.visible = true));
  resize();
  $('play').focus({ preventScroll: true });
}
function pause() {
  if (!['running', 'countdown'].includes(state)) return;
  stateBeforePause = state;
  state = 'paused';
  clearControls();
  $('pauseScreen').classList.remove('hidden');
  $('resume').focus({ preventScroll: true });
}
let stateBeforePause = 'running';
function resume() {
  if (state !== 'paused') return;
  state = stateBeforePause;
  last = performance.now();
  $('pauseScreen').classList.add('hidden');
  canvas.focus({ preventScroll: true });
}
const itemNames = {
  boost: ['↯', 'טורבו הבטחות'],
  shield: ['◉', 'חסינות פרלמנטרית'],
  poll: ['↝', 'סקר מפתיע'],
  magnet: ['🧲', 'מגנט מנדטים']
};
function activateItem() {
  if (state !== 'running') return;
  const item = useItem(race, race.racers[0]);
  if (item) {
    if (compactTouchLayout()) navigator.vibrate?.(35);
    updateHUD();
  }
}
function consumeEvents() {
  for (const e of race.events) {
    if (e.seq <= seenEvent) continue;
    seenEvent = e.seq;
    fx.event(e, race);
    const me = e.id === selected;
    if (e.type === 'poll-fired' && e.target === selected) {
      feedback('סקר בדרך אליכם! הפעילו חסינות', 'danger');
      tone(230, 0.2, 'square');
    }
    if (!me) continue;
    const messages = {
      jackpot: 'בונוס! 3 פתקים + טורבו',
      'near-miss': 'כמעט! התחמקות = טורבו',
      ram: 'בום! עקיפה בכוח הטורבו',
      bump: 'מגע! שמרו על הקו',
      'shortcut-enter': 'מצאתם דרך סודית!',
      'shortcut-exit': 'חזרתם למרוץ!',
      slipstream: 'סליפסטרים! עקיפה חכמה',
      trick: 'סטייל! מתכוננים לנחיתה',
      'shield-break': 'החסינות ספגה את הפגיעה',
      'no-target': 'אין יריב בטווח הסקר',
      'launch-boost': 'זינוק מושלם!'
    };
    if (messages[e.type]) {
      feedback(messages[e.type]);
      tone(750, 0.18);
    }
    if (e.type === 'item-use') {
      const msg = {
        boost: 'טורבו הבטחות!',
        shield: 'חסינות פעילה · 6 שניות',
        magnet: 'מגנט מנדטים · 7 שניות',
        poll: 'הסקר יצא לדרך!'
      };
      toast(msg[e.item]);
      tone(e.item === 'boost' ? 880 : 550, 0.22);
    }
    if (e.type === 'hit') {
      feedback('ספין! חוזרים לעניינים…', 'danger');
      tone(130, 0.24, 'sawtooth');
    }
    if (e.type === 'drift-charge') {
      feedback(['', 'מיני טורבו מוכן', 'סופר טורבו מוכן', 'אולטרה טורבו מוכן!'][e.tier]);
      tone(450 + e.tier * 210, 0.09);
    }
    if (e.type === 'land' && e.trick) {
      feedback('נחיתה מושלמת! + טורבו');
      tone(1100, 0.24);
    }
    if (e.type === 'jump') {
      feedback(compactTouchLayout() ? 'הקישו דריפט באוויר לתרגיל!' : 'SHIFT באוויר = תרגיל!');
      tone(680, 0.18);
    }
  }
}
function updateKarts(dt) {
  if (!race) return;
  for (const r of race.racers) {
    const kart = karts[r.id],
      { p, t } = racerFrame(track, r);
    kart.position.copy(p);
    const jump = r.air > 0 ? Math.sin((1 - r.air / r.airTotal) * Math.PI) * 3.2 : 0;
    kart.position.y += jump + (r.hop > 0 ? Math.sin((r.hop / 0.23) * Math.PI) * 0.3 : 0);
    kart.position.y += reduced ? 0 : Math.sin(elapsed * 17 + r.id) * 0.018;
    kart.rotation.x = Math.atan2(-t.y, Math.hypot(t.x, t.z));
    const steer = r.player ? r.steer : 0;
    kart.rotation.set(
      Math.atan2(-t.y, Math.hypot(t.x, t.z)),
      Math.atan2(t.x, t.z) + (r.drifting ? -steer * 0.38 : -steer * 0.16),
      -steer * 0.055
    );
    if (r.stun > 0 && !reduced) kart.rotation.y += Math.sin((1 - r.stun / 1.8) * Math.PI * 3) * 0.95;
    if (r.trick && r.air > 0 && !reduced) kart.rotation.y += (1 - r.air / r.airTotal) * Math.PI * 2;
    kart.userData.head.rotation.z = reduced ? 0 : Math.sin(elapsed * 4 + r.id) * 0.03 - r.steer * 0.045;
    kart.userData.head.rotation.y = r.player ? -r.steer * 0.15 : Math.sin(elapsed * 0.8 + r.id) * 0.1;
    for (const eye of kart.userData.eyes) eye.scale.y = (elapsed + r.id * 0.7) % 4.7 < 0.13 ? 0.12 : 1;
    kart.scale.setScalar(1);
    kart.userData.wheels.forEach(w => (w.rotation.x += r.speed * dt * 1.5));
    kart.userData.shield.visible = r.shield > 0 || r.magnet > 0;
    kart.userData.shield.material.color.set(r.shield > 0 ? '#80e8fa' : '#ee8ce0');
    kart.userData.shield.material.opacity = 0.12 + Math.sin(elapsed * 6) * 0.035;
    kart.userData.flames.forEach(f => {
      f.visible = r.boost > 0;
      f.scale.y = 1 + Math.sin(elapsed * 37) * 0.24;
    });
    for (const f of kart.userData.fx)
      f.mesh.visible = reduced || Math.floor(elapsed * f.rate + (f.phase || 0)) % 2 === 0;
    kart.visible = !(r.hitCooldown > 0 && r.stun > 0 && Math.floor(elapsed * 12) % 2 === 0);
    kart.userData.name.visible = !r.player;
    kart.userData.name.quaternion.copy(camera.quaternion).premultiply(kart.quaternion.clone().invert());
  }
}
const camTarget = new T.Vector3();
function setCamera(snap = false, dt = 1 / 60) {
  world.userData.gantry.visible = state !== 'home';
  let position, look;
  if (state === 'home') {
    const featured = karts[selected];
    PARTIES.forEach((p, i) => {
      const k = karts[i];
      k.visible = true;
      k.scale.setScalar(i === selected ? 1.7 : 0.85);
      const data = track.at(i === selected ? 8 : 23 + (i % 3) * 5, i === selected ? -1 : i % 2 ? 3 : -3);
      k.position.copy(data.p);
      k.rotation.set(0, Math.atan2(data.t.x, data.t.z) + Math.PI + (i === selected ? -0.2 : 0), 0);
    });
    const focus = featured.position.clone(),
      mobile = innerWidth <= 650;
    position = focus.clone().add(new T.Vector3(mobile ? 12 : 15, mobile ? 10 : 10, -17));
    look = focus.clone().add(new T.Vector3(mobile ? 0 : -5, mobile ? 1 : -1, 0));
  } else if (race) {
    const r = race.racers[0],
      a = racerFrame(track, r),
      ahead = racerFrame(track, r, wideCamera ? 17 : 12);
    position = a.p.clone().addScaledVector(a.t, -(wideCamera ? 14.2 : 10.5));
    position.y += wideCamera ? 7.8 : 5.8;
    look = ahead.p.clone();
    look.y += 1.0;
    if (r.boost > 0 && !reduced) position.addScaledVector(a.t, -1);
  }
  if (!position) return;
  camera.position.lerp(position, snap ? 1 : -Math.expm1(-8 * dt));
  camTarget.lerp(look, snap ? 1 : -Math.expm1(-10 * dt));
  if (fx.shake > 0 && !reduced)
    camera.position.add(
      new T.Vector3(Math.sin(elapsed * 77) * fx.shake * 0.5, Math.cos(elapsed * 61) * fx.shake * 0.25, 0)
    );
  camera.lookAt(camTarget);
  const desiredFov =
    state === 'home'
      ? innerWidth <= 650
        ? 47
        : 46
      : (innerWidth <= 650 ? 57 : wideCamera ? 55 : 49) + (race?.racers[0].boost > 0 && !reduced ? 5 : 0);
  camera.fov += (desiredFov - camera.fov) * (snap ? 1 : -Math.expm1(-dt * 5));
  camera.updateProjectionMatrix();
  const focus = state === 'home' ? karts[selected].position : racerFrame(track, race.racers[0]).p;
  sun.position.copy(focus).add(new T.Vector3(-25, 55, -30));
  sun.target.position.copy(focus);
}
function resize() {
  const rect = arena.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height, false);
  camera.aspect = rect.width / rect.height;
  camera.fov = innerWidth <= 650 ? (state === 'home' ? 47 : 54) : 46;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(arena);
resize();
const map = $('minimap').getContext('2d'),
  mapBounds = new T.Box3().setFromPoints(
    Array.from({ length: 120 }, (_, i) => track.at((i / 120) * track.length).p)
  );
function drawMap() {
  map.clearRect(0, 0, 240, 180);
  const project = p => ({
    x: 22 + ((p.x - mapBounds.min.x) / (mapBounds.max.x - mapBounds.min.x)) * 196,
    y: 168 - ((p.z - mapBounds.min.z) / (mapBounds.max.z - mapBounds.min.z)) * 154
  });
  map.beginPath();
  for (let i = 0; i <= 100; i++) {
    const p = project(track.at((i / 100) * track.length).p);
    if (!i) map.moveTo(p.x, p.y);
    else map.lineTo(p.x, p.y);
  }
  map.strokeStyle = '#526c5366';
  map.lineWidth = 11;
  map.lineJoin = 'round';
  map.stroke();
  map.strokeStyle = '#e8f0cf';
  map.lineWidth = 6;
  map.stroke();
  map.save();
  map.setLineDash([3, 4]);
  map.lineWidth = 2;
  map.strokeStyle = '#e8a9cb';
  for (const route of track.shortcuts) {
    map.beginPath();
    for (let i = 0; i <= 30; i++) {
      const p = project(route.at((i / 30) * route.length).p);
      if (!i) map.moveTo(p.x, p.y);
      else map.lineTo(p.x, p.y);
    }
    map.stroke();
  }
  map.restore();
  for (const r of [...race.racers].reverse()) {
    const p = project(racerFrame(track, r).p);
    map.beginPath();
    map.arc(p.x, p.y, r.player ? 5 : 3.5, 0, Math.PI * 2);
    map.fillStyle = PARTIES[r.id].color;
    map.fill();
    map.strokeStyle = r.player ? '#fffde7' : '#486343';
    map.lineWidth = r.player ? 2 : 1;
    map.stroke();
  }
}
let hudClock = 0;
function updateHUD() {
  const p = race.racers[0],
    order = ranking(race),
    position = order.indexOf(p) + 1;
  $('position').innerHTML = position + '<span>/6</span>';
  $('lap').textContent = `הקפה ${Math.min(LAPS, Math.floor(Math.max(0, p.s) / track.length) + 1)} / ${LAPS}`;
  $('clock').textContent = formatTime(race.time);
  const sector = track.sectors[sectorAt(p.s, track.length)];
  $('sectorName').textContent = sector.name;
  $('sectorName').style.setProperty('--sector', sector.color);
  $('lapProgress').style.width = ((Math.max(0, p.s) % track.length) / track.length) * 100 + '%';
  arena.classList.toggle('boosting', p.boost > 0 && !reduced);
  arena.classList.toggle('hit-flash', p.stun > 0 && !reduced);
  arena.classList.toggle('shielded', p.shield > 0);
  arena.classList.toggle('magnetized', p.magnet > 0);
  $('effectStatus').textContent = p.routeId
    ? '✦ דרך סודית'
    : p.magnet > 0
      ? '🧲 ' + Math.ceil(p.magnet) + 's'
      : p.shield > 0
        ? '◉ ' + Math.ceil(p.shield) + 's'
        : p.air > 0
          ? '↑ באוויר'
          : '';
  if (p.routeId) $('sectorName').textContent = track.shortcuts.find(r => r.id === p.routeId).name;
  $('speed').textContent = Math.round(p.speed * 4);
  $('speedFill').style.width = (p.speed / 47) * 100 + '%';
  $('coins').textContent = `${p.coins} / 10 פתקים`;
  $('driftFill').style.width = (p.charge / 3) * 100 + '%';
  $('driftFill').style.background = p.charge > 2.4 ? '#e797ff' : p.charge > 1.6 ? '#f5b04f' : '#7cebf9';
  $('driftLabel').textContent = p.drifting
    ? p.charge > 2.4
      ? 'אולטרה טורבו! שחררו SHIFT'
      : p.charge > 1.6
        ? 'סופר טורבו! שחררו SHIFT'
        : p.charge > 0.65
          ? 'טורבו מוכן · שחררו SHIFT'
          : 'טוענים דריפט…'
    : p.boost > 0
      ? 'טורבו! יאללה לעקוף'
      : p.shield > 0
        ? 'חסינות פעילה'
        : Math.abs(p.x) > ROAD.driveEdge
          ? 'חזרו לכביש! הדשא מאט'
          : p.routeId
            ? 'דרך סודית · שמרו על הקו'
            : p.air > 0
              ? 'SHIFT באוויר = תרגיל'
              : p.slipstream > 0.2
                ? 'טוענים סליפסטרים…'
                : 'SHIFT + פנייה = דריפט';
  document.querySelector('.drift-meter').classList.toggle('active', p.drifting || p.boost > 0);
  if (compactTouchLayout()) {
    $('coins').textContent = `◉ ${p.coins}`;
    $('driftLabel').textContent = $('driftLabel').textContent.replaceAll('SHIFT', 'כפתור דריפט');
    if (state === 'countdown') $('raceHint').textContent = 'לחצו גז כשהספירה מגיעה ל־1 לזינוק טורבו';
    else $('raceHint').classList.add('hidden');
  }
  const item = itemNames[p.item];
  $('itemIcon').textContent = item ? item[0] : '?';
  $('itemName').textContent = item ? item[1] : 'אספו קופסת קמפיין';
  $('item').classList.toggle('ready', !!item);
  arena.classList.toggle('item-ready', !!item);
  $('item').setAttribute(
    'aria-label',
    item
      ? 'הפעל ' + item[1] + (compactTouchLayout() ? '; אפשר גם לגעת במסלול' : '')
      : 'אין אביזר — אספו קופסת קמפיין'
  );
  $('leaderboard').innerHTML = order
    .map(
      (r, i) =>
        `<div class="leader-row ${r.player ? 'me' : ''}" style="--color:${PARTIES[r.id].color}"><b>${i + 1}</b><i></i><span>${PARTIES[r.id].short}</span><small>${r.player ? 'אתם' : r.finish !== null ? 'סיים' : ''}</small></div>`
    )
    .join('');
  drawMap();
  if (position < previousRank && race.time > 4 && state === 'running') {
    tone(700, 0.07);
    feedback(position === 1 ? 'מקום ראשון! שומרים על הכיסא.' : `עקיפה! מקום ${position} מתוך 6`);
    pulse(position === 1 ? [30, 45, 40] : 24);
  }
  previousRank = position;
}
function pickupStep(before, wasRoute = false) {
  const player = race.racers[0],
    lap = Math.floor(Math.max(0, player.s) / track.length);
  if (wasRoute || player.routeId) return;
  for (const p of pickups) {
    const prevLap = Math.floor(Math.max(0, before) / track.length);
    if (p.lastLap < lap) p.mesh.visible = true;
    for (const l of new Set([prevLap, lap])) {
      const target = p.s + l * track.length;
      if (
        p.lastLap === l ||
        before > target ||
        player.s < target ||
        Math.abs(player.x - p.x) >
          (p.type === 'coin' && player.magnet > 0
            ? 8
            : p.type === 'ramp'
              ? 2.5
              : p.type === 'boost'
                ? 1.8
                : p.type === 'barrier'
                  ? 1.45
                  : 1.6)
      )
        continue;
      p.lastLap = l;
      if (p.type === 'coin') {
        p.mesh.visible = false;
        player.coins = Math.min(10, player.coins + 1);
        emitRace(race, 'pickup', player, { count: player.coins });
        tone(900, 0.055);
      }
      if (p.type === 'box' && !player.item) {
        p.mesh.visible = false;
        grantItem(race, player);
        toast(
          (compactTouchLayout() ? 'כוח מוכן: ' : '') +
            itemNames[player.item][1] +
            (compactTouchLayout() ? ' · געו במסלול להפעלה' : ' · לחצו רווח')
        );
        if (compactTouchLayout()) navigator.vibrate?.(45);
        tone(570, 0.12);
      }
      if (p.type === 'ramp') {
        launch(race, player);
      }
      if (p.type === 'boost') {
        emitRace(race, 'item-use', player, { item: 'boost' });
        player.boost = Math.max(player.boost, 1.6);
        tone(840, 0.2);
      }
      if (p.type === 'barrier') {
        if (hitRacer(player, race)) {
          toast('נתקעתם בספין. זה יעבור…');
          tone(130, 0.2, 'sawtooth');
        }
      }
    }
  }
  // Rival collisions are physical, with a cooldown so contact cannot trap the player.
  bumpRivals(race);
}
function finish() {
  state = 'results';
  clearControls();
  $('results').classList.remove('hidden');
  $('touch').classList.add('hidden');
  const player = race.racers[0],
    order = ranking(race),
    place = order.indexOf(player) + 1,
    key = 'ck-v3-best-' + (level.id === 'jerusalem' ? 'normal' : level.id);
  let best = Number(stored(key, '0'));
  if (!best || race.time < best) {
    best = race.time;
    save(key, best);
  }
  $('resultMedal').textContent = place === 1 ? '♛' : place;
  $('resultTitle').textContent =
    place === 1 ? 'יש ראש ממשלה!' : place <= 3 ? 'יש מקום בקואליציה.' : 'הפעם באופוזיציה.';
  $('resultJoke').textContent =
    place === 1
      ? `${PARTIES[selected].short} ניצח ב${level.name}. עכשיו צריך למצוא חניה לכנסת.`
      : place <= 3
        ? 'פודיום יפה. תיק התחבורה עוד על השולחן.'
        : 'הבוחרים ביקשו שינוי. אולי תתחילו מהצמיגים?';
  $('resultTime').textContent = formatTime(race.time);
  $('resultDrifts').textContent = race.drifts;
  $('resultSecrets').textContent = race.shortcuts;
  $('resultBest').textContent = formatTime(best);
  $('resultsBoard').innerHTML = order
    .map((r, i) => {
      const party = PARTIES[r.id];
      return `<li class="results-row ${r.player ? 'me' : ''} ${i === 0 ? 'winner' : ''}" style="--party-color:${party.color}"><span class="results-rank">${i + 1}</span><img class="results-face" src="${portraits[r.id]}" alt=""><span class="results-driver"><b>${party.leader}${r.player ? '<em>אתם</em>' : ''}</b><small>${party.name}</small></span><span class="results-time">${r.finish !== null ? formatTime(r.finish) : 'במסלול'}</span></li>`;
    })
    .join('');
  $('resultsBoard').scrollTop = 0;
  tone(place === 1 ? 1000 : 360, 0.5);
  if (place === 1 && !reduced) {
    const origin = karts[selected].position;
    for (let i = 0; i < 65; i++) {
      const m = new T.Mesh(
        new T.BoxGeometry(0.13, 0.27, 0.05),
        mat(['#f2d867', '#df835d', '#80bec5', '#eaf3be'][i % 4])
      );
      m.position
        .copy(origin)
        .add(new T.Vector3((Math.random() - 0.5) * 8, 3 + Math.random() * 7, (Math.random() - 0.5) * 8));
      scene.add(m);
      confetti.push({
        mesh: m,
        v: new T.Vector3((Math.random() - 0.5) * 3, 2 + Math.random() * 3, (Math.random() - 0.5) * 3),
        life: 5
      });
    }
  }
  $('again').focus({ preventScroll: true });
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;
  elapsed += dt;
  if (state === 'countdown') {
    const old = Math.ceil(count);
    count -= dt;
    $('countdown').textContent = count > 0.5 ? Math.ceil(count - 0.5) : 'GO!';
    arena.classList.toggle('launch-window', count <= 1.5 && count > 0.45);
    if (Math.ceil(count) !== old) {
      tone(count > 0.5 ? 540 : 1000, 0.12);
      pulse(count > 0.5 ? 18 : 35);
    }
    if (count <= 0) {
      state = 'running';
      arena.classList.remove('launch-window');
      $('raceHint').textContent = 'W / ↑ גז · A D / ← → היגוי · SHIFT דריפט / תרגיל באוויר · רווח אביזר';
      if (launchPressed >= 0.45 && launchPressed <= 1.15) {
        race.racers[0].boost = 1.9;
        emitRace(race, 'launch-boost', race.racers[0]);
      }
      $('countdown').classList.add('hidden');
    }
  }
  if (state === 'running') {
    const p = race.racers[0],
      before = p.s,
      wasRoute = !!p.routeId,
      oldLap = Math.floor(Math.max(0, p.s) / track.length),
      drifts = race.drifts;
    stepRace(
      race,
      dt,
      {
        steer: Number(controls.right) - Number(controls.left),
        drift: controls.drift,
        brake: controls.brake,
        accelerate: controls.accelerate,
        sensitivity
      },
      routeBend(track, p)
    );
    pickupStep(before, wasRoute);
    stepEncounters(race, before, wasRoute);
    consumeEvents();
    if (race.drifts > drifts) {
      tone(980, 0.2);
      toast('דריפט מושלם. טורבו!');
    }
    if (Math.floor(p.s / track.length) > oldLap && !race.done) {
      toast(oldLap === 1 ? 'הקפה אחרונה. אין בחירות חוזרות!' : 'הקפה שנייה. מתחילים להתחמם.');
      tone(850, 0.25);
    }
    if (race.time > 7) $('raceHint').classList.add('hidden');
    if (race.done) finish();
  }
  if (state !== 'home' && state !== 'paused') updateKarts(dt);
  updateEngine();
  if (state !== 'paused') {
    encounters.update(
      race && state !== 'home' ? race.time : elapsed,
      Math.floor(Math.max(0, race?.racers[0].s || 0) / track.length)
    );
    fx.update(dt, state === 'home' ? null : race);
    updateSparks(dt);
    setCamera(false, dt);
    for (const p of pickups) {
      if (p.type === 'box' || p.type === 'coin') {
        p.mesh.position.y = p.baseY + (reduced ? 0 : Math.sin(elapsed * 2.4 + p.s) * 0.17);
        if (!reduced) p.mesh.rotation.y += dt * (p.type === 'coin' ? 1.7 : 0.55);
      }
    }
    for (const p of confetti) {
      p.life -= dt;
      p.v.y -= dt * 2;
      p.mesh.position.addScaledVector(p.v, dt);
      p.mesh.rotation.x += dt * 2;
      p.mesh.visible = p.life > 0;
    }
  }
  if (elapsed > feedbackUntil) $('feedback').classList.add('hidden');
  if (elapsed > toastUntil) $('toast').classList.remove('visible');
  hudClock += dt;
  if (race && state !== 'home' && hudClock > 0.09) {
    updateHUD();
    hudClock = 0;
  }
  renderer.render(scene, camera);
}
$('play').onclick = start;
$('again').onclick = start;
$('homeButton').onclick = goHome;
$('pause').onclick = pause;
$('resume').onclick = resume;
$('quit').onclick = goHome;
$('item').onclick = activateItem;
canvas.addEventListener('pointerup', e => {
  if (e.pointerType !== 'mouse' && compactTouchLayout() && state === 'running' && race?.racers[0].item)
    activateItem();
});
$('sound').onclick = () => {
  sound = !sound;
  save('ck-sound', sound ? 'on' : 'off');
  $('sound').setAttribute('aria-pressed', String(sound));
  $('sound').setAttribute('aria-label', sound ? 'כיבוי צליל' : 'הפעלת צליל');
  tone(600, 0.14);
};
$('fullscreen').onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await arena.requestFullscreen();
  } catch {
    toast('מסך מלא אינו זמין בדפדפן הזה');
  }
};
const commandCodes = new Set(['Space', 'Escape', 'KeyP', 'KeyC']);
addEventListener('keydown', e => {
  if ($('info').open || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  if (
    !['running', 'countdown', 'paused'].includes(state) ||
    (!KEY_ACTIONS[e.code] && !commandCodes.has(e.code))
  )
    return;
  e.preventDefault();
  if (KEY_ACTIONS[e.code] && state !== 'paused') {
    heldKeys.add(e.code);
    syncControls();
  }
  if (e.repeat) return;
  if (state === 'countdown' && (e.code === 'KeyW' || e.code === 'ArrowUp')) launchPressed = count;
  if (e.code === 'Space') activateItem();
  if (e.code === 'KeyC') toggleCamera();
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (state === 'paused') resume();
    else pause();
  }
});
addEventListener('keyup', e => {
  heldKeys.delete(e.code);
  syncControls();
});
for (const button of document.querySelectorAll('[data-key]')) {
  button.onpointerdown = e => {
    e.preventDefault();
    if (!['running', 'countdown'].includes(state)) return;
    if (state === 'countdown' && button.dataset.key === 'accelerate') launchPressed = count;
    button.setPointerCapture(e.pointerId);
    touchKeys.add(button.dataset.key);
    syncControls();
    button.classList.add('active');
    pulse(button.dataset.key === 'drift' ? 18 : 10);
  };
  const up = () => {
    touchKeys.delete(button.dataset.key);
    syncControls();
    button.classList.remove('active');
  };
  button.onpointerup = up;
  button.onpointercancel = up;
  button.onlostpointercapture = up;
}
addEventListener('blur', () => {
  clearControls();
  pause();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
});
canvas.addEventListener('webglcontextlost', e => {
  e.preventDefault();
  pause();
  $('error').classList.remove('hidden');
});
const mobileHelp =
  '<h2>איך נוהגים במגע?</h2><p>שלוש הקפות מול חמישה נהגים. מי שחוצה ראשון מנצח.</p><ol><li><b>גז והיגוי:</b> הקארט מאיץ לבד. החזיקו גז לעוד קצת מהירות, והקישו עליו כשהספירה מגיעה ל־1 לזינוק טורבו. החזיקו את החצים בצד שמאל כדי לפנות; בלם מאט.</li><li><b>דריפט:</b> החזיקו דריפט וחץ יחד. כשהמד מתמלא, שחררו את דריפט לטורבו. ככל שהצבע מתקדם מכחול לכתום ולסגול, הבוסט חזק יותר. הקשה חדשה על דריפט באוויר נותנת תרגיל ובוסט בנחיתה.</li><li><b>כוח:</b> אספו קופסת קמפיין צהובה. כשהכוח מוכן, הכרטיס יאיר. געו במקום פנוי במסלול או בכרטיס כדי להפעיל אותו. הכוח יכול לתת טורבו, חסינות, סקר מעופף או מגנט פתקים.</li><li><b>מסלול:</b> פתקים מוסיפים מהירות, משטחים בצבע טורקיז נותנים בוסט, ובמסלול הראשון דרכים סודיות מקצרות את הדרך. הימנעו מכדורי ספין וממחסומים.</li></ol><p>אפשר להשהות בכפתור Ⅱ. התוצאות והשיאים נשמרים רק במכשיר הזה.</p>';
let infoFocus;
function info(content) {
  pause();
  infoFocus = document.activeElement;
  if (compactTouchLayout() && content.startsWith('<h2>איך תופסים')) content = mobileHelp;
  $('infoContent').innerHTML = content;
  $('info').showModal();
}
$('help').onclick = () =>
  info(
    '<h2>איך תופסים את הכיסא?</h2><p>שלוש הקפות במסלול שתבחרו, מול חמישה נהגים ממוחשבים. מי שחוצה ראשון — מנצח. כולם מתחילים עם אותם נתוני בסיס.</p><ol><li><b>נהיגה:</b> לחצו W / ↑ או גז כשהספירה מגיעה ל־1 לזינוק טורבו. גז אוטומטי, עם תוספת האצה ב־W או ↑. היגוי חלק עם A/D או ← →, גם כשהמקלדת בעברית. S או ↓ לבלימה. שחרור הכיוון מייצב את ההגה. אפשר לכוון רגישות בתפריט ההשהיה ולשנות מצלמה עם C.</li><li><b>דריפט:</b> החזיקו Shift יחד עם כיוון. אחרי שהמד נהיה כחול, שחררו לטורבו. כתום נותן סופר טורבו וסגול נותן אולטרה טורבו. לחיצה חדשה על Shift באוויר נותנת תרגיל ובוסט בנחיתה. בנייד משתמשים בכפתור דריפט יחד עם חץ.</li><li><b>אביזרים:</b> אספו קופסה צהובה. לחצו רווח או על האביזר להפעלת טורבו, חסינות לשש שניות או סקר שעף אל היריב הקרוב לפניכם, או מגנט שאוסף פתקים מרחוק למשך שבע שניות. גם היריבים משתמשים באביזרים.</li><li><b>פתקים:</b> כל פתק מוסיף קצת למהירות המרבית, עד עשרה. חפשו את משטחי הטורבו בצבע טורקיז בצד הפנימי של הפניות.</li><li><b>דרכים סודיות:</b> חפשו שער עם סימן שאלה ואבנים צבעוניות בצד הפנימי של הפנייה. היכנסו במהירות מהשוליים: המעבר צר, אבל מקצר את הדרך. SHIFT באוויר מעל רמפה נותן תרגיל ובוסט בנחיתה. נסיעה צמודה מאחורי יריב טוענת סליפסטרים.</li><li><b>הפתעות ומכות:</b> כדורי ספין ענקיים חוצים את הכביש. התחמקות קרובה נותנת טורבו; שערי הזהב מחליפים צד בכל הקפה ומעניקים שלושה פתקים ובוסט. פגיעה ביריב בזמן טורבו מסחררת אותו — חסינות מגינה ממכה אחת.</li><li><b>אל תירדמו:</b> דשא מאט, מחסומים מסחררים, ויריבים יכולים לדחוף. רמות 200cc ו־250cc דורשות בוסטים ונהיגה מדויקת.</li></ol><p>Esc / P להשהיה. מעבר לחלון אחר משהה אוטומטית. תוצאות ושיאים נשמרים רק במכשיר הזה.</p>'
  );
$('credits').onclick = () =>
  info(
    '<h2>פוליטיקה על גלגלים.</h2><p>משחק סאטירי עצמאי, ללא שיוך מפלגתי. הנהגים הם קריקטורות של דמויות ציבוריות. רכבים, יתרונות, אביזרים ותוצאות הם המצאה לצורך המשחק, ולא סקרים או תחזית בחירות. בחירת הנהגים היא מבחר למשחק, לא רשימת מועמדים מלאה.</p><p>סמלי יש עתיד, הדמוקרטים וישראל ביתנו הורדו מאתרי המפלגות; סמלי הליכוד, ש״ס ועוצמה יהודית מתמונות הסמל בוויקיפדיה. הסמלים שייכים לבעליהם ואינם מעידים על חסות.</p><ul><li><a href="https://www.likud.org.il/" target="_blank" rel="noopener noreferrer">הליכוד</a></li><li><a href="https://yeshatid.org.il/" target="_blank" rel="noopener noreferrer">יש עתיד</a></li><li><a href="https://democrats.org.il/yair-golan/" target="_blank" rel="noopener noreferrer">הדמוקרטים</a></li><li><a href="https://beytenu.org.il/" target="_blank" rel="noopener noreferrer">ישראל ביתנו</a></li><li><a href="https://en.wikipedia.org/wiki/Shas" target="_blank" rel="noopener noreferrer">ש״ס וסמל המפלגה</a></li><li><a href="https://en.wikipedia.org/wiki/Otzma_Yehudit" target="_blank" rel="noopener noreferrer">עוצמה יהודית וסמל המפלגה</a></li></ul><p>העולם והקארטים נבנו בגאומטריה תלת־ממדית מקורית על בסיס הסגנון של משחק האוטובוס הקודם. Three.js ברישיון MIT. אין שימוש בנכסי Nintendo.</p>'
  );
$('closeInfo').onclick = () => $('info').close();
$('info').addEventListener('close', () => infoFocus?.focus());
renderLevels();
choose(selected);
setCamera(true);
$('loading').classList.add('hidden');
$('play').disabled = false;
requestAnimationFrame(frame);
// Read-only state for browser QA and assistive tooling. No remote data or score writes.
window.readKartState = () => ({
  state,
  countdown: state === 'countdown' ? count : null,
  selected: PARTIES[selected].id,
  level: level.id,
  length: track.length,
  roadWidth: ROAD.halfWidth * 2,
  sensitivity,
  wideCamera,
  controls: { ...controls },
  renderCalls: renderer.info.render.calls,
  race: race
    ? {
        time: race.time,
        difficulty: race.difficulty,
        levelId: race.levelId,
        done: race.done,
        drifts: race.drifts,
        jumps: race.jumps,
        shortcuts: race.shortcuts,
        events: race.events.slice(-12),
        rank: ranking(race).indexOf(race.racers[0]) + 1,
        racers: race.racers.map(r => ({ ...r }))
      }
    : null
});
