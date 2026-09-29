// 3D vomit. Glossy blobs pour out of the mouth, fall, and flatten into a puddle on the floor.
import * as THREE from 'three';

const MAX = 700;
const FLOOR = -1.98; // just above the shadow plane
const GRAVITY = -11;
const PUDDLE_LIFE = 7;
const rnd = (a, b) => a + Math.random() * (b - a);

// Mostly green-yellow goo, with the odd carrot chunk.
const GOO = ['#9acd32', '#b3cf3a', '#c7c23c', '#8db52b', '#d6c44a', '#a9c940'];
const CHUNKS = ['#e8892c', '#f2d08a', '#e07a22'];

export class Vomit {
  constructor(scene) {
    this.mesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 2),
      new THREE.MeshPhysicalMaterial({ roughness: 0.22, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.15 }),
      MAX,
    );
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.color = new THREE.Color();
    for (let i = 0; i < MAX; i++) this.mesh.setColorAt(i, this.color.set(GOO[0]));
    scene.add(this.mesh);
    this.parts = [];
    this.carry = 0;
    this.dummy = new THREE.Object3D();
    this.up = new THREE.Vector3(0, 1, 0);
    this.onSplat = null; // optional callback when blobs hit the floor
  }

  spawn(origin, dir, { speed = 4.5, size = 1, chunkChance = 0.12 } = {}) {
    if (this.parts.length >= MAX) this.parts.shift();
    const chunk = Math.random() < chunkChance;
    const v = dir.clone().normalize().multiplyScalar(speed * rnd(0.75, 1.2));
    v.x += rnd(-0.5, 0.5); v.y += rnd(-0.4, 0.4); v.z += rnd(-0.3, 0.3);
    this.parts.push({
      p: origin.clone().add(new THREE.Vector3(rnd(-0.05, 0.05), rnd(-0.03, 0.03), 0)),
      v,
      r: (chunk ? rnd(0.035, 0.06) : rnd(0.045, 0.1)) * size,
      color: (chunk ? CHUNKS : GOO)[Math.floor(Math.random() * (chunk ? CHUNKS.length : GOO.length))],
      state: 'fly',
      age: 0,
      spin: new THREE.Vector3(rnd(0, 6), rnd(0, 6), rnd(0, 6)),
      spread: rnd(1.8, 2.8),
    });
  }

  // Call every frame while the head is puking. rate = blobs per second.
  stream(origin, dir, dt, rate = 170) {
    this.carry += rate * dt;
    while (this.carry >= 1) {
      this.carry -= 1;
      this.spawn(origin, dir);
    }
  }

  // A small wet spray (spitting out broccoli).
  spit(origin, dir, count = 14) {
    for (let i = 0; i < count; i++) this.spawn(origin, dir, { speed: 5.5, size: 0.6, chunkChance: 0.35 });
  }

  clear() {
    this.parts = [];
    this.mesh.count = 0;
  }

  update(dt) {
    const d = this.dummy;
    let splats = 0;
    for (const b of this.parts) {
      b.age += dt;
      if (b.state === 'fly') {
        b.v.y += GRAVITY * dt;
        b.p.addScaledVector(b.v, dt);
        if (b.p.y - b.r * 0.3 <= FLOOR) {
          b.state = 'puddle';
          b.age = 0;
          b.p.y = FLOOR + 0.004 + Math.random() * 0.006;
          b.v.set(b.v.x * 0.15, 0, b.v.z * 0.15);
          splats++;
        }
      } else {
        // Puddle blobs slide a little, then shrink away.
        b.p.addScaledVector(b.v, dt);
        b.v.multiplyScalar(Math.pow(0.05, dt));
      }
    }
    this.parts = this.parts.filter((b) => b.state === 'fly' ? b.p.y > FLOOR - 1 : b.age < PUDDLE_LIFE);
    if (splats && this.onSplat) this.onSplat(splats);

    const n = this.parts.length;
    for (let i = 0; i < n; i++) {
      const b = this.parts[i];
      d.position.copy(b.p);
      if (b.state === 'fly') {
        // Stretch along the direction of travel: goo, not marbles.
        const speed = b.v.length();
        d.quaternion.setFromUnitVectors(this.up, b.v.clone().divideScalar(speed || 1));
        const stretch = 1 + Math.min(1.6, speed * 0.12);
        d.scale.set(b.r / Math.sqrt(stretch), b.r * stretch, b.r / Math.sqrt(stretch));
      } else {
        // Flatten into a splat that grows out fast, then shrinks near the end of its life.
        const grow = Math.min(1, b.age * 8);
        const fade = b.age > PUDDLE_LIFE - 1.5 ? (PUDDLE_LIFE - b.age) / 1.5 : 1;
        const w = b.r * (1 + (b.spread - 1) * grow) * fade;
        d.quaternion.identity();
        d.scale.set(w, b.r * 0.22 * fade + 0.001, w);
      }
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
      this.mesh.setColorAt(i, this.color.set(b.color));
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
