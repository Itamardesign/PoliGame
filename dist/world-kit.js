// Art kit for a believable Jerusalem: procedural textures, materials and prop geometry.
// Everything is generated in code; repeated props are drawn with instancing.
import * as T from './vendor/three.module.min.js';
import { rng } from './race-model.js';

const cache = new Map();
const once = (key, make) => (cache.has(key) ? cache.get(key) : (cache.set(key, make()), cache.get(key)));

function canvasTexture(w, h, draw, { repeat = true, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new T.CanvasTexture(c);
  if (srgb) t.colorSpace = T.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = T.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
function speckle(ctx, w, h, random, count, colors, size = 1.5) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(random() * colors.length)];
    ctx.globalAlpha = 0.15 + random() * 0.35;
    ctx.fillRect(random() * w, random() * h, size * (0.5 + random()), size * (0.5 + random()));
  }
  ctx.globalAlpha = 1;
}

// Jerusalem limestone: coursed ashlar blocks of varying length, warm and slightly weathered.
// One texture tile covers 4 m x 4 m of wall.
export const stoneTexture = (tint = 'warm') =>
  once('stone-' + tint, () =>
    canvasTexture(512, 512, (ctx, w, h) => {
      const random = rng(tint === 'warm' ? 31 : 47);
      const base = tint === 'warm' ? [232, 214, 178] : [222, 210, 188];
      ctx.fillStyle = `rgb(${base})`;
      ctx.fillRect(0, 0, w, h);
      const rows = 8,
        rh = h / rows;
      for (let r = 0; r < rows; r++) {
        let x = -random() * 60;
        while (x < w) {
          const bw = 70 + random() * 90,
            shade = -18 + random() * 26;
          ctx.fillStyle = `rgb(${base.map(c => Math.round(c + shade + (random() - 0.5) * 8))})`;
          ctx.fillRect(x + 2, r * rh + 2, bw - 4, rh - 4);
          // Chiselled face: faint tooling marks.
          ctx.globalAlpha = 0.08;
          ctx.fillStyle = '#7a6a4f';
          for (let k = 0; k < 6; k++)
            ctx.fillRect(
              x + 6 + random() * (bw - 12),
              r * rh + 6 + random() * (rh - 12),
              6 + random() * 12,
              1
            );
          ctx.globalAlpha = 1;
          x += bw;
        }
      }
      // Mortar joints read slightly darker, plus grime toward the lower courses.
      ctx.strokeStyle = 'rgba(120,100,70,0.35)';
      ctx.lineWidth = 2;
      for (let r = 0; r <= rows; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * rh);
        ctx.lineTo(w, r * rh);
        ctx.stroke();
      }
      speckle(ctx, w, h, random, 2600, ['#8d7a5a', '#fff6e2', '#b49d76'], 1.4);
    })
  );

export const asphaltTexture = (night = false) =>
  once('asphalt-' + night, () =>
    canvasTexture(512, 512, (ctx, w, h) => {
      const random = rng(9);
      ctx.fillStyle = night ? '#3a3e48' : '#5a5f63';
      ctx.fillRect(0, 0, w, h);
      // Aggregate grain.
      const img = ctx.getImageData(0, 0, w, h);
      for (let i = 0; i < img.data.length; i += 4) {
        const n = (random() - 0.5) * 34;
        img.data[i] += n;
        img.data[i + 1] += n;
        img.data[i + 2] += n;
      }
      ctx.putImageData(img, 0, 0);
      // Patched repairs and a few sealed cracks.
      for (let i = 0; i < 3; i++) {
        const x = random() * w,
          y = random() * h,
          r = 30 + random() * 70,
          g = ctx.createRadialGradient(x, y, r * 0.3, x, y, r);
        g.addColorStop(0, night ? 'rgba(20,22,30,0.22)' : 'rgba(45,47,49,0.18)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      ctx.strokeStyle = 'rgba(25,25,25,0.35)';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 4; i++) {
        let x = random() * w,
          y = random() * h;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let k = 0; k < 6; k++) ctx.lineTo((x += (random() - 0.5) * 40), (y += random() * 30));
        ctx.stroke();
      }
    })
  );

