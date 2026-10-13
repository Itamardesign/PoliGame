// Set dressing for the Jerusalem circuit: sky, terrain, road furniture, city blocks, trees,
// crowds, election posters, trilingual road signs and the landmarks of each district.
// Districts follow lap fraction: avenue (Knesset), bridge (Chords Bridge), market (Mahane Yehuda),
// park (Yemin Moshe, the windmill and the Old City walls on the skyline).
import * as T from './vendor/three.module.min.js';
import { PARTIES, ROAD, rng } from './race-model.js';
import {
  kitMaterial as K,
  scaledBox,
  instanced,
  GEO,
  asphaltTexture,
  roadSignTexture,
  posterTexture,
  textCanvasTexture,
  batchStatic
} from './world-kit.js';
import { buildNews, inTunnel } from './world-news.js';
import { layoutCheckpoints } from './race-course.js';

const DISTRICT = u => (u < 0.23 ? 'avenue' : u < 0.48 ? 'bridge' : u < 0.76 ? 'market' : 'park');
export const MOODS = {
  day: {
    zenith: '#4f8fd0',
    horizon: '#e9e2cf',
    ground: '#a39a76',
    sun: '#fff1d0',
    sunDir: [-0.45, 0.62, -0.5],
    hemi: ['#fff6e2', '#6d7a5c', 2.1],
    key: ['#fff0d2', 3.2],
    clouds: 0.55,
    stars: 0,
    exposure: 1.0
  },
  dusk: {
    zenith: '#4a5f8f',
    horizon: '#f2b27a',
    ground: '#8c7458',
    sun: '#ffb46e',
    sunDir: [-0.75, 0.16, -0.4],
    hemi: ['#ffd9b0', '#5e5048', 1.7],
    key: ['#ffc58a', 3.0],
    clouds: 0.5,
    stars: 0,
    exposure: 1.02
  },
  night: {
    zenith: '#05091a',
    horizon: '#1d2a4b',
    ground: '#151b26',
    sun: '#cfd9ff',
    sunDir: [0.3, 0.55, -0.6],
    hemi: ['#9db3ea', '#2c3448', 1.55],
    key: ['#b4c2ff', 1.35],
    clouds: 0.25,
    stars: 1,
    exposure: 1.1
  }
};

