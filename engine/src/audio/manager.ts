/**
 * Traduce GameEvent[] a sonidos. En Node, sin AudioContext, es inerte y nunca
 * lanza: consume() y play() están protegidos contra errores del dispositivo.
 */

import type { EnginePlugin, PluginAPI } from '../core/plugins.js';
import type { GameEvent } from '../core/types.js';
import { EVENT_FANOUT_SERVICE, type EventFanout } from '../render/event-fanout.js';
import { createSynth, type Synth, type SynthPreset } from './synth.js';

export const AUDIO_SERVICE = 'audio';

export type AudioRule =
  | SynthPreset
  | readonly SynthPreset[]
  | ((event: GameEvent) => SynthPreset | null);

export const DEFAULT_AUDIO_MAPPING: Readonly<Record<string, AudioRule>> = {
  bounce: 'blip',
  paddle: 'blip',
  hit: 'hit',
  coin: 'coin',
  collect: 'coin',
  explode: 'explode',
  crash: 'explode',
  gameover: 'lose',
  lose: 'lose',
  win: 'win',
  victory: 'win',
  menu: 'click',
  click: 'click',
  start: 'blip',
};

export interface AudioManagerOptions {
  readonly synth?: Synth;
  readonly mapping?: Readonly<Record<string, AudioRule>>;
  readonly volume?: number;
  readonly muted?: boolean;
}

export interface AudioManager {
  readonly synth: Synth;
  readonly muted: boolean;
  readonly volume: number;
  consume(events: readonly GameEvent[]): void;
  handle(event: GameEvent): void;
  play(preset: SynthPreset): void;
  mute(): void;
  unmute(): void;
  toggleMute(): boolean;
  setVolume(volume: number): void;
  resume(): Promise<boolean>;
  close(): void;
}

function resolvePreset(rule: AudioRule, event: GameEvent): SynthPreset | null {
  if (typeof rule === 'string') return rule;
  if (typeof rule === 'function') {
    try {
      return rule(event);
    } catch {
      return null;
    }
  }
  if (rule.length === 0) return null;
  const index = Number.isFinite(event.tick) ? Math.abs(Math.floor(event.tick)) % rule.length : 0;
  return rule[index] ?? null;
}

export function createAudioManager(options: AudioManagerOptions = {}): AudioManager {
  const synth =
    options.synth ??
    createSynth(options.volume !== undefined ? { volume: options.volume } : {});
  const mapping = options.mapping ?? DEFAULT_AUDIO_MAPPING;
  let muted = options.muted ?? false;

  const manager: AudioManager = {
    synth,
    get muted(): boolean {
      return muted;
    },
    get volume(): number {
      return synth.volume;
    },
    play(preset: SynthPreset): void {
      if (muted) return;
      try {
        synth.play(preset);
      } catch {
        // Nunca propagar un fallo de audio al juego.
      }
    },
    handle(event: GameEvent): void {
      if (muted) return;
      const hasRule = Object.prototype.hasOwnProperty.call(mapping, event.type);
      if (!hasRule) return;
      const rule = mapping[event.type];
      if (rule === undefined) return;
      const preset = resolvePreset(rule, event);
      if (preset !== null) manager.play(preset);
    },
    consume(events: readonly GameEvent[]): void {
      for (const event of events) {
        try {
          manager.handle(event);
        } catch {
          // Un evento malformado no detiene a los demás.
        }
      }
    },
    mute(): void {
      muted = true;
    },
    unmute(): void {
      muted = false;
    },
    toggleMute(): boolean {
      muted = !muted;
      return muted;
    },
    setVolume(volume: number): void {
      try {
        synth.setVolume(volume);
      } catch {
        // ídem
      }
    },
    resume(): Promise<boolean> {
      return synth.resume();
    },
    close(): void {
      try {
        synth.close();
      } catch {
        // ídem
      }
    },
  };

  return manager;
}

/** Plugin de audio: expone el manager como servicio y escucha eventos del motor. */
export function audioPlugin(options: AudioManagerOptions = {}): EnginePlugin {
  let manager: AudioManager | undefined;

  return {
    id: AUDIO_SERVICE,
    version: '1.0.0',
    requires: [EVENT_FANOUT_SERVICE],
    install(api: PluginAPI): void {
      const fanout = api.services.get<EventFanout>(EVENT_FANOUT_SERVICE);
      const created = createAudioManager(options);
      manager = created;
      api.services.provide(AUDIO_SERVICE, created);
      fanout.subscribe((events) => created.consume(events));
    },
    dispose(): void {
      manager?.close();
    },
  };
}
