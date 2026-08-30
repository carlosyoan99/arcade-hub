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

import { lsGet, lsSet } from './storage.js';

/** Lee el récord guardado para el prefijo dado (0 si no existe). */
export function loadBest(prefix) {
  const v = lsGet(prefix + '_best');
  return v !== null ? Number(v) : 0;
}

/** Guarda el récord para el prefijo dado. */
export function saveBest(prefix, score) {
  lsSet(prefix + '_best', String(score));
}
