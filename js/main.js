import * as THREE from 'three';
import { Head } from './head.js';
import { Props } from './props.js';
import { FX } from './fx.js';
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

let head = null, props = null;
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
};

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.position.z = Math.max(6.4, 6.4 * 1.05 / camera.aspect);
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
function updateRageUI() {
  $('#rage i').style.width = `${st.rage}%`;
  $('#rageFace').textContent = st.meltdown ? '🤯' : ['😊', '😐', '😠', '🤬'][Math.min(3, Math.floor(st.rage / 26))];
  document.body.classList.toggle('angry', st.rage > 70);
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
  return { point: hit.point, local, vi: best };
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

canvas.addEventListener('pointerdown', (e) => {
  sfx.unlock();
  if (!head) return;
  const hit = hitTest(e);
  st.pointer = { x: e.clientX, y: e.clientY, t: now(), lx: e.clientX, ly: e.clientY, lt: now(), hit, swiped: false };
  canvas.setPointerCapture(e.pointerId);
  switch (st.tool) {
    case 'poke': if (hit) doPoke(hit, e); break;
    case 'bonk': if (hit) doBonk(hit, e); break;
    case 'tickle': if (hit) doTickle(hit); break;
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
  }
});

function endPointer(e) {
  const p = st.pointer;
  st.pointer = null;
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

// ---------- tool picker ----------
const CURSORS = { poke: '👉', pinch: '🤏', slap: '🖐️', bonk: '🔨', tickle: '🪶' };
function setTool(tool) {
  st.tool = tool;
  $$('[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === tool));
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'><text x='4' y='38' font-size='36'>${CURSORS[tool]}</text></svg>`;
  canvas.style.cursor = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") 12 12, pointer`;
  $('#hint').textContent = {
    poke: 'CLICK the head. Poke it. You know you want to.',
    pinch: 'GRAB and DRAG to stretch that face like taffy.',
    slap: 'SWIPE fast across the face. Or click a cheek.',
    bonk: 'CLICK to bonk. Birds included.',
    tickle: 'HOLD and WIGGLE over the face.',
  }[tool];
  sfx.squeak(1.5);
}
$$('[data-tool]').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));
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
  $$('[data-prop], [data-action]').forEach((b) => b.classList.remove('on'));
  sfx.ding();
  showBubble('Good as new. Mostly.');
}

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
    for (const s of [st.rot.x, st.rot.y, st.rot.z, st.pos.x, st.pos.y, st.scale]) s.step(dt);

    // Mouth: speech flaps, tongue keeps it ajar, tickles make it laugh.
    let jawT = props.on.tongue ? 0.12 : 0;
    if (isTalking()) {
      jawT = 0.1 + 0.38 * Math.abs(Math.sin(t * 15)) * (0.55 + 0.45 * Math.sin(t * 3.7));
      if (tNow - voiceState.lastBoundary < 90) jawT += 0.2;
    }
    if (head.s.tickle > 0.2) jawT = Math.max(jawT, 0.2 + 0.2 * Math.abs(Math.sin(t * 22)));
    if (st.meltdown) jawT = 0.6 + 0.1 * Math.sin(t * 30);
    head.s.jaw.t = jawT;
    head.s.brow.t = st.meltdown ? -1 : head.s.inflate.t * 0.6 + (isTalking() ? 0.15 * Math.sin(t * 5) : 0);

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
    head.s.tint.setRGB(r * 0.22 + st.blush * 0.18, st.blush * 0.02, st.blush * 0.04);
    if (st.rage > 70 || st.meltdown) {
      const k = st.meltdown ? 0.06 : 0.015;
      st.rot.z.x += rnd(-k, k);
      st.pos.x.x += rnd(-k, k);
    }
    updateRageUI();

    // Idle chatter
    if (st.talkBack && tNow - st.lastInteraction > 30000) react('idle', { force: true });

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
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Debug handle for the curious (and for automated tests).
window.headcase = { loadFace, get head() { return head; }, st, ACTIONS };
