// Bees and emotions, wired to the app.
import { Bees } from '../bees.js';
import { Emotions } from '../emotions.js';
import * as samples from '../samples.js';
import * as sfx from '../audio.js';
import { line } from '../lines.js';
import { $, $$, now, app, st } from './ctx.js';
import { stage, camera, rig, fx, vomit } from './stage.js';

// ---------- bees + feelings ----------
const beeApp = {
  head: () => app.head, props: () => app.props, painter: () => app.painter, vomit: () => vomit, ach: () => app.ach, samples,
  rig, camera, stage, fx, sfx, st, line,
  grunt: (k) => app.grunt(k), react: (k, o) => app.react(k, o), addRage: (n) => app.addRage(n),
  showBubble: (t, ms) => app.showBubble(t, ms), talk: (t, o) => app.talk(t, o), hush: (ms) => app.hush(ms),
  onGone: () => $('[data-action="bees"]').classList.remove('on'),
};
const bees = new Bees(beeApp);
const emotions = new Emotions(beeApp);
$$('[data-emote]').forEach((b) => b.addEventListener('click', () => {
  sfx.unlock();
  if (!app.head || st.popped) return;
  st.lastInteraction = now();
  emotions.play(b.dataset.emote);
  if (b.dataset.emote === 'love' || b.dataset.emote === 'cry') samples.play('aww', { vol: 0.8, rate: b.dataset.emote === 'cry' ? 0.85 : 1 });
  app.ach.bumpSet('feels', b.dataset.emote);
}));
// Track the pointer anywhere on the page, for the eyes.
window.addEventListener('pointermove', (e) => { st.ptr = { x: e.clientX, y: e.clientY, t: now() }; });

// Other modules reach these through `app`.
Object.assign(app, { bees, emotions });
