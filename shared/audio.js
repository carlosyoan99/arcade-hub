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

/* ── Ambient presets per game (freq1, freq2, filterFreq, volume) ── */
const AMBIENT_PRESETS = {
  _default: { f1: 55, f2: 65.41, filter: 180, vol: 0.025, wave1: 'triangle', wave2: 'sine' },
  pong: { f1: 55, f2: 65.41, filter: 160, vol: 0.02, wave1: 'triangle', wave2: 'sine' },
  tetris: { f1: 65.41, f2: 82.41, filter: 200, vol: 0.02, wave1: 'triangle', wave2: 'sine' },
  pacman: { f1: 73.42, f2: 87.31, filter: 220, vol: 0.018, wave1: 'sine', wave2: 'triangle' },
  'space-invaders': {
    f1: 48.99,
    f2: 55,
    filter: 150,
    vol: 0.022,
    wave1: 'sawtooth',
    wave2: 'sine',
  },
  galaga: { f1: 55, f2: 73.42, filter: 190, vol: 0.02, wave1: 'triangle', wave2: 'sawtooth' },
  frogger: { f1: 82.41, f2: 98, filter: 240, vol: 0.018, wave1: 'sine', wave2: 'triangle' },
  centipede: { f1: 48.99, f2: 61.74, filter: 170, vol: 0.022, wave1: 'sawtooth', wave2: 'sine' },
  breakout: { f1: 65.41, f2: 82.41, filter: 200, vol: 0.02, wave1: 'triangle', wave2: 'sine' },
  snake: { f1: 55, f2: 65.41, filter: 160, vol: 0.02, wave1: 'sine', wave2: 'sine' },
  'donkey-kong': { f1: 73.42, f2: 87.31, filter: 210, vol: 0.02, wave1: 'triangle', wave2: 'sine' },
  defender: { f1: 41.2, f2: 48.99, filter: 140, vol: 0.025, wave1: 'sawtooth', wave2: 'triangle' },
  digdug: { f1: 65.41, f2: 73.42, filter: 190, vol: 0.02, wave1: 'triangle', wave2: 'sine' },
  asteroids: { f1: 41.2, f2: 55, filter: 130, vol: 0.022, wave1: 'sine', wave2: 'sine' },
  'missile-command': {
    f1: 48.99,
    f2: 55,
    filter: 150,
    vol: 0.025,
    wave1: 'sawtooth',
    wave2: 'sine',
  },
  joust: { f1: 82.41, f2: 98, filter: 230, vol: 0.018, wave1: 'triangle', wave2: 'sine' },
  'flappy-bird': { f1: 87.31, f2: 110, filter: 260, vol: 0.015, wave1: 'sine', wave2: 'triangle' },
  'dino-runner': {
    f1: 55,
    f2: 73.42,
    filter: 180,
    vol: 0.022,
    wave1: 'triangle',
    wave2: 'sawtooth',
  },
  'neon-nexus': { f1: 55, f2: 65.41, filter: 170, vol: 0.02, wave1: 'triangle', wave2: 'sine' },
  'cell-swarm': { f1: 61.74, f2: 73.42, filter: 185, vol: 0.02, wave1: 'sine', wave2: 'triangle' },
};

export function startAmbient(gameId) {
  if (ambientNodes) return;
  const a = ensureAudio();
  if (!a) return;
  const preset = AMBIENT_PRESETS[gameId] || AMBIENT_PRESETS._default;
  try {
    const o1 = a.createOscillator(),
      o2 = a.createOscillator();
    const g = a.createGain(),
      f = a.createBiquadFilter();
    o1.type = preset.wave1;
    o1.frequency.setValueAtTime(preset.f1, a.currentTime);
    o2.type = preset.wave2;
    o2.frequency.setValueAtTime(preset.f2, a.currentTime);
    f.type = 'lowpass';
    f.frequency.setValueAtTime(preset.filter, a.currentTime);
    g.gain.setValueAtTime(0, a.currentTime);
    g.gain.linearRampToValueAtTime(preset.vol, a.currentTime + 1);
    o1.connect(f);
    o2.connect(f);
    f.connect(g);
    g.connect(a.destination);
    o1.start();
    o2.start();
    ambientNodes = { osc1: o1, osc2: o2, gain: g, filter: f };
  } catch (err) {
    /* eslint-disable no-console */
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('startAmbient failed:', err);
    }
    /* eslint-enable no-console */
  }
}

export function stopAmbient() {
  if (!ambientNodes) return;
  if (audioCtx) {
    try {
      ambientNodes.gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
    } catch (err) {
      /* eslint-disable no-console */
      if (typeof console !== 'undefined' && console.warn)
        console.warn('stopAmbient ramp failed', err);
      /* eslint-enable no-console */
    }
  }
  setTimeout(() => {
    try {
      ambientNodes.osc1.stop();
    } catch (err) {
      /* eslint-disable no-console */
      if (typeof console !== 'undefined' && console.warn)
        console.warn('stopAmbient osc1 stop failed', err);
      /* eslint-enable no-console */
    }
    try {
      ambientNodes.osc2.stop();
    } catch (err) {
      /* eslint-disable no-console */
      if (typeof console !== 'undefined' && console.warn)
        console.warn('stopAmbient osc2 stop failed', err);
      /* eslint-enable no-console */
    }
    ambientNodes = null;
  }, 350);
}

export function closeAudio() {
  // stopAmbient defers oscillator stop by ~350ms for a smooth fade-out.
  // Close the context AFTER that delay so oscillators aren't cut short.
  const wasPlaying = !!ambientNodes;
  stopAmbient();
  const closeDelay = wasPlaying ? 400 : 0;
  setTimeout(() => {
    if (audioCtx && audioCtx.state !== 'closed') {
      try {
        audioCtx.close();
      } catch (err) {
        /* eslint-disable no-console */
        if (typeof console !== 'undefined' && console.warn) console.warn('closeAudio failed', err);
        /* eslint-enable no-console */
      }
      audioCtx = null;
    }
  }, closeDelay);
}
