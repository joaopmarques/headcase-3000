// Synthesized nonsense noises. No audio files, only Web Audio and bad decisions.
let ctx, master, noiseBuf, voiceBus, outBus, tap;
let muted = false;

function ac() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.55;
    // The mimic voice skips the sfx mute and the compressor (it pumps on speech).
    voiceBus = ctx.createGain();
    voiceBus.gain.value = 1;
    outBus = ctx.createDynamicsCompressor();
    master.connect(outBus);
    outBus.connect(ctx.destination);
    voiceBus.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.55;
}
export const isMuted = () => muted;

function env(g, t0, attack, peak, dur) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
}

function noise() {
  const c = ac();
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  return s;
}

function tone(type, freqs, dur, vol = 0.3, { attack = 0.005, when = 0, dest } = {}) {
  const c = ac(), t = c.currentTime + when;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freqs[0], t);
  for (let i = 1; i < freqs.length; i++) {
    o.frequency.exponentialRampToValueAtTime(freqs[i], t + (dur * i) / (freqs.length - 1));
  }
  env(g, t, attack, vol, dur);
  o.connect(g).connect(dest ?? master);
  o.start(t);
  o.stop(t + dur + 0.05);
  return o;
}

function burst(dur, vol, { type = 'bandpass', f0 = 1000, f1 = f0, q = 1, when = 0 } = {}) {
  const c = ac(), t = c.currentTime + when;
  const s = noise(), f = c.createBiquadFilter(), g = c.createGain();
  f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  env(g, t, 0.003, vol, dur);
  s.connect(f).connect(g).connect(master);
  s.start(t);
  s.stop(t + dur + 0.05);
}

const rnd = (a, b) => a + Math.random() * (b - a);

export function boing(p = 1) {
  const c = ac(), t = c.currentTime;
  const o = c.createOscillator(), g = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(110 * p, t);
  o.frequency.exponentialRampToValueAtTime(480 * p, t + 0.07);
  o.frequency.exponentialRampToValueAtTime(150 * p, t + 0.6);
  const lfo = c.createOscillator(), lg = c.createGain();
  lfo.frequency.value = 24;
  lg.gain.setValueAtTime(70 * p, t);
  lg.gain.exponentialRampToValueAtTime(1, t + 0.6);
  lfo.connect(lg).connect(o.frequency);
  env(g, t, 0.01, 0.45, 0.65);
  o.connect(g).connect(master);
  o.start(t); lfo.start(t);
  o.stop(t + 0.7); lfo.stop(t + 0.7);
}

export function honk() {
  tone('sawtooth', [420, 380], 0.25, 0.25);
  tone('square', [425, 385], 0.25, 0.12);
}

export function squeak(p = 1) {
  const c = ac(), t = c.currentTime;
  const o = c.createOscillator(), g = c.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(700 * p, t);
  o.frequency.exponentialRampToValueAtTime(1300 * p, t + 0.12);
  const lfo = c.createOscillator(), lg = c.createGain();
  lfo.frequency.value = 38; lg.gain.value = 80 * p;
  lfo.connect(lg).connect(o.frequency);
  env(g, t, 0.01, 0.22, 0.16);
  o.connect(g).connect(master);
  o.start(t); lfo.start(t); o.stop(t + 0.2); lfo.stop(t + 0.2);
}

export function pop() {
  burst(0.25, 0.9, { type: 'lowpass', f0: 6000, f1: 200 });
  tone('sine', [160, 35], 0.3, 0.8);
}

export function slap() {
  burst(0.14, 0.9, { type: 'bandpass', f0: 2200, f1: 900, q: 0.7 });
  tone('sine', [220, 70], 0.12, 0.5);
}

export function bonk() {
  tone('sine', [340, 70], 0.35, 0.7);
  tone('square', [900, 600], 0.06, 0.12);
  burst(0.08, 0.4, { type: 'highpass', f0: 3000 });
}

export function thwap() {
  burst(0.1, 0.6, { type: 'bandpass', f0: 1200, f1: 400, q: 1.2 });
  tone('sine', [260, 60], 0.2, 0.4);
}

