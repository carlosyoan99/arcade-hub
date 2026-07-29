/* ═══════════════════════════════════
   shared/audio.js — Audio helper
   Web Audio API: ensureAudio, beep,
   ambient background music.
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
  const a = audioCtx;
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
  } catch {
    /* AudioContext may be closed */
  }
}

export function stopAmbient() {
  if (!ambientNodes) return;
  if (audioCtx) {
    try {
      ambientNodes.gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
    } catch {
      /* AudioContext may be closed */
    }
  }
  setTimeout(() => {
    try {
      ambientNodes.osc1.stop();
    } catch {
      /* AudioContext may be closed */
    }
    try {
      ambientNodes.osc2.stop();
    } catch {
      /* AudioContext may be closed */
    }
    ambientNodes = null;
  }, 350);
}

export function closeAudio() {
  stopAmbient();
  if (audioCtx && audioCtx.state !== 'closed') {
    audioCtx.close();
    audioCtx = null;
  }
}
