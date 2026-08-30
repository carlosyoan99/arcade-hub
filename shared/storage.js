/**
 * shared/storage.js — try/catch-safe localStorage helpers.
 *
 * localStorage can throw in Safari private mode, corporate policies,
 * or when storage is full. Every call in the project should go through
 * these helpers instead of using localStorage directly.
 */

/**
 * Read a value from localStorage, returning `fallback` on any error.
 * @param {string} key
 * @param {*} [fallback=null]
 * @returns {*}
 */
export function lsGet(key, fallback = null) {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? v : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Write a value to localStorage, silently ignoring errors.
 * @param {string} key
 * @param {*} value
 */
export function lsSet(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* storage unavailable or full — degrade gracefully */
  }
}

/**
 * Read and JSON-parse a value from localStorage.
 * @param {string} key
 * @param {*} [fallback=null]
 * @returns {*}
 */
export function lsGetJSON(key, fallback = null) {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * JSON-stringify and write a value to localStorage.
 * @param {string} key
 * @param {*} value
 */
export function lsSetJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable or full — degrade gracefully */
  }
}
