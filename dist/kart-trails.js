// Tyre smoke, off-road dust, drift sparks and boost exhaust for every kart, drawn as one point cloud.
import * as T from './vendor/three.module.min.js';

const MAX = 900;
const SPARK = ['#7fe9ff', '#ffb14a', '#ee8dff'];

function softDot() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d'),
    g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  return t;
}

export function makeTrails(scene, reduced) {
  const position = new Float32Array(MAX * 3),
    color = new Float32Array(MAX * 3),
    size = new Float32Array(MAX),
    alpha = new Float32Array(MAX);
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(position, 3).setUsage(T.DynamicDrawUsage));
  geo.setAttribute('color', new T.BufferAttribute(color, 3).setUsage(T.DynamicDrawUsage));
  geo.setAttribute('size', new T.BufferAttribute(size, 1).setUsage(T.DynamicDrawUsage));
  geo.setAttribute('alpha', new T.BufferAttribute(alpha, 1).setUsage(T.DynamicDrawUsage));
  const material = new T.ShaderMaterial({
    uniforms: { map: { value: softDot() }, scale: { value: 600 } },
    vertexShader: `attribute float size; attribute float alpha; attribute vec3 color;
      varying float vAlpha; varying vec3 vColor;
      uniform float scale;
      void main(){ vAlpha = alpha; vColor = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D map; varying float vAlpha; varying vec3 vColor;
      void main(){ vec4 t = texture2D(map, gl_PointCoord); if (t.a * vAlpha < 0.01) discard;
        gl_FragColor = vec4(vColor, t.a * vAlpha); }`,
    transparent: true,
    depthWrite: false
  });
  const points = new T.Points(geo, material);
  points.frustumCulled = false;
  points.renderOrder = 3;
  scene.add(points);

  const parts = Array.from({ length: MAX }, () => ({
    life: 0,
    total: 1,
    v: new T.Vector3(),
    grow: 0,
    a0: 1,
    s0: 1,
    drag: 0,
    gravity: 0
  }));
  let cursor = 0;
  const tmpColor = new T.Color();
  function emit(
    at,
    vx,
    vy,
    vz,
    { life = 0.8, size: s = 1, grow = 2, alpha: a = 0.5, tint = '#ffffff', drag = 1.5, gravity = -0.4 } = {}
  ) {
    const i = cursor++ % MAX,
      p = parts[i];
    p.life = p.total = life;
    p.v.set(vx, vy, vz);
    p.grow = grow;
    p.a0 = a;
    p.s0 = s;
    p.drag = drag;
    p.gravity = gravity;
    position.set([at.x, at.y, at.z], i * 3);
    tmpColor.set(tint);
    color.set([tmpColor.r, tmpColor.g, tmpColor.b], i * 3);
    size[i] = s;
    alpha[i] = a;
  }

  const clocks = new Map(),
    local = new T.Vector3(),
    back = new T.Vector3();
  // Called once per frame for each kart near the camera.
  function kartTrail(kart, r, dt, offroad, near) {
    if (reduced || !near) return;
    const clock = (clocks.get(r.id) ?? 0) + dt;
    const spacing = 0.03;
    if (clock < spacing) return void clocks.set(r.id, clock);
    clocks.set(r.id, 0);
    const base = kart.userData.wheelBase,
      airborne = r.air > 0;
    back.set(0, 0, -1).applyQuaternion(kart.quaternion);
    for (const side of [-1, 1]) {
      local.set(side * base.track, 0.15, base.rear - 0.1);
      const at = kart.localToWorld(local.clone());
      if (r.drifting && !airborne) {
        // Grey tyre smoke rolling off the rear wheels, plus sparks coloured by charge tier.
        emit(at, back.x * 2 + side * 0.8, 1.2, back.z * 2, {
          life: 0.9,
          size: 1.1,
          grow: 3.2,
          alpha: 0.32,
          tint: '#e7e4dc'
        });
        if (r.charge > 0.25) {
          const tier = r.charge > 2.4 ? 2 : r.charge > 1.6 ? 1 : 0;
          for (let k = 0; k < 2; k++)
            emit(
              at,
              back.x * 4 + side * 2.5 * Math.random(),
              1.5 + Math.random() * 2.5,
              back.z * 4 + (Math.random() - 0.5) * 3,
              {
                life: 0.32,
                size: 0.32,
                grow: -0.6,
                alpha: 1,
                tint: SPARK[tier],
                drag: 0.5,
                gravity: -9
              }
            );
        }
      } else if (offroad && r.speed > 10 && !airborne) {
        emit(at, back.x * 3, 1.4, back.z * 3, {
          life: 1.1,
          size: 1,
          grow: 2.6,
          alpha: 0.36,
          tint: '#c9b48a'
        });
      }
    }
    if (r.boost > 0) {
      local.set(0, 0.7, base.rear - 0.5);
      const at = kart.localToWorld(local.clone());
      emit(at, back.x * 6, 0.6, back.z * 6, {
        life: 0.35,
        size: 0.9,
        grow: 1.5,
        alpha: 0.55,
        tint: '#9fefff',
        drag: 3
      });
    }
  }

  // A ring of dust where a kart lands, or a puff where it is hit.
  function puff(at, tint = '#d8ccb0', count = 14, strength = 4) {
    if (reduced) count = Math.min(4, count);
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2;
      emit(at, Math.cos(ang) * strength, 0.8 + Math.random(), Math.sin(ang) * strength, {
        life: 0.8,
        size: 1.2,
        grow: 2.4,
        alpha: 0.4,
        tint,
        drag: 3
      });
    }
  }

  function update(dt) {
    for (let i = 0; i < MAX; i++) {
      const p = parts[i];
      if (p.life <= 0) {
        alpha[i] = 0;
        continue;
      }
      p.life -= dt;
      const k = Math.max(0, p.life / p.total);
      p.v.multiplyScalar(Math.max(0, 1 - p.drag * dt));
      p.v.y += p.gravity * dt;
      position[i * 3] += p.v.x * dt;
      position[i * 3 + 1] += p.v.y * dt;
      position[i * 3 + 2] += p.v.z * dt;
      size[i] = Math.max(0.02, p.s0 + p.grow * (1 - k));
      alpha[i] = p.a0 * k;
    }
    for (const name of ['position', 'size', 'alpha', 'color']) geo.getAttribute(name).needsUpdate = true;
  }
  function reset() {
    for (const p of parts) p.life = 0;
    alpha.fill(0);
  }
  function resize(height) {
    material.uniforms.scale.value = height * 0.75;
  }
  return { kartTrail, puff, update, reset, resize };
}
