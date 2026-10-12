import * as T from './vendor/three.module.min.js';
import { racerFrame } from './kart-routes.js';
export function makeEffects(scene, track, karts, reduced) {
  const mats = new Map(),
    material = color => {
      if (!mats.has(color)) mats.set(color, new T.MeshBasicMaterial({ color }));
      return mats.get(color);
    };
  const geo = new T.IcosahedronGeometry(0.12, 0),
    particles = Array.from({ length: 140 }, () => {
      const mesh = new T.Mesh(geo, material('#fff09a'));
      mesh.visible = false;
      scene.add(mesh);
      return { mesh, life: 0, total: 1, v: new T.Vector3() };
    });
  let cursor = 0,
    clock = 0,
    shake = 0;
  const waves = [],
    words = [],
    missiles = [];
  function burst(pos, color = '#fff09a', count = 20) {
    if (reduced) count = Math.min(5, count);
    for (let i = 0; i < count; i++) {
      const p = particles[cursor++ % particles.length];
      p.life = p.total = 0.45 + Math.random() * 0.4;
      p.mesh.visible = true;
      p.mesh.material = material(color);
      p.mesh.position.copy(pos);
      p.v.set((Math.random() - 0.5) * 7, 2 + Math.random() * 5, (Math.random() - 0.5) * 7);
      p.mesh.scale.setScalar(1 + Math.random());
    }
  }
  function ring(pos, color) {
    const mesh = new T.Mesh(
      new T.TorusGeometry(1, 0.065, 8, 36),
      new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(pos);
    mesh.position.y += 0.2;
    scene.add(mesh);
    waves.push({ mesh, life: 0.65 });
  }
  function word(pos, text, color = '#fff4a2') {
    for (let i = words.length - 1; i >= 0; i--) {
      const old = words[i];
      if (old.sprite.position.distanceTo(pos) < 9) {
        old.sprite.removeFromParent();
        old.sprite.material.map.dispose();
        old.sprite.material.dispose();
        words.splice(i, 1);
      }
    }
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 64px Heebo, Arial';
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#273c49';
    ctx.strokeText(text, 256, 64);
    ctx.fillStyle = color;
    ctx.fillText(text, 256, 64);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    const sprite = new T.Sprite(new T.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
    sprite.position.copy(pos);
    sprite.position.y += 3.6;
    sprite.scale.set(3.6, 0.9, 1);
    scene.add(sprite);
    words.push({ sprite, life: 1.1 });
  }
  const hiddenMatrix = new T.Matrix4().makeScale(0, 0, 0);
  const skidMesh = new T.InstancedMesh(
    new T.PlaneGeometry(0.22, 0.8),
    new T.MeshBasicMaterial({
      color: '#202a31',
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      side: T.DoubleSide
    }),
    100
  );
  skidMesh.frustumCulled = false;
  skidMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
  scene.add(skidMesh);
  const skid = new T.Object3D(),
    tracks = Array.from({ length: 100 }, () => ({ life: 0, matrix: new T.Matrix4().makeScale(0, 0, 0) }));
  let skidCursor = 0;
  const effectPoint = r =>
    racerFrame(track, r)
      .p.clone()
      .add(new T.Vector3(0, 1, 0));
  function event(e, race) {
    const r = race.racers.find(r => r.id === e.id);
    if (!r) return;
    const p = effectPoint(r);
    // Rivals get particles but only speak up for the big moments, so the screen stays readable.
    const say = r.player || ['hit', 'ram', 'shield-break'].includes(e.type) ? word : () => {};
    if (e.type === 'jackpot') {
      burst(p, '#ffe276', 36);
      ring(p, '#ffe276');
      say(p, 'בונוס! +3', '#fff0a1');
    }
    if (e.type === 'near-miss') {
      burst(p, '#b5f4dd', 20);
      say(p, 'כמעט!', '#b5f4dd');
    }
    if (e.type === 'bump' || e.type === 'ram') {
      burst(p, e.type === 'ram' ? '#ffb365' : '#fff4b7', 22);
      ring(p, '#ffd090');
      say(p, e.type === 'ram' ? 'בום!' : 'טאק!', '#ffd696');
      if (r.player && !reduced) shake = 0.18;
    }
    if (e.type === 'pickup') {
      burst(p, '#ffe67c', 9);
      if (e.count % 3 === 1) say(p, '+1', '#fff4a2');
    }
    if (e.type === 'item-get') {
      burst(p, '#f7ca6a', 24);
      ring(p, '#ffe797');
      say(p, 'כוח!', '#fff8b9');
    }
    if (e.type === 'item-use') {
      if (e.item === 'shield') {
        ring(p, '#80ebff');
        burst(p, '#c0f6ff', 18);
      }
      if (e.item === 'boost') {
        burst(p, '#61e7ff', 24);
        say(p, 'טורבו!', '#80efff');
      }
      if (e.item === 'magnet') {
        ring(p, '#ed8ad9');
        say(p, 'מגנט מנדטים', '#efafff');
      }
    }
    if (e.type === 'poll-fired') {
      const mesh = new T.Group(),
        body = new T.Mesh(new T.BoxGeometry(0.75, 0.55, 0.16), material('#fff5cc'));
      mesh.add(body);
      for (let i = 0; i < 3; i++) {
        const bar = new T.Mesh(new T.BoxGeometry(0.12, 0.15 + i * 0.1, 0.04), material('#ed6ea5'));
        bar.position.set((i - 1) * 0.19, -0.1 + i * 0.05, 0.1);
        mesh.add(bar);
      }
      scene.add(mesh);
      missiles.push({ mesh, start: p.clone(), target: e.target, life: 1.05, total: 1.05 });
    }
    if (e.type === 'hit') {
      burst(p, '#ff895f', 30);
      ring(p, '#ffb87c');
      say(p, 'ספין!', '#ffb888');
      if (r.player && !reduced) shake = 0.28;
    }
    if (e.type === 'shield-break') {
      burst(p, '#8deeff', 35);
      ring(p, '#99f3ff');
      say(p, 'נחסם!', '#b9f8ff');
    }
    if (e.type === 'drift-charge') {
      burst(p, e.tier === 3 ? '#ee99ff' : e.tier === 2 ? '#ffb74f' : '#71dfff', 10);
    }
    if (e.type === 'drift-boost') {
      const color = e.tier === 3 ? '#ef91ff' : e.tier === 2 ? '#ffc16f' : '#7bedff';
      burst(p, color, 28);
      ring(p, color);
      say(p, e.tier === 3 ? 'אולטרה טורבו!' : e.tier === 2 ? 'סופר טורבו!' : 'מיני טורבו!', color);
    }
    if (e.type === 'slipstream') {
      burst(p, '#c9f898', 24);
      say(p, 'עקיפה חכמה!', '#d1ff9d');
    }
    if (e.type === 'jump') {
      ring(p, '#e4b7ff');
      burst(p, '#e4b7ff', 14);
    }
    if (e.type === 'trick') say(p, 'סטייל!', '#efb4ff');
    if (e.type === 'land') {
      if (r.player && !reduced) shake = Math.max(shake, e.trick ? 0.16 : 0.1);
      ring(p, e.trick ? '#e2a5ff' : '#fff0ce');
      burst(p, e.trick ? '#c49bff' : '#d8cbac', e.trick ? 25 : 8);
      if (e.trick) say(p, 'נחיתה מושלמת!', '#dfadff');
    }
    if (e.type === 'shortcut-enter') {
      burst(p, '#ef9ad6', 25);
      say(p, 'דרך סודית!', '#efb7ff');
    }
    if (e.type === 'shortcut-exit') {
      ring(p, '#e9a7ed');
    }
    if (e.type === 'launch-boost') {
      burst(p, '#99edff', 28);
      say(p, 'זינוק מושלם!', '#aaf3ff');
    }
  }
  function update(dt, race) {
    clock += dt;
    shake = Math.max(0, shake - dt);
    for (const p of particles) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.v.y -= dt * 10;
      p.mesh.position.addScaledVector(p.v, dt);
      p.mesh.scale.setScalar(Math.max(0, p.life / p.total) * 1.5);
      p.mesh.rotation.y += dt * 8;
      p.mesh.visible = p.life > 0;
    }
    for (let i = waves.length - 1; i >= 0; i--) {
      const w = waves[i];
      w.life -= dt;
      w.mesh.scale.setScalar(1 + (1 - w.life / 0.65) * 4);
      w.mesh.material.opacity = Math.max(0, w.life / 0.65);
      if (w.life <= 0) {
        w.mesh.removeFromParent();
        w.mesh.geometry.dispose();
        w.mesh.material.dispose();
        waves.splice(i, 1);
      }
    }
    for (let i = words.length - 1; i >= 0; i--) {
      const w = words[i];
      w.life -= dt;
      w.sprite.position.y += dt * 1.9;
      w.sprite.material.opacity = Math.min(1, w.life * 2.5);
      if (w.life <= 0) {
        w.sprite.removeFromParent();
        w.sprite.material.map.dispose();
        w.sprite.material.dispose();
        words.splice(i, 1);
      }
    }
    for (let i = missiles.length - 1; i >= 0; i--) {
      const m = missiles[i];
      m.life -= dt;
      const target = race?.racers.find(r => r.id === m.target);
      if (target) {
        const u = 1 - Math.max(0, m.life) / m.total;
        m.mesh.position.copy(m.start).lerp(effectPoint(target), u);
        m.mesh.position.y += Math.sin(u * Math.PI) * 5;
        m.mesh.rotation.set(clock * 9, clock * 6, clock * 3);
        if (!reduced && Math.floor(clock * 60) % 3 === 0) burst(m.mesh.position, '#f3a1ce', 1);
      }
      if (m.life <= 0) {
        m.mesh.removeFromParent();
        m.mesh.traverse(o => o.geometry?.dispose());
        missiles.splice(i, 1);
      }
    }
    if (race && !reduced) {
      const r = race.racers[0],
        kart = karts[r.id];
      if (r.drifting && r.air === 0) {
        for (const side of [-1, 1]) {
          const p = kart.localToWorld(new T.Vector3(side * 1, 0.07, -1));
          skid.position.copy(p);
          skid.rotation.set(-Math.PI / 2, 0, -kart.rotation.y);
          skid.scale.set(1, Math.max(0.6, r.speed * dt * 2), 1);
          skid.updateMatrix();
          const mark = tracks[skidCursor++ % tracks.length];
          mark.life = 3.5;
          mark.matrix.copy(skid.matrix);
        }
      }
    }
    for (let i = 0; i < tracks.length; i++) {
      const mark = tracks[i];
      mark.life -= dt;
      skidMesh.setMatrixAt(i, mark.life > 0 ? mark.matrix : hiddenMatrix);
    }
    skidMesh.instanceMatrix.needsUpdate = true;
  }
  function reset() {
    for (const w of waves) {
      w.mesh.removeFromParent();
      w.mesh.geometry.dispose();
      w.mesh.material.dispose();
    }
    waves.length = 0;
    for (const w of words) {
      w.sprite.removeFromParent();
      w.sprite.material.map.dispose();
      w.sprite.material.dispose();
    }
    words.length = 0;
    for (const p of particles) {
      p.life = 0;
      p.mesh.visible = false;
    }
    for (const t of tracks) t.life = 0;
    for (const m of missiles) {
      m.mesh.removeFromParent();
      m.mesh.traverse(o => o.geometry?.dispose());
    }
    missiles.length = 0;
    shake = 0;
  }
  return {
    event,
    update,
    reset,
    burst,
    word,
    ring,
    get shake() {
      return shake;
    }
  };
}
