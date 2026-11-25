/** Curvas de dificultad declarativas. Sin reloj real ni azar. */

export interface LevelSpec {
  /** Multiplicador de velocidad del juego en este nivel. */
  readonly speed: number;
  /** Intervalo de aparición en ticks (si el juego usa spawns). */
  readonly spawnInterval?: number;
  /** Intensidad de peligro 0..1 (si el juego la usa). */
  readonly hazard?: number;
  readonly label?: string;
}

export interface ProgressionConfig {
  /** Identificador estable del plugin (por juego). */
  readonly id?: string;
  readonly levels: readonly LevelSpec[];
  /** Unidades de progreso (puntos, líneas, limpiezas) por nivel. */
  readonly pointsPerLevel: number;
  /** Máximo de niveles; el último se repite como techo. */
  readonly maxLevel?: number;
  /** Adaptación dinámica oculta y acotada. */
  readonly dda?: {
    readonly enabled: boolean;
    /** Ticks que se promedian para medir rendimiento. */
    readonly window: number;
    /** Ajuste máximo ± sobre la velocidad base. */
    readonly maxAdjust: number;
  };
  /** Patrones de variedad; se eligen con RNG y sin repetirlos seguidos. */
  readonly patterns?: readonly string[];
  readonly avoidRepeat?: number;
}

export const DEFAULT_PROGRESSION: ProgressionConfig = {
  levels: [{ speed: 1 }, { speed: 1.1, label: 'Nivel 2' }, { speed: 1.25, label: 'Nivel 3' }],
  pointsPerLevel: 100,
  dda: { enabled: false, window: 600, maxAdjust: 0.1 },
  patterns: [],
  avoidRepeat: 1,
};

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function levelForProgress(progress: number, config: ProgressionConfig): number {
  if (!Number.isFinite(progress) || config.pointsPerLevel <= 0) return 0;
  const raw = Math.floor(progress / config.pointsPerLevel);
  const ceiling = config.maxLevel ?? config.levels.length;
  return clamp(raw, 0, ceiling);
}

export function levelSpec(level: number, config: ProgressionConfig): LevelSpec {
  const levels = config.levels;
  if (levels.length === 0) return { speed: 1 };
  const index = clamp(level, 0, levels.length - 1);
  return levels[index] ?? { speed: 1 };
}
