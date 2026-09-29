// 3D steam: puffy clouds that shoot out of the ears when the head is furious, rise, swell, and melt away.
import * as THREE from 'three';

const MAX = 260;
const LIFE = 1.1; // seconds a puff lives
const rnd = (a, b) => a + Math.random() * (b - a);

export class Steam {
  constructor(scene) {
    this.mesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 2),
      new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, metalness: 0, transparent: true, opacity: 0.88, depthWrite: false }),
      MAX,
    );
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2; // after the head, so the see-through puffs blend over it
    scene.add(this.mesh);
    this.parts = [];
    this.carry = 0;
    this.density = 1; // low-effects mode halves it
    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();
  }

  // Call every frame while the head fumes. dir points out of the ear. rate = puffs per second.
  stream(origin, dir, dt, rate) {
    this.carry += rate * this.density * dt;
    while (this.carry >= 1) {
      this.carry -= 1;
      if (this.parts.length >= MAX) this.parts.shift();
      const v = dir.clone().multiplyScalar(rnd(1.5, 2.4));
      v.y += rnd(1.0, 1.8); // steam rises
      v.x += rnd(-0.3, 0.3); v.z += rnd(-0.3, 0.3);
      this.parts.push({ p: origin.clone(), v, age: 0, size: rnd(0.07, 0.13), grey: rnd(0.86, 1), spin: rnd(0, 6) });
    }
  }

  clear() {
    this.parts = [];
    this.carry = 0;
    this.mesh.count = 0;
  }

  update(dt) {
    const d = this.dummy;
    for (const s of this.parts) {
      s.age += dt;
      s.p.addScaledVector(s.v, dt);
      s.v.multiplyScalar(Math.pow(0.12, dt)); // air drag: a fast jet that slows into a drifting cloud
      s.v.y += 0.9 * dt; // and keeps floating up
    }
    this.parts = this.parts.filter((s) => s.age < LIFE);
    const n = this.parts.length;
    for (let i = 0; i < n; i++) {
      const s = this.parts[i];
      const u = s.age / LIFE;
      // Pops out small, swells into a cloud, then shrinks away at the end.
      const grow = Math.min(1, u * 5);
      const fade = u > 0.6 ? 1 - (u - 0.6) / 0.4 : 1;
      const r = s.size * (0.4 + grow * 1.9 + u * 1.2) * fade;
      d.position.copy(s.p);
      d.rotation.set(s.spin, s.spin * 0.7, 0);
      d.scale.set(r, r * 0.85, r);
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
      this.mesh.setColorAt(i, this.color.setScalar(s.grey));
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
