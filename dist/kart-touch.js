// Touch driving, designed like a phone kart game:
// - drag anywhere in the steering zone: a stick appears under the thumb and steering is analog;
// - steer hard and hold it to start a drift (auto-drift), straighten up to fire the boost;
// - pull the stick down to brake; throttle is always on;
// - a quick tap in the zone uses the item;
// - optional tilt steering and the old arrow buttons as alternatives.
const RADIUS = 58,
  DEAD = 6;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export function makeTouchControls({ zone, stick, hint, onTap, onDown, haptic }) {
  let mode = 'drag',
    autoDrift = true,
    pointer = null,
    ox = 0,
    oy = 0,
    dx = 0,
    dy = 0,
    downAt = 0,
    moved = 0,
    tilt = 0,
    tiltZero = null,
    hardFor = 0,
    autoDrifting = false,
    lastTier = 0;
  const knob = stick.querySelector('.stick-knob');

  function place(x, y) {
    const r = zone.getBoundingClientRect();
    stick.style.left = x - r.left + 'px';
    stick.style.top = y - r.top + 'px';
  }
  function draw() {
    const d = Math.hypot(dx, dy),
      k = d > RADIUS ? RADIUS / d : 1;
    knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  }
  zone.addEventListener('pointerdown', e => {
    if (mode !== 'drag' && mode !== 'tilt') return;
    e.preventDefault();
    if (pointer !== null) return;
    pointer = e.pointerId;
    zone.setPointerCapture(e.pointerId);
    ox = e.clientX;
    oy = e.clientY;
    dx = dy = moved = 0;
    downAt = performance.now();
    if (mode === 'drag') {
      place(ox, oy);
      stick.classList.remove('hidden');
      draw();
    }
    hint.classList.add('hidden');
    onDown?.();
  });
  zone.addEventListener('pointermove', e => {
    if (e.pointerId !== pointer) return;
    // The stick follows a thumb that wanders too far, so steering never runs out of room.
    let nx = e.clientX - ox,
      ny = e.clientY - oy;
    const d = Math.hypot(nx, ny);
    if (d > RADIUS * 1.6) {
      const pull = (d - RADIUS * 1.6) / d;
      ox += nx * pull;
      oy += ny * pull;
      nx = e.clientX - ox;
      ny = e.clientY - oy;
      if (mode === 'drag') place(ox, oy);
    }
    dx = nx;
    dy = ny;
    moved = Math.max(moved, Math.hypot(dx, dy));
    if (mode === 'drag') draw();
  });
  const end = e => {
    if (e.pointerId !== pointer) return;
    // A quick, still tap fires the item.
    if (performance.now() - downAt < 200 && moved < 10) onTap?.();
    pointer = null;
    dx = dy = 0;
    stick.classList.add('hidden');
  };
  zone.addEventListener('pointerup', end);
  zone.addEventListener('pointercancel', end);
  zone.addEventListener('lostpointercapture', end);

  function onOrientation(e) {
    // Hold the phone like a wheel: in landscape the beta axis turns it, in portrait gamma.
    const angle = screen.orientation?.angle ?? window.orientation ?? 0,
      landscape = Math.abs(angle) === 90 || angle === 270;
    const raw = landscape ? (angle === 90 ? e.beta : -e.beta) : e.gamma;
    if (raw == null) return;
    tiltZero ??= raw;
    tilt = clamp((raw - tiltZero) / 22, -1, 1);
  }

  return {
    get mode() {
      return mode;
    },
    async setMode(next) {
      mode = next;
      zone.classList.toggle('buttons-mode', next === 'buttons');
      if (next === 'tilt') {
        // iOS asks for permission; it must come from a tap.
        try {
          if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
            const answer = await DeviceOrientationEvent.requestPermission();
            if (answer !== 'granted') return false;
          }
        } catch {
          return false;
        }
        addEventListener('deviceorientation', onOrientation);
      } else removeEventListener('deviceorientation', onOrientation);
      return true;
    },
    setAutoDrift(on) {
      autoDrift = on;
    },
    // Re-centre tilt and clear the stick for a new race.
    reset() {
      tiltZero = null;
      tilt = 0;
      pointer = null;
      dx = dy = 0;
      hardFor = 0;
      autoDrifting = false;
      lastTier = 0;
      stick.classList.add('hidden');
      hint.classList.remove('hidden');
    },
    // Input for this frame. `buttons` holds the old on-screen buttons and the drift button.
    read(dt, player, buttons) {
      let steer = 0,
        brake = false;
      if (mode === 'drag' && pointer !== null) {
        const x = Math.abs(dx) < DEAD ? 0 : dx - Math.sign(dx) * DEAD;
        steer = clamp(x / (RADIUS - DEAD), -1, 1);
        brake = dy > RADIUS * 0.9 && Math.abs(dx) < RADIUS * 0.8;
      } else if (mode === 'tilt') steer = tilt;
      else steer = Number(buttons.right) - Number(buttons.left);
      // Auto-drift: a hard steer held for a moment at speed starts a drift; easing off ends it.
      if (autoDrift && mode !== 'buttons' && player) {
        if (Math.abs(steer) > 0.78 && player.speed > 22 && player.air <= 0) hardFor += dt;
        else if (Math.abs(steer) < 0.32) hardFor = 0;
        if (!autoDrifting && hardFor > 0.16) autoDrifting = true;
        if (autoDrifting && (Math.abs(steer) < 0.32 || player.stun > 0)) autoDrifting = false;
      } else autoDrifting = false;
      // The stick shows the drift charge, and the phone ticks as each tier is reached.
      const tier = player?.drifting
        ? player.charge > 2.4
          ? 3
          : player.charge > 1.6
            ? 2
            : player.charge > 0.65
              ? 1
              : 0
        : 0;
      if (tier !== lastTier) {
        stick.dataset.tier = tier;
        if (tier > lastTier) haptic?.(8 + tier * 6);
        lastTier = tier;
      }
      return { steer, brake, drift: buttons.drift || autoDrifting, accelerate: true };
    }
  };
}