export function giggle() {
  const n = 3 + Math.floor(Math.random() * 3);
  const base = rnd(500, 750);
  for (let i = 0; i < n; i++) {
    tone('sine', [base * (1 + i * 0.05), base * 1.3 * (1 + i * 0.05)], 0.07, 0.2, { when: i * 0.09 });
  }
}

export function fart(dur = 0.8) {
  const c = ac(), t = c.currentTime;
  const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(95, t);
  for (let i = 1; i < 12; i++) o.frequency.linearRampToValueAtTime(rnd(55, 120), t + (dur * i) / 12);
  f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 6;
  env(g, t, 0.02, 0.5, dur);
  o.connect(f).connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}

export function whoosh(dur = 0.6) {
  burst(dur, 0.5, { type: 'bandpass', f0: 300, f1: 3000, q: 1.5 });
}

export function slideWhistle(up = true) {
  const f = up ? [300, 1400] : [1400, 250];
  tone('sine', f, 0.55, 0.3, { attack: 0.05 });
}

export function creak() {
  const c = ac(), t = c.currentTime;
  for (let i = 0; i < 10; i++) {
    tone('sawtooth', [rnd(90, 160), rnd(70, 120)], 0.05, 0.12, { when: i * 0.035 });
  }
  burst(0.35, 0.06, { type: 'bandpass', f0: 800, q: 8 });
  return t;
}

export function sizzle(dur = 1.5) {
  burst(dur, 0.25, { type: 'highpass', f0: 4000, f1: 2000 });
}

export function ding() {
  tone('sine', [1320, 1320], 0.8, 0.2);
  tone('sine', [1980, 1980], 0.5, 0.08);
}

export function sparkle() {
  for (let i = 0; i < 6; i++) tone('sine', [rnd(1500, 3000), rnd(2000, 4000)], 0.08, 0.08, { when: i * 0.05 });
}

export function scream() {
  const c = ac(), t = c.currentTime;
  const o = c.createOscillator(), g = c.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(300, t);
  o.frequency.linearRampToValueAtTime(700, t + 0.3);
  o.frequency.linearRampToValueAtTime(500, t + 1.2);
  const lfo = c.createOscillator(), lg = c.createGain();
  lfo.frequency.value = 9; lg.gain.value = 40;
  lfo.connect(lg).connect(o.frequency);
  const f = c.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 1;
  env(g, t, 0.05, 0.35, 1.3);
  o.connect(f).connect(g).connect(master);
  o.start(t); lfo.start(t); o.stop(t + 1.4); lfo.stop(t + 1.4);
}

// Rubber-band creak that follows the pinch stretch.
export function startStretch() {
  const c = ac();
  const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
  o.type = 'sawtooth'; o.frequency.value = 80;
  f.type = 'bandpass'; f.frequency.value = 600; f.Q.value = 5;
  g.gain.value = 0;
  o.connect(f).connect(g).connect(master);
  o.start();
  return {
    set(amount) {
      const t = c.currentTime;
      o.frequency.setTargetAtTime(70 + amount * 260, t, 0.03);
      f.frequency.setTargetAtTime(400 + amount * 1500, t, 0.03);
      g.gain.setTargetAtTime(Math.min(0.2, amount * 0.25), t, 0.03);
    },
    stop() {
      g.gain.setTargetAtTime(0, c.currentTime, 0.02);
      o.stop(c.currentTime + 0.2);
    },
  };
}

// Disco loop: four-on-the-floor with a bassline that has never heard of music theory.
let discoTimer = null;
export function startDisco(onBeat) {
  ac();
  let step = 0;
  const bass = [55, 55, 82.4, 55, 73.4, 55, 98, 82.4];
  const tick = () => {
    const s = step++;
    if (s % 2 === 0) {
      tone('sine', [150, 40], 0.18, 0.8);
      onBeat?.(s / 2);
    }
    burst(0.04, s % 2 ? 0.2 : 0.08, { type: 'highpass', f0: 8000 });
    tone('sawtooth', [bass[s % 8], bass[s % 8]], 0.18, 0.12);
  };
  tick();
  discoTimer = setInterval(tick, 250);
}
export function stopDisco() {
  clearInterval(discoTimer);
  discoTimer = null;
}
export const unlock = () => ac();
export const audioCtx = () => ac();
export const voiceOut = () => (ac(), voiceBus);
// A stream of everything the app plays, for clip recording.
export function tapStream() {
  const c = ac();
  if (!tap) {
    tap = c.createMediaStreamDestination();
    outBus.connect(tap);
    voiceBus.connect(tap);
  }
  return tap.stream;
}

