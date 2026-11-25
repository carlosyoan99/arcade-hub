/**
 * Síntesis WebAudio sin assets. En Node (sin AudioContext) es inerte y nunca
 * lanza. El ruido usa un RNG privado: jamás el RNG de la simulación.
 */

import { createRNG, type RNG } from '../core/rng.js';

export interface AudioParamLike {
  value: number;
  setValueAtTime(value: number, time: number): void;
  exponentialRampToValueAtTime(value: number, time: number): void;
}

export interface AudioNodeLike {
  connect(destination: unknown): void;
  disconnect(): void;
}

export interface GainLike extends AudioNodeLike {
  readonly gain: AudioParamLike;
}

export interface OscillatorLike extends AudioNodeLike {
  readonly frequency: AudioParamLike;
  type: OscillatorType;
  start(when?: number): void;
  stop(when?: number): void;
}

export interface BufferSourceLike extends AudioNodeLike {
  buffer: unknown;
  start(when?: number): void;
  stop(when?: number): void;
}

export interface AudioBufferLike {
  readonly length: number;
  getChannelData(channel: number): Float32Array;
}

/** Subconjunto mínimo de AudioContext, satisfacible por un contexto real o un doble de test. */
export interface AudioSink {
  readonly state: string;
  readonly currentTime: number;
  readonly sampleRate: number;
  readonly destination: unknown;
  resume(): Promise<void>;
  createGain(): GainLike;
  createOscillator(): OscillatorLike;
  createBufferSource(): BufferSourceLike;
  createBuffer(channels: number, length: number, sampleRate: number): AudioBufferLike;
  close?(): Promise<void>;
}

export type SynthPreset = 'blip' | 'hit' | 'coin' | 'explode' | 'win' | 'lose' | 'click';

export interface ToneOptions {
  readonly type?: OscillatorType;
  readonly volume?: number;
  readonly delayMs?: number;
  readonly endFrequency?: number;
}

export interface SynthOptions {
  readonly context?: AudioSink | null;
  readonly volume?: number;
}

export interface Synth {
  readonly available: boolean;
  readonly volume: number;
  setVolume(volume: number): void;
  /** Reanuda explícitamente un contexto suspendido. Resuelve false si no puede. */
  resume(): Promise<boolean>;
  beep(frequency: number, durationMs: number, options?: ToneOptions): void;
  noise(durationMs: number, options?: ToneOptions): void;
  play(preset: SynthPreset): void;
  close(): void;
}

function clamp01(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}

function resolveLocalContext(injected: AudioSink | null | undefined): AudioSink | null {
  if (injected !== undefined) return injected;
  try {
    const ctor = (globalThis as { AudioContext?: new () => AudioSink }).AudioContext;
    if (typeof ctor === 'function') return new ctor();
  } catch {
    // Política de autoplay o entorno sin WebAudio: seguimos inertes.
  }
  return null;
}