function skyDome(mood) {
  const m = MOODS[mood];
  const material = new T.ShaderMaterial({
    side: T.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      zenith: { value: new T.Color(m.zenith) },
      horizon: { value: new T.Color(m.horizon) },
      ground: { value: new T.Color(m.ground) },
      sunColor: { value: new T.Color(m.sun) },
      sunDir: { value: new T.Vector3(...m.sunDir).normalize() },
      clouds: { value: m.clouds },
      stars: { value: m.stars },
      time: { value: 0 }
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`,
    fragmentShader: `uniform vec3 zenith, horizon, ground, sunColor, sunDir; uniform float clouds, stars, time; varying vec3 vDir;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }
      float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a*noise(p); p *= 2.03; a *= 0.5; } return v; }
      void main(){
        vec3 d = normalize(vDir); float h = d.y;
        vec3 col = mix(horizon, zenith, pow(clamp(h, 0.0, 1.0), 0.55));
        col = mix(col, ground, smoothstep(0.0, -0.2, h));
        float s = max(dot(d, normalize(sunDir)), 0.0);
        col += sunColor * (pow(s, 1200.0) * 6.0 + pow(s, 14.0) * 0.28);
        if (h > 0.0) {
          vec2 uv = d.xz / (h + 0.12) * 0.9 + vec2(time * 0.004, 0.0);
          float c = smoothstep(0.52, 0.86, fbm(uv));
          col = mix(col, mix(horizon, vec3(1.0), 0.65) * (0.75 + 0.25 * s), c * clouds * smoothstep(0.0, 0.25, h));
          float st = step(0.9982, hash(floor(d.xz / (h + 0.3) * 260.0)));
          col += vec3(st) * stars * smoothstep(0.05, 0.4, h) * (1.0 - c);
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const dome = new T.Mesh(new T.SphereGeometry(390, 32, 16), material);
  dome.frustumCulled = false;
  dome.renderOrder = -1;
  return dome;
}

function ribbon(track, offset, width, material, height = 0, uvScale = 8) {
  const pos = [],
    idx = [],
    uv = [],
    N = 560;
  for (let i = 0; i <= N; i++) {
    for (const edge of [-1, 1]) {
      const p = track.at((i / N) * track.length, offset + (edge * width) / 2).p;
      pos.push(p.x, p.y + height, p.z);
      uv.push(((edge + 1) * width) / (2 * uvScale), ((i / N) * track.length) / uvScale);
    }
    if (i < N) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new T.Mesh(g, material);
  m.receiveShadow = true;
  return m;
}

// Height of the ground beside the road: road level out to 12.8 m, then the embankment slopes
// down to the terrain at 17 m.
// Above this height the road is a viaduct on piers: no embankment, and the ground beside it is
// the terrain below.
export const VIADUCT = 5.5;
export const sideY = (roadY, off) => {
  const a = Math.abs(off);
  if (roadY > VIADUCT && a > 12.8) return 0;
  return a <= 12.8 ? roadY : a >= 17 ? 0 : roadY * (1 - (a - 12.8) / 4.2);
};
// Place a group on the road frame: local +z along the road, +x toward the road's left.
function along(parent, track, s, x = 0, groundY = null) {
  const g = new T.Group(),
    { p, t } = track.at(s, x);
  g.position.copy(p);
  g.position.y = groundY ?? sideY(p.y, x);
  g.rotation.y = Math.atan2(t.x, t.z);
  parent.add(g);
  return g;
}
const add = (g, geo, mat, x = 0, y = 0, z = 0) => {
  const m = new T.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  g.add(m);
  return m;
};

// A Jerusalem apartment block: stone, shuttered windows, balconies, solar heaters on the roof.
function apartment(parent, random, floors, w, d, mood, solar) {
  const g = new T.Group(),
    fh = 3.1,
    h = floors * fh + 0.6;
  parent.add(g);
  add(g, scaledBox(w, h, d), K(random() < 0.3 ? 'stone-pale' : 'stone'), 0, h / 2, 0);
  add(g, scaledBox(w + 0.4, 0.35, d + 0.4), K('stone-pale'), 0, h + 0.15, 0);
  const lit = mood === 'night';
  for (const side of [-1, 1])
    for (let f = 0; f < floors; f++) {
      const y = 1.6 + f * fh;
      for (let x = -w / 2 + 1.6; x <= w / 2 - 1.4; x += 2.6) {
        const win = add(
          g,
          new T.BoxGeometry(1.1, 1.45, 0.12),
          K(lit && random() < 0.55 ? 'window' : 'window', lit && random() < 0.5 ? 'night' : 'day'),
          x,
          y,
          side * (d / 2 + 0.01)
        );
        win.castShadow = false;
        add(g, new T.BoxGeometry(1.35, 1.7, 0.06), K('#ece6d8'), x, y, side * (d / 2 - 0.01)).castShadow =
          false;
        // Roller blinds (trisim), part-drawn.
        const drawn = 0.2 + random() * 0.6;
        add(
          g,
          new T.BoxGeometry(1.1, 1.45 * drawn, 0.14),
          K('#b9b2a2'),
          x,
          y + 0.725 - (1.45 * drawn) / 2,
          side * (d / 2 + 0.02)
        ).castShadow = false;
        // Wooden shutter beside most windows; balconies on every other bay.
        if (random() < 0.6)
          add(
            g,
            new T.BoxGeometry(0.55, 1.45, 0.08),
            K('shutter'),
            x + 0.85,
            y,
            side * (d / 2 + 0.05)
          ).castShadow = false;
        if (f > 0 && random() < 0.28) {
          add(g, scaledBox(1.9, 0.14, 0.9), K('stone-pale'), x, y - 0.8, side * (d / 2 + 0.45));
          add(
            g,
            new T.BoxGeometry(1.9, 0.75, 0.05),
            K('rail'),
            x,
            y - 0.38,
            side * (d / 2 + 0.88)
          ).castShadow = false;
        }
      }
    }
  for (const side of [-1, 1])
    for (let f = 0; f < floors; f++)
      for (let z = -d / 2 + 1.6; z <= d / 2 - 1.4; z += 2.8)
        add(
          g,
          new T.BoxGeometry(0.12, 1.45, 1.1),
          K('window', lit && random() < 0.5 ? 'night' : 'day'),
          side * (w / 2 + 0.01),
          1.6 + f * fh,
          z
        ).castShadow = false;
  // Roof clutter: the solar water heaters every Israeli roof carries.
  const roof = [];
  const n = Math.max(1, Math.floor((w * d) / 40));
  for (let i = 0; i < n; i++)
    roof.push({
      x: (random() - 0.5) * (w - 2.5),
      y: h + 0.3,
      z: (random() - 0.5) * (d - 2.5),
      ry: Math.round(random()) * Math.PI
    });
  solar.push(...roof.map(r => ({ ...r, group: g })));
  return g;
}

export function buildWorld(scene, track, { mood = 'day', logos = [], level } = {}) {
  const M = MOODS[mood],
    random = rng(6161),
    L = track.length,
    night = mood === 'night';
  const updates = [];
  // Static scenery is collected here and merged by material at the end; animated parts stay out.
  const S = new T.Group(),
    animated = new Set();
  scene.add(S);

  scene.add(skyDome(mood));
  const sky = scene.children.at(-1);
  updates.push(t => (sky.material.uniforms.time.value = t));

  // Ground and distant hills.
  const groundMap = K('grass', mood).map.clone();
  groundMap.repeat.set(36, 36);
  groundMap.needsUpdate = true;
  const ground = new T.Mesh(
    new T.PlaneGeometry(900, 900),
    new T.MeshStandardMaterial({ map: groundMap, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(40, -0.05, 0);
  ground.receiveShadow = true;
  scene.add(ground);
  {
    // Jerusalem hills: a broken ring of low ridges, terraced with olive trees further out.
    const hills = new T.Group();
    scene.add(hills);
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + random() * 0.1,
        r = 250 + random() * 60;
      const hill = new T.Mesh(
        new T.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2),
        K('grass', mood)
      );
      hill.scale.set(50 + random() * 40, 16 + random() * 22, 40 + random() * 30);
      hill.position.set(40 + Math.cos(a) * r, -2, Math.sin(a) * r);
      hill.rotation.y = random() * 3;
      hills.add(hill);
    }
  }

  // Track samples for keeping scenery off the road.
  const samples = Array.from({ length: 360 }, (_, i) => track.at((i / 360) * L).p);
  const clear = (x, z, d) => samples.every(p => (p.x - x) ** 2 + (p.z - z) ** 2 > d * d);

  // Road: paved shoulders, textured asphalt, edge and lane lines.
  scene.add(ribbon(track, 0, 26, K('paving'), -0.1, 4));
  const asphalt = new T.MeshStandardMaterial({
    map: asphaltTexture(night),
    roughness: 0.92,
    color: night ? '#9aa0b4' : '#ffffff'
  });
  scene.add(ribbon(track, 0, ROAD.halfWidth * 2, asphalt, 0.035, 8));
  const lineMat = new T.MeshStandardMaterial({ color: '#efeee6', roughness: 0.6 });
  for (const side of [-1, 1]) scene.add(ribbon(track, side * 9.25, 0.18, lineMat, 0.07));
  {
    // Dashed lane lines, instanced.
    const dashes = [];
    for (let s = 6; s < L; s += 9)
      for (const off of [-3.2, 3.2]) {
        const { p, t } = track.at(s, off);
        dashes.push({ x: p.x, y: p.y + 0.065, z: p.z, ry: Math.atan2(t.x, t.z) });
      }
    instanced(scene, new T.BoxGeometry(0.14, 0.02, 3), lineMat, dashes, { shadow: false });
  }
  // Kerbs: red-and-white through corners, blue-and-white along city kerbs, plain elsewhere.
  {
    const sets = { 'kerb-white': [], 'kerb-red': [], 'kerb-blue': [], 'kerb-grey': [] };
    for (const side of [-1, 1])
      for (let s = 0, i = 0; s < L; s += 1.3, i++) {
        const { p, t } = track.at(s, side * 10.35),
          bend = Math.abs(track.bend(s)),
          d = DISTRICT(s / L);
        const paint =
          bend > 0.012 ? 'kerb-red' : d === 'avenue' || d === 'market' ? 'kerb-blue' : 'kerb-grey';
        sets[i % 2 ? 'kerb-white' : paint].push({ x: p.x, y: p.y + 0.08, z: p.z, ry: Math.atan2(t.x, t.z) });
      }
    for (const [mat, list] of Object.entries(sets))
      instanced(scene, new T.BoxGeometry(0.7, 0.2, 1.3), K(mat), list);
  }
  // Embankment down to the ground so raised road never floats.
  for (const side of [-1, 1]) {
    const v = [],
      ix = [],
      uv = [];
    for (let i = 0; i <= 280; i++) {
      const s = (i / 280) * L,
        a = track.at(s, side * 12.8).p,
        b = track.at(s, side * 17).p;
      // On a viaduct the bank collapses to nothing; piers carry the road instead.
      if (a.y > VIADUCT) v.push(a.x, a.y - 0.13, a.z, a.x, a.y - 0.13, a.z);
      else v.push(a.x, a.y - 0.13, a.z, b.x, -0.05, b.z);
      uv.push(0, s / 6, 1, s / 6);
      if (i < 280) ix.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(v, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setIndex(ix);
    g.computeVertexNormals();
    const m = new T.Mesh(g, K('grass', mood));
    m.material.side = T.DoubleSide;
    m.receiveShadow = true;
    scene.add(m);
  }

  // Street lamps on both sides; at night they light pools on the road.
  const lamps = [],
    pools = [];
  for (let s = 10; s < L; s += 23)
    for (const side of [-1, 1]) {
      if (track.at(s).p.y > VIADUCT || inTunnel(s, L)) continue;
      const { p, t } = track.at(s + (side > 0 ? 11 : 0), side * 13.4);
      const ry = Math.atan2(t.x, t.z) + (side > 0 ? Math.PI / 2 : -Math.PI / 2);
      lamps.push({ x: p.x, y: sideY(p.y, 13.4), z: p.z, ry });
      if (night) {
        const q = track.at(s + (side > 0 ? 11 : 0), side * 12);
        pools.push({ x: q.p.x, y: q.p.y + 0.09, z: q.p.z, rx: -Math.PI / 2, s: 1 });
      }
    }
  instanced(scene, GEO.lampPole(), K('dark-metal'), lamps);
  instanced(scene, GEO.lampHead(), K('lamp', mood), lamps, { shadow: false });
  if (night) {
    const glow = textCanvasTexture(128, 128, (ctx, w) => {
      const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      g.addColorStop(0, 'rgba(255,214,150,0.55)');
      g.addColorStop(1, 'rgba(255,214,150,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, w);
    });
    instanced(
      scene,
      new T.PlaneGeometry(13, 13),
      new T.MeshBasicMaterial({
        map: glow,
        transparent: true,
        depthWrite: false,
        blending: T.AdditiveBlending
      }),
      pools,
      { shadow: false }
    );
  }

  // City blocks: dense along the avenue and the market, scattered elsewhere, all in stone.
  const city = new T.Group();
  S.add(city);
  const solar = [];
  const placed = [];
  const free = (x, z, r) => placed.every(([px, pz, pr]) => (px - x) ** 2 + (pz - z) ** 2 > (pr + r) ** 2);
  for (let s = 0; s < L; s += 15) {
    const d = DISTRICT(s / L);
    if (d === 'bridge' || d === 'park') continue;
    for (const side of [-1, 1]) {
      if (random() < 0.15) continue;
      const w = 11 + random() * 8,
        dd = 9 + random() * 5,
        off = side * (21 + dd / 2 + random() * 4);
      const { p, t } = track.at(s + random() * 6, off);
      const r = Math.max(w, dd) * 0.6;
      if (!clear(p.x, p.z, 17 + r) || !free(p.x, p.z, r)) continue;
      placed.push([p.x, p.z, r]);
      const b = apartment(
        city,
        random,
        2 + Math.floor(random() * (d === 'market' ? 3 : 4)),
        w,
        dd,
        mood,
        solar
      );
      b.position.set(p.x, 0, p.z);
      b.rotation.y = Math.atan2(t.x, t.z) + Math.PI / 2;
    }
  }
  for (let i = 0; i < 70; i++) {
    const x = -130 + random() * 380,
      z = -200 + random() * 400,
      w = 10 + random() * 10,
      dd = 9 + random() * 7,
      r = Math.max(w, dd) * 0.6;
    if (!clear(x, z, 30 + r) || !free(x, z, r) || Math.hypot(x - 44, z - 10) < 40) continue;
    placed.push([x, z, r]);
    const b = apartment(city, random, 2 + Math.floor(random() * 5), w, dd, mood, solar);
    b.position.set(x, 0, z);
    b.rotation.y = Math.floor(random() * 4) * (Math.PI / 2) + (random() - 0.5) * 0.3;
  }
  city.updateMatrixWorld(true);
  const roofs = solar.map(r => {
    const v = new T.Vector3(r.x, r.y, r.z).applyMatrix4(r.group.matrixWorld);
    return { x: v.x, y: v.y, z: v.z, ry: r.ry + r.group.rotation.y };
  });
  instanced(scene, GEO.solarTank(), K('tank'), roofs);
  instanced(scene, GEO.solarPanel(), K('solar'), roofs);

  // Trees: palms on the avenue, cypress rows, olive groves in the park and the infield.
  const olives = [],
    cypresses = [],
    palms = [];
  for (let s = 4; s < L; s += 11) {
    const d = DISTRICT(s / L);
    for (const side of [-1, 1]) {
      const off = side * (15.5 + random() * 2);
      const { p } = track.at(s + random() * 4, off);
      if (!clear(p.x, p.z, 14.5) || inTunnel(s, L)) continue;
      const y = sideY(p.y, off);
      if (d === 'avenue' && side < 0)
        palms.push({ x: p.x, y, z: p.z, ry: random() * 6, s: 0.9 + random() * 0.3 });
      else if (d === 'park' || (d === 'avenue' && random() < 0.5))
        olives.push({ x: p.x, y, z: p.z, ry: random() * 6, s: 0.8 + random() * 0.5 });
      else if (d !== 'market' && random() < 0.6)
        cypresses.push({ x: p.x, y, z: p.z, s: 0.8 + random() * 0.4, sy: 0.9 + random() * 0.5 });
    }
  }
  for (let i = 0; i < 260; i++) {
    const x = -140 + random() * 400,
      z = -210 + random() * 420;
    if (!clear(x, z, 24) || !free(x, z, 3) || Math.hypot(x - 44, z - 10) < 30) continue;
    (random() < 0.7 ? olives : cypresses).push({
      x,
      y: 0,
      z,
      ry: random() * 6,
      s: 0.8 + random() * 0.6,
      sy: 0.9 + random() * 0.6
    });
  }
  instanced(scene, GEO.oliveTrunk(), K('trunk'), olives);
  instanced(scene, GEO.oliveCrown(), K('olive', mood), olives);
  instanced(scene, GEO.cypress(), K('cypress', mood), cypresses);
  instanced(scene, GEO.palmTrunk(), K('palm-trunk'), palms);
  instanced(scene, GEO.palmFronds(), K('palm', mood), palms);

  // Election posters on frames along the road, angled toward oncoming traffic.
  const frameMat = K('dark-metal');
  for (let s = 40, k = 0; s < L; s += 74, k++) {
    const side = k % 2 ? 1 : -1,
      party = PARTIES[k % PARTIES.length];
    const g = along(S, track, s, side * 15.8);
    g.rotation.y += side * 0.45 + Math.PI;
    add(g, new T.BoxGeometry(0.12, 4.6, 0.12), frameMat, -2.1, 2.3, 0);
    add(g, new T.BoxGeometry(0.12, 4.6, 0.12), frameMat, 2.1, 2.3, 0);
    add(g, new T.BoxGeometry(4.6, 3.2, 0.1), frameMat, 0, 3.4, -0.06);
    const poster = new T.Mesh(
      new T.PlaneGeometry(4.4, 3.05),
      new T.MeshStandardMaterial({
        map: posterTexture(party, logos[PARTIES.indexOf(party)]),
        roughness: 0.8,
        emissive: night ? '#ffffff' : '#000000',
        emissiveIntensity: night ? 0.35 : 0,
        emissiveMap: night ? posterTexture(party, logos[PARTIES.indexOf(party)]) : null
      })
    );
    poster.position.set(0, 3.4, 0.0);
    g.add(poster);
  }

  // Overhead sign gantries at each district, Israeli style: green, Hebrew, English, Arabic.
  const signs = level?.signs ?? [];
  track.sectors.forEach((section, i) => {
    if (i === 0) return;
    const [he, en, ar] = signs[i] ?? [section.name, '', ''];
    const g = along(S, track, section.start * L - 14);
    for (const x of [-11.8, 11.8]) add(g, new T.BoxGeometry(0.35, 12.6, 0.35), K('metal'), x, 6.3, 0);
    add(g, new T.BoxGeometry(24, 0.45, 0.45), K('metal'), 0, 12.4, 0);
    const sign = new T.Mesh(
      new T.PlaneGeometry(6.4, 3.2),
      new T.MeshStandardMaterial({
        map: roadSignTexture(he, en, ar),
        roughness: 0.6,
        emissive: night ? '#ffffff' : '#000000',
        emissiveIntensity: night ? 0.25 : 0,
        emissiveMap: night ? roadSignTexture(he, en, ar) : null
      })
    );
    sign.position.set(0, 12.6, -0.3);
    sign.rotation.y = Math.PI;
    g.add(sign);
    add(g, new T.BoxGeometry(6.6, 3.4, 0.08), K('metal'), 0, 12.6, -0.2);
  });

  // ——— Avenue: grandstand crowd behind police barriers, palms, the Knesset in the infield. ———
  {
    const barriers = [],
      bodies = [],
      heads = [],
      colors = [];
    const shirt = [
      '#2875df',
      '#22bddd',
      '#df454f',
      '#ed9941',
      '#a377df',
      '#71a753',
      '#f1f1ec',
      '#2b3440',
      '#d9d2c3'
    ];
    for (let s = -27; s < 70; s += 2.4)
      for (const side of [-1, 1]) {
        const { p, t } = track.at(s, side * 13.9);
        const ry = Math.atan2(t.x, t.z);
        barriers.push({ x: p.x, y: sideY(p.y, 13.9), z: p.z, ry: ry + Math.PI / 2 });
        for (let row = 0; row < 3; row++) {
          if (random() < 0.25) continue;
          const q = track.at(s + (random() - 0.5) * 2, side * (14.8 + row * 0.9));
          const sc = 0.9 + random() * 0.2;
          const y = sideY(q.p.y, 14.8 + row * 0.9) + row * 0.25;
          bodies.push({ x: q.p.x, y, z: q.p.z, ry: ry + (side * Math.PI) / 2, s: sc });
          heads.push({ x: q.p.x, y, z: q.p.z, s: sc });
          colors.push(shirt[Math.floor(random() * shirt.length)]);
        }
      }
    instanced(scene, GEO.crowdBarrier(), K('barrier'), barriers);
    const crowd = instanced(scene, GEO.personBody(), new T.MeshStandardMaterial({ roughness: 0.9 }), bodies);
    colors.forEach((c, i) => crowd.setColorAt(i, new T.Color(c)));
    const legs = instanced(scene, GEO.personLegs(), new T.MeshStandardMaterial({ roughness: 0.9 }), bodies);
    bodies.forEach((_, i) =>
      legs.setColorAt(i, new T.Color(['#2f3a4a', '#4b4a46', '#1f2328', '#6b5a45'][i % 4]))
    );
    const skins = instanced(scene, GEO.personHead(), new T.MeshStandardMaterial({ roughness: 0.8 }), heads);
    heads.forEach((_, i) =>
      skins.setColorAt(i, new T.Color(['#e0b393', '#c99272', '#a8714f', '#edc7a8'][i % 4]))
    );
    const hair = instanced(scene, GEO.personHair(), new T.MeshStandardMaterial({ roughness: 1 }), bodies);
    bodies.forEach((_, i) =>
      hair.setColorAt(i, new T.Color(['#2a2018', '#4a3526', '#b9b2a6', '#151515', '#7a5a3a'][i % 5]))
    );
    // Stepped grandstand behind the start, in stone.
    const stand = along(S, track, 6, 22, 0);
    for (let i = 0; i < 5; i++)
      add(stand, scaledBox(30, 0.6, 1.4), K('stone-pale'), 0, 0.3 + i * 0.6, 1 + i * 1.4).rotation.y = 0;
    stand.rotation.y += Math.PI / 2;
  }
  {
    // The Knesset: a long stone block ringed by tall square columns, on a stepped podium.
    const kn = new T.Group();
    kn.position.set(44, 0, 10);
    S.add(kn);
    add(kn, scaledBox(46, 1.2, 30), K('stone-pale'), 0, 0.6, 0);
    add(kn, scaledBox(36, 9, 20), K('stone'), 0, 5.7, 0);
    add(kn, scaledBox(40, 0.9, 24), K('stone-pale'), 0, 10.6, 0);
    const cols = [];
    for (let x = -18; x <= 18.01; x += 2.25)
      for (const z of [-11.2, 11.2]) cols.push({ x: 44 + x, y: 1.2, z: 10 + z });
    for (let z = -8.9; z <= 8.91; z += 2.25)
      for (const x of [-19.2, 19.2]) cols.push({ x: 44 + x, y: 1.2, z: 10 + z });
    const colGeo = scaledBox(0.85, 9.2, 0.85);
    colGeo.translate(0, 4.6, 0);
    instanced(scene, colGeo, K('stone-pale'), cols);
    for (let i = 0; i < 6; i++)
      add(kn, scaledBox(30, 0.25, 1.2), K('stone-pale'), 0, 0.12 + i * 0.2, 15.6 + (5 - i) * 0.9);
    // Flag on a tall mast.
    add(kn, new T.CylinderGeometry(0.1, 0.14, 18, 8), K('metal'), 25, 9, 4);
    const flag = new T.Mesh(
      new T.PlaneGeometry(4.2, 3, 12, 1),
      new T.MeshStandardMaterial({ map: israeliFlag(), side: T.DoubleSide, roughness: 0.8 })
    );
    flag.position.set(27.1, 16.4, 4);
    kn.add(flag);
    animated.add(flag);
    const rest = Float32Array.from(flag.geometry.getAttribute('position').array);
    updates.push(t => {
      const pos = flag.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        const u = (rest[i * 3] + 2.1) / 4.2;
        pos.array[i * 3 + 2] = Math.sin(t * 3 - u * 5) * 0.25 * u;
      }
      pos.needsUpdate = true;
    });
  }

  // ——— Bridge: the Chords Bridge, a slanted white pylon with a harp of cables. ———
  {
    const a = 0.25 * L,
      b = 0.38 * L,
      mid = (a + b) / 2;
    // Every high stretch of road is a viaduct: white rails along the deck, piers to the ground.
    const deck = [];
    for (let s = 0; s < L; s += 3) {
      if (track.at(s).p.y <= VIADUCT) continue;
      for (const x of [-12.1, 12.1]) {
        const { p, t } = track.at(s, x);
        deck.push({ x: p.x, y: p.y + 0.55, z: p.z, ry: Math.atan2(t.x, t.z) });
      }
    }
    instanced(scene, new T.BoxGeometry(0.12, 1.1, 3), K('#f1f1ee'), deck);
    for (let s = 0; s < L; s += 9) {
      if (track.at(s).p.y <= VIADUCT) continue;
      const g = along(S, track, s, 0, track.at(s).p.y);
      const h = g.position.y + 0.4;
      for (const x of [-6, 6])
        add(g, new T.CylinderGeometry(0.9, 1.1, h, 12), K('#e7e4dc'), x, -h / 2 - 0.1, 0);
      add(g, new T.BoxGeometry(22, 0.6, 2), K('#e7e4dc'), 0, -0.4, 0);
    }
    // The pylon stands on the ground beside the deck and leans back over it.
    const base = track.at(mid, -17);
    base.p.y = 0;
    const top = base.p
      .clone()
      .add(new T.Vector3(0, 56, 0))
      .addScaledVector(base.t, -9);
    const pylon = new T.Mesh(new T.CylinderGeometry(0.7, 1.4, base.p.distanceTo(top), 12), K('#f6f6f3'));
    pylon.position.copy(base.p).lerp(top, 0.5);
    pylon.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), top.clone().sub(base.p).normalize());
    pylon.castShadow = true;
    S.add(pylon);
    const cables = [];
    const n = 22;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1),
        anchor = track
          .at(a + 6 + u * (b - a - 12), 11.5)
          .p.setY(track.at(a + 6 + u * (b - a - 12)).p.y + 0.6);
      const from = base.p.clone().lerp(top, 0.45 + 0.55 * (1 - Math.abs(u - 0.5) * 2) * 0.95);
      const len = from.distanceTo(anchor),
        q = new T.Quaternion().setFromUnitVectors(
          new T.Vector3(0, 1, 0),
          anchor.clone().sub(from).normalize()
        ),
        e = new T.Euler().setFromQuaternion(q);
      const c = from.clone().lerp(anchor, 0.5);
      cables.push({ x: c.x, y: c.y, z: c.z, rx: e.x, ry: e.y, rz: e.z, sy: len });
    }
    instanced(scene, new T.CylinderGeometry(0.05, 0.05, 1, 5), K('#f6f6f3'), cables, { shadow: false });
  }

  // ——— Market: Mahane Yehuda stalls, spice pyramids, the light rail running alongside. ———
  {
    const awningColors = ['#c0392b', '#e8e2d0', '#2f6f6a', '#d68a2c'];
    const goods = ['#d24a3a', '#e5b23a', '#7aa344', '#e07a2f', '#8b3f8f', '#c9a227'];
    const signNames = ['פירות וירקות', 'תבלינים', 'חלבה', 'בורקס', 'דגים', 'קפה'];
    for (let i = 0; i < 16; i++) {
      const s = L * (0.5 + i * 0.015),
        side = i % 2 ? 1 : -1;
      const g = along(S, track, s, side * 17.5);
      g.rotation.y += side > 0 ? -Math.PI / 2 : Math.PI / 2;
      add(g, new T.BoxGeometry(4.4, 1.0, 1.8), K('#8a6a48'), 0, 0.5, 0);
      for (let k = 0; k < 4; k++) {
        const crate = add(g, new T.BoxGeometry(0.9, 0.35, 0.7), K('#b08a5a'), -1.6 + k * 1.05, 1.18, 0.2);
        crate.rotation.y = (k % 2) * 0.1;
        const heap = add(
          g,
          new T.SphereGeometry(0.42, 8, 6),
          K(goods[(i + k) % goods.length]),
          -1.6 + k * 1.05,
          1.35,
          0.2
        );
        heap.scale.set(1, 0.45, 0.8);
      }
      if (i % 3 === 1)
        for (let k = 0; k < 3; k++)
          add(
            g,
            new T.ConeGeometry(0.28, 0.55, 10),
            K(['#c4572e', '#d9a12b', '#7d5a2f'][k]),
            -0.7 + k * 0.7,
            1.32,
            -0.45
          );
      for (const x of [-2.1, 2.1]) add(g, new T.BoxGeometry(0.1, 3.4, 0.1), K('#5d4a36'), x, 1.7, -0.8);
      const awning = add(
        g,
        new T.BoxGeometry(4.8, 0.08, 2.8),
        K(awningColors[i % awningColors.length]),
        0,
        3.3,
        0.3
      );
      awning.rotation.x = 0.16;
      const sign = new T.Mesh(
        new T.PlaneGeometry(3.4, 0.6),
        new T.MeshStandardMaterial({
          map: textCanvasTexture(512, 90, (ctx, w, h) => {
            ctx.fillStyle = '#f3ead6';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#2a2a2a';
            ctx.font = '800 58px Heebo, Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(signNames[i % signNames.length], w / 2, h / 2 + 4);
          }),
          roughness: 0.8
        })
      );
      sign.position.set(0, 2.75, 1.2);
      g.add(sign);
    }
    // Light rail: a paved track bed parallel to the road and a two-car tram running along it.
    const a = 0.52 * L,
      b = 0.7 * L,
      off = 21.5;
    const bed = [];
    for (let s = a; s < b; s += 2) {
      const { p, t } = track.at(s, off);
      bed.push({ x: p.x, y: Math.max(0, p.y - 0.3) + 0.05, z: p.z, ry: Math.atan2(t.x, t.z) });
    }
    instanced(scene, new T.BoxGeometry(3.4, 0.1, 2.1), K('#9c968a'), bed, { shadow: false });
    for (const r of [-0.72, 0.72]) {
      const rails = bed.map(q => ({
        ...q,
        y: q.y + 0.08,
        x: q.x + Math.cos(q.ry) * r,
        z: q.z - Math.sin(q.ry) * r
      }));
      instanced(scene, new T.BoxGeometry(0.1, 0.08, 2.05), K('metal'), rails, { shadow: false });
    }
    const tram = new T.Group();
    scene.add(tram);
    for (let c = 0; c < 2; c++) {
      const car = new T.Group();
      car.position.z = c * -12.4;
      tram.add(car);
      add(car, new T.BoxGeometry(2.6, 2.7, 12), K('#e9ecef'), 0, 1.75, 0);
      add(
        car,
        new T.BoxGeometry(2.64, 1.05, 11.4),
        K('window', night ? 'night' : 'day'),
        0,
        2.15,
        0
      ).castShadow = false;
      add(car, new T.BoxGeometry(2.66, 0.22, 12), K('#c4222a'), 0, 0.95, 0);
      add(car, new T.BoxGeometry(2.4, 0.3, 11), K('#4a5056'), 0, 3.2, 0);
      add(car, new T.BoxGeometry(0.1, 1.2, 0.1), K('dark-metal'), 0, 3.95, 0);
    }
    const span = b - a - 30;
    updates.push(t => {
      const u = (Math.sin(t * 0.09) + 1) / 2,
        s = a + 15 + u * span,
        { p, t: dir } = track.at(s, off);
      tram.position.set(p.x, Math.max(0, p.y - 0.3) + 0.1, p.z);
      tram.rotation.y = Math.atan2(dir.x, dir.z);
    });
  }

  // ——— Park: the Montefiore windmill and the Old City walls on the skyline. ———
  {
    const mill = along(S, track, L * 0.83, -30, 0);
    add(mill, new T.CylinderGeometry(2.2, 3.4, 11, 16), K('stone'), 0, 5.5, 0);
    add(mill, new T.ConeGeometry(2.8, 2.6, 16), K('#5a4636'), 0, 12.3, 0);
    const sails = new T.Group();
    sails.position.set(0, 10, -3.1);
    mill.add(sails);
    for (let i = 0; i < 4; i++) {
      const blade = new T.Group();
      blade.rotation.z = (i * Math.PI) / 2;
      sails.add(blade);
      add(blade, new T.BoxGeometry(0.22, 6.2, 0.16), K('#5a4636'), 0, 3, 0);
      add(blade, new T.BoxGeometry(1.1, 4, 0.06), K('#e9e2cf'), 0.45, 3.8, 0);
    }
    add(mill, new T.SphereGeometry(0.45, 10, 8), K('#5a4636'), 0, 10, -3.2);
    sails.traverse(m => m.isMesh && animated.add(m));
    updates.push(t => (sails.rotation.z = t * 0.35));

    // Old City walls: crenellated stone wall with square towers, on a ridge to the west.
    const walls = new T.Group();
    walls.position.set(-150, 0, 60);
    walls.rotation.y = 1.25;
    S.add(walls);
    add(
      walls,
      new T.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      K('grass', mood),
      0,
      -1,
      0
    ).scale.set(110, 14, 45);
    const len = 150;
    add(walls, scaledBox(len, 14, 3.2), K('stone'), 0, 18, 0);
    const merlons = [];
    for (let x = -len / 2 + 1; x < len / 2; x += 2.2) merlons.push({ x: -150 + 0, y: 0, z: 0, lx: x });
    const mg = scaledBox(1.2, 1.6, 3.2);
    for (const m of merlons) add(walls, mg, K('stone'), m.lx, 25.8, 0);
    for (const x of [-len / 2, -len / 6, len / 6, len / 2]) {
      add(walls, scaledBox(9, 20, 9), K('stone'), x, 19, 0);
      for (let k = -1; k <= 1; k++) add(walls, mg, K('stone'), x + k * 3, 29.8, 4);
    }
  }

  // Start/finish gantry with a chequered line.
  const start = new T.Group();
  scene.add(start);
  scene.userData.gantry = start;
  {
    const { p, t } = track.at(0);
    start.position.copy(p);
    start.rotation.y = Math.atan2(t.x, t.z);
    for (const x of [-11.8, 11.8]) {
      add(start, new T.BoxGeometry(0.6, 9.5, 0.6), K('#1d2533'), x, 4.75, 0);
      add(start, new T.BoxGeometry(1.4, 0.6, 1.4), K('#1d2533'), x, 0.3, 0);
    }
    add(start, new T.BoxGeometry(24.2, 1.6, 0.7), K('#1d2533'), 0, 9.2, 0);
    const banner = new T.Mesh(
      new T.PlaneGeometry(14, 1.2),
      new T.MeshBasicMaterial({
        map: textCanvasTexture(1024, 88, (ctx, w, h) => {
          ctx.fillStyle = '#1d2533';
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = '#f2c14e';
          ctx.font = '900 64px Heebo, Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('זינוק · סיום', w / 2, h / 2 + 4);
        })
      })
    );
    banner.position.set(0, 9.2, -0.36);
    banner.rotation.y = Math.PI;
    start.add(banner);
    const back = banner.clone();
    back.position.z = 0.36;
    back.rotation.y = 0;
    start.add(back);
    for (let x = -10; x < 10; x++)
      for (let z = -1; z < 1; z++)
        add(
          start,
          new T.BoxGeometry(1, 0.025, 1),
          K((x + z) % 2 ? '#f2f1ea' : '#1d2533'),
          x + 0.5,
          0.07,
          z + 0.5
        ).castShadow = false;
  }
  // Party-colour bunting strung across the start straight.
  for (const zs of [18, 38]) {
    const flags = [];
    const { p, t } = track.at(zs);
    const right = new T.Vector3(-t.z, 0, t.x);
    for (let i = 0; i < 26; i++) {
      const u = i / 25,
        q = p.clone().addScaledVector(right, -12 + u * 24);
      q.y += 8.6 - Math.sin(u * Math.PI) * 1.4;
      flags.push({ x: q.x, y: q.y, z: q.z, ry: Math.atan2(t.x, t.z), rz: Math.PI, k: i });
    }
    PARTIES.forEach((party, k) =>
      instanced(
        scene,
        new T.ConeGeometry(0.32, 0.6, 3),
        K(party.color),
        flags.filter(f => f.k % PARTIES.length === k),
        { shadow: false }
      )
    );
  }

  const news = buildNews(scene, S, track, { mood, checkpoints: layoutCheckpoints(L) });
  updates.push(t => news.update(t));
  batchStatic(S, animated);
  return {
    drawPoll: news.drawPoll,
    samples,
    update(t) {
      for (const f of updates) f(t);
    },
    lights: M
  };
}

let flagTexture;
function israeliFlag() {
  return (flagTexture ??= textCanvasTexture(300, 210, (x, w, h) => {
    x.fillStyle = '#fff';
    x.fillRect(0, 0, w, h);
    x.fillStyle = '#1f55c6';
    x.fillRect(0, 22, w, 30);
    x.fillRect(0, 158, w, 30);
    x.strokeStyle = '#1f55c6';
    x.lineWidth = 9;
    for (const d of [1, -1]) {
      x.beginPath();
      x.moveTo(150, 105 - 44 * d);
      x.lineTo(188, 105 + 22 * d);
      x.lineTo(112, 105 + 22 * d);
      x.closePath();
      x.stroke();
    }
  }));
}
