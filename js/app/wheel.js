// The command wheel and tool bar: categories, pop-in stagger, and press squish.
import * as sfx from '../audio.js';
import { $, $$, app } from './ctx.js';

// ---------- command wheel ----------
const CAT_TITLES = {
  tools: 'TOOLS OF TORMENT', emotions: 'FEELINGS', chaos: 'CHAOS', food: 'SNACK BAR',
  drip: 'DRIP', voice: 'VOICE BOX', media: 'PHOTO & VIDEO', options: 'OPTIONS',
};
// The things that should pop in one by one. Wrappers (the snack tray, the voice form and
// its settings row) are walked into, so each snack, button, and slider animates on its own.
const STAGGER_WRAPPERS = '.tray, form, .voicebar, .presets, .opt-vols, .opt-fx';
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

// Other modules reach these through `app`.
Object.assign(app, { CAT_TITLES, setCategory });
