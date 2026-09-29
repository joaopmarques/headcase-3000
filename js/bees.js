// A bee swarm that orbits the head, dive-bombs it, and can be swatted.
import * as THREE from 'three';
import { emojiTex } from './fx.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const SIZE = 0.3;

export class Bees {
  // app: { head(), painter(), rig, camera, stage, sfx, fx, grunt, react, addRage, st, onGone() }
  constructor(app) {
    this.app = app;
    this.list = [];
    this.buzz = null;
    this.nextSting = 0;
    this.lastShoo = 0;
  }

  get active() { return this.list.some((b) => b.state !== 'dead'); }

  start(count = 7) {
    this.stop(true);
    this.gen = (this.gen ?? 0) + 1;
    const { app } = this;
    for (let i = 0; i < count; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex('🐝'), transparent: true, depthWrite: false }));
      sp.scale.setScalar(SIZE);
      app.rig.parent.add(sp);
      this.list.push({
        sp, state: 'orbit', t: 0,
        a: rnd(0, Math.PI * 2), speed: rnd(1.2, 2.4) * (Math.random() < 0.5 ? -1 : 1),
        r: rnd(1.5, 2.1), yph: rnd(0, 6), seed: rnd(0, 100), lastX: 0,
      });
    }
    this.buzz = app.sfx.startBuzz();
    this.nextSting = performance.now() + 2200;
  }

  stop(silent = false) {
    for (const b of this.list) b.sp.removeFromParent();
    this.list = [];
    this.buzz?.stop();
    this.buzz = null;
    if (!silent) this.app.onGone();
  }

  orbitPos(b, t, out) {
    const c = this.app.rig.position;
    const j = 0.06;
    return out.set(
      c.x + Math.cos(b.a) * b.r + Math.sin(t * 23 + b.seed) * j,
      c.y + 0.35 + Math.sin(t * 1.3 + b.yph) * 0.8 + Math.sin(t * 29 + b.seed * 2) * j,
      c.z + Math.sin(b.a) * b.r * 0.9,
    );
  }

  // Swat a bee near the click. Screen-space test, because bees are small and fast.
  swatAt(clientX, clientY) {
    const { camera, stage } = this.app;
    const r = stage.getBoundingClientRect();
    const v = new THREE.Vector3();
    let best = null, bd = 48;
    for (const b of this.list) {
      if (b.state === 'dead') continue;
      v.copy(b.sp.position).project(camera);
      const d = Math.hypot(r.left + (v.x * 0.5 + 0.5) * r.width - clientX, r.top + (-v.y * 0.5 + 0.5) * r.height - clientY);
      if (d < bd) { bd = d; best = b; }
    }
    if (!best) return false;
    const { sfx, fx, react } = this.app;
    best.state = 'dead';
    best.t = 0;
    best.vel = new THREE.Vector3(rnd(-1, 1), 2, rnd(-0.5, 0.5));
    sfx.slap();
    fx.burst(best.sp.position, ['💥', '✨'], 4, { speed: 2, size: 0.25, life: 0.5 });
    react('swat', { force: true });
    this.app.ach?.().bump('swat');
    if (!this.active) {
      const gen = this.gen;
      setTimeout(() => {
        if (gen !== this.gen) return; // a new swarm started meanwhile
        this.stop();
        react('beesGone', { force: true });
      }, 900);
    }
    return true;
  }

  sting(b) {
    const { app } = this;
    const head = app.head();
    if (!head || !head.group.visible) return;
    head.addWelt(b.vi);
    const uv1 = new THREE.Vector2().fromBufferAttribute(head.geo.attributes.uv1, b.vi);
    app.painter().mark(uv1, 'rgba(235,40,50,0.8)', 18);
    app.sfx.sting();
    app.grunt('yelp');
    app.st.rot.y.kick(rnd(-8, 8));
    app.st.rot.x.kick(rnd(-3, 3));
    head.s.jaw.kick(8);
    head.s.brow.kick(10);
    app.fx.burst(b.sp.position, ['💢', '❗'], 2, { speed: 1.5, size: 0.25, life: 0.6 });
    app.addRage(8);
    app.ach?.().bump('sting');
    app.react('sting', { force: true });
  }

  update(dt, t) {
    if (!this.list.length) return;
    const { app } = this;
    const head = app.head();
    const now = performance.now();
    const tmp = new THREE.Vector3();

    // Pick a diver now and then.
    if (head && head.group.visible && now > this.nextSting) {
      const free = this.list.filter((b) => b.state === 'orbit');
      if (free.length) {
        const b = free[Math.floor(Math.random() * free.length)];
        // Random spot on the front of the face.
        let vi = 0;
        for (let k = 0; k < 30; k++) {
          vi = Math.floor(Math.random() * head.n);
          if (head.base[vi * 3 + 2] > 0.45) break;
        }
        b.state = 'dive';
        b.t = 0;
        b.vi = vi;
        b.from = b.sp.position.clone();
      }
      this.nextSting = now + rnd(2200, 4200);
    }

    let close = 0;
    for (const b of this.list) {
      b.t += dt;
      const p = b.sp.position;
      const prevX = p.x;
      if (b.state === 'orbit') {
        b.a += b.speed * dt;
        this.orbitPos(b, t, p);
      } else if (b.state === 'dive') {
        head.vertexPos(b.vi, tmp);
        head.mesh.localToWorld(tmp);
        const u = Math.min(1, b.t / 0.35);
        p.lerpVectors(b.from, tmp, u * u);
        if (u >= 1) { this.sting(b); b.state = 'return'; b.t = 0; b.from = p.clone(); }
      } else if (b.state === 'return') {
        b.a += b.speed * dt;
        const u = Math.min(1, b.t / 0.5);
        this.orbitPos(b, t, tmp);
        p.lerpVectors(b.from, tmp, u);
        if (u >= 1) b.state = 'orbit';
      } else if (b.state === 'dead') {
        b.vel.y -= 9 * dt;
        p.addScaledVector(b.vel, dt);
        b.sp.material.rotation += dt * 12;
        b.sp.material.opacity = Math.max(0, 1 - b.t);
      }
      // Face the way it flies (the emoji looks left).
      const dx = p.x - prevX;
      if (Math.abs(dx) > 1e-4 && b.state !== 'dead') b.sp.scale.set(dx > 0 ? -SIZE : SIZE, SIZE, 1);
      if (b.state !== 'dead') close = Math.max(close, 1 - Math.min(1, p.distanceTo(app.camera.position) / 9));
    }
    this.list = this.list.filter((b) => {
      if (b.state === 'dead' && b.t > 1.2) { b.sp.removeFromParent(); return false; }
      return true;
    });
    const alive = this.list.filter((b) => b.state !== 'dead').length;
    this.buzz?.set(alive ? 0.4 + close * 0.8 : 0);

    // The head shakes them off its face now and then.
    if (head && alive && now - this.lastShoo > 3500) {
      const face = tmp.set(0, 0, 1.2).applyMatrix4(head.mesh.matrixWorld);
      if (this.list.some((b) => b.state === 'orbit' && b.sp.position.distanceTo(face) < 1)) {
        this.lastShoo = now;
        app.st.rot.y.kick(rnd(-10, 10));
        app.grunt('hmph');
        app.react('shoo');
      }
    }
  }
}
