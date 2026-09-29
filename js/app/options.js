// Options screen: volume for each channel and the effects level. Saved in this browser.
import * as sfx from '../audio.js';
import * as samples from '../samples.js';
import { voiceState } from '../voice.js';
import { $, $$, app, st } from './ctx.js';
import { setQualityMode } from './quality.js';

const KEY = 'headcase.options.v1';
const DEFAULTS = { master: 1, sfx: 1, voice: 1, music: 0.8, fx: 'auto' };
let opts = { ...DEFAULTS };

function load() {
  try { opts = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { opts = { ...DEFAULTS }; }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(opts)); } catch { /* private mode: settings last this visit */ }
}

// Push the settings into the audio engine, the speech voice, and the effects level.
function apply() {
  sfx.setVolumes({ master: opts.master, sfx: opts.sfx, voice: opts.voice, music: opts.music });
  voiceState.volume = opts.voice * opts.master;
  setQualityMode(opts.fx);
  render();
}

function render() {
  $$('[data-vol]').forEach((input) => {
    input.value = opts[input.dataset.vol];
    input.nextElementSibling.textContent = `${Math.round(opts[input.dataset.vol] * 100)}%`;
  });
  $$('[data-fx]').forEach((b) => b.classList.toggle('on', b.dataset.fx === opts.fx));
  const low = app.quality?.low;
  $('#fxNote').textContent = opts.fx === 'auto'
    ? `Auto switches to low effects if your device struggles.${low ? ' (It already did.)' : ''}`
    : opts.fx === 'low' ? 'Lower resolution and fewer particles. Kinder to phones and batteries.' : 'Everything on, always.';
}

// A little preview sound when a slider is let go, so you can hear the new level.
const PREVIEW = {
  master: () => sfx.boing(1.1),
  sfx: () => sfx.boing(1.2),
  voice: () => app.talk?.('Is this loud enough?'),
  // Music: a few seconds of the disco song (unless disco is already playing it).
  music: async () => {
    if (st.disco) return;
    if (!(await samples.loadOne('disco'))) return;
    const song = samples.loop('disco', { vol: 0.85, bus: 'music' });
    setTimeout(() => song?.stop(), 2500);
  },
};

$$('[data-vol]').forEach((input) => {
  input.addEventListener('input', () => {
    opts[input.dataset.vol] = +input.value;
    apply();
  });
  input.addEventListener('change', () => { save(); PREVIEW[input.dataset.vol]?.(); });
});
$$('[data-fx]').forEach((b) => b.addEventListener('click', () => {
  opts.fx = b.dataset.fx;
  apply();
  save();
}));
$('#optReset').addEventListener('click', () => {
  opts = { ...DEFAULTS };
  apply();
  save();
  sfx.ding();
});

$('#optionsBtn').addEventListener('click', () => {
  sfx.unlock();
  sfx.squeak(1.3);
  render();
  $('#optScreen').classList.remove('hidden');
});
$('#optClose').addEventListener('click', () => $('#optScreen').classList.add('hidden'));
$('#optScreen').addEventListener('click', (e) => { if (e.target.id === 'optScreen') $('#optScreen').classList.add('hidden'); });

load();
apply();
