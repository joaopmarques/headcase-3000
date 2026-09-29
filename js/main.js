import * as THREE from 'three';
import { Head } from './head.js';
import { Props } from './props.js';
import { FX, emojiTex } from './fx.js';
import { Painter, AMMO, AMMO_ORDER, SHARPIE_COLORS } from './paint.js';
import { Mimic } from './mimic.js';
import { ClipRecorder } from './recorder.js';
import { setupFood } from './food.js';
import { Bees } from './bees.js';
import { Emotions } from './emotions.js';
import * as sfx from './audio.js';
import { voiceState, loadVoices, speak, stopSpeaking, isTalking } from './voice.js';
import { line, LIES, nonsense, pick } from './lines.js';
import { makeDemoFace } from './demoFace.js';
import { fallbackFit } from './fitcore.js';
import { Spring } from './shape.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const rnd = (a, b) => a + Math.random() * (b - a);
const now = () => performance.now();

// ---------- scene ----------
const canvas = $('#c');
const stage = $('#stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
camera.position.set(0, 0.25, 6.4);
camera.lookAt(0, 0.3, 0);

scene.add(new THREE.HemisphereLight(0xfff4e8, 0x553366, 1.4));
const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(2.5, 3, 5);
scene.add(key);
const rim = new THREE.DirectionalLight(0xff3ea5, 2.0);
rim.position.set(-4, 2, -3);
scene.add(rim);
const rim2 = new THREE.DirectionalLight(0x00e5ff, 1.6);
rim2.position.set(4, -1, -3);
scene.add(rim2);
const discoLights = [0xff0066, 0x00ffcc, 0xffee00].map((c) => {
  const l = new THREE.PointLight(c, 0, 12);
  scene.add(l);
  return l;
});

// Shadow blob, because floating heads still deserve grounding.
const shadowTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grd.addColorStop(0, 'rgba(0,0,0,0.55)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
shadow.rotation.x = -Math.PI / 2;
shadow.position.y = -2.0;
scene.add(shadow);

const rig = new THREE.Group();
scene.add(rig);
const fx = new FX(scene);

let head = null, props = null, painter = null;
const mimic = new Mimic();
const st = {
  tool: 'poke',
  rage: 0,
  blush: 0,
  rot: { x: new Spring(0, 50, 6), y: new Spring(0, 40, 4), z: new Spring(0, 70, 5) },
  pos: { x: new Spring(0, 60, 7), y: new Spring(0, 90, 7) },
  scale: new Spring(1, 110, 8),
  mouse: new THREE.Vector2(),
  talkBack: true,
  lastInteraction: now(),
  lastReactSpeak: 0,
  lastBubbleReact: 0,
  lastPump: 0,
  popped: false,
  yeet: null,
  zoom: 0,
  disco: false,
  clones: [],
  fried: false,
  meltdown: false,
  userSpeaking: false,
  pointer: null,
  lastGiggle: 0,
  lastTickleLine: 0,
  slapCooldown: 0,
  ammo: 'pie',
  pen: 0,
  projectiles: [],
  lastMarker: 0,
  strokes: 0,
  lastSharpieLine: 0,
  mouthOpen: false,
  chew: 0,
  chewThen: null,
  lastChomp: 0,
  fire: 0,
  sour: 0,
  ptr: null,
  saccade: new THREE.Vector2(),
  nextSaccade: 0,
};

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // Fit the head into the open space between the ticker and the tool bar.
  const uiTop = 40, uiBottom = w < 700 ? 140 : 170;
  const avail = Math.max(0.4, (h - uiTop - uiBottom) / h);
  const k = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  camera.position.z = Math.max(2.8 / (k * avail * 0.8), 2.4 / (k * camera.aspect * 0.62));
  // Nudge the view so the head sits in the middle of that space.
  const lift = Math.round((uiBottom - uiTop) / 2);
  camera.setViewOffset(w, h, 0, lift, w, h);
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
resize();

// ---------- bubble + rage ----------
const bubble = $('#bubble');
let bubbleTimer;
function showBubble(text, ms = 2200) {
  bubble.textContent = text;
  bubble.classList.remove('show');
  void bubble.offsetWidth;
  bubble.classList.add('show');
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => bubble.classList.remove('show'), ms);
}

function rageLevel() { return st.rage < 30 ? 0 : st.rage < 70 ? 1 : 2; }
function addRage(n) {
  st.rage = Math.max(0, Math.min(100, st.rage + n));
  if (st.rage >= 100 && !st.meltdown) meltdown();
}
// The sticker on the thermometer. Thresholds are rage percentages.
const RAGE_LABELS = [
  [0, 'Zen mode'], [8, "Don't poke the bear"], [22, 'Mildly miffed'], [36, 'Getting spicy'],
  [50, 'Steam incoming'], [64, 'Seeing red'], [78, 'DEFCON 1'], [90, 'NUCLEAR MELTDOWN'],
];
let rageLevelShown = -1;
function updateRageUI() {
  const pct = st.rage;
  $('#rage .tube i').style.height = `${pct}%`;
  $('#rageFace').textContent = st.meltdown ? '🤯' : ['😊', '😐', '😠', '🤬'][Math.min(3, Math.floor(pct / 26))];
  let lvl = 0;
  RAGE_LABELS.forEach(([min], i) => { if (pct >= min) lvl = i; });
  if (st.meltdown) lvl = 8;
  const label = $('#rageLabel');
  // Ride the mercury: bulb top (66px) plus the fill height of the 222px tube.
  label.style.bottom = `${58 + (pct / 100) * 222}px`;
  if (lvl !== rageLevelShown) {
    rageLevelShown = lvl;
    label.textContent = lvl === 8 ? '☢ KABOOM ☢' : RAGE_LABELS[lvl][1];
    label.className = `rage-label l${lvl}`;
    void label.offsetWidth;
    label.classList.add('pop');
  }
  document.body.classList.toggle('angry', pct > 70);
}

function talk(text, opts = {}) {
  const ok = speak(text, opts);
  if (!ok) {
    // No speech engine. Flap the mouth anyway, it is the thought that counts.
    voiceState.speaking = true;
    voiceState.until = now() + 400 + text.length * 60;
  }
}

// Instant cartoon vocal. TTS takes a beat to start, grunts do not.
function grunt(kind) {
  sfx.grunt(kind, { pitch: Math.min(2, Math.max(0.4, voiceState.pitch)), rage: st.rage / 100 });
}

function react(kind, { force = false } = {}) {
  st.lastInteraction = now();
  const t = now();
  if (!force && t - st.lastBubbleReact < 350) return;
  st.lastBubbleReact = t;
  const text = line(kind, rageLevel());
  if (!text) return;
  showBubble(text);
  if (st.talkBack && !st.userSpeaking && (force || t - st.lastReactSpeak > 650)) {
    st.lastReactSpeak = t;
    const angry = rageLevel() === 2;
    talk(text, angry ? { pitch: 0.4, rate: 1.3 } : {});
  }
}

function sayUser(text) {
  if (!text.trim()) return;
  st.userSpeaking = true;
  st.lastInteraction = now();
  showBubble(text, Math.max(2500, text.length * 80));
  talk(text, { onEnd: () => (st.userSpeaking = false) });
  setTimeout(() => (st.userSpeaking = false), 1500 + text.length * 120);
}

// DOM emoji stamp at the pointer (hammer swings, hands, fingers).
function stamp(emoji, x, y, cls = '') {
  const el = document.createElement('div');
  el.className = `stamp ${cls}`;
  el.textContent = emoji;
  const r = stage.getBoundingClientRect();
  el.style.left = `${x - r.left}px`;
  el.style.top = `${y - r.top}px`;
  stage.appendChild(el);
  setTimeout(() => el.remove(), 700);
}

// ---------- bees + feelings ----------
const app = {
  head: () => head, props: () => props, painter: () => painter,
  rig, camera, stage, fx, sfx, st, line,
  grunt: (k) => grunt(k), react: (k, o) => react(k, o), addRage: (n) => addRage(n),
  showBubble: (t, ms) => showBubble(t, ms), talk: (t, o) => talk(t, o),
  onGone: () => $('[data-action="bees"]').classList.remove('on'),
};
const bees = new Bees(app);
const emotions = new Emotions(app);
$$('[data-emote]').forEach((b) => b.addEventListener('click', () => {
  sfx.unlock();
  if (!head || st.popped) return;
  st.lastInteraction = now();
  emotions.play(b.dataset.emote);
}));
// Track the pointer anywhere on the page, for the eyes.
window.addEventListener('pointermove', (e) => { st.ptr = { x: e.clientX, y: e.clientY, t: now() }; });

// ---------- face loading ----------
const LOADING = [
  'Measuring your nostrils…', 'Inflating the skull…', 'Calibrating cheek jiggle…', 'Consulting the face wizard…',
  'Detaching your body (it is fine)…', 'Rendering your forehead in 4K…', 'Teaching your face to scream…', 'Adding extra nose…',
];
let loadingTimer;
function showLoading(on) {
  $('#loading').classList.toggle('hidden', !on);
  clearInterval(loadingTimer);
  if (on) {
    const el = $('#loadingText');
    el.textContent = pick(LOADING);
    loadingTimer = setInterval(() => (el.textContent = pick(LOADING)), 900);
  }
}

let facePromise = null;
function faceModule() {
  facePromise ??= import('./face.js');
  return facePromise;
}
// Start downloading the face model right away so the first upload is snappy.
faceModule().then((m) => m.warmup()).catch((e) => console.warn('face module unavailable', e));

async function loadFace(source, { demo = false } = {}) {
  sfx.unlock();
  $('#intro').classList.add('hidden');
  showLoading(true);
  let result;
  try {
    if (demo) throw new Error('demo');
    const m = await faceModule();
    result = await m.fitFace(source);
  } catch (e) {
    if (e.message !== 'demo') console.warn('using fallback fit', e);
    const c = document.createElement('canvas');
    c.width = source.width; c.height = source.height;
    c.getContext('2d').drawImage(source, 0, 0);
    result = { canvas: c, fit: fallbackFit(c) };
  }
  installHead(result.canvas, result.fit);
  showLoading(false);
  setTimeout(() => {
    if (!result.fit.detected && !demo) showBubble('I could not find a face, so I made one up. You are welcome.', 3500);
    else react('hello', { force: true });
  }, 700);
}

function installHead(canvas, fit) {
  clearClones();
  if (head) head.dispose();
  fx.clearOrbits();
  head = new Head(fit, canvas);
  rig.add(head.group);
  props = new Props(head);
  painter = new Painter(head);
  bees.stop(true);
  emotions.stop();
  st.projectiles.forEach((p) => p.sp.removeFromParent());
  st.projectiles = [];
  st.chew = 0; st.fire = 0; st.sour = 0;
  st.rage = 0; st.meltdown = false; st.popped = false; st.fried = false; st.yeet = null;
  st.scale.x = 0.01; st.scale.v = 0; st.scale.t = 1;
  $$('[data-prop], [data-toggle]').forEach((b) => b.classList.remove('on'));
  if (st.disco) toggleDisco();
  sfx.boing(1.2);
}

async function fileToCanvas(file) {
  const bmp = await createImageBitmap(file);
  const c = document.createElement('canvas');
  c.width = bmp.width; c.height = bmp.height;
  c.getContext('2d').drawImage(bmp, 0, 0);
  return c;
}

async function handleFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    showBubble('That is not a face. That is not even an image.');
    return;
  }
  try {
    loadFace(await fileToCanvas(file));
  } catch (e) {
    console.error(e);
    showBubble('Your image broke my brain. Try a JPG or PNG.');
  }
}

