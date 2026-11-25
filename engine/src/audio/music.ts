/** Secuencias musicales simples, avanzadas por ticks de simulación (sin setTimeout). */

import type { Synth } from './synth.js';

/** Semitono relativo a A4; null representa un silencio. */
export interface MusicNote {
  readonly semitone: number | null;
  readonly ticks: number;
}

export interface MusicSequence {
  readonly id: string;
  readonly notes: readonly MusicNote[];
  readonly loop?: boolean;
}

function sequence(id: string, semitones: readonly (number | null)[], ticks: number, loop = false): MusicSequence {
  return {
    id,
    notes: semitones.map((semitone) => ({ semitone, ticks })),
    ...(loop ? { loop: true } : {}),
  };
}

export const SONGS: Readonly<Record<string, MusicSequence>> = {
  menu: sequence('menu', [0, 4, 7, 12, 7, 4], 8, true),
  start: sequence('start', [0, 7, 12, 19], 6),
  gameover: sequence('gameover', [12, 9, 5, 0], 12),
  victory: sequence('victory', [0, 4, 7, 12, 16, 19], 7),
};

export function noteHz(semitone: number): number {
  if (!Number.isFinite(semitone)) return 440;
  return 440 * 2 ** (semitone / 12);
}

export interface Music {
  readonly current: string | null;
  readonly playing: boolean;
  play(id: string): boolean;
  stop(): void;
  /** Avanza N ticks y dispara las notas que correspondan. */
  tick(ticks?: number): void;
}

export function createMusic(
  synth: Synth,
  songs: Readonly<Record<string, MusicSequence>> = SONGS,
): Music {
  let active: MusicSequence | null = null;
  let cursor = 0;
  let remaining = 0;

  function startNote(index: number): void {
    if (!active) return;
    const note = active.notes[index];
    if (!note) return;
    if (note.semitone !== null) {
      synth.beep(noteHz(note.semitone), 110, { type: 'triangle', volume: 0.25 });
    }
    remaining = Math.max(0, Math.floor(note.ticks) - 1);
    cursor = index + 1;
  }

  return {
    get current(): string | null {
      return active?.id ?? null;
    },
    get playing(): boolean {
      return active !== null;
    },
    play(id: string): boolean {
      const found = Object.prototype.hasOwnProperty.call(songs, id) ? songs[id] : undefined;
      if (!found || found.notes.length === 0) return false;
      active = found;
      cursor = 0;
      remaining = 0;
      startNote(0);
      return true;
    },
    stop(): void {
      active = null;
      cursor = 0;
      remaining = 0;
    },
    tick(ticks: number = 1): void {
      if (!Number.isInteger(ticks) || ticks < 0) return;
      for (let step = 0; step < ticks; step++) {
        if (!active) return;
        if (remaining > 0) {
          remaining--;
          continue;
        }
        if (cursor >= active.notes.length) {
          if (active.loop !== true) {
            active = null;
            cursor = 0;
            return;
          }
          cursor = 0;
        }
        startNote(cursor);
      }
    },
  };
}
