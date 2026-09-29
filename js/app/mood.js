// The mood background: stage colors that follow what is happening.
import * as THREE from 'three';
import { $, app, st } from './ctx.js';
import { stage, vomit, nuke } from './stage.js';

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
  const emo = app.emotions.active?.kind;
  mix('bees', app.bees.active ? 0.55 : 0);
  mix('melt', app.head ? app.head.s.melt : 0);
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

// Other modules reach these through `app`.
Object.assign(app, { updateMood });
