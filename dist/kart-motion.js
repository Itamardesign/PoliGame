// Per-frame kart animation: a sprung body over the wheels, a drift slide, steering front wheels,
// weighty hits, varied air tricks, a driver who leans with the car and flags that ripple.
import * as T from './vendor/three.module.min.js';

const TAU = Math.PI * 2;
const TRICKS = ['spin', 'flip', 'roll'];
const easeOut = x => 1 - (1 - x) ** 3;

// Damped spring step (semi-implicit Euler); stiffness k, damping d.
function spring(a, key, target, k, d, dt) {
  const v = key + 'V';
  a[v] += (k * (target - a[key]) - d * a[v]) * dt;
  a[key] += a[v] * dt;
}

function motionState(kart) {
  return (kart.userData.anim ??= {
    pitch: 0,
    pitchV: 0,
    roll: 0,
    rollV: 0,
    heave: 0,
    heaveV: 0,
    squash: 0,
    squashV: 0,
    slide: 0,
    slideV: 0,
    lastSpeed: 0,
    wasAir: false,
    stunStart: -1,
    spinDir: 1,
    trick: 'spin',
    jumpCount: 0
  });
}

export function resetMotion(kart) {
  delete kart.userData.anim;
}

const forward = new T.Vector3(),
  euler = new T.Euler(0, 0, 0, 'YXZ');

// frame: { p, t } road frame for the racer. ctx: { elapsed, reduced, camera }.
export function animateKart(kart, r, frame, dt, ctx) {
  const a = motionState(kart),
    body = kart.userData.body,
    { p, t } = frame,
    reduced = ctx.reduced,
    calm = reduced ? 0 : 1;
  dt = Math.max(dt, 1e-4);

  // Suspension targets: pitch from acceleration, roll from steering and sideways speed.
  const accel = (r.speed - a.lastSpeed) / dt;
  a.lastSpeed = r.speed;
  const airborne = r.air > 0;
  spring(a, 'pitch', airborne ? -0.06 : Math.max(-0.11, Math.min(0.09, -accel * 0.0045)), 160, 13, dt);
  const rollTarget = airborne ? 0 : -(r.steer * 0.075 + r.lateral * 0.0045) * (r.drifting ? 1.5 : 1);
  spring(a, 'roll', rollTarget, 140, 11, dt);
  if (a.wasAir && !airborne) {
    // Landing: the body drops onto its springs and squashes.
    a.heaveV -= 2.6;
    a.squashV += 2.2;
  }
  if (r.hop > 0.2 && a.heave > -0.01) a.heaveV += 1.2;
  a.wasAir = airborne;
  spring(a, 'heave', 0, 170, 12, dt);
  spring(a, 'squash', 0, 210, 13, dt);

  // Drift slide: the nose swings into the corner and holds an angle while the drift charges.
  const slideTarget = r.drifting ? -r.steer * 0.5 - Math.sign(r.steer) * 0.12 : -r.steer * 0.13;
  spring(a, 'slide', slideTarget, 90, 15, dt);

  // Hits: a full spin with a hop that settles.
  if (r.stun > 0 && a.stunStart < 0) {
    a.stunStart = ctx.elapsed;
    a.spinDir = r.lateral >= 0 ? 1 : -1;
    a.heaveV += 3.4;
  }
  if (r.stun <= 0) a.stunStart = -1;
  const spinT = a.stunStart >= 0 ? Math.min(1, (ctx.elapsed - a.stunStart) / 1.15) : 1;
  const spin = a.stunStart >= 0 ? easeOut(spinT) * TAU * a.spinDir * calm : 0;

  // Tricks: alternate between a spin, a backflip and a barrel roll.
  if (airborne && r.trick && a.jumpCount === 0) {
    a.trick = TRICKS[(r.id + Math.floor(ctx.elapsed)) % TRICKS.length];
    a.jumpCount = 1;
  }
  if (!airborne) a.jumpCount = 0;
  const trickT = airborne && r.trick ? easeOut(Math.min(1, (1 - r.air / r.airTotal) * 1.25)) : 0;
  const trick = trickT * TAU * calm;

  // Place the root on the road, then lift it for jumps.
  kart.position.copy(p);
  const jump = airborne ? Math.sin((1 - r.air / r.airTotal) * Math.PI) * 3.2 : 0;
  kart.position.y += jump;
  forward.copy(t);
  euler.set(
    Math.atan2(-t.y, Math.hypot(t.x, t.z)) + (a.trick === 'flip' ? -trick : 0),
    Math.atan2(t.x, t.z) + a.slide + spin + (a.trick === 'spin' ? trick : 0),
    a.trick === 'roll' ? trick : 0
  );
  kart.quaternion.setFromEuler(euler);

  // Sprung body.
  body.rotation.set(a.pitch * calm, 0, a.roll * calm);
  body.position.y = (a.heave + Math.sin(ctx.elapsed * 17 + r.id) * 0.012) * calm;
  const sq = Math.max(-0.12, Math.min(0.16, a.squash)) * calm;
  body.scale.set(1 + sq * 0.45, 1 - sq, 1 + sq * 0.45);

  // Wheels roll with distance; the front pair steers (and counter-steers in a drift).
  const roll = r.speed * dt * 2.1;
  for (const w of kart.userData.wheels) w.rotation.x += roll;
  const wheelAngle = r.drifting ? r.steer * 0.32 : -r.steer * 0.42;
  for (const pivot of kart.userData.steerPivots)
    pivot.rotation.y += (wheelAngle - pivot.rotation.y) * Math.min(1, dt * 18);

  // Driver leans into the corner and is pressed back by a boost.
  const driver = kart.userData.driver;
  if (driver) {
    const leanTarget = -a.roll * 1.6 + (r.stun > 0 ? Math.sin(ctx.elapsed * 22) * 0.12 : 0);
    driver.rotation.z += (leanTarget * calm - driver.rotation.z) * Math.min(1, dt * 10);
    driver.rotation.x += ((r.boost > 0 ? -0.1 : 0) * calm - driver.rotation.x) * Math.min(1, dt * 8);
  }
  const head = kart.userData.head;
  head.rotation.z = reduced ? 0 : Math.sin(ctx.elapsed * 4 + r.id) * 0.03 - r.steer * 0.06;
  head.rotation.y = -r.steer * 0.2 + (r.player ? 0 : Math.sin(ctx.elapsed * 0.8 + r.id) * 0.06);
  for (const eye of kart.userData.eyes) eye.scale.y = (ctx.elapsed + r.id * 0.7) % 4.7 < 0.13 ? 0.12 : 1;

  // Flags ripple from the pole, harder at speed.
  if (!reduced) {
    const amp = 0.025 + Math.min(r.speed, 45) * 0.0016;
    for (const flag of kart.userData.flags) {
      const pos = flag.geometry.getAttribute('position'),
        rest = flag.userData.rest,
        w = flag.geometry.parameters.width;
      for (let i = 0; i < pos.count; i++) {
        const x = rest[i * 3],
          u = (x + w / 2) / w;
        pos.array[i * 3 + 2] =
          rest[i * 3 + 2] + Math.sin(ctx.elapsed * (7 + r.speed * 0.12) - u * 5.5) * amp * u;
      }
      pos.needsUpdate = true;
    }
  }

  // Boost flames flicker and stretch with the remaining boost.
  for (const f of kart.userData.flames) {
    f.visible = r.boost > 0;
    f.scale.y = (0.8 + Math.min(r.boost, 2) * 0.35) * (1 + Math.sin(ctx.elapsed * 37 + f.position.x) * 0.22);
  }
}