export const grassTexture = (mood = 'day') =>
  once('grass-' + mood, () =>
    canvasTexture(512, 512, (ctx, w, h) => {
      const random = rng(17);
      // Late-summer Jerusalem: dry yellow-green with darker irrigated patches and bare earth.
      ctx.fillStyle = mood === 'night' ? '#3d4a3d' : mood === 'dusk' ? '#a79a62' : '#9fa565';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 26; i++) {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        const c =
          random() < 0.5
            ? mood === 'night'
              ? '50,66,48'
              : '110,130,70'
            : mood === 'night'
              ? '70,70,58'
              : '186,165,112';
        g.addColorStop(0, `rgba(${c},0.55)`);
        g.addColorStop(1, `rgba(${c},0)`);
        ctx.save();
        ctx.translate(random() * w, random() * h);
        ctx.scale(30 + random() * 90, 30 + random() * 90);
        ctx.fillStyle = g;
        ctx.fillRect(-1, -1, 2, 2);
        ctx.restore();
      }
      speckle(
        ctx,
        w,
        h,
        random,
        9000,
        mood === 'night' ? ['#2c372c', '#566552'] : ['#6f7d46', '#c9bd84', '#5a6b3a'],
        2
      );
    })
  );

export const pavingTexture = () =>
  once('paving', () =>
    canvasTexture(256, 256, (ctx, w, h) => {
      const random = rng(5);
      ctx.fillStyle = '#c9c0ad';
      ctx.fillRect(0, 0, w, h);
      const n = 8,
        s = w / n;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          const v = 190 + Math.floor((random() - 0.5) * 22);
          ctx.fillStyle = `rgb(${v},${v - 8},${v - 22})`;
          ctx.fillRect(i * s + 1, j * s + 1, s - 2, s - 2);
        }
      speckle(ctx, w, h, random, 900, ['#8f8676', '#e8e0cf'], 1.2);
    })
  );

const mats = new Map();
// Shared materials keyed by name; textured ones opt in to batching (same texture, same material).
export function kitMaterial(name, mood = 'day') {
  const key = name + mood;
  if (mats.has(key)) return mats.get(key);
  let m;
  const std = o => new T.MeshStandardMaterial({ roughness: 0.9, ...o });
  switch (name) {
    case 'stone':
      m = std({ map: stoneTexture('warm') });
      break;
    case 'stone-pale':
      m = std({ map: stoneTexture('pale') });
      break;
    case 'grass':
      m = std({ map: grassTexture(mood), roughness: 1 });
      break;
    case 'paving':
      m = std({ map: pavingTexture() });
      break;
    case 'window':
      m = std({
        color: mood === 'night' ? '#f3c97a' : '#5d7184',
        roughness: 0.25,
        metalness: 0.35,
        emissive: mood === 'night' ? '#b8823a' : '#000000',
        emissiveIntensity: mood === 'night' ? 0.9 : 0
      });
      break;
    case 'shutter':
      m = std({ color: '#b6a98c' });
      break;
    case 'rail':
      m = std({ color: '#3c4246', metalness: 0.5, roughness: 0.5 });
      break;
    case 'metal':
      m = std({ color: '#b7bec4', metalness: 0.6, roughness: 0.35 });
      break;
    case 'dark-metal':
      m = std({ color: '#2b3034', metalness: 0.5, roughness: 0.5 });
      break;
    case 'solar':
      m = std({ color: '#1d2b44', metalness: 0.4, roughness: 0.25 });
      break;
    case 'tank':
      m = std({ color: '#e8e6df', metalness: 0.3, roughness: 0.5 });
      break;
    case 'lamp':
      m = new T.MeshBasicMaterial({ color: mood === 'night' ? '#ffe2a8' : '#f7f0de' });
      break;
    case 'trunk':
      m = std({ color: '#6e5c47' });
      break;
    case 'olive':
      m = std({ color: mood === 'night' ? '#4c5a48' : '#8d9b6f', roughness: 1 });
      break;
    case 'cypress':
      m = std({ color: mood === 'night' ? '#26372a' : '#3c5a3b', roughness: 1 });
      break;
    case 'palm':
      m = std({ color: mood === 'night' ? '#3f5a37' : '#6f8f45', roughness: 1, side: T.DoubleSide });
      break;
    case 'palm-trunk':
      m = std({ color: '#8b7656' });
      break;
    case 'kerb-white':
      m = std({ color: '#efeee8' });
      break;
    case 'kerb-red':
      m = std({ color: '#c9363a' });
      break;
    case 'kerb-blue':
      m = std({ color: '#2f5fb3' });
      break;
    case 'kerb-grey':
      m = std({ color: '#a9a69c' });
      break;
    case 'barrier':
      m = std({ color: '#c8ccd0', metalness: 0.5, roughness: 0.45 });
      break;
    default:
      m = std({ color: name });
  }
  if (m.map) m.userData.batch = true;
  mats.set(key, m);
  return m;
}

