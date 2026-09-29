// The voice box panel: voices, presets, say, and nonsense.
import * as samples from '../samples.js';
import * as sfx from '../audio.js';
import { voiceState, loadVoices, stopSpeaking } from '../voice.js';
import { nonsense } from '../lines.js';
import { $, $$, app, st } from './ctx.js';

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
  if (!app.head) return;
  app.sayUser($('#sayText').value);
});
$('#nonsense').addEventListener('click', () => {
  if (!app.head) return;
  const t = nonsense();
  $('#sayText').value = t;
  app.sayUser(t);
  // Pity laugh after the punchline: on the 1st joke, then every 10th (11th, 21st...).
  // Any more often and it stops being funny. (The speech engine does not report its end
  // reliably, so the timing is an estimate.)
  st.jokes = (st.jokes ?? 0) + 1;
  app.ach.bump('joke');
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
  if (app.head) app.sayUser(`Hello. I am ${v[i].name}. This is my voice now.`);
});
st.talkBack = $('#talkBack').checked;
sfx.setMuted($('#mute').checked);
$('#talkBack').addEventListener('change', (e) => { st.talkBack = e.target.checked; if (!st.talkBack) stopSpeaking(); });
$('#mute').addEventListener('change', (e) => sfx.setMuted(e.target.checked));
