import type { RNG } from '../core/rng.js';

/**
 * Selector de patrones con bolsa (bag) y veto de repetición. La variedad es
 * sembrada: misma semilla ⇒ misma secuencia; nunca depende de Math.random.
 */
export interface PatternPicker {
  next(): string | null;
  snapshot(): { bag: readonly string[]; recent: readonly string[] };
  restore(state: { bag: readonly string[]; recent: readonly string[] }): void;
}

export function createPatternPicker(
  rng: RNG,
  patterns: readonly string[],
  avoidRepeat = 1,
): PatternPicker {
  let bag: string[] = [];
  let recent: string[] = [];
  const veto = Math.max(0, avoidRepeat);

  function refill(): void {
    bag = [...patterns];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      const a = bag[i] as string;
      const b = bag[j] as string;
      bag[i] = b;
      bag[j] = a;
    }
  }

  return {
    next(): string | null {
      if (patterns.length === 0) return null;
      if (bag.length === 0) refill();
      let index = bag.findIndex((pattern) => !recent.includes(pattern));
      // Si todo está vetado, se relaja el veto para no bloquear el juego.
      if (index < 0) index = 0;
      const pattern = bag.splice(index, 1)[0] ?? null;
      if (pattern !== null) {
        recent = [pattern, ...recent].slice(0, Math.max(1, veto));
      }
      return pattern;
    },
    snapshot(): { bag: readonly string[]; recent: readonly string[] } {
      return { bag: [...bag], recent: [...recent] };
    },
    restore(state: { bag: readonly string[]; recent: readonly string[] }): void {
      bag = [...state.bag];
      recent = [...state.recent];
    },
  };
}
