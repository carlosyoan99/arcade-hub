import type { EnginePlugin, PluginAPI } from '../core/plugins.js';
import type { RNG } from '../core/rng.js';
import {
  DEFAULT_PROGRESSION,
  levelForProgress,
  levelSpec,
  type ProgressionConfig,
} from './curve.js';
import { createPatternPicker, type PatternPicker } from './variety.js';

export const PROGRESSION_SERVICE = 'progression';

export interface ProgressionState {
  readonly level: number;
  readonly progress: number;
  /** Velocidad efectiva (base × ajuste DDA). */
  readonly speed: number;
  readonly baseSpeed: number;
  readonly spawnInterval: number | null;
  readonly hazard: number;
  readonly adjustment: number;
  /** Último patrón elegido; evita que cada juego guarde una copia. */
  readonly currentPattern: string | null;
  readonly ticks: number;
  readonly patternBag: readonly string[];
  readonly patternRecent: readonly string[];
}

export interface ProgressionService {
  readonly state: ProgressionState;
  /** El juego informa de su progreso (puntos, líneas, limpiezas...). */
  update(progress: number): void;
  /** Rendimiento del jugador en [-1, 1]. Positivo = va bien ⇒ más dificultad. */
  observe(performance: number): void;
  /** Siguiente patrón variado, o null si el juego no declara patrones. */
  nextPattern(): string | null;
  snapshot(): ProgressionState;
  restore(state: ProgressionState): void;
}

export function createProgression(config: ProgressionConfig, rng: RNG): ProgressionService {
  const picker: PatternPicker = createPatternPicker(
    rng.fork(0x50524f47),
    config.patterns ?? [],
    config.avoidRepeat ?? 1,
  );
  const first = levelSpec(0, config);
  let state: ProgressionState = {
    level: 0,
    progress: 0,
    speed: first.speed,
    baseSpeed: first.speed,
    spawnInterval: first.spawnInterval ?? null,
    hazard: first.hazard ?? 0,
    adjustment: 0,
    currentPattern: null,
    ticks: 0,
    patternBag: [],
    patternRecent: [],
  };
  let samples: number[] = [];

  function recomputeSpeed(): void {
    const base = levelSpec(state.level, config).speed;
    const adjustment = config.dda?.enabled ? state.adjustment : 0;
    state = { ...state, baseSpeed: base, speed: base * (1 + adjustment) };
  }

  return {
    get state(): ProgressionState {
      return state;
    },
    update(progress: number): void {
      const level = levelForProgress(progress, config);
      const spec = levelSpec(level, config);
      state = {
        ...state,
        progress,
        level,
        spawnInterval: spec.spawnInterval ?? null,
        hazard: spec.hazard ?? 0,
        ticks: state.ticks + 1,
      };
      recomputeSpeed();
    },
    observe(performance: number): void {
      const dda = config.dda;
      if (!dda?.enabled) return;
      const sample = Math.max(-1, Math.min(1, performance));
      samples = [...samples, sample].slice(-Math.max(1, dda.window));
      const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
      const adjustment = Math.max(-dda.maxAdjust, Math.min(dda.maxAdjust, average * dda.maxAdjust));
      state = { ...state, adjustment };
      recomputeSpeed();
    },
    nextPattern(): string | null {
      const pattern = picker.next();
      state = { ...state, currentPattern: pattern };
      return pattern;
    },
    snapshot(): ProgressionState {
      const pattern = picker.snapshot();
      return { ...state, patternBag: [...pattern.bag], patternRecent: [...pattern.recent] };
    },
    restore(restored: ProgressionState): void {
      state = { ...restored };
      picker.restore({ bag: restored.patternBag, recent: restored.patternRecent });
    },
  };
}

/** Plugin opcional: permite sustituir la curva por juego sin tocar el motor. */
export function progressionPlugin(config: ProgressionConfig): EnginePlugin {
  let service: ProgressionService | undefined;
  return {
    id: `${PROGRESSION_SERVICE}:${config.id ?? config.levels.map((level) => level.speed).join('-')}`,
    install(api: PluginAPI): void {
      service = createProgression(config, api.rng);
      api.services.provide(PROGRESSION_SERVICE, service);
    },
    dispose(): void {
      service = undefined;
    },
  };
}

export function defaultProgression(rng: RNG): ProgressionService {
  return createProgression(DEFAULT_PROGRESSION, rng);
}
