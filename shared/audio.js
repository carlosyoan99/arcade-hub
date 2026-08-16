/* ═══════════════════════════════════
   shared/audio.js — Audio helper
   Web Audio API: ensureAudio, beep,
   ambient background music.
   Mejoras: startAmbient llama a ensureAudio internamente
   y logging en catches para facilitar debugging en dev
   ═══════════════════════════════════ */
let audioCtx = null;

export function ensureAudio() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

export function beep({
  freq = 440,
  freqEnd = null,
  duration = 0.12,
  type = 'sine',
  volume = 0.2,
} = {}) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, ctx.currentTime + duration);
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

let ambientNodes = null;

export function startAmbient() {
  if (ambientNodes) return;
  // Aseguramos audio context — puede que no exista si no se llamó a ensureAudio previamente
  const a = ensureAudio();
  if (!a) return;
  try {
    const o1 = a.createOscillator(),
      o2 = a.createOscillator();
    const g = a.createGain(),
      f = a.createBiquadFilter();
    o1.type = 'triangle';
    o1.frequency.setValueAtTime(55, a.currentTime);
    o2.type = 'sine';
    o2.frequency.setValueAtTime(65.41, a.currentTime);
    f.type = 'lowpass';
    f.frequency.setValueAtTime(180, a.currentTime);
    g.gain.setValueAtTime(0, a.currentTime);
    g.gain.linearRampToValueAtTime(0.025, a.currentTime + 1);
    o1.connect(f);
    o2.connect(f);
    f.connect(g);
    g.connect(a.destination);
    o1.start();
    o2.start();
    ambientNodes = { osc1: o1, osc2: o2, gain: g, filter: f };
  } catch (err) {
    // AudioContext may be closed or creation failed (autoplay policy); warn in dev
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('startAmbient failed:', err);
    }
  }
}

export function stopAmbient() {
  if (!ambientNodes) return;
  if (audioCtx) {
    try {
      ambientNodes.gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
    } catch (err) {
      if (typeof console !== 'undefined' && console.warn) console.warn('stopAmbient ramp failed', err);
    }
  }
  setTimeout(() => {
    try {
      ambientNodes.osc1.stop();
    } catch (err) {
      if (typeof console !== 'undefined' && console.warn) console.warn('stopAmbient osc1 stop failed', err);
    }
    try {
      ambientNodes.osc2.stop();
    } catch (err) {
      if (typeof console !== 'undefined' && console.warn) console.warn('stopAmbient osc2 stop failed', err);
    }
    ambientNodes = null;
  }, 350);
}

export function closeAudio() {
  stopAmbient();
  if (audioCtx && audioCtx.state !== 'closed') {
    try {
      audioCtx.close();
    } catch (err) {
      if (typeof console !== 'undefined' && console.warn) console.warn('closeAudio failed', err);
    }
    audioCtx = null;
  }
}
