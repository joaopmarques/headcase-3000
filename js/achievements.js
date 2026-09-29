// Achievements. Counters and unlocks live in this browser (localStorage), nowhere else.
const KEY = 'headcase.achievements.v1';

// counter + need: unlocks when the counter reaches need. No counter: unlocked directly by id.
export const ACHIEVEMENTS = [
  { id: 'boop', emoji: '👉', name: 'Boop', desc: 'Poke the head.', counter: 'poke', need: 1 },
  { id: 'relentless', emoji: '🫵', name: 'Relentless', desc: 'Poke it 50 times.', counter: 'poke', need: 50 },
  { id: 'dignity', emoji: '🖐️', name: 'Right in the Dignity', desc: 'Slap it.', counter: 'slap', need: 1 },
  { id: 'whack', emoji: '🔨', name: 'Whack-a-Head', desc: 'Bonk it 10 times.', counter: 'bonk', need: 10 },
  { id: 'giggles', emoji: '🪶', name: 'Giggle Fit', desc: 'Make it giggle 20 times.', counter: 'giggle', need: 20 },
  { id: 'taffy', emoji: '🤏', name: 'Taffy Face', desc: 'Stretch a cheek until it almost rips.' },
  { id: 'kaboom', emoji: '🎈', name: 'Kaboom', desc: 'Pump the head until it pops.', counter: 'pop', need: 1 },
  { id: 'serialpopper', emoji: '💥', name: 'Serial Popper', desc: 'Pop it 5 times.', counter: 'pop', need: 5 },
  { id: 'pinocchio', emoji: '🤥', name: 'Pinocchio', desc: 'Tell 5 lies.', counter: 'lie', need: 5 },
  { id: 'puddle', emoji: '🫠', name: 'Structural Failure', desc: 'Melt the head.' },
  { id: 'yeet', emoji: '🚀', name: 'Yeet', desc: 'Throw the whole head off the screen.' },
  { id: 'meltdown', emoji: '☢️', name: 'Nuclear Meltdown', desc: 'Max out the rage-o-meter.' },
  { id: 'foodfight', emoji: '🥧', name: 'Food Fight', desc: 'Land 10 throws on the face.', counter: 'splat', need: 10 },
  { id: 'picasso', emoji: '🖍️', name: 'Picasso', desc: 'Doodle a lot on the face.', counter: 'stroke', need: 150 },
  { id: 'glutton', emoji: '🍔', name: 'Glutton', desc: 'Feed it until it is completely full.' },
  { id: 'technicolor', emoji: '🤮', name: 'Technicolor Yawn', desc: 'Make it throw up.' },
  { id: 'dragon', emoji: '🌶️', name: 'Dragon Breath', desc: 'Feed it a chili.' },
  { id: 'wired', emoji: '☕', name: 'Wired', desc: 'Give it an espresso.' },
  { id: 'beekeeper', emoji: '🐝', name: 'Beekeeper', desc: 'Swat 7 bees.', counter: 'swat', need: 7 },
  { id: 'driplord', emoji: '🥳', name: 'Drip Lord', desc: 'Wear all 5 props at once.' },
  { id: 'allthefeels', emoji: '🎭', name: 'All the Feels', desc: 'Try every feeling.', counter: 'feels', need: 7 },
  { id: 'copycat', emoji: '🎤', name: 'Copycat', desc: 'Make it copy your voice.' },
  { id: 'director', emoji: '🎬', name: 'Director', desc: 'Record a clip.' },
  { id: 'nightfever', emoji: '🪩', name: 'Night Fever', desc: 'Start the disco.' },
  { id: 'agentofchaos', emoji: '🎲', name: 'Agent of Chaos', desc: 'Press the chaos button.' },
  { id: 'completionist', emoji: '🏆', name: 'Completionist', desc: 'Unlock every other achievement.' },
];

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return {}; }
}

export class Achievements {
  constructor({ onUnlock }) {
    const saved = load();
    this.counters = saved.counters ?? {};
    this.sets = saved.sets ?? {}; // counters that count distinct things (feelings tried)
    this.unlocked = saved.unlocked ?? {}; // id -> timestamp
    this.onUnlock = onUnlock;
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ counters: this.counters, sets: this.sets, unlocked: this.unlocked }));
    } catch { /* private mode: progress just lasts this visit */ }
  }

  get total() { return ACHIEVEMENTS.length; }
  get count() { return Object.keys(this.unlocked).length; }
  has(id) { return !!this.unlocked[id]; }

  unlock(id) {
    if (this.unlocked[id]) return;
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (!a) return;
    this.unlocked[id] = Date.now();
    this.save();
    this.onUnlock?.(a);
    // Everything else done? Then the big one.
    if (id !== 'completionist' && ACHIEVEMENTS.every((x) => x.id === 'completionist' || this.unlocked[x.id])) {
      this.unlock('completionist');
    }
  }

  bump(counter, n = 1) {
    this.counters[counter] = (this.counters[counter] ?? 0) + n;
    this.check(counter);
    this.save();
  }

  // Count distinct values, e.g. each feeling once.
  bumpSet(counter, value) {
    const list = (this.sets[counter] ??= []);
    if (list.includes(value)) return;
    list.push(value);
    this.counters[counter] = list.length;
    this.check(counter);
    this.save();
  }

  check(counter) {
    const v = this.counters[counter] ?? 0;
    for (const a of ACHIEVEMENTS) if (a.counter === counter && v >= a.need) this.unlock(a.id);
  }

  progress(a) {
    if (!a.counter) return null;
    return { value: Math.min(a.need, this.counters[a.counter] ?? 0), need: a.need };
  }

  reset() {
    this.counters = {};
    this.sets = {};
    this.unlocked = {};
    this.save();
  }
}