// A box whose UVs are scaled to its real size, so textures keep a constant world scale.
export function scaledBox(w, h, d, tile = 4) {
  const g = new T.BoxGeometry(w, h, d),
    uv = g.getAttribute('uv');
  const faces = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h]
  ];
  for (let f = 0; f < 6; f++)
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, (uv.getX(i) * faces[f][0]) / tile, (uv.getY(i) * faces[f][1]) / tile);
    }
  return g;
}

// Instanced placement helper: one draw call per part, however many copies.
export function instanced(parent, geometry, material, transforms, { shadow = true } = {}) {
  if (!transforms.length) return null;
  const mesh = new T.InstancedMesh(geometry, material, transforms.length);
  const m = new T.Matrix4(),
    q = new T.Quaternion(),
    s = new T.Vector3(),
    e = new T.Euler();
  transforms.forEach((t, i) => {
    e.set(t.rx ?? 0, t.ry ?? 0, t.rz ?? 0);
    q.setFromEuler(e);
    s.set(t.sx ?? t.s ?? 1, t.sy ?? t.s ?? 1, t.sz ?? t.s ?? 1);
    m.compose(new T.Vector3(t.x, t.y ?? 0, t.z), q, s);
    mesh.setMatrixAt(i, m);
  });
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

// Geometry for repeated props, merged per part and cached.
function merge(parts) {
  const geos = parts.map(([g, m]) => {
    const c = g.index ? g.toNonIndexed() : g.clone();
    c.applyMatrix4(m);
    return c;
  });
  const out = new T.BufferGeometry();
  for (const attr of ['position', 'normal', 'uv']) {
    const list = geos.map(g => g.getAttribute(attr));
    if (list.some(a => !a)) continue;
    const arr = new Float32Array(list.reduce((n, a) => n + a.array.length, 0));
    let o = 0;
    for (const a of list) arr.set(a.array, o), (o += a.array.length);
    out.setAttribute(attr, new T.BufferAttribute(arr, list[0].itemSize));
  }
  return out;
}
const at = (x, y, z, rx = 0, ry = 0, rz = 0, s = 1) =>
  new T.Matrix4().compose(
    new T.Vector3(x, y, z),
    new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)),
    new T.Vector3(s, s, s)
  );
const scaleAt = (x, y, z, sx, sy, sz) =>
  new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion(), new T.Vector3(sx, sy, sz));

