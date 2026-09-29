// Achievement toasts, the Trophy Case, hold-to-reset, and the credit photo.
import { Achievements, ACHIEVEMENTS } from '../achievements.js';
import * as sfx from '../audio.js';
import * as samples from '../samples.js';
import { pick } from '../lines.js';
import { $, $$, rnd, now, app } from './ctx.js';

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
  el.innerHTML = '<div class="bread"></div><div class="label"><span class="medal"></span><small>ACHIEVEMENT TOASTED</small><strong></strong></div>';
  el.querySelector('.medal').textContent = a.emoji;
  el.querySelector('strong').textContent = a.name;
  $('#toasts').appendChild(el);
  // After the pop-up and hover, the toast flies into the trophy button.
  el.addEventListener('animationend', () => flyToTrophy(el, spin, a), { once: true });
  setTimeout(() => el.isConnected && flyToTrophy(el, spin, a), 4500); // backup if animationend never fires
  sfx.toasterPop(); // the counter ticks up when the toast lands (flyToTrophy)
  if (a.id === 'completionist') samples.loadOne('fanfare'); // ready by the time the toast lands
  if (!$('#achScreen').classList.contains('hidden')) renderAchievements();
}
const ach = new Achievements({ onUnlock: toast });
// Shrink and fly the toast into the trophy button (ease-out), then pop the button.
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
function flyToTrophy(el, spin, a) {
  if (el.dataset.flying) return;
  el.dataset.flying = '1';
  const from = getComputedStyle(el).transform; // where the pop-up animation left it
  const t = el.getBoundingClientRect();
  const b = $('#trophyBtn').getBoundingClientRect();
  // On phones the toast has `scale: 0.75`, which also shrinks any move in `transform`. Undo it.
  const k = parseFloat(getComputedStyle(el).scale) || 1;
  const dx = (b.left + b.width / 2 - (t.left + t.width / 2)) / k;
  const dy = (b.top + b.height / 2 - (t.top + t.height / 2)) / k;
  const start = from === 'none' ? '' : from;
  const fly = el.animate([
    { transform: `translate(0px, 0px) ${start} rotate(0deg) scale(1)` },
    { transform: `translate(${dx}px, ${dy}px) ${start} rotate(${spin * 200}deg) scale(0.08)` },
  ], { duration: reduceMotion.matches ? 1 : 750, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' });
  fly.onfinish = () => {
    el.remove();
    updateTrophy(true);
    sfx.pop();
    if (a?.id === 'completionist') celebrate();
  };
}

// ---------- completionist: the big fanfare, then a thank-you note ----------
const CONFETTI = ['#ff3ea5', '#00e5ff', '#b6ff00', '#ffe600', '#7a2cff', '#ff7a00', '#fff'];
function celebrate() {
  // The trumpet fanfare (CC0, see sfx/CREDITS.md). If it fails to load, the regular unlock jingle plays.
  // The show does not wait for it: the sound was preloaded when the achievement unlocked.
  samples.loadOne('fanfare').then((buf) => (buf ? samples.play('fanfare', { vol: 0.9 }) : sfx.fanfare()));
  app.grunt?.('woo');
  app.showBubble?.('WE DID IT!', 2600);
  if (!reduceMotion.matches) {
    // Spotlights sweep the stage and the screen flashes.
    const lights = document.createElement('div');
    lights.id = 'spotlights';
    document.body.appendChild(lights); // stays on until LET'S GO
    // Confetti rains from the top.
    const box = document.createElement('div');
    box.id = 'confetti';
    for (let i = 0; i < 140; i++) {
      const c = document.createElement('i');
      c.style.left = `${rnd(0, 100)}vw`;
      c.style.background = CONFETTI[i % CONFETTI.length];
      c.style.setProperty('--d', `${rnd(0, 1.4).toFixed(2)}s`);
      c.style.setProperty('--t', `${rnd(2.4, 4).toFixed(2)}s`);
      c.style.setProperty('--x', `${rnd(-80, 80).toFixed(0)}px`);
      c.style.setProperty('--r', `${rnd(360, 1080).toFixed(0)}deg`);
      if (i % 3 === 0) c.style.borderRadius = '50%';
      box.appendChild(c);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 6000);
  }
  // Once the confetti settles, the note from the creator. The lights keep going behind it.
  setTimeout(() => {
    const screen = $('#thanksScreen');
    const lights = $('#spotlights');
    if (lights) screen.prepend(lights);
    screen.classList.remove('hidden');
  }, reduceMotion.matches ? 1500 : 3800);
}
$('#thanksGo').addEventListener('click', () => {
  sfx.boing(1.3);
  $('#thanksScreen').classList.add('hidden');
  const lights = $('#spotlights');
  if (lights) {
    lights.classList.add('out');
    setTimeout(() => lights.remove(), 400);
  }
});
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
// ---------- stats ----------
// [counter, emoji, label]. Counters are kept by the achievements module (same storage).
const STATS = [
  ['poke', '👉', 'pokes'], ['slap', '🖐️', 'slaps'], ['bonk', '🔨', 'bonks'], ['giggle', '🪶', 'giggles'],
  ['throw', '🥧', 'things thrown'], ['splat', '🎯', 'direct hits'], ['stroke', '🖍️', 'sharpie strokes'],
  ['snack', '🍔', 'snacks eaten'], ['puke', '🤮', 'times it threw up'], ['pop', '🎈', 'heads popped'],
  ['nuke', '☢️', 'nuclear meltdowns'], ['lie', '🤥', 'lies told'], ['joke', '🎲', 'nonsense jokes'],
  ['swat', '🐝', 'bees swatted'], ['sting', '💢', 'bee stings taken'], ['chaos', '🌀', 'chaos button presses'],
  ['clip', '🎬', 'clips recorded'], ['face', '🙂', 'faces loaded'],
];
// The tools that count toward "favorite torture".
const TORTURES = { poke: 'poking', slap: 'slapping', bonk: 'bonking', giggle: 'tickling', throw: 'throwing food', stroke: 'doodling' };
function fmtTime(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}h ${m}m` : m ? `${m}m ${s}s` : `${s}s`;
}
function renderStats() {
  const c = ach.counters;
  const n = (k) => Math.floor(c[k] ?? 0);
  const abuse = ['poke', 'slap', 'bonk', 'throw', 'stroke', 'nuke', 'pop'].reduce((a, k) => a + n(k), 0);
  const fav = Object.entries(TORTURES).sort((a, b) => n(b[0]) - n(a[0]))[0];
  // Hits were counted before throws were, so older progress can have more hits than throws.
  const accuracy = n('throw') && n('throw') >= n('splat') ? Math.round((100 * n('splat')) / n('throw')) : null;
  $('#statsLede').textContent = abuse
    ? `Favorite torture: ${n(fav[0]) ? fav[1] : 'none yet'}.${accuracy !== null ? ` Throwing accuracy: ${accuracy}%.` : ''}`
    : 'No crimes on record yet. Go poke something.';
  const grid = $('#statsGrid');
  grid.innerHTML = '';
  const card = (emoji, value, label, big = false) => {
    const el = document.createElement('div');
    el.className = `stat${big ? ' big' : ''}`;
    el.innerHTML = '<span class="ico"></span><div><b></b><small></small></div>';
    el.querySelector('.ico').textContent = emoji;
    el.querySelector('b').textContent = value;
    el.querySelector('small').textContent = label;
    grid.appendChild(el);
  };
  card('💀', abuse.toLocaleString(), 'total acts of abuse', true);
  card('⏱️', fmtTime(n('playSec')), 'spent ruining faces', true);
  for (const [k, emoji, label] of STATS) card(emoji, n(k).toLocaleString(), label);
}
function showAchTab(tab) {
  $$('[data-achtab]').forEach((b) => b.classList.toggle('on', b.dataset.achtab === tab));
  $$('[data-achpanel]').forEach((p) => { p.hidden = p.dataset.achpanel !== tab; });
  if (tab === 'stats') renderStats();
  else renderAchievements();
}
$$('[data-achtab]').forEach((b) => b.addEventListener('click', () => { sfx.squeak(1.2); showAchTab(b.dataset.achtab); }));

$('#trophyBtn').addEventListener('click', () => {
  sfx.unlock();
  sfx.ding();
  showAchTab('trophies');
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
    ach.reset(); // trophies and stats share storage, so both start over
    updateTrophy();
    showAchTab($('[data-achtab].on')?.dataset.achtab || 'trophies');
    app.showBubble('All trophies gone. Like my body.', 2200);
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
  // Visiting the creator's site (it opens in a new tab) earns a little respect. Middle-clicks count too.
  const site = credit.querySelector('a');
  const kiss = () => ach.unlock('kissthering');
  site.addEventListener('click', kiss);
  site.addEventListener('auxclick', (e) => { if (e.button === 1) kiss(); });
}

// Other modules reach these through `app`.
Object.assign(app, { ach, renderStats, celebrate });
