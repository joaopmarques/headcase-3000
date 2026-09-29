// Accessories that ride the deformed head: googly eyes, hat, stache, shades, clown nose, tongue.
import * as THREE from 'three';

const Z = new THREE.Vector3(0, 0, 1);
const tmpP = new THREE.Vector3(), tmpN = new THREE.Vector3(), tmpQ = new THREE.Quaternion();

function stripeTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  const cols = ['#ff3ea5', '#ffe600', '#00e5ff', '#7a2cff', '#b6ff00'];
  for (let i = 0; i < 16; i++) {
    g.fillStyle = cols[i % cols.length];
    g.beginPath();
    g.moveTo(i * 32 - 128, 256); g.lineTo(i * 32 - 96, 256); g.lineTo(i * 32 + 32, 0); g.lineTo(i * 32, 0);
    g.fill();
  }
  g.fillStyle = '#fff';
  for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 5, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

class GooglyEye {
  constructor(r) {
    this.r = r;
    this.obj = new THREE.Group();
    const white = new THREE.Mesh(new THREE.CylinderGeometry(r, r, r * 0.35, 40),
      new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.15, clearcoat: 1 }));
    white.rotation.x = Math.PI / 2;
    white.position.z = r * 0.15;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.06, 8, 40), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    rim.position.z = r * 0.32;
    this.pupil = new THREE.Mesh(new THREE.CircleGeometry(r * 0.48, 32), new THREE.MeshBasicMaterial({ color: 0x050505 }));
    this.pupil.position.z = r * 0.34;
    const shine = new THREE.Mesh(new THREE.CircleGeometry(r * 0.12, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    shine.position.set(-r * 0.15, r * 0.15, 0.001);
    this.pupil.add(shine);
    this.obj.add(white, rim, this.pupil);
    this.p = new THREE.Vector2(0, -r * 0.3);
    this.v = new THREE.Vector2();
    this.lastWorld = null;
    this.lastVel = new THREE.Vector3();
  }
  update(dt) {
    if (dt <= 0) return;
    const wp = this.obj.getWorldPosition(new THREE.Vector3());
    const vel = this.lastWorld ? wp.clone().sub(this.lastWorld).divideScalar(dt) : new THREE.Vector3();
    const acc = vel.clone().sub(this.lastVel).divideScalar(dt).clampLength(0, 400);
    this.lastWorld = wp; this.lastVel = vel;
    // Gravity minus head acceleration, expressed in the eye's local frame.
    const g = new THREE.Vector3(0, -9.8, 0).sub(acc.multiplyScalar(0.35));
    const q = this.obj.getWorldQuaternion(new THREE.Quaternion()).invert();
    g.applyQuaternion(q);
    this.v.x += g.x * dt * 0.6; this.v.y += g.y * dt * 0.6;
    this.v.multiplyScalar(Math.pow(0.2, dt));
    this.p.addScaledVector(this.v, dt);
    const max = this.r * 0.5;
    if (this.p.length() > max) {
      const n = this.p.clone().normalize();
      this.p.copy(n).multiplyScalar(max);
      const vn = this.v.dot(n);
      if (vn > 0) this.v.addScaledVector(n, -vn * 1.6);
    }
    this.pupil.position.x = this.p.x;
    this.pupil.position.y = this.p.y;
  }
}

