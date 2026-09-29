// Clip recorder: films the stage (3D canvas + speech bubble + watermark) with app audio.
import { tapStream } from './audio.js';

const TYPES = [
  ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'mp4'],
  ['video/mp4', 'mp4'],
  ['video/webm;codecs=vp9,opus', 'webm'],
  ['video/webm;codecs=vp8,opus', 'webm'],
  ['video/webm', 'webm'],
];

export class ClipRecorder {
  constructor(stage, glCanvas, bubble) {
    this.stage = stage;
    this.gl = glCanvas;
    this.bubble = bubble;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.active = false;
  }

  static supported() {
    return typeof MediaRecorder !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream;
  }

  start(seconds, { onTick, onDone } = {}) {
    if (this.active) return;
    const scale = Math.min(1, 1280 / this.gl.width);
    // Even sizes keep video encoders happy.
    this.canvas.width = Math.round((this.gl.width * scale) / 2) * 2;
    this.canvas.height = Math.round((this.gl.height * scale) / 2) * 2;
    this.draw();
    const video = this.canvas.captureStream(30);
    const tracks = [...video.getVideoTracks()];
    try { tracks.push(...tapStream().getAudioTracks()); } catch (e) { console.warn('no audio for clip', e); }
    const [mime, ext] = TYPES.find(([t]) => MediaRecorder.isTypeSupported(t)) ?? ['', 'webm'];
    this.ext = ext;
    this.rec = new MediaRecorder(new MediaStream(tracks), mime ? { mimeType: mime, videoBitsPerSecond: 5e6 } : undefined);
    const chunks = [];
    this.rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    this.rec.onstop = () => {
      this.active = false;
      clearInterval(this.tick);
      onDone?.(new Blob(chunks, { type: this.rec.mimeType || 'video/webm' }), ext);
    };
    this.active = true;
    this.rec.start(250);
    let left = seconds;
    onTick?.(left);
    this.tick = setInterval(() => {
      left -= 1;
      onTick?.(left);
      if (left <= 0) this.stop();
    }, 1000);
  }

  stop() {
    if (this.active && this.rec.state !== 'inactive') this.rec.stop();
  }

  // Call right after the WebGL render, while its buffer is still valid.
  draw() {
    const g = this.ctx, W = this.canvas.width, H = this.canvas.height;
    const k = W / this.stage.clientWidth;
    const grd = g.createRadialGradient(W / 2, H * 0.45, 5, W / 2, H * 0.45, Math.max(W, H) * 0.75);
    grd.addColorStop(0, '#fff');
    grd.addColorStop(0.35, '#ffd6f0');
    grd.addColorStop(0.7, '#b7a6ff');
    grd.addColorStop(1, '#6a4cff');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,255,255,0.18)';
    g.lineWidth = 40 * k;
    for (let r = 40 * k; r < W * 1.3; r += 80 * k) { g.beginPath(); g.arc(W / 2, H * 1.1, r, 0, 7); g.stroke(); }
    g.drawImage(this.gl, 0, 0, W, H);

    // Speech bubble, copied from the DOM.
    const b = this.bubble;
    if (b.classList.contains('show') && b.textContent) {
      const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(b.style.transform);
      if (m) {
        const x = (+m[1] - 30) * k, y = (+m[2] - 70) * k;
        const bw = b.offsetWidth * k, bh = b.offsetHeight * k;
        g.lineWidth = 4 * k;
        g.strokeStyle = '#111';
        g.fillStyle = '#111';
        g.beginPath(); g.roundRect(x + 5 * k, y + 5 * k, bw, bh, 22 * k); g.fill();
        g.fillStyle = '#fff';
        g.beginPath(); g.roundRect(x, y, bw, bh, 22 * k); g.fill(); g.stroke();
        g.fillStyle = '#111';
        g.font = `${20 * k}px Chewy, cursive`;
        g.textBaseline = 'top';
        wrap(g, b.textContent, x + 14 * k, y + 10 * k, bw - 28 * k, 23 * k);
      }
    }
    // Watermark, for maximum virality.
    g.font = `${22 * k}px Bangers, sans-serif`;
    g.textBaseline = 'bottom';
    g.textAlign = 'right';
    g.lineWidth = 5 * k;
    g.strokeStyle = '#111';
    const wm = 'HEADCASE 3000™ • headcase-3000.vercel.app';
    g.strokeText(wm, W - 14 * k, H - 12 * k);
    g.fillStyle = '#ffe600';
    g.fillText(wm, W - 14 * k, H - 12 * k);
    g.textAlign = 'left';
  }
}

function wrap(g, text, x, y, maxW, lh) {
  const words = text.split(/\s+/);
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > maxW && line) {
      g.fillText(line, x, y);
      line = w;
      y += lh;
    } else line = test;
  }
  if (line) g.fillText(line, x, y);
}