export function createSynth(options: SynthOptions = {}): Synth {
  let sink: AudioSink | null = resolveLocalContext(options.context);
  let closed = false;
  let volume = clamp01(options.volume ?? 0.5, 0.5);
  // RNG privado y determinista: el audio no debe consumir el RNG del juego.
  const noiseRng: RNG = createRNG(0x5e1e4e);

  function ensureSink(): AudioSink | null {
    if (closed) return null;
    if (!sink) sink = resolveLocalContext(undefined);
    return sink;
  }

  function schedule(fn: (context: AudioSink, now: number) => void): void {
    const context = ensureSink();
    if (!context || closed) return;
    if (context.state === 'running') {
      try {
        fn(context, context.currentTime);
      } catch {
        // Audio es prescripción: un fallo del dispositivo no rompe el juego.
      }
      return;
    }
    if (context.state === 'closed') return;
    void resume().then((ok: boolean) => {
      if (!ok || closed) return;
      try {
        fn(context, context.currentTime);
      } catch {
        // ídem
      }
    });
  }

  async function resume(): Promise<boolean> {
    const context = ensureSink();
    if (!context || closed) return false;
    if (context.state === 'running') return true;
    if (context.state === 'closed') return false;
    try {
      await context.resume();
      return context.state === 'running';
    } catch {
      return false;
    }
  }

  const synth: Synth = {
    get available(): boolean {
      return !closed && sink !== null && sink.state !== 'closed';
    },
    get volume(): number {
      return volume;
    },
    setVolume(next: number): void {
      if (!Number.isFinite(next)) return;
      volume = clamp01(next);
    },
    resume,
    beep(frequency: number, durationMs: number, tone: ToneOptions = {}): void {
      if (!Number.isFinite(frequency) || frequency <= 0) return;
      if (!Number.isFinite(durationMs) || durationMs <= 0) return;
      const duration = Math.min(durationMs, 10_000) / 1000;
      const delay = Math.max(0, Math.min(10_000, tone.delayMs ?? 0)) / 1000;
      const peak = clamp01(volume * clamp01(tone.volume ?? 1));
      if (peak <= 0) return;

      schedule((context, now) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = tone.type ?? 'square';
        oscillator.frequency.setValueAtTime(frequency, now);
        if (
          tone.endFrequency !== undefined &&
          Number.isFinite(tone.endFrequency) &&
          tone.endFrequency > 0
        ) {
          oscillator.frequency.exponentialRampToValueAtTime(tone.endFrequency, now + duration);
        }
        gain.gain.setValueAtTime(peak, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now + delay);
        oscillator.stop(now + delay + duration + 0.02);
      });
    },
    noise(durationMs: number, tone: ToneOptions = {}): void {
      if (!Number.isFinite(durationMs) || durationMs <= 0) return;
      const duration = Math.min(durationMs, 10_000) / 1000;
      const delay = Math.max(0, Math.min(10_000, tone.delayMs ?? 0)) / 1000;
      const peak = clamp01(volume * clamp01(tone.volume ?? 1));
      if (peak <= 0) return;

      schedule((context, now) => {
        const sampleRate = Number.isFinite(context.sampleRate) && context.sampleRate > 0
          ? context.sampleRate
          : 44_100;
        const length = Math.max(1, Math.floor(sampleRate * duration));
        const buffer = context.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = noiseRng.next() * 2 - 1;

        const source = context.createBufferSource();
        const gain = context.createGain();
        source.buffer = buffer;
        gain.gain.setValueAtTime(peak, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        source.connect(gain);
        gain.connect(context.destination);
        source.start(now + delay);
        source.stop(now + delay + duration + 0.02);
      });
    },
    play(preset: SynthPreset): void {
      switch (preset) {
        case 'blip':
          synth.beep(660, 60, { type: 'square', volume: 0.7 });
          break;
        case 'hit':
          synth.beep(180, 90, { type: 'sawtooth', endFrequency: 80, volume: 0.8 });
          break;
        case 'coin':
          synth.beep(880, 70, { type: 'square', volume: 0.6 });
          synth.beep(1320, 110, { type: 'square', volume: 0.6, delayMs: 70 });
          break;
        case 'explode':
          synth.noise(260, { volume: 0.9 });
          break;
        case 'win':
          synth.beep(523, 100, { type: 'triangle', volume: 0.7 });
          synth.beep(659, 100, { type: 'triangle', volume: 0.7, delayMs: 100 });
          synth.beep(784, 180, { type: 'triangle', volume: 0.7, delayMs: 200 });
          break;
        case 'lose':
          synth.beep(330, 140, { type: 'triangle', endFrequency: 165, volume: 0.7 });
          synth.beep(220, 240, { type: 'triangle', endFrequency: 110, volume: 0.7, delayMs: 140 });
          break;
        case 'click':
          synth.beep(440, 30, { type: 'square', volume: 0.4 });
          break;
        default:
          break;
      }
    },
    close(): void {
      closed = true;
      const context = sink;
      sink = null;
      if (context && typeof context.close === 'function') {
        void context.close().catch(() => undefined);
      }
    },
  };

  return synth;
}

/** Punto de entrada público: crea un sintetizador sin depender de DOM en Node. */
export function createAudio(options: SynthOptions = {}): Synth {
  return createSynth(options);
}
