// Pointer tools: poke, pinch, slap, bonk, tickle, throw, sharpie, and the cursors.
import * as THREE from 'three';
import { emojiTex } from '../fx.js';
import { AMMO, AMMO_ORDER, SHARPIE_COLORS } from '../paint.js';
import * as samples from '../samples.js';
import * as sfx from '../audio.js';
import { $, $$, rnd, now, app, st } from './ctx.js';
import { canvas, scene, camera, fx } from './stage.js';

// ---------- pointer tools ----------
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function setNdc(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
}
function hitTest(e) {
  if (!app.head || st.popped || !app.head.group.visible) return null;
  setNdc(e);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObject(app.head.mesh, false)[0];
  if (!hit) return null;
  // Pick the triangle corner closest to the hit point.
  const local = app.head.mesh.worldToLocal(hit.point.clone());
  const v = new THREE.Vector3();
  let best = hit.face.a, bd = Infinity;
  for (const i of [hit.face.a, hit.face.b, hit.face.c]) {
    const d = app.head.vertexPos(i, v).distanceToSquared(local);
    if (d < bd) { bd = d; best = i; }
  }
  return { point: hit.point, local, vi: best, uv1: hit.uv1 };
}

function doPoke(hit, e) {
  app.ach.bump('poke');
  app.head.poke(hit.vi, 0.3);
  st.rot.y.kick(hit.local.x * 4);
  st.rot.x.kick(-hit.local.y * 3);
  app.head.s.brow.kick(10);
  app.head.s.jaw.kick(7);
  const nosePos = app.props.on.clown ? app.props.anchorWorld('nose', new THREE.Vector3()) : null;
  if (nosePos && nosePos.distanceTo(hit.point) < 0.3) {
    if (!samples.play('honk', { rate: rnd(0.9, 1.1) })) sfx.honk();
    fx.burst(hit.point, ['🤡', '📯', '🎺'], 5, { speed: 2.5, size: 0.3, life: 0.8 });
    app.showBubble('HONK.');
    app.grunt('hmph');
    app.addRage(2);
    return;
  }
  // Mix recorded cartoon sounds in with the synth ones, so pokes do not all sound the same.
  const r = Math.random();
  const played = (r < 0.3 && samples.play('boing', { rate: rnd(0.9, 1.4), vol: 0.7 }))
    || (r >= 0.3 && r < 0.5 && samples.play('squeak', { rate: rnd(0.8, 1.3), vol: 0.8 }));
  if (!played) sfx.boing(rnd(0.8, 1.4));
  sfx.boop();
  app.grunt(Math.random() < 0.6 ? 'ow' : 'yelp');
  app.stamp('👉', e.clientX, e.clientY, 'jab');
  fx.burst(hit.point, ['💥', '⭐', '💢'], 5, { speed: 2, size: 0.28, life: 0.7 });
  app.addRage(7);
  app.react('poke');
}

function doBonk(hit, e) {
  app.ach.bump('bonk');
  app.head.s.scaleY.x = 0.42;
  app.head.s.scaleY.v = 0;
  app.head.poke(hit.vi, 0.2, 0.5);
  sfx.bonk();
  sfx.tweet();
  app.grunt('oof');
  app.stamp('🔨', e.clientX, e.clientY, 'swing');
  fx.dizzy(app.head.group, 1.75, 2.5);
  fx.burst(hit.point, ['💥', '💫', '⭐'], 8, { speed: 3, size: 0.3, life: 0.9 });
  app.head.forceBlink = 0.7;
  setTimeout(() => app.head && (app.head.forceBlink = 0), 900);
  st.pos.y.kick(-4);
  app.addRage(14);
  app.react('bonk');
}

function doSlap(dir, hit, e) {
  app.ach.bump('slap');
  st.rot.y.kick(dir * 20);
  st.rot.z.kick(-dir * 6);
  st.pos.x.kick(dir * 6);
  st.blush = 1;
  if (hit) app.head.poke(hit.vi, 0.35, 0.45);
  app.head.s.jaw.kick(10);
  sfx.slap();
  sfx.whipCrack();
  app.grunt(Math.random() < 0.5 ? 'yelp' : 'ow');
  app.stamp('🖐️', e.clientX, e.clientY, dir > 0 ? 'slapR' : 'slapL');
  fx.burst(hit ? hit.point : new THREE.Vector3(0, 0, 1), ['💥', '💢', '✨'], 8, { speed: 3.5, size: 0.3, life: 0.8 });
  app.addRage(12);
  app.react('slap');
}

