import * as T from './vendor/three.module.min.js';
import {
  PARTIES,
  ROAD,
  makeRace,
  stepRace,
  ranking,
  useItem,
  clamp,
  startRace,
  coastRace
} from './race-model.js';
import { layoutPickups } from './race-course.js';
import { ABILITIES, ITEMS, useAbility } from './race-items.js';
import {
  makeKart,
  setAllyTag,
  loadLogos,
  makeTrack,
  buildWorld,
  makePickup,
  mat,
  batchStatic,
  box,
  label
} from './kart-world.js';
import { racerFrame, routeBend } from './kart-routes.js';
import { stepEncounters, bumpRivals } from './kart-encounters.js';
import { makeEncounterWorld } from './kart-encounter-world.js';
import { makeEffects } from './kart-effects.js';
import { animateKart, resetMotion } from './kart-motion.js';
import { makeTrails } from './kart-trails.js';
import { KEY_ACTIONS, readControls } from './kart-input.js';
import { levelById } from './kart-levels.js';
import { makeHud, formatTime } from './kart-hud.js';
import { makeAudio } from './kart-audio.js';
import { TAUNTS } from './kart-taunts.js';
import { makeTouchControls } from './kart-touch.js';
import { MOODS, VIADUCT } from './world-set.js';
import { inTunnel, ELECTION_DAY } from './world-news.js';
import * as GP from './gp.js';
import {
  renderDrivers,
  renderGarage,
  renderTracks,
  renderResults,
  renderTalks,
  renderFinal,
  roleText,
  helpHTML,
  CREDITS_HTML
} from './kart-menus.js';

await document.fonts.load('900 80px Heebo');
const $ = id => document.getElementById(id),
  arena = $('arena'),
  canvas = $('game');

// Persistence: settings, driver, mode and the Grand Prix in progress live in this browser only.
const stored = (key, fallback) => {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};
const save = (key, value) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
};
const params = new URLSearchParams(location.search);
let gp = GP.restore(stored('ck-gp', ''));
const MODES = ['gp', 'single'];
let mode = params.get('mode') ?? (params.get('gp') === '1' ? 'gp' : stored('ck-mode', 'gp'));
if (!MODES.includes(mode)) mode = 'gp';
// Grand Prix races run on their own course; otherwise the URL picks it.
const going = params.get('go') === '1';
const level = levelById(going && mode === 'gp' && gp && !gp.done ? GP.currentLevel(gp) : params.get('level'));
arena.classList.add('level-' + level.id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const touchDevice = () => matchMedia('(pointer:coarse)').matches;

let renderer;
try {
  renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  $('loading').classList.add('hidden');
  $('error').classList.remove('hidden');
  throw e;
}
// Render scale adapts to the device: it drops when frames run long and recovers when there is
// headroom, between 55% of the native scale and the 1.6x cap.
const maxScale = Math.min(devicePixelRatio, 1.6),
  minScale = Math.max(0.6, maxScale * 0.55);
let renderScale = maxScale;
renderer.setPixelRatio(renderScale);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping;
// Each course has a mood (day, dusk, night) that sets the sky, light and fog.
const mood = MOODS[level.mood ?? 'day'];
renderer.toneMappingExposure = mood.exposure;
const scene = new T.Scene();
scene.background = new T.Color(mood.horizon);
scene.fog = new T.Fog(mood.horizon, 150, 430);
scene.add(new T.HemisphereLight(mood.hemi[0], mood.hemi[1], mood.hemi[2]));
const sun = new T.DirectionalLight(mood.key[0], mood.key[1]);
const sunOffset = new T.Vector3(...mood.sunDir).normalize().multiplyScalar(80);
sun.position.copy(sunOffset);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 180 });
sun.shadow.normalBias = 0.06;
scene.add(sun, sun.target);
const camera = new T.PerspectiveCamera(46, 1, 0.1, 800),
  track = makeTrack(level.id);
// No side roads: every course is the main road only.
track.shortcuts = [];
const logos = await loadLogos();
const world = new T.Group();
scene.add(world);
const scenery = buildWorld(world, track, { mood: level.mood ?? 'day', logos, level });

let selected = clamp(Number(stored('ck-driver', '0')) || 0, 0, PARTIES.length - 1),
  state = 'home',
  race = null,
  count = 0,
  elapsed = 0,
  last = 0,
  toastUntil = 0,
  feedbackUntil = 0,
  sound = stored('ck-sound', 'off') === 'on',
  previousRank = PARTIES.length,
  confetti = [],
  seenEvent = 0,
  launchPressed = 99,
  hudClock = 0,
  lastLap = 0,
  playerHits = {},
  stateBeforePause = 'running',
  introT = 0,
  finishT = 0,
  pollDrawnAt = 0;
let sensitivity = clamp(Number(stored('ck-steering', '1')) || 1, 0.65, 1.35),
  wideCamera = stored('ck-camera', 'wide') === 'wide';
if (gp && gp.player !== undefined && mode === 'gp' && !gp.done) selected = gp.player;

const heldKeys = new Set(),
  touchKeys = new Set();
const controls = readControls(heldKeys, touchKeys);
const syncControls = () => Object.assign(controls, readControls(heldKeys, touchKeys));

// Audio: cues, engine, music and the optional announcer all live in kart-audio.js.
const audio = makeAudio();
const tone = (...args) => audio.tone(...args);
// A recorded sound by name, or the synthesized blip in fallback while it hasn't loaded.
const cue = (name, ...fallback) => audio.cue(name, fallback);
const ITEM_SOUNDS = {
  boost: 'item-boost',
  shield: 'shield',
  poll: 'poll',
  magnet: 'magnet',
  leak: 'leak',
  filibuster: 'filibuster',
  spin: 'spin',
  budget: 'budget',
  noconf: 'noconf'
};
const COUNT_WORDS = ['אחת', 'שתיים', 'שלוש'];
let musicOn = stored('ck-music', 'on') === 'on',
  voiceOn = stored('ck-voice', 'on') === 'on';
audio.setMusic(musicOn);
audio.setVoice(voiceOn);
function setSound(on) {
  sound = on;
  save('ck-sound', on ? 'on' : 'off');
  audio.setEnabled(on);
  $('sound').setAttribute('aria-pressed', String(on));
  $('sound').setAttribute('aria-label', on ? 'כיבוי צליל' : 'הפעלת צליל');
  $('soundToggle').checked = on;
  cue('ui-click', 600, 0.14);
}
const pulse = (pattern = 16) => touchDevice() && navigator.vibrate?.(pattern);
function toast(message, seconds = 2.2) {
  $('toast').textContent = message;
  $('toast').classList.add('visible');
  toastUntil = elapsed + seconds;
}
// The cynical announcer on a rival's move: a toast, and the recorded line if voice is on. Hits,
// thefts and rams cut in; overtakes wait for a gap. At most one every few seconds.
const ATTACKS = ['hit', 'drop-hit', 'leaked', 'spun', 'cleared'];
let tauntAt = -99;
// Which partner demands have already been pointed out this race (each is named once).
let dealNoticed = {};
function taunt(rival, kind) {
  const lines = TAUNTS[rival]?.[kind];
  if (!lines || rival === selected || elapsed - tauntAt < 4) return;
  const line = lines[(Math.random() * lines.length) | 0];
  tauntAt = elapsed;
  toast(line, 3.6);
  audio.say(line, { important: false, polite: kind === 'pass' || kind === 'beaten' });
}
function callout(text, kind = '') {
  $('feedback').textContent = text;
  $('feedback').className = 'callout ' + kind;
  feedbackUntil = elapsed + 1.3;
}

