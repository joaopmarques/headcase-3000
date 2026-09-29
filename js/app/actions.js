// Chaos actions, the pump, disco, clones, yeet, the nuke, props, and the chaos button.
import * as THREE from 'three';
import { AMMO_ORDER } from '../paint.js';
import * as samples from '../samples.js';
import * as sfx from '../audio.js';
import { line, nextLie, pick } from '../lines.js';
import { $, $$, rnd, now, app, st } from './ctx.js';
import { stage, scene, camera, discoLights, fx, vomit, steam, nuke } from './stage.js';

// ---------- actions ----------
// Spin it about six times in a row and it gets sick.
const SPINS_TO_SICK = 6;
const DIZZY_WINDOW = 4000; // ms between spins that still count as "in a row"
function spunSick() {
  st.dizzy = 0;
  app.ach.unlock('motionsick');
  fx.dizzy(app.head.group, 1.75, 3);
  app.grunt('uhoh');
  app.showBubble('I am going to be sick…', 1200);
  // Let the spin wind down first, then it all comes out.
  setTimeout(() => {
    if (!app.head || st.yeet || st.popped) return;
    if (app.emotions.active?.kind !== 'sick') app.emotions.play('sick');
  }, 900);
}

function popHead() {
  st.popped = true;
  st.sickAt = 0; // exploding already emptied the stomach
  st.sickWarned = false;
  app.ach.bump('pop');
  sfx.pop();
  app.grunt('yelp');
  const p = app.head.group.getWorldPosition(new THREE.Vector3());
  fx.burst(p, ['🎉', '🎊', '✨', '🧠', '👁️', '🦷', '💥', '👃'], 70, { speed: 8, size: 0.5, life: 2.2, gravity: -7 });
  app.head.group.visible = false;
  app.showBubble('POP!', 1500);
  setTimeout(() => {
    if (!app.head) return;
    app.head.reset();
    st.scale.x = 0.01; st.scale.v = 0;
    app.head.group.visible = true;
    st.popped = false;
    sfx.boing(1.3);
    app.react('pop', { force: true });
  }, 1800);
}

function pumpOnce() {
  if (!app.head || st.popped) return;
  const s = app.head.s.inflate;
  s.t = Math.min(1.05, s.t + 0.07);
  s.kick(0.8);
  sfx.squeak(0.7 + s.t);
  if (s.t > 0.5 && Math.random() < 0.35) app.grunt(s.t > 0.8 ? 'uhoh' : 'ooh');
  st.lastPump = now();
  if (s.t >= 1.0) { stopPump(); popHead(); return; }
  if (Math.random() < 0.25) app.react('inflate');
}
function startPump() { stopPump(); pumpOnce(); app.pumpTimer = setInterval(pumpOnce, 200); }
function stopPump() { clearInterval(app.pumpTimer); app.pumpTimer = null; }

const DISCO_BPM = 120; // measured from the song
function discoBeat() {
  if (!app.head) return;
  st.pos.y.v = 2.2;
  app.head.s.jaw.kick(5);
  app.head.s.brow.kick(6);
  st.rot.z.kick(rnd(-3, 3));
}
function toggleDisco() {
  st.disco = !st.disco;
  document.body.classList.toggle('disco', st.disco);
  $('[data-action="disco"]').classList.toggle('on', st.disco);
  if (st.disco) {
    app.ach.unlock('nightfever');
    // The synth beat plays right away; the real song takes over once it has loaded.
    sfx.startDisco(discoBeat);
    const token = (st.discoToken = (st.discoToken ?? 0) + 1);
    samples.loadOne('disco').then((buf) => {
      if (!buf || !st.disco || token !== st.discoToken) return;
      sfx.stopDisco();
      st.discoSong = samples.loop('disco', { vol: 0.85, bus: 'music' });
      st.discoBeatN = -1;
    });
    app.react('disco', { force: true });
  } else {
    sfx.stopDisco();
    st.discoSong?.stop();
    st.discoSong = null;
    discoLights.forEach((l) => (l.intensity = 0));
    if (app.head) app.head.uniforms.uHue.value = 0;
  }
}

