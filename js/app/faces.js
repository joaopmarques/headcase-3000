// Loading faces: detection, the intro screen, uploads, and the webcam.
import { Head } from '../head.js';
import { Props } from '../props.js';
import { Painter } from '../paint.js';
import * as sfx from '../audio.js';
import { pick } from '../lines.js';
import { makeDemoFace } from '../demoFace.js';
import { fallbackFit } from '../fitcore.js';
import { $, $$, app, st } from './ctx.js';
import { canvas, rig, fx, vomit, steam } from './stage.js';

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
  facePromise ??= import('../face.js');
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
    if (!result.fit.detected && !demo) app.showBubble('I could not find a face, so I made one up. You are welcome.', 3500);
    else app.react('hello', { force: true });
  }, 700);
}

function installHead(canvas, fit) {
  app.clearClones();
  if (app.head) app.head.dispose();
  fx.clearOrbits();
  app.head = new Head(fit, canvas);
  rig.add(app.head.group);
  app.props = new Props(app.head);
  app.ach.bump('face');
  app.painter = new Painter(app.head);
  app.bees.stop(true);
  app.emotions.stop();
  vomit.clear();
  steam.clear();
  st.sickAt = 0; st.sickWarned = false;
  st.dizzy = 0;
  st.caffeine = 0; st.crash = 0;
  st.projectiles.forEach((p) => p.sp.removeFromParent());
  st.projectiles = [];
  st.chew = 0; st.fire = 0; st.sour = 0;
  st.rage = 0; st.meltdown = false; st.popped = false; st.fried = false; st.yeet = null;
  st.scale.x = 0.01; st.scale.v = 0; st.scale.t = 1;
  $$('[data-prop], [data-toggle]').forEach((b) => b.classList.remove('on'));
  if (st.disco) app.toggleDisco();
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
    app.showBubble('That is not a face. That is not even an image.');
    return;
  }
  try {
    loadFace(await fileToCanvas(file));
  } catch (e) {
    console.error(e);
    app.showBubble('Your image broke my brain. Try a JPG or PNG.');
  }
}
// ---------- intro / upload ----------
const fileInput = $('#file');
$('#pickFile').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => { handleFile(fileInput.files[0]); fileInput.value = ''; });
$('#demo').addEventListener('click', () => loadFace(makeDemoFace(), { demo: true }));
$('#closeIntro').addEventListener('click', () => { if (app.head) $('#intro').classList.add('hidden'); });
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

// Other modules reach these through `app`.
Object.assign(app, { loadFace });
