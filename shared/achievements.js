/* ═══════════════════════════════════
   shared/achievements.js — Logros
   Persistencia compartida en localStorage.
   ═══════════════════════════════════ */
import { beep } from './audio.js';

const ACH_KEY = 'ach_data';

function _loadData() {
  try {
    return JSON.parse(localStorage.getItem(ACH_KEY) || '{}');
  } catch {
    return {};
  }
}

export const achievements = {
  _data: _loadData(),
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
    try {
      const plays = JSON.parse(localStorage.getItem('arcadehub_plays') || '{}');
      plays[gameId] = (plays[gameId] || 0) + 1;
      localStorage.setItem('arcadehub_plays', JSON.stringify(plays));
    } catch {
      /* storage unavailable */
    }
  },
  getPlays(gameId) {
    try {
      const plays = JSON.parse(localStorage.getItem('arcadehub_plays') || '{}');
      return plays[gameId] || 0;
    } catch {
      return 0;
    }
  },
  getAllPlays() {
    try {
      return JSON.parse(localStorage.getItem('arcadehub_plays') || '{}');
    } catch {
      return {};
    }
  },
};
