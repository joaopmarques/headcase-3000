// The Head: a deformable ellipsoid wearing your face.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { A, B, C, Spring, clamp01, smooth } from './shape.js';

// Paint layer size. It wraps the whole head (equirectangular), so doodles work on the back too.
export const PAINT_W = 2048, PAINT_H = 1024;

const toLinear = (rgb) => new THREE.Color().setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace);

export class Head {
  constructor(fit, canvas) {
    this.fit = fit;
    this.srcCanvas = canvas;
    this.texCanvas = document.createElement('canvas');
    this.texCanvas.width = canvas.width;
    this.texCanvas.height = canvas.height;
    this.texCanvas.getContext('2d').drawImage(canvas, 0, 0);

    this.paintCanvas = document.createElement('canvas');
    this.paintCanvas.width = PAINT_W;
    this.paintCanvas.height = PAINT_H;
    this.paintCtx = this.paintCanvas.getContext('2d');
    // Wet layer (water balloons) fades out. The texture shows paint + wet combined.
    this.wetCanvas = document.createElement('canvas');
    this.wetCanvas.width = PAINT_W;
    this.wetCanvas.height = PAINT_H;
    this.wetCtx = this.wetCanvas.getContext('2d');
    this.wetAlpha = 0;
    this.dispCanvas = document.createElement('canvas');
    this.dispCanvas.width = PAINT_W;
    this.dispCanvas.height = PAINT_H;
    this.dispCtx = this.dispCanvas.getContext('2d');
    this.paintDirty = false;

    this.group = new THREE.Group();
    this.buildGeometry();
    this.buildMaterial();
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.castShadow = false;
    this.group.add(this.mesh);

    // Effect state
    this.s = {
      inflate: new Spring(0, 70, 5),
      jaw: new Spring(0, 500, 28),
      brow: new Spring(0, 260, 10),
      nose: new Spring(0, 40, 5),
      scaleY: new Spring(1, 180, 7),
      twist: new Spring(0, 45, 2.5),
      tongue: new Spring(0, 160, 12),
      melt: 0, meltTarget: 0,
      fat: 0, fatTarget: 0,
      tickle: 0,
      blink: 0,
      tint: new THREE.Color(0, 0, 0),
    };
    this.pokes = [];
    this.welts = [];
    this.wink = { L: 0, R: 0 };
    this.look = new THREE.Vector2(); // where the pupils point, -1..1
    this.pinch = null;
    this.time = 0;
    this.nextBlink = 2;
  }

