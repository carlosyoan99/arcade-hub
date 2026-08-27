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

/** 'Dm9' → notas del acorde (voicing cerrado, raíz grave aparte) */
const CHORDS = {
  Dm9: ['D3', 'F3', 'A3', 'C4', 'E4'],
  Fmaj7: ['F3', 'A3', 'C4', 'E4'],
  Am: ['A2', 'C3', 'E3', 'A3'],
  F: ['F2', 'A2', 'C3', 'F3'],
  C: ['C3', 'E3', 'G3', 'C4'],
  G: ['G2', 'B2', 'D3', 'G3'],
};

/* ── Temas por juego: datos puros ───────────────────────────────
   bpm: tempo lofi (70-90) · steps: corcheas · '-' silencio
   chord: un acorde cada 8 pasos (1 compás)                       */
const SONGS = {
  /* Pong — "Midnight Rally": lounge minimalista, dos acordes lentos */
  pong: {
    bpm: 72,
    chord: ['Dm9', 'Dm9', 'Fmaj7', 'Fmaj7'],
    bass: 'D2 - A1 - D2 - - -  F2 - C2 - F2 - - -  D2 - A1 - D2 - - -  F2 - G2 - A2 - - -',
    lead: '- - - D4 - F3 - -  - - A3 - - - - -  - - - E4 - D3 - -  C4 - A3 - - - - -',
    leadWave: 'sine',
  },

  /* Tetris — "Neon Blocks": chiptune-lofi melódico, i-VI-III-VII */
  tetris: {
    bpm: 86,
    chord: ['Am', 'F', 'C', 'G'],
    bass: 'A1 A1 - E2 - A1 E2 -  F2 F2 - C3 - F2 C3 -  C2 C2 - G2 - C2 G2 -  G2 G2 - D3 - G2 B2 -',
    lead: 'E4 - C4 D4 E4 - D4 C4  A3 - C4 A3 - G3 A3 -  G3 - E3 G3 C4 - B3 G3  B3 - D4 E4 D4 - B3 G3',
    leadWave: 'square',
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
