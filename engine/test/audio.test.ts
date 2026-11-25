import { describe, expect, it, vi } from 'vitest';
import { createClock } from '../src/core/clock.js';
import { createEvents } from '../src/core/events.js';
import { createPluginRegistry, createServiceRegistry } from '../src/core/plugins.js';
import { createRNG } from '../src/core/rng.js';
import { createScheduler } from '../src/core/scheduler.js';
import { createActionState } from '../src/input/actions.js';
import { eventFanoutPlugin } from '../src/render/event-fanout.js';
import { AUDIO_SERVICE, audioPlugin, createAudioManager } from '../src/audio/manager.js';
import { createMusic } from '../src/audio/music.js';
import { createAudio, createSynth, type AudioSink } from '../src/audio/synth.js';

function fakeSink(initialState = 'suspended') {
  let state = initialState;
  const param = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  });
  const node = () => ({ connect: vi.fn(), disconnect: vi.fn() });
  const sink: AudioSink = {
    get state(): string {
      return state;
    },
    currentTime: 1,
    sampleRate: 8000,
    destination: {},
    resume: vi.fn(async () => {
      state = 'running';
    }),
    createGain: vi.fn(() => ({ ...node(), gain: param() })),
    createOscillator: vi.fn(() => ({
      ...node(),
      frequency: param(),
      type: 'square' as OscillatorType,
      start: vi.fn(),
      stop: vi.fn(),
    })),
    createBufferSource: vi.fn(() => ({ ...node(), buffer: null, start: vi.fn(), stop: vi.fn() })),
    createBuffer: vi.fn((_channels: number, length: number, _rate: number) => ({
      length,
      getChannelData: vi.fn(() => new Float32Array(length)),
    })),
  };
  return sink;
}

describe('synth en Node', () => {
  it('createAudio es inerte y nunca lanza sin AudioContext', async () => {
    const audio = createAudio();
    expect(audio.available).toBe(false);
    expect(() => audio.beep(440, 100)).not.toThrow();
    expect(() => audio.noise(100)).not.toThrow();
    expect(() => audio.play('hit')).not.toThrow();
    expect(await audio.resume()).toBe(false);
    audio.close();
  });

  it('reanuda explícitamente un contexto suspendido y toca el oscilador', async () => {
    const sink = fakeSink();
    const synth = createSynth({ context: sink });
    expect(synth.available).toBe(true);
    expect(await synth.resume()).toBe(true);
    expect(sink.resume).toHaveBeenCalledTimes(1);
    synth.beep(440, 50);
    expect(sink.createOscillator).toHaveBeenCalledTimes(1);
    synth.close();
  });

  it('beep suspendido espera a resume() sin lanzar', async () => {
    const sink = fakeSink();
    const synth = createSynth({ context: sink });
    synth.beep(440, 50);
    await Promise.resolve();
    await Promise.resolve();
    expect(sink.resume).toHaveBeenCalled();
    expect(sink.createOscillator).toHaveBeenCalledTimes(1);
  });

  it('el ruido se genera con RNG determinista sin tocar la simulación', () => {
    const sink = fakeSink('running');
    const synth = createSynth({ context: sink });
    synth.noise(50);
    expect(sink.createBuffer).toHaveBeenCalled();
  });

  it('volumen 0 calla la síntesis', () => {
    const sink = fakeSink('running');
    const synth = createSynth({ context: sink, volume: 0 });
    synth.beep(440, 50);
    expect(sink.createOscillator).not.toHaveBeenCalled();
  });
});

describe('manager de audio', () => {
  it('consume eventos en Node sin lanzar y respeta mute/volumen', () => {
    const manager = createAudioManager();
    expect(manager.synth.available).toBe(false);
    expect(() =>
      manager.consume([
        { type: 'hit', payload: { x: 1, y: 2 }, tick: 0 },
        { type: 'coin', payload: null, tick: 1 },
        { type: 'desconocido', payload: undefined, tick: 2 },
      ]),
    ).not.toThrow();
    manager.mute();
    expect(manager.muted).toBe(true);
    expect(manager.toggleMute()).toBe(false);
    manager.setVolume(Number.NaN);
    expect(manager.volume).toBe(0.5);
    manager.unmute();
    expect(manager.muted).toBe(false);
    manager.close();
  });

  it('un rule con función defectuosa no rompe el consume', () => {
    const manager = createAudioManager({
      mapping: {
        bad: () => {
          throw new Error('boom');
        },
        many: ['blip', 'hit', 'coin'],
      },
    });
    expect(() =>
      manager.consume([
        { type: 'bad', payload: null, tick: 0 },
        { type: 'many', payload: null, tick: 5 },
      ]),
    ).not.toThrow();
    manager.close();
  });

  it('el plugin registra el servicio y consume la cola una sola vez', () => {
    const clock = createClock(1 / 60);
    const services = createServiceRegistry();
    const events = createEvents(() => clock.tick);
    const registry = createPluginRegistry(
      [eventFanoutPlugin(), audioPlugin()],
      {
        clock,
        rng: createRNG(3),
        events,
        scheduler: createScheduler(clock),
        actions: createActionState(),
      },
      services,
    );
    expect(services.has(AUDIO_SERVICE)).toBe(true);
    events.emit('hit', { x: 1, y: 2 });
    expect(() => registry.postStep()).not.toThrow();
    expect(events.peek()).toEqual([]);
    registry.dispose();
  });
});

describe('música por ticks', () => {
  it('play/tick/stop respetan secuencias y bucles', () => {
    const synth = createSynth({ context: null });
    const beep = vi.spyOn(synth, 'beep');
    const music = createMusic(synth, {
      short: { id: 'short', notes: [{ semitone: 0, ticks: 2 }, { semitone: 4, ticks: 2 }] },
      loop: { id: 'loop', notes: [{ semitone: 0, ticks: 1 }], loop: true },
    });

    expect(music.play('short')).toBe(true);
    expect(music.current).toBe('short');
    expect(music.play('inexistente')).toBe(false);
    expect(beep).toHaveBeenCalledTimes(1);
    music.tick(2);
    expect(beep).toHaveBeenCalledTimes(2);
    music.tick(2);
    expect(music.playing).toBe(false);

    beep.mockClear();
    music.play('loop');
    music.tick(5);
    expect(beep).toHaveBeenCalledTimes(6);
    music.stop();
    expect(music.current).toBeNull();
  });
});