function doTickle(hit) {
  const t = now();
  app.head.s.tickle = Math.min(1, app.head.s.tickle + 0.12);
  st.rage = Math.max(0, st.rage - 0.6);
  if (t - st.lastGiggle > 380) {
    st.lastGiggle = t;
    sfx.giggle();
    app.ach.bump('giggle');
    sfx.feather();
    app.grunt('hehe');
    app.head.s.jaw.kick(6);
    app.head.s.brow.kick(4);
    if (Math.random() < 0.4) fx.burst(hit.point, ['😂', '🪶', '✨'], 2, { speed: 1.5, size: 0.25, life: 0.8 });
  }
  if (t - st.lastTickleLine > 1600) {
    st.lastTickleLine = t;
    app.react('tickle', { force: true });
  }
}

// ---------- throwables ----------
const AMMO_FX = {
  pie: ['🥧', '💦', '✨'],
  tomato: ['🍅', '💦', '🩸'],
  egg: ['🥚', '🍳', '💦'],
  water: ['💦', '💧', '💧'],
};
function pointOnStagePlane(e) {
  setNdc(e);
  raycaster.setFromCamera(ndc, camera);
  const p = new THREE.Vector3();
  raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.5), p);
  return p;
}
function throwAt(e) {
  const hit = hitTest(e);
  const target = hit ? hit.point.clone() : pointOnStagePlane(e);
  const kind = st.ammo;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex(AMMO[kind].emoji), depthWrite: false }));
  sp.scale.setScalar(0.6);
  scene.add(sp);
  const from = new THREE.Vector3(target.x * 0.4 + rnd(-0.8, 0.8), -2.6, camera.position.z - 1.2);
  st.projectiles.push({ sp, from, to: target, t: 0, dur: 0.38, hit, kind, spin: rnd(-14, 14) });
  sfx.throwWhoosh();
  app.ach.bump('throw');
}
function landProjectile(p) {
  const { hit, kind } = p;
  if (hit && app.head && !st.popped) {
    app.painter.splat(hit.uv1, kind);
    app.ach.bump('splat');
    app.head.poke(hit.vi, 0.32, 0.42);
    st.rot.y.kick(hit.local.x * 3);
    st.rot.x.kick(-hit.local.y * 2);
    app.head.s.jaw.kick(8);
    app.head.s.brow.kick(-6);
    app.head.forceBlink = 0.8;
    setTimeout(() => app.head && (app.head.forceBlink = 0), 500);
    if (!samples.play('splat', { rate: rnd(0.85, 1.2), vol: 0.9 })) sfx.splat();
    app.grunt(kind === 'water' ? 'yelp' : 'oof');
    fx.burst(p.to, AMMO_FX[kind], 10, { speed: 3.5, size: 0.28, life: 0.9 });
    app.addRage(kind === 'water' ? 4 : 8);
    app.react('splat');
    p.sp.removeFromParent();
    return true;
  }
  // Missed: keep flying and fall off-screen.
  p.missed = true;
  p.v = p.to.clone().sub(p.from).divideScalar(p.dur);
  if (Math.random() < 0.5) app.react('miss');
  return false;
}
function updateProjectiles(dt) {
  for (const p of st.projectiles) {
    p.t += dt;
    p.sp.material.rotation += p.spin * dt;
    if (p.missed) {
      p.v.y -= 12 * dt;
      p.sp.position.addScaledVector(p.v, dt);
      p.done = p.t > p.dur + 1.2;
      if (p.done) p.sp.removeFromParent();
      continue;
    }
    const u = Math.min(1, p.t / p.dur);
    p.sp.position.lerpVectors(p.from, p.to, u);
    p.sp.position.y += Math.sin(u * Math.PI) * 1.4;
    p.sp.scale.setScalar(0.6 + (1 - u) * 0.9);
    if (u >= 1) p.done = landProjectile(p);
  }
  st.projectiles = st.projectiles.filter((p) => !p.done);
}
function cycleAmmo() {
  st.ammo = AMMO_ORDER[(AMMO_ORDER.indexOf(st.ammo) + 1) % AMMO_ORDER.length];
  $('#ammoIcon').textContent = AMMO[st.ammo].emoji;
  $('#ammoName').textContent = `${AMMO[st.ammo].name} · click again to swap`;
  setCursor(AMMO[st.ammo].emoji);
  sfx.squeak(1.2);
}