// ---------- cartoon vocal grunts ----------
// A tiny formant synth: a buzzy source through two vowel filters. Instant, unlike TTS.
const VOWELS = {
  a: [800, 1200], o: [500, 850], u: [330, 750], e: [420, 2200], i: [300, 2500], ae: [650, 1700],
};

function vocal(parts, { pitch = 1, gravel = 0, vol = 0.5, when = 0 } = {}) {
  // parts: [{ v: 'a', f: [start, end], d: seconds }], played back to back.
  const c = ac();
  let t = c.currentTime + when;
  for (const p of parts) {
    const dur = p.d;
    const src = c.createOscillator();
    src.type = 'sawtooth';
    src.frequency.setValueAtTime(p.f[0] * pitch, t);
    src.frequency.exponentialRampToValueAtTime(Math.max(40, p.f[1] * pitch), t + dur);
    // Vibrato makes it sound alive instead of like a modem.
    const lfo = c.createOscillator(), lg = c.createGain();
    lfo.frequency.value = 6 + gravel * 30;
    lg.gain.value = p.f[0] * pitch * (0.03 + gravel * 0.12);
    lfo.connect(lg).connect(src.frequency);
    const g = c.createGain();
    env(g, t, 0.015, vol, dur);
    const [f1a, f2a] = VOWELS[p.v];
    const [f1b, f2b] = VOWELS[p.to ?? p.v];
    for (const [fa, fb, q, amp] of [[f1a, f1b, 6, 1], [f2a, f2b, 9, 0.6]]) {
      const bp = c.createBiquadFilter(), bg = c.createGain();
      bp.type = 'bandpass';
      bp.Q.value = q;
      bp.frequency.setValueAtTime(fa, t);
      bp.frequency.linearRampToValueAtTime(fb, t + dur);
      bg.gain.value = amp * 2.2;
      src.connect(bp).connect(bg).connect(g);
    }
    g.connect(master);
    src.start(t); lfo.start(t);
    src.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
    if (gravel > 0) burst(dur, vol * gravel * 0.25, { type: 'bandpass', f0: 900, q: 2, when: t - c.currentTime });
    t += dur + (p.gap ?? 0);
  }
}

// Each grunt: kind -> a few variants. Pitch is in Hz for a "normal" voice.
const GRUNTS = {
  ow: [
    [{ v: 'a', to: 'u', f: [380, 220], d: 0.32 }],
    [{ v: 'o', to: 'u', f: [420, 250], d: 0.25 }],
    [{ v: 'e', f: [520, 480], d: 0.08, gap: 0.03 }, { v: 'a', to: 'u', f: [460, 240], d: 0.28 }], // "hey-ow"
  ],
  oof: [
    [{ v: 'u', f: [260, 160], d: 0.16 }],
    [{ v: 'o', to: 'u', f: [240, 150], d: 0.2 }],
  ],
  yelp: [
    [{ v: 'i', f: [700, 950], d: 0.14 }],
    [{ v: 'e', to: 'i', f: [650, 1000], d: 0.18 }],
  ],
  hehe: [
    [0, 1, 2].map(() => ({ v: 'e', f: [560, 620], d: 0.07, gap: 0.05 })),
    [0, 1, 2, 3].map((i) => ({ v: i % 2 ? 'a' : 'e', f: [600 + i * 30, 680 + i * 30], d: 0.06, gap: 0.04 })),
  ],
  hmph: [
    [{ v: 'u', f: [200, 170], d: 0.12, gap: 0.04 }, { v: 'u', f: [180, 140], d: 0.14 }],
  ],
  argh: [
    [{ v: 'a', f: [220, 180], d: 0.5 }],
    [{ v: 'ae', to: 'a', f: [260, 170], d: 0.45 }],
  ],
  woo: [
    [{ v: 'u', to: 'o', f: [300, 700], d: 0.35 }],
  ],
  ooh: [
    [{ v: 'o', to: 'u', f: [350, 450], d: 0.4 }],
  ],
  uhoh: [
    [{ v: 'a', to: 'u', f: [400, 380], d: 0.14, gap: 0.06 }, { v: 'o', f: [300, 280], d: 0.22 }],
  ],
};