// ---------- pointer tools ----------
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function setNdc(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
}
function hitTest(e) {
  if (!head || st.popped || !head.group.visible) return null;
  setNdc(e);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObject(head.mesh, false)[0];
  if (!hit) return null;
  // Pick the triangle corner closest to the hit point.
  const local = head.mesh.worldToLocal(hit.point.clone());
  const v = new THREE.Vector3();
  let best = hit.face.a, bd = Infinity;
  for (const i of [hit.face.a, hit.face.b, hit.face.c]) {
    const d = head.vertexPos(i, v).distanceToSquared(local);
    if (d < bd) { bd = d; best = i; }
  }
  return { point: hit.point, local, vi: best, uv1: hit.uv1 };
}

function doPoke(hit, e) {
  head.poke(hit.vi, 0.3);
  st.rot.y.kick(hit.local.x * 4);
  st.rot.x.kick(-hit.local.y * 3);
  head.s.brow.kick(10);
  head.s.jaw.kick(7);
  const nosePos = props.on.clown ? props.anchorWorld('nose', new THREE.Vector3()) : null;
  if (nosePos && nosePos.distanceTo(hit.point) < 0.3) {
    sfx.honk();
    fx.burst(hit.point, ['🤡', '📯', '🎺'], 5, { speed: 2.5, size: 0.3, life: 0.8 });
    showBubble('HONK.');
    grunt('hmph');
    addRage(2);
    return;
  }
  sfx.boing(rnd(0.8, 1.4));
  sfx.boop();
  grunt(Math.random() < 0.6 ? 'ow' : 'yelp');
  stamp('👉', e.clientX, e.clientY, 'jab');
  fx.burst(hit.point, ['💥', '⭐', '💢'], 5, { speed: 2, size: 0.28, life: 0.7 });
  addRage(7);
  react('poke');
}

