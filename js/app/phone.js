// Phone-only sizing that CSS cannot do alone: the logo fills the top row, and the tool bar
// items leave the next column peeking in. On desktop both are cleared, so the CSS rules.
import { $ } from './ctx.js';

const phone = matchMedia('(max-width: 700px)');

// ---------- logo: fill the room left of the trophy button ----------
const LOGO_W = 300; // the banner's width in style.css, before it is scaled
const LOGO_GAP = 10; // space between the banner and the trophy
const LOGO_MAX = 320; // widest the banner gets, on big phones
function fitLogo() {
  const logo = $('.logo');
  if (!phone.matches) { logo.style.removeProperty('scale'); return; }
  const left = parseFloat(getComputedStyle(logo).left);
  const trophyLeft = $('#trophyBtn').getBoundingClientRect().left;
  const k = Math.min(trophyLeft - LOGO_GAP - left, LOGO_MAX) / LOGO_W;
  // Half-built layout (styles still loading) gives nonsense. Keep the CSS value then.
  if (!(k > 0.5 && k < 1.5)) return;
  logo.style.scale = k.toFixed(3);
}

// ---------- tool bar: let the next column peek in ----------
const PEEK = 0.4; // how much of the next column shows
function bestWidth(room, gap, target, max) {
  let best = null;
  // Keep adding columns until the items get too small. There is always an answer.
  for (let n = 1; n <= 40; n++) {
    const w = (room - n * gap) / (n + PEEK);
    if (w > max) continue;
    if (best === null || Math.abs(w - target) < Math.abs(best - target)) best = w;
    if (w < target) break;
  }
  return Math.max(40, best ?? target);
}
function fitPeek() {
  const body = $('#toolbar .tb-body');
  if (!phone.matches) {
    body.style.removeProperty('--item-w');
    body.style.removeProperty('--food-w');
    return;
  }
  // The layout can be half-built on the first call (styles still loading). Skip that call.
  // The resize observer and the load event call this again.
  if (!body.clientWidth || body.clientWidth > 700) return;
  const css = getComputedStyle(body);
  // The bar clips at its edge, not at its padding, so the right padding counts as room.
  const room = body.clientWidth - parseFloat(css.paddingLeft);
  if (room <= 0) return;
  const gap = parseFloat(getComputedStyle($('#foodTray')).columnGap) || 8;
  body.style.setProperty('--item-w', `${bestWidth(room, gap, 70, 80).toFixed(1)}px`);
  body.style.setProperty('--food-w', `${bestWidth(room, gap, 60, 68).toFixed(1)}px`);
}

function fitPhone() {
  fitLogo();
  fitPeek();
}
new ResizeObserver(fitPhone).observe($('#toolbar .tb-body'));
phone.addEventListener('change', fitPhone);
addEventListener('resize', fitPhone);
addEventListener('load', fitPhone);
fitPhone();
