import * as T from './vendor/three.module.min.js';
import { E, C, F, sub, paint, sculpt } from './kart-sculpt.js';
import { FACES } from './kart-faces.js';
// Heads: each leader's real (freely licensed) portrait is projected onto a 3D head whose relief
// follows that photo's landmarks. Bodies: SDF-sculpted suits matching the same photos.
const LOOKS = [
  {
    id: 'netanyahu',
    W: 1.06,
    L: 1,
    skin: '#dc9e7c',
    lip: '#c07a70',
    eye: '#7d8c7c',
    eyeR: 0.108,
    lid: 0.55,
    lidTilt: -0.25,
    bags: true,
    brow: '#b3b6b8',
    browT: 0.036,
    browY: [0.2, 0.26, 0.2],
    nose: { l: 1.05, w: 1.25, tip: 1.35 },
    jaw: { w: 0.68, chin: 0.21, chinY: 0 },
    cheek: 1.15,
    jowl: true,
    mouth: { w: 0.95, smile: 0.012, asym: 0.025, thin: true },
    wrinkles: 2,
    folds: true,
    hair: '#e7e8ea',
    hairDark: '#b8bcc1',
    hairStyle: 'silverBack',
    body: { suit: '#161b2c', shirt: '#f4f6f9', tie: '#1f6fe0', w: 1.05, pin: true }
  },
  {
    id: 'bennett',
    W: 1.04,
    L: 1.02,
    skin: '#e4b58e',
    lip: '#c9877a',
    eye: '#5a3d26',
    eyeR: 0.108,
    lid: 0.2,
    lidTilt: 0,
    brow: '#5e4a3a',
    browT: 0.04,
    browY: [0.21, 0.23, 0.21],
    nose: { l: 1, w: 1.05, tip: 1.05 },
    jaw: { w: 0.7, chin: 0.25, chinY: 0, square: true },
    cheek: 1.05,
    mouth: { w: 1.05, smile: 0.03, asym: 0, thin: true },
    wrinkles: 0,
    folds: false,
    hair: '#6e5945',
    hairDark: '#4a3b2e',
    hairStyle: 'bald',
    kippah: 'small',
    body: { suit: '#1b1c1f', shirt: '#f6f7f9', tie: '#1d2c55', w: 1.02, pin: true }
  },
  {
    id: 'golan',
    W: 0.9,
    L: 1.1,
    skin: '#d49a77',
    lip: '#b77566',
    eye: '#7496a4',
    eyeR: 0.108,
    lid: 0.3,
    lidTilt: -0.1,
    brow: '#8f9088',
    browT: 0.03,
    browY: [0.2, 0.24, 0.19],
    nose: { l: 1.25, w: 0.9, tip: 0.95 },
    jaw: { w: 0.54, chin: 0.2, chinY: -0.03 },
    cheek: 0.8,
    mouth: { w: 0.95, smile: 0.025, asym: 0.01, thin: true },
    wrinkles: 3,
    folds: true,
    hair: '#b9bab2',
    hairDark: '#8e8f88',
    hairStyle: 'bald',
    body: { suit: '#2c3d5c', shirt: '#c6daf2', tie: '#1c2748', w: 0.95 }
  },
  {
    id: 'lieberman',
    W: 1.16,
    L: 0.98,
    skin: '#dca086',
    lip: '#b77a70',
    eye: '#5f6e72',
    eyeR: 0.095,
    lid: 0.5,
    lidTilt: 0.2,
    brow: '#6e6d69',
    browT: 0.05,
    browY: [0.16, 0.23, 0.24],
    nose: { l: 0.95, w: 1.2, tip: 1.15 },
    jaw: { w: 0.74, chin: 0.25, chinY: 0 },
    cheek: 1.1,
    mouth: { w: 0.95, smile: -0.012, asym: 0 },
    wrinkles: 1,
    folds: false,
    hair: '#a4a39e',
    hairDark: '#7e7d78',
    hairStyle: 'shaved',
    beard: { col: '#95938d', dark: '#6f6d68', t: 0.035 },
    body: { suit: '#1e2433', shirt: '#bcd3ee', tie: '#28305c', w: 1.2, neck: 1.25 }
  },
  {
    id: 'deri',
    W: 1.05,
    L: 1.02,
    skin: '#b97e5c',
    lip: '#a8665c',
    eye: '#4a3526',
    eyeR: 0.108,
    lid: 0.3,
    lidTilt: -0.05,
    brow: '#76726a',
    browT: 0.04,
    browY: [0.21, 0.25, 0.2],
    nose: { l: 1.1, w: 1.15, tip: 1.1 },
    jaw: { w: 0.66, chin: 0.22, chinY: 0 },
    cheek: 1,
    mouth: { w: 1, smile: 0.03, asym: 0.005 },
    wrinkles: 1,
    folds: true,
    hair: '#a3a098',
    hairDark: '#77746e',
    hairStyle: 'cropped',
    beard: { col: '#dcd9d1', dark: '#a9a69e', t: 0.07 },
    glasses: 'thin',
    kippah: 'velvet',
    body: { suit: '#1b2233', shirt: '#fbfaf7', tie: '#1e2a44', w: 1.08 }
  },
  {
    id: 'bengvir',
    W: 1.12,
    L: 0.96,
    skin: '#dca380',
    lip: '#bf7b6e',
    eye: '#553f2c',
    eyeR: 0.108,
    lid: 0.1,
    lidTilt: 0,
    brow: '#33261c',
    browT: 0.042,
    browY: [0.22, 0.24, 0.21],
    nose: { l: 0.95, w: 1.05, tip: 1.12 },
    jaw: { w: 0.7, chin: 0.24, chinY: 0.02 },
    cheek: 1.35,
    mouth: { w: 1.05, smile: 0.035, asym: 0.01, teeth: true },
    wrinkles: 0,
    folds: false,
    stubble: '#a9876f',
    hair: '#33251b',
    hairDark: '#1f170f',
    hairStyle: 'dark',
    glasses: 'round',
    kippah: 'knit',
    body: { suit: '#1d2c4f', shirt: '#f7f8fb', tie: '#2b4ea0', w: 1.12 }
  },
  {
    id: 'eisenkot',
    skin: '#d9a08a',
    hairStyle: 'cropped',
    // Open collar, no tie, as in his campaign portraits.
    body: { suit: '#1d2a4a', shirt: '#f4f6f8', w: 1.1, open: true, pin: true }
  },
  {
    id: 'smotrich',
    skin: '#d39a7e',
    hairStyle: 'dark',
    kippah: 'small',
    body: { suit: '#25272c', shirt: '#f6f7f9', tie: '#c8262c', w: 1.04 }
  }
];
function bodyOps(c) {
  const b = c.body,
    w = b.w,
    nk = b.neck || 1,
    o = [],
    add = x => o.push(x),
    sides = [-1, 1],
    S = c.skin;
  add(E([0, 1.5, -0.08], [0.6 * w, 0.55, 0.42], b.suit, { k: 0.1 }));
  add(C([-0.45 * w, 1.86, -0.08], [0.45 * w, 1.86, -0.08], 0.2, b.suit, { k: 0.18 }));
  for (const s of sides) {
    add(C([s * 0.58 * w, 1.82, -0.06], [s * 0.66 * w, 1.46, 0.18], 0.15, b.suit, { k: 0.08 }));
    add(C([s * 0.66 * w, 1.46, 0.18], [s * 0.53, 1.41, 0.5], 0.13, b.suit, { k: 0.06 }));
    add(C([s * 0.535, 1.41, 0.5], [s * 0.52, 1.41, 0.55], 0.118, b.shirt, { k: 0.015 }));
    add(E([s * 0.49, 1.42, 0.62], [0.12, 0.1, 0.13], S, { k: 0.05 }));
    add(C([s * 0.44, 1.46, 0.62], [s * 0.4, 1.5, 0.72], 0.04, S, { k: 0.03 }));
  }
  add(C([0, 1.86, -0.05], [0, 2.2, -0.05], 0.2 * nk, S, { k: 0.06 }));
  // Shirt V between the lapels, painted then creased along the lapel edges.
  const v = b.open ? 0.52 : 0.42;
  paint(
    F((x, y, z) => Math.max(Math.abs(x) - (y - 1.28) * v, 1.28 - y, 0.05 - z), [0, 1.75, 0.25], 0.6, b.shirt),
    b.shirt,
    0.012
  );
  for (const s of sides) sub(C([s * 0.02, 1.3, 0.34], [(s * 0.3 * v) / 0.42, 2.0, 0.26], 0.012), null, 0.015);
  for (const s of sides) add(C([s * 0.2 * nk, 2.0, 0.02], [s * 0.05, 1.9, 0.25], 0.05, b.shirt, { k: 0.03 }));
  if (b.tie) {
    paint(
      F(
        (x, y, z) => Math.max(Math.abs(x) - 0.045 - (1.92 - y) * 0.05, 1.36 - y, y - 1.92, 0.05 - z),
        [0, 1.65, 0.3],
        0.4,
        b.tie
      ),
      b.tie,
      0.008
    );
    add(E([0, 1.89, 0.28], [0.055, 0.045, 0.05], b.tie, { k: 0.02 }));
  } else
    paint(
      F((x, y, z) => Math.max(Math.abs(x) - (y - 1.72) * 0.38, 1.72 - y, 0.05 - z), [0, 1.9, 0.2], 0.4, S),
      S,
      0.012
    );
  add(E([0, 1.24, 0.3], [0.03, 0.03, 0.02], '#111418', { k: 0.01 }));
  if (b.pin) {
    add(E([0.24, 1.78, 0.31], [0.035, 0.025, 0.02], '#ffffff', { k: 0.008 }));
    paint(E([0.24, 1.78, 0.33], [0.012, 0.012, 0.02]), '#2e63c7', 0.006);
  }
  return o;
}
const cache = new Map(),
  skinMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.62 }),
  baseMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
