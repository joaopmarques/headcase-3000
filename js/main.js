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
import { Vomit } from './vomit.js';
import { Achievements, ACHIEVEMENTS } from './achievements.js';
import { Nuke } from './nuke.js';
import * as samples from './samples.js';
import * as sfx from './audio.js';
import { voiceState, loadVoices, speak, stopSpeaking, isTalking } from './voice.js';
import { line, nextLie, nonsense, pick } from './lines.js';
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
const vomit = new Vomit(scene);
const nuke = new Nuke(scene);
// Recorded samples load after the first tap (browsers need a gesture for audio anyway).
window.addEventListener('pointerdown', () => { sfx.unlock(); samples.loadSamples(); }, { once: true });
vomit.onSplat = () => sfx.puddleSplat();

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
  caffeine: 0, // seconds of caffeine overload left
  crash: 0,    // seconds of post-coffee nap left
  lastJitterLook: 0,
  lastSnore: 0,
  chaosRunning: false,
  ptr: null,
  sickAt: 0, // when a stuffed head throws up (ms), 0 = not scheduled
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
  camera.userData.baseZ = camera.position.z;
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

// ---------- achievements ----------
// Achievement toast: an actual slice of toast pops up from the bottom of the screen.
let toastSlot = 0;
function toast(a) {
  const el = document.createElement('div');
  el.className = 'toast';
  // Spread several at once across the screen; each gets its own spin.
  const x = [50, 32, 68, 42, 58][toastSlot++ % 5] + rnd(-4, 4);
  const spin = (Math.random() < 0.5 ? -1 : 1);
  el.style.setProperty('--x', `${x}vw`);
  el.style.setProperty('--peak', `${Math.round(innerHeight * rnd(0.52, 0.6) + 200)}px`);
  el.style.setProperty('--r0', `${spin * -25}deg`);
  el.style.setProperty('--r1', `${spin * rnd(6, 12)}deg`);
  el.style.setProperty('--r2', `${spin * rnd(-6, -2)}deg`);
  el.style.setProperty('--r3', `${spin * rnd(40, 80)}deg`);
  el.style.setProperty('--dx', `${spin * rnd(40, 120)}px`);
  el.innerHTML = '<div class="bread"></div><div class="label"><span class="medal"></span><small>ACHIEVEMENT TOASTED</small><strong></strong></div>';
  el.querySelector('.medal').textContent = a.emoji;
  el.querySelector('strong').textContent = a.name;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 4000);
  sfx.toasterPop();
  updateTrophy(true);
  if (!$('#achScreen').classList.contains('hidden')) renderAchievements();
}
const ach = new Achievements({ onUnlock: toast });
function updateTrophy(bump = false) {
  $('#trophyCount').textContent = `${ach.count}/${ach.total}`;
  if (bump) {
    const b = $('#trophyBtn');
    b.classList.remove('bump');
    void b.offsetWidth;
    b.classList.add('bump');
  }
}
function renderAchievements() {
  $('#achCount').textContent = `${ach.count} / ${ach.total}`;
  $('#achBar').style.width = `${(ach.count / ach.total) * 100}%`;
  const grid = $('#achGrid');
  grid.innerHTML = '';
  for (const a of ACHIEVEMENTS) {
    const got = ach.has(a.id);
    const pr = ach.progress(a);
    const el = document.createElement('div');
    el.className = `ach-item${got ? '' : ' locked'}`;
    const meta = got
      ? `unlocked ${new Date(ach.unlocked[a.id]).toLocaleDateString()}`
      : pr ? `${pr.value} / ${pr.need}` : 'locked';
    el.innerHTML = `<div class="medal">${got ? a.emoji : '🔒'}</div><div><b></b><span class="desc"></span><span class="meta"></span></div>`;
    el.querySelector('b').textContent = a.name;
    el.querySelector('.desc').textContent = a.desc;
    el.querySelector('.meta').textContent = meta;
    grid.appendChild(el);
  }
}
$('#trophyBtn').addEventListener('click', () => {
  sfx.unlock();
  sfx.ding();
  renderAchievements();
  $('#achScreen').classList.remove('hidden');
});
$('#achClose').addEventListener('click', () => $('#achScreen').classList.add('hidden'));
$('#achScreen').addEventListener('click', (e) => { if (e.target.id === 'achScreen') $('#achScreen').classList.add('hidden'); });
// Hold to reset: the button inflates and shakes while held, and pops when it is done.
{
  const btn = $('#achReset');
  const HOLD_MS = 2000;
  let t0 = 0, raf = 0, lastSqueak = 0;
  const setP = (p) => {
    btn.style.setProperty('--p', p.toFixed(3));
    // Shake harder the longer it is held.
    const j = p * p;
    btn.style.translate = `${rnd(-4, 4) * j}px ${rnd(-3, 3) * j}px`;
    btn.style.rotate = `${rnd(-7, 7) * j}deg`;
  };
  const tick = (now) => {
    const p = Math.min(1, (now - t0) / HOLD_MS);
    setP(p);
    if (now - lastSqueak > 160) { lastSqueak = now; sfx.squeak(0.7 + p * 1.1); }
    if (p >= 1) return done();
    raf = requestAnimationFrame(tick);
  };
  const start = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (raf) return;
    sfx.unlock();
    btn.classList.add('holding');
    t0 = performance.now();
    lastSqueak = 0;
    raf = requestAnimationFrame(tick);
  };
  const cancel = () => {
    if (!raf) return;
    cancelAnimationFrame(raf);
    raf = 0;
    btn.classList.remove('holding');
    setP(0);
    sfx.squeak(0.5);
  };
  const done = () => {
    raf = 0;
    btn.classList.remove('holding');
    btn.classList.add('popped');
    setP(0);
    setTimeout(() => btn.classList.remove('popped'), 500);
    sfx.pop();
    const r = btn.getBoundingClientRect();
    // Confetti on top of the trophy case (stage stamps would sit behind the overlay).
    for (let i = 0; i < 10; i++) {
      const el = document.createElement('div');
      el.className = 'stamp jab';
      el.textContent = pick(['💥', '🏆', '✨', '🎉']);
      Object.assign(el.style, { position: 'fixed', zIndex: 80, left: `${r.left + r.width / 2 + rnd(-70, 70)}px`, top: `${r.top + rnd(-50, 20)}px`, fontSize: '40px' });
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 700);
    }
    ach.reset();
    updateTrophy();
    renderAchievements();
    showBubble('All trophies gone. Like my body.', 2200);
  };
  btn.addEventListener('pointerdown', start);
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, cancel);
  btn.addEventListener('click', (e) => e.stopPropagation());
  // Keyboard: hold Space or Enter.
  btn.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) start(e); });
  btn.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') cancel(); });
}
updateTrophy();

