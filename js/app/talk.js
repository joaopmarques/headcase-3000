// Speech bubble, rage-o-meter, and how the head talks and reacts.
import * as sfx from '../audio.js';
import { voiceState, speak } from '../voice.js';
import { line } from '../lines.js';
import { $, now, app, st } from './ctx.js';
import { stage } from './stage.js';

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
  if (st.rage >= 100 && !st.meltdown) app.meltdown();
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

// Other modules reach these through `app`.
Object.assign(app, { addRage, bubble, grunt, react, sayUser, showBubble, stamp, talk, updateRageUI });
