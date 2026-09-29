// Recorded CC0 samples from freesound.org (see sfx/CREDITS.md). Synth sounds cover for them
// until they load, or if they fail to load.
import { audioCtx, sfxOut } from './audio.js';

const NAMES = ['nuke', 'boing', 'squeak', 'slide', 'fart', 'crickets', 'scratch', 'laugh', 'airhorn', 'splat', 'aww', 'honk', 'barf', 'wilhelm'];
const buffers = {};
let loading = null;

export function loadSamples() {
  loading ??= Promise.all(NAMES.map(async (n) => {
    try {
      const res = await fetch(`sfx/${n}.mp3`);
      buffers[n] = await audioCtx().decodeAudioData(await res.arrayBuffer());
    } catch (e) {
      console.warn(`sample ${n} did not load`, e);
    }
  }));
  return loading;
}

export const has = (name) => !!buffers[name];

// Returns false when the sample is not ready, so callers can fall back to a synth sound.
export function play(name, { rate = 1, vol = 1, offset = 0, dur } = {}) {
  const b = buffers[name];
  if (!b) return false;
  const c = audioCtx();
  const src = c.createBufferSource();
  src.buffer = b;
  src.playbackRate.value = rate;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(g).connect(sfxOut());
  src.start(0, offset, dur);
  return true;
}

// Big files (the disco song) load only when first needed.
const lazy = {};
export function loadOne(name) {
  lazy[name] ??= (async () => {
    const res = await fetch(`sfx/${name}.mp3`);
    buffers[name] = await audioCtx().decodeAudioData(await res.arrayBuffer());
    return buffers[name];
  })().catch((e) => { console.warn(`sample ${name} did not load`, e); lazy[name] = null; return null; });
  return lazy[name];
}

// Loop a sample. Returns { t0, stop() }, where t0 is the audio-clock time it started (for beat sync).
export function loop(name, { vol = 1 } = {}) {
  const b = buffers[name];
  if (!b) return null;
  const c = audioCtx();
  const src = c.createBufferSource();
  src.buffer = b;
  src.loop = true;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(g).connect(sfxOut());
  const t0 = c.currentTime + 0.05;
  src.start(t0);
  return {
    t0,
    stop() {
      g.gain.setTargetAtTime(0, c.currentTime, 0.08);
      src.stop(c.currentTime + 0.4);
    },
  };
}
