// Text-to-speech via the browser. Every OS ships at least one cursed voice.
export const voiceState = { voices: [], voice: null, pitch: 1, rate: 1, speaking: false, lastBoundary: 0, until: 0 };
export const isTalking = () => voiceState.speaking && performance.now() < voiceState.until;

const synth = window.speechSynthesis;
let current = null;

export function loadVoices(onChange) {
  if (!synth) return;
  const refresh = () => {
    voiceState.voices = synth.getVoices();
    onChange?.(voiceState.voices);
  };
  refresh();
  synth.addEventListener?.('voiceschanged', refresh);
}

export function speak(text, { pitch, rate, voice, interrupt = true, onEnd } = {}) {
  if (!synth || !text) { onEnd?.(); return false; }
  if (interrupt) synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  current = u;
  const v = voice ?? voiceState.voice;
  if (v) u.voice = v;
  u.pitch = pitch ?? voiceState.pitch;
  u.rate = rate ?? voiceState.rate;
  u.onstart = () => { voiceState.speaking = true; };
  u.onboundary = () => { voiceState.lastBoundary = performance.now(); };
  u.onend = u.onerror = () => {
    // A cancelled utterance also ends. Only the current one owns the mouth.
    if (current === u) voiceState.speaking = false;
    onEnd?.();
  };
  // Some browsers never fire onstart. Assume it started, and give up after a sane time.
  voiceState.speaking = true;
  voiceState.until = performance.now() + 1500 + (text.length * 110) / u.rate;
  synth.speak(u);
  return true;
}

export function stopSpeaking() {
  synth?.cancel();
  voiceState.speaking = false;
}

export const isBusy = () => !!synth && (synth.speaking || synth.pending);
