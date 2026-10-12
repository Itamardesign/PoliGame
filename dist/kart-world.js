import * as T from './vendor/three.module.min.js';
import { makeDriver } from './kart-drivers.js';
import { PARTIES, rng, clamp, ROAD, SECTORS, sectorAt } from './race-model.js';
import { levelById } from './kart-levels.js';
import { batchStatic } from './world-kit.js';
export { batchStatic };
export { buildWorld } from './world-set.js';
const materials = new Map();
export function mat(c) {
  if (!materials.has(c)) materials.set(c, new T.MeshStandardMaterial({ color: c, roughness: 0.67 }));
  return materials.get(c);
}
export function box(g, w, h, d, c, x = 0, y = 0, z = 0) {
  const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat(c));
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  g.add(m);
  return m;
}
function ball(g, r, c, x, y, z, sx = 1, sy = 1, sz = 1) {
  const m = new T.Mesh(new T.SphereGeometry(r, 16, 12), mat(c));
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  g.add(m);
  return m;
}
function cyl(g, r1, r2, h, c, x, y, z, n = 16) {
  const m = new T.Mesh(new T.CylinderGeometry(r1, r2, h, n), mat(c));
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  g.add(m);
  return m;
}
export function label(text, w = 4, h = 1, bg = '#f7f3d9', color = '#2b4436', size = 80) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 192;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 192);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${size}px Heebo, Arial`;
  ctx.fillText(text, 256, 100, 480);
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  const mesh = new T.Mesh(
    new T.PlaneGeometry(w, h),
    new T.MeshBasicMaterial({ map: tex, side: T.DoubleSide })
  );
  return mesh;
}
export async function loadLogos() {
  const loader = new T.TextureLoader();
  return Promise.all(
    PARTIES.map(async p => {
      try {
        const texture = await loader.loadAsync('./assets/' + p.logo);
        texture.colorSpace = T.SRGBColorSpace;
        return texture;
      } catch {
        return null;
      }
    })
  );
}
const special = new Map();
// Shiny, glowing and glass finishes for the vehicle details (cached, so batching still merges them).
function finish(kind, c) {
  const key = kind + c;
  if (!special.has(key))
    special.set(
      key,
      kind === 'chrome'
        ? new T.MeshStandardMaterial({ color: c, metalness: 0.45, roughness: 0.22 })
        : kind === 'glow'
          ? new T.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.4, roughness: 0.4 })
          : kind === 'glass'
            ? new T.MeshStandardMaterial({
                color: c,
                transparent: true,
                opacity: 0.42,
                roughness: 0.08,
                metalness: 0.2
              })
            : new T.MeshStandardMaterial({ color: c, roughness: 0.95 })
    );
  return special.get(key);
}
function as(m, kind, c) {
  m.material = finish(kind, c);
  return m;
}
function rod(g, a, b, r, c, kind) {
  const A = new T.Vector3(...a),
    B = new T.Vector3(...b),
    m = new T.Mesh(new T.CylinderGeometry(r, r, A.distanceTo(B), 10), kind ? finish(kind, c) : mat(c));
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  m.castShadow = true;
  g.add(m);
  return m;
}
let flagTex;
function israelFlag(w, h) {
  if (!flagTex) {
    const c = document.createElement('canvas');
    c.width = 300;
    c.height = 210;
    const x = c.getContext('2d');
    x.fillStyle = '#fff';
    x.fillRect(0, 0, 300, 210);
    x.fillStyle = '#1f55c6';
    x.fillRect(0, 22, 300, 30);
    x.fillRect(0, 158, 300, 30);
    x.strokeStyle = '#1f55c6';
    x.lineWidth = 9;
    for (const d of [1, -1]) {
      x.beginPath();
      x.moveTo(150, 105 - 44 * d);
      x.lineTo(150 + 38, 105 + 22 * d);
      x.lineTo(150 - 38, 105 + 22 * d);
      x.closePath();
      x.stroke();
    }
    flagTex = new T.CanvasTexture(c);
    flagTex.colorSpace = T.SRGBColorSpace;
  }
  const flag = new T.Mesh(
    new T.PlaneGeometry(w, h, 10, 1),
    new T.MeshBasicMaterial({ map: flagTex, side: T.DoubleSide })
  );
  flag.userData.flag = true;
  return flag;
}
// A wheel is built in its own group (axle along local y), batched, then spun by the race loop.
function wheel(
  g,
  x,
  z,
  {
    r = 0.47,
    w = 0.45,
    tire = '#20262a',
    rim = '#c9d0d6',
    hub = '#ffffff',
    spokes = 5,
    knobs = 0,
    rimKind = 'chrome'
  } = {}
) {
  const wg = new T.Group();
  wg.position.set(x, r + 0.04, z);
  g.add(wg);
  cyl(wg, r, r, w, tire, 0, 0, 0, 26);
  cyl(wg, r * 0.86, r * 0.86, w + 0.02, '#15191b', 0, 0, 0, 24);
  as(cyl(wg, r * 0.62, r * 0.62, w + 0.04, rim, 0, 0, 0, 24), rimKind, rim);
  as(cyl(wg, r * 0.2, r * 0.2, w + 0.1, hub, 0, 0, 0, 12), 'chrome', hub);
  for (let i = 0; i < spokes; i++) {
    const s = box(wg, 0.07, w + 0.07, r * 1.18, '#262b2e');
    s.rotation.y = (i / spokes) * Math.PI;
  }
  for (let i = 0; i < knobs; i++) {
    const a = (i / knobs) * Math.PI * 2,
      k = box(wg, 0.12, w * 0.92, 0.17, tire, Math.cos(a) * r, 0, Math.sin(a) * r);
    k.rotation.y = -a;
  }
  wg.rotation.z = Math.PI / 2;
  batchStatic(wg);
  g.userData.wheels.push(wg);
  return wg;
}
const STYLE = {
  // Likud — "Bibi-Bot": armoured state limousine with a tinted rear cabin, chrome grille and fender flags.
  limo(g, p) {
    const body = '#132449',
      chrome = '#dfe5ec';
    box(g, 2.1, 0.5, 4.1, body, 0, 0.8, -0.05);
    as(box(g, 2.14, 0.07, 4.05, chrome, 0, 0.58, -0.05), 'chrome', chrome);
    box(g, 2.13, 0.1, 4.0, p.color, 0, 0.93, -0.05);
    box(g, 1.92, 0.24, 1.3, body, 0, 1.13, 1.3);
    box(g, 0.1, 0.03, 1.25, chrome, 0, 1.26, 1.3);
    as(box(g, 1.3, 0.46, 0.08, chrome, 0, 0.9, 2.07), 'chrome', chrome);
    as(box(g, 2.2, 0.16, 0.2, chrome, 0, 0.56, 2.1), 'chrome', chrome);
    as(box(g, 2.2, 0.16, 0.2, chrome, 0, 0.56, -2.14), 'chrome', chrome);
    for (const s of [-1, 1]) {
      as(ball(g, 0.14, '#fff7cf', s * 0.8, 0.97, 2.02, 1, 1, 0.5), 'glow', '#fff7cf');
      as(box(g, 0.34, 0.14, 0.05, '#ff3b3b', s * 0.72, 0.95, -2.1), 'glow', '#ff3b3b');
      rod(g, [s * 0.9, 1.02, 1.85], [s * 0.9, 1.78, 1.85], 0.025, chrome, 'chrome');
      const f = israelFlag(0.52, 0.36);
      f.position.set(s * 0.9, 1.58, 1.58);
      f.rotation.y = Math.PI / 2;
      g.add(f);
      as(box(g, 0.16, 0.08, 0.3, chrome, s * 1.12, 1.2, 0.75), 'chrome', chrome);
    }
    as(box(g, 1.7, 0.5, 0.05, '#b9dcf7', 0, 1.46, 0.95), 'glass', '#b9dcf7').rotation.x = -0.4;
    // Rear VIP cabin: armoured roof, tinted windows and a gold seal on each door.
    box(g, 1.96, 0.82, 1.32, body, 0, 1.44, -1.36);
    as(box(g, 1.98, 0.36, 0.95, '#1a2330', 0, 1.56, -1.36), 'glass', '#1a2330');
    box(g, 1.86, 0.1, 1.24, body, 0, 1.9, -1.36);
    for (const s of [-1, 1]) {
      const seal = as(cyl(g, 0.16, 0.16, 0.04, '#e3c35a', s * 0.99, 1.16, -1.36), 'chrome', '#e3c35a');
      seal.rotation.z = Math.PI / 2;
    }
    as(box(g, 0.5, 0.04, 0.9, '#2c3b4d', 0, 1.97, -1.4), 'chrome', '#2c3b4d');
    return {
      front: 2.13,
      rear: -2.2,
      plateY: 0.86,
      flames: [
        [-0.55, 0.6, -2.35],
        [0.55, 0.6, -2.35]
      ],
      flag: [0.75, 1.95, -1.9],
      wheel: { rim: '#dfe5ec', spokes: 8, hub: '#2875df' }
    };
  },
  // Yesh Atid — "Atid GT": low wedge supercar with side pods, rear wing and an "ON AIR" studio light.
  sport(g, p) {
    const dark = '#141d24',
      white = '#f4f8fa';
    box(g, 2.2, 0.2, 3.9, dark, 0, 0.5, 0);
    for (const s of [-1, 1]) {
      box(g, 0.55, 0.46, 2.3, p.color, s * 0.86, 0.8, -0.3);
      box(g, 0.06, 0.26, 0.7, dark, s * 1.14, 0.84, 0.15);
      box(g, 0.3, 0.05, 2.3, white, s * 0.86, 1.04, -0.3);
    }
    const nose = box(g, 1.35, 0.3, 1.7, p.color, 0, 0.78, 1.25);
    nose.rotation.x = 0.12;
    for (const s of [-1, 1]) {
      const st = box(g, 0.15, 0.03, 1.7, white, s * 0.2, 0.95, 1.25);
      st.rotation.x = 0.12;
      as(box(g, 0.42, 0.06, 0.05, '#e8fbff', s * 0.5, 0.76, 2.08), 'glow', '#e8fbff');
    }
    box(g, 2.25, 0.06, 0.4, dark, 0, 0.52, 2.08);
    box(g, 1.45, 0.36, 1.2, p.color, 0, 1.0, -1.35);
    for (let i = 0; i < 4; i++) box(g, 1.1, 0.03, 0.08, dark, 0, 1.19, -1.0 - i * 0.22);
    for (const s of [-1, 1]) {
      box(g, 0.08, 0.55, 0.18, dark, s * 0.55, 1.43, -1.78);
      box(g, 0.06, 0.4, 0.62, white, s * 1.16, 1.62, -1.8);
    }
    const wing = box(g, 2.3, 0.07, 0.58, p.color, 0, 1.72, -1.82);
    wing.rotation.x = 0.12;
    as(box(g, 1.9, 0.07, 0.04, '#ff4b5c', 0, 1.02, -1.96), 'glow', '#ff4b5c');
    const onAir = label('ON AIR', 0.95, 0.26, '#e0303a', '#ffffff', 110);
    onAir.position.set(0, 1.4, -1.9);
    onAir.rotation.y = Math.PI;
    g.add(onAir);
    g.userData.fx.push({ mesh: onAir, kind: 'blink', rate: 1.6 });
    // A news-anchor's desk microphone on the dash.
    rod(g, [-0.62, 1.12, 0.95], [-0.62, 1.62, 0.8], 0.03, dark);
    ball(g, 0.1, '#3a4046', -0.62, 1.7, 0.78, 1, 1.3, 1);
    box(g, 0.14, 0.1, 0.03, '#22bddd', -0.62, 1.54, 0.86);
    return {
      front: 2.1,
      rear: -1.98,
      plateY: 0.72,
      flames: [
        [-0.22, 0.78, -2.15],
        [0.22, 0.78, -2.15]
      ],
      flag: [0.95, 1.2, -0.9],
      wheel: { r: 0.45, rim: '#1d2a33', hub: '#7fe9ff', spokes: 5, rimKind: 'chrome' }
    };
  },
  // Democrats — "Demokrati-Kart": protest dune buggy with a tall roll cage, megaphone, flag and an exposed V-twin.
  buggy(g, p) {
    const cage = '#3a4046',
      chrome = '#cfd6dc';
    box(g, 1.55, 0.4, 2.7, p.color, 0, 0.78, 0.05);
    const nose = box(g, 1.25, 0.3, 0.8, p.color, 0, 0.78, 1.6);
    nose.rotation.x = 0.25;
    box(g, 1.6, 0.05, 0.7, '#ffffff', 0, 0.99, 0.9);
    for (const s of [-1, 1]) {
      rod(g, [s * 1.0, 0.9, -0.72], [s * 0.92, 3.62, -0.72], 0.07, cage);
      rod(g, [s * 0.92, 3.55, -0.72], [s * 0.8, 1.0, -1.9], 0.06, cage);
      rod(g, [s * 0.85, 0.72, 1.75], [s * 0.85, 0.72, -1.9], 0.06, cage);
      rod(g, [s * 1.0, 1.25, -0.72], [s * 0.85, 1.25, 0.9], 0.05, cage);
    }
    rod(g, [-0.95, 3.6, -0.72], [0.95, 3.6, -0.72], 0.07, cage);
    rod(g, [-0.95, 2.3, -0.72], [0.95, 2.3, -0.72], 0.05, cage);
    rod(g, [-0.9, 0.8, 2.0], [0.9, 0.8, 2.0], 0.07, chrome, 'chrome');
    for (const s of [-1, 1]) as(ball(g, 0.13, '#fff7cf', s * 0.4, 1.05, 1.95), 'glow', '#fff7cf');
    // Megaphone on the cage, pointing ahead.
    const horn = new T.Mesh(
      new T.CylinderGeometry(0.24, 0.07, 0.55, 16, 1, true),
      new T.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.5, side: T.DoubleSide })
    );
    horn.rotation.x = Math.PI / 2;
    horn.position.set(0.55, 3.78, -0.45);
    g.add(horn);
    cyl(g, 0.08, 0.08, 0.22, p.color, 0.55, 3.78, -0.8).rotation.x = Math.PI / 2;
    rod(g, [-0.9, 1.0, -1.8], [-0.9, 4.1, -1.8], 0.03, chrome, 'chrome');
    const f = israelFlag(0.82, 0.58);
    f.position.set(-0.9, 3.78, -2.22);
    f.rotation.y = Math.PI / 2;
    g.add(f);
    box(g, 0.95, 0.45, 0.7, '#4b5157', 0, 1.02, -1.45);
    for (const s of [-1, 1]) {
      const c = as(cyl(g, 0.15, 0.13, 0.45, chrome, s * 0.32, 1.4, -1.45), 'chrome', chrome);
      c.rotation.z = s * 0.6;
    }
    as(cyl(g, 0.2, 0.2, 0.14, p.color, 0.55, 1.55, -1.2), 'chrome', p.color);
    for (const s of [-1, 1]) rod(g, [s * 0.35, 1.0, -1.8], [s * 0.45, 1.45, -2.25], 0.06, chrome, 'chrome');
    return {
      front: 2.02,
      rear: -1.95,
      plateY: 0.85,
      flames: [
        [-0.45, 1.45, -2.35],
        [0.45, 1.45, -2.35]
      ],
      flag: [1.0, 1.25, -1.5],
      wheel: { r: 0.44, rim: '#e8e8e2', hub: p.color, spokes: 4, knobs: 10 },
      rearWheel: { r: 0.6, w: 0.56, rim: '#e8e8e2', hub: p.color, spokes: 4, knobs: 14 },
      wheelZ: [1.3, -1.2]
    };
  },
  // Yisrael Beytenu — "Beytenu Express": muscle car with a supercharger through the hood, side pipes and ducktail.
  muscle(g, p) {
    const black = '#1b1d20',
      chrome = '#d6dce2';
    box(g, 2.15, 0.55, 3.95, p.color, 0, 0.86, 0);
    box(g, 1.8, 0.14, 1.45, p.color, 0, 1.2, 1.2);
    box(g, 1.85, 0.2, 1.0, p.color, 0, 1.2, -1.45);
    for (const s of [-1, 1]) {
      box(g, 0.2, 0.02, 1.45, black, s * 0.28, 1.28, 1.2);
      box(g, 0.2, 0.02, 1.0, black, s * 0.28, 1.31, -1.45);
      box(g, 0.2, 0.02, 1.2, black, s * 1.08, 0.88, 0).rotation.y = Math.PI / 2;
      rod(g, [s * 1.16, 0.55, 0.9], [s * 1.16, 0.55, -1.3], 0.08, chrome, 'chrome');
      for (let i = 0; i < 3; i++)
        as(box(g, 0.05, 0.1, 0.2, chrome, s * 1.21, 0.55, 0.5 - i * 0.6), 'chrome', chrome);
      for (const k of [0.55, 0.82])
        as(ball(g, 0.12, '#fff5c8', s * k, 0.93, 1.98, 1, 1, 0.5), 'glow', '#fff5c8');
      as(box(g, 0.5, 0.12, 0.05, '#ff3030', s * 0.6, 0.95, -1.99), 'glow', '#ff3030');
    }
    box(g, 1.3, 0.32, 0.06, black, 0, 0.9, 1.99);
    as(box(g, 2.2, 0.14, 0.18, chrome, 0, 0.6, 2.05), 'chrome', chrome);
    as(box(g, 2.2, 0.14, 0.18, chrome, 0, 0.6, -2.05), 'chrome', chrome);
    // Blower: chrome supercharger, belt pulley and a black shotgun scoop.
    as(box(g, 0.62, 0.32, 0.5, chrome, 0, 1.42, 1.0), 'chrome', chrome);
    box(g, 0.56, 0.2, 0.38, black, 0, 1.66, 1.02);
    as(box(g, 0.5, 0.1, 0.05, chrome, 0, 1.66, 1.22), 'chrome', chrome);
    const pulley = cyl(g, 0.14, 0.14, 0.06, black, 0, 1.35, 1.28);
    pulley.rotation.x = Math.PI / 2;
    const tail = box(g, 2.0, 0.08, 0.38, black, 0, 1.34, -1.85);
    tail.rotation.x = -0.3;
    return {
      front: 2.02,
      rear: -2.02,
      plateY: 0.9,
      flames: [
        [-1.16, 0.55, -1.5],
        [1.16, 0.55, -1.5]
      ],
      flag: [0.8, 1.3, -0.95],
      wheel: { r: 0.47, rim: chrome, hub: '#ffda92', spokes: 5 },
      rearWheel: { r: 0.56, w: 0.62, rim: chrome, hub: '#ffda92', spokes: 5 }
    };
  },
  // Shas — "Shas Turbo": gilded carriage kart with a velvet throne, crown and two lanterns.
  royal(g, p) {
    const gold = '#e2b84a',
      velvet = '#5e2a8f';
    ball(g, 1, p.color, 0, 0.86, 0, 1.05, 0.42, 1.78);
    const band = as(new T.Mesh(new T.TorusGeometry(1, 0.05, 8, 48), mat(gold)), 'chrome', gold);
    band.rotation.x = Math.PI / 2;
    band.scale.set(1.06, 1.8, 1);
    band.position.y = 1.02;
    g.add(band);
    as(ball(g, 0.2, gold, 0, 0.95, 1.82), 'chrome', gold);
    for (const s of [-1, 1]) {
      as(box(g, 0.22, 0.34, 1.0, gold, s * 0.72, 1.3, -0.2), 'chrome', gold);
      box(g, 0.2, 0.08, 0.95, velvet, s * 0.72, 1.5, -0.2);
      as(ball(g, 0.13, gold, s * 0.72, 1.48, 0.34), 'chrome', gold);
      rod(g, [s * 0.98, 1.0, 1.4], [s * 0.98, 1.78, 1.4], 0.03, gold, 'chrome');
      as(box(g, 0.22, 0.26, 0.22, '#ffd98a', s * 0.98, 1.9, 1.4), 'glow', '#ffd98a');
      as(cyl(g, 0.02, 0.16, 0.14, gold, s * 0.98, 2.1, 1.4), 'chrome', gold);
      as(ball(g, 0.14, gold, s * 0.78, 3.62, -0.86), 'chrome', gold);
    }
    as(box(g, 1.56, 2.36, 0.22, gold, 0, 2.35, -0.88), 'chrome', gold);
    as(box(g, 1.28, 2.08, 0.08, velvet, 0, 2.33, -0.75), 'matte', velvet);
    box(g, 1.1, 0.2, 0.9, velvet, 0, 1.1, -0.2);
    // Crown finial above the throne back.
    as(cyl(g, 0.4, 0.34, 0.32, gold, 0, 3.78, -0.88, 12), 'chrome', gold);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      as(ball(g, 0.07, gold, Math.cos(a) * 0.38, 4.0, -0.88 + Math.sin(a) * 0.38), 'chrome', gold);
    }
    as(ball(g, 0.1, '#7b3fd0', 0, 3.82, -0.5), 'glow', '#9a5cf0');
    return {
      front: 1.86,
      rear: -1.86,
      plateY: 0.9,
      flames: [
        [-0.5, 0.7, -2.0],
        [0.5, 0.7, -2.0]
      ],
      flag: [1.05, 1.1, -1.1],
      wheel: { r: 0.5, w: 0.34, tire: '#2a1838', rim: gold, hub: gold, spokes: 8, rimKind: 'chrome' }
    };
  },
  // Otzma Yehudit — "Otzma 4x4": lifted patrol jeep with a roll-bar police light bar, bull bar, snorkel and spare wheel.
  offroad(g, p) {
    const dark = '#3f5d33',
      black = '#1d2220',
      steel = '#aab3b8';
    box(g, 1.9, 0.2, 3.4, black, 0, 0.95, 0);
    box(g, 1.95, 0.52, 1.25, p.color, 0, 1.26, 1.25);
    box(g, 1.95, 0.52, 1.15, p.color, 0, 1.26, -1.32);
    for (const s of [-1, 1]) box(g, 0.18, 0.52, 1.5, p.color, s * 0.89, 1.26, -0.1);
    for (let i = 0; i < 7; i++) box(g, 0.07, 0.3, 0.04, black, (i - 3) * 0.14, 1.28, 1.89);
    for (const s of [-1, 1]) {
      as(ball(g, 0.15, '#fff6cf', s * 0.72, 1.3, 1.88, 1, 1, 0.5), 'glow', '#fff6cf');
      for (const z of [1.18, -1.18]) box(g, 0.5, 0.12, 1.2, black, s * 1.1, 1.55, z);
    }
    as(box(g, 1.7, 0.05, 0.5, '#cfe3f0', 0, 1.56, 1.35), 'glass', '#cfe3f0');
    box(g, 1.8, 0.07, 0.08, dark, 0, 1.56, 1.1);
    // Bull bar and snorkel.
    for (const s of [-1, 1]) rod(g, [s * 0.7, 0.8, 2.12], [s * 0.7, 1.55, 2.12], 0.06, black);
    rod(g, [-0.85, 1.5, 2.12], [0.85, 1.5, 2.12], 0.06, black);
    rod(g, [-0.95, 0.9, 2.12], [0.95, 0.9, 2.12], 0.07, black);
    rod(g, [1.05, 1.2, 0.72], [1.05, 2.2, 0.72], 0.07, black);
    box(g, 0.18, 0.12, 0.24, black, 1.05, 2.24, 0.8);
    // Roll bar behind the driver with a blinking police light bar.
    for (const s of [-1, 1]) {
      rod(g, [s * 0.95, 1.4, -0.8], [s * 0.95, 3.55, -0.8], 0.07, steel, 'chrome');
      rod(g, [s * 0.95, 3.4, -0.8], [s * 0.9, 1.5, -1.85], 0.06, steel, 'chrome');
    }
    rod(g, [-0.95, 3.55, -0.8], [0.95, 3.55, -0.8], 0.07, steel, 'chrome');
    box(g, 1.6, 0.14, 0.34, black, 0, 3.7, -0.8);
    for (const s of [-1, 1]) {
      const light = as(
        box(g, 0.62, 0.16, 0.3, s < 0 ? '#ff2d3a' : '#2f6bff', s * 0.42, 3.8, -0.8),
        'glow',
        s < 0 ? '#ff2d3a' : '#2f6bff'
      );
      g.userData.fx.push({ mesh: light, kind: 'blink', rate: 5, phase: s < 0 ? 0 : 1 });
    }
    const spare = cyl(g, 0.5, 0.5, 0.32, black, 0, 1.45, -2.08, 20);
    spare.rotation.x = Math.PI / 2;
    const sr = as(cyl(g, 0.3, 0.3, 0.36, steel, 0, 1.45, -2.08, 16), 'chrome', steel);
    sr.rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) box(g, 0.26, 0.42, 0.18, dark, s * 0.72, 1.72, -1.72);
    return {
      front: 2.22,
      rear: -2.35,
      plateY: 1.02,
      flames: [
        [-0.6, 0.95, -2.1],
        [0.6, 0.95, -2.1]
      ],
      flag: [0.8, 1.5, -1.6],
      wheel: { r: 0.6, w: 0.55, rim: '#566b4c', hub: '#d4eca8', spokes: 6, knobs: 16, rimKind: 'matte' }
    };
  }
};
// The kart is a root (placed on the road) holding the wheels and a sprung body. Everything the
// suspension should move — chassis, driver, plaques, flags, flames — lives on the body.
export function makeKart(index, logos) {
  const p = PARTIES[index],
    root = new T.Group(),
    g = new T.Group();
  root.add(g);
  g.userData = root.userData;
  root.userData.body = g;
  g.userData.wheels = [];
  g.userData.fx = [];
  g.userData.steerPivots = [];
  const spec = STYLE[p.style](g, p);
  // Shared cockpit: seat, column and steering wheel sit in the same place on every chassis.
  if (p.style !== 'royal') {
    box(g, 1.15, 0.24, 0.9, '#2a2f33', 0, 1.02, -0.2);
    box(g, 1.15, 0.95, 0.22, '#2a2f33', 0, 1.48, -0.62);
  }
  rod(g, [0, 1.05, 1.0], [0, 1.42, 0.68], 0.05, '#2b3434');
  const steering = new T.Mesh(new T.TorusGeometry(0.39, 0.065, 8, 20), mat('#2b3434'));
  steering.position.set(0, 1.42, 0.65);
  steering.rotation.x = -0.7;
  g.add(steering);
  const [zf, zr] = spec.wheelZ || [1.1, -1.04];
  for (const x of [-1.13, 1.13]) {
    // Front wheels sit on a pivot so they can visibly steer.
    const front = wheel(root, x, zf, spec.wheel),
      pivot = new T.Group();
    pivot.position.copy(front.position);
    root.add(pivot);
    pivot.add(front);
    front.position.set(0, 0, 0);
    g.userData.steerPivots.push(pivot);
    wheel(root, x, zr, spec.rearWheel || spec.wheel);
  }
  g.userData.wheelBase = { front: zf, rear: zr, track: 1.13 };
  const driver = makeDriver(index);
  g.add(driver);
  g.userData.driver = driver;
  g.userData.head = driver.userData.head;
  g.userData.eyes = driver.userData.eyes;
  // Front and rear campaign plaques carry the actual downloaded party logos.
  for (const front of [true, false]) {
    const z = front ? spec.front : spec.rear,
      d = front ? 1 : -1;
    box(g, 1.13, 0.42, 0.06, index === 3 ? '#264b6b' : '#fff9ea', 0, spec.plateY, z);
    let plaque;
    if (logos[index])
      plaque = new T.Mesh(
        new T.PlaneGeometry(1.03, 0.34),
        new T.MeshBasicMaterial({ map: logos[index], transparent: true, side: T.DoubleSide })
      );
    else plaque = label(p.name, 1.03, 0.34, '#fff9ea', p.color, 95);
    plaque.position.set(0, spec.plateY, z + d * 0.035);
    if (!front) plaque.rotation.y = Math.PI;
    g.add(plaque);
  }
  const [fx, fy, fz] = spec.flag;
  cyl(g, 0.025, 0.025, 1.9, '#fff2cd', fx, fy + 0.95, fz);
  const flag = label(p.name, 0.88, 0.38, p.color, '#ffffff', 90);
  flag.geometry = new T.PlaneGeometry(0.88, 0.38, 10, 1);
  flag.userData.flag = true;
  flag.position.set(fx + 0.42, fy + 1.75, fz);
  g.add(flag);
  const shield = new T.Mesh(
    new T.SphereGeometry(2.6, 28, 18),
    new T.MeshBasicMaterial({ color: '#80e8fa', transparent: true, opacity: 0.16, depthWrite: false })
  );
  shield.position.y = 1.6;
  shield.visible = false;
  root.add(shield);
  g.userData.shield = shield;
  const flames = [];
  for (const [x, y, z] of spec.flames) {
    const flame = new T.Mesh(
      new T.ConeGeometry(0.3, 1.65, 12),
      new T.MeshBasicMaterial({ color: '#91efff' })
    );
    flame.rotation.x = -Math.PI / 2;
    flame.position.set(x, y, z);
    g.add(flame);
    flame.visible = false;
    flames.push(flame);
  }
  g.userData.flames = flames;
  const name = label(p.short, 1.7, 0.48, '#f4f5dc', '#294330', 90);
  name.position.set(0, 4.6, 0);
  name.visible = false;
  root.add(name);
  g.userData.name = name;
  // Every flag ripples from its pole edge (local -x); keep the rest positions for the animation.
  g.userData.flags = [];
  g.traverse(m => {
    if (!m.userData.flag) return;
    m.userData.rest = Float32Array.from(m.geometry.getAttribute('position').array);
    g.userData.flags.push(m);
  });
  return root;
}
export function makeTrack(levelId = 'jerusalem') {
  const base = [
    [0, 0, 0],
    [0, 1, 64],
    [42, 3, 110],
    [97, 5, 100],
    [132, 2, 50],
    [103, 0, 10],
    [127, 1, -45],
    [89, 4, -99],
    [27, 2, -107],
    [-29, 0, -80],
    [-46, 0, -34]
  ];
  const layouts = {
    jerusalem: base,
    market: [base[0], ...base.slice(1).reverse()].map(([x, y, z], i) => [
      x + (i ? Math.sin(i * 1.8) * 3 : 0),
      y,
      z + (i ? Math.cos(i * 1.6) * 3 : 0)
    ]),
    midnight: base.map(([x, y, z], i) => [
      x * 1.06 + (i ? Math.sin(i * 1.4) * 2 : 0),
      y,
      z * 0.96 + (i ? Math.cos(i * 1.3) * 2 : 0)
    ])
  };
  const level = levelById(levelId),
    points = layouts[level.id];
  const curve = new T.CatmullRomCurve3(
    points.map(([x, y, z]) => new T.Vector3(x * 1.23, y * 1.15, z * 1.23)),
    true,
    'catmullrom',
    0.48
  );
  const length = curve.getLength();
  function at(s, offset = 0) {
    const u = (((s / length) % 1) + 1) % 1,
      p = curve.getPointAt(u),
      t = curve.getTangentAt(u).normalize(),
      right = new T.Vector3(-t.z, 0, t.x).normalize();
    p.addScaledVector(right, offset);
    return { p, t, right };
  }
  function bend(s) {
    const a = at(s).t,
      b = at(s + 3).t;
    return Math.atan2(a.z * b.x - a.x * b.z, a.dot(b)) / 3;
  }
  return {
    id: level.id,
    sectors: SECTORS.map((sector, i) => ({ ...sector, name: level.sectors[i] })),
    curve,
    length,
    at,
    bend
  };
}
// Gameplay props, modelled on real things: a ballot box (קלפי), a ballot slip, a roadworks
// barrier, a steel jump ramp and a boost strip set into the asphalt.
export function makePickup(type) {
  const g = new T.Group();
  const glow = c =>
    new T.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.2, roughness: 0.4 });
  if (type === 'ramp') {
    const deck = box(g, 5, 0.25, 4, '#8d969c', 0, 0.42, 0);
    deck.rotation.x = -0.19;
    deck.material = new T.MeshStandardMaterial({ color: '#8d969c', metalness: 0.6, roughness: 0.45 });
    for (const x of [-2.45, 2.45])
      for (let k = 0; k < 5; k++) {
        const stripe = box(
          g,
          0.16,
          0.3,
          0.8,
          k % 2 ? '#1d1d1d' : '#f2c14e',
          x,
          0.36 + (k - 2) * 0.15,
          (k - 2) * 0.8
        );
        stripe.rotation.x = -0.19;
      }
    box(g, 5, 0.9, 0.2, '#5c6468', 0, 0.45, -1.95);
  }
  if (type === 'box') {
    // A blue ballot box with a white slot lid and an envelope half posted.
    box(g, 1.3, 1.25, 1.0, '#2f6fd6', 0, 1.65, 0);
    box(g, 1.36, 0.12, 1.06, '#f3f4f6', 0, 2.3, 0);
    box(g, 0.7, 0.03, 0.1, '#1b2433', 0, 2.37, 0);
    const env = box(g, 0.55, 0.42, 0.04, '#e8eef9', 0, 2.55, 0);
    env.rotation.z = 0.08;
    for (const z of [-0.51, 0.51]) {
      const word = label('קלפי', 1.05, 0.42, '#2f6fd6', '#ffffff', 120);
      word.position.set(0, 1.62, z);
      if (z < 0) word.rotation.y = Math.PI;
      g.add(word);
    }
    const ring = new T.Mesh(new T.TorusGeometry(0.95, 0.05, 6, 28), glow('#7fb2ff'));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.3;
    g.add(ring);
  }
  if (type === 'coin') {
    // A ballot slip: white paper with a printed letter block.
    box(g, 0.62, 0.84, 0.03, '#fbfbf7', 0, 1.25, 0);
    const slip = label('פתק', 0.5, 0.5, '#fbfbf7', '#1d1d1d', 120);
    for (const z of [-0.02, 0.02]) {
      const face = slip.clone();
      face.position.set(0, 1.27, z);
      if (z < 0) face.rotation.y = Math.PI;
      g.add(face);
    }
  }
  if (type === 'barrier') {
    // Roadworks barrier: red and white boards on A-frame legs, an amber lamp on top.
    for (const x of [-0.9, 0.9]) {
      const l1 = box(g, 0.08, 1.3, 0.08, '#3d3d3d', x, 0.62, -0.18);
      l1.rotation.x = 0.28;
      const l2 = box(g, 0.08, 1.3, 0.08, '#3d3d3d', x, 0.62, 0.18);
      l2.rotation.x = -0.28;
    }
    for (const y of [0.55, 1.05]) {
      box(g, 2.2, 0.32, 0.06, '#f5f5f2', 0, y, 0);
      for (let k = 0; k < 4; k++) {
        const stripe = box(g, 0.28, 0.32, 0.07, '#d63a3a', -0.8 + k * 0.55, y, 0);
        stripe.rotation.z = 0.55;
        stripe.scale.y = 1.05;
      }
    }
    const lamp = new T.Mesh(new T.CylinderGeometry(0.11, 0.11, 0.16, 10), glow('#ffb12e'));
    lamp.position.set(0.85, 1.32, 0);
    g.add(lamp);
    g.userData.blink = lamp;
  }
  if (type === 'boost') {
    box(g, 3.4, 0.05, 6.2, '#25303a', 0, 0.09, 0);
    for (let z = -2.3; z < 2.5; z += 1.2)
      for (const sx of [-1, 1]) {
        const chevron = new T.Mesh(new T.BoxGeometry(0.16, 0.02, 1.15), glow('#55e0ff'));
        chevron.position.set(sx * 0.36, 0.13, z);
        chevron.rotation.y = sx * -0.7;
        g.add(chevron);
      }
  }
  return g;
}