function prepareKart(g) {
  // Eyes and the reaction props (stars, swirl) must stay separate so they can animate and hide.
  const headKeep = new Set();
  g.userData.eyes.forEach(eye => eye.traverse(m => headKeep.add(m)));
  for (const part of Object.values(g.userData.reactions)) part.traverse(m => headKeep.add(m));
  batchStatic(g.userData.head, headKeep);
  const dynamic = new Set([
    g.userData.shield,
    ...g.userData.flames,
    g.userData.name,
    ...g.userData.fx.map(f => f.mesh)
  ]);
  g.userData.flags.forEach(f => dynamic.add(f));
  g.userData.steeringWheel.traverse(m => dynamic.add(m));
  for (const part of Object.values(g.userData.reactions)) part.traverse(m => dynamic.add(m));
  g.userData.head.traverse(m => dynamic.add(m));
  // Merge the static chassis inside the sprung body so the suspension still moves it as one.
  batchStatic(g.userData.body, dynamic);
  return g;
}
const karts = PARTIES.map((_, i) => {
  const g = prepareKart(makeKart(i, logos));
  scene.add(g);
  return g;
});
// At night the player's kart carries a headlight beam (one light, so it stays cheap).
const headlight = level.mood === 'night' ? new T.SpotLight('#ffe9c4', 60, 46, 0.5, 0.6, 1.4) : null;
if (headlight) {
  scene.add(headlight, headlight.target);
}
function updateHeadlight() {
  if (!headlight) return;
  const k = karts[selected];
  headlight.visible = state !== 'home';
  headlight.position.copy(k.localToWorld(new T.Vector3(0, 2.2, 1.6)));
  headlight.target.position.copy(k.localToWorld(new T.Vector3(0, 0, 18)));
}
const fx = makeEffects(scene, track, karts, reduced);
const encounters = makeEncounterWorld(scene, track, box, label, mat);
const trails = makeTrails(scene, reduced);
const hud = makeHud({ arena, track, reduced, touch: touchDevice });

// Portraits come from the same 3D models used on track: a kart three-quarter view and a head shot.
const kartImages = [],
  faceImages = [];
{
  const r = new T.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  r.setSize(240, 240);
  r.setPixelRatio(1);
  r.outputColorSpace = T.SRGBColorSpace;
  r.toneMapping = T.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.25;
  const s = new T.Scene();
  s.add(new T.HemisphereLight('#fffbe2', '#7c8aa0', 2.6));
  const key = new T.DirectionalLight('#fff4de', 3.6);
  key.position.set(4, 7, 6);
  s.add(key);
  const cam = new T.PerspectiveCamera(30, 1, 0.1, 50);
  PARTIES.forEach((p, i) => {
    const model = makeKart(i, logos);
    s.add(model);
    cam.position.set(5.6, 4.2, 7.4);
    cam.lookAt(0, 1.4, 0);
    r.render(s, cam);
    kartImages[i] = r.domElement.toDataURL('image/png');
    cam.position.set(0.6, 2.95, 3.6);
    cam.lookAt(0, 2.75, 0);
    r.render(s, cam);
    faceImages[i] = r.domElement.toDataURL('image/png');
    s.remove(model);
  });
  r.dispose();
}

// Trails: smoke, sparks and dust for every kart close enough to the camera to see it.
function updateTrails(dt) {
  if (race && (state === 'running' || state === 'results'))
    for (const r of race.racers) {
      const kart = karts[r.id];
      const near = kart.position.distanceToSquared(camera.position) < 90 * 90;
      trails.kartTrail(kart, r, dt, Math.abs(r.x) > (r.routeId ? 2.1 : ROAD.driveEdge), near);
    }
  trails.update(dt);
}

// Pickup meshes follow the same deterministic layout the race simulates, index for index.
// Pickups follow the same deterministic layout the race simulates, index for index. Each kind
// is drawn as instances: one draw call per part of the model, however many sit on the track.
const bend = s => track.bend(s),
  height = s => track.at(s).p.y;
// The bridge deck has rails and the start straight has crowd barriers: both are solid.
const walls = s => {
  const at = ((s % track.length) + track.length) % track.length,
    u = at / track.length;
  if (track.at(s).p.y > VIADUCT) return 10.9;
  if (inTunnel(s, track.length)) return 11.6;
  if (at > track.length - 27 || at < 70) return 12.7;
  return null;
};
const pickups = layoutPickups(track.length, bend, height).map(({ type, s, x }) => {
  const { p, t } = track.at(s, x);
  return { type, s, x, pos: p, yaw: Math.atan2(t.x, t.z), visible: true, spin: 0 };
});
const pickupKinds = {};
for (const type of ['box', 'coin', 'barrier', 'boost', 'ramp', 'crest']) {
  const model = makePickup(type),
    list = pickups.filter(p => p.type === type);
  model.updateMatrixWorld(true);
  const parts = [];
  model.traverse(m => {
    if (!m.isMesh) return;
    const mesh = new T.InstancedMesh(m.geometry, m.material, list.length);
    mesh.castShadow = type === 'box' || type === 'barrier';
    mesh.receiveShadow = true;
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    mesh.frustumCulled = false;
    scene.add(mesh);
    parts.push({ mesh, local: m.matrixWorld.clone() });
  });
  pickupKinds[type] = { list, parts, blink: model.userData.blink?.material };
  list.forEach((p, i) => (p.index = i));
}
const pickupMatrix = new T.Matrix4(),
  partMatrix = new T.Matrix4(),
  hiddenMatrix = new T.Matrix4().makeScale(0, 0, 0),
  pickupQuat = new T.Quaternion(),
  pickupPos = new T.Vector3(),
  pickupScale = new T.Vector3(1, 1, 1),
  yAxis = new T.Vector3(0, 1, 0);