let lastGrunt = 0;
export function grunt(kind, { pitch = 1, rage = 0 } = {}) {
  const c = ac();
  if (c.currentTime - lastGrunt < 0.12) return;
  lastGrunt = c.currentTime;
  const set = GRUNTS[kind];
  if (!set) return;
  const parts = set[Math.floor(Math.random() * set.length)];
  // Angry heads get lower and crunchier.
  const p = pitch * (1 - rage * 0.35) * rnd(0.9, 1.12);
  vocal(parts, { pitch: p, gravel: rage * 0.8, vol: 0.45 + rage * 0.15 });
}

// ---------- extra tool noises ----------
export function tweet() {
  for (let i = 0; i < 5; i++) {
    const f = rnd(2200, 3200);
    tone('sine', [f, f * 1.35, f], 0.09, 0.08, { when: 0.35 + i * 0.13 });
  }
}

export function whipCrack() {
  burst(0.05, 0.9, { type: 'highpass', f0: 2500 });
  tone('square', [1800, 300], 0.06, 0.15);
}

export function boop() {
  tone('sine', [700, 1100], 0.08, 0.3);
}

export function rip() {
  burst(0.25, 0.4, { type: 'bandpass', f0: 3000, f1: 600, q: 3 });
}

export function feather() {
  burst(0.18, 0.12, { type: 'bandpass', f0: 5000, f1: 3000, q: 1 });
}

export function thud() {
  tone('sine', [120, 45], 0.25, 0.8);
  burst(0.06, 0.3, { type: 'lowpass', f0: 800 });
}

export function splat() {
  burst(0.22, 0.8, { type: 'lowpass', f0: 1800, f1: 250, q: 3 });
  tone('sine', [180, 60], 0.18, 0.5);
  for (let i = 0; i < 3; i++) burst(0.05, 0.25, { type: 'bandpass', f0: rnd(900, 2200), q: 6, when: 0.08 + i * 0.06 });
}

export function throwWhoosh() {
  burst(0.3, 0.3, { type: 'bandpass', f0: 600, f1: 2400, q: 2 });
}

export function marker() {
  burst(0.06, 0.12, { type: 'bandpass', f0: rnd(2500, 4200), q: 12 });
}

export function chomp() {
  burst(0.07, 0.6, { type: 'bandpass', f0: rnd(1200, 2400), q: 1.5 });
  tone('square', [rnd(160, 220), 90], 0.06, 0.12);
}

export function burp() {
  vocal([{ v: 'u', to: 'o', f: [95, 70], d: 0.55 }], { pitch: 1, gravel: 0.9, vol: 0.6 });
}

export function gulp() {
  tone('sine', [300, 120], 0.12, 0.4);
  tone('sine', [160, 90], 0.1, 0.3, { when: 0.1 });
}

export function spit() {
  burst(0.12, 0.5, { type: 'highpass', f0: 1500 });
  tone('square', [500, 200], 0.05, 0.15);
}

export function fireBreath(dur = 1.2) {
  burst(dur, 0.6, { type: 'lowpass', f0: 500, f1: 2500, q: 1 });
  burst(dur, 0.25, { type: 'highpass', f0: 5000 });
}

export function micOn() { tone('sine', [880, 1320], 0.12, 0.2); }
export function micOff() { tone('sine', [1320, 660], 0.12, 0.2); }

export function recBeep() { tone('square', [1000, 1000], 0.08, 0.15); }
