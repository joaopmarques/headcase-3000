// Mic mimic: you talk, the head repeats it in a silly voice. Talking-Tom style.
import { audioCtx, voiceOut } from './audio.js';

const MAX_SECONDS = 10;

export class Mimic {
  constructor() {
    this.state = 'idle'; // idle | recording | playing
    this.level = 0;      // 0..1, drives the jaw
    this.analyser = null;
    this.buf = null;
  }

  async start() {
    if (this.state !== 'idle') return false;
    const c = audioCtx();
    this.stream = await navigator.mediaDevices.getUserMedia({
      // Voice processing gates quiet syllables, which chops words mid-sentence. Keep it raw.
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
    });
    // Listen while recording, so the head can react to how loud you are.
    const src = c.createMediaStreamSource(this.stream);
    this.analyser = c.createAnalyser();
    this.analyser.fftSize = 1024;
    src.connect(this.analyser);
    this.chunks = [];
    this.rec = new MediaRecorder(this.stream);
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.done = new Promise((res) => (this.rec.onstop = res));
    this.rec.start();
    this.state = 'recording';
    this.timer = setTimeout(() => this.stop(), MAX_SECONDS * 1000);
    return true;
  }

  // Stop recording and return the decoded clip (or null if it was silence).
  async stop() {
    if (this.state !== 'recording') return null;
    clearTimeout(this.timer);
    this.rec.stop();
    await this.done;
    this.stream.getTracks().forEach((t) => t.stop());
    this.state = 'idle';
    this.analyser = null;
    const blob = new Blob(this.chunks, { type: this.rec.mimeType });
    try {
      this.buf = normalize(await audioCtx().decodeAudioData(await blob.arrayBuffer()));
    } catch (e) {
      console.warn('could not decode mic clip', e);
      this.buf = null;
    }
    return this.buf;
  }

  // Play the clip back sped up (chipmunk) or slowed (demon). Resolves when done.
  play(rate = 1.5) {
    if (!this.buf) return Promise.resolve();
    const c = audioCtx();
    const src = c.createBufferSource();
    src.buffer = this.buf;
    src.playbackRate.value = rate;
    this.analyser = c.createAnalyser();
    this.analyser.fftSize = 1024;
    const boost = c.createGain();
    boost.gain.value = 1;
    src.connect(boost).connect(this.analyser);
    this.analyser.connect(voiceOut());
    this.state = 'playing';
    this.src = src;
    src.start();
    return new Promise((res) => {
      src.onended = () => {
        this.state = 'idle';
        this.analyser = null;
        this.level = 0;
        res();
      };
    });
  }

  cancel() {
    if (this.state === 'recording') this.stop();
    if (this.state === 'playing') this.src?.stop();
  }

  // Call once per frame. Updates this.level from the current audio.
  update() {
    if (!this.analyser) { this.level *= 0.8; return this.level; }
    const a = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(a);
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += a[i] * a[i];
    const rms = Math.sqrt(sum / a.length);
    const target = Math.min(1, rms * 7);
    this.level += (target - this.level) * (target > this.level ? 0.6 : 0.25);
    return this.level;
  }
}

// Without auto gain the raw mic can be quiet. Scale the clip so its peak sits near full volume.
function normalize(buf) {
  let peak = 0;
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  }
  if (peak < 1e-4) return buf;
  const gain = Math.min(8, 0.9 / peak);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < d.length; i++) d[i] *= gain;
  }
  return buf;
}
