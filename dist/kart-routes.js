import * as T from './vendor/three.module.min.js';
import { kitMaterial, scaledBox, instanced, GEO } from './world-kit.js';
// Two secret routes, each cutting the inside of a corner: Bloomfield Garden inside the Old City
// hairpin, and the alleys of the Iraqi Market through the Mahane Yehuda S-bends.
export const SHORTCUTS = [
  { id: 'garden', name: 'גן בלומפילד', start: 0.815, end: 0.905, color: '#e893db', width: 5.4 },
  { id: 'alley', name: 'השוק העיראקי', start: 0.43, end: 0.565, color: '#f6b85f', width: 5.2 }
];
export function makeShortcuts(track) {
  return SHORTCUTS.map(raw => {
    // The entrance sits on the inside of the corner the route cuts.
    let turn = 0;
    for (let k = 0; k <= 20; k++)
      turn += track.bend((raw.start + ((raw.end - raw.start) * k) / 20) * track.length);
    const side = -Math.sign(turn) || 1,
      spec = { ...raw, side, entryX: side * 7.8, exitX: side * 5.4 };
    const start = spec.start * track.length,
      end = spec.end * track.length,
      a = track.at(start, spec.entryX),
      b = track.at(end, spec.exitX);
    const curve = new T.CatmullRomCurve3(
      [
        a.p,
        a.p.clone().addScaledVector(a.t, 13),
        a.p.clone().lerp(b.p, 0.47),
        b.p.clone().addScaledVector(b.t, -13),
        b.p
      ],
      false,
      'catmullrom',
      0.3
    );
    const length = curve.getLength();
    function at(distance, x = 0) {
      const u = Math.max(0, Math.min(1, distance / length)),
        p = curve.getPointAt(u),
        t = curve.getTangentAt(u).normalize(),
        right = new T.Vector3(-t.z, 0, t.x).normalize();
      p.addScaledVector(right, x);
      return { p, t, right };
    }
    function bend(distance) {
      const a = at(distance).t,
        b = at(Math.min(length, distance + 2)).t;
      return Math.atan2(a.z * b.x - a.x * b.z, a.dot(b)) / 2;
    }
    return { ...spec, start, end, length, curve, at, bend };
  });
}
export function racerFrame(track, r, ahead = 0) {
  const route = r.routeId && track.shortcuts.find(p => p.id === r.routeId);
  return route ? route.at(Math.min(route.length, r.routeDistance + ahead), r.x) : track.at(r.s + ahead, r.x);
}
export function routeBend(track, r) {
  const route = r.routeId && track.shortcuts.find(p => p.id === r.routeId);
  return route ? route.bend(r.routeDistance) : track.bend(r.s);
}
// The two secret routes, dressed as real places: an almond-blossom garden path and a
// Nachlaot-style stone alley under arches and washing lines. Lanterns mark the line.
export function buildShortcuts(parent, track, box, label, mat) {
  // Main-road centreline samples: scenery for a secret route must never sit on the road.
  const road = Array.from({ length: 400 }, (_, i) => track.at((i / 400) * track.length).p);
  const offRoad = (v, margin = 12) => road.every(p => (p.x - v.x) ** 2 + (p.z - v.z) ** 2 > margin * margin);
  const stone = kitMaterial('stone'),
    paving = kitMaterial('paving');
  for (const route of track.shortcuts) {
    const garden = route.id === 'garden';
    const positions = [],
      uvs = [],
      indices = [];
    for (let i = 0; i <= 100; i++) {
      for (const side of [-1, 1]) {
        const p = route.at((i / 100) * route.length, (side * route.width) / 2).p;
        positions.push(p.x, p.y + 0.13, p.z);
        uvs.push(side < 0 ? 0 : route.width / 3, ((i / 100) * route.length) / 3);
      }
      if (i < 100) {
        const n = i * 2;
        indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
      }
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const path = new T.Mesh(geo, garden ? paving : stone);
    path.receiveShadow = true;
    parent.add(path);

    // Lanterns along both edges instead of floating gems.
    const lanterns = [],
      glows = [];
    for (let d = 6; d < route.length - 6; d += 7)
      for (const side of [-1, 1]) {
        const e = route.at(d, side * (route.width / 2 + 0.45)).p;
        lanterns.push({ x: e.x, y: e.y, z: e.z });
        glows.push({ x: e.x, y: e.y + 0.95, z: e.z });
      }
    instanced(
      parent,
      new T.CylinderGeometry(0.06, 0.08, 0.9, 6).translate(0, 0.45, 0),
      kitMaterial('dark-metal'),
      lanterns
    );
    instanced(
      parent,
      new T.BoxGeometry(0.26, 0.32, 0.26),
      new T.MeshStandardMaterial({ color: route.color, emissive: route.color, emissiveIntensity: 1.1 }),
      glows,
      { shadow: false }
    );

    // Stone gateway at the entrance with a small street sign.
    const entrance = new T.Group(),
      a = route.at(0);
    entrance.position.copy(a.p);
    entrance.rotation.y = Math.atan2(a.t.x, a.t.z);
    parent.add(entrance);
    for (const x of [-3.2, 3.2]) {
      const pier = new T.Mesh(scaledBox(1.1, 4.8, 1.1), stone);
      pier.position.set(x, 2.4, 0);
      pier.castShadow = true;
      entrance.add(pier);
    }
    const lintel = new T.Mesh(scaledBox(7.6, 1, 1.2), stone);
    lintel.position.set(0, 5.2, 0);
    entrance.add(lintel);
    const sign = label(garden ? 'גן' : 'סמטה', 1.6, 0.6, '#f4f2ea', '#1f3b6e', 120);
    sign.position.set(0, 5.2, -0.62);
    sign.rotation.y = Math.PI;
    entrance.add(sign);

    // Along the route: almond trees in blossom, or alley walls with arches and washing lines.
    const trunks = [],
      crowns = [];
    for (let d = 12; d < route.length - 10; d += garden ? 9 : 11) {
      const at = route.at(d),
        g = new T.Group();
      g.position.copy(at.p);
      g.rotation.y = Math.atan2(at.t.x, at.t.z);
      parent.add(g);
      if (garden) {
        for (const side of [-1, 1]) {
          const q = route.at(d, side * 4.4).p;
          trunks.push({ x: q.x, y: q.y, z: q.z, ry: d, s: 0.9 });
          crowns.push({ x: q.x, y: q.y, z: q.z, ry: d, s: 0.9 });
        }
      } else {
        g.updateMatrixWorld(true);
        let both = true;
        for (const side of [-1, 1]) {
          const at = new T.Vector3(side * 3.6, 0, 0).applyMatrix4(g.matrixWorld);
          if (!offRoad(at)) {
            both = false;
            continue;
          }
          const wall = new T.Mesh(scaledBox(1.4, 5.2, 10.5), stone);
          wall.position.set(side * 3.6, 2.6, 0);
          wall.castShadow = wall.receiveShadow = true;
          g.add(wall);
        }
        // Arches and washing lines only where the alley is walled on both sides.
        if (!both) continue;
        const arch = new T.Mesh(new T.TorusGeometry(3.6, 0.45, 6, 16, Math.PI), stone);
        arch.position.set(0, 4.6, 0);
        g.add(arch);
        const line = new T.Mesh(new T.CylinderGeometry(0.015, 0.015, 7.2, 4), kitMaterial('dark-metal'));
        line.rotation.z = Math.PI / 2;
        line.position.set(0, 4.2, 2.5);
        g.add(line);
        ['#e8e4da', '#c94f4f', '#4f79c9', '#e6c25a'].forEach((c, k) => {
          const cloth = new T.Mesh(
            new T.PlaneGeometry(0.7, 0.9),
            new T.MeshStandardMaterial({ color: c, side: T.DoubleSide })
          );
          cloth.position.set(-2.4 + k * 1.6, 3.7, 2.5);
          g.add(cloth);
        });
      }
    }
    if (garden) {
      instanced(parent, GEO.oliveTrunk(), kitMaterial('trunk'), trunks);
      instanced(parent, GEO.oliveCrown(), kitMaterial('#f1d3dc'), crowns);
    }
    // The jump: a stone kicker with hazard paint.
    const ramp = route.at(route.length * 0.57),
      g = new T.Group();
    g.position.copy(ramp.p);
    g.rotation.y = Math.atan2(ramp.t.x, ramp.t.z);
    parent.add(g);
    const rampMesh = box(g, route.width - 0.5, 0.22, 3, '#f2c14e', 0, 0.35, 0);
    rampMesh.rotation.x = -0.18;
  }
}
