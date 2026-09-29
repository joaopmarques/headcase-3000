// Snacks: eating, chewing, and what each food does.
import * as THREE from 'three';
import { setupFood } from '../food.js';
import * as sfx from '../audio.js';
import { line } from '../lines.js';
import { $, rnd, now, app, st } from './ctx.js';
import { stage, camera, rig, fx, vomit } from './stage.js';

// ---------- snacks ----------
function mouthWorld() {
  return app.props.anchorWorld('mouth', new THREE.Vector3());
}
function chew(seconds, then) {
  st.chew = seconds;
  st.chewThen = then;
}
// Six swallowed snacks fill the head up. Broccoli does not count: it gets spat out.
const BITES_TO_FULL = 6;
function isFull() { return app.head.s.fatTarget >= 0.99; }
function swallow() {
  app.ach.bump('snack');
  const s = app.head.s;
  sfx.gulp();
  s.fatTarget = Math.min(1, s.fatTarget + 1 / BITES_TO_FULL);
  st.rage = Math.max(0, st.rage - 12); // snacks calm the beast
  if (isFull()) {
    app.ach.unlock('glutton');
    app.react('full', { force: true });
    // Too much food. The body files a complaint in 5 to 7 seconds.
    if (!st.sickAt) st.sickAt = now() + rnd(5000, 7000);
    return true;
  }
  return false;
}
function eat(food) {
  if (!app.head || st.popped) return;
  st.lastInteraction = now();
  if (food.id !== 'broccoli' && isFull()) {
    sfx.spit();
    app.grunt('hmph');
    fx.burst(mouthWorld(), [food.emoji], 1, { speed: 6, gravity: -10, size: 0.5, dir: new THREE.Vector3(rnd(-0.5, 0.5), 0.6, 1) });
    app.react('full', { force: true });
    return;
  }
  sfx.gulp();
  app.ach.bumpSet('foods', food.id); // broccoli counts: it went in, even if it came back out
  if (food.id === 'broccoli') {
    chew(0.6, () => {
      sfx.spit();
      app.grunt('hmph');
      // A 3D spray of chewed broccoli, plus one intact floret for the drama.
      const dir = new THREE.Vector3(0, 0.25, 1).applyQuaternion(rig.quaternion);
      vomit.spit(mouthWorld(), dir, 16);
      fx.burst(mouthWorld(), ['🥦'], 1, { speed: 6, gravity: -10, size: 0.35, dir });
      app.react('broccoli', { force: true });
    });
    return;
  }
  if (food.id === 'chili') {
    chew(0.7, () => {
      st.fire = 2.2;
      app.ach.unlock('dragon');
      sfx.fireBreath(2);
      app.grunt('argh');
      if (!swallow()) app.react('chili', { force: true });
    });
    return;
  }
  if (food.id === 'espresso') {
    chew(0.5, () => {
      sfx.slurp();
      app.ach.unlock('wired');
      if (!swallow()) {
        const text = line('caffeine');
        app.showBubble(text, 2200);
        if (st.talkBack) app.talk(text, { rate: 2.6, pitch: 1.7 });
      }
      st.caffeine = 4.5;
      st.crash = 0;
      app.grunt('woo');
    });
    return;
  }
  if (food.id === 'lemon') {
    chew(0.4, () => {
      st.sour = 1.4;
      app.head.s.scaleY.x = 0.78;
      app.head.s.scaleY.v = 0;
      app.head.s.twist.kick(6);
      sfx.squeak(0.5);
      app.grunt('hmph');
      if (!swallow()) app.react('lemon', { force: true });
    });
    return;
  }
  chew(1.1, () => {
    if (food.id === 'donut') sfx.sparkle();
    if (!swallow()) app.react('yum', { force: true });
    if (Math.random() < 0.5) setTimeout(() => { sfx.burp(); app.showBubble('*BURP*', 1200); }, 900);
  });
}
setupFood($('#foodTray'), stage, {
  mouth() {
    if (!app.head || st.popped || !app.head.group.visible) return null;
    const p = mouthWorld().project(camera);
    return { x: (p.x * 0.5 + 0.5) * stage.clientWidth, y: (-p.y * 0.5 + 0.5) * stage.clientHeight };
  },
  onNear(near) {
    st.mouthOpen = near;
    if (near && app.head) { app.grunt('ooh'); app.react('foodNear'); }
  },
  onEat: eat,
  onMiss(food, x, y) {
    if (!app.head) return;
    const hit = app.hitTest({ clientX: x, clientY: y });
    if (hit) {
      app.head.poke(hit.vi, 0.15);
      sfx.boing(1.4);
      app.react('forehead', { force: true });
    } else sfx.thud();
  },
});

// Other modules reach these through `app`.
Object.assign(app, { mouthWorld });
