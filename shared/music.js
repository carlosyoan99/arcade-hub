/* ═══════════════════════════════════════════════════════════════
   shared/music.js — Motor de música lofi-retro procedural.

   Secuenciador Web Audio sin dependencias ni ficheros de audio:
   cada juego define un "tema" (datos, no código) y el motor lo
   interpreta con bajo, acordes de pad detuneados, lead opcional,
   crujido de vinilo y delay con feedback (carácter lofi).

   Uso desde un juego:
     import { startMusic, stopMusic } from '../../shared/music.js';
     startGame()  → ensureAudio(); startAmbient(); startMusic('<gameId>');
     cleanup()    → stopAmbient(); stopMusic(); closeAudio();

   Preferencia global persistida: localStorage 'arcadehub_music'.
   El botón #musicBtn del game-bar (injectCommonElements) conmuta
   la preferencia vía delegación — los juegos no necesitan cablear nada.
   ═══════════════════════════════════════════════════════════════ */

/* ── Preferencia persistente ── */
const PREF_KEY = 'arcadehub_music';
const VOLUME_KEY = 'arcadehub_volume';

/** Volumen global de la música (0..1), persistido en 'arcadehub_volume'. */
export function getMusicVolume() {
  try {
    const v = parseFloat(localStorage.getItem(VOLUME_KEY));
    if (!Number.isNaN(v) && v >= 0) return Math.min(1, v);
  } catch {
    /* almacenamiento no disponible */
  }
  return 0.55;
}

/** Fija el volumen de la música en vivo (si está sonando) y lo persiste. */
export function setMusicVolume(v) {
  const clamped = typeof v === 'number' ? Math.min(1, Math.max(0, v)) : 0.55;
  try {
    localStorage.setItem(VOLUME_KEY, String(clamped));
  } catch {
    /* almacenamiento no disponible */
  }
  if (bus && audioCtx) {
    const scale = musicEnabled() ? clamped : 0;
    bus.master.gain.setTargetAtTime(scale, audioCtx.currentTime, 0.1);
  }
}

