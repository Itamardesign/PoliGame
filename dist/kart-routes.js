import * as T from './vendor/three.module.min.js';
// Secret-route geometry, kept for the race model (the courses currently ship without side roads):
// Bloomfield Garden inside the Old City hairpin, the Iraqi Market alleys through the S-bends.
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