function clearClones() {
  for (const c of st.clones) c.removeFromParent();
  st.clones = [];
}
function toggleClones() {
  const btn = $('[data-action="clones"]');
  if (st.clones.length) { clearClones(); btn.classList.remove('on'); return; }
  if (!app.head) return;
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(app.head.geo, app.head.mat);
    m.userData = { a: (i / 10) * Math.PI * 2, ph: Math.random() * 6 };
    m.scale.setScalar(0.42);
    scene.add(m);
    st.clones.push(m);
  }
  btn.classList.add('on');
  app.ach.unlock('legion');
  sfx.sparkle();
  app.showBubble('We are legion.');
  app.talk('We are legion.', { pitch: 0.6 });
}

function yeet(self = false) {
  if (st.yeet || !app.head || st.popped) return;
  st.yeet = { t: 0, dir: Math.random() < 0.5 ? -1 : 1, self };
  sfx.whoosh(0.9);
  samples.play('slide', { rate: 1.3, vol: 0.8 });
  app.grunt(self ? 'argh' : 'woo');
  if (!self) { app.react('yeet', { force: true }); app.ach.unlock('yeet'); }
}

function meltdown() {
  st.meltdown = true;
  app.ach.unlock('meltdown');
  sfx.scream();
  app.grunt('argh');
  const text = line('rage');
  app.showBubble(text, 1500);
  app.talk(text, { pitch: 0.2, rate: 1.4 });
  // Wind-up: it swells and turns red while the red/black strobe runs. Then: KABOOM.
  if (app.head) app.head.s.inflate.t = 0.55;
  setTimeout(detonate, 1500);
}

function detonate() {
  if (!app.head || st.nuked) return;
  st.nuked = true;
  st.popped = true; // reuses every "head is gone" guard
  stopPump();
  app.emotions.stop();
  const p = app.head.group.getWorldPosition(new THREE.Vector3());
  app.head.group.visible = false;
  nuke.detonate(p);
  app.ach.bump('nuke');
  if (!samples.play('nuke', { vol: 1 })) sfx.pop();
  sfx.nukeRumble();
  fx.burst(p, ['🧠', '👁️', '🦷', '👃', '☢️'], 30, { speed: 9, size: 0.42, life: 2.2, gravity: -7 });
  const f = document.createElement('div');
  f.className = 'flash nuke-flash';
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 1600);
  app.showBubble('☢ KABOOM ☢', 2000);
  // Regrow once the cloud has mostly cleared.
  setTimeout(() => {
    if (!app.head) return;
    st.nuked = false;
    st.popped = false;
    st.meltdown = false;
    st.rage = 0;
    app.head.reset();
    st.scale.x = 0.01; st.scale.v = 0;
    app.head.group.visible = true;
    if (!samples.play('boing', { rate: 0.8 })) sfx.boing(1.1);
    app.showBubble('…okay. I feel better now.', 2600);
    app.talk('Okay. I feel better now.');
  }, 5600);
}

