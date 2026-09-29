// The top ticker: slogans and breaking non-news, shuffled on every visit.
// The static text in index.html stays as the fallback if this never runs.
import { $ } from './ctx.js';

const SLOGANS = [
  'UPLOAD YOUR FACE', 'RUIN YOUR FACE', 'REPEAT', 'NO REFUNDS', '9 OUT OF 10 HEADS AGREE',
  'NOT A DOCTOR', 'NOW WITH 40% MORE NOSE', '100% REAL 3D (KINDA)',
];
const HEADLINES = [
  'LOCAL HEAD STILL LOOKING FOR BODY, "OPEN TO LEADS"',
  'SCIENTISTS CONFIRM NOSE IS "MOSTLY NOSE"',
  'MAN POKED 400 TIMES DESCRIBES EXPERIENCE AS "A LOT"',
  'EXPERTS WARN OF GLOBAL PARTY HAT SHORTAGE',
  'PIE INDUSTRY REPORTS RECORD QUARTER, THANKS FACES',
  'AREA BEE UNIONIZES',
  'FOREHEAD DECLARES INDEPENDENCE FROM EYEBROWS',
  'STUDY: 7 IN 10 HEADS WOULD RATHER BE A HAT',
  'DISCO BALL SPOTTED ROTATING. NO FURTHER DETAILS AT THIS TIME',
  'WEATHER: 80% CHANCE OF PIE, CLEARING BY EVENING',
  'BROCCOLI RESPONDS TO CRITICS: "I AM TRYING MY BEST"',
  'MYSTERY FINGER STILL AT LARGE',
  'HEAD SPINS SIX TIMES, IMMEDIATELY REGRETS IT',
  'ESPRESSO LINKED TO "SEEING SOUNDS"',
  'THERMOMETER CALLS 100% RAGE "A NEW PERSONAL BEST"',
  'AUTHORITIES ADVISE CITIZENS NOT TO LOOK DIRECTLY AT THE NOSE',
  'CLONES DENY BEING CLONES',
  'LOCAL SPONGE UNDOES ALL DAMAGE, ASKS FOR NOTHING IN RETURN',
  'DAVE STILL CONSENTING, SOURCES SAY',
  '"IT IS JUST A PHASE," SAYS MELTED HEAD',
  'GRAVITY REMAINS UNDEFEATED',
  'NEARBY TOMATO "HAD IT COMING," SAYS WITNESS',
  'MAN WHO READ THE TERMS AND CONDITIONS STILL MISSING',
  'EYEBROW REACHES NEW HEIGHTS, REFUSES TO COME DOWN',
  'HEAD FILES NOISE COMPLAINT AGAINST OWN SNEEZE',
  'MOUSTACHE CLAIMS IT WAS "ALWAYS THERE"',
  'NOTHING HAPPENED TODAY. EXPERTS CAUTIOUSLY OPTIMISTIC',
  'SHARPIE UNIBROW APPRAISED AT "PRICELESS, UNFORTUNATELY"',
  'AREA HEAD ACHIEVES INNER PEACE FOR 4 SECONDS',
  'NATION\'S BUBBLES REPORT TEXT "MOSTLY YELLING"',
  'STEAM FROM EARS NOW A RENEWABLE ENERGY SOURCE',
  'LAST REMAINING CHEEK STRETCHED "WELL PAST FACTORY LIMITS"',
];

const PX_PER_SEC = 70; // scroll speed, whatever the length

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function build() {
  const track = $('.ticker div');
  if (!track) return;
  // A slogan after every third headline, so the brand keeps butting in.
  const slogans = shuffle(SLOGANS);
  const items = [];
  shuffle(HEADLINES).forEach((h, i) => {
    items.push(h);
    if (i % 3 === 2) items.push(slogans[Math.floor(i / 3) % slogans.length]);
  });
  const run = `★ ${items.join(' ★ ')} ★ `;
  // Two copies side by side: the scroll moves by exactly one copy, so the loop has no seam.
  track.textContent = run + run;
  const setSpeed = () => {
    const half = track.scrollWidth / 2;
    if (half > 0) track.style.animationDuration = `${Math.round(half / PX_PER_SEC)}s`;
  };
  setSpeed();
  document.fonts?.ready.then(setSpeed).catch(() => {}); // the ticker font changes the width
}

try { build(); } catch (e) { console.warn('ticker', e); } // a broken ticker must never break the app