export class Props {
  constructor(head) {
    this.head = head;
    this.on = {};
    this.items = {};
    const g = head.group;
    const k = head.fit.k;
    const F = head.fit.features;
    const eyeSpan = Math.hypot(F.eyeR.x - F.eyeL.x, F.eyeR.y - F.eyeL.y) * k;

    // Googly eyes
    const rL = Math.max(0.1, head.eyeSize.L * 1.25), rR = Math.max(0.1, head.eyeSize.R * 1.25);
    this.eyes = [new GooglyEye(rL), new GooglyEye(rR)];
    const eyes = new THREE.Group();
    eyes.add(this.eyes[0].obj, this.eyes[1].obj);
    this.items.googly = eyes;

    // Party hat
    const hat = new THREE.Group();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.38, 1.0, 40, 1, true),
      new THREE.MeshStandardMaterial({ map: stripeTexture(), side: THREE.DoubleSide, roughness: 0.6 }));
    cone.position.y = 0.45;
    const pom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 2), new THREE.MeshStandardMaterial({ color: 0xffe600, roughness: 1 }));
    pom.position.y = 0.97;
    const brim = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.05, 8, 40), new THREE.MeshStandardMaterial({ color: 0xff3ea5 }));
    brim.rotation.x = Math.PI / 2;
    brim.position.y = -0.04;
    hat.add(cone, pom, brim);
    this.hatInner = hat;
    const hatWrap = new THREE.Group();
    hatWrap.add(hat);
    hat.rotation.z = -0.35;
    this.items.hat = hatWrap;

    // Mustache
    const stache = new THREE.Group();
    const stacheMat = new THREE.MeshStandardMaterial({ color: 0x2a160b, roughness: 0.9 });
    const half = (sgn) => {
      const pts = [[0, 0.0], [0.1, -0.03], [0.22, -0.02], [0.3, 0.04], [0.31, 0.11], [0.25, 0.13], [0.22, 0.09]]
        .map(([x, y]) => new THREE.Vector3(x * sgn, y, 0));
      return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.045, 10), stacheMat);
    };
    stache.add(half(1), half(-1));
    const sScale = eyeSpan / 0.55;
    stache.scale.setScalar(sScale);
    this.items.stache = stache;

    // Shades (deal with it)
    const shades = new THREE.Group();
    const lensMat = new THREE.MeshPhysicalMaterial({ color: 0x050505, roughness: 0.05, metalness: 0.4, clearcoat: 1 });
    const lensGeo = new THREE.BoxGeometry(0.34, 0.17, 0.05);
    const l1 = new THREE.Mesh(lensGeo, lensMat), l2 = new THREE.Mesh(lensGeo, lensMat);
    l1.position.x = -0.24; l2.position.x = 0.24;
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.05), lensMat);
    bridge.position.y = 0.05;
    const arms = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.04, 0.04), lensMat);
    arms.position.set(0, 0.06, -0.02);
    shades.add(l1, l2, bridge, arms);
    shades.scale.setScalar(eyeSpan / 0.48);
    this.shadesInner = shades;
    const shadesWrap = new THREE.Group();
    shadesWrap.add(shades);
    this.items.shades = shadesWrap;

    // Clown nose
    const nose = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.1, eyeSpan * 0.2), 32, 24),
      new THREE.MeshPhysicalMaterial({ color: 0xff1020, roughness: 0.2, clearcoat: 1 }));
    this.items.clown = nose;

    // Tongue
    const tongue = new THREE.Group();
    const tMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.22, 8, 16),
      new THREE.MeshPhysicalMaterial({ color: 0xff5a7a, roughness: 0.3, clearcoat: 0.6 }));
    tMesh.scale.set(1.3, 1, 0.5);
    tMesh.position.y = -0.14;
    const groove = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.22, 0.02), new THREE.MeshBasicMaterial({ color: 0xc02040 }));
    groove.position.set(0, -0.16, 0.035);
    tongue.add(tMesh, groove);
    this.tongueInner = tongue;
    const tongueWrap = new THREE.Group();
    tongueWrap.add(tongue);
    this.items.tongue = tongueWrap;

    for (const [key, obj] of Object.entries(this.items)) {
      obj.visible = false;
      g.add(obj);
      this.on[key] = false;
    }
    this.shadesDrop = 0;
  }

  toggle(name, force) {
    const v = force ?? !this.on[name];
    this.on[name] = v;
    this.items[name].visible = v;
    if (name === 'shades' && v) this.shadesDrop = 1;
    return v;
  }

  place(obj, anchor, offset, upright = false) {
    const h = this.head;
    h.vertexPos(anchor, tmpP);
    h.vertexNormal(anchor, tmpN);
    if (upright) tmpN.lerp(Z, 0.55).normalize();
    obj.position.copy(tmpP).addScaledVector(tmpN, offset);
    tmpQ.setFromUnitVectors(Z, tmpN);
    obj.quaternion.copy(tmpQ);
  }

  update(dt, t) {
    const h = this.head, A = h.anchors;
    if (this.on.googly) {
      this.place(this.eyes[0].obj, A.eyeL, 0.02, true);
      this.place(this.eyes[1].obj, A.eyeR, 0.02, true);
      this.eyes[0].update(dt); this.eyes[1].update(dt);
    }
    if (this.on.hat) {
      h.vertexPos(A.top, tmpP);
      h.vertexNormal(A.top, tmpN);
      this.items.hat.position.copy(tmpP).addScaledVector(tmpN, -0.06);
      this.items.hat.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tmpN);
      this.hatInner.rotation.x = Math.sin(t * 3) * 0.05;
    }
    if (this.on.stache) {
      this.place(this.items.stache, A.stache, 0.015, true);
      this.items.stache.rotation.z += Math.sin(t * 6) * 0.04; // wiggle wiggle
    }
    if (this.on.shades) {
      this.place(this.items.shades, A.bridge, 0.1, true);
      this.shadesDrop = Math.max(0, this.shadesDrop - dt * 1.4);
      const d = this.shadesDrop;
      this.shadesInner.position.y = d * d * 3.5;
      this.shadesInner.rotation.z = d * 0.6;
    }
    if (this.on.clown) this.place(this.items.clown, A.nose, 0.02);
    if (this.on.tongue || h.s.tongue.x > 0.02) {
      this.items.tongue.visible = true;
      this.place(this.items.tongue, A.lowerLip, -0.05, true);
      const s = Math.max(0.001, h.s.tongue.x);
      this.tongueInner.scale.set(1, s * (1 + 0.08 * Math.sin(t * 8)), 1);
      this.tongueInner.rotation.x = -1.25 + Math.sin(t * 4) * 0.12;
      this.tongueInner.rotation.z = Math.sin(t * 3) * 0.2;
    } else {
      this.items.tongue.visible = false;
    }
  }

  // World position of an anchor, handy for honking noses.
  anchorWorld(name, out) {
    this.head.vertexPos(this.head.anchors[name], out);
    return this.head.mesh.localToWorld(out);
  }
}
