// Face detection + fitting. Turns a photo into a "fit": a mapping from head
// model space to photo pixels, a depth surface, and feature positions.
import { FaceLandmarker, FilesetResolver } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';
import { Delaunay } from 'https://cdn.jsdelivr.net/npm/d3-delaunay@6.0.4/+esm';
import { ellipZ, clamp01, smooth, lerp } from './shape.js';
import { samplePatch, mixColors, baseFit, fallbackFit } from './fitcore.js';

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const DEPTH_EXAG = 1.15; // a little extra nose never hurt anyone

const OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377,
  152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];

let landmarkerPromise;
function getLandmarker() {
  landmarkerPromise ??= (async () => {
    const fileset = await FilesetResolver.forVisionTasks(WASM);
    const opts = (delegate) => ({
      baseOptions: { modelAssetPath: MODEL, delegate },
      runningMode: 'IMAGE',
      numFaces: 1,
    });
    try {
      return await FaceLandmarker.createFromOptions(fileset, opts('GPU'));
    } catch {
      return await FaceLandmarker.createFromOptions(fileset, opts('CPU'));
    }
  })();
  return landmarkerPromise;
}

export async function warmup() {
  try { await getLandmarker(); } catch (e) { console.warn('landmarker failed to load', e); }
}

async function detect(canvas) {
  try {
    const lm = await getLandmarker();
    const res = lm.detect(canvas);
    return res.faceLandmarks?.[0] ?? null;
  } catch (e) {
    console.warn('face detection failed', e);
    return null;
  }
}

function toPixels(lms, W, H) {
  return lms.map((l) => ({ x: l.x * W, y: l.y * H, z: l.z * W }));
}

const avg = (P, ids) => {
  let x = 0, y = 0;
  for (const i of ids) { x += P[i].x; y += P[i].y; }
  return { x: x / ids.length, y: y / ids.length };
};
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function scaleDown(src, max) {
  const s = Math.min(1, max / Math.max(src.width, src.height));
  const c = document.createElement('canvas');
  c.width = Math.round(src.width * s);
  c.height = Math.round(src.height * s);
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return c;
}

// Main entry: returns { canvas, fit }. The canvas is a leveled crop around the face.
export async function fitFace(source) {
  const first = scaleDown(source, 1280);
  const lms1 = await detect(first);
  if (!lms1) return { canvas: first, fit: fallbackFit(first) };

  // Level the eyes and crop around the head, then detect again for a sharper fit.
  const P = toPixels(lms1, first.width, first.height);
  const eyeL = avg(P, [33, 133]), eyeR = avg(P, [362, 263]);
  const roll = Math.atan2(eyeR.y - eyeL.y, eyeR.x - eyeL.x);
  const fw = dist(P[234], P[454]);
  const c = { x: (P[234].x + P[454].x) / 2, y: (P[10].y + P[152].y) / 2 };
  const cropW = fw * 1.7, cropH = fw * 2.0;
  const scale = 1024 / cropH;
  const crop = document.createElement('canvas');
  crop.width = Math.round(cropW * scale);
  crop.height = 1024;
  const ctx = crop.getContext('2d');
  // Fill with an edge-ish color so rotated corners are not black holes.
  ctx.fillStyle = '#888';
  ctx.fillRect(0, 0, crop.width, crop.height);
  ctx.translate(crop.width / 2, crop.height * 0.52);
  ctx.scale(scale, scale);
  ctx.rotate(-roll);
  ctx.translate(-c.x, -c.y);
  ctx.drawImage(first, 0, 0);

  const lms2 = await detect(crop);
  if (lms2) return { canvas: crop, fit: landmarkFit(crop, lms2) };
  return { canvas: first, fit: landmarkFit(first, lms1) };
}

function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0, n = 0;
      for (let k = -r; k <= r; k++) { const xx = x + k; if (xx >= 0 && xx < w) { s += src[y * w + xx]; n++; } }
      tmp[y * w + x] = s / n;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0, n = 0;
      for (let k = -r; k <= r; k++) { const yy = y + k; if (yy >= 0 && yy < h) { s += tmp[yy * w + x]; n++; } }
      out[y * w + x] = s / n;
    }
  }
  return out;
}