// Credit: hovering it floats a photo of the culprit next to the cursor.
{
  const credit = $('#credit'), photo = $('#creditPhoto');
  const place = (e) => {
    // Below and to the right of the cursor, so the credit line stays readable.
    const w = photo.offsetWidth || 252, h = photo.offsetHeight || 190;
    const x = Math.min(e.clientX + 22, innerWidth - w - 12);
    const y = Math.min(e.clientY + 26, innerHeight - h - 12);
    photo.style.translate = `${x}px ${y}px`;
  };
  credit.addEventListener('pointerenter', (e) => { place(e); photo.classList.add('show'); });
  credit.addEventListener('pointermove', place);
  credit.addEventListener('pointerleave', () => photo.classList.remove('show'));
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
  head: () => head, props: () => props, painter: () => painter, vomit: () => vomit, ach: () => ach, samples,
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
  if (b.dataset.emote === 'love' || b.dataset.emote === 'cry') samples.play('aww', { vol: 0.8, rate: b.dataset.emote === 'cry' ? 0.85 : 1 });
  ach.bumpSet('feels', b.dataset.emote);
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
  vomit.clear();
  st.sickAt = 0; st.sickWarned = false;
  st.caffeine = 0; st.crash = 0;
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
  ach.bump('poke');
  head.poke(hit.vi, 0.3);
  st.rot.y.kick(hit.local.x * 4);
  st.rot.x.kick(-hit.local.y * 3);
  head.s.brow.kick(10);
  head.s.jaw.kick(7);
  const nosePos = props.on.clown ? props.anchorWorld('nose', new THREE.Vector3()) : null;
  if (nosePos && nosePos.distanceTo(hit.point) < 0.3) {
    if (!samples.play('honk', { rate: rnd(0.9, 1.1) })) sfx.honk();
    fx.burst(hit.point, ['🤡', '📯', '🎺'], 5, { speed: 2.5, size: 0.3, life: 0.8 });
    showBubble('HONK.');
    grunt('hmph');
    addRage(2);
    return;
  }
  // Mix recorded cartoon sounds in with the synth ones, so pokes do not all sound the same.
  const r = Math.random();
  const played = (r < 0.3 && samples.play('boing', { rate: rnd(0.9, 1.4), vol: 0.7 }))
    || (r >= 0.3 && r < 0.5 && samples.play('squeak', { rate: rnd(0.8, 1.3), vol: 0.8 }));
  if (!played) sfx.boing(rnd(0.8, 1.4));
  sfx.boop();
  grunt(Math.random() < 0.6 ? 'ow' : 'yelp');
  stamp('👉', e.clientX, e.clientY, 'jab');
  fx.burst(hit.point, ['💥', '⭐', '💢'], 5, { speed: 2, size: 0.28, life: 0.7 });
  addRage(7);
  react('poke');
}

