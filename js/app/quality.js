// Performance: "low effects" mode for slower devices. Auto mode switches it on when frames
// stay slow; the Options screen can force it on or off.
import { app } from './ctx.js';
import { renderer, resize, fx, vomit } from './stage.js';

export const quality = { mode: 'auto', low: false };
let ema = 16.7, slowFor = 0, lastT = 0;

export function setLowFx(on) {
  quality.low = on;
  renderer.setPixelRatio(on ? 1 : Math.min(devicePixelRatio, 2));
  resize();
  fx.density = on ? 0.5 : 1;
  vomit.density = on ? 0.5 : 1;
  if (app.head) app.head.lowFx = on;
  document.body.classList.toggle('lowfx', on);
}

export function setQualityMode(mode) {
  quality.mode = mode;
  // Auto starts from full effects and watches again from scratch.
  if (mode === 'low') setLowFx(true);
  else if (quality.low) setLowFx(false);
  ema = 16.7;
  slowFor = 0;
}

// Call once per frame with the real time. Watches for sustained slowness.
export function tickQuality(nowMs) {
  const dt = nowMs - lastT;
  lastT = nowMs;
  if (app.head) app.head.lowFx = quality.low; // new faces pick up the current mode
  // Ignore hidden tabs and big gaps (tab switches), they are not real slowness.
  if (quality.mode !== 'auto' || quality.low || document.hidden || dt > 250 || dt <= 0) return;
  ema = ema * 0.94 + dt * 0.06;
  slowFor = ema > 26 ? slowFor + dt : 0; // under ~38 fps
  if (slowFor > 2000) {
    setLowFx(true);
    console.info('HEADCASE: frames were slow, switched to low effects');
  }
}

app.quality = quality;
