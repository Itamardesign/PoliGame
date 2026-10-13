// Sound. Recorded effects, engine loops and a Hebrew announcer come from dist/assets/sfx/ (made with
// ElevenLabs by `npm run sfx`, listed in manifest.json). Anything missing falls back to synthesis:
// cue blips, a layered engine with gear changes, tyre screech and boost whoosh. The race music is
// always procedural, in a Middle-Eastern mode.
const SFX_DIR = 'assets/sfx/';
const clamp01 = v => Math.min(1, Math.max(0, v));
const midi = n => 440 * 2 ** ((n - 69) / 12);
// Phrygian dominant on E (the "Hijaz" colour): E F G# A B C D.
const SCALE = [0, 1, 4, 5, 7, 8, 10];
const BASS = [0, 0, 7, 0, 1, 0, 4, 1];
const ARP = [0, 2, 4, 6, 4, 2, 3, 1];

export function makeAudio() {
  let ctx = null,
    master,
    sfx,
    musicBus,
    engine = null,
    noiseBuffer,
    musicOn = true,
    enabled = false,
    voiceOn = false,
    nextBeat = 0,
    step = 0,
    intensity = 0,
    samples = {},
    clips = {},
    speaking = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      ctx = new AudioContext();
    } catch {
      return false;
    }
    master = ctx.createGain();
    master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp);
    comp.connect(ctx.destination);
    sfx = ctx.createGain();
    sfx.gain.value = 1;
    sfx.connect(master);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0;
    musicBus.connect(master);
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    loadSamples();
    return true;
  }

  // Recorded sounds load in the background; until each one arrives, its synthesized stand-in plays.
  async function loadSamples() {
    let manifest;
    try {
      const res = await fetch(SFX_DIR + 'manifest.json', { cache: 'no-cache' });
      if (!res.ok) return;
      manifest = await res.json();
    } catch {
      return;
    }
    const decode = file =>
      fetch(SFX_DIR + file)
        .then(r => (r.ok ? r.arrayBuffer() : Promise.reject()))
        .then(b => ctx.decodeAudioData(b))
        .catch(() => null);
    await Promise.all([
      ...Object.entries(manifest.sfx ?? {}).map(async ([name, s]) => {
        const buffers = (await Promise.all(s.files.map(decode))).filter(Boolean);
        if (buffers.length) samples[name] = { buffers, volume: s.volume ?? 0.6, loop: !!s.loop };
      }),
      ...Object.entries(manifest.voice ?? {}).map(async ([text, file]) => {
        const b = await decode(file);
        if (b) clips[text] = b;
      })
    ]);
  }

  // One-shot sample with a touch of pitch variation. False if it isn't loaded (caller falls back).
  function play(name, { rate = 1, volume = 1, vary = 0.05 } = {}) {
    const s = samples[name];
    if (!s || !enabled || !ensure()) return false;
    const src = ctx.createBufferSource(),
      g = ctx.createGain();
    src.buffer = s.buffers[(Math.random() * s.buffers.length) | 0];
    src.playbackRate.value = rate * (1 + (Math.random() * 2 - 1) * vary);
    g.gain.value = s.volume * volume;
    src.connect(g);
    g.connect(sfx);
    src.start();
    return true;
  }

  function loopVoice(name) {
    const s = samples[name];
    if (!s) return null;
    const src = ctx.createBufferSource(),
      g = ctx.createGain();
    src.buffer = s.buffers[0];
    src.loop = true;
    g.gain.value = 0;
    src.connect(g);
    g.connect(sfx);
    src.start(ctx.currentTime, Math.random() * s.buffers[0].duration);
    return { src, g, volume: s.volume };
  }
  // Recorded engine: a low and a high loop, crossfaded and pitched with revs, plus screech, boost
  // and the crowd along the barriers.
  function buildSampledEngine() {
    if (!samples['engine-low'] || !samples['engine-high']) return null;
    return {
      low: loopVoice('engine-low'),
      high: loopVoice('engine-high'),
      screech: loopVoice('screech'),
      boost: loopVoice('boost-loop'),
      crowd: loopVoice('crowd')
    };
  }
  const fade = (v, level, now, tc = 0.08) => v && v.g.gain.setTargetAtTime(level * v.volume, now, tc);
  const noise = () => {
    const n = ctx.createBufferSource();
    n.buffer = noiseBuffer;
    n.loop = true;
    return n;
  };

  function tone(freq = 500, duration = 0.12, type = 'triangle', volume = 0.05) {
    if (!enabled || !ensure()) return;
    const o = ctx.createOscillator(),
      g = ctx.createGain(),
      t = ctx.currentTime;
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.65, t + duration);
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    o.connect(g);
    g.connect(sfx);
    o.start(t);
    o.stop(t + duration + 0.02);
  }

  // Engine: two detuned saws and a sub, through a lowpass that opens with revs, plus filtered
  // noise for grit. Revs climb through four gears and drop at each change.
  function buildEngine() {
    const out = ctx.createGain();
    out.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 2;
    filter.connect(out);
    out.connect(sfx);
    const oscs = [
      ['sawtooth', 1, 0.5],
      ['sawtooth', 1.007, 0.4],
      ['sine', 0.5, 0.7]
    ].map(([type, ratio, vol]) => {
      const o = ctx.createOscillator(),
        g = ctx.createGain();
      o.type = type;
      g.gain.value = vol;
      o.connect(g);
      g.connect(filter);
      o.start();
      return { o, ratio };
    });
    const grit = noise(),
      gritFilter = ctx.createBiquadFilter(),
      gritGain = ctx.createGain();
    gritFilter.type = 'bandpass';
    gritFilter.frequency.value = 900;
    gritGain.gain.value = 0.05;
    grit.connect(gritFilter);
    gritFilter.connect(gritGain);
    gritGain.connect(filter);
    grit.start();
    // Tyre screech: band-passed noise that swells while drifting.
    const screech = noise(),
      sf = ctx.createBiquadFilter(),
      sg = ctx.createGain();
    sf.type = 'bandpass';
    sf.frequency.value = 2400;
    sf.Q.value = 6;
    sg.gain.value = 0;
    screech.connect(sf);
    sf.connect(sg);
    sg.connect(sfx);
    screech.start();
    // Boost whoosh: high-passed noise.
    const whoosh = noise(),
      wf = ctx.createBiquadFilter(),
      wg = ctx.createGain();
    wf.type = 'highpass';
    wf.frequency.value = 1800;
    wg.gain.value = 0;
    whoosh.connect(wf);
    wf.connect(wg);
    wg.connect(sfx);
    whoosh.start();
    return { out, filter, oscs, screech: sg, whoosh: wg, wf };
  }

  // Music: kick, hats, bass ostinato and, on the last lap, an arpeggio over the top.
  function scheduleMusic(bpm) {
    const beat = 60 / bpm / 2;
    while (nextBeat < ctx.currentTime + 0.2) {
      const t = nextBeat,
        s = step % 16;
      if (s % 4 === 0) kick(t);
      if (s % 2 === 1) hat(t, s % 4 === 3 ? 0.05 : 0.03);
      if (s % 2 === 0) bass(t, BASS[(s / 2) % BASS.length], beat * 1.8);
      if (intensity > 0.5) arp(t, ARP[s % ARP.length], beat * 0.9);
      if (s === 8 && step % 32 === 8) snareRoll(t, beat);
      nextBeat += beat;
      step++;
    }
  }
  const voice = (type, f, t, len, vol, dest = musicBus) => {
    const o = ctx.createOscillator(),
      g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + len + 0.02);
    return o;
  };
  function kick(t) {
    const o = voice('sine', 150, t, 0.28, 0.5);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.22);
  }
  function hat(t, vol) {
    const n = noise(),
      f = ctx.createBiquadFilter(),
      g = ctx.createGain();
    f.type = 'highpass';
    f.frequency.value = 7000;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    n.connect(f);
    f.connect(g);
    g.connect(musicBus);
    n.start(t);
    n.stop(t + 0.06);
  }
  function snareRoll(t, beat) {
    for (let i = 0; i < 4; i++) {
      const n = noise(),
        f = ctx.createBiquadFilter(),
        g = ctx.createGain(),
        at = t + i * beat * 0.5;
      f.type = 'bandpass';
      f.frequency.value = 1800;
      g.gain.setValueAtTime(0.08, at);
      g.gain.exponentialRampToValueAtTime(0.001, at + 0.12);
      n.connect(f);
      f.connect(g);
      g.connect(musicBus);
      n.start(at);
      n.stop(at + 0.13);
    }
  }
  function bass(t, degree, len) {
    const f = midi(40 + SCALE[degree % 7]);
    const o = ctx.createOscillator(),
      lp = ctx.createBiquadFilter(),
      g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.value = f;
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(600, t);
    lp.frequency.exponentialRampToValueAtTime(160, t + len);
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    o.connect(lp);
    lp.connect(g);
    g.connect(musicBus);
    o.start(t);
    o.stop(t + len + 0.02);
  }
  function arp(t, degree, len) {
    voice('triangle', midi(64 + SCALE[degree % 7] + (degree >= 7 ? 12 : 0)), t, len, 0.06);
  }

  return {
    get enabled() {
      return enabled;
    },
    setEnabled(on) {
      enabled = on;
      if (on) ensure();
      if (!on && ctx) {
        musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
        if (engine) engine.out.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
        if (engine?.rec) for (const v of Object.values(engine.rec)) fade(v, 0, ctx.currentTime, 0.05);
        speaking?.stop();
      }
      if (!on) speechSynthesis?.cancel?.();
    },
    setMusic(on) {
      musicOn = on;
    },
    setVoice(on) {
      voiceOn = on;
    },
    hasHebrewVoice: () =>
      Object.keys(clips).length > 0 ||
      (typeof speechSynthesis !== 'undefined' &&
        speechSynthesis.getVoices().some(v => v.lang?.startsWith('he'))),
    tone,
    play,
    // A named sound, or the synthesized blip while it isn't loaded: cue('hit', [130, 0.24, 'sawtooth']).
    cue(name, fallback = [], opts) {
      if (!play(name, opts)) tone(...fallback);
    },
    // Per frame: engine note from the player's kart, music while racing.
    update(dt, { racing, player, lastLap, menu }) {
      if (!enabled || !ctx) return;
      const now = ctx.currentTime;
      engine ??= buildEngine();
      // Swap the synth engine for the recorded one as soon as its loops have loaded.
      if (!engine.rec && (engine.rec = buildSampledEngine())) {
        engine.out.gain.setTargetAtTime(0, now, 0.05);
        engine.screech.gain.setTargetAtTime(0, now, 0.05);
        engine.whoosh.gain.setTargetAtTime(0, now, 0.05);
      }
      const rec = engine.rec;
      if (racing && player) {
        const speed = Math.max(0, player.speed),
          gearTop = [14, 24, 34, 44, 99],
          gear = gearTop.findIndex(top => speed < top),
          lo = gear ? gearTop[gear - 1] : 0,
          rpm = (speed - lo) / (gearTop[gear] - lo || 1),
          boosting = player.boost > 0,
          drifting = player.drifting && player.air <= 0;
        if (rec) {
          // Each gear sweeps the loops' pitch up, then the change drops it back.
          const mix = clamp01((gear + rpm) / 3.2),
            rate = 0.72 + rpm * 0.55 + gear * 0.04 + (boosting ? 0.12 : 0) + (player.air > 0 ? 0.1 : 0);
          rec.low.src.playbackRate.setTargetAtTime(rate * 1.1, now, 0.06);
          rec.high.src.playbackRate.setTargetAtTime(rate * 0.8, now, 0.06);
          fade(rec.low, Math.cos((mix * Math.PI) / 2) * 0.9 + 0.1, now);
          fade(rec.high, Math.sin((mix * Math.PI) / 2) * (0.75 + rpm * 0.25), now);
          fade(rec.screech, drifting ? 1 : 0, now, 0.05);
          rec.screech?.src.playbackRate.setTargetAtTime(0.9 + rpm * 0.2, now, 0.1);
          fade(rec.boost, boosting ? 1 : 0, now, 0.1);
          fade(rec.crowd, 1, now, 0.6);
        } else {
          const f = 48 + gear * 6 + rpm * 46 + (boosting ? 10 : 0);
          for (const { o, ratio } of engine.oscs) o.frequency.setTargetAtTime(f * ratio, now, 0.05);
          engine.filter.frequency.setTargetAtTime(300 + rpm * 900 + (boosting ? 600 : 0), now, 0.08);
          engine.out.gain.setTargetAtTime(0.05 + rpm * 0.03, now, 0.08);
          engine.screech.gain.setTargetAtTime(drifting ? 0.035 : 0, now, 0.06);
          engine.whoosh.gain.setTargetAtTime(boosting ? 0.05 : 0, now, 0.1);
        }
      } else {
        engine.out.gain.setTargetAtTime(0, now, 0.2);
        engine.screech.gain.setTargetAtTime(0, now, 0.1);
        engine.whoosh.gain.setTargetAtTime(0, now, 0.1);
        if (rec) for (const v of Object.values(rec)) fade(v, 0, now, v === rec.crowd ? 0.8 : 0.2);
      }
      intensity += ((lastLap ? 1 : 0) - intensity) * Math.min(1, dt * 0.8);
      const wantMusic = musicOn && (racing || menu);
      // The music ducks under the announcer.
      musicBus.gain.setTargetAtTime(wantMusic ? (speaking ? 0.08 : menu ? 0.18 : 0.26) : 0, now, speaking ? 0.08 : 0.4);
      if (wantMusic) {
        if (nextBeat < now) nextBeat = now + 0.05;
        scheduleMusic(menu ? 104 : lastLap ? 138 : 128);
      }
    },
    // Short Hebrew lines for the big moments: the recorded announcer, else the browser's Hebrew voice
    // (only for lines marked important, so a robot voice doesn't chatter over every trick).
    say(text, { important = true } = {}) {
      if (!enabled || !voiceOn) return;
      const clip = clips[text];
      if (clip && ensure()) {
        speaking?.stop();
        const src = ctx.createBufferSource(),
          g = ctx.createGain();
        src.buffer = clip;
        g.gain.value = 1.1;
        src.connect(g);
        g.connect(master);
        src.onended = () => speaking === src && (speaking = null);
        src.start();
        speaking = src;
        return;
      }
      if (!important || typeof speechSynthesis === 'undefined') return;
      const v = speechSynthesis.getVoices().find(v => v.lang?.startsWith('he'));
      if (!v) return;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.voice = v;
      u.lang = v.lang;
      u.rate = 1.12;
      u.pitch = 1.05;
      u.volume = 0.9;
      speechSynthesis.speak(u);
    }
  };
}