export function musicEnabled() {
  try {
    return localStorage.getItem(PREF_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setMusicEnabled(on) {
  try {
    localStorage.setItem(PREF_KEY, on ? 'on' : 'off');
  } catch {
    /* almacenamiento no disponible: la preferencia vive solo en memoria */
  }
  if (on) startMusic(lastId || 'default');
  else stopMusic();
}

/* ── Teoría mínima: nombre de nota → frecuencia ── */
const SEMI = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };

function freq(note) {
  const m = /^([A-G])(#?)(\d)$/.exec(note);
  if (!m) return 0;
  const midi = (Number(m[3]) + 1) * 12 + SEMI[m[1]] + (m[2] ? 1 : 0);
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/* ── Chords: voicings para los temas ── */
const CHORDS = {
  Dm9: ['D3', 'F3', 'A3', 'C4', 'E4'],
  Fmaj7: ['F3', 'A3', 'C4', 'E4'],
  Am: ['A2', 'C3', 'E3', 'A3'],
  F: ['F2', 'A2', 'C3', 'F3'],
  C: ['C3', 'E3', 'G3', 'C4'],
  G: ['G2', 'B2', 'D3', 'G3'],
  Em: ['E2', 'G2', 'B2', 'E3'],
  Dm: ['D2', 'F2', 'A2', 'D3'],
  Bm: ['B1', 'D2', 'F#2', 'B2'],
  D: ['D2', 'F#2', 'A2', 'D3'],
  A: ['A1', 'C#2', 'E2', 'A2'],
  E: ['E2', 'G#2', 'B2', 'E3'],
  Gm: ['G1', 'Bb1', 'D2', 'G2'],
  Cm: ['C2', 'Eb2', 'G2', 'C3'],
};

/* ── Temas por juego: datos puros ───────────────────────────────
   bpm: tempo · steps: corcheas · '-' silencio
   chord: un acorde cada 8 pasos (1 compás)                       */
const SONGS = {
  /* Pong — "Midnight Rally": lounge minimalista */
  pong: {
    bpm: 72,
    chord: ['Dm9', 'Dm9', 'Fmaj7', 'Fmaj7'],
    bass: 'D2 - A1 - D2 - - -  F2 - C2 - F2 - - -  D2 - A1 - D2 - - -  F2 - G2 - A2 - - -',
    lead: '- - - D4 - F3 - -  - - A3 - - - - -  - - - E4 - D3 - -  C4 - A3 - - - - -',
    leadWave: 'sine',
  },

  /* Tetris — "Neon Blocks": chiptune melódico */
  tetris: {
    bpm: 86,
    chord: ['Am', 'F', 'C', 'G'],
    bass: 'A1 A1 - E2 - A1 E2 -  F2 F2 - C3 - F2 C3 -  C2 C2 - G2 - C2 G2 -  G2 G2 - D3 - G2 B2 -',
    lead: 'E4 - C4 D4 E4 - D4 C4  A3 - C4 A3 - G3 A3 -  G3 - E3 G3 C4 - B3 G3  B3 - D4 E4 D4 - B3 G3',
    leadWave: 'square',
  },

  /* Space Invaders — "Void Patrol": tenso, sci-fi minimal */
  'space-invaders': {
    bpm: 78,
    chord: ['Em', 'C', 'G', 'Dm'],
    bass: 'E1 - - E1 - - B1 -  C2 - - C2 - G2 -  G1 - - G1 - - D2 -  D1 - - D1 - A1 -',
    lead: '- - B3 - - E4 - -  - C4 - - - G3 - -  - - D4 - - B3 - -  - - A3 - - F3 - -',
    leadWave: 'sawtooth',
  },

  /* Pac-Man — "Waka Waka": playful, upbeat arpeggios */
  pacman: {
    bpm: 110,
    chord: ['C', 'G', 'Am', 'F'],
    bass: 'C2 - G1 - C2 - - -  G1 - D2 - G1 - - -  A1 - E2 - A1 - - -  F1 - C2 - F1 - - -',
    lead: 'E4 G4 - E4 C4 - G3 -  D4 F4 - D4 B3 - G3 -  C4 E4 - C4 A3 - E3 -  A3 C4 - A3 F3 - C3 -',
    leadWave: 'square',
  },

  /* Galaga — "Star Duel": intense, fast arpeggios */
  galaga: {
    bpm: 95,
    chord: ['Dm', 'A', 'Gm', 'A'],
    bass: 'D2 - A1 - D2 - - -  A1 - E2 - A1 - - -  G1 - D2 - G1 - - -  A1 - E2 - A1 - - -',
    lead: 'D4 - F4 - A4 - F4  A3 - C4 - E4 - C4  G3 - Bb3 - D4 - Bb3  A3 - C#4 - E4 - C#4',
    leadWave: 'sawtooth',
  },

  /* Frogger — "River Hop": bouncy, adventurous */
  frogger: {
    bpm: 92,
    chord: ['G', 'C', 'Em', 'D'],
    bass: 'G1 - D2 - G1 - - -  C2 - G2 - C2 - - -  E1 - B1 - E1 - - -  D1 - A1 - D1 - - -',
    lead: 'B3 - D4 - G4 - D4  E4 - G4 - C5 - G4  G4 - B4 - E5 - B4  F#4 - A4 - D5 - A4',
    leadWave: 'triangle',
  },

  /* Centipede — "Mushroom Panic": frantic, staccato */
  centipede: {
    bpm: 100,
    chord: ['Am', 'Dm', 'E', 'Am'],
    bass: 'A1 - E2 - A1 - - -  D2 - A2 - D2 - - -  E1 - B1 - E1 - - -  A1 - E2 - A1 - - -',
    lead: 'A3 - C4 - E4 - C4  D4 - F4 - A4 - F4  E4 - G#4 - B4 - G#4  A4 - E4 - C4 - A3',
    leadWave: 'square',
  },

  /* Breakout — "Neon Bounce": rhythmic, satisfying bricks */
  breakout: {
    bpm: 88,
    chord: ['F', 'C', 'Gm', 'Am'],
    bass: 'F1 - C2 - F1 - - -  C2 - G2 - C2 - - -  G1 - D2 - G1 - - -  A1 - E2 - A1 - - -',
    lead: 'A3 - C4 - F4 - C4  G4 - E4 - C4 - G3  Bb3 - D4 - G4 - D4  C4 - A3 - E3 - C3',
    leadWave: 'triangle',
  },

  /* Snake — "Slither": minimal, pulsing, hypnotic */
  snake: {
    bpm: 80,
    chord: ['Dm', 'Gm', 'Am', 'Dm'],
    bass: 'D2 - - A1 - D2 - -  G1 - - D2 - G1 - -  A1 - - E2 - A1 - -  D2 - - A1 - D2 - -',
    lead: '- D4 - - - A3 - -  - G3 - - - D3 - -  - E4 - - - C4 - -  - D4 - - - A3 - -',
    leadWave: 'sine',
  },

  /* Donkey Kong — "Barrel Roll": bouncy, tropical vibe */
  'donkey-kong': {
    bpm: 96,
    chord: ['C', 'G', 'Am', 'F'],
    bass: 'C2 - G1 - C2 - - -  G1 - D2 - G1 - - -  A1 - E2 - A1 - - -  F1 - C2 - F1 - - -',
    lead: 'E4 - G4 - C5 - G4  D4 - F4 - B4 - F4  C4 - E4 - A4 - E4  A3 - C4 - F4 - C4',
    leadWave: 'triangle',
  },

  /* Defender — "Radar Sweep": dark, atmospheric */
  defender: {
    bpm: 76,
    chord: ['Dm', 'Bm', 'Gm', 'A'],
    bass: 'D2 - - A1 - D2 - -  B1 - - F#2 - B1 - -  G1 - - D2 - G1 - -  A1 - - E2 - A1 - -',
    lead: '- F4 - - - D4 - -  - B3 - - - F#3 - -  - D4 - - - Bb3 - -  - C4 - - - A3 - -',
    leadWave: 'sawtooth',
  },

  /* Dig Dug — "Underground": bouncy, subterranean feel */
  digdug: {
    bpm: 84,
    chord: ['C', 'Em', 'F', 'G'],
    bass: 'C2 - G1 - C2 - - -  E1 - B1 - E1 - - -  F1 - C2 - F1 - - -  G1 - D2 - G1 - - -',
    lead: 'E4 - G4 - C5 - G4  B3 - E4 - G4 - E4  A3 - C4 - F4 - C4  B3 - D4 - G4 - D4',
    leadWave: 'triangle',
  },

  /* Asteroids — "Deep Space": ambient, spacious */
  asteroids: {
    bpm: 68,
    chord: ['Em', 'C', 'G', 'Dm'],
    bass: 'E1 - - - B1 - - -  C2 - - - G2 - - -  G1 - - - D2 - - -  D1 - - - A1 - - -',
    lead: '- - B3 - - - E4 -  - - C4 - - - G3 -  - - D4 - - - B3 -  - - A3 - - - F3 -',
    leadWave: 'sine',
  },

  /* Missile Command — "Incoming": tense, urgent */
  'missile-command': {
    bpm: 82,
    chord: ['Dm', 'Gm', 'A', 'Dm'],
    bass: 'D2 - A1 - D2 - - -  G1 - D2 - G1 - - -  A1 - E2 - A1 - - -  D2 - A1 - D2 - - -',
    lead: 'D4 - F4 - A4 - F4  G4 - Bb4 - D5 - Bb4  A4 - C#5 - E5 - C#5  D5 - A4 - F4 - D4',
    leadWave: 'sawtooth',
  },

  /* Joust — "Cloud Battle": heroic, soaring */
  joust: {
    bpm: 90,
    chord: ['G', 'D', 'Em', 'C'],
    bass: 'G1 - D2 - G1 - - -  D1 - A1 - D1 - - -  E1 - B1 - E1 - - -  C2 - G2 - C2 - - -',
    lead: 'B3 - D4 - G4 - D4  F#4 - A4 - D5 - A4  G4 - B4 - E5 - B4  E4 - G4 - C5 - G4',
    leadWave: 'triangle',
  },

  /* Flappy Bird — "Wing Beat": cheerful, light */
  'flappy-bird': {
    bpm: 105,
    chord: ['C', 'F', 'G', 'C'],
    bass: 'C2 - G1 - C2 - - -  F1 - C2 - F1 - - -  G1 - D2 - G1 - - -  C2 - G1 - C2 - - -',
    lead: 'E4 - G4 - C5 - G4  A4 - F4 - C4 - F4  B3 - D4 - G4 - D4  C4 - E4 - G4 - E4',
    leadWave: 'sine',
  },

  /* Dino Runner — "Desert Sprint": driving, relentless */
  'dino-runner': {
    bpm: 98,
    chord: ['Am', 'F', 'C', 'G'],
    bass: 'A1 - E2 - A1 - - -  F1 - C2 - F1 - - -  C2 - G2 - C2 - - -  G1 - D2 - G1 - - -',
    lead: 'A3 - C4 - E4 - C4  F4 - A4 - C5 - A4  G4 - E4 - C4 - G3  D4 - B3 - G3 - D3',
    leadWave: 'square',
  },

  /* Neon Nexus — "Tower Pulse": strategic, building tension */
  'neon-nexus': {
    bpm: 85,
    chord: ['Dm', 'Bb', 'F', 'C'],
    bass: 'D2 - A1 - D2 - - -  Bb1 - F2 - Bb1 - - -  F1 - C2 - F1 - - -  C2 - G2 - C2 - - -',
    lead: 'F4 - A4 - D5 - A4  D4 - F4 - Bb4 - F4  C4 - F4 - A4 - F4  E4 - G4 - C5 - G4',
    leadWave: 'triangle',
  },

  /* Cell Swarm — "Micro Battle": pulsing, organic */
  'cell-swarm': {
    bpm: 88,
    chord: ['Em', 'Am', 'Dm', 'G'],
    bass: 'E1 - B1 - E1 - - -  A1 - E2 - A1 - - -  D2 - A2 - D2 - - -  G1 - D2 - G1 - - -',
    lead: 'B3 - E4 - G4 - E4  C4 - E4 - A4 - E4  F4 - A4 - D5 - A4  D4 - G4 - B4 - G4',
    leadWave: 'sine',
  },

  /* Bomberman — "Tick Timer": fuse march, mischievous staccato */
  bomberman: {
    bpm: 104,
    chord: ['Cm', 'Gm', 'Cm', 'Gm'],
    bass: 'C2 - C2 - - G1 - -  G1 - G1 - - D2 - -  C2 - C2 - - G1 - -  G1 - G1 - - D2 - -',
    lead: 'C4 - Eb4 - C4 - - -  Bb3 - D4 - Bb3 - - -  G4 - Eb4 - C4 - - -  D4 - Bb3 - G3 - - -',
    leadWave: 'square',
  },

  /* Raiden — "Star Fortress": driving, tense military synth */
  raiden: {
    bpm: 138,
    chord: ['Dm', 'Dm', 'Bb', 'A'],
    bass: 'D2 - D2 - A1 - D2 -  D2 - D2 - G1 - A1 -  Bb1 - Bb1 - F2 - Bb1 -  A1 - A1 - E2 - A1 -',
    lead: 'D5 - F5 - A5 - F5  A4 - D5 - F5 - D5  Bb4 - D5 - F5 - D5  A4 - C5 - E5 - C5',
    leadWave: 'square',
  },

  /* Gradius — "Delta Wing": heroic, rising arpeggio charge */
  gradius: {
    bpm: 132,
    chord: ['Am', 'F', 'C', 'G'],
    bass: 'A1 - A1 - E2 - A1 -  F1 - F1 - C2 - F1 -  C2 - C2 - G1 - C2 -  G1 - G1 - D2 - G1 -',
    lead: 'A4 - C5 - E5 - A5  F4 - A4 - C5 - F5  E4 - G4 - C5 - E5  D4 - G4 - B4 - D5',
    leadWave: 'sawtooth',
  },
};

/* ── Estado del transporte ── */
let audioCtx = null;
let bus = null;
let timer = null;
let currentId = null;
let lastId = null;
let step = 0;
let nextTime = 0;

function ensureCtx() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  // Los smoke tests mockean AudioContext de forma parcial: si falta alguna
  // capacidad que usa el motor, se desactiva en silencio.
  if (
    !audioCtx.createBufferSource ||
    !audioCtx.createBiquadFilter ||
    !audioCtx.createDelay ||
    !audioCtx.createGain
  ) {
    return null;
  }
  return audioCtx;
}

function buildBus(ctx) {
  const master = ctx.createGain();
  master.gain.value = getMusicVolume();
  const lofi = ctx.createBiquadFilter();
  lofi.type = 'lowpass';
  lofi.frequency.value = 1500;
  const delay = ctx.createDelay(1);
  delay.delayTime.value = 0.28;
  const fb = ctx.createGain();
  fb.gain.value = 0.32;
  const wet = ctx.createGain();
  wet.gain.value = 0.22;
  lofi.connect(master);
  lofi.connect(delay);
  delay.connect(fb);
  fb.connect(delay);
  delay.connect(wet);
  wet.connect(master);
  master.connect(ctx.destination);
  return { input: lofi, master };
}

function playNote(ctx, note, when, dur, wave, peak, detune = 0) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = wave;
  osc.frequency.value = freq(note);
  osc.detune.value = detune;
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(peak, when + 0.02);
  g.gain.setTargetAtTime(0.0001, when + dur, 0.09);
  osc.connect(g);
  g.connect(bus.input);
  osc.start(when);
  osc.stop(when + dur + 0.6);
}

function playChord(ctx, name, when, dur) {
  const notes = CHORDS[name] || [];
  notes.forEach((n, i) => {
    // Detune alternado ±7 cents → calidez "cinta gastada"
    playNote(ctx, n, when, dur * 0.95, i < 2 ? 'triangle' : 'sine', 0.045, i % 2 ? 7 : -7);
  });
}

function startCrackle(ctx) {
  const seconds = 2;
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    d[i] = Math.random() < 0.0012 ? (Math.random() * 2 - 1) * 0.6 : (Math.random() * 2 - 1) * 0.03;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 900;
  const g = ctx.createGain();
  g.gain.value = 0.05;
  src.connect(hp);
  hp.connect(g);
  g.connect(bus.input);
  src.start();
  return src;
}

function parseTrack(str) {
  return str.trim().split(/\s+/);
}

function scheduleStep(ctx, song, s, when, stepDur) {
  const bass = song._bass;
  const lead = song._lead;
  if (bass[s % bass.length] !== '-') {
    playNote(ctx, bass[s % bass.length], when, stepDur * 1.6, 'triangle', 0.16);
  }
  if (s % 8 === 0) {
    const name = song.chord[Math.floor(s / 8) % song.chord.length];
    playChord(ctx, name, when, stepDur * 8);
  }
  if (lead && lead[s % lead.length] !== '-') {
    playNote(ctx, lead[s % lead.length], when, stepDur * 1.4, song.leadWave, 0.06);
  }
}

function tick() {
  const song = SONGS[currentId];
  if (!song || !audioCtx || !bus) return;
  const stepDur = 30 / song.bpm;
  while (nextTime < audioCtx.currentTime + 0.35) {
    scheduleStep(audioCtx, song, step, nextTime, stepDur);
    step = (step + 1) % song._bass.length;
    nextTime += stepDur;
  }
}

/* ── API pública ── */

/**
 * Arranca el tema del juego (si la preferencia global está activa).
 * Seguro de llamar varias veces: reinicia el transporte con el nuevo tema.
 */
export function startMusic(gameId) {
  lastId = gameId;
  syncBtn();
  if (!musicEnabled()) return;
  const song = SONGS[gameId];
  if (!song) return;
  stopTransport();
  const ctx = ensureCtx();
  if (!ctx) return;
  try {
    if (!bus) bus = buildBus(ctx);
    bus.master.gain.setTargetAtTime(getMusicVolume(), ctx.currentTime, 0.4);
    song._bass = parseTrack(song.bass);
    song._lead = song.lead ? parseTrack(song.lead) : null;
    bus.crackle = bus.crackle || startCrackle(ctx);
    currentId = gameId;
    step = 0;
    nextTime = ctx.currentTime + 0.1;
    timer = setInterval(tick, 120);
  } catch {
    /* autoplay policy o contexto cerrado: sin música, sin ruido de error */
  }
}

export function stopMusic() {
  stopTransport();
  currentId = null;
}

function stopTransport() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (bus && audioCtx) {
    try {
      bus.master.gain.setTargetAtTime(0.0001, audioCtx.currentTime, 0.15);
    } catch {
      /* contexto ya cerrado */
    }
  }
}

/* ── Botón del game-bar (delegación: funciona aunque el botón
      se inyecte después de importar este módulo) ── */
document.addEventListener('click', (e) => {
  const btn = e.target.closest?.('#musicBtn');
  if (!btn) return;
  setMusicEnabled(!musicEnabled());
});

export function syncBtn() {
  const btn = document.getElementById('musicBtn');
  if (!btn) return;
  const on = musicEnabled();
  btn.textContent = on ? '🎵' : '🔇';
  btn.setAttribute('aria-pressed', String(on));
  btn.setAttribute('aria-label', on ? 'Silenciar música' : 'Activar música');
}

document.addEventListener('DOMContentLoaded', syncBtn);
