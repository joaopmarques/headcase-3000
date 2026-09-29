// Nuclear meltdown: fireball, a rolling 3D mushroom cloud, a shockwave ring, and a flash.
import * as THREE from 'three';

const FLOOR = -1.98;
const DURATION = 6.5; // seconds until the cloud is gone
const rnd = (a, b) => a + Math.random() * (b - a);
const smooth = (x) => x * x * (3 - 2 * x);
const clamp01 = (x) => Math.max(0, Math.min(1, x));

// Colors a puff goes through as it cools: white-hot, yellow, orange, ember, smoke.
const HEAT = ['#ffffff', '#fff3a0', '#ffb030', '#ff6a1a', '#c8481c', '#8f7266', '#7a716c'].map((c) => new THREE.Color(c));
function heatColor(h, out) {
  // h: 1 = hottest, 0 = cold smoke
  const x = (1 - clamp01(h)) * (HEAT.length - 1);
  const i = Math.min(HEAT.length - 2, Math.floor(x));
  return out.copy(HEAT[i]).lerp(HEAT[i + 1], x - i);
}

export class Nuke {
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    this.t = 0;
    this.shake = 0; // camera shake amount, read by main
    this.zoom = 0;  // camera pull-back, 0..1, read by main
    const puffGeo = new THREE.IcosahedronGeometry(1, 2);
    this.puffMat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, transparent: true, emissive: 0xffffff, emissiveIntensity: 0.9 });
    // Per-instance colors drive both color and glow (emissive reads the instance color below).
    this.puffMat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace(
        'vec3 totalEmissiveRadiance = emissive;',
        'vec3 totalEmissiveRadiance = emissive * vColor * vColor * uGlow;',
      ).replace('#include <common>', '#include <common>\nuniform float uGlow;');
      sh.uniforms.uGlow = this.glow;
    };
    this.glow = { value: 1 };
    this.puffs = new THREE.InstancedMesh(puffGeo, this.puffMat, 320);
    this.puffs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.puffs.frustumCulled = false;
    this.puffs.count = 0;
    for (let i = 0; i < 320; i++) this.puffs.setColorAt(i, new THREE.Color(1, 1, 1));

    this.fireball = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 3), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 96), new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2;
    this.light = new THREE.PointLight(0xffc060, 0, 30, 1.5);
    this.group = new THREE.Group();
    this.group.add(this.puffs, this.fireball, this.ring, this.light);
    this.group.visible = false;
    scene.add(this.group);
    this.dummy = new THREE.Object3D();
    this.tmpC = new THREE.Color();
  }

  detonate(origin) {
    this.active = true;
    this.t = 0;
    this.origin = origin.clone();
    this.group.visible = true;
    this.group.position.set(origin.x, 0, origin.z);
    this.shake = 1;
    // Seed the puffs: stem, rolling cap (a torus), and a skirt of dust along the floor.
    this.parts = [];
    for (let i = 0; i < 70; i++) this.parts.push({ kind: 'stem', a: rnd(0, Math.PI * 2), r: rnd(0, 0.35), y: rnd(0, 1), size: rnd(0.28, 0.5), seed: rnd(0, 10) });
    for (let i = 0; i < 170; i++) this.parts.push({ kind: 'cap', a: rnd(0, Math.PI * 2), phi: rnd(0, Math.PI * 2), rr: rnd(0.6, 1), size: rnd(0.35, 0.7), seed: rnd(0, 10) });
    for (let i = 0; i < 45; i++) this.parts.push({ kind: 'skirt', a: rnd(0, Math.PI * 2), r: rnd(0.3, 1), size: rnd(0.25, 0.55), seed: rnd(0, 10) });
    this.puffs.count = this.parts.length;
  }

  update(dt) {
    if (!this.active) { this.shake = Math.max(0, this.shake - dt); this.zoom = Math.max(0, this.zoom - dt * 0.8); return; }
    this.t += dt;
    const t = this.t;
    const oy = this.origin.y;

    // Camera: shake hard, pull back to fit the cloud, then settle.
    this.shake = Math.max(0, 1 - t / 1.6);
    this.zoom = t < 5 ? Math.min(1, t * 1.6) : Math.max(0, 1 - (t - 5) / 1.5);

    // Fireball: blows up fast, rises, fades.
    const fb = clamp01(t / 0.45);
    const fbFade = clamp01(1 - (t - 0.2) / 0.6); // a quick white-hot flash, not a lingering disc
    this.fireball.visible = fbFade > 0;
    this.fireball.position.set(0, oy + t * 0.9, 0);
    this.fireball.scale.setScalar(0.3 + smooth(fb) * 1.9);
    heatColor(1 - t * 0.8, this.fireball.material.color);
    this.fireball.material.opacity = fbFade;

    // Shockwave ring races across the floor.
    const rw = clamp01(t / 1.1);
    this.ring.position.y = FLOOR + 0.02;
    this.ring.scale.setScalar(0.5 + rw * 11);
    this.ring.material.opacity = (1 - rw) * 0.9;

    // Light flash.
    this.light.position.set(0, oy + 1, 1.5);
    this.light.intensity = Math.max(0, 60 * (1 - t / 1.2)) + Math.max(0, 8 * (1 - t / 4));

    // Cloud shape over time.
    const rise = smooth(clamp01(t / 3.2));            // 0..1
    const capY = oy + 0.6 + rise * 2.9;               // cap climbs above the head
    const capR = 0.5 + smooth(clamp01(t / 2.4)) * 1.7; // torus grows
    const tube = 0.45 + rise * 0.45;
    const stemTop = capY - tube * 0.6;
    const fade = clamp01(1 - (t - (DURATION - 1.8)) / 1.8); // whole cloud fades at the end
    this.puffMat.opacity = fade;
    this.glow.value = Math.max(0.3, 1.4 - t * 0.25);
    const d = this.dummy, c = this.tmpC;
    this.parts.forEach((p, i) => {
      let x, y, z, s, heat;
      if (p.kind === 'cap') {
        // Roll: each puff circles the torus tube, moving outward at the bottom and up over the top.
        const phi = p.phi + t * 1.6;
        const R = capR + Math.cos(phi) * tube * p.rr;
        x = Math.cos(p.a) * R;
        z = Math.sin(p.a) * R;
        y = capY + Math.sin(phi) * tube * p.rr * 0.8 + Math.sin(t * 2 + p.seed) * 0.05;
        s = p.size * (0.5 + rise * 0.9);
        // The underside keeps glowing while the top cools to smoke.
        heat = 1.05 - t * 0.22 + (Math.sin(phi) < 0 ? 0.25 : -0.1);
      } else if (p.kind === 'stem') {
        // Stem: a column from the floor up to the cap, swirling upward.
        const h = (p.y + t * 0.35) % 1;
        y = FLOOR + (stemTop - FLOOR) * h;
        const wob = 0.25 + (1 - h) * 0.25;
        x = Math.cos(p.a + t * 2) * p.r * wob * 2;
        z = Math.sin(p.a + t * 2) * p.r * wob * 2;
        s = p.size * (0.7 + (1 - h) * 0.5) * clamp01(t * 2.5);
        heat = 1 - t * 0.22 - h * 0.1;
      } else {
        // Skirt: dust rolling out along the floor.
        const R = (0.4 + smooth(clamp01(t / 1.6)) * 3.6) * p.r;
        x = Math.cos(p.a) * R;
        z = Math.sin(p.a) * R;
        y = FLOOR + 0.15 + Math.sin(t * 3 + p.seed) * 0.05;
        s = p.size * 0.6 * (0.6 + smooth(clamp01(t / 1.6)) * 1.1);
        heat = 0.6 - t * 0.3;
      }
      d.position.set(x, y, z);
      d.scale.setScalar(Math.max(0.001, s * (0.6 + 0.4 * fade)));
      d.rotation.set(p.seed, p.seed * 2, 0);
      d.updateMatrix();
      this.puffs.setMatrixAt(i, d.matrix);
      this.puffs.setColorAt(i, heatColor(heat, c));
    });
    this.puffs.instanceMatrix.needsUpdate = true;
    this.puffs.instanceColor.needsUpdate = true;

    if (t >= DURATION) {
      this.active = false;
      this.group.visible = false;
      this.puffs.count = 0;
    }
  }
}
