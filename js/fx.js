// Emoji particle chaos.
import * as THREE from 'three';

const texCache = new Map();
export function emojiTex(e) {
  if (texCache.has(e)) return texCache.get(e);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.font = '100px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(e, 64, 72);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(e, t);
  return t;
}

const rnd = (a, b) => a + Math.random() * (b - a);

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.parts = [];
    this.orbits = [];
  }

  burst(pos, emojis, count = 20, { speed = 4, gravity = -6, life = 1.6, size = 0.35, spread = 1, dir = null } = {}) {
    count = Math.max(1, Math.round(count * (this.density ?? 1))); // fewer in low-effects mode
    for (let i = 0; i < count; i++) {
      const e = emojis[Math.floor(Math.random() * emojis.length)];
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex(e), transparent: true, depthWrite: false }));
      sp.position.copy(pos);
      const s = size * rnd(0.6, 1.4);
      sp.scale.setScalar(s);
      const rand = new THREE.Vector3(rnd(-1, 1), rnd(-0.2, 1.2), rnd(-0.3, 1)).normalize();
      // With a direction, particles fly that way with a bit of scatter (fire breath, spit).
      const v = dir
        ? dir.clone().normalize().multiplyScalar(speed * rnd(0.7, 1.2)).addScaledVector(rand, speed * 0.25 * spread)
        : rand.multiplyScalar(speed * rnd(0.5, 1.2) * spread);
      this.parts.push({
        sp, v, g: gravity,
        life: life * rnd(0.7, 1.2), age: 0, s, spin: rnd(-8, 8),
      });
      this.scene.add(sp);
    }
  }

  // Cartoon dizzy ring orbiting above a parent object.
  dizzy(parent, y = 1.6, dur = 2.5, emojis = ['⭐', '💫', '🐤', '⭐', '💫']) {
    const ring = new THREE.Group();
    ring.position.y = y;
    emojis.forEach((e, i) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex(e), transparent: true, depthWrite: false }));
      sp.scale.setScalar(0.35);
      const a = (i / emojis.length) * Math.PI * 2;
      sp.position.set(Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9);
      ring.add(sp);
    });
    parent.add(ring);
    this.orbits.push({ ring, age: 0, dur });
  }

  clearOrbits() {
    for (const o of this.orbits) o.ring.removeFromParent();
    this.orbits.length = 0;
  }

  update(dt) {
    for (const p of this.parts) {
      p.age += dt;
      p.v.y += p.g * dt;
      p.sp.position.addScaledVector(p.v, dt);
      p.sp.material.rotation += p.spin * dt;
      const k = 1 - p.age / p.life;
      p.sp.material.opacity = Math.min(1, k * 3);
      p.sp.scale.setScalar(p.s * (0.6 + 0.4 * Math.min(1, p.age * 8)));
    }
    this.parts = this.parts.filter((p) => {
      if (p.age < p.life) return true;
      p.sp.removeFromParent();
      p.sp.material.dispose();
      return false;
    });
    for (const o of this.orbits) {
      o.age += dt;
      o.ring.rotation.y += dt * 5;
      o.ring.position.y += Math.sin(o.age * 10) * 0.004;
      const fade = Math.min(1, (o.dur - o.age) * 2);
      o.ring.children.forEach((c) => (c.material.opacity = fade));
    }
    this.orbits = this.orbits.filter((o) => {
      if (o.age < o.dur) return true;
      o.ring.removeFromParent();
      return false;
    });
  }
}