function doBonk(hit, e) {
  head.s.scaleY.x = 0.42;
  head.s.scaleY.v = 0;
  head.poke(hit.vi, 0.2, 0.5);
  sfx.bonk();
  sfx.tweet();
  grunt('oof');
  stamp('🔨', e.clientX, e.clientY, 'swing');
  fx.dizzy(head.group, 1.75, 2.5);
  fx.burst(hit.point, ['💥', '💫', '⭐'], 8, { speed: 3, size: 0.3, life: 0.9 });
  head.forceBlink = 0.7;
  setTimeout(() => head && (head.forceBlink = 0), 900);
  st.pos.y.kick(-4);
  addRage(14);
  react('bonk');
}

function doSlap(dir, hit, e) {
  st.rot.y.kick(dir * 20);
  st.rot.z.kick(-dir * 6);
  st.pos.x.kick(dir * 6);
  st.blush = 1;
  if (hit) head.poke(hit.vi, 0.35, 0.45);
  head.s.jaw.kick(10);
  sfx.slap();
  sfx.whipCrack();
  grunt(Math.random() < 0.5 ? 'yelp' : 'ow');
  stamp('🖐️', e.clientX, e.clientY, dir > 0 ? 'slapR' : 'slapL');
  fx.burst(hit ? hit.point : new THREE.Vector3(0, 0, 1), ['💥', '💢', '✨'], 8, { speed: 3.5, size: 0.3, life: 0.8 });
  addRage(12);
  react('slap');
}

function doTickle(hit) {
  const t = now();
  head.s.tickle = Math.min(1, head.s.tickle + 0.12);
  st.rage = Math.max(0, st.rage - 0.6);
  if (t - st.lastGiggle > 380) {
    st.lastGiggle = t;
    sfx.giggle();
    sfx.feather();
    grunt('hehe');
    head.s.jaw.kick(6);
    head.s.brow.kick(4);
    if (Math.random() < 0.4) fx.burst(hit.point, ['😂', '🪶', '✨'], 2, { speed: 1.5, size: 0.25, life: 0.8 });
  }
  if (t - st.lastTickleLine > 1600) {
    st.lastTickleLine = t;
    react('tickle', { force: true });
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
}
function landProjectile(p) {
  const { hit, kind } = p;
  if (hit && head && !st.popped) {
    painter.splat(hit.uv1, kind);
    head.poke(hit.vi, 0.32, 0.42);
    st.rot.y.kick(hit.local.x * 3);
    st.rot.x.kick(-hit.local.y * 2);
    head.s.jaw.kick(8);
    head.s.brow.kick(-6);
    head.forceBlink = 0.8;
    setTimeout(() => head && (head.forceBlink = 0), 500);
    sfx.splat();
    grunt(kind === 'water' ? 'yelp' : 'oof');
    fx.burst(p.to, AMMO_FX[kind], 10, { speed: 3.5, size: 0.28, life: 0.9 });
    addRage(kind === 'water' ? 4 : 8);
    react('splat');
    p.sp.removeFromParent();
    return true;
  }
  // Missed: keep flying and fall off-screen.
  p.missed = true;
  p.v = p.to.clone().sub(p.from).divideScalar(p.dur);
  if (Math.random() < 0.5) react('miss');
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
  painter.stroke(hit.uv1, penColor());
  const t = now();
  if (t - st.lastMarker > 70) { st.lastMarker = t; sfx.marker(); }
  st.strokes++;
  st.lastInteraction = t;
  if (st.strokes > 25 && t - st.lastSharpieLine > 5000) {
    st.lastSharpieLine = t;
    st.strokes = 0;
    grunt('hmph');
    react('sharpie', { force: true });
  }
}

canvas.addEventListener('pointerdown', (e) => {
  sfx.unlock();
  if (!head) return;
  // Swatting a bee beats whatever tool is in hand.
  if (bees.active && bees.swatAt(e.clientX, e.clientY)) return;
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
        head.grab(hit.vi);
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
        grunt('uhoh');
      }
      break;
  }
});

canvas.addEventListener('pointermove', (e) => {
  const r = canvas.getBoundingClientRect();
  st.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  const p = st.pointer;
  if (!p || !head) return;
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
      const q = head.mesh.getWorldQuaternion(new THREE.Quaternion()).invert();
      const s = head.mesh.getWorldScale(new THREE.Vector3()).x;
      delta.applyQuaternion(q).divideScalar(s);
      head.drag(delta);
      st.pinch.len = Math.min(1, delta.length() / 1.2);
      st.pinch.creak.set(st.pinch.len);
      // Yell louder the further you stretch.
      const P = st.pinch;
      if (P.yelled < 1 && P.len > 0.4) { P.yelled = 1; grunt('ow'); react('pinchHold', { force: true }); addRage(3); }
      if (P.yelled < 2 && P.len > 0.85) { P.yelled = 2; sfx.rip(); grunt('yelp'); react('pinchMax', { force: true }); addRage(5); }
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
    else painter?.penUp();
  }
});

