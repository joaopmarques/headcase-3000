// Styled tooltips for the command wheel and the trophy button. They replace the browser's
// plain `title` tips: each button's title moves to data-tip (and to aria-label, for screen readers).
import { $, $$ } from './ctx.js';

const tip = document.createElement('div');
tip.id = 'tip';
tip.setAttribute('role', 'tooltip');
document.body.appendChild(tip);

const EDGE = 8; // keep this far from the screen edges
const GAP = 10; // space between the button and the tip
let current = null;

function show(btn) {
  current = btn;
  tip.textContent = btn.dataset.tip;
  tip.classList.remove('show', 'below');
  const b = btn.getBoundingClientRect();
  const w = tip.offsetWidth, h = tip.offsetHeight;
  // Above the button, unless that runs into the ticker. Then below it.
  const below = b.top - GAP - h < 36;
  const top = below ? b.bottom + GAP : b.top - GAP - h;
  const cx = b.left + b.width / 2;
  const left = Math.min(Math.max(cx - w / 2, EDGE), innerWidth - EDGE - w);
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
  // The arrow still points at the button when the tip is pushed in from an edge.
  tip.style.setProperty('--ax', `${Math.min(Math.max(cx - left, 12), w - 12)}px`);
  tip.classList.toggle('below', below);
  void tip.offsetWidth;
  tip.classList.add('show');
}
function hide(btn) {
  if (btn && btn !== current) return;
  current = null;
  tip.classList.remove('show');
}

for (const btn of $$('#wheel button, #trophyBtn')) {
  if (!btn.title) continue;
  btn.dataset.tip = btn.title;
  if (!btn.hasAttribute('aria-label')) btn.setAttribute('aria-label', btn.title);
  btn.removeAttribute('title');
  // Mouse only: on touch, a tap is a press, not a hover.
  btn.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') show(btn); });
  btn.addEventListener('pointerleave', () => hide(btn));
  btn.addEventListener('pointerdown', () => hide(btn));
  btn.addEventListener('focus', () => { if (btn.matches(':focus-visible')) show(btn); });
  btn.addEventListener('blur', () => hide(btn));
}
addEventListener('scroll', () => hide(), true);
addEventListener('resize', () => hide());
