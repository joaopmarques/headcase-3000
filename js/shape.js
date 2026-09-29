// Shared head-shape constants. The head is an ellipsoid with these semi-axes.
export const A = 1.0;   // half width
export const B = 1.3;   // half height
export const C = 1.05;  // half depth
// Model Y where the face center (midpoint of forehead top and chin) sits.
export const FACE_Y = -0.2;
// Face width (cheek to cheek) in model units.
export const FACE_SPAN = 1.6;

export function ellipZ(X, Y) {
  const q = 1 - (X / A) ** 2 - (Y / B) ** 2;
  return q > 0 ? C * Math.sqrt(q) : 0;
}

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const smooth = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
export const lerp = (a, b, t) => a + (b - a) * t;

export class Spring {
  constructor(x = 0, k = 120, d = 12) {
    this.x = x; this.v = 0; this.t = x; this.k = k; this.d = d;
  }
  step(dt) {
    // Sub-step so stiff springs stay stable.
    const n = 4, h = dt / n;
    for (let i = 0; i < n; i++) {
      const a = this.k * (this.t - this.x) - this.d * this.v;
      this.v += a * h;
      this.x += this.v * h;
    }
  }
  kick(v) { this.v += v; }
  snap(x) { this.x = this.t = x; this.v = 0; }
}
