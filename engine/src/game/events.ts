/** Catálogo de eventos de juice. El motor decide cómo se ven/suenan. */

export const JUICE_EVENTS = [
  'hit',
  'shoot',
  'score',
  'explode',
  'levelUp',
  'gameOver',
  'wallHit',
  'paddleHit',
  'serve',
  'flap',
  'jump',
  'crash',
  'coin',
  'powerUp',
  'deliver',
  'turbo',
  'spawn',
  'chain',
] as const;

export type JuiceEventType = (typeof JUICE_EVENTS)[number];

export function isJuiceEvent(type: string): type is JuiceEventType {
  return (JUICE_EVENTS as readonly string[]).includes(type);
}

export interface PositionPayload {
  readonly x: number;
  readonly y: number;
}

/** Mapa de payloads usados con más frecuencia (informativo, no obligatorio). */
export interface JuiceEventPayloads {
  hit: PositionPayload;
  explode: PositionPayload;
  score: { readonly score: number };
  levelUp: { readonly level: number };
  gameOver: { readonly winner: number | null };
}