function endPointer(e) {
  const p = st.pointer;
  st.pointer = null;
  painter?.penUp();
  if (!head || !p) return;
  if (st.tool === 'pinch' && st.pinch) {
    head.release();
    st.pinch.creak.stop();
    if (st.pinch.len > 0.08) {
      sfx.thwap();
      grunt('oof');
      st.rot.y.kick(rnd(-6, 6));
      st.rot.z.kick(rnd(-4, 4));
      addRage(4 + st.pinch.len * 8);
      react('pinch');
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

// ---------- command wheel ----------
const CAT_TITLES = {
  tools: 'TOOLS OF TORMENT', emotions: 'FEELINGS', chaos: 'CHAOS', food: 'SNACK BAR',
  drip: 'DRIP', voice: 'VOICE BOX', media: 'PHOTO & VIDEO',
};
function setCategory(cat) {
  $$('[data-cat]').forEach((b) => b.classList.toggle('on', b.dataset.cat === cat));
  $$('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== cat; });
  $('#tbTitle').textContent = CAT_TITLES[cat];
  $('#toolbar .tb-body').scrollLeft = 0;
}
$$('[data-cat]').forEach((b) => b.addEventListener('click', () => {
  sfx.unlock();
  sfx.squeak(1.1 + Math.random() * 0.4);
  setCategory(b.dataset.cat);
}));
// Mouse wheel scrolls the tool bar sideways.
$('#toolbar .tb-body').addEventListener('wheel', (e) => {
  if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
    e.currentTarget.scrollLeft += e.deltaY;
    e.preventDefault();
  }
}, { passive: false });

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

// ---------- actions ----------
function popHead() {
  st.popped = true;
  sfx.pop();
  grunt('yelp');
  const p = head.group.getWorldPosition(new THREE.Vector3());
  fx.burst(p, ['🎉', '🎊', '✨', '🧠', '👁️', '🦷', '💥', '👃'], 70, { speed: 8, size: 0.5, life: 2.2, gravity: -7 });
  head.group.visible = false;
  showBubble('POP!', 1500);
  setTimeout(() => {
    if (!head) return;
    head.reset();
    st.scale.x = 0.01; st.scale.v = 0;
    head.group.visible = true;
    st.popped = false;
    sfx.boing(1.3);
    react('pop', { force: true });
  }, 1800);
}

function pumpOnce() {
  if (!head || st.popped) return;
  const s = head.s.inflate;
  s.t = Math.min(1.05, s.t + 0.07);
  s.kick(0.8);
  sfx.squeak(0.7 + s.t);
  if (s.t > 0.5 && Math.random() < 0.35) grunt(s.t > 0.8 ? 'uhoh' : 'ooh');
  st.lastPump = now();
  if (s.t >= 1.0) { stopPump(); popHead(); return; }
  if (Math.random() < 0.25) react('inflate');
}
let pumpTimer = null;
function startPump() { stopPump(); pumpOnce(); pumpTimer = setInterval(pumpOnce, 200); }
function stopPump() { clearInterval(pumpTimer); pumpTimer = null; }

function toggleDisco() {
  st.disco = !st.disco;
  document.body.classList.toggle('disco', st.disco);
  $('[data-action="disco"]').classList.toggle('on', st.disco);
  if (st.disco) {
    sfx.startDisco(() => {
      if (!head) return;
      st.pos.y.v = 2.2;
      head.s.jaw.kick(5);
      head.s.brow.kick(6);
      st.rot.z.kick(rnd(-3, 3));
    });
    react('disco', { force: true });
  } else {
    sfx.stopDisco();
    discoLights.forEach((l) => (l.intensity = 0));
    if (head) head.uniforms.uHue.value = 0;
  }
}

function clearClones() {
  for (const c of st.clones) c.removeFromParent();
  st.clones = [];
}
function toggleClones() {
  const btn = $('[data-action="clones"]');
  if (st.clones.length) { clearClones(); btn.classList.remove('on'); return; }
  if (!head) return;
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(head.geo, head.mat);
    m.userData = { a: (i / 10) * Math.PI * 2, ph: Math.random() * 6 };
    m.scale.setScalar(0.42);
    scene.add(m);
    st.clones.push(m);
  }
  btn.classList.add('on');
  sfx.sparkle();
  showBubble('We are legion.');
  talk('We are legion.', { pitch: 0.6 });
}

function yeet(self = false) {
  if (st.yeet || !head || st.popped) return;
  st.yeet = { t: 0, dir: Math.random() < 0.5 ? -1 : 1, self };
  sfx.whoosh(0.9);
  grunt(self ? 'argh' : 'woo');
  if (!self) react('yeet', { force: true });
}

function meltdown() {
  st.meltdown = true;
  sfx.scream();
  grunt('argh');
  const text = line('rage');
  showBubble(text, 2500);
  talk(text, { pitch: 0.2, rate: 1.4 });
  setTimeout(() => yeet(true), 1300);
}

function deepFry() {
  if (!head) return;
  st.fried = !st.fried;
  $('[data-action="fry"]').classList.toggle('on', st.fried);
  if (!st.fried) { head.setFilter(null); return; }
  head.setFilter('saturate(5) contrast(2.2) brightness(1.15)', (ctx, fit) => {
    const F = fit.features;
    ctx.globalCompositeOperation = 'lighter';
    for (const e of [F.eyeL, F.eyeR]) {
      const r = e.rx * 3;
      const g = ctx.createRadialGradient(e.x, e.y, 1, e.x, e.y, r);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.15, 'rgba(255,40,20,1)');
      g.addColorStop(1, 'rgba(255,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(e.x - r, e.y - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.font = `${fit.faceW * 0.18}px sans-serif`;
    ctx.fillText('😂', F.cheekL.x - fit.faceW * 0.15, F.cheekL.y + fit.faceW * 0.05);
    ctx.fillText('💯', F.cheekR.x, F.cheekR.y + fit.faceW * 0.05);
    // JPEG crust
    const img = ctx.getImageData(0, 0, fit.W, fit.H);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 60;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
  });
  sfx.sizzle(0.8);
  showBubble('Deep fried. 🔥');
}

function resetAll() {
  if (!head) return;
  head.reset();
  for (const k of Object.keys(props.on)) props.toggle(k, false);
  head.s.tongue.t = 0;
  if (st.disco) toggleDisco();
  clearClones();
  if (st.fried) deepFry();
  fx.clearOrbits();
  st.rage = 0; st.meltdown = false;
  st.chew = 0; st.fire = 0; st.sour = 0;
  if (painter) painter.drips = [];
  bees.stop(true);
  emotions.stop();
  $$('[data-prop], [data-action]:not([data-action="rec"]):not([data-action="mimic"])').forEach((b) => b.classList.remove('on'));
  head.look.set(0, 0);
  sfx.ding();
  showBubble('Good as new. Mostly.');
}

// ---------- mic mimic ----------
function setMimicButton(on) {
  const b = $('[data-action="mimic"]');
  b.classList.toggle('on', on);
  b.querySelector('b').textContent = on ? '🔴' : '🎤';
  b.querySelector('small').textContent = on ? 'click to stop' : 'click, talk, click';
}
async function toggleMimic() {
  if (mimic.state === 'playing') return;
  if (mimic.state === 'recording') {
    setMimicButton(false);
    sfx.micOff();
    const buf = await mimic.stop();
    if (!buf || buf.duration < 0.3) {
      st.userSpeaking = false;
      showBubble('I did not hear anything. Try again, louder.');
      return;
    }
    stopSpeaking();
    // Pitch slider picks the silliness: normal is chipmunk-ish, demon preset is slow and low.
    const p = voiceState.pitch;
    const rate = p <= 1 ? 0.55 + p * 0.9 : 1.45 + (p - 1) * 0.5;
    showBubble('🦜🦜🦜', buf.duration / rate * 1000 + 300);
    await mimic.play(rate);
    st.userSpeaking = false;
    st.lastInteraction = now();
    return;
  }
  try {
    await mimic.start();
  } catch (e) {
    console.warn(e);
    showBubble('I need your microphone to copy you. Allow it and try again.', 3500);
    return;
  }
  st.userSpeaking = true;
  stopSpeaking();
  setMimicButton(true);
  sfx.micOn();
  showBubble(line('listen'), 10000);
}

// ---------- clip recording ----------
const recorder = new ClipRecorder(stage, canvas, bubble);
let clipUrl = null;
function toggleRec() {
  const btn = $('[data-action="rec"]');
  if (!ClipRecorder.supported()) { showBubble('This browser can not record clips. Try Chrome or Safari.'); return; }
  if (recorder.active) { recorder.stop(); return; }
  sfx.recBeep();
  btn.classList.add('on');
  const badge = $('#recBadge');
  badge.classList.remove('hidden');
  recorder.start(6, {
    onTick: (sec) => { badge.textContent = `● REC ${sec}s`; },
    onDone: (blob, ext) => {
      badge.classList.add('hidden');
      btn.classList.remove('on');
      sfx.ding();
      showClip(blob, ext);
    },
  });
}
function showClip(blob, ext) {
  if (clipUrl) URL.revokeObjectURL(clipUrl);
  clipUrl = URL.createObjectURL(blob);
  const name = `headcase-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${ext}`;
  $('#clipVideo').src = clipUrl;
  $('#clipSave').href = clipUrl;
  $('#clipSave').download = name;
  const file = new File([blob], name, { type: blob.type });
  const share = $('#clipShare');
  const canShare = !!navigator.canShare?.({ files: [file] });
  share.classList.toggle('hidden', !canShare);
  share.onclick = () => navigator.share({ files: [file], title: 'HEADCASE 3000' }).catch(() => {});
  $('#clip').classList.remove('hidden');
  $('#clipVideo').play().catch(() => {});
}
$('#clipClose').addEventListener('click', () => {
  $('#clip').classList.add('hidden');
  $('#clipVideo').pause();
});

// ---------- snacks ----------
function mouthWorld() {
  return props.anchorWorld('mouth', new THREE.Vector3());
}
function chew(seconds, then) {
  st.chew = seconds;
  st.chewThen = then;
}
function eat(food) {
  if (!head || st.popped) return;
  st.lastInteraction = now();
  const s = head.s;
  if (food.fat > 0.05 && s.fatTarget >= 0.99) {
    sfx.spit();
    grunt('hmph');
    fx.burst(mouthWorld(), [food.emoji], 1, { speed: 6, gravity: -10, size: 0.5, dir: new THREE.Vector3(rnd(-0.5, 0.5), 0.6, 1) });
    react('full', { force: true });
    return;
  }
  sfx.gulp();
  if (food.id === 'broccoli') {
    chew(0.6, () => {
      sfx.spit();
      grunt('hmph');
      fx.burst(mouthWorld(), ['🥦', '🟢', '🟢'], 6, { speed: 6, gravity: -10, size: 0.3, dir: new THREE.Vector3(0, 0.3, 1) });
      react('broccoli', { force: true });
    });
    return;
  }
  if (food.id === 'chili') {
    chew(0.7, () => {
      st.fire = 2.2;
      sfx.fireBreath(2);
      grunt('argh');
      react('chili', { force: true });
    });
    return;
  }
  if (food.id === 'lemon') {
    chew(0.4, () => {
      st.sour = 1.4;
      head.s.scaleY.x = 0.78;
      head.s.scaleY.v = 0;
      head.s.twist.kick(6);
      sfx.squeak(0.5);
      grunt('hmph');
      react('lemon', { force: true });
    });
    return;
  }
  chew(1.1, () => {
    sfx.gulp();
    s.fatTarget = Math.min(1, s.fatTarget + food.fat);
    st.rage = Math.max(0, st.rage - 12); // snacks calm the beast
    if (food.id === 'donut') sfx.sparkle();
    if (s.fatTarget >= 0.99) react('full', { force: true });
    else react('yum', { force: true });
    if (Math.random() < 0.5) setTimeout(() => { sfx.burp(); showBubble('*BURP*', 1200); }, 900);
  });
}
setupFood($('#foodTray'), stage, {
  mouth() {
    if (!head || st.popped || !head.group.visible) return null;
    const p = mouthWorld().project(camera);
    return { x: (p.x * 0.5 + 0.5) * stage.clientWidth, y: (-p.y * 0.5 + 0.5) * stage.clientHeight };
  },
  onNear(near) {
    st.mouthOpen = near;
    if (near && head) { grunt('ooh'); react('foodNear'); }
  },
  onEat: eat,
  onMiss(food, x, y) {
    if (!head) return;
    const hit = hitTest({ clientX: x, clientY: y });
    if (hit) {
      head.poke(hit.vi, 0.15);
      sfx.boing(1.4);
      react('forehead', { force: true });
    } else sfx.thud();
  },
});

const ACTIONS = {
  melt() {
    const on = (head.s.meltTarget = head.s.meltTarget ? 0 : 1);
    $('[data-action="melt"]').classList.toggle('on', !!on);
    if (on) {
      sfx.sizzle(2);
      grunt('uhoh');
      fx.burst(new THREE.Vector3(0, 1, 0.5), ['💦', '🔥', '🫠'], 10, { speed: 2, size: 0.3 });
      react('melt', { force: true });
    } else {
      sfx.slideWhistle(true);
      showBubble('Solid again!');
    }
  },
  twist() {
    head.s.twist.kick((Math.random() < 0.5 ? -1 : 1) * 14);
    sfx.creak(); sfx.whoosh(0.5);
    grunt('woo');
    react('twist', { force: true });
  },
  noodle() {
    head.s.scaleY.t = 2.1;
    sfx.slideWhistle(true);
    grunt('woo');
    react('noodle', { force: true });
    setTimeout(() => { if (head) { head.s.scaleY.t = 1; sfx.slideWhistle(false); } }, 1700);
  },
  lie() {
    const s = head.s.nose;
    s.t = Math.min(2.4, s.t + 0.45);
    s.kick(3);
    sfx.creak();
    const p = props.anchorWorld('nose', new THREE.Vector3());
    fx.burst(p, ['🤥', '🌳', '🪵'], 4, { speed: 1.5, size: 0.3 });
    sayUser(pick(LIES));
  },
  blep() {
    const on = props.toggle('tongue');
    head.s.tongue.t = on ? 1 : 0;
    $('[data-action="blep"]').classList.toggle('on', on);
    sfx.squeak(on ? 0.6 : 1.4);
    if (on) react('blep', { force: true });
  },
  disco: toggleDisco,
  clones: toggleClones,
  yeet: () => yeet(false),
  spin() {
    st.rot.y.kick((Math.random() < 0.5 ? -1 : 1) * 45);
    sfx.whoosh(0.7);
    grunt('woo');
    react('spin', { force: true });
  },
  fry: deepFry,
  bees() {
    const btn = $('[data-action="bees"]');
    if (bees.active) { bees.stop(true); btn.classList.remove('on'); sfx.whoosh(0.4); return; }
    bees.start(7);
    btn.classList.add('on');
    grunt('uhoh');
    react('bees', { force: true });
  },
  mimic: toggleMimic,
  rec: toggleRec,
  snap() { st.snapRequest = true; },
  reset: resetAll,
  newface() { $('#intro').classList.remove('hidden'); },
};
$$('[data-action]').forEach((b) => {
  const a = b.dataset.action;
  if (a === 'pump') {
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); sfx.unlock(); if (head) startPump(); });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, stopPump);
    return;
  }
  b.addEventListener('click', () => { sfx.unlock(); if (head || a === 'newface') ACTIONS[a](); });
});

