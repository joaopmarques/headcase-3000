// Mic mimic, clip recording, and the clip screen.
import { Mimic } from '../mimic.js';
import { ClipRecorder } from '../recorder.js';
import * as sfx from '../audio.js';
import { voiceState, stopSpeaking } from '../voice.js';
import { line } from '../lines.js';
import { SITE_URL } from '../site.js';
import { $, now, app, st } from './ctx.js';
import { canvas, stage } from './stage.js';

const mimic = new Mimic();
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
      app.showBubble('I did not hear anything. Try again, louder.');
      return;
    }
    stopSpeaking();
    // Pitch slider picks the silliness: normal is chipmunk-ish, demon preset is slow and low.
    const p = voiceState.pitch;
    const rate = p <= 1 ? 0.55 + p * 0.9 : 1.45 + (p - 1) * 0.5;
    app.showBubble('🦜🦜🦜', buf.duration / rate * 1000 + 300);
    await mimic.play(rate);
    app.ach.unlock('copycat');
    st.userSpeaking = false;
    st.lastInteraction = now();
    return;
  }
  try {
    await mimic.start();
  } catch (e) {
    console.warn(e);
    app.showBubble('I need your microphone to copy you. Allow it and try again.', 3500);
    return;
  }
  st.userSpeaking = true;
  stopSpeaking();
  setMimicButton(true);
  sfx.micOn();
  app.showBubble(line('listen'), 10000);
}

// ---------- clip recording ----------
const recorder = new ClipRecorder(stage, canvas, app.bubble);
let clipUrl = null;
function toggleRec() {
  const btn = $('[data-action="rec"]');
  if (!ClipRecorder.supported()) { app.showBubble('This browser can not record clips. Try Chrome or Safari.'); return; }
  if (recorder.active) { recorder.stop(); return; }
  sfx.recBeep();
  btn.classList.add('on');
  const badge = $('#recBadge');
  badge.classList.remove('hidden');
  recorder.start(6, {
    onTick: (sec) => { badge.textContent = `● REC ${sec}s`; },
    onDone: (blob, ext) => {
      app.ach.unlock('director');
      app.ach.bump('clip');
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
  // Some share targets drop the text when a file comes with it, so the watermark carries the address too.
  share.onclick = () => navigator.share({
    files: [file],
    title: 'HEADCASE 4000',
    text: `Look what I did to this face. Do your own at ${SITE_URL}`,
  }).catch(() => {});
  $('#clip').classList.remove('hidden');
  $('#clipVideo').play().catch(() => {});
}
$('#clipClose').addEventListener('click', () => {
  $('#clip').classList.add('hidden');
  $('#clipVideo').pause();
});

// Other modules reach these through `app`.
Object.assign(app, { mimic, recorder, toggleMimic, toggleRec });