export const GEO = {
  // Olive: short twisted trunk, three silvery crown masses.
  oliveTrunk: () =>
    once('g-olive-trunk', () =>
      merge([
        [new T.CylinderGeometry(0.22, 0.38, 1.9, 7), at(0, 0.95, 0, 0, 0, 0.12)],
        [new T.CylinderGeometry(0.12, 0.2, 1.3, 6), at(0.35, 1.9, 0.1, 0, 0, -0.6)],
        [new T.CylinderGeometry(0.12, 0.2, 1.2, 6), at(-0.3, 1.85, -0.1, 0.3, 0, 0.55)]
      ])
    ),
  oliveCrown: () =>
    once('g-olive-crown', () =>
      merge([
        [new T.IcosahedronGeometry(1.25, 1), scaleAt(0.7, 2.75, 0.2, 1.1, 0.75, 1)],
        [new T.IcosahedronGeometry(1.15, 1), scaleAt(-0.65, 2.6, -0.2, 1, 0.7, 1.05)],
        [new T.IcosahedronGeometry(1.05, 1), scaleAt(0, 3.25, 0, 1.05, 0.65, 1)]
      ])
    ),
  cypress: () =>
    once('g-cypress', () => {
      const profile = [
        [0.0, 0.0],
        [0.35, 0.2],
        [0.78, 1.2],
        [0.92, 2.6],
        [0.8, 4.2],
        [0.55, 5.6],
        [0.25, 6.8],
        [0.0, 7.4]
      ].map(([r, y]) => new T.Vector2(r, y));
      return new T.LatheGeometry(profile, 9);
    }),
  palmTrunk: () =>
    once('g-palm-trunk', () =>
      merge(
        Array.from({ length: 9 }, (_, i) => [
          new T.CylinderGeometry(0.22, 0.28, 0.8, 7),
          at(Math.sin(i * 0.25) * 0.25, 0.4 + i * 0.78, 0)
        ])
      )
    ),
  palmFronds: () =>
    once('g-palm-fronds', () =>
      merge(
        Array.from({ length: 14 }, (_, i) => {
          const g = new T.PlaneGeometry(0.5, 3.6, 1, 4);
          const p = g.getAttribute('position');
          // Taper toward the tip and droop under its own weight.
          for (let k = 0; k < p.count; k++) {
            const y = p.getY(k) + 1.8;
            p.setX(k, p.getX(k) * (1 - y / 4.2));
            p.setZ(k, -(y ** 2) * 0.16);
          }
          g.translate(0, 1.8, 0);
          return [g, at(0.25, 7.1, 0, -0.8 - (i % 3) * 0.25, (i / 14) * Math.PI * 2, 0)];
        })
      )
    ),
  // Jerusalem-style street lamp: tapered pole, curved arm, lantern.
  lampPole: () =>
    once('g-lamp-pole', () =>
      merge([
        [new T.CylinderGeometry(0.08, 0.14, 6.2, 8), at(0, 3.1, 0)],
        [new T.CylinderGeometry(0.22, 0.26, 0.5, 8), at(0, 0.25, 0)],
        [new T.TorusGeometry(0.7, 0.05, 6, 12, Math.PI / 2), at(-0.7, 6.2, 0, 0, 0, 0)],
        [new T.CylinderGeometry(0.05, 0.05, 0.3, 6), at(-1.4, 6.75, 0)]
      ])
    ),
  lampHead: () =>
    once('g-lamp-head', () =>
      merge([
        [new T.CylinderGeometry(0.16, 0.3, 0.45, 8), at(-1.4, 6.45, 0)],
        [new T.SphereGeometry(0.2, 8, 6), at(-1.4, 6.22, 0)]
      ])
    ),
  // Police crowd barrier section, 2.4 m.
  crowdBarrier: () =>
    once('g-crowd-barrier', () =>
      merge([
        [new T.CylinderGeometry(0.03, 0.03, 2.4, 6), at(0, 1.05, 0, 0, 0, Math.PI / 2)],
        [new T.CylinderGeometry(0.03, 0.03, 2.4, 6), at(0, 0.25, 0, 0, 0, Math.PI / 2)],
        ...Array.from({ length: 9 }, (_, i) => [
          new T.CylinderGeometry(0.015, 0.015, 0.8, 4),
          at(-1.1 + i * 0.275, 0.65, 0)
        ]),
        [new T.BoxGeometry(0.06, 0.06, 0.7), at(-1.1, 0.03, 0)],
        [new T.BoxGeometry(0.06, 0.06, 0.7), at(1.1, 0.03, 0)],
        [new T.CylinderGeometry(0.03, 0.03, 1.1, 6), at(-1.15, 0.55, 0)],
        [new T.CylinderGeometry(0.03, 0.03, 1.1, 6), at(1.15, 0.55, 0)]
      ])
    ),
  // A spectator: body, head; tinted per instance through instance colour.
  personBody: () =>
    once('g-person-body', () =>
      merge([
        [new T.CapsuleGeometry(0.2, 0.42, 3, 8), at(0, 1.22, 0)],
        [new T.CapsuleGeometry(0.06, 0.48, 2, 6), at(0.27, 1.2, 0, 0, 0, 0.18)],
        [new T.CapsuleGeometry(0.06, 0.48, 2, 6), at(-0.27, 1.2, 0, 0, 0, -0.18)]
      ])
    ),
  personLegs: () =>
    once('g-person-legs', () =>
      merge([
        [new T.CapsuleGeometry(0.075, 0.62, 2, 6), at(0.1, 0.42, 0)],
        [new T.CapsuleGeometry(0.075, 0.62, 2, 6), at(-0.1, 0.42, 0)]
      ])
    ),
  personHair: () =>
    once('g-person-hair', () => {
      const g = new T.SphereGeometry(0.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
      g.translate(0, 1.76, -0.01);
      return g;
    }),
  personHead: () =>
    once('g-person-head', () => {
      const g = new T.SphereGeometry(0.17, 10, 8);
      g.translate(0, 1.72, 0);
      return g;
    }),
  // Rooftop solar water heater (dud shemesh): tank on a frame beside a tilted collector.
  solarTank: () =>
    once('g-solar-tank', () =>
      merge([
        [new T.CylinderGeometry(0.33, 0.33, 1.3, 10), at(0, 1.25, -0.4, 0, 0, Math.PI / 2)],
        [new T.BoxGeometry(0.06, 1, 0.06), at(-0.5, 0.5, -0.4)],
        [new T.BoxGeometry(0.06, 1, 0.06), at(0.5, 0.5, -0.4)]
      ])
    ),
  solarPanel: () =>
    once('g-solar-panel', () => merge([[new T.BoxGeometry(1.5, 0.06, 1.1), at(0, 0.7, 0.35, -0.55, 0, 0)]]))
};

// Text on a canvas, for signs and posters. Fonts fall back to Arial for Arabic and Latin.
export function textCanvasTexture(w, h, draw) {
  return canvasTexture(w, h, draw, { repeat: false });
}

// Israeli road sign: white text on green, Hebrew over English over Arabic.
export function roadSignTexture(he, en, ar, color = '#0d6b45') {
  return once(`sign-${he}-${color}`, () =>
    textCanvasTexture(512, 256, (ctx, w, h) => {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#f4f4ef';
      ctx.lineWidth = 8;
      ctx.strokeRect(10, 10, w - 20, h - 20);
      ctx.fillStyle = '#f4f4ef';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '800 72px Heebo, Arial';
      ctx.fillText(he, w / 2, 76, w - 60);
      ctx.font = '600 42px Arial';
      ctx.fillText(en, w / 2, 148, w - 60);
      ctx.font = '600 42px Arial';
      ctx.direction = 'rtl';
      ctx.fillText(ar, w / 2, 204, w - 60);
    })
  );
}

// Election poster: party colour field, the party mark, and the leader's name.
export function posterTexture(party, logo) {
  return once('poster-' + party.id, () =>
    textCanvasTexture(512, 360, (ctx, w, h) => {
      ctx.fillStyle = '#f7f6f1';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = party.color;
      ctx.fillRect(0, 0, w, 120);
      ctx.fillRect(0, h - 26, w, 26);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '900 70px Heebo, Arial';
      ctx.fillText(party.leader, w / 2, 62, w - 40);
      if (logo?.image) {
        const img = logo.image,
          s = Math.min(380 / img.width, 170 / img.height);
        ctx.drawImage(
          img,
          (w - img.width * s) / 2,
          140 + (180 - img.height * s) / 2,
          img.width * s,
          img.height * s
        );
      } else {
        ctx.fillStyle = party.color;
        ctx.font = '900 90px Heebo, Arial';
        ctx.fillText(party.name, w / 2, 230, w - 40);
      }
    })
  );
}

// Merge static colored geometry by material to keep the scene responsive on laptops and phones.
export function batchStatic(root, exclude = new Set()) {
  root.updateMatrixWorld(true);
  const groups = new Map(),
    inverse = root.matrixWorld.clone().invert(),
    remove = [];
  root.traverse(m => {
    // Instanced meshes, shaders and one-off textures (labels) stay as they are; textured materials
    // shared across many meshes opt in with userData.batch.
    if (
      !m.isMesh ||
      m.isInstancedMesh ||
      m.material.isShaderMaterial ||
      Array.isArray(m.material) ||
      exclude.has(m)
    )
      return;
    if ((m.material.map && !m.material.userData.batch) || m.material.vertexColors) return;
    const key = m.material;
    let bucket = groups.get(key);
    if (!bucket) {
      bucket = [];
      groups.set(key, bucket);
    }
    const geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    geo.applyMatrix4(inverse.clone().multiply(m.matrixWorld));
    bucket.push(geo);
    remove.push(m);
  });
  for (const [material, list] of groups) {
    const merged = new T.BufferGeometry();
    for (const attr of ['position', 'normal', 'uv']) {
      const parts = list.map(g => g.getAttribute(attr));
      if (parts.some(p => !p)) continue;
      const length = parts.reduce((s, p) => s + p.array.length, 0),
        buffer = new Float32Array(length);
      let offset = 0;
      for (const p of parts) {
        buffer.set(p.array, offset);
        offset += p.array.length;
      }
      merged.setAttribute(attr, new T.BufferAttribute(buffer, parts[0].itemSize));
    }
    const mesh = new T.Mesh(merged, material);
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
    list.forEach(g => g.dispose());
  }
  remove.forEach(m => m.removeFromParent());
}