const PROP_SFX = {
  googly: () => { sfx.squeak(1.3); showBubble('I can see everything now.'); },
  hat: () => { sfx.sparkle(); showBubble('It is my birthday? It is my birthday!'); },
  stache: () => { sfx.ding(); showBubble('Magnificent.'); },
  shades: () => { sfx.whoosh(0.4); setTimeout(() => { sfx.ding(); showBubble('Deal with it.'); }, 650); },
  clown: () => { sfx.honk(); showBubble('Honk honk.'); },
};
$$('[data-prop]').forEach((b) => b.addEventListener('click', () => {
  if (!head) return;
  sfx.unlock();
  const on = props.toggle(b.dataset.prop);
  b.classList.toggle('on', on);
  if (on) PROP_SFX[b.dataset.prop]?.();
  else sfx.squeak(0.7);
}));

// ---------- speech UI ----------
const voiceSel = $('#voice');
loadVoices((voices) => {
  const prev = voiceSel.value;
  voiceSel.innerHTML = '';
  voices.forEach((v, i) => {
    const o = document.createElement('option');
    o.value = i;
    o.textContent = `${v.name} (${v.lang})`;
    voiceSel.appendChild(o);
  });
  if (!voices.length) {
    voiceSel.innerHTML = '<option>no voices found 😶</option>';
    return;
  }
  const def = voices.findIndex((v) => v.default && v.lang.startsWith('en'));
  const en = voices.findIndex((v) => v.lang.startsWith('en'));
  voiceSel.value = prev && voices[prev] ? prev : String(def >= 0 ? def : Math.max(0, en));
  voiceState.voice = voices[voiceSel.value];
});
voiceSel.addEventListener('change', () => { voiceState.voice = voiceState.voices[voiceSel.value] ?? null; });