// Preload the face photos so the driver-select portraits render with faces on the first frame.
const photos = new Map();
if (typeof document !== 'undefined')
  await Promise.all(
    Object.keys(FACES).map(async id => {
      const img = new Image();
      img.src = './assets/faces/' + id + '.jpg';
      try {
        await img.decode();
        photos.set(id, img);
      } catch {}
    })
  );
function stylize(ctx, w, h) {
  const img = ctx.getImageData(0, 0, w, h),
    d = img.data,
    lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) lum[i] = d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11;
  const levels = 9,
    step = 255 / (levels - 1);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      // Sobel edge strength on luminance.
      const gx =
        lum[i - w + 1] + 2 * lum[i + 1] + lum[i + w + 1] - lum[i - w - 1] - 2 * lum[i - 1] - lum[i + w - 1];
      const gy =
        lum[i + w - 1] + 2 * lum[i + w] + lum[i + w + 1] - lum[i - w - 1] - 2 * lum[i - w] - lum[i - w + 1];
      const edge = Math.min(1, Math.max(0, (Math.hypot(gx, gy) - 70) / 120));
      for (let k = 0; k < 3; k++) {
        const v = d[i * 4 + k],
          banded = Math.round(v / step) * step;
        // Mostly painted bands, a little of the original to keep likeness in the gradients.
        const painted = banded * 0.62 + v * 0.38;
        d[i * 4 + k] = painted * (1 - edge * 0.45) + [62, 38, 30][k] * edge * 0.45;
      }
    }
  ctx.putImageData(img, 0, 0);
}
function faceMaterial(id) {
  const img = photos.get(id);
  if (!img) return new T.MeshStandardMaterial({ color: FACES[id].skin, roughness: 0.8 });
  // Feather the crop into an ellipse so the photo melts into the 3D hair/skin base at the edges.
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const x = c.getContext('2d', { willReadFrequently: true });
  // Paint the photo rather than paste it: smooth away photographic grain, settle tones into
  // a few painted bands and ink the strongest features, so faces sit in the stylized world.
  x.filter = 'blur(1.6px) saturate(1.2) contrast(1.08) brightness(1.04)';
  x.drawImage(img, 0, 0);
  x.filter = 'none';
  stylize(x, c.width, c.height);
  x.globalCompositeOperation = 'destination-in';
  x.save();
  x.translate(c.width / 2, c.height / 2);
  x.scale((c.width / 2) * 0.98, (c.height / 2) * 1.06);
  const g = x.createRadialGradient(0, 0, 0.8, 0, 0, 1);
  g.addColorStop(0, '#000');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(-1, -1, 2, 2);
  x.restore();
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 4;
  return new T.MeshStandardMaterial({
    map: t,
    vertexColors: true,
    transparent: true,
    roughness: 0.78,
    emissive: '#ffffff',
    emissiveMap: t,
    emissiveIntensity: 0.28
  });
}
const gauss = (x, y, cx, cy, sx, sy) =>
  Math.exp(-((x - cx) ** 2 / (2 * sx * sx) + (y - cy) ** 2 / (2 * sy * sy)));
