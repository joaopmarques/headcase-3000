// Things that end up on the face: food splats, drips, and sharpie crimes.
const rnd = (a, b) => a + Math.random() * (b - a);

export const AMMO = {
  pie: { emoji: '🥧', name: 'PIE', base: '#fff4dc', edge: '#f1dcb0', bits: '#b87333', drip: '#fff4dc' },
  tomato: { emoji: '🍅', name: 'TOMATO', base: '#e3261b', edge: '#b3140c', bits: '#ffd84a', drip: '#d9200f' },
  egg: { emoji: '🥚', name: 'EGG', base: '#fbfbf2', edge: '#e8e6d4', bits: '#ffb300', drip: '#f7f3dc', yolk: true },
  vomit: { emoji: '🤮', name: 'VOMIT', base: '#a9c940', edge: '#8db52b', bits: '#e8892c', drip: '#9acd32' },
  water: { emoji: '💧', name: 'WATER', base: 'rgba(120,200,255,0.45)', edge: 'rgba(80,160,255,0.35)', bits: 'rgba(255,255,255,0.7)', drip: 'rgba(110,190,255,0.45)', fade: true },
};
export const AMMO_ORDER = ['pie', 'tomato', 'egg', 'water'];

export const SHARPIE_COLORS = ['#111111', '#e0102a', '#1447e6', '#15a915', '#ff3ea5'];

// Blobby splat with droplets. (x, y) in paint pixels, sx = sideways stretch.
function blob(ctx, x, y, r, sx, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sx, 1);
  ctx.fillStyle = color;
  ctx.beginPath();
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (i % 2 ? rnd(0.55, 0.8) : rnd(0.9, 1.35));
    const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.quadraticCurveTo(Math.cos(a - Math.PI / n) * r * 1.2, Math.sin(a - Math.PI / n) * r * 1.2, px, py);
  }
  ctx.fill();
  // flung droplets
  for (let i = 0; i < 10; i++) {
    const a = rnd(0, Math.PI * 2), d = r * rnd(1.3, 2.3);
    ctx.beginPath();
    ctx.arc(Math.cos(a) * d, Math.sin(a) * d, r * rnd(0.06, 0.18), 0, 7);
    ctx.fill();
  }
  ctx.restore();
}

export class Painter {
  constructor(head) {
    this.head = head;
    this.drips = [];
    this.lastStroke = null;
  }

  splat(uv1, kind, scale = 1) {
    const h = this.head, A = AMMO[kind], ctx = h.paintCtx;
    const { x, y, sx } = h.paintPx(uv1);
    const r = rnd(60, 85) * scale;
    if (A.fade) {
      // Water goes on the wet layer, which dries off after a few seconds.
      blob(h.wetCtx, x, y, r * 1.3, sx, A.base);
      blob(h.wetCtx, x, y, r * 0.5, sx, A.bits);
      h.wetAlpha = 1;
    } else {
      blob(ctx, x, y, r, sx, A.edge);
      blob(ctx, x, y, r * 0.8, sx, A.base);
      ctx.fillStyle = A.bits;
      if (A.yolk) {
        ctx.beginPath();
        ctx.ellipse(x + rnd(-6, 6), y + rnd(-6, 6), r * 0.42 * sx, r * 0.42, 0, 0, 7);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath();
        ctx.arc(x - r * 0.12 * sx, y - r * 0.14, r * 0.1, 0, 7);
        ctx.fill();
      } else {
        for (let i = 0; i < 12; i++) {
          ctx.beginPath();
          ctx.ellipse(x + rnd(-r, r) * 0.7 * sx, y + rnd(-r, r) * 0.7, rnd(2, 6) * sx, rnd(2, 5), rnd(0, 3), 0, 7);
          ctx.fill();
        }
      }
    }
    // Gravity does the rest.
    const nd = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < nd; i++) {
      this.drips.push({
        x: x + rnd(-r, r) * 0.7 * sx, y: y + r * 0.4, w: rnd(5, 11) * sx,
        speed: rnd(25, 60), left: rnd(40, 160), color: A.drip, fade: A.fade,
      });
    }
    h.paintDirty = true;
  }

  // A soft round mark (bee stings).
  mark(uv1, color, r = 16) {
    const h = this.head, ctx = h.paintCtx;
    const { x, y, sx } = h.paintPx(uv1);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sx, 1);
    const g = ctx.createRadialGradient(0, 0, 1, 0, 0, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(255,60,60,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, 7);
    ctx.fill();
    ctx.restore();
    h.paintDirty = true;
  }

  // Sharpie: connect this point to the previous one while the pen stays down.
  stroke(uv1, color, width = 14) {
    const h = this.head, ctx = h.paintCtx;
    const p = h.paintPx(uv1);
    const last = this.lastStroke;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = width;
    // Skip the seam at the back of the head, or the line would wrap across the whole map.
    if (last && Math.abs(last.x - p.x) < h.paintCanvas.width * 0.25) {
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, width / 2, 0, 7);
      ctx.fill();
    }
    this.lastStroke = p;
    h.paintDirty = true;
  }
  penUp() { this.lastStroke = null; }

  update(dt) {
    const h = this.head, ctx = h.paintCtx;
    if (this.drips.length) {
      for (const d of this.drips) {
        const step = Math.min(d.left, d.speed * dt);
        if (step <= 0) continue;
        const g = d.fade ? h.wetCtx : ctx;
        g.fillStyle = d.color;
        g.beginPath();
        g.ellipse(d.x, d.y + step / 2, d.w / 2, step / 2 + d.w / 2, 0, 0, 7);
        g.fill();
        d.y += step;
        d.left -= step;
        d.w *= 0.995;
        d.speed *= 0.99;
      }
      this.drips = this.drips.filter((d) => d.left > 0.5);
      h.paintDirty = true;
    }
    if (h.wetAlpha > 0) {
      const before = Math.ceil(h.wetAlpha * 20);
      h.wetAlpha -= dt / 6;
      if (h.wetAlpha <= 0) { h.wetAlpha = 0; h.wetCtx.clearRect(0, 0, h.wetCanvas.width, h.wetCanvas.height); }
      // Only re-upload the texture in 20 steps while drying, not every frame.
      if (Math.ceil(h.wetAlpha * 20) !== before) h.paintDirty = true;
    }
  }
}