const pitchEl = $('#pitch'), rateEl = $('#rate');
const syncSliders = () => { voiceState.pitch = +pitchEl.value; voiceState.rate = +rateEl.value; };
pitchEl.addEventListener('input', syncSliders);
rateEl.addEventListener('input', syncSliders);

const PRESETS = {
  normal: [1, 1],
  chipmunk: [2, 1.6],
  demon: [0.1, 0.65],
  robot: [0.6, 0.9, /Zarvox|Trinoids|Robot|Fred|Ralph/i],
  auctioneer: [1.2, 2.6],
  sleepy: [0.7, 0.45],
};
$$('[data-preset]').forEach((b) => b.addEventListener('click', () => {
  const [p, r, re] = PRESETS[b.dataset.preset];
  pitchEl.value = p; rateEl.value = r;
  syncSliders();
  if (re) {
    const i = voiceState.voices.findIndex((v) => re.test(v.name));
    if (i >= 0) { voiceSel.value = i; voiceState.voice = voiceState.voices[i]; }
  }
  $$('[data-preset]').forEach((x) => x.classList.toggle('on', x === b));
  sfx.squeak(p);
}));

$('#sayForm').addEventListener('submit', (e) => {
  e.preventDefault();
  sfx.unlock();
  if (!head) return;
  sayUser($('#sayText').value);
});
$('#nonsense').addEventListener('click', () => {
  if (!head) return;
  const t = nonsense();
  $('#sayText').value = t;
  sayUser(t);
});
$('#randVoice').addEventListener('click', () => {
  const v = voiceState.voices;
  if (!v.length) return;
  const i = Math.floor(Math.random() * v.length);
  voiceSel.value = i;
  voiceState.voice = v[i];
  if (head) sayUser(`Hello. I am ${v[i].name}. This is my voice now.`);
});
st.talkBack = $('#talkBack').checked;
sfx.setMuted($('#mute').checked);
$('#talkBack').addEventListener('change', (e) => { st.talkBack = e.target.checked; if (!st.talkBack) stopSpeaking(); });
$('#mute').addEventListener('change', (e) => sfx.setMuted(e.target.checked));