function headShape(id) {
  const f = FACES[id],
    [bx, by, bw, bh] = f.box,
    Hw = 0.64,
    Hh = (Hw * bh) / bw,
    D = 0.74;
  const P = ([px, py]) => [((px - bx) / bw - 0.5) * 2 * Hw, (0.5 - (py - by) / bh) * 2 * Hh];
  const [e1, e2] = f.eyes.map(P),
    n = P(f.nose),
    m = P(f.mouth),
    ey = (e1[1] + e2[1]) / 2,
    ex = (e1[0] + e2[0]) / 2;
  // Landmark-driven relief: brow, eye sockets, nose bridge and tip, muzzle, chin and cheekbones.
  const relief = (x, y) =>
    0.15 * gauss(x, y, n[0], n[1] + 0.03, 0.075, 0.07) +
    0.075 * gauss(x, y, (ex + n[0]) / 2, (ey + n[1]) / 2, 0.055, 0.12) -
    0.05 * gauss(x, y, e1[0], e1[1], 0.08, 0.055) -
    0.05 * gauss(x, y, e2[0], e2[1], 0.08, 0.055) +
    0.035 * gauss(x, y, ex, ey + 0.11, 0.3, 0.045) +
    0.045 * gauss(x, y, m[0], m[1], 0.17, 0.08) +
    0.035 * gauss(x, y, m[0], m[1] - 0.2, 0.12, 0.08) +
    0.02 * gauss(x, y, e1[0] - 0.06, ey - 0.14, 0.09, 0.07) +
    0.02 * gauss(x, y, e2[0] + 0.06, ey - 0.14, 0.09, 0.07);
  const hc = new T.Color(f.hair),
    sc = new T.Color(f.skin);
  const make = inflate => {
    const g = new T.SphereGeometry(1, 80, 60),
      p = g.getAttribute('position'),
      uv = g.getAttribute('uv'),
      col = [];
    for (let i = 0; i < p.count; i++) {
      const sx = p.getX(i),
        sy = p.getY(i),
        sz = p.getZ(i),
        q = (Math.abs(sx) ** 2.6 + Math.abs(sy) ** 2.6 + Math.abs(sz) ** 2.6) ** (1 / 2.6),
        ux = sx / q,
        uy = sy / q,
        uz = sz / q;
      const y = uy * Hh,
        x = ux * Hw * 0.93 * (1 - 0.14 * Math.max(0, -uy) ** 2);
      let z = uz * D;
      if (uz > 0) z += relief(x, y) * uz * uz;
      p.setXYZ(i, x * inflate, y * inflate, z * inflate);
      uv.setXY(i, x / (2 * Hw) + 0.5, y / (2 * Hh) + 0.5);
      if (inflate > 1) {
        const a = Math.min(1, Math.max(0, (uz - 0.05) / 0.35));
        col.push(1, 1, 1, a);
      } else {
        const hair =
          Math.min(1, Math.max(0, (uy + 0.5 - 0.3 * Math.max(0, uz)) / 0.22)) *
          (uz > 0.35 ? Math.min(1, Math.max(0, (uy - 0.55) / 0.15)) : 1);
        col.push(sc.r + (hc.r - sc.r) * hair, sc.g + (hc.g - sc.g) * hair, sc.b + (hc.b - sc.b) * hair);
      }
    }
    g.setAttribute('color', new T.Float32BufferAttribute(col, inflate > 1 ? 4 : 3));
    g.computeVertexNormals();
    return g;
  };
  return { base: make(1), shell: make(1.006), Hw, Hh, D, ey };
}
function kippah(head, kind, s) {
  const theta = Math.PI * (kind === 'velvet' ? 0.19 : kind === 'small' ? 0.13 : 0.2),
    geo = new T.SphereGeometry(1, 40, 10, 0, Math.PI * 2, 0, theta),
    p = geo.getAttribute('position'),
    col = [];
  const bands =
    kind === 'velvet'
      ? [[1, '#121316']]
      : kind === 'small'
      ? [
          [0.55, '#3d342c'],
          [0.68, '#5a4c40'],
          [1, '#3d342c']
        ]
      : [
          [0.5, '#f3f1eb'],
          [0.58, '#d8d5cb'],
          [0.88, '#f3f1eb'],
          [1, '#dcd9d0']
        ];
  for (let i = 0; i < p.count; i++) {
    const t = Math.acos(Math.min(1, p.getY(i))) / theta,
      c = new T.Color(bands.find(([e]) => t <= e + 1e-6)[1]);
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  geo.scale(s.Hw * 0.93 * 1.03, s.Hh * 1.025, s.D * 1.03);
  const m = new T.Mesh(
    geo,
    new T.MeshStandardMaterial({
      vertexColors: true,
      roughness: kind === 'velvet' ? 0.95 : 0.85,
      side: T.DoubleSide
    })
  );
  m.rotation.x = kind === 'velvet' ? -0.62 : kind === 'small' ? -0.45 : -0.12;
  m.castShadow = true;
  head.add(m);
}
function build(index) {
  if (cache.has(index)) return cache.get(index);
  const c = LOOKS[index];
  const g = {
    body: sculpt(bodyOps(c), [-1, 0.85, -0.6], [1, 2.35, 0.9], 0.035),
    shape: headShape(c.id),
    face: faceMaterial(c.id)
  };
  cache.set(index, g);
  return g;
}
export function makeDriver(index) {
  const c = LOOKS[index],
    g = build(index),
    s = g.shape,
    root = new T.Group(),
    head = new T.Group(),
    eyes = [];
  const body = new T.Mesh(g.body, skinMat);
  body.castShadow = true;
  root.add(body);
  head.position.set(0, 1.98 + s.Hh, -0.04);
  root.add(head);
  const base = new T.Mesh(s.base, baseMat);
  base.castShadow = true;
  head.add(base);
  const face = new T.Mesh(s.shell, g.face);
  head.add(face);
  for (const side of [-1, 1]) {
    const ear = new T.Mesh(
      new T.SphereGeometry(1, 16, 12),
      new T.MeshStandardMaterial({ color: FACES[c.id].skin, roughness: 0.8 })
    );
    ear.scale.set(0.06, 0.17, 0.11);
    ear.position.set(side * s.Hw * 0.9, s.ey - 0.08, -0.05);
    head.add(ear);
  }
  if (c.kippah) kippah(head, c.kippah, s);
  root.userData = { head, eyes, look: c };
  return root;
}