  buildGeometry() {
    const { fit } = this;
    let geo = new THREE.SphereGeometry(1, 180, 150);
    geo.rotateY(-Math.PI / 2); // seam goes to the back of the head
    geo.deleteAttribute('uv');
    geo.deleteAttribute('normal');
    geo = mergeVertices(geo);
    const pos = geo.attributes.position;
    const n = pos.count;
    this.n = n;
    const base = new Float32Array(n * 3);
    const uv = new Float32Array(n * 2);
    const uv1 = new Float32Array(n * 2); // paint layer UVs
    const aMix = new Float32Array(n), aJaw = new Float32Array(n), aMouth = new Float32Array(n);
    const aFill = new Float32Array(n * 3);
    this.wJaw = aJaw;
    this.wNose = new Float32Array(n);
    this.wBrow = new Float32Array(n);
    this.wCheek = new Float32Array(n);
    this.front = new Float32Array(n);

    const skin = toLinear(fit.skin), hair = toLinear(fit.hair);
    this.skinColor = skin;
    const F = fit.features, fw = fit.faceW, W = fit.W, H = fit.H;
    const gauss = (px, py, p, r) => Math.exp(-(((px - p.x) ** 2 + (py - p.y) ** 2) / (r * r)));

    for (let i = 0; i < n; i++) {
      const sx = pos.getX(i), sy = pos.getY(i), sz = pos.getZ(i);
      const X = sx * A, Y = sy * B;
      let Z = sz * C;
      if (sz > 0) Z = fit.surfaceZ(X, Y, Z, sz);
      base[i * 3] = X; base[i * 3 + 1] = Y; base[i * 3 + 2] = Z;

      uv1[i * 2] = Math.atan2(sx, sz) / (Math.PI * 2) + 0.5;
      uv1[i * 2 + 1] = 1 - Math.acos(Math.max(-1, Math.min(1, sy))) / Math.PI;

      const [px, py] = fit.toPx(X, Y);
      uv[i * 2] = px / W;
      uv[i * 2 + 1] = 1 - py / H;
      const edge = clamp01(Math.min(px, W - px, py, H - py) / (0.03 * Math.max(W, H)));
      aMix[i] = smooth(0.22, 0.55, sz) * edge;

      const hairT = clamp01((sy - 0.25) * 1.6 + -sz * 1.4 + 0.25);
      const fill = skin.clone().lerp(hair, hairT);
      aFill[i * 3] = fill.r; aFill[i * 3 + 1] = fill.g; aFill[i * 3 + 2] = fill.b;

      const front = smooth(0.0, 0.35, sz);
      this.front[i] = front;
      const dxm = (px - F.mouth.x) / fw, dym = (py - F.mouth.y) / fw;
      const lat = 1 - smooth(0.26, 0.5, Math.abs(dxm));
      aJaw[i] = smooth(-0.012, 0.03, dym) * lat * front;
      aMouth[i] = (1 - smooth(0.42, 0.56, Math.abs(px - F.mouth.x) / F.mouth.w)) * front * (dym > -0.1 && dym < 0.2 ? 1 : 0);
      this.wNose[i] = gauss(px, py, F.nose, fw * 0.075) * front;
      this.wBrow[i] = (gauss(px, py, F.browL, fw * 0.13) + gauss(px, py, F.browR, fw * 0.13)) * front;
      this.wCheek[i] = (gauss(px, py, F.cheekL, fw * 0.17) + gauss(px, py, F.cheekR, fw * 0.17)) * front;
    }

    this.base = base;
    pos.array.set(base);
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2));
    geo.setAttribute('aMix', new THREE.BufferAttribute(aMix, 1));
    geo.setAttribute('aFill', new THREE.BufferAttribute(aFill, 3));
    geo.setAttribute('aJaw', new THREE.BufferAttribute(aJaw, 1));
    geo.setAttribute('aMouth', new THREE.BufferAttribute(aMouth, 1));
    geo.computeVertexNormals();
    this.baseN = geo.attributes.normal.array.slice();
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 6);
    this.geo = geo;

    // Anchors for props: nearest front vertex to each feature.
    this.anchors = {};
    const near = (p) => {
      const [X, Y] = fit.toModel(p.x, p.y);
      let best = 0, bd = Infinity;
      for (let i = 0; i < n; i++) {
        if (base[i * 3 + 2] <= 0) continue;
        const d = (base[i * 3] - X) ** 2 + (base[i * 3 + 1] - Y) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
      return best;
    };
    for (const key of ['eyeL', 'eyeR', 'nose', 'bridge', 'stache', 'mouth', 'browL', 'browR']) this.anchors[key] = near(F[key]);
    // Ears: the side vertices at eye height (steam comes out of these).
    const eyeY = fit.toModel(0, (F.eyeL.y + F.eyeR.y) / 2)[1];
    for (const [key, sx] of [['earL', -1], ['earR', 1]]) {
      let best = 0, bd = Infinity;
      for (let i = 0; i < n; i++) {
        const d = (base[i * 3] - sx * A) ** 2 + (base[i * 3 + 1] - eyeY) ** 2 + base[i * 3 + 2] ** 2;
        if (d < bd) { bd = d; best = i; }
      }
      this.anchors[key] = best;
    }
    // Lower lip anchor, a hair below the mouth center, so the tongue rides the jaw.
    this.anchors.lowerLip = near({ x: F.mouth.x, y: F.mouth.y + fw * 0.04 });
    let top = 0;
    for (let i = 0; i < n; i++) if (base[i * 3 + 1] > base[top * 3 + 1]) top = i;
    this.anchors.top = top;
    this.eyeSize = { L: F.eyeL.rx * fit.k, R: F.eyeR.rx * fit.k };
  }

  buildMaterial() {
    const { fit } = this;
    this.tex = new THREE.CanvasTexture(this.texCanvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 8;
    this.paintTex = new THREE.CanvasTexture(this.dispCanvas);
    this.paintTex.colorSpace = THREE.SRGBColorSpace;
    this.paintTex.anisotropy = 4;
    const mat = new THREE.MeshStandardMaterial({ map: this.tex, roughness: 0.55, metalness: 0.0 });
    const F = fit.features;
    const eyeUv = (e) => new THREE.Vector4(e.x / fit.W, 1 - e.y / fit.H, e.rx / fit.W, e.ry / fit.H);
    this.uniforms = {
      uJaw: { value: 0 },
      uBlinkL: { value: 0 },
      uBlinkR: { value: 0 },
      uIrisL: { value: eyeUv(F.irisL) },
      uIrisR: { value: eyeUv(F.irisR) },
      uLook: { value: new THREE.Vector2() },
      uSclera: { value: toLinear(fit.sclera) },
      uTint: { value: new THREE.Color(0, 0, 0) },
      uSkin: { value: this.skinColor },
      uEyeL: { value: eyeUv(F.eyeL) },
      uEyeR: { value: eyeUv(F.eyeR) },
      uHue: { value: 0 },
      uPaint: { value: this.paintTex },
    };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.uniforms);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          attribute float aMix; attribute vec3 aFill; attribute float aJaw; attribute float aMouth;
          #ifndef USE_UV1
            attribute vec2 uv1;
          #endif
          varying float vMix; varying vec3 vFill; varying float vJaw; varying float vMouth; varying vec2 vPaintUv;`)
        .replace('#include <uv_vertex>', `#include <uv_vertex>
          vMix = aMix; vFill = aFill; vJaw = aJaw; vMouth = aMouth; vPaintUv = uv1;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          varying float vMix; varying vec3 vFill; varying float vJaw; varying float vMouth; varying vec2 vPaintUv;
          uniform sampler2D uPaint;
          uniform float uJaw; uniform float uBlinkL; uniform float uBlinkR; uniform vec3 uTint; uniform vec3 uSkin;
          uniform vec4 uIrisL; uniform vec4 uIrisR; uniform vec2 uLook; uniform vec3 uSclera;
          uniform vec4 uEyeL; uniform vec4 uEyeR; uniform float uHue;
          float lidMask(vec2 uv, vec4 e) {
            vec2 d = (uv - e.xy) / e.zw;
            return 1.0 - smoothstep(0.8, 1.0, length(d));
          }
          float lashMask(vec2 uv, vec4 e) {
            vec2 d = (uv - e.xy) / e.zw;
            return (1.0 - smoothstep(0.0, 0.14, abs(d.y + 0.1 * d.x * d.x))) * (1.0 - smoothstep(0.85, 1.0, abs(d.x)));
          }
          vec3 hueShift(vec3 c, float a) {
            const vec3 k = vec3(0.57735);
            float ca = cos(a);
            return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca);
          }`)
        // eyeTrack samples the photo, so it goes after three declares the map uniform.
        .replace('#include <map_pars_fragment>', `#include <map_pars_fragment>
          // Slide the iris inside the eye opening. Where the iris leaves, paint eye-white.
          vec3 eyeTrack(vec3 base, vec2 uv, vec4 eye, vec4 iris) {
            float m = 1.0 - smoothstep(0.55, 0.8, length((uv - eye.xy) / (eye.zw * vec2(1.0, 0.8))));
            if (m <= 0.0) return base;
            vec2 shift = uLook * iris.zw * vec2(0.7, 0.28);
            vec2 q = uv - shift;
            float inIris = 1.0 - smoothstep(0.85, 1.05, length((q - iris.xy) / iris.zw));
            float wasIris = 1.0 - smoothstep(0.85, 1.05, length((uv - iris.xy) / iris.zw));
            // Fill the spot the iris left with real eye-white from just past its trailing edge.
            vec2 away = normalize(shift / iris.zw + 1e-6) * iris.zw * 1.6;
            vec3 white = mix(texture2D(map, uv - away).rgb, uSclera, 0.2);
            vec3 c = mix(base, white, wasIris);
            c = mix(c, texture2D(map, q).rgb, inIris);
            return mix(base, c, m);
          }`)
        .replace('#include <map_fragment>', `
          vec4 sampledDiffuseColor = texture2D(map, vMapUv);
          vec3 photo = sampledDiffuseColor.rgb;
          if (dot(uLook, uLook) > 0.0001) {
            photo = eyeTrack(photo, vMapUv, uEyeL, uIrisL);
            photo = eyeTrack(photo, vMapUv, uEyeR, uIrisR);
          }
          vec3 col = mix(vFill, photo, vMix);
          float lid = clamp(lidMask(vMapUv, uEyeL) * uBlinkL + lidMask(vMapUv, uEyeR) * uBlinkR, 0.0, 1.0) * vMix;
          col = mix(col, uSkin * 0.9, lid);
          float lash = clamp(lashMask(vMapUv, uEyeL) * step(0.6, uBlinkL) + lashMask(vMapUv, uEyeR) * step(0.6, uBlinkR), 0.0, 1.0) * vMix;
          col = mix(col, vec3(0.02), lash);
          float open = smoothstep(0.01, 0.1, vJaw) * (1.0 - smoothstep(0.82, 0.98, vJaw)) * vMouth * clamp(uJaw * 7.0, 0.0, 1.0);
          float teeth = smoothstep(0.01, 0.06, vJaw) * (1.0 - smoothstep(0.12, 0.2, vJaw)) * step(0.06, uJaw);
          col = mix(col, vec3(0.1, 0.005, 0.015), open);
          col = mix(col, vec3(0.9, 0.88, 0.8), teeth * open);
          vec4 paint = texture2D(uPaint, vPaintUv);
          col = mix(col, paint.rgb, paint.a);
          col = hueShift(col, uHue);
          col = col + uTint;
          diffuseColor.rgb *= col;
        `);
    };
    this.mat = mat;
  }

  // ---------- interactions ----------
  // A bee sting: a bump that swells up and stays until reset.
  addWelt(i) {
    this.welts.push({ i, amp: 0, target: 0.06 + Math.random() * 0.04 });
    if (this.welts.length > 14) this.welts.shift();
  }
  winkEye(side) { this.wink[side] = 1; }

  poke(i, amp = 0.28, radius = 0.32) {
    this.pokes.push({ i, amp, r2: radius * radius, t: 0 });
    if (this.pokes.length > 12) this.pokes.shift();
  }
  grab(i) { this.pinch = { i, off: new THREE.Vector3(), held: true, t: 0, amp: 1 }; }
  drag(offLocal) { if (this.pinch) this.pinch.off.copy(offLocal).clampLength(0, 1.6); }
  release() { if (this.pinch) { this.pinch.held = false; this.pinch.t = 0; } }

  // Paint-layer pixel for a paint UV, plus how much to stretch shapes sideways
  // (the equirectangular map squashes things near the top and bottom).
  paintPx(uv1) {
    const px = uv1.x * PAINT_W, py = (1 - uv1.y) * PAINT_H;
    const theta = (py / PAINT_H) * Math.PI;
    return { x: px, y: py, sx: 1 / Math.max(0.2, Math.sin(theta)) };
  }
  clearPaint() {
    this.paintCtx.clearRect(0, 0, PAINT_W, PAINT_H);
    this.wetCtx.clearRect(0, 0, PAINT_W, PAINT_H);
    this.wetAlpha = 0;
    this.paintDirty = true;
  }
  composePaint() {
    const g = this.dispCtx;
    g.clearRect(0, 0, PAINT_W, PAINT_H);
    g.drawImage(this.paintCanvas, 0, 0);
    if (this.wetAlpha > 0) {
      g.globalAlpha = Math.min(1, this.wetAlpha * 2);
      g.drawImage(this.wetCanvas, 0, 0);
      g.globalAlpha = 1;
    }
    this.paintTex.needsUpdate = true;
  }

  vertexPos(i, out) {
    const a = this.geo.attributes.position.array;
    return out.set(a[i * 3], a[i * 3 + 1], a[i * 3 + 2]);
  }
  vertexNormal(i, out) {
    const a = this.geo.attributes.normal.array;
    return out.set(a[i * 3], a[i * 3 + 1], a[i * 3 + 2]).normalize();
  }
  basePos(i, out) {
    const b = this.base;
    return out.set(b[i * 3], b[i * 3 + 1], b[i * 3 + 2]);
  }

  setFilter(filter, extra) {
    const ctx = this.texCanvas.getContext('2d');
    ctx.save();
    ctx.clearRect(0, 0, this.texCanvas.width, this.texCanvas.height);
    ctx.filter = filter || 'none';
    ctx.drawImage(this.srcCanvas, 0, 0);
    ctx.restore();
    extra?.(ctx, this.fit);
    this.tex.needsUpdate = true;
  }

  reset() {
    const s = this.s;
    s.inflate.snap(0); s.jaw.snap(0); s.brow.snap(0); s.nose.snap(0);
    s.scaleY.snap(1); s.twist.snap(0); s.tongue.snap(0);
    s.melt = s.meltTarget = 0; s.tickle = 0;
    s.fat = s.fatTarget = 0;
    this.clearPaint();
    this.pokes.length = 0; this.pinch = null;
    this.welts.length = 0;
  }

  // ---------- per-frame ----------
  update(dt) {
    this.time += dt;
    const t = this.time, s = this.s;
    for (const k of ['inflate', 'jaw', 'brow', 'nose', 'scaleY', 'twist', 'tongue']) s[k].step(dt);
    s.melt += (s.meltTarget - s.melt) * Math.min(1, dt * 0.9);
    s.tickle = Math.max(0, s.tickle - dt * 1.5);
    s.fat += (s.fatTarget - s.fat) * Math.min(1, dt * 3);
    if (this.paintDirty) { this.composePaint(); this.paintDirty = false; }

    // Blinks, because a staring head is creepier than a squished one.
    this.nextBlink -= dt;
    if (this.nextBlink < 0) { this.nextBlink = 1.5 + Math.random() * 4; this.blinkT = 0; }
    if (this.blinkT !== undefined) {
      this.blinkT += dt;
      const b = this.blinkT / 0.16;
      s.blink = b < 1 ? Math.sin(b * Math.PI) : 0;
      if (b >= 1) this.blinkT = undefined;
    }
    if (this.forceBlink) s.blink = Math.max(s.blink, this.forceBlink);

    this.wink.L = Math.max(0, this.wink.L - dt * 1.6);
    this.wink.R = Math.max(0, this.wink.R - dt * 1.6);
    for (const w of this.welts) w.amp += (w.target - w.amp) * Math.min(1, dt * 4);
    const welts = this.welts.map((w) => {
      const b = this.base, N = this.baseN, i = w.i;
      return { x: b[i * 3], y: b[i * 3 + 1], z: b[i * 3 + 2], nx: N[i * 3], ny: N[i * 3 + 1], nz: N[i * 3 + 2], f: w.amp };
    });
    for (const p of this.pokes) p.t += dt;
    this.pokes = this.pokes.filter((p) => p.t < 1.6);
    const pokes = this.pokes.map((p) => {
      const b = this.base, N = this.baseN, i = p.i;
      return {
        x: b[i * 3], y: b[i * 3 + 1], z: b[i * 3 + 2],
        nx: N[i * 3], ny: N[i * 3 + 1], nz: N[i * 3 + 2],
        f: p.amp * Math.exp(-p.t * 5) * Math.cos(p.t * 22), r2: p.r2,
      };
    });
    let pinch = null;
    if (this.pinch) {
      const P = this.pinch;
      P.t += dt;
      const env = P.held ? 1 : Math.exp(-P.t * 5) * Math.cos(P.t * 26);
      if (!P.held && P.t > 1.5) this.pinch = null;
      else {
        const i = P.i, b = this.base;
        pinch = { x: b[i * 3], y: b[i * 3 + 1], z: b[i * 3 + 2], ox: P.off.x * env, oy: P.off.y * env, oz: P.off.z * env };
      }
    }

    const inflate = s.inflate.x, jaw = Math.max(0, s.jaw.x), brow = s.brow.x, nose = s.nose.x;
    const twist = s.twist.x, melt = s.melt, tickle = s.tickle, fat = s.fat;
    const sy = Math.max(0.15, s.scaleY.x), sxz = 1 / Math.sqrt(sy);
    const base = this.base, N = this.baseN;
    const out = this.geo.attributes.position.array;

    for (let i = 0; i < this.n; i++) {
      const i3 = i * 3;
      const bx = base[i3], by = base[i3 + 1], bz = base[i3 + 2];
      const nx = N[i3], ny = N[i3 + 1], nz = N[i3 + 2];
      let x = bx, y = by, z = bz;

      if (inflate !== 0) {
        const f = inflate * 0.6 * (0.8 + 0.7 * this.wCheek[i]) * (1 + 0.06 * Math.sin(t * 9 + by * 4));
        x += nx * f; y += ny * f; z += nz * f;
      }
      if (fat > 0.001) {
        // Chipmunk cheeks and a double chin.
        const f = fat * 0.32 * (0.2 + this.wCheek[i] * 1.1 + this.wJaw[i] * 0.7);
        x += nx * f; y += ny * f - this.wJaw[i] * fat * 0.08; z += nz * f;
      }
      if (nose !== 0) {
        const w = this.wNose[i];
        z += w * nose * 1.2; y -= w * nose * 0.08;
      }
      if (jaw > 0.001) {
        const w = this.wJaw[i];
        y -= w * jaw * 0.45; z -= w * jaw * 0.1;
      }
      if (brow !== 0) y += this.wBrow[i] * brow * 0.09;

      for (let p = 0; p < pokes.length; p++) {
        const k = pokes[p];
        const d2 = (bx - k.x) ** 2 + (by - k.y) ** 2 + (bz - k.z) ** 2;
        if (d2 > k.r2 * 6) continue;
        const f = k.f * Math.exp(-d2 / k.r2);
        x -= k.nx * f; y -= k.ny * f; z -= k.nz * f;
      }
      for (let w = 0; w < welts.length; w++) {
        const k = welts[w];
        const d2 = (bx - k.x) ** 2 + (by - k.y) ** 2 + (bz - k.z) ** 2;
        if (d2 > 0.06) continue;
        const f = k.f * Math.exp(-d2 / 0.012);
        x += k.nx * f; y += k.ny * f; z += k.nz * f;
      }
      if (pinch) {
        const d2 = (bx - pinch.x) ** 2 + (by - pinch.y) ** 2 + (bz - pinch.z) ** 2;
        const f = Math.exp(-d2 / 0.09);
        x += pinch.ox * f; y += pinch.oy * f; z += pinch.oz * f;
      }
      if (tickle > 0) {
        const a = tickle * 0.035;
        x += Math.sin(t * 47 + by * 13) * a;
        y += Math.sin(t * 53 + bx * 11) * a;
        z += Math.sin(t * 41 + bz * 9) * a;
      }
      if (melt > 0.001) {
        const h = clamp01((y + B) / (2 * B));
        const drip = Math.max(0, Math.sin(x * 7.3 + 1.1) * Math.sin(z * 5.1)) * (1 - h) * 0.9;
        y -= melt * (h * 1.3 + drip + 0.05 * Math.sin(t * 2 + x * 3));
        const floor = -B - 0.05;
        const spread = 1 + melt * (1 - h) * 0.9;
        x *= spread; z *= spread;
        if (y < floor) y = floor + (y - floor) * 0.1;
      }
      if (twist !== 0) {
        const a = twist * (y / B);
        const c = Math.cos(a), sn = Math.sin(a);
        const x2 = x * c + z * sn;
        z = -x * sn + z * c; x = x2;
      }
      out[i3] = x * sxz; out[i3 + 1] = y * sy; out[i3 + 2] = z * sxz;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeVertexNormals();

    this.uniforms.uJaw.value = jaw;
    // A wink holds one eye shut, with a little shape: close fast, open slow.
    const wk = (v) => (v > 0.7 ? (1 - v) / 0.3 : Math.min(1, v / 0.5));
    this.uniforms.uBlinkL.value = Math.max(s.blink, this.wink.L > 0 ? wk(this.wink.L) : 0);
    this.uniforms.uBlinkR.value = Math.max(s.blink, this.wink.R > 0 ? wk(this.wink.R) : 0);
    this.uniforms.uLook.value.copy(this.look);
    this.uniforms.uTint.value.copy(s.tint);
  }

  dispose() {
    this.geo.dispose();
    this.mat.dispose();
    this.tex.dispose();
    this.paintTex.dispose();
    this.group.removeFromParent();
  }
}