// ---------- intro / upload ----------
const fileInput = $('#file');
$('#pickFile').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => { handleFile(fileInput.files[0]); fileInput.value = ''; });
$('#demo').addEventListener('click', () => loadFace(makeDemoFace(), { demo: true }));
$('#closeIntro').addEventListener('click', () => { if (head) $('#intro').classList.add('hidden'); });
for (const ev of ['dragenter', 'dragover']) {
  window.addEventListener(ev, (e) => { e.preventDefault(); document.body.classList.add('dragging'); });
}
for (const ev of ['dragleave', 'drop']) {
  window.addEventListener(ev, (e) => { e.preventDefault(); document.body.classList.remove('dragging'); });
}
window.addEventListener('drop', (e) => handleFile(e.dataTransfer?.files?.[0]));
window.addEventListener('paste', (e) => {
  const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith('image/'));
  if (f) handleFile(f);
});

// Webcam
let camStream = null;
$('#webcam').addEventListener('click', async () => {
  try {
    camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 1280, height: 960 } });
    $('#camVideo').srcObject = camStream;
    $('#cam').classList.remove('hidden');
  } catch (e) {
    alert('No webcam for you. (Permission denied or no camera found.)');
  }
});
function closeCam() {
  camStream?.getTracks().forEach((t) => t.stop());
  camStream = null;
  $('#cam').classList.add('hidden');
}
$('#camCancel').addEventListener('click', closeCam);
$('#camSnap').addEventListener('click', () => {
  const v = $('#camVideo');
  const c = document.createElement('canvas');
  c.width = v.videoWidth; c.height = v.videoHeight;
  const g = c.getContext('2d');
  g.translate(c.width, 0); g.scale(-1, 1); // mirror, like a selfie
  g.drawImage(v, 0, 0);
  closeCam();
  sfx.ding();
  loadFace(c);
});