function doBonk(hit, e) {
  ach.bump('bonk');
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
  ach.bump('slap');
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
    ach.bump('giggle');
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
    ach.bump('splat');
    head.poke(hit.vi, 0.32, 0.42);
    st.rot.y.kick(hit.local.x * 3);
    st.rot.x.kick(-hit.local.y * 2);
    head.s.jaw.kick(8);
    head.s.brow.kick(-6);
    head.forceBlink = 0.8;
    setTimeout(() => head && (head.forceBlink = 0), 500);
    if (!samples.play('splat', { rate: rnd(0.85, 1.2), vol: 0.9 })) sfx.splat();
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
  ach.bump('stroke');
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
      if (P.yelled < 2 && P.len > 0.85) { P.yelled = 2; ach.unlock('taffy'); sfx.rip(); grunt('yelp'); react('pinchMax', { force: true }); addRage(5); }
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
// The things that should pop in one by one. Wrappers (the snack tray, the voice form and
// its settings row) are walked into, so each snack, button, and slider animates on its own.
const STAGGER_WRAPPERS = '.tray, form, .voicebar, .presets';
function staggerItems(panel) {
  const out = [];
  const walk = (el) => {
    for (const c of el.children) {
      if (c.matches(STAGGER_WRAPPERS)) walk(c);
      else out.push(c);
    }
  };
  walk(panel);
  return out;
}
const CAT_NOTES = { food: '↓ drag a snack into the mouth', chaos: 'hold 🎈 to pump' };
function setCategory(cat) {
  $$('[data-cat]').forEach((b) => b.classList.toggle('on', b.dataset.cat === cat));
  $$('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== cat; });
  $('#tbTitle').textContent = CAT_TITLES[cat];
  const note = CAT_NOTES[cat];
  $('#tbNote').hidden = !note;
  $('#tbNote').textContent = note ?? '';
  $('#toolbar .tb-body').scrollLeft = 0;
  // Pop the new items in one after another, and bounce the tab.
  const panel = $(`[data-panel="${cat}"]`);
  staggerItems(panel).forEach((el, i) => {
    el.classList.add('stagger');
    el.style.setProperty('--i', i);
  });
  panel.classList.remove('enter');
  void panel.offsetWidth;
  panel.classList.add('enter');
  const tab = $('#tbTitle');
  tab.classList.remove('pop');
  void tab.offsetWidth;
  tab.classList.add('pop');
}
// Every button press gets a squash-and-stretch. (Not the hold-to-reset: it has its own inflate.)
document.addEventListener('pointerdown', (e) => {
  const b = e.target.closest('button');
  if (!b || b.classList.contains('hold-reset')) return;
  b.classList.remove('squish');
  void b.offsetWidth;
  b.classList.add('squish');
});
document.addEventListener('animationend', (e) => {
  if (e.animationName === 'squish') e.target.classList.remove('squish');
  // Pop-in done: drop the class. Otherwise a later press animation (squish) ends, the
  // pop-in rule applies again, and the item restarts from invisible.
  if (e.animationName === 'itemin') e.target.classList.remove('stagger');
});
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
  st.sickAt = 0; // exploding already emptied the stomach
  st.sickWarned = false;
  ach.bump('pop');
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

const DISCO_BPM = 120; // measured from the song
function discoBeat() {
  if (!head) return;
  st.pos.y.v = 2.2;
  head.s.jaw.kick(5);
  head.s.brow.kick(6);
  st.rot.z.kick(rnd(-3, 3));
}
function toggleDisco() {
  st.disco = !st.disco;
  document.body.classList.toggle('disco', st.disco);
  $('[data-action="disco"]').classList.toggle('on', st.disco);
  if (st.disco) {
    ach.unlock('nightfever');
    // The synth beat plays right away; the real song takes over once it has loaded.
    sfx.startDisco(discoBeat);
    const token = (st.discoToken = (st.discoToken ?? 0) + 1);
    samples.loadOne('disco').then((buf) => {
      if (!buf || !st.disco || token !== st.discoToken) return;
      sfx.stopDisco();
      st.discoSong = samples.loop('disco', { vol: 0.85 });
      st.discoBeatN = -1;
    });
    react('disco', { force: true });
  } else {
    sfx.stopDisco();
    st.discoSong?.stop();
    st.discoSong = null;
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
  samples.play('slide', { rate: 1.3, vol: 0.8 });
  grunt(self ? 'argh' : 'woo');
  if (!self) { react('yeet', { force: true }); ach.unlock('yeet'); }
}

function meltdown() {
  st.meltdown = true;
  ach.unlock('meltdown');
  sfx.scream();
  grunt('argh');
  const text = line('rage');
  showBubble(text, 1500);
  talk(text, { pitch: 0.2, rate: 1.4 });
  // Wind-up: it swells and turns red while the red/black strobe runs. Then: KABOOM.
  if (head) head.s.inflate.t = 0.55;
  setTimeout(detonate, 1500);
}

function detonate() {
  if (!head || st.nuked) return;
  st.nuked = true;
  st.popped = true; // reuses every "head is gone" guard
  stopPump();
  emotions.stop();
  const p = head.group.getWorldPosition(new THREE.Vector3());
  head.group.visible = false;
  nuke.detonate(p);
  if (!samples.play('nuke', { vol: 1 })) sfx.pop();
  sfx.nukeRumble();
  fx.burst(p, ['🧠', '👁️', '🦷', '👃', '☢️'], 30, { speed: 9, size: 0.42, life: 2.2, gravity: -7 });
  const f = document.createElement('div');
  f.className = 'flash nuke-flash';
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 1600);
  showBubble('☢ KABOOM ☢', 2000);
  // Regrow once the cloud has mostly cleared.
  setTimeout(() => {
    if (!head) return;
    st.nuked = false;
    st.popped = false;
    st.meltdown = false;
    st.rage = 0;
    head.reset();
    st.scale.x = 0.01; st.scale.v = 0;
    head.group.visible = true;
    if (!samples.play('boing', { rate: 0.8 })) sfx.boing(1.1);
    showBubble('…okay. I feel better now.', 2600);
    talk('Okay. I feel better now.');
  }, 5600);
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
  vomit.clear();
  st.sickAt = 0; st.sickWarned = false;
  if (st.crash > 0 || st.caffeine > 0) head.forceBlink = 0;
  st.caffeine = 0; st.crash = 0;
  $$('[data-prop], [data-action]:not([data-action="rec"]):not([data-action="mimic"])').forEach((b) => b.classList.remove('on'));
  head.look.set(0, 0);
  if (!samples.play('scratch', { vol: 0.9 })) sfx.ding();
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
    ach.unlock('copycat');
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
      ach.unlock('director');
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
  share.onclick = () => navigator.share({ files: [file], title: 'HEADCASE 4000' }).catch(() => {});
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
// Six swallowed snacks fill the head up. Broccoli does not count: it gets spat out.
const BITES_TO_FULL = 6;
function isFull() { return head.s.fatTarget >= 0.99; }
function swallow() {
  const s = head.s;
  sfx.gulp();
  s.fatTarget = Math.min(1, s.fatTarget + 1 / BITES_TO_FULL);
  st.rage = Math.max(0, st.rage - 12); // snacks calm the beast
  if (isFull()) {
    ach.unlock('glutton');
    react('full', { force: true });
    // Too much food. The body files a complaint in 5 to 7 seconds.
    if (!st.sickAt) st.sickAt = now() + rnd(5000, 7000);
    return true;
  }
  return false;
}
function eat(food) {
  if (!head || st.popped) return;
  st.lastInteraction = now();
  if (food.id !== 'broccoli' && isFull()) {
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
      // A 3D spray of chewed broccoli, plus one intact floret for the drama.
      const dir = new THREE.Vector3(0, 0.25, 1).applyQuaternion(rig.quaternion);
      vomit.spit(mouthWorld(), dir, 16);
      fx.burst(mouthWorld(), ['🥦'], 1, { speed: 6, gravity: -10, size: 0.35, dir });
      react('broccoli', { force: true });
    });
    return;
  }
  if (food.id === 'chili') {
    chew(0.7, () => {
      st.fire = 2.2;
      ach.unlock('dragon');
      sfx.fireBreath(2);
      grunt('argh');
      if (!swallow()) react('chili', { force: true });
    });
    return;
  }
  if (food.id === 'espresso') {
    chew(0.5, () => {
      sfx.slurp();
      ach.unlock('wired');
      if (!swallow()) {
        const text = line('caffeine');
        showBubble(text, 2200);
        if (st.talkBack) talk(text, { rate: 2.6, pitch: 1.7 });
      }
      st.caffeine = 4.5;
      st.crash = 0;
      grunt('woo');
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
      if (!swallow()) react('lemon', { force: true });
    });
    return;
  }
  chew(1.1, () => {
    if (food.id === 'donut') sfx.sparkle();
    if (!swallow()) react('yum', { force: true });
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

// ---------- chaos button: five random things in a row ----------
// A random spot on the face, dressed up like a pointer hit, so the tool functions work as usual.
function randomFaceHit() {
  let vi = 0;
  for (let k = 0; k < 40; k++) {
    vi = Math.floor(Math.random() * head.n);
    if (head.base[vi * 3 + 2] > 0.45) break;
  }
  const local = head.vertexPos(vi, new THREE.Vector3());
  const point = head.mesh.localToWorld(local.clone());
  const uv1 = new THREE.Vector2().fromBufferAttribute(head.geo.attributes.uv1, vi);
  const p = point.clone().project(camera);
  const r = stage.getBoundingClientRect();
  const evt = { clientX: r.left + (p.x * 0.5 + 0.5) * r.width, clientY: r.top + (-p.y * 0.5 + 0.5) * r.height };
  return { hit: { point, local, vi, uv1 }, evt };
}
const CHAOS_STEPS = [
  ['POKE', () => { const { hit, evt } = randomFaceHit(); doPoke(hit, evt); }],
  ['SLAP', () => { const { hit, evt } = randomFaceHit(); doSlap(Math.random() < 0.5 ? -1 : 1, hit, evt); }],
  ['BONK', () => { const { hit, evt } = randomFaceHit(); doBonk(hit, evt); }],
  ['PIE', () => { const { evt } = randomFaceHit(); const keep = st.ammo; st.ammo = pick(AMMO_ORDER); throwAt(evt); st.ammo = keep; }],
  ['TWIST', () => ACTIONS.twist()],
  ['SPIN', () => ACTIONS.spin()],
  ['NOODLE', () => ACTIONS.noodle()],
  ['LIE', () => ACTIONS.lie()],
  ['SNEEZE', () => emotions.play('sneeze')],
  ['WINK', () => emotions.play('wink')],
  ['SCREAM', () => emotions.play('scream')],
  ['LOVE', () => emotions.play('love')],
  ['PUMP', () => { for (let i = 0; i < 3; i++) setTimeout(pumpOnce, i * 150); }],
];
function runChaos() {
  if (st.chaosRunning || st.popped) return;
  st.chaosRunning = true;
  ach.unlock('agentofchaos');
  const btn = $('[data-action="chaos"]');
  btn.classList.add('on');
  const hint = $('#hint');
  const oldHint = hint.textContent;
  const steps = [...CHAOS_STEPS].sort(() => Math.random() - 0.5).slice(0, 5);
  if (!samples.play('airhorn', { vol: 0.8 })) sfx.slideWhistle(true);
  react('chaos', { force: true });
  steps.forEach(([name, fn], i) => {
    setTimeout(() => {
      if (!head || st.popped) return;
      hint.textContent = `🎲 CHAOS ${i + 1}/5: ${name}!`;
      fn();
    }, 700 + i * 1100);
  });
  setTimeout(() => {
    st.chaosRunning = false;
    btn.classList.remove('on');
    hint.textContent = oldHint;
  }, 700 + steps.length * 1100 + 400);
}

const ACTIONS = {
  melt() {
    const on = (head.s.meltTarget = head.s.meltTarget ? 0 : 1);
    if (on) ach.unlock('puddle');
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
    setTimeout(() => { if (head) { head.s.scaleY.t = 1; if (!samples.play('slide')) sfx.slideWhistle(false); } }, 1700);
  },
  lie() {
    ach.bump('lie');
    const s = head.s.nose;
    s.t = Math.min(2.4, s.t + 0.45);
    s.kick(3);
    sfx.creak();
    const p = props.anchorWorld('nose', new THREE.Vector3());
    fx.burst(p, ['🤥', '🌳', '🪵'], 4, { speed: 1.5, size: 0.3 });
    sayUser(nextLie());
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
  chaos: runChaos,
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
  if (Object.values(props.on).filter(Boolean).length >= 5 && ['googly', 'hat', 'stache', 'shades', 'clown'].every((k) => props.on[k])) ach.unlock('driplord');
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
  // Pity laugh after the punchline: on the 1st joke, then every 10th (11th, 21st...).
  // Any more often and it stops being funny. (The speech engine does not report its end
  // reliably, so the timing is an estimate.)
  st.jokes = (st.jokes ?? 0) + 1;
  if (st.jokes % 10 === 1) {
    const at = 700 + (t.length * 62) / Math.max(0.5, voiceState.rate);
    clearTimeout(st.laughTimer);
    st.laughTimer = setTimeout(() => samples.play('laugh', { vol: 0.7 }), at);
  }
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

// ---------- mood background ----------
// Four gradient stops per mood (center to edge). The stage blends toward the active ones.
const MOODS = {
  base: ['#ffffff', '#ffd6f0', '#b7a6ff', '#6a4cff'],
  rage: ['#fff1e0', '#ffb199', '#ff4a2c', '#8a0014'],
  meltdown: ['#ffdddd', '#ff2a2a', '#7a0000', '#140000'],
  sick: ['#f4ffd6', '#cfe89a', '#8fb82c', '#34500c'],
  caffeineA: ['#ffffe0', '#fff15c', '#00e5ff', '#0033ff'],
  caffeineB: ['#e0ffff', '#00e5ff', '#fff15c', '#ff00aa'],
  crash: ['#aab8f0', '#5d6fc0', '#232f78', '#070b26'],
  fire: ['#fff4d0', '#ffc36b', '#ff5a1f', '#7a1500'],
  melt: ['#fff0d0', '#ffc47a', '#ff8a3c', '#8a3300'],
  bees: ['#fffbe0', '#ffe36b', '#f2a900', '#3a2a00'],
  love: ['#fff0f7', '#ffc2e2', '#ff6fb5', '#a0186e'],
  cry: ['#eef6ff', '#bcd6f0', '#6f93c4', '#223a60'],
  scream: ['#ffffff', '#ffd0d0', '#ff3a3a', '#5a0000'],
  flash: ['#ffffff', '#ffffff', '#fff6d0', '#ffd6f0'],
  nuke: ['#fff3c0', '#ffb040', '#d2461a', '#2a0c04'],
  ash: ['#d8cfc8', '#9a8a80', '#4a3c36', '#140e0c'],
};
const toColors = (list) => list.map((h) => new THREE.Color(h));
const MOOD_COLORS = Object.fromEntries(Object.entries(MOODS).map(([k, v]) => [k, toColors(v)]));
const bgNow = toColors(MOODS.base);
const bgTarget = toColors(MOODS.base);
let bgFrame = 0;
function updateMood(dt, t) {
  bgTarget.forEach((c, i) => c.copy(MOOD_COLORS.base[i]));
  const mix = (name, w) => {
    if (w <= 0.001) return;
    const pal = MOOD_COLORS[name];
    bgTarget.forEach((c, i) => c.lerp(pal[i], Math.min(1, w)));
  };
  const emo = emotions.active?.kind;
  mix('bees', bees.active ? 0.55 : 0);
  mix('melt', head ? head.s.melt : 0);
  mix('love', emo === 'love' ? 0.9 : 0);
  mix('cry', emo === 'cry' ? 0.9 : 0);
  mix('sick', emo === 'sick' ? 0.95 : Math.min(0.5, vomit.parts.length / 200));
  mix('rage', Math.pow(st.rage / 100, 1.4));
  mix('fire', st.fire > 0 ? 0.9 : 0);
  mix('crash', st.crash > 0 ? 0.85 : 0);
  if (st.caffeine > 0) mix(Math.sin(t * 18) > 0 ? 'caffeineA' : 'caffeineB', 0.9);
  if (emo === 'scream') mix('scream', 0.6 + 0.4 * Math.abs(Math.sin(t * 30)));
  if (st.meltdown) mix('meltdown', Math.sin(t * 16) > 0 ? 1 : 0.5);
  if (st.nuked) {
    // White flash, then fire, then ash.
    const nt = nuke.t;
    mix(nt < 0.35 ? 'flash' : nt < 2.5 ? 'nuke' : 'ash', 1);
  } else if (st.popped) mix('flash', 1);
  if (st.clones.length) bgTarget.forEach((c, i) => c.offsetHSL((t * 0.25 + i * 0.12) % 1, 0.25, 0));
  // Strobes snap; everything else eases in and out.
  const snappy = st.caffeine > 0 || (st.meltdown && !st.nuked) || (st.popped && !st.nuked) || emo === 'scream' || (st.nuked && nuke.t < 0.4);
  const k = snappy ? 1 : 1 - Math.exp(-dt * 3.5);
  bgNow.forEach((c, i) => c.lerp(bgTarget[i], k));
  // Writing CSS every other frame is plenty.
  if (bgFrame++ % 2 === 0) {
    stage.style.setProperty('--c0', `#${bgNow[0].getHexString()}`);
    stage.style.setProperty('--c1', `#${bgNow[1].getHexString()}`);
    stage.style.setProperty('--c2', `#${bgNow[2].getHexString()}`);
    stage.style.setProperty('--c3', `#${bgNow[3].getHexString()}`);
    document.body.style.background = `#${bgNow[3].getHexString()}`;
  }
  // The rings pulse faster when things get heated.
  const heat = Math.max(st.rage / 100, st.caffeine > 0 ? 1 : 0, st.meltdown ? 1 : 0);
  stage.classList.toggle('frantic', heat > 0.85);
  stage.classList.toggle('fast', heat > 0.45 && heat <= 0.85);
}

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
    // Espresso: vibrate first, nap after.
    if (st.caffeine > 0) {
      st.caffeine -= dt;
      st.rot.z.x += rnd(-0.04, 0.04);
      st.rot.y.x += rnd(-0.03, 0.03);
      st.pos.x.x += rnd(-0.025, 0.025);
      if (st.caffeine <= 0) { st.crash = 5; st.lastSnore = 0; }
    } else if (st.crash > 0) {
      st.crash -= dt;
      st.rot.x.t += 0.22;
      st.rot.z.t += 0.14;
      if (tNow - st.lastSnore > 1700) {
        st.lastSnore = tNow;
        sfx.snore();
        const top = props.anchorWorld('top', new THREE.Vector3());
        fx.burst(top, ['💤'], 1, { speed: 1, gravity: 0.8, size: 0.4, life: 1.8, dir: new THREE.Vector3(0.4, 1, 0.2) });
      }
      if (st.crash <= 0) {
        head.forceBlink = 0;
        const text = line('crash');
        showBubble(text, 2200);
        if (st.talkBack) talk(text);
      }
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
    if (st.caffeine > 0) {
      head.s.brow.t += 0.9;
      head.s.jaw.t = Math.max(head.s.jaw.t, 0.08 + 0.12 * Math.abs(Math.sin(t * 38)));
    } else if (st.crash > 0) {
      head.forceBlink = 0.62; // droopy eyelids
      head.s.jaw.t = Math.max(head.s.jaw.t, 0.12);
      head.s.brow.t -= 0.3;
    }

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
    if (st.caffeine > 0) {
      if (tNow - st.lastJitterLook > 90) { st.lastJitterLook = tNow; st.saccade.set(rnd(-1, 1), rnd(-0.6, 0.6)); }
      lookT = st.saccade;
    } else if (st.crash > 0) lookT = st.saccade.set(0, -0.7);
    head.look.lerp(lookT, Math.min(1, dt * 18));

    // Deflate after the pumping stops. Loudly.
    const inf = head.s.inflate;
    if (!st.popped && inf.t > 0.05 && !pumpTimer && tNow - st.lastPump > 2600) {
      if (!samples.play('fart', { rate: 1.15 - inf.t * 0.4, vol: 0.9 })) sfx.fart(0.4 + inf.t * 1.4);
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
    if (st.talkBack && tNow - st.lastInteraction > 30000) {
      samples.play('crickets', { vol: 0.8 }); // awkward silence, but louder
      react('idle', { force: true });
    }

    if (st.sickAt) {
      if (tNow >= st.sickAt - 1200 && !st.sickWarned) {
        st.sickWarned = true;
        grunt('uhoh');
        showBubble('Uh oh… I ate too much.', 1400);
      }
      // Wait out a yeet or a pop, then let it all out.
      if (tNow >= st.sickAt && !st.yeet && !st.popped) {
        st.sickAt = 0;
        st.sickWarned = false;
        if (emotions.active?.kind !== 'sick') emotions.play('sick');
      }
    }
    painter.update(dt);
    updateProjectiles(dt);
    bees.update(dt, t);
    vomit.update(dt);
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

    if (st.disco && st.discoSong) {
      // Bob on the song's real beats, read off the audio clock so it never drifts.
      const beat = Math.floor((sfx.audioCtx().currentTime - st.discoSong.t0) / (60 / DISCO_BPM));
      if (beat > st.discoBeatN) { st.discoBeatN = beat; if (beat >= 0) discoBeat(); }
    }
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
  updateMood(dt, t);
  fx.update(dt);
  nuke.update(dt);
  // Nuke camera: pull back to fit the cloud, and shake.
  const baseZ = camera.userData.baseZ ?? camera.position.z;
  camera.userData.baseZ = baseZ;
  const zoom = nuke.zoom, shake = nuke.shake * 0.35;
  camera.position.set(rnd(-shake, shake), 0.25 + zoom * 1.4 + rnd(-shake, shake), baseZ * (1 + zoom * 0.75));
  camera.lookAt(0, 0.3 + zoom * 1.1, 0);
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
