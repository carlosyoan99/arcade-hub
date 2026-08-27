/**
 * shared/settings.js — Panel de configuración del game-bar — Arcade Hub
 *
 * Abre (desde #settingsBtn, que injecta dom.js) un modal con:
 *   - Tema claro / oscuro (persistido en 'arcadehub_theme')
 *   - Volumen de la música (persistido en 'arcadehub_volume')
 *   - Reducir movimiento (persistido en 'arcadehub_reduce_motion')
 *
 * El botón se cablea vía setupGameShell (shell.js); los juegos no necesitan
 * llamar nada a mayores.
 */

import { getMusicVolume, setMusicVolume } from './music.js';

const THEME_KEY = 'arcadehub_theme';
const REDUCE_KEY = 'arcadehub_reduce_motion';

function readTheme() {
  try {
    return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

function setTheme(theme) {
  const next = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    /* almacenamiento no disponible */
  }
}

function readReduceMotion() {
  try {
    return document.documentElement.dataset.reduceMotion === 'on';
  } catch {
    return false;
  }
}

function setReduceMotion(on) {
  const val = on ? 'on' : 'off';
  document.documentElement.dataset.reduceMotion = val;
  try {
    localStorage.setItem(REDUCE_KEY, val);
  } catch {
    /* almacenamiento no disponible */
  }
}

function openModal() {
  const prevFocus = document.activeElement;

  const backdrop = document.createElement('div');
  backdrop.className = 'ah-backdrop';
  Object.assign(backdrop.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '10000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.75)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    opacity: '0',
    transition: 'opacity 0.25s ease',
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    padding: '20px',
  });

  const modal = document.createElement('div');
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'ahSettingsTitle');
  modal.setAttribute('tabindex', '-1');
  Object.assign(modal.style, {
    background: 'var(--bg-panel, rgba(0,0,0,0.85))',
    border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
    borderRadius: '16px',
    padding: '26px 28px',
    maxWidth: '420px',
    width: '100%',
    color: 'var(--text-primary, #f2f2f2)',
    position: 'relative',
    transform: 'scale(0.92) translateY(10px)',
    transition: 'transform 0.3s cubic-bezier(.34,1.56,.64,1)',
    outline: 'none',
  });

  const isDark = document.documentElement.dataset.theme !== 'light';
  if (isDark) {
    modal.style.background = 'rgba(10, 10, 26, 0.94)';
    modal.style.borderColor = 'rgba(255,255,255,0.08)';
  } else {
    modal.style.background = 'rgba(245, 245, 250, 0.96)';
    modal.style.borderColor = 'rgba(0,0,0,0.08)';
    modal.style.color = '#1a1a2e';
  }

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.setAttribute('aria-label', 'Cerrar configuración');
  Object.assign(closeBtn.style, {
    position: 'absolute',
    top: '12px',
    right: '14px',
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
    fontFamily: 'inherit',
    lineHeight: '1',
    padding: '4px 8px',
    borderRadius: '8px',
  });
  modal.appendChild(closeBtn);

  const title = document.createElement('h2');
  title.id = 'ahSettingsTitle';
  title.textContent = '⚙️ Configuración';
  Object.assign(title.style, {
    margin: '0 0 18px',
    fontSize: '18px',
    letterSpacing: '1px',
  });
  modal.appendChild(title);

  const row = (label, control) => {
    const wrap = document.createElement('div');
    Object.assign(wrap.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      padding: '10px 0',
      borderBottom: '1px solid ' + (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'),
    });
    const lab = document.createElement('span');
    lab.textContent = label;
    Object.assign(lab.style, { fontSize: '14px' });
    wrap.appendChild(lab);
    wrap.appendChild(control);
    return wrap;
  };

  // ── Tema ──
  const themeBtn = document.createElement('button');
  themeBtn.textContent = readTheme() === 'dark' ? '🌙 Oscuro' : '☀️ Claro';
  themeBtn.setAttribute('aria-pressed', 'false');
  Object.assign(themeBtn.style, {
    padding: '6px 14px',
    borderRadius: '8px',
    border: '1px solid ' + (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'),
    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
    color: 'inherit',
    fontFamily: 'inherit',
    fontSize: '13px',
    cursor: 'pointer',
  });
  themeBtn.addEventListener('click', () => {
    const next = readTheme() === 'dark' ? 'light' : 'dark';
    setTheme(next);
    themeBtn.textContent = next === 'dark' ? '🌙 Oscuro' : '☀️ Claro';
    themeBtn.style.background = next === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
    themeBtn.style.borderColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)';
  });
  modal.appendChild(row('🎨 Tema', themeBtn));

  // ── Volumen ──
  const vol = document.createElement('input');
  vol.type = 'range';
  vol.min = '0';
  vol.max = '100';
  vol.value = String(Math.round(getMusicVolume() * 100));
  vol.setAttribute('aria-label', 'Volumen de la música');
  Object.assign(vol.style, { width: '130px', accentColor: 'var(--neon-cyan, #00f0ff)' });
  const volLabel = document.createElement('span');
  volLabel.textContent = vol.value + '%';
  Object.assign(volLabel.style, {
    fontSize: '13px',
    minWidth: '44px',
    textAlign: 'right',
  });
  const volWrap = document.createElement('div');
  Object.assign(volWrap.style, { display: 'flex', alignItems: 'center', gap: '8px' });
  volWrap.appendChild(vol);
  volWrap.appendChild(volLabel);
  vol.addEventListener('input', () => {
    const v = Number(vol.value) / 100;
    setMusicVolume(v);
    volLabel.textContent = vol.value + '%';
  });
  modal.appendChild(row('🔊 Música', volWrap));

  // ── Reducir movimiento ──
  const reduceToggle = document.createElement('button');
  reduceToggle.setAttribute('role', 'switch');
  reduceToggle.setAttribute('aria-checked', String(readReduceMotion()));
  reduceToggle.textContent = readReduceMotion() ? 'ON' : 'OFF';
  Object.assign(reduceToggle.style, {
    padding: '6px 14px',
    borderRadius: '8px',
    border: '1px solid ' + (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'),
    background: readReduceMotion()
      ? 'rgba(110,231,183,0.25)'
      : isDark
        ? 'rgba(255,255,255,0.06)'
        : 'rgba(0,0,0,0.05)',
    color: 'inherit',
    fontFamily: 'inherit',
    fontSize: '13px',
    cursor: 'pointer',
  });
  reduceToggle.addEventListener('click', () => {
    const next = !(reduceToggle.getAttribute('aria-checked') === 'true');
    setReduceMotion(next);
    reduceToggle.setAttribute('aria-checked', String(next));
    reduceToggle.textContent = next ? 'ON' : 'OFF';
    reduceToggle.style.background = next
      ? 'rgba(110,231,183,0.25)'
      : isDark
        ? 'rgba(255,255,255,0.06)'
        : 'rgba(0,0,0,0.05)';
  });
  modal.appendChild(row('💨 Reducir movimiento', reduceToggle));

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  // Mostrar con transición
  requestAnimationFrame(() => {
    backdrop.style.opacity = '1';
    modal.style.transform = 'scale(1) translateY(0)';
  });
  modal.focus();

  function close() {
    backdrop.style.opacity = '0';
    modal.style.transform = 'scale(0.92) translateY(10px)';
    setTimeout(() => backdrop.remove(), 250);
    if (prevFocus && typeof prevFocus.focus === 'function') prevFocus.focus();
    document.removeEventListener('keydown', onKey, true);
    backdrop.removeEventListener('click', onBackdrop);
  }
  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };
  const onBackdrop = (e) => {
    if (e.target === backdrop) close();
  };
  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', onKey, true);
  backdrop.addEventListener('click', onBackdrop);
}

export function setupSettings() {
  document.getElementById('settingsBtn')?.addEventListener('click', openModal);
}