function drawPickups(dt) {
  for (const [type, kind] of Object.entries(pickupKinds)) {
    const floats = type === 'box' || type === 'coin';
    for (const p of kind.list) {
      if (floats && !reduced) p.spin += dt * (type === 'coin' ? 1.7 : 0.55);
      pickupPos.copy(p.pos);
      if (floats && !reduced) pickupPos.y += Math.sin(elapsed * 2.4 + p.s) * 0.17;
      pickupQuat.setFromAxisAngle(yAxis, p.yaw + p.spin);
      pickupMatrix.compose(pickupPos, pickupQuat, pickupScale);
      for (const part of kind.parts)
        part.mesh.setMatrixAt(
          p.index,
          p.visible ? partMatrix.multiplyMatrices(pickupMatrix, part.local) : hiddenMatrix
        );
    }
    for (const part of kind.parts) part.mesh.instanceMatrix.needsUpdate = true;
    if (kind.blink) kind.blink.emissiveIntensity = Math.sin(elapsed * 8) > 0 ? 1.6 : 0.2;
  }
}
function syncPickups() {
  race.pickups.forEach((p, i) => (pickups[i].visible = p.hiddenUntil <= race.time));
  syncDrops();
}
// Filibuster lecterns and protest barricades, kept in step with race.drops.
const dropMeshes = new Map();
function makeDrop(kind) {
  const g = new T.Group();
  if (kind === 'filibuster') {
    box(g, 1.1, 1.15, 0.7, '#6d4a33', 0, 0.58, 0);
    box(g, 1.3, 0.12, 0.85, '#8a6143', 0, 1.2, 0);
    for (let i = 0; i < 7; i++) {
      const sheet = box(
        g,
        0.62,
        0.04,
        0.82,
        '#f6f1e2',
        ((i % 3) - 1) * 0.45,
        0.05 + i * 0.07,
        (i % 2) * 0.3 - 0.15
      );
      sheet.rotation.y = i * 0.7;
    }
    const sign = label('פיליבסטר', 1.6, 0.42, '#f6f1e2', '#3b2a1e', 90);
    sign.position.set(0, 1.62, 0);
    g.add(sign);
  } else {
    box(g, 2.2, 0.55, 0.16, '#d9c39a', 0, 0.3, 0);
    for (let i = 0; i < 3; i++) {
      box(g, 0.06, 1.7, 0.06, '#8b6b4a', (i - 1) * 0.75, 0.9, 0);
      const sign = label(
        ['די!', 'לא נוותר', 'ביחד'][i],
        0.8,
        0.55,
        ['#ffffff', '#ffe08a', '#ffb3a8'][i],
        '#202020',
        110
      );
      sign.position.set((i - 1) * 0.75, 1.8, 0.05);
      sign.rotation.z = (i - 1) * 0.12;
      g.add(sign);
    }
  }
  g.traverse(m => (m.castShadow = true));
  return g;
}
function syncDrops() {
  const live = new Set();
  for (const d of race.drops) {
    live.add(d.id);
    if (dropMeshes.has(d.id)) continue;
    const mesh = makeDrop(d.kind),
      at = track.at(d.s, d.x);
    mesh.position.copy(at.p);
    mesh.rotation.y = Math.atan2(at.t.x, at.t.z) + Math.PI;
    scene.add(mesh);
    dropMeshes.set(d.id, mesh);
  }
  for (const [id, mesh] of dropMeshes)
    if (!live.has(id)) {
      mesh.removeFromParent();
      dropMeshes.delete(id);
    }
}
function clearDrops() {
  for (const mesh of dropMeshes.values()) mesh.removeFromParent();
  dropMeshes.clear();
}

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

// ——— Title screen ———
function choose(i) {
  if (mode === 'gp' && gp && !gp.done && gp.round > 0) return toast('בעונה פעילה אי אפשר להחליף נהג');
  const changed = selected !== i;
  selected = i;
  save('ck-driver', i);
  renderGarage(i);
  $('driverFace').src = faceImages[i];
  if (changed) pulse(20);
  cue('ui-select', 380 + i * 60, 0.08);
}
function setMode(next) {
  mode = next;
  save('ck-mode', next);
}
// The two big title buttons: the Grand Prix starts at once, a single race asks for a course first.
function showTrackSheet(open) {
  $('trackSheet').classList.toggle('hidden', !open);
  $('home').classList.toggle('picking-track', open);
  if (open) $('trackPicker').querySelector('[aria-current="true"]')?.focus({ preventScroll: true });
  else $('single').focus({ preventScroll: true });
  cue('ui-select', open ? 520 : 420, 0.08);
}
function pickTrack(id) {
  setMode('single');
  goToRace(id, 'single');
}
// Moving between courses reloads the page (each course builds its own world).
function goToRace(levelId, raceMode) {
  if (levelId === level.id && raceMode === mode) {
    history.replaceState(null, '', `?level=${levelId}&mode=${raceMode}`);
    return startRace_();
  }
  location.assign(`?level=${levelId}&mode=${raceMode}&go=1`);
}
function refreshResumeCard() {
  const active = gp && !gp.done && gp.round > 0;
  $('resumeCard').classList.toggle('hidden', !active);
  if (active)
    $('resumeTitle').textContent =
      `${PARTIES[gp.player].short} · מרוץ ${gp.round + 1} מתוך ${GP.GP_RACES.length}, ${GP.coalitionSeats(gp)} מנדטים`;
}
function play() {
  setMode('gp');
  if (!gp || gp.done || gp.player !== selected || gp.round === 0) {
    gp = GP.newGrandPrix(selected);
    saveGp();
  }
  if (gp.talksPending) return showTalks();
  goToRace(GP.currentLevel(gp), 'gp');
}
const saveGp = () => save('ck-gp', gp ? JSON.stringify(gp) : null);

// ——— Race lifecycle ———
function startRace_() {
  clearControls();
  fx.reset();
  trails.reset();
  clearDrops();
  hud.reset();
  touchCtl.reset();
  seenEvent = 0;
  launchPressed = 99;
  playerHits = {};
  dealNoticed = {};
  lastLap = 0;
  const inGp = mode === 'gp' && gp && !gp.done;
  race = makeRace(selected, level.difficulty, Date.now(), track.length, track.shortcuts, level.id, {
    bend,
    height,
    walls,
    ...(inGp ? GP.raceOptions(gp) : {})
  });
  karts.forEach((k, i) => (k.visible = race.racers.some(r => r.id === i)));
  karts.forEach((k, i) => setAllyTag(k, i !== selected && race.coalition.has(i)));
  $('fieldSize').textContent = '/' + race.racers.length;
  karts.forEach(resetMotion);
  karts.forEach(k => k.scale.setScalar(1));
  state = reduced ? 'countdown' : 'intro';
  introT = 0;
  count = 3.5;
  previousRank = PARTIES.length;
  pickups.forEach(p => (p.visible = true));
  confetti.forEach(p => scene.remove(p.mesh));
  confetti = [];
  for (const id of ['home', 'results', 'pauseScreen', 'talks', 'final']) $(id).classList.add('hidden');
  for (const id of ['hud', 'raceHint']) $(id).classList.remove('hidden');
  $('countdown').classList.toggle('hidden', state === 'intro');
  arena.classList.toggle('cinematic', state === 'intro');
  $('touch').classList.toggle('hidden', !touchDevice());
  $('coalitionMeter').classList.toggle('hidden', !inGp);
  arena.classList.add('racing');
  $('countdown').textContent = '3';
  $('raceHint').textContent = touchDevice()
    ? 'געו במסך בדיוק כשמופיע 1 — זינוק טורבו'
    : 'לחצו W בדיוק כשמופיע 1 — זינוק טורבו';
  hud.resetTicker(
    inGp
      ? `${level.name} · מרוץ ${gp.round + 1} מתוך ${GP.GP_RACES.length}`
      : `${level.name} · ${level.speed}`
  );
  if (inGp) {
    for (const id of gp.coalition) {
      const d = GP.demandOf(gp, id);
      hud.tick(`${PARTIES[id].name} בקואליציה: ${d.name} — ${d.cost}`, 3, 0);
    }
    if (gp.coalition.length) hud.tick(roleText(gp) + ' · כל מקום במרוץ שווה מנדטים', 2, 0);
  }
  pulse(28);
  canvas.focus({ preventScroll: true });
  resize();
  updateKarts(0);
  updateHUD();
  setCamera(true);
  cue('grid-rev', 550, 0.15);
}
function goHome() {
  fx.reset();
  clearDrops();
  arena.classList.remove(
    'boosting',
    'hit-flash',
    'leaked',
    'confused',
    'starred',
    'item-ready',
    'launch-window',
    'racing'
  );
  state = 'home';
  race = null;
  clearControls();
  for (const id of ['hud', 'results', 'pauseScreen', 'countdown', 'touch', 'talks', 'final'])
    $(id).classList.add('hidden');
  $('home').classList.remove('hidden', 'picking-track');
  $('trackSheet').classList.add('hidden');
  karts.forEach(k => {
    k.userData.name.visible = false;
    k.userData.shield.visible = false;
    k.userData.flames.forEach(f => (f.visible = false));
  });
  pickups.forEach(p => (p.visible = true));
  refreshResumeCard();
  resize();
  $('play').focus({ preventScroll: true });
}
function pause() {
  if (!['running', 'countdown', 'intro'].includes(state)) return;
  stateBeforePause = state;
  state = 'paused';
  clearControls();
  $('pauseScreen').classList.remove('hidden');
  $('restart').classList.toggle('hidden', mode === 'gp');
  $('resume').focus({ preventScroll: true });
}
function resume() {
  if (state !== 'paused') return;
  state = stateBeforePause;
  last = performance.now();
  $('pauseScreen').classList.add('hidden');
  canvas.focus({ preventScroll: true });
}
function activateItem() {
  if (state !== 'running') return;
  if (useItem(race, race.racers[0])) {
    pulse(35);
    updateHUD();
  }
}
function activateAbility() {
  if (state !== 'running') return;
  if (useAbility(race, race.racers[0])) {
    pulse([20, 30, 40]);
    updateHUD();
  }
}
function toggleCamera() {
  wideCamera = !wideCamera;
  save('ck-camera', wideCamera ? 'wide' : 'close');
  $('wideToggle').checked = wideCamera;
  toast(wideCamera ? 'מצלמה רחבה' : 'מצלמה קרובה');
}