function landmarkFit(canvas, lms) {
  const W = canvas.width, H = canvas.height;
  const P = toPixels(lms, W, H);
  const faceW = dist(P[234], P[454]);
  const faceH = dist(P[10], P[152]);
  const cx = (P[234].x + P[454].x) / 2;
  const cy = (P[10].y + P[152].y) / 2;
  const fit = baseFit(W, H, cx, cy, faceW);
  fit.detected = true;
  const { k } = fit;

  // Rasterize the Delaunay triangulation of the 468 mesh points into a depth grid.
  const pts = P.slice(0, 468);
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (const p of pts) { bx0 = Math.min(bx0, p.x); by0 = Math.min(by0, p.y); bx1 = Math.max(bx1, p.x); by1 = Math.max(by1, p.y); }
  const pad = faceW * 0.05;
  bx0 -= pad; by0 -= pad; bx1 += pad; by1 += pad;
  const GW = 180, GH = Math.round(GW * (by1 - by0) / (bx1 - bx0));
  const cell = (bx1 - bx0) / GW;
  const depth = new Float32Array(GW * GH), cov = new Float32Array(GW * GH);
  const dz = pts.map((p) => -p.z * k * DEPTH_EXAG);
  const del = Delaunay.from(pts, (p) => p.x, (p) => p.y);
  const tri = del.triangles;
  for (let t = 0; t < tri.length; t += 3) {
    const a = pts[tri[t]], b = pts[tri[t + 1]], c = pts[tri[t + 2]];
    const za = dz[tri[t]], zb = dz[tri[t + 1]], zc = dz[tri[t + 2]];
    const gx0 = Math.max(0, Math.floor((Math.min(a.x, b.x, c.x) - bx0) / cell));
    const gx1 = Math.min(GW - 1, Math.ceil((Math.max(a.x, b.x, c.x) - bx0) / cell));
    const gy0 = Math.max(0, Math.floor((Math.min(a.y, b.y, c.y) - by0) / cell));
    const gy1 = Math.min(GH - 1, Math.ceil((Math.max(a.y, b.y, c.y) - by0) / cell));
    const den = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
    if (Math.abs(den) < 1e-9) continue;
    for (let gy = gy0; gy <= gy1; gy++) {
      const py = by0 + (gy + 0.5) * cell;
      for (let gx = gx0; gx <= gx1; gx++) {
        const px = bx0 + (gx + 0.5) * cell;
        const w1 = ((b.y - c.y) * (px - c.x) + (c.x - b.x) * (py - c.y)) / den;
        const w2 = ((c.y - a.y) * (px - c.x) + (a.x - c.x) * (py - c.y)) / den;
        const w3 = 1 - w1 - w2;
        if (w1 < -1e-4 || w2 < -1e-4 || w3 < -1e-4) continue;
        const idx = gy * GW + gx;
        depth[idx] = w1 * za + w2 * zb + w3 * zc;
        cov[idx] = 1;
      }
    }
  }
  const dc = new Float32Array(depth.length);
  for (let i = 0; i < dc.length; i++) dc[i] = depth[i] * cov[i];
  const bCov = boxBlur(boxBlur(cov, GW, GH, 3), GW, GH, 3);
  const bDc = boxBlur(boxBlur(dc, GW, GH, 3), GW, GH, 3);
  const smoothDepth = new Float32Array(depth.length), mask = new Float32Array(depth.length);
  for (let i = 0; i < depth.length; i++) {
    smoothDepth[i] = bDc[i] / Math.max(bCov[i], 1e-4);
    mask[i] = clamp01((bCov[i] - 0.5) * 2.2);
  }
  const sample = (arr, px, py) => {
    const gx = (px - bx0) / cell - 0.5, gy = (py - by0) / cell - 0.5;
    if (gx < 0 || gy < 0 || gx > GW - 1 || gy > GH - 1) return 0;
    const x0 = Math.floor(gx), y0 = Math.floor(gy);
    const x1 = Math.min(GW - 1, x0 + 1), y1 = Math.min(GH - 1, y0 + 1);
    const fx = gx - x0, fy = gy - y0;
    return lerp(lerp(arr[y0 * GW + x0], arr[y0 * GW + x1], fx), lerp(arr[y1 * GW + x0], arr[y1 * GW + x1], fx), fy);
  };

  // Offset so the face surface meets the ellipsoid along the face oval.
  const offs = OVAL.map((i) => {
    const [X, Y] = fit.toModel(P[i].x, P[i].y);
    return ellipZ(X, Y) - dz[i];
  }).sort((a, b) => a - b);
  const zOff = offs[Math.floor(offs.length / 2)];

  fit.surfaceZ = (X, Y, ez, sz) => {
    const [px, py] = fit.toPx(X, Y);
    const w = sample(mask, px, py) * smooth(0.0, 0.35, sz);
    if (w <= 0) return ez;
    const fz = Math.max(0.05, zOff + sample(smoothDepth, px, py));
    return lerp(ez, fz, w);
  };

  const eye = (ids, corners, lids) => {
    const c = avg(P, ids);
    const rx = dist(P[corners[0]], P[corners[1]]) / 2;
    const ry = Math.max(rx * 0.45, dist(P[lids[0]], P[lids[1]]) / 2);
    return { x: c.x, y: c.y, rx: rx * 1.15, ry: ry * 1.3 };
  };
  fit.features = {
    eyeL: eye([33, 133, 159, 145], [33, 133], [159, 145]),
    eyeR: eye([362, 263, 386, 374], [362, 263], [386, 374]),
    nose: { x: P[1].x, y: P[1].y },
    bridge: { x: P[168].x, y: P[168].y },
    stache: avg(P, [0, 164]),
    mouth: { ...avg(P, [13, 14]), w: dist(P[61], P[291]) },
    browL: avg(P, [70, 63, 105, 66, 107]),
    browR: avg(P, [336, 296, 334, 293, 300]),
    cheekL: { x: P[205].x, y: P[205].y },
    cheekR: { x: P[425].x, y: P[425].y },
    top: { x: P[10].x, y: P[10].y },
  };

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const r = faceW * 0.03;
  fit.skin = mixColors([
    samplePatch(ctx, W, H, P[50].x, P[50].y, r),
    samplePatch(ctx, W, H, P[280].x, P[280].y, r),
    samplePatch(ctx, W, H, P[151].x, P[151].y, r),
  ]) ?? [224, 172, 140];
  const hy = P[10].y - faceH * 0.2;
  fit.hair = mixColors([
    samplePatch(ctx, W, H, P[10].x, hy, r),
    samplePatch(ctx, W, H, P[10].x - faceW * 0.22, hy + faceH * 0.03, r),
    samplePatch(ctx, W, H, P[10].x + faceW * 0.22, hy + faceH * 0.03, r),
  ]) ?? fit.skin.map((v) => v * 0.5);
  return fit;
}