// ---------- sharpie ----------
function penColor() { return SHARPIE_COLORS[st.pen]; }
function cyclePen() {
  st.pen = (st.pen + 1) % SHARPIE_COLORS.length;
  $('#penDot').style.background = penColor();
  setSharpieCursor();
  sfx.marker();
}
function sharpieAt(hit) {
  app.painter.stroke(hit.uv1, penColor());
  app.ach.bump('stroke');
  const t = now();
  if (t - st.lastMarker > 70) { st.lastMarker = t; sfx.marker(); }
  st.strokes++;
  st.lastInteraction = t;
  if (st.strokes > 25 && t - st.lastSharpieLine > 5000) {
    st.lastSharpieLine = t;
    st.strokes = 0;
    app.grunt('hmph');
    app.react('sharpie', { force: true });
  }
}

canvas.addEventListener('pointerdown', (e) => {
  sfx.unlock();
  if (!app.head) return;
  // Swatting a bee beats whatever tool is in hand.
  if (app.bees.active && app.bees.swatAt(e.clientX, e.clientY)) return;
  const hit = hitTest(e);
  st.pointer = { x: e.clientX, y: e.clientY, t: now(), lx: e.clientX, ly: e.clientY, lt: now(), hit, swiped: false };
  canvas.setPointerCapture(e.pointerId);
  switch (st.tool) {
    case 'poke': if (hit) doPoke(hit, e); break;
    case 'bonk': if (hit) doBonk(hit, e); break;
    case 'tickle': if (hit) doTickle(hit); break;
    case 'throw': throwAt(e); break;
    case 'sharpie': if (hit) sharpieAt(hit); break;
    case 'pinch':
      if (hit) {
        app.head.grab(hit.vi);
        const n = new THREE.Vector3();
        camera.getWorldDirection(n);
        st.pinch = {
          plane: new THREE.Plane().setFromNormalAndCoplanarPoint(n, hit.point),
          start: hit.point.clone(),
          creak: sfx.startStretch(),
          len: 0,
          yelled: 0,
        };
        sfx.squeak(1.2);
        app.grunt('uhoh');
      }
      break;
  }
});

canvas.addEventListener('pointermove', (e) => {
  const r = canvas.getBoundingClientRect();
  st.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  const p = st.pointer;
  if (!p || !app.head) return;
  const t = now();
  const dtp = Math.max(1, t - p.lt);
  const vx = ((e.clientX - p.lx) / dtp) * 1000, vy = ((e.clientY - p.ly) / dtp) * 1000;
  p.lx = e.clientX; p.ly = e.clientY; p.lt = t;

  if (st.tool === 'pinch' && st.pinch) {
    setNdc(e);
    raycaster.setFromCamera(ndc, camera);
    const hitP = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(st.pinch.plane, hitP)) {
      const delta = hitP.sub(st.pinch.start);
      const q = app.head.mesh.getWorldQuaternion(new THREE.Quaternion()).invert();
      const s = app.head.mesh.getWorldScale(new THREE.Vector3()).x;
      delta.applyQuaternion(q).divideScalar(s);
      app.head.drag(delta);
      st.pinch.len = Math.min(1, delta.length() / 1.2);
      st.pinch.creak.set(st.pinch.len);
      // Yell louder the further you stretch.
      const P = st.pinch;
      if (P.yelled < 1 && P.len > 0.4) { P.yelled = 1; app.grunt('ow'); app.react('pinchHold', { force: true }); app.addRage(3); }
      if (P.yelled < 2 && P.len > 0.85) { P.yelled = 2; app.ach.unlock('taffy'); sfx.rip(); app.grunt('yelp'); app.react('pinchMax', { force: true }); app.addRage(5); }
    }
  } else if (st.tool === 'slap') {
    if (Math.hypot(vx, vy) > 900 && t > st.slapCooldown) {
      const hit = hitTest(e);
      if (hit) {
        st.slapCooldown = t + 350;
        p.swiped = true;
        doSlap(Math.sign(vx) || 1, hit, e);
      }
    }
  } else if (st.tool === 'tickle') {
    const hit = hitTest(e);
    if (hit) doTickle(hit);
  } else if (st.tool === 'sharpie') {
    const hit = hitTest(e);
    if (hit) sharpieAt(hit);
    else app.painter?.penUp();
  }
});

