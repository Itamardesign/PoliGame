// The circuit two weeks before election day (27 October 2026): a live poll screen, the Elections
// Committee checkpoint, a banner plane for the Israelis flying home to vote, a school polling
// station with a queue, rally stands for and against the draft law, and the Knesset tunnel.
import * as T from './vendor/three.module.min.js';
import { PARTIES } from './race-model.js';
import { kitMaterial as K, scaledBox, instanced, GEO, textCanvasTexture } from './world-kit.js';

export const ELECTION_DAY = '27.10';
// The Knesset tunnel, by lap fraction, on the run back to the start.
export const TUNNEL = [0.915, 0.965];
export const inTunnel = (s, L) => {
  const u = (((s / L) % 1) + 1) % 1;
  return u > TUNNEL[0] - 0.006 && u < TUNNEL[1] + 0.006;
};

function frame(track, s, x = 0) {
  const { p, t } = track.at(s, x),
    g = new T.Group();
  g.position.copy(p);
  g.rotation.y = Math.atan2(t.x, t.z);
  return g;
}
const mesh = (g, geo, mat, x = 0, y = 0, z = 0) => {
  const m = new T.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  g.add(m);
  return m;
};
function sign(text, w, h, bg, fg, size = 80, weight = 900) {
  return new T.Mesh(
    new T.PlaneGeometry(w, h),
    new T.MeshStandardMaterial({
      roughness: 0.7,
      map: textCanvasTexture(1024, Math.round((1024 * h) / w), (ctx, cw, ch) => {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, cw, ch);
        ctx.fillStyle = fg;
        ctx.font = `${weight} ${size}px Heebo, Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, cw / 2, ch / 2 + size * 0.06, cw - 40);
      })
    })
  );
}

// Turn a sign so its printed face (+z) looks at the road a little before s, toward oncoming karts.
function faceRoad(m, track, s) {
  m.parent.updateMatrixWorld(true);
  const target = track.at(s).p.clone();
  target.y = m.getWorldPosition(new T.Vector3()).y;
  m.lookAt(target);
}

export function buildNews(scene, statics, track, { mood = 'day', checkpoints = [] } = {}) {
  const L = track.length,
    night = mood === 'night',
    updates = [];

  // ——— The Elections Committee checkpoint: a gantry over the right-hand lane. ———
  for (const c of checkpoints) {
    const g = frame(track, c.s);
    statics.add(g);
    const mid = (c.x0 + c.x1) / 2,
      // Road-frame x is to the right; local +x of this group points left.
      lx = -mid;
    for (const off of [-c.x0 - 0.3, -c.x1 - 0.6])
      mesh(g, new T.BoxGeometry(0.4, 12, 0.4), K('#d8dde2'), off, 6, 0);
    mesh(g, new T.BoxGeometry(c.x1 - c.x0 + 1.4, 0.8, 0.6), K('#1f3b6e'), lx, 12, 0);
    const board = sign(
      'ועדת הבחירות המרכזית · בדיקת תעמולה',
      c.x1 - c.x0 + 1.2,
      0.7,
      '#1f3b6e',
      '#ffffff',
      64
    );
    board.position.set(lx, 12, -0.32);
    board.rotation.y = Math.PI;
    g.add(board);
    const warn = sign('אביזר ביד? יוחרם', 4.4, 0.62, '#f2c14e', '#1b1d22', 70);
    warn.position.set(lx, 11.1, -0.32);
    warn.rotation.y = Math.PI;
    g.add(warn);
    // The inspectors' booth on the verge, with a camera on a pole.
    mesh(g, scaledBox(2.6, 2.6, 2.2), K('stone-pale'), -c.x1 - 3.2, 1.3, 0);
    mesh(g, new T.BoxGeometry(2.8, 0.2, 2.4), K('#1f3b6e'), -c.x1 - 3.2, 2.7, 0);
    const lens = new T.Mesh(
      new T.SphereGeometry(0.18, 10, 8),
      new T.MeshStandardMaterial({ color: '#ff3b3b', emissive: '#ff3b3b', emissiveIntensity: 1 })
    );
    lens.position.set(lx, 11.55, -0.4);
    g.add(lens);
    updates.push(t => (lens.material.emissiveIntensity = Math.sin(t * 6) > 0.6 ? 2.4 : 0.4));
  }

  // ——— Live poll screen on the avenue: the race shown as a seat projection. ———
  const poll = frame(track, L * 0.06, -24);
  poll.position.y = 0;
  statics.add(poll);
  // Face the screen at the road a little ahead of the start, where karts see it on the run-in.
  {
    const target = track.at(L * 0.06 - 40).p;
    poll.lookAt(target.x, 0, target.z);
  }
  for (const x of [-4.5, 4.5]) mesh(poll, new T.BoxGeometry(0.4, 6, 0.4), K('dark-metal'), x, 3, 0);
  mesh(poll, new T.BoxGeometry(10.4, 6.2, 0.4), K('#111820'), 0, 7.6, -0.05);
  const pollCanvas = document.createElement('canvas');
  pollCanvas.width = 768;
  pollCanvas.height = 448;
  const pollTex = new T.CanvasTexture(pollCanvas);
  pollTex.colorSpace = T.SRGBColorSpace;
  const screen = new T.Mesh(
    new T.PlaneGeometry(10, 5.83),
    new T.MeshBasicMaterial({ map: pollTex, toneMapped: false })
  );
  screen.position.set(0, 7.6, 0.18);
  poll.add(screen);
  function drawPoll(rows, title) {
    const x = pollCanvas.getContext('2d'),
      W = pollCanvas.width,
      H = pollCanvas.height;
    x.fillStyle = '#0b1422';
    x.fillRect(0, 0, W, H);
    x.fillStyle = '#e5383b';
    x.fillRect(W - 170, 22, 150, 44);
    x.fillStyle = '#fff';
    x.font = '900 30px Heebo, Arial';
    x.textAlign = 'center';
    x.fillText('סקר חי', W - 95, 54);
    x.textAlign = 'right';
    x.font = '800 28px Heebo, Arial';
    x.fillText(title, W - 196, 54);
    const max = Math.max(12, ...rows.map(r => r.seats));
    rows.forEach((r, i) => {
      const y = 100 + i * 54,
        w = ((W - 330) * r.seats) / max;
      x.fillStyle = 'rgba(255,255,255,0.08)';
      x.fillRect(40, y, W - 330, 40);
      x.fillStyle = r.color;
      x.fillRect(W - 290 - w, y, w, 40);
      x.fillStyle = '#fff';
      x.textAlign = 'right';
      x.font = '800 30px Heebo, Arial';
      x.fillText(r.name, W - 30, y + 30);
      x.textAlign = 'left';
      x.fillText(String(r.seats), 50, y + 30);
    });
    x.strokeStyle = '#f2c14e';
    x.setLineDash([10, 8]);
    x.lineWidth = 3;
    pollTex.needsUpdate = true;
  }
  drawPoll(
    PARTIES.map((p, i) => ({ name: p.short, color: p.color, seats: 12 - i * 2 })),
    'עוד ' + ELECTION_DAY
  );

  // ——— Election-day banners on the start gantry's back and along the avenue. ———
  {
    const g = frame(track, 0);
    statics.add(g);
    const day = sign(`יום הבחירות · ${ELECTION_DAY}`, 14, 1.2, '#1d2533', '#f2c14e', 64);
    day.position.set(0, 9.2, 0.37);
    g.add(day);
    for (const [u, side] of [
      [0.03, 1],
      [0.09, -1],
      [0.5, 1],
      [0.66, -1]
    ]) {
      const b = frame(track, L * u, side * 15.2);
      b.position.y = 0;
      b.rotation.y += Math.PI + side * 0.5;
      statics.add(b);
      for (const x of [-1.6, 1.6]) mesh(b, new T.BoxGeometry(0.12, 4.2, 0.12), K('dark-metal'), x, 2.1, 0);
      const flag = sign(`הצביעו · ${ELECTION_DAY}`, 3.4, 1.6, '#2f6fe4', '#ffffff', 120);
      flag.position.set(0, 3.4, 0.05);
      b.add(flag);
      faceRoad(flag, track, L * u - 25);
    }
  }

  // ——— A banner plane circling the course: Israelis abroad flying home to vote. ———
  {
    const plane = new T.Group();
    scene.add(plane);
    const body = new T.Group();
    plane.add(body);
    mesh(body, new T.CylinderGeometry(0.45, 0.3, 5, 10), K('#f4f6f8'), 0, 0, 0).rotation.x = Math.PI / 2;
    mesh(body, new T.BoxGeometry(8, 0.12, 1.3), K('#f4f6f8'), 0, 0.2, 0.4);
    mesh(body, new T.BoxGeometry(2.6, 0.1, 0.8), K('#2f6fe4'), 0, 0.15, -2.2);
    mesh(body, new T.BoxGeometry(0.1, 1.1, 0.8), K('#2f6fe4'), 0, 0.6, -2.2);
    const prop = mesh(body, new T.BoxGeometry(1.6, 0.12, 0.05), K('#333'), 0, 0, 2.55);
    const rope = mesh(body, new T.CylinderGeometry(0.02, 0.02, 9, 4), K('#555'), 0, 0, -6.7);
    rope.rotation.x = Math.PI / 2;
    const banner = new T.Mesh(
      new T.PlaneGeometry(14, 2.2, 12, 1),
      new T.MeshBasicMaterial({
        side: T.DoubleSide,
        map: textCanvasTexture(1024, 160, (ctx, w, h) => {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = '#1f3b6e';
          ctx.font = '900 96px Heebo, Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`חוזרים הביתה להצביע · ${ELECTION_DAY}`, w / 2, h / 2 + 6, w - 40);
        })
      })
    );
    banner.rotation.y = Math.PI / 2;
    banner.position.set(0, -0.4, -18.4);
    body.add(banner);
    const rest = Float32Array.from(banner.geometry.getAttribute('position').array);
    updates.push(t => {
      const a = t * 0.07;
      plane.position.set(40 + Math.cos(a) * 170, 52 + Math.sin(t * 0.3) * 3, Math.sin(a) * 150);
      plane.rotation.y = -a;
      body.rotation.z = 0.18;
      prop.rotation.z = t * 40;
      const pos = banner.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i++)
        pos.array[i * 3 + 2] = rest[i * 3 + 2] + Math.sin(t * 5 + rest[i * 3] * 0.5) * 0.4;
      pos.needsUpdate = true;
    });
  }

  // ——— A school serving as a polling station, with a queue at the gate. ———
  {
    const g = frame(track, L * 0.6, 34);
    g.position.y = 0;
    g.rotation.y += Math.PI / 2;
    statics.add(g);
    mesh(g, scaledBox(24, 7, 12), K('stone'), 0, 3.5, -4);
    mesh(g, scaledBox(25, 0.4, 13), K('stone-pale'), 0, 7.2, -4);
    for (let x = -10; x <= 10; x += 3)
      mesh(g, new T.BoxGeometry(1.6, 1.6, 0.12), K('window'), x, 4.6, 2.05).castShadow = false;
    const school = sign(`בית ספר ממלכתי · קלפי ${ELECTION_DAY}`, 12, 1.1, '#f3efe4', '#1f3b6e', 76);
    school.position.set(0, 6.3, 2.08);
    g.add(school);
    const box = sign('קלפי', 1.6, 1, '#2f6fe4', '#ffffff', 140);
    box.position.set(-6.5, 2.2, 2.1);
    g.add(box);
    mesh(g, new T.BoxGeometry(5, 2.6, 0.2), K('dark-metal'), 0, 1.3, 4.5);
    // The queue snakes along the fence.
    g.updateMatrixWorld(true);
    const people = [];
    for (let i = 0; i < 26; i++) {
      const v = new T.Vector3(-11 + (i % 13) * 1.6, 0, 6.2 + Math.floor(i / 13) * 1.1).applyMatrix4(
        g.matrixWorld
      );
      people.push({ x: v.x, y: 0, z: v.z, ry: g.rotation.y + Math.PI / 2, s: 0.9 + (i % 3) * 0.06 });
    }
    const bodies = instanced(scene, GEO.personBody(), new T.MeshStandardMaterial({ roughness: 0.9 }), people);
    people.forEach((_, i) =>
      bodies.setColorAt(i, new T.Color(['#3a5a8a', '#c9c2b2', '#8a3a3a', '#2f2f35', '#5f7d4a'][i % 5]))
    );
    instanced(
      scene,
      GEO.personLegs(),
      new T.MeshStandardMaterial({ color: '#2c3440', roughness: 0.9 }),
      people
    );
    instanced(
      scene,
      GEO.personHead(),
      new T.MeshStandardMaterial({ color: '#d4a585', roughness: 0.8 }),
      people
    );
    instanced(
      scene,
      GEO.personHair(),
      new T.MeshStandardMaterial({ color: '#2a2018', roughness: 1 }),
      people
    );
  }

  // ——— Two rally stands facing each other across the road: the draft-law debate. ———
  for (const [side, text, color] of [
    [1, 'חוק הגיוס — בעד', '#2f6fe4'],
    [-1, 'חוק הגיוס — נגד', '#e5383b']
  ]) {
    const g = frame(track, L * 0.455, side * 20);
    g.position.y = 0;
    g.rotation.y += side > 0 ? -Math.PI / 2 : Math.PI / 2;
    statics.add(g);
    mesh(g, new T.BoxGeometry(6, 0.8, 3), K('#6b5a45'), 0, 0.4, 0);
    for (const x of [-2.6, 2.6]) mesh(g, new T.BoxGeometry(0.12, 4, 0.12), K('dark-metal'), x, 2.4, -1.2);
    const banner = sign(text, 5.6, 1.1, color, '#ffffff', 96);
    banner.position.set(0, 3.6, -1.1);
    g.add(banner);
    faceRoad(banner, track, L * 0.455);
  }

  // ——— The Knesset tunnel: stone portals, a concrete roof high enough for the chase camera. ———
  {
    const a = TUNNEL[0] * L,
      b = TUNNEL[1] * L,
      roof = [],
      walls = [],
      lights = [];
    for (let s = a; s < b; s += 4) {
      const { p, t } = track.at(s),
        ry = Math.atan2(t.x, t.z);
      roof.push({ x: p.x, y: p.y + 11, z: p.z, ry });
      lights.push({ x: p.x, y: p.y + 10.45, z: p.z, ry });
      for (const side of [-1, 1]) {
        const q = track.at(s, side * 13.4).p;
        walls.push({ x: q.x, y: p.y + 5.5, z: q.z, ry });
      }
    }
    instanced(statics, new T.BoxGeometry(28.4, 1, 4.3), K('#9a958a'), roof);
    instanced(statics, new T.BoxGeometry(0.8, 11, 4.3), K('#a9a497'), walls);
    instanced(
      statics,
      new T.BoxGeometry(18, 0.1, 0.5),
      new T.MeshStandardMaterial({ color: '#fff3d6', emissive: '#fff3d6', emissiveIntensity: 1.3 }),
      lights,
      { shadow: false }
    );
    for (const [s, back] of [
      [a, false],
      [b, true]
    ]) {
      const g = frame(track, s);
      statics.add(g);
      mesh(g, scaledBox(30, 4, 1.4), K('stone'), 0, 13, 0);
      for (const x of [-14.2, 14.2]) mesh(g, scaledBox(2.4, 15, 1.4), K('stone'), x, 7.5, 0);
      const name = sign('מנהרת הכנסת', 9, 1.4, '#e8dcc0', '#3b3326', 110);
      name.position.set(0, 13, back ? 0.72 : -0.72);
      if (!back) name.rotation.y = Math.PI;
      g.add(name);
    }
  }

  return {
    drawPoll,
    update(t) {
      for (const f of updates) f(t);
    }
  };
}