function deepFry() {
  if (!app.head) return;
  st.fried = !st.fried;
  $('[data-action="fry"]').classList.toggle('on', st.fried);
  if (!st.fried) { app.head.setFilter(null); return; }
  app.ach.unlock('crispy');
  app.head.setFilter('saturate(5) contrast(2.2) brightness(1.15)', (ctx, fit) => {
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
  app.showBubble('Deep fried. 🔥');
}

function resetAll() {
  if (!app.head) return;
  app.head.reset();
  for (const k of Object.keys(app.props.on)) app.props.toggle(k, false);
  app.head.s.tongue.t = 0;
  if (st.disco) toggleDisco();
  clearClones();
  if (st.fried) deepFry();
  fx.clearOrbits();
  st.rage = 0; st.meltdown = false;
  st.chew = 0; st.fire = 0; st.sour = 0;
  if (app.painter) app.painter.drips = [];
  app.bees.stop(true);
  app.emotions.stop();
  vomit.clear();
  steam.clear();
  st.sickAt = 0; st.sickWarned = false;
  st.dizzy = 0;
  if (st.crash > 0 || st.caffeine > 0) app.head.forceBlink = 0;
  st.caffeine = 0; st.crash = 0;
  $$('[data-prop], [data-action]:not([data-action="rec"]):not([data-action="mimic"])').forEach((b) => b.classList.remove('on'));
  app.head.look.set(0, 0);
  if (!samples.play('scratch', { vol: 0.9 })) sfx.ding();
  app.showBubble('Good as new. Mostly.');
}
// ---------- chaos button: five random things in a row ----------
// A random spot on the face, dressed up like a pointer hit, so the tool functions work as usual.
function randomFaceHit() {
  let vi = 0;
  for (let k = 0; k < 40; k++) {
    vi = Math.floor(Math.random() * app.head.n);
    if (app.head.base[vi * 3 + 2] > 0.45) break;
  }
  const local = app.head.vertexPos(vi, new THREE.Vector3());
  const point = app.head.mesh.localToWorld(local.clone());
  const uv1 = new THREE.Vector2().fromBufferAttribute(app.head.geo.attributes.uv1, vi);
  const p = point.clone().project(camera);
  const r = stage.getBoundingClientRect();
  const evt = { clientX: r.left + (p.x * 0.5 + 0.5) * r.width, clientY: r.top + (-p.y * 0.5 + 0.5) * r.height };
  return { hit: { point, local, vi, uv1 }, evt };
}
const CHAOS_STEPS = [
  ['POKE', () => { const { hit, evt } = randomFaceHit(); app.doPoke(hit, evt); }],
  ['SLAP', () => { const { hit, evt } = randomFaceHit(); app.doSlap(Math.random() < 0.5 ? -1 : 1, hit, evt); }],
  ['BONK', () => { const { hit, evt } = randomFaceHit(); app.doBonk(hit, evt); }],
  ['PIE', () => { const { evt } = randomFaceHit(); const keep = st.ammo; st.ammo = pick(AMMO_ORDER); app.throwAt(evt); st.ammo = keep; }],
  ['TWIST', () => ACTIONS.twist()],
  ['SPIN', () => ACTIONS.spin()],
  ['NOODLE', () => ACTIONS.noodle()],
  ['LIE', () => ACTIONS.lie()],
  ['SNEEZE', () => app.emotions.play('sneeze')],
  ['WINK', () => app.emotions.play('wink')],
  ['SCREAM', () => app.emotions.play('scream')],
  ['LOVE', () => app.emotions.play('love')],
  ['PUMP', () => { for (let i = 0; i < 3; i++) setTimeout(pumpOnce, i * 150); }],
];
function runChaos() {
  if (st.chaosRunning || st.popped) return;
  st.chaosRunning = true;
  app.ach.unlock('agentofchaos');
  app.ach.bump('chaos');
  const btn = $('[data-action="chaos"]');
  btn.classList.add('on');
  const hint = $('#hint');
  const oldHint = hint.textContent;
  const steps = [...CHAOS_STEPS].sort(() => Math.random() - 0.5).slice(0, 5);
  if (!samples.play('airhorn', { vol: 0.8 })) sfx.slideWhistle(true);
  app.react('chaos', { force: true });
  steps.forEach(([name, fn], i) => {
    setTimeout(() => {
      if (!app.head || st.popped) return;
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
    const on = (app.head.s.meltTarget = app.head.s.meltTarget ? 0 : 1);
    if (on) app.ach.unlock('puddle');
    $('[data-action="melt"]').classList.toggle('on', !!on);
    if (on) {
      sfx.sizzle(2);
      app.grunt('uhoh');
      fx.burst(new THREE.Vector3(0, 1, 0.5), ['💦', '🔥', '🫠'], 10, { speed: 2, size: 0.3 });
      app.react('melt', { force: true });
    } else {
      sfx.slideWhistle(true);
      app.showBubble('Solid again!');
    }
  },
  twist() {
    app.head.s.twist.kick((Math.random() < 0.5 ? -1 : 1) * 14);
    sfx.creak(); sfx.whoosh(0.5);
    app.grunt('woo');
    app.react('twist', { force: true });
  },
  noodle() {
    app.head.s.scaleY.t = 2.1;
    sfx.slideWhistle(true);
    app.grunt('woo');
    app.react('noodle', { force: true });
    setTimeout(() => { if (app.head) { app.head.s.scaleY.t = 1; if (!samples.play('slide')) sfx.slideWhistle(false); } }, 1700);
  },
  lie() {
    app.ach.bump('lie');
    const s = app.head.s.nose;
    s.t = Math.min(2.4, s.t + 0.45);
    s.kick(3);
    sfx.creak();
    const p = app.props.anchorWorld('nose', new THREE.Vector3());
    fx.burst(p, ['🤥', '🌳', '🪵'], 4, { speed: 1.5, size: 0.3 });
    app.sayUser(nextLie());
  },
  blep() {
    const on = app.props.toggle('tongue');
    app.head.s.tongue.t = on ? 1 : 0;
    $('[data-action="blep"]').classList.toggle('on', on);
    sfx.squeak(on ? 0.6 : 1.4);
    if (on) app.react('blep', { force: true });
  },
  disco: toggleDisco,
  clones: toggleClones,
  yeet: () => yeet(false),
  spin() {
    st.rot.y.kick((Math.random() < 0.5 ? -1 : 1) * 45);
    sfx.whoosh(0.7);
    // Spins close together add up. A pause lets the head get its balance back.
    const t = now();
    st.dizzy = t - st.lastSpin < DIZZY_WINDOW ? st.dizzy + 1 : 1;
    st.lastSpin = t;
    if (st.dizzy >= SPINS_TO_SICK) { spunSick(); return; }
    if (st.dizzy === SPINS_TO_SICK - 2) {
      // Fair warning: stars, a wobble, and a plea.
      fx.dizzy(app.head.group, 1.75, 2.2);
      app.grunt('uhoh');
      app.showBubble('Whoa… the room is spinning.', 1400);
      return;
    }
    app.grunt('woo');
    app.react('spin', { force: true });
  },
  fry: deepFry,
  chaos: runChaos,
  bees() {
    const btn = $('[data-action="bees"]');
    if (app.bees.active) { app.bees.stop(true); btn.classList.remove('on'); sfx.whoosh(0.4); return; }
    app.bees.start(7);
    btn.classList.add('on');
    app.grunt('uhoh');
    app.react('bees', { force: true });
  },
  mimic: app.toggleMimic,
  rec: app.toggleRec,
  snap() { st.snapRequest = true; },
  reset: resetAll,
  // Opened from the game, the face picker can be closed again (there is a head to go back to).
  newface() { $('#intro').classList.add('closable'); $('#intro').classList.remove('hidden'); },
};
$$('[data-action]').forEach((b) => {
  const a = b.dataset.action;
  if (a === 'pump') {
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); sfx.unlock(); if (app.head) startPump(); });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, stopPump);
    return;
  }
  b.addEventListener('click', () => { sfx.unlock(); if (app.head || a === 'newface') ACTIONS[a](); });
});

const PROP_SFX = {
  googly: () => { sfx.squeak(1.3); app.showBubble('I can see everything now.'); },
  hat: () => { sfx.sparkle(); app.showBubble('It is my birthday? It is my birthday!'); },
  stache: () => { sfx.ding(); app.showBubble('Magnificent.'); },
  shades: () => { sfx.whoosh(0.4); setTimeout(() => { sfx.ding(); app.showBubble('Deal with it.'); }, 650); },
  clown: () => { sfx.honk(); app.showBubble('Honk honk.'); },
};
$$('[data-prop]').forEach((b) => b.addEventListener('click', () => {
  if (!app.head) return;
  sfx.unlock();
  const on = app.props.toggle(b.dataset.prop);
  if (Object.values(app.props.on).filter(Boolean).length >= 5 && ['googly', 'hat', 'stache', 'shades', 'clown'].every((k) => app.props.on[k])) app.ach.unlock('driplord');
  b.classList.toggle('on', on);
  if (on) PROP_SFX[b.dataset.prop]?.();
  else sfx.squeak(0.7);
}));

// Other modules reach these through `app`.
Object.assign(app, { ACTIONS, DISCO_BPM, clearClones, discoBeat, meltdown, toggleDisco });