function endPointer(e) {
  const p = st.pointer;
  st.pointer = null;
  app.painter?.penUp();
  if (!app.head || !p) return;
  if (st.tool === 'pinch' && st.pinch) {
    app.head.release();
    st.pinch.creak.stop();
    if (st.pinch.len > 0.08) {
      sfx.thwap();
      app.grunt('oof');
      st.rot.y.kick(rnd(-6, 6));
      st.rot.z.kick(rnd(-4, 4));
      app.addRage(4 + st.pinch.len * 8);
      app.react('pinch');
    }
    st.pinch = null;
  } else if (st.tool === 'slap' && !p.swiped && p.hit && now() - p.t < 400) {
    // A click counts as a lazy slap. Direction depends on which cheek.
    doSlap(p.hit.local.x < 0 ? 1 : -1, p.hit, e);
  }
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('pointerleave', (e) => {
  if (!st.pointer) st.mouse.set(0, 0);
});
// ---------- tool picker ----------
const CURSORS = { poke: '👉', pinch: '🤏', slap: '🖐️', bonk: '🔨', tickle: '🪶', throw: '🥧', sharpie: '🖍️' };
function setCursor(emoji) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'><text x='4' y='38' font-size='36'>${emoji}</text></svg>`;
  canvas.style.cursor = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") 12 12, pointer`;
}
// Hand-drawn pointing finger. The fingertip sits on the hotspot (46, 16), so pokes land where it points.
function setPokeCursor() {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'>
    <g stroke='#111' stroke-width='2' stroke-linejoin='round' stroke-linecap='round'>
      <rect x='1' y='14' width='7' height='24' rx='2' fill='#00e5ff'/>
      <rect x='18' y='11' width='28' height='10' rx='5' fill='#ffcf9e'/>
      <rect x='6' y='13' width='20' height='25' rx='8' fill='#ffcf9e'/>
      <path d='M14 27 H25 M14 32 H24' fill='none'/>
      <path d='M9 22 Q17 17 24 22' fill='#ffcf9e'/>
      <rect x='37' y='12.5' width='6' height='6' rx='2' fill='#fff1e2' stroke-width='1.5'/>
    </g>
  </svg>`;
  canvas.style.cursor = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") 46 16, pointer`;
}
// Hand-drawn crayon in the current pen color. Its tip sits exactly on the hotspot (3, 45),
// so the line starts where the crayon touches. Emoji art differs per OS, so it can not be trusted for this.
function setSharpieCursor() {
  const c = penColor();
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'>
    <g transform='translate(3 45) rotate(-45)' stroke='#111' stroke-width='2' stroke-linejoin='round'>
      <path d='M0 0 L11 -5 L11 5 Z' fill='${c}'/>
      <rect x='11' y='-6' width='34' height='12' rx='2' fill='${c}'/>
      <rect x='17' y='-6' width='18' height='12' fill='#fff'/>
      <rect x='45' y='-6' width='4' height='12' rx='1' fill='#111'/>
    </g>
  </svg>`;
  canvas.style.cursor = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") 3 45, crosshair`;
}
function setTool(tool) {
  st.tool = tool;
  $$('[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === tool));
  if (tool === 'sharpie') setSharpieCursor();
  else if (tool === 'poke') setPokeCursor();
  else setCursor(tool === 'throw' ? AMMO[st.ammo].emoji : CURSORS[tool]);
  $('#hint').textContent = {
    poke: 'CLICK the head. Poke it. You know you want to.',
    pinch: 'GRAB and DRAG to stretch that face like taffy.',
    slap: 'SWIPE fast across the face. Or click a cheek.',
    bonk: 'CLICK to bonk. Birds included.',
    tickle: 'HOLD and WIGGLE over the face.',
    throw: 'CLICK to throw. Click the THROW button again for new ammo.',
    sharpie: 'DRAW on the face. Click SHARPIE again to change color.',
  }[tool];
  sfx.squeak(1.5);
}
$$('[data-tool]').forEach((b) => b.addEventListener('click', () => {
  const tool = b.dataset.tool;
  if (st.tool === tool && tool === 'throw') cycleAmmo();
  else if (st.tool === tool && tool === 'sharpie') cyclePen();
  else setTool(tool);
}));
setTool('poke');

// Other modules reach these through `app`.
Object.assign(app, { doBonk, doPoke, doSlap, hitTest, throwAt, updateProjectiles });