// Race events drive effects, sounds, the ticker and the player's callouts.
const PLAYER_CALLOUTS = {
  jackpot: ['שער זהב · 3 פתקים', 'gold'],
  'shortcut-enter': ['דרך סודית'],
  slipstream: ['סליפסטרים'],
  'shield-break': ['החסינות ספגה את המכה'],
  'launch-boost': ['זינוק מושלם', 'gold'],
  leaked: ['הדלפה! לא רואים כלום', 'danger'],
  spun: ['ההגה הפוך', 'danger'],
  cleared: ['פינו אתכם מהדרך', 'danger'],
  frozen: ['הקפאת תקציבים: הפתקים שלכם הוחרמו', 'danger'],
  'ability-ready': [null, 'gold'],
  warp: ['התפטרתם… וחזרתם קדימה', 'gold'],
  veto: ['וטו של השותפים: הקלפי ריקה', 'danger'],
  'launch-blocked': ['הסכם רוטציה: בלי זינוק טורבו', 'danger']
};
// The partner behind a handicap, for callouts that name who did it.
const partnerName = id => (id === undefined || id === null ? 'השותפים' : PARTIES[id].name);
function consumeEvents() {
  for (const e of race.events) {
    if (e.seq <= seenEvent) continue;
    seenEvent = e.seq;
    if (e.player || Math.abs(e.s - race.racers[0].s) < 90) {
      fx.event(e, race);
      const kart = karts[e.id];
      if (e.type === 'land') trails.puff(kart.position, '#d9ccad', e.trick ? 18 : 10, e.trick ? 5 : 3.5);
      if (e.type === 'hit') trails.puff(kart.position.clone().setY(kart.position.y + 0.8), '#f1d9c2', 16, 5);
      if (!e.player && e.target !== selected && Math.abs(e.s - race.racers[0].s) < 40) {
        if (e.type === 'hit') audio.play('hit', { volume: 0.35 });
        if (e.type === 'ram' || e.type === 'bump') audio.play('bump', { volume: 0.35 });
        if (e.type === 'ability') audio.play('ability-' + e.ability, { volume: 0.4 });
      }
    }
    hud.onEvent(e, race, elapsed);
    // Friendly fire counts against coalition loyalty.
    const fromMe = e.from === selected || (e.type === 'ram' && e.player);
    if (fromMe) {
      const victim = e.type === 'ram' ? e.target : e.id;
      if (['hit', 'ram', 'leaked', 'spun', 'drop-hit', 'frozen'].includes(e.type) && victim !== selected) {
        playerHits[victim] = (playerHits[victim] ?? 0) + 1;
        if (race.coalition.has(victim)) {
          callout(`פגעתם בשותפה · הנאמנות של ${PARTIES[victim].name} יורדת`, 'danger');
          cue('coalition-reject', 300, 0.15);
        }
      }
    }
    if ((e.type === 'noconf-fired' || e.type === 'poll-fired') && e.target === selected) {
      const line = e.type === 'noconf-fired' ? 'הצבעת אי־אמון נגדכם' : 'סקר בדרך אליכם';
      callout(line, 'danger');
      cue('warning', 200, 0.3, 'square');
      audio.say(line, { important: false });
    }
    if ((e.type === 'ram' || e.type === 'bump') && (e.player || e.target === selected))
      cue('bump', 160, 0.12, 'square');
    // The announcer names whoever did it.
    if (e.player && ATTACKS.includes(e.type) && e.from !== undefined) taunt(e.from, 'attack');
    if (e.type === 'budget' && e.target === selected) taunt(e.id, 'steal');
    if (e.type === 'frozen' && e.player) taunt(e.from, 'steal');
    if (e.type === 'ram' && e.target === selected) taunt(e.id, 'ram');
    if (e.type === 'cover') toast(`${PARTIES[e.id].short} חוסם את ${PARTIES[e.target].short} בשבילכם`, 1.8);
    if (!e.player) continue;
    const c = PLAYER_CALLOUTS[e.type];
    if (c) {
      callout(
        e.type === 'ability-ready'
          ? `${ABILITIES[selected].name} מוכנה · ${touchDevice() ? 'הקישו על הפנים' : 'E'}`
          : e.type === 'veto'
            ? `וטו של ${partnerName(e.by)}: הקלפי ריקה`
            : e.type === 'launch-blocked'
              ? `הסכם רוטציה עם ${partnerName(e.by)}: בלי זינוק טורבו`
              : e.type === 'launch-boost' && e.weak
                ? `זינוק מוחלש · הסכם רוטציה עם ${partnerName(e.by)}`
                : c[0],
        e.type === 'launch-boost' && e.weak ? 'danger' : c[1]
      );
      const named = {
        'ability-ready': 'ability-ready',
        'launch-boost': 'launch-boost',
        'shield-break': 'shield-break',
        jackpot: 'jackpot',
        slipstream: 'slipstream',
        leaked: 'leak',
        spun: 'spin',
        warp: 'warp',
        veto: 'veto',
        'launch-blocked': 'veto',
        cleared: 'hit',
        frozen: 'budget'
      }[e.type];
      if (named) cue(named, e.type === 'ability-ready' ? 980 : 750, 0.18);
      else tone(e.type === 'ability-ready' ? 980 : 750, 0.18);
      if (e.type === 'launch-boost') audio.say('זינוק מושלם', { important: false });
    }
    if (e.type === 'ability') {
      callout(ABILITIES[selected].name, 'gold');
      cue('ability-' + e.ability, 1200, 0.3);
    }
    if (e.type === 'pickup') cue('pickup', 900, 0.05);
    if (e.type === 'confiscated') {
      callout('ועדת הבחירות החרימה את האביזר', 'danger');
      cue('confiscated', 260, 0.3, 'square');
      pulse([30, 40, 30]);
    }
    if (e.type === 'ballots-lost') {
      toast(`איבדתם ${e.count} פתקים`);
      pulse([15, 30, 15]);
    }
    if (e.type === 'boost-pad') cue('boost-pad', 840, 0.18);
    if (e.type === 'item-get') {
      cue('item-get', 570, 0.12);
      pulse(40);
    }
    if (e.type === 'item-banned')
      toast(`${partnerName(e.by)} מחזיקים בתיק: ${ITEMS[e.item].name} הוחלף בטורבו`, 2.6);
    const h = race.handicap;
    if (e.type === 'pickup' && h.ballotCap < 10 && e.count >= h.ballotCap && !dealNoticed.cap) {
      dealNoticed.cap = true;
      toast(`כספים קואליציוניים של ${partnerName(h.owners.cap)}: רק ${h.ballotCap} פתקים מוסיפים מהירות`, 2.8);
    }
    if (e.type === 'drift-boost' && h.driftScale < 1 && !dealNoticed.drift) {
      dealNoticed.drift = true;
      toast(`ועדת החקירה של ${partnerName(h.owners.drift)} מקצרת לכם את הבוסט`, 2.6);
    }
    if (e.type === 'item-use') cue(ITEM_SOUNDS[e.item], e.item === 'boost' ? 880 : 550, 0.2);
    if (e.type === 'hit') {
      callout(e.cause === 'barrier' ? 'מחסום' : e.cause === 'noconf' ? 'אי־אמון' : 'ספין', 'danger');
      cue('hit', 130, 0.24, 'sawtooth');
      pulse([40, 30, 40]);
    }
    if (e.type === 'drift-boost') {
      cue('drift-boost-' + Math.min(3, Math.max(1, e.tier)), 700 + e.tier * 160, 0.16);
      pulse(18 + e.tier * 8);
    }
    if (e.type === 'wall') {
      pulse(20);
      audio.play('wall');
    }
    if (e.type === 'drift-start') audio.play('drift-start');
    if (e.type === 'near-miss') audio.play('near-miss');
    if (e.type === 'land') audio.play('land', { volume: e.trick ? 1 : 0.7 });
    if (e.type === 'land') pulse(e.trick ? [12, 20, 24] : 14);
    if (e.type === 'land' && e.trick) {
      callout('נחיתה מושלמת', 'gold');
      cue('trick', 1100, 0.22);
      audio.say('נחיתה מושלמת', { important: false });
    }
    if (e.type === 'jump') cue('jump', 680, 0.16);
  }
}

