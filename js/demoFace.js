// Default Dave: a hand-drawn face for people too shy to upload their own.
export function makeDemoFace() {
  const W = 512, H = 640;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const fw = Math.min(W, H) * 0.55, cx = W / 2, cy = H * 0.5;
  const P = (u, v) => [cx + u * fw, cy + v * fw];

  g.fillStyle = '#6b3b1f';
  g.fillRect(0, 0, W, H);
  // skin
  const skin = g.createRadialGradient(cx, cy, 20, cx, cy, 260);
  skin.addColorStop(0, '#ffd2a8');
  skin.addColorStop(1, '#e9a877');
  g.fillStyle = skin;
  g.beginPath();
  g.ellipse(cx, cy + 10, fw * 0.62, fw * 0.95, 0, 0, Math.PI * 2);
  g.fill();
  // hair swoop
  g.fillStyle = '#6b3b1f';
  g.beginPath();
  g.moveTo(0, 0); g.lineTo(W, 0); g.lineTo(W, P(0, -0.3)[1]);
  g.quadraticCurveTo(...P(0.3, -0.62), ...P(-0.05, -0.42));
  g.quadraticCurveTo(...P(-0.35, -0.55), 0, P(0, -0.25)[1]);
  g.fill();
  // cheeks
  g.fillStyle = 'rgba(255,80,110,0.35)';
  for (const s of [-1, 1]) { g.beginPath(); g.arc(...P(0.28 * s, 0.17), fw * 0.08, 0, 7); g.fill(); }
  // brows
  g.strokeStyle = '#3a1d0c'; g.lineWidth = 12; g.lineCap = 'round';
  for (const s of [-1, 1]) {
    g.beginPath(); g.moveTo(...P(0.1 * s, -0.19)); g.quadraticCurveTo(...P(0.2 * s, -0.25), ...P(0.3 * s, -0.18)); g.stroke();
  }
  // eyes
  for (const s of [-1, 1]) {
    g.fillStyle = '#fff';
    g.beginPath(); g.ellipse(...P(0.2 * s, -0.06), fw * 0.085, fw * 0.06, 0, 0, 7); g.fill();
    g.fillStyle = '#2b6cff';
    g.beginPath(); g.arc(...P(0.2 * s + 0.01, -0.055), fw * 0.035, 0, 7); g.fill();
    g.fillStyle = '#000';
    g.beginPath(); g.arc(...P(0.2 * s + 0.01, -0.055), fw * 0.018, 0, 7); g.fill();
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(...P(0.2 * s - 0.003, -0.068), fw * 0.008, 0, 7); g.fill();
  }
  // nose
  g.strokeStyle = '#c9794a'; g.lineWidth = 6;
  g.beginPath(); g.moveTo(...P(0, -0.02)); g.quadraticCurveTo(...P(-0.05, 0.12), ...P(-0.03, 0.14)); g.quadraticCurveTo(...P(0, 0.16), ...P(0.04, 0.14)); g.stroke();
  // mouth
  g.fillStyle = '#b22a3a';
  g.beginPath(); g.moveTo(...P(-0.16, 0.3)); g.quadraticCurveTo(...P(0, 0.4), ...P(0.16, 0.3)); g.quadraticCurveTo(...P(0, 0.33), ...P(-0.16, 0.3)); g.fill();
  g.strokeStyle = '#7a1522'; g.lineWidth = 5;
  g.beginPath(); g.moveTo(...P(-0.16, 0.3)); g.quadraticCurveTo(...P(0, 0.34), ...P(0.16, 0.3)); g.stroke();
  // stubble dots
  g.fillStyle = 'rgba(80,40,20,0.25)';
  for (let i = 0; i < 260; i++) {
    const a = Math.random() * Math.PI, r = fw * (0.38 + Math.random() * 0.15);
    const [x, y] = [cx + Math.cos(a) * r * 0.9, cy + 0.12 * fw + Math.sin(a) * r * 0.75];
    g.fillRect(x, y, 2, 2);
  }
  return c;
}
