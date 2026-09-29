// Shared fit helpers and the no-face fallback. No CDN imports here, so it always loads.
import { FACE_Y, FACE_SPAN, smooth } from './shape.js';

export function samplePatch(ctx, W, H, x, y, r) {
  x = Math.round(x); y = Math.round(y); r = Math.max(2, Math.round(r));
  const x0 = Math.max(0, x - r), y0 = Math.max(0, y - r);
  const x1 = Math.min(W, x + r), y1 = Math.min(H, y + r);
  if (x1 <= x0 || y1 <= y0) return null;
  const d = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
  let R = 0, G = 0, Bb = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) { R += d[i]; G += d[i + 1]; Bb += d[i + 2]; n++; }
  return [R / n, G / n, Bb / n];
}

export function mixColors(list) {
  const ok = list.filter(Boolean);
  if (!ok.length) return null;
  const out = [0, 0, 0];
  for (const c of ok) for (let i = 0; i < 3; i++) out[i] += c[i] / ok.length;
  return out;
}

export function baseFit(W, H, cx, cy, faceW) {
  const k = FACE_SPAN / faceW; // model units per pixel
  return {
    W, H, cx, cy, faceW, k,
    toPx: (X, Y) => [cx + X / k, cy - (Y - FACE_Y) / k],
    toModel: (px, py) => [(px - cx) * k, FACE_Y - (py - cy) * k],
  };
}

// No face found? Assume one sits in the middle and fake a nose. Works on cartoons, dogs, toasters.
export function fallbackFit(canvas) {
  const W = canvas.width, H = canvas.height;
  const faceW = Math.min(W, H) * 0.55;
  const cx = W / 2, cy = H * 0.5;
  const fit = baseFit(W, H, cx, cy, faceW);
  fit.detected = false;
  const g = (u, v, cu, cv, su, sv) => Math.exp(-(((u - cu) ** 2) / su + ((v - cv) ** 2) / sv));
  fit.surfaceZ = (X, Y, ez, sz) => {
    const u = X / FACE_SPAN, v = -(Y - FACE_Y) / FACE_SPAN;
    const bump =
      0.3 * g(u, v, 0, 0.1, 0.005, 0.02) +       // nose
      0.05 * g(u, v, 0, -0.14, 0.05, 0.003) +    // brow ridge
      0.06 * g(u, v, 0, 0.5, 0.02, 0.01) -       // chin
      0.05 * g(u, v, -0.2, -0.05, 0.006, 0.004) - // eye sockets
      0.05 * g(u, v, 0.2, -0.05, 0.006, 0.004);
    return ez + bump * smooth(0, 0.4, sz);
  };
  const f = (u, v) => ({ x: cx + u * faceW, y: cy + v * faceW });
  fit.features = {
    eyeL: { ...f(-0.2, -0.06), rx: faceW * 0.09, ry: faceW * 0.07 },
    eyeR: { ...f(0.2, -0.06), rx: faceW * 0.09, ry: faceW * 0.07 },
    nose: f(0, 0.12),
    bridge: f(0, -0.06),
    stache: f(0, 0.22),
    mouth: { ...f(0, 0.32), w: faceW * 0.34 },
    browL: f(-0.2, -0.2),
    browR: f(0.2, -0.2),
    cheekL: f(-0.25, 0.18),
    cheekR: f(0.25, 0.18),
    top: f(0, -0.5),
  };
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const s = (u, v) => samplePatch(ctx, W, H, cx + u * faceW, cy + v * faceW, faceW * 0.03);
  fit.skin = mixColors([s(-0.28, 0.1), s(0.28, 0.1), s(0, -0.3)]) ?? [224, 172, 140];
  fit.hair = mixColors([s(0, -0.78), s(-0.3, -0.7), s(0.3, -0.7)]) ?? [60, 40, 30];
  return fit;
}