function finish() {
  state = 'results';
  clearControls();
  $('touch').classList.add('hidden');
  const player = race.racers[0],
    order = ranking(race),
    place = order.indexOf(player) + 1,
    key = 'ck-v3-best-' + (level.id === 'jerusalem' ? 'normal' : level.id);
  let best = Number(stored(key, '0'));
  if (!best || player.finish < best) {
    best = player.finish;
    save(key, best);
  }
  const inGp = mode === 'gp' && gp && !gp.done;
  let gained = null;
  if (inGp) {
    const votes = PARTIES.map((_, id) => race.racers.find(r => r.id === id)?.votes ?? 0);
    gained = GP.awardSeats(
      gp,
      order.map(r => r.id),
      playerHits,
      votes
    );
    gp.talksPending = !gp.done;
    saveGp();
  }
  renderResults({
    race,
    order,
    images: faceImages,
    place,
    best,
    level,
    gp: inGp ? gp : null,
    gained,
    mode
  });
  $('again').textContent = inGp ? (gp.done ? 'לספירת המנדטים' : 'למשא ומתן') : 'עוד מרוץ';
  $('homeButton').textContent = 'לתפריט';
  $('results').classList.remove('hidden');
  if (place > 3) cue('finish-lose', 360, 0.5);
  if (place === 1 && !reduced) {
    const origin = karts[selected].position;
    for (let i = 0; i < 65; i++) {
      const m = new T.Mesh(
        new T.BoxGeometry(0.13, 0.27, 0.05),
        mat(['#f2c14e', '#e5383b', '#2f6fe4', '#f3efe4'][i % 4])
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
function afterResults() {
  if (mode === 'gp' && gp) {
    if (gp.done) return showFinal();
    return showTalks();
  }
  startRace_();
}

// ——— Grand Prix screens ———
let talkNotices = [];
function showTalks() {
  state = 'talks';
  if (gp.talksPending && !gp.defectionsChecked) {
    const gone = GP.defections(gp);
    talkNotices = gone.map(id => `${PARTIES[id].name} פרשה מהקואליציה.`);
    gp.defectionsChecked = true;
    saveGp();
  }
  for (const id of ['home', 'results', 'hud', 'touch']) $(id).classList.add('hidden');
  $('talks').classList.remove('hidden');
  const draw = () =>
    renderTalks(gp, {
      notices: talkNotices,
      onInvite: id => {
        if (GP.invite(gp, id)) {
          saveGp();
          cue('coalition-join', 880, 0.15);
          draw();
        }
      },
      onDismiss: id => {
        GP.dismiss(gp, id);
        saveGp();
        cue('coalition-reject', 300, 0.15);
        draw();
      }
    });
  draw();
  $('nextRace').focus({ preventScroll: true });
}
function nextRace() {
  gp.talksPending = false;
  gp.defectionsChecked = false;
  talkNotices = [];
  saveGp();
  goToRace(GP.currentLevel(gp), 'gp');
}
function showFinal() {
  state = 'final';
  for (const id of ['results', 'hud', 'touch', 'talks']) $(id).classList.add('hidden');
  $('final').classList.remove('hidden');
  const v = renderFinal(gp, faceImages);
  cue(v.formed ? 'gov-formed' : 'gov-failed', v.formed ? 1200 : 220, 0.6);
  audio.say(v.formed ? 'הממשלה הוקמה' : 'אין ממשלה');
  $('newSeason').focus({ preventScroll: true });
}

// ——— Karts and camera ———
function updateKarts(dt) {
  if (!race) return;
  const ctx = { elapsed, reduced, camera };
  for (const r of race.racers) {
    const kart = karts[r.id];
    animateKart(kart, r, racerFrame(track, r), dt, ctx);
    kart.userData.shield.visible = r.shield > 0 || r.magnet > 0 || r.star > 0;
    kart.userData.shield.material.color.set(r.star > 0 ? '#ffd65c' : r.shield > 0 ? '#80e8fa' : '#ee8ce0');
    kart.userData.shield.material.opacity = 0.12 + Math.sin(elapsed * 6) * 0.035;
    for (const f of kart.userData.fx)
      f.mesh.visible = reduced || Math.floor(elapsed * f.rate + (f.phase || 0)) % 2 === 0;
    kart.visible = true;
    // Name tags only at mid range: close karts are obvious, distant ones would be noise.
    const range = kart.position.distanceTo(camera.position);
    // Partners stay tagged further out, so the player can tell who is on their side.
    kart.userData.name.visible =
      !r.player &&
      (state === 'running' || state === 'countdown') &&
      range > 9 &&
      range < (race.coalition.has(r.id) ? 120 : 70);
    kart.userData.name.quaternion.copy(camera.quaternion).premultiply(kart.quaternion.clone().invert());
  }
}
const camTarget = new T.Vector3();
let qaView = null;
let camSwing = 0;
const compact = () => innerWidth <= 760;
function setCamera(snap = false, dt = 1 / 60) {
  world.userData.gantry.visible = state !== 'home';
  let position, look;
  if (state === 'home' || !race) {
    // Title: the chosen kart up front, the rest of the grid behind, slowly circled.
    PARTIES.forEach((p, i) => {
      const k = karts[i];
      k.visible = true;
      k.scale.setScalar(i === selected ? 1.6 : 0.9);
      const data = track.at(i === selected ? 8 : 20 + (Math.floor(i / 2) % 4) * 5.5, i === selected ? 0 : i % 2 ? 4 : -4);
      k.position.copy(data.p);
      k.rotation.set(0, Math.atan2(data.t.x, data.t.z) + Math.PI, 0);
      k.userData.body.rotation.set(0, 0, 0);
      k.userData.body.position.y = 0;
      k.userData.body.scale.setScalar(1);
    });
    const focus = karts[selected].position.clone(),
      a = track.at(8),
      orbit = reduced ? 0.6 : 0.6 + Math.sin(elapsed * 0.12) * 0.35;
    const side = new T.Vector3(-a.t.z, 0, a.t.x);
    // Phones frame the kart in the top part of the screen, above the menu cards.
    const portrait = innerHeight > innerWidth,
      short = innerHeight < 560,
      radius = portrait ? 21 : short ? 19 : 15;
    position = focus
      .clone()
      .addScaledVector(a.t, -Math.cos(orbit) * radius)
      .addScaledVector(side, Math.sin(orbit) * radius);
    position.y += portrait ? 8 : 6.5;
    look = focus.clone().add(new T.Vector3(0, portrait ? -3.4 : short ? 0.4 : 2.2, 0));
  } else if (state === 'intro') {
    // Sweep in from high over the grid to the usual chase position behind the player.
    const r = race.racers[0],
      a = racerFrame(track, r),
      u = Math.min(1, introT / INTRO_TIME),
      e = 1 - (1 - u) ** 3;
    // Out front and off to the side, high, then around and down behind the grid: the side
    // offset and the height decay late so the camera never passes through the start gantry.
    const back = wideCamera ? 14.2 : 10.5;
    position = a.p
      .clone()
      .addScaledVector(a.t, 40 - (40 + back) * e)
      .addScaledVector(a.right, -26 * (1 - e) ** 0.6);
    position.y += (wideCamera ? 7.8 : 5.8) + 20 * (1 - e) ** 0.7;
    look = a.p.clone().addScaledVector(a.t, 6 + 6 * e);
    look.y += 1;
    snap = true;
  } else if (state === 'finishing' || state === 'results') {
    const k = karts[race.racers[0].id],
      t = state === 'finishing' ? finishT * 0.5 : finishT * 0.5 + elapsed * 0.05;
    const r = racerFrame(track, race.racers[0]);
    position = k.position
      .clone()
      .addScaledVector(r.t, Math.cos(t + 2.4) * 9)
      .addScaledVector(r.right, Math.sin(t + 2.4) * 9);
    position.y += 3.4;
    look = k.position.clone().add(new T.Vector3(0, 1.6, 0));
  } else {
    const r = race.racers[0],
      a = racerFrame(track, r),
      ahead = racerFrame(track, r, wideCamera ? 17 : 12);
    position = a.p.clone().addScaledVector(a.t, -(wideCamera ? 14.2 : 10.5));
    position.y += wideCamera ? 7.8 : 5.8;
    look = ahead.p.clone();
    look.y += 1.0;
    if (r.boost > 0 && !reduced) position.addScaledVector(a.t, -1);
    // In a drift the camera swings to the outside so the slide angle reads; jumps lift it a touch.
    const swingTarget = reduced ? 0 : r.drifting ? r.steer * 2.4 : r.steer * 0.6;
    camSwing += (swingTarget - camSwing) * -Math.expm1(-dt * 3);
    position.addScaledVector(a.right, camSwing);
    look.addScaledVector(a.right, camSwing * 0.35);
    if (r.air > 0) position.y += Math.sin((1 - r.air / r.airTotal) * Math.PI) * 1.4;
  }
  // QA: a fixed view of any point on the track (only set through the ?qa=1 hooks).
  if (qaView) {
    const a = track.at(qaView.s - qaView.back, qaView.x);
    position = a.p.clone().add(new T.Vector3(0, qaView.up, 0));
    look = track
      .at(qaView.s, 0)
      .p.clone()
      .add(new T.Vector3(0, qaView.up * 0.35, 0));
    snap = true;
  }
  camera.position.lerp(position, snap ? 1 : -Math.expm1(-8 * dt));
  camTarget.lerp(look, snap ? 1 : -Math.expm1(-10 * dt));
  if (fx.shake > 0 && !reduced)
    camera.position.add(
      new T.Vector3(Math.sin(elapsed * 77) * fx.shake * 0.5, Math.cos(elapsed * 61) * fx.shake * 0.25, 0)
    );
  camera.lookAt(camTarget);
  const desiredFov =
    state === 'home' || !race
      ? innerHeight > innerWidth
        ? 58
        : 42
      : state === 'finishing' || state === 'results'
        ? 40
        : (compact() ? 60 : wideCamera ? 55 : 49) + (race.racers[0].boost > 0 && !reduced ? 5 : 0);
  camera.fov += (desiredFov - camera.fov) * (snap ? 1 : -Math.expm1(-dt * 5));
  camera.updateProjectionMatrix();
  const focus = state === 'home' || !race ? karts[selected].position : racerFrame(track, race.racers[0]).p;
  sun.position.copy(focus).add(sunOffset);
  sun.target.position.copy(focus);
}
function resize() {
  const rect = arena.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height, false);
  trails.resize(rect.height * renderer.getPixelRatio());
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(arena);
resize();

const INTRO_TIME = 3.4;
function beginCountdown() {
  if (state !== 'intro') return;
  state = 'countdown';
  arena.classList.remove('cinematic');
  $('countdown').classList.remove('hidden');
}
function updateHUD() {
  const position = hud.update(race, {
    selected,
    gp: mode === 'gp' && gp ? gp : null,
    coalitionSeats: gp ? GP.coalitionSeats(gp) : 0,
    now: elapsed
  });
  if (position < previousRank && race.time > 4 && state === 'running') {
    cue('overtake', 700, 0.07);
    if (position === 1) {
      callout('מקום ראשון', 'gold');
      audio.say('מקום ראשון');
    } else taunt(ranking(race)[position].id, 'beaten');
    pulse(position === 1 ? [30, 45, 40] : 24);
  }
  // Dropped a place: the kart now just ahead is the one that went by.
  if (position > previousRank && race.time > 4 && state === 'running')
    taunt(ranking(race)[position - 2].id, 'pass');
  previousRank = position;
}

let perfTime = 0,
  perfFrames = 0,
  perfCalm = 0;
function adaptQuality(rawDt) {
  if (document.hidden || state === 'paused' || rawDt > 0.25) return;
  perfTime += rawDt;
  perfFrames++;
  if (perfTime < 1) return;
  const fps = perfFrames / perfTime;
  perfTime = perfFrames = 0;
  let next = renderScale;
  if (fps < 48) next = Math.max(minScale, renderScale - 0.12);
  else if (fps > 57 && ++perfCalm >= 3) next = Math.min(maxScale, renderScale + 0.08);
  if (fps <= 57) perfCalm = 0;
  if (Math.abs(next - renderScale) > 0.01) {
    renderScale = next;
    renderer.setPixelRatio(renderScale);
    resize();
  }
}
function frame(now) {
  requestAnimationFrame(frame);
  const rawDt = (now - last) / 1000 || 0.016;
  const dt = Math.min(0.05, rawDt);
  last = now;
  elapsed += dt;
  adaptQuality(rawDt);
  if (state === 'countdown') {
    const old = Math.ceil(count);
    count -= dt;
    $('countdown').textContent = count > 0.5 ? Math.ceil(count - 0.5) : 'צא!';
    arena.classList.toggle('launch-window', count <= 1.5 && count > 0.45);
    if (Math.ceil(count) !== old) {
      cue(count > 0.5 ? 'countdown-beep' : 'countdown-go', count > 0.5 ? 540 : 1000, 0.12);
      audio.say(count > 0.5 ? COUNT_WORDS[Math.ceil(count - 0.5) - 1] : 'צא!', { important: false });
      pulse(count > 0.5 ? 18 : 35);
    }
    if (count <= 0) {
      state = 'running';
      arena.classList.remove('launch-window');
      startRace(race, launchPressed >= 0.45 && launchPressed <= 1.15);
      $('countdown').classList.add('hidden');
      $('raceHint').textContent = touchDevice()
        ? ''
        : 'W גז · A D היגוי · Shift דריפט · רווח אביזר · E יכולת';
    }
  }
  if (state === 'running') {
    const p = race.racers[0],
      before = p.s,
      wasRoute = !!p.routeId;
    // Phones and tablets drive with the touch module (analog stick, auto-drift, full throttle);
    // a keyboard plugged into a tablet still works alongside it.
    const pad = touchDevice() ? touchCtl.read(dt, p, controls) : null;
    const keySteer = Number(controls.right) - Number(controls.left);
    stepRace(
      race,
      dt,
      {
        steer: pad && !keySteer ? pad.steer : keySteer,
        drift: controls.drift || !!pad?.drift,
        brake: controls.brake || !!pad?.brake,
        accelerate: controls.accelerate || !!pad,
        sensitivity
      },
      routeBend(track, p)
    );
    stepEncounters(race, before, wasRoute);
    bumpRivals(race);
    syncPickups();
    consumeEvents();
    const lap = Math.floor(Math.max(0, p.s) / track.length);
    if (lap > lastLap) {
      lastLap = lap;
      if (!race.done) {
        callout(lap === 2 ? 'הקפה אחרונה' : 'הקפה 2', lap === 2 ? 'gold' : '');
        if (lap === 2) audio.say('הקפה אחרונה');
      }
      cue(lap === 2 ? 'final-lap' : 'lap', 850, 0.25);
    }
    if (race.time > 7) $('raceHint').classList.add('hidden');
    if (race.done) {
      state = 'finishing';
      finishT = 0;
      const place = ranking(race).indexOf(race.racers[0]) + 1;
      callout(place === 1 ? 'ניצחון!' : 'סיום · מקום ' + place, place === 1 ? 'gold' : '');
      audio.say(place === 1 ? 'ניצחון!' : 'סיימתם במקום ' + place);
      arena.classList.add('cinematic');
      $('touch').classList.add('hidden');
      cue(place <= 3 ? 'finish-win' : 'lap', place === 1 ? 1000 : 600, 0.4);
    }
  }
  if (state === 'intro') {
    introT += dt;
    if (introT > INTRO_TIME) beginCountdown();
  }
  // Slow motion over the line, then the results.
  const slow = state === 'finishing' ? 0.35 : 1;
  if (state === 'finishing') {
    finishT += dt;
    coastRace(race, dt * slow);
    if (finishT > 2.6) {
      arena.classList.remove('cinematic');
      finish();
    }
  }
  if (state === 'results' && race) coastRace(race, dt);
  if (race && ['intro', 'countdown', 'running', 'finishing', 'results'].includes(state))
    updateKarts(dt * slow);
  audio.update(dt, {
    racing: state === 'running' || state === 'countdown',
    player: race?.racers[0],
    lastLap: state === 'running' && lastLap >= 2,
    menu: state === 'home'
  });
  if (state !== 'paused') {
    encounters.update(
      race && state !== 'home' ? race.time : elapsed,
      Math.floor(Math.max(0, race?.racers[0].s || 0) / track.length)
    );
    fx.update(dt, state === 'home' || !race ? null : race);
    updateTrails(dt);
    setCamera(false, dt);
    scenery.update(elapsed);
    if (race && state === 'running' && elapsed - pollDrawnAt > 0.5) {
      pollDrawnAt = elapsed;
      const order = ranking(race);
      scenery.drawPoll(
        order.map((r, i) => ({
          name: PARTIES[r.id].short,
          color: PARTIES[r.id].color,
          seats: (GP.SEATS_BY_PLACE[i] ?? 0) + Math.round(r.votes / 4)
        })),
        level.name
      );
    }
    updateHeadlight();
    drawPickups(dt);
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
  if (race && ['countdown', 'running'].includes(state) && hudClock > 0.09) {
    updateHUD();
    hudClock = 0;
  }
  renderer.render(scene, camera);
}

// ——— Wiring ———
$('play').onclick = play;
$('again').onclick = afterResults;
$('homeButton').onclick = goHome;
$('pause').onclick = pause;
$('resume').onclick = resume;
$('restart').onclick = startRace_;
$('quit').onclick = goHome;
// Item and ability fire on pointerdown: phones do not synthesise a click while another finger is
// on the screen, so with click they could not be used while steering. Click stays for the keyboard.
for (const [id, fire] of [
  ['item', activateItem],
  ['ability', activateAbility]
]) {
  $(id).onpointerdown = e => {
    e.preventDefault();
    fire();
  };
  $(id).onclick = e => e.detail === 0 && fire();
}
$('camera').onclick = toggleCamera;
$('nextRace').onclick = nextRace;
$('talksQuit').onclick = goHome;
$('newSeason').onclick = () => {
  gp = null;
  saveGp();
  setMode('gp');
  goHome();
};
$('finalHome').onclick = () => {
  gp = null;
  saveGp();
  goHome();
};
$('resumeSeason').onclick = () => {
  mode = 'gp';
  selected = gp.player;
  if (gp.talksPending) showTalks();
  else goToRace(GP.currentLevel(gp), 'gp');
};
$('abandonSeason').onclick = () => {
  gp = null;
  saveGp();
  refreshResumeCard();
};
$('single').onclick = () => showTrackSheet(true);
$('prevDriver').onclick = () => choose((selected + PARTIES.length - 1) % PARTIES.length);
$('nextDriver').onclick = () => choose((selected + 1) % PARTIES.length);
$('trackBack').onclick = () => showTrackSheet(false);
arena.addEventListener('pointerdown', () => state === 'intro' && beginCountdown());
// Touch driving: a quick tap in the steering zone fires the item; touching at "1" is a launch.
const touchCtl = makeTouchControls({
  zone: $('steerZone'),
  stick: $('stick'),
  hint: $('steerHint'),
  driftButton: document.querySelector('.touch-drift'),
  onTap: () => state === 'running' && activateItem(),
  onDown: () => {
    if (state === 'countdown') launchPressed = count;
    if (state === 'intro') beginCountdown();
  },
  haptic: pattern => pulse(pattern)
});
let steerMode = stored('ck-steer-mode', 'drag'),
  autoDriftOn = stored('ck-auto-drift', 'on') === 'on';
async function setSteerMode(next) {
  const ok = await touchCtl.setMode(next);
  if (!ok) {
    toast('אין גישה לחיישן ההטיה — נשארים עם גרירה');
    next = 'drag';
    await touchCtl.setMode(next);
  }
  steerMode = next;
  save('ck-steer-mode', next);
  for (const b of document.querySelectorAll('[data-steer]'))
    b.setAttribute('aria-checked', String(b.dataset.steer === next));
}
for (const b of document.querySelectorAll('[data-steer]')) b.onclick = () => setSteerMode(b.dataset.steer);
$('autoDriftToggle').checked = autoDriftOn;
touchCtl.setAutoDrift(autoDriftOn);
$('autoDriftToggle').onchange = e => {
  autoDriftOn = e.target.checked;
  save('ck-auto-drift', autoDriftOn ? 'on' : 'off');
  touchCtl.setAutoDrift(autoDriftOn);
};
// Tilt needs a fresh permission tap on iOS, so a saved tilt choice starts as drag until re-picked.
setSteerMode(steerMode === 'tilt' ? 'drag' : steerMode);
// No long-press menus, text selection or pinch zoom while playing.
arena.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('gesturestart', e => e.preventDefault());
$('sound').onclick = () => setSound(!sound);
$('soundToggle').onchange = e => setSound(e.target.checked);
$('musicToggle').onchange = e => {
  musicOn = e.target.checked;
  save('ck-music', musicOn ? 'on' : 'off');
  audio.setMusic(musicOn);
};
$('voiceToggle').onchange = e => {
  voiceOn = e.target.checked;
  save('ck-voice', voiceOn ? 'on' : 'off');
  audio.setVoice(voiceOn);
  if (voiceOn) audio.say('הקריין איתכם');
};
$('wideToggle').onchange = e => {
  if (e.target.checked !== wideCamera) toggleCamera();
};
$('steeringSensitivity').value = sensitivity;
$('sensitivityValue').textContent = Math.round(sensitivity * 100) + '%';
$('steeringSensitivity').oninput = e => {
  sensitivity = Number(e.target.value);
  save('ck-steering', sensitivity);
  $('sensitivityValue').textContent = Math.round(sensitivity * 100) + '%';
};
$('fullscreen').onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    toast('מסך מלא אינו זמין בדפדפן הזה');
  }
};
const commandCodes = new Set(['Space', 'Escape', 'KeyP', 'KeyC', 'KeyE']);
addEventListener('keydown', e => {
  if ($('info').open || e.target instanceof HTMLInputElement) return;
  if (state === 'intro') return beginCountdown();
  if (state === 'home' && e.code === 'Enter' && document.activeElement === document.body) return play();
  if (state === 'home' && e.code === 'Escape' && !$('trackSheet').classList.contains('hidden'))
    return showTrackSheet(false);
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
  if (e.code === 'KeyE') activateAbility();
  if (e.code === 'KeyC') toggleCamera();
  if (e.code === 'Escape' || e.code === 'KeyP') state === 'paused' ? resume() : pause();
});
addEventListener('keyup', e => {
  heldKeys.delete(e.code);
  syncControls();
});
for (const button of document.querySelectorAll('[data-key]')) {
  button.onpointerdown = e => {
    e.preventDefault();
    if (!['running', 'countdown'].includes(state)) return;
    if (state === 'countdown') launchPressed = count;
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
  button.onpointerup = button.onpointercancel = button.onlostpointercapture = up;
}
addEventListener('blur', () => {
  clearControls();
  pause();
});
document.addEventListener('visibilitychange', () => document.hidden && pause());
canvas.addEventListener('webglcontextlost', e => {
  e.preventDefault();
  pause();
  $('error').classList.remove('hidden');
});
let infoFocus;
function info(content) {
  pause();
  infoFocus = document.activeElement;
  $('infoContent').innerHTML = content;
  $('info').showModal();
}
$('help').onclick = () => info(helpHTML(touchDevice()));
$('credits').onclick = () => info(CREDITS_HTML);
$('closeInfo').onclick = () => $('info').close();
$('info').addEventListener('close', () => infoFocus?.focus());

// ——— Boot ———
renderDrivers(kartImages, selected, choose);
renderGarage(selected);
renderTracks(level.id, pickTrack);
$('driverFace').src = faceImages[selected];
$('sound').setAttribute('aria-pressed', String(sound));
$('soundToggle').checked = sound;
$('musicToggle').checked = musicOn;
$('voiceToggle').checked = voiceOn;
audio.setEnabled(sound);
$('wideToggle').checked = wideCamera;
setMode(mode);
refreshResumeCard();
document.title = `${level.name} — קואליציה קארט`;
setCamera(true);
// The loading poster fills its bar, then lifts away to reveal the title screen.
// It stays up at least long enough to be seen, even when everything is cached.
setTimeout(
  () => {
    $('loading').classList.add('done');
    setTimeout(() => $('loading').classList.add('hidden'), reduced ? 0 : 900);
  },
  Math.max(0, 1800 - performance.now())
);
$('play').disabled = false;
requestAnimationFrame(frame);
if (params.get('go') === '1') {
  // Arrived from a menu or between Grand Prix races: drop straight onto the grid.
  history.replaceState(null, '', `${location.pathname}?level=${level.id}&mode=${mode}`);
  if (mode === 'gp' && gp?.talksPending) showTalks();
  else startRace_();
}

// Read-only state for browser QA and assistive tooling. No remote data or score writes.
window.readKartState = () => ({
  state,
  mode,
  countdown: state === 'countdown' ? count : null,
  selected: PARTIES[selected].id,
  level: level.id,
  length: track.length,
  roadWidth: ROAD.halfWidth * 2,
  sensitivity,
  wideCamera,
  controls: { ...controls },
  renderCalls: renderer.info.render.calls,
  renderScale,
  gp: gp ? { round: gp.round, seats: [...gp.seats], coalition: [...gp.coalition], done: gp.done } : null,
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
        racers: race.racers.map(({ brain, stats, ...r }) => ({ ...r }))
      }
    : null
});
// QA hooks, only with ?qa=1: jump to Grand Prix screens without racing three times.
if (params.get('qa') === '1')
  window.__ck = {
    setGp(next) {
      gp = next;
      mode = 'gp';
      saveGp();
    },
    showTalks,
    showFinal,
    goHome,
    faces: faceImages,
    view(u, back = 30, up = 9, x = 0) {
      qaView = u === null ? null : { s: u * track.length, back, up, x };
    }
  };