// ---------- loop ----------
const tmpV = new THREE.Vector3();
let last = now();
function frame() {
  const tNow = now();
  const dt = Math.min(0.05, (tNow - last) / 1000);
  last = tNow;
  const t = tNow / 1000;

  if (head) {
    // Look at the mouse when not busy being abused.
    if (!st.pinch && !st.yeet) {
      st.rot.y.t = st.mouse.x * 0.45;
      st.rot.x.t = -st.mouse.y * 0.25;
    }
    const emo = emotions.update(dt, t);
    st.rot.x.t += emo.rotX;
    // Tilt like a curious dog while listening to the mic.
    st.rot.z.t = (mimic.state === 'recording' ? 0.14 : 0) + emo.rotZ;
    for (const s of [st.rot.x, st.rot.y, st.rot.z, st.pos.x, st.pos.y, st.scale]) s.step(dt);

    // Mouth: speech flaps, tongue keeps it ajar, tickles make it laugh.
    let jawT = props.on.tongue ? 0.12 : 0;
    if (isTalking()) {
      jawT = 0.1 + 0.38 * Math.abs(Math.sin(t * 15)) * (0.55 + 0.45 * Math.sin(t * 3.7));
      if (tNow - voiceState.lastBoundary < 90) jawT += 0.2;
    }
    if (head.s.tickle > 0.2) jawT = Math.max(jawT, 0.2 + 0.2 * Math.abs(Math.sin(t * 22)));
    if (st.meltdown) jawT = 0.6 + 0.1 * Math.sin(t * 30);
    // Mimic: the mouth follows the real audio level.
    const lvl = mimic.update();
    if (mimic.state === 'playing') jawT = Math.min(0.75, lvl * 0.9);
    if (mimic.state === 'recording') { st.pos.y.t = lvl * 0.15; head.s.brow.kick(lvl * 2); } else st.pos.y.t = 0;
    // Snacks: gape at incoming food, chew, breathe fire.
    if (st.mouthOpen) jawT = Math.max(jawT, 0.55 + 0.05 * Math.sin(t * 12));
    if (st.chew > 0) {
      st.chew -= dt;
      jawT = 0.05 + 0.22 * Math.abs(Math.sin(t * 13));
      if (tNow - st.lastChomp > 200) { st.lastChomp = tNow; sfx.chomp(); }
      if (st.chew <= 0) { const f = st.chewThen; st.chewThen = null; f?.(); }
    }
    if (st.fire > 0) {
      st.fire -= dt;
      jawT = 0.6;
      const dir = new THREE.Vector3(0, -0.1, 1).applyQuaternion(rig.quaternion);
      fx.burst(mouthWorld(), ['🔥', '🔥', '💨'], 2, { speed: 5, gravity: 2, life: 0.5, size: 0.4, dir });
    }
    if (st.sour > 0) {
      st.sour -= dt;
      head.forceBlink = st.sour > 0 ? 0.85 : 0;
      jawT = 0;
    }
    jawT = Math.max(jawT, emo.jaw);
    head.s.jaw.t = jawT;
    head.s.brow.t = st.meltdown ? -1 : head.s.inflate.t * 0.6 + (isTalking() ? 0.15 * Math.sin(t * 5) : 0) + emo.brow;

    // Eyes: follow the pointer, wander when it is still, or do what the feeling says.
    let lookT = emo.look;
    if (!lookT && st.ptr && tNow - st.ptr.t < 2500) {
      const eye = props.anchorWorld('eyeL', new THREE.Vector3()).add(props.anchorWorld('eyeR', tmpV)).multiplyScalar(0.5).project(camera);
      const sr = stage.getBoundingClientRect();
      const ex = sr.left + (eye.x * 0.5 + 0.5) * sr.width, ey = sr.top + (-eye.y * 0.5 + 0.5) * sr.height;
      lookT = new THREE.Vector2((st.ptr.x - ex) / (sr.width * 0.3), (ey - st.ptr.y) / (sr.height * 0.3));
      if (lookT.length() > 1) lookT.normalize();
    } else if (!lookT) {
      if (tNow > st.nextSaccade) {
        st.nextSaccade = tNow + rnd(900, 2400);
        if (Math.random() < 0.35) st.saccade.set(0, 0);
        else st.saccade.set(rnd(-1, 1), rnd(-0.6, 0.6)).clampLength(0, 0.75);
      }
      lookT = st.saccade;
    }
    head.look.lerp(lookT, Math.min(1, dt * 18));

    // Deflate after the pumping stops. Loudly.
    const inf = head.s.inflate;
    if (!st.popped && inf.t > 0.05 && !pumpTimer && tNow - st.lastPump > 2600) {
      sfx.fart(0.4 + inf.t * 1.4);
      grunt('ooh');
      st.zoom = 0.4 + inf.t * 1.4;
      inf.t = 0;
      react('deflate', { force: true });
    }
    if (st.zoom > 0) {
      // Balloon letting go: zip around like an idiot.
      st.zoom -= dt;
      st.pos.x.kick(rnd(-30, 30) * dt * 10);
      st.pos.y.kick(rnd(-20, 30) * dt * 10);
      st.rot.z.kick(rnd(-30, 30) * dt * 10);
    }

    // Rage + blush tint
    st.rage = Math.max(0, st.rage - dt * (st.meltdown ? 0 : 2.5));
    st.blush = Math.max(0, st.blush - dt * 0.8);
    const r = st.rage / 100;
    const hot = Math.max(0, st.fire) * 0.12;
    head.s.tint.setRGB(r * 0.22 + st.blush * 0.18 + hot, st.blush * 0.02, st.blush * 0.04).add(emo.tint);
    if (st.rage > 70 || st.meltdown) {
      const k = st.meltdown ? 0.06 : 0.015;
      st.rot.z.x += rnd(-k, k);
      st.pos.x.x += rnd(-k, k);
    }
    updateRageUI();

    // Idle chatter
    if (st.talkBack && tNow - st.lastInteraction > 30000) react('idle', { force: true });

    painter.update(dt);
    updateProjectiles(dt);
    bees.update(dt, t);
    head.update(dt);
    props.update(dt, t);

    let ox = 0, oy = 0, spin = 0;
    if (st.yeet) {
      const y = st.yeet;
      y.t += dt;
      if (y.t < 0.8) { const u = y.t / 0.8; ox = y.dir * u * u * 13; oy = u * 3; spin = u * 12; }
      else if (y.t < 1.4) { ox = 40; }
      else if (y.t < 2.2) { const u = (y.t - 1.4) / 0.8, e = 1 - (1 - u) ** 3; ox = -y.dir * (1 - e) * 13; oy = (1 - e) * 4; spin = -(1 - e) * 10; }
      else {
        st.yeet = null;
        sfx.boing(1);
        st.rot.z.kick(y.dir * 10);
        if (y.self) {
          st.meltdown = false;
          st.rage = 0;
          showBubble('…fine. I am back. But I am not happy about it.', 3000);
          talk('Fine. I am back. But I am not happy about it.');
        } else react('pop', { force: true });
      }
    }
    rig.position.set(st.pos.x.x + ox, st.pos.y.x + oy + Math.sin(t * 1.6) * 0.06, 0);
    rig.rotation.set(st.rot.x.x, st.rot.y.x, st.rot.z.x + spin);
    rig.scale.setScalar(Math.max(0.001, st.scale.x));
    shadow.scale.setScalar(Math.max(0.2, 1 - Math.abs(oy) * 0.2) * Math.max(0.01, st.scale.x) * (1 + head.s.inflate.x * 0.8));
    shadow.visible = head.group.visible;

    if (st.disco) {
      discoLights.forEach((l, i) => {
        const a = t * 2 + (i * Math.PI * 2) / 3;
        l.position.set(Math.cos(a) * 3.5, Math.sin(t * 3 + i) * 2, Math.sin(a) * 3.5 + 1.5);
        l.intensity = 9 + 6 * Math.sin(t * 8 + i);
      });
      head.uniforms.uHue.value = Math.sin(t * 1.5) * 0.8;
    }

    st.clones.forEach((m, i) => {
      const a = m.userData.a + t * 0.6;
      m.position.set(Math.cos(a) * 3.6, Math.sin(t * 2 + m.userData.ph) * 0.6 + 0.2, Math.sin(a) * 2 - 2.2);
      m.rotation.set(Math.sin(t + i) * 0.3, -a + Math.PI / 2 + Math.sin(t * 3 + i), Math.sin(t * 2 + i) * 0.4);
    });

    // Speech bubble follows the head.
    tmpV.set(0.75, 1.35, 0).applyMatrix4(rig.matrixWorld).project(camera);
    const w = stage.clientWidth, h = stage.clientHeight;
    const bw = bubble.offsetWidth, bh = bubble.offsetHeight;
    // Bubble box starts 30px left and 70px up from this point (see CSS margins).
    const bx = Math.min(w - bw + 20, Math.max(40, (tmpV.x * 0.5 + 0.5) * w));
    const by = Math.min(h - bh + 40, Math.max(80, (-tmpV.y * 0.5 + 0.5) * h));
    bubble.style.transform = `translate(${bx}px, ${by}px)`;
  }
  fx.update(dt);
  renderer.render(scene, camera);
  if (recorder.active) recorder.draw();
  if (st.snapRequest) {
    // Must run right after render, while the WebGL buffer still holds the frame.
    st.snapRequest = false;
    recorder.snapshot().then((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `headcase-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
    const f = document.createElement('div');
    f.className = 'flash';
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 450);
    sfx.whipCrack();
    showBubble('Say cheese! 📸', 1200);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Link options: ?demo loads Default Dave right away, ?cat=voice opens a tool bar category.
const params = new URLSearchParams(location.search);
if (params.has('demo')) loadFace(makeDemoFace(), { demo: true });
if (CAT_TITLES[params.get('cat')]) setCategory(params.get('cat'));

// Debug handle for the curious (and for automated tests).
window.headcase = { loadFace, get head() { return head; }, get props() { return props; }, st, ACTIONS, camera, stage, mimic, recorder, bees, emotions, fx };
