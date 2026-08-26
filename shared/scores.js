/**
 * shared/scores.js — Persistencia de récords — Arcade Hub
 *
 * Deduplica el patrón repetido en todos los juegos:
 *   Number(localStorage.getItem('<prefijo>_best') || 0)
 *   localStorage.setItem('<prefijo>_best', String(score))
 *
 * El prefijo es el key histórico de cada juego (ej. 'snake2d',
 * 'joust', 'neonNexus') para no romper datos guardados.
 */

/** Lee el récord guardado para el prefijo dado (0 si no existe). */
export function loadBest(prefix) {
  return Number(localStorage.getItem(prefix + '_best') || 0);
}

/** Guarda el récord para el prefijo dado. */
export function saveBest(prefix, score) {
  localStorage.setItem(prefix + '_best', String(score));
}

/** Guarda solo si `score` supera el récord actual. Devuelve el récord vigente. */
export function saveBestIfBetter(prefix, score) {
  const best = loadBest(prefix);
  if (score > best) {
    saveBest(prefix, score);
    return score;
  }
  return best;
}
