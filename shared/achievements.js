/* ═══════════════════════════════════
   shared/achievements.js — Logros
   Persistencia compartida en localStorage.
   ═══════════════════════════════════ */
import { beep } from './audio.js';

const ACH_KEY = 'ach_data';

export const achievements = {
  _data: JSON.parse(localStorage.getItem(ACH_KEY) || '{}'),
  unlock(id) {
    if (!this._data[id]) {
      this._data[id] = true;
      localStorage.setItem(ACH_KEY, JSON.stringify(this._data));
      beep({ freq: 880, freqEnd: 1320, duration: 0.25, type: 'triangle', volume: 0.15 });
    }
  },
  has(id) {
    return !!this._data[id];
  },
  incrementPlays(gameId) {
    const plays = JSON.parse(localStorage.getItem('arcadehub_plays') || '{}');
    plays[gameId] = (plays[gameId] || 0) + 1;
    localStorage.setItem('arcadehub_plays', JSON.stringify(plays));
  },
  getPlays(gameId) {
    const plays = JSON.parse(localStorage.getItem('arcadehub_plays') || '{}');
    return plays[gameId] || 0;
  },
  getAllPlays() {
    return JSON.parse(localStorage.getItem('arcadehub_plays') || '{}');
  },
};
