/* ═══════════════════════════════════
   shared/help.js — Ayuda contextual
   Muestra modal con descripción,
   controles y logros de cada juego.
   ═══════════════════════════════════ */

const GAMES = {
  pong: {
    title: 'Pong',
    icon: '🏓',
    controls: [
      '1P: Flechas ↑↓ (o W/S) para mover la paleta',
      '2P local: Jugador 1 con W/S, Jugador 2 con ↑/↓',
      'Tab para alternar modo 1P (vs IA) / 2P local',
      'Espacio para empezar / sacar',
      'R para reiniciar',
      'Gamepad: Stick izquierdo + botón A/Start',
    ],
    goal: 'Primero en llegar a 7 puntos gana la partida. Modo 2P local con controles divididos. La IA tiene reaction delay, aim error y speed variation para ser más humana.',
    achievements: [
      { icon: '🏓', name: 'Primera victoria', desc: 'Ganá tu primera partida de Pong' },
      { icon: '🏆', name: 'Invencible', desc: 'Acumulá 5 victorias en Pong' },
    ],
  },
  breakout: {
    title: 'Breakout',
    icon: '🧱',
    controls: [
      'Flechas ←→ o A/D para mover la paleta',
      'Espacio para lanzar la pelota / empezar',
      'Gamepad: Stick izquierdo + botón A',
    ],
    goal: 'Rompe todos los ladrillos de cada nivel. Layout 8×14 con 8 colores/puntos. Anti-stuck: si no golpeás un ladrillo en 5s, la pelota rebota hacia arriba automáticamente.',
    achievements: [
      { icon: '🧱', name: 'Rompe-récords', desc: 'Alcanzá los 1.000 puntos en Breakout' },
      { icon: '⭐', name: 'Veterano', desc: 'Alcanzá el nivel 5' },
      { icon: '💎', name: 'Perfecto', desc: 'Ganá sin perder vida' },
    ],
  },
  snake: {
    title: 'Snake',
    icon: '🐍',
    controls: [
      'Flechas ←→↑↓ o WASD para mover la serpiente',
      'Espacio para empezar / reiniciar',
      'R para reiniciar',
      'Gamepad: D-pad o stick',
    ],
    goal: 'Atrapá la comida para crecer y sumar puntos. La velocidad aumenta cada 10 puntos (10 niveles). No te choques contra las paredes ni contra vos mismo.',
    achievements: [
      { icon: '🐍', name: 'Decatlón', desc: 'Llegá a 10 puntos en Snake' },
      { icon: '🌱', name: 'Creciente', desc: 'Alcanzá 25 puntos' },
      { icon: '⚡', name: 'Demonio de velocidad', desc: 'Alcanzá velocidad máxima' },
    ],
  },
  'dino-runner': {
    title: 'Dino Runner',
    icon: '🦖',
    controls: [
      'Espacio / ↑ / W / tocar para saltar',
      '↓ / S para agacharte o caer rápido en el aire',
      'Gamepad: botón A para saltar',
    ],
    goal: 'Corré, saltá y agachate para esquivar cactus y pterodáctilos. La velocidad aumenta con el tiempo. Day/night cicla cada Milestone. Pastel easter egg aleatorio.',
    achievements: [
      { icon: '🦖', name: 'Corredor incansable', desc: 'Sobreviví 500 unidades en Dino Runner' },
      { icon: '🏃', name: 'Maratón', desc: 'Corré 1000m' },
      { icon: '🦉', name: 'Búho nocturno', desc: 'Sobreviví la noche' },
    ],
  },
  asteroids: {
    title: 'Asteroids',
    icon: '🚀',
    controls: [
      '← → o A/D para girar la nave',
      '↑ o W para impulsarse',
      'Espacio para disparar',
      'H para hiperspacio (teletransporte aleatorio, cooldown 5s)',
      'Gamepad: Stick + botón A',
    ],
    goal: 'Destruí asteroides con tu nave. Los grandes se parten en dos medianos, los medianos en dos chicos. Usá hiperspacio para escapar. No choques!',
    achievements: [
      { icon: '🚀', name: 'Cazador de asteroides', desc: 'Alcanzá los 1.000 puntos en Asteroids' },
      { icon: '🌀', name: 'Hiperspacio', desc: 'Usá el hiperspacio una vez' },
      { icon: '🛡️', name: 'Superviviente', desc: 'Completá una oleada sin morir' },
    ],
  },
  'space-invaders': {
    title: 'Space Invaders',
    icon: '👾',
    controls: [
      '←→ para mover la nave',
      'Espacio para disparar / empezar',
      'Gamepad: Stick + botón A disparar',
    ],
    goal: 'Destruí oleadas de invasores espaciales. Shields con erosión espacial (daño radial). Solo el más bajo de cada columna dispara. Max 3 balas enemigas. Vida extra a 1000 pts. Dificultad escala con cada oleada.',
    achievements: [
      { icon: '👾', name: 'Invasión frustrada', desc: 'Alcanzá los 2.000 puntos' },
      { icon: '🛸', name: 'Misterioso', desc: 'Derribá la nave misteriosa' },
      { icon: '⭐', name: 'Veterano', desc: 'Alcanzá la oleada 5' },
    ],
  },
  'flappy-bird': {
    title: 'Flappy Bird',
    icon: '🐤',
    controls: ['Espacio / ↑ / tocar la pantalla para aletear', 'Gamepad: botón A para aletear'],
    goal: 'Volá esquivando tubos. La dificultad aumenta: gap se achica (140→90), speed sube (200→320), tubos aparecen más seguido.',
    achievements: [
      { icon: '🐤', name: 'Volador implacable', desc: 'Alcanzá 10 puntos en Flappy Bird' },
      { icon: '🏆', name: 'Maestro', desc: 'Alcanzá 20 puntos' },
    ],
  },
  pacman: {
    title: 'Pac-Man',
    icon: '🟡',
    controls: ['Flechas ←→↑↓ para mover a Pac-Man', 'Gamepad: D-pad o stick direccional'],
    goal: 'Comé todos los puntos del laberinto esquivando a los fantasmas. Power pellets te dejan comer fantasmas (6s). Cruise Elroy: Blinky se acelera con pocos dots. Ghost pause al comer fantasma (~1s). Vida extra a 10K.',
    achievements: [
      { icon: '🟡', name: 'Comecocos experto', desc: 'Alcanzá los 2.000 puntos en Pac-Man' },
      { icon: '🍒', name: 'Frutero', desc: 'Comé una fruta' },
      { icon: '👻', name: 'Cazafantasmas', desc: 'Comé 4 fantasmas con una power pellet' },
    ],
  },
  tetris: {
    title: 'Tetris',
    icon: '🧊',
    controls: [
      '← → o A/D para mover la pieza',
      '↑ o W para rotar en sentido horario',
      'Z para rotar en sentido antihorario',
      '↓ o S para bajar más rápido (soft drop, 1pt/celda)',
      'Espacio para caída directa (hard drop)',
      'C o Shift para guardar pieza (hold)',
      'P para pausa',
      'Gamepad: D-pad + botones A/B',
    ],
    goal: 'Armá líneas completas con las 7 piezas (7-bag randomizer). SRS con wall kicks. T-Spin: full (3+ esquinas) y mini. Back-to-back ×1.5. Lock delay 0.5s, max 15 resets.',
    achievements: [
      { icon: '🧊', name: 'Maestro del Tetris', desc: 'Alcanzá los 500 puntos en Tetris' },
      { icon: '🎯', name: 'Tetris', desc: 'Completá 4 líneas de una vez' },
      { icon: '💯', name: 'Siglo', desc: 'Completá 100 líneas en total' },
    ],
  },
  frogger: {
    title: 'Frogger',
    icon: '🐸',
    controls: ['Flechas ←→↑↓ para mover a la rana', 'Gamepad: D-pad o stick'],
    goal: 'Cruzá la calle esquivando autos y camiones, después cruzá el río saltando sobre troncos y tortugas (que se sumergen). Timer de 60s por vida. Llegá a las 5 zonas seguras para ganar.',
    achievements: [
      { icon: '🐸', name: 'Cruzador de ríos', desc: 'Alcanzá los 1.000 puntos en Frogger' },
      { icon: '🏅', name: 'Héroe', desc: 'Alcanzá 3 goals en una partida' },
      { icon: '🎁', name: 'Coleccionista', desc: 'Comé un bonus item' },
    ],
  },
  galaga: {
    title: 'Galaga',
    icon: '🛸',
    controls: [
      '←→ para mover la nave',
      'Espacio para disparar / empezar',
      'Gamepad: Stick + botón A',
    ],
    goal: 'Destruí oleadas con 3 tipos de enemigo: Boss (2HP, corona), Bee (rayas), Butterfly (alas). 8 formation patterns rotativos. Entry sequences en stages 1-4. Bonus challenge cada 5 waves. Doble disparo permanente tras rescate.',
    achievements: [
      { icon: '🛸', name: 'Comandante estelar', desc: 'Alcanzá los 2.000 puntos' },
      { icon: '👑', name: 'Boss Kill', desc: 'Derrotá un Boss Galaga' },
      { icon: '⭐', name: 'Veterano', desc: 'Alcanzá la oleada 10' },
    ],
  },
  centipede: {
    title: 'Centipede',
    icon: '🐛',
    controls: [
      '←→↑↓ para mover la mira',
      'Espacio para disparar / empezar',
      'Gamepad: Stick para apuntar + botón A',
    ],
    goal: 'Dispará al ciempiés mientras serpentea por el hongo. Cada segmento destruido se convierte en hongo. Cuidado con la araña (movimiento errático), pulga (deja hongos) y escorpione (envenena hongos).',
    achievements: [
      { icon: '🐛', name: 'Exterminador', desc: 'Alcanzá los 1.000 puntos' },
      { icon: '💰', name: '5000 puntos', desc: 'Alcanzá 5000 puntos' },
      { icon: '⭐', name: 'Veterano de oleadas', desc: 'Alcanzá la oleada 5' },
    ],
  },
  digdug: {
    title: 'Dig Dug',
    icon: '⛏️',
    controls: [
      '←→↑↓ para mover a Dig Dug',
      'Espacio para inflar / empezar',
      'Gamepad: D-pad + botón A inflar',
    ],
    goal: 'Excavá túneles. Inflá enemigos hasta que exploten o derrumbá rocas sobre ellos. Pooka se disfraza de hongo cada 4-8s. Fygar tiene breath de fuego horizontal. Frutas bonus entre oleadas.',
    achievements: [
      { icon: '⛏️', name: 'Excavador implacable', desc: 'Alcanzá los 1.000 puntos' },
      { icon: '🪨', name: 'Aplastamiento', desc: 'Aplatá un enemigo con una roca' },
      { icon: '⭐', name: 'Profundo', desc: 'Alcanzá la oleada 5' },
    ],
  },
  'missile-command': {
    title: 'Missile Command',
    icon: '🚀',
    controls: [
      'Mouse / tocar para apuntar y disparar',
      'Flechas ←→↑↓ para mover la mira',
      'Espacio para disparar',
      'Gamepad: Stick para apuntar + botón A',
    ],
    goal: 'Defendé tus ciudades de misiles enemigos. Lanzá interceptores para destruirlos. Bonus por sobrevivir (puntos por ciudad viva). Misiles más rápidos en oleadas altas.',
    achievements: [
      { icon: '🚀', name: 'Defensor de ciudades', desc: 'Alcanzá los 1.000 puntos' },
      { icon: '🛡️', name: 'Protector', desc: 'Sobreviví con todas las ciudades' },
      { icon: '⭐', name: 'Superviviente', desc: 'Alcanzá la oleada 5' },
    ],
  },
  'neon-nexus': {
    title: 'Neon Nexus',
    icon: '◈',
    controls: [
      'Click / tocar enemigos para daño extra',
      '1 / 2 / 3 para mejorar ATK, HP o Velocidad',
      'T o tap en tienda para mejoras permanentes',
      'Espacio para empezar / reiniciar',
      '←→ para elegir carta entre oleadas',
      'Gamepad: Stick para moverse, botones A/B/X/Y',
    ],
    goal: 'Defendé tu torre contra oleadas de formas neon. Cada 5 oleadas aparece un Boss. Enemigos camuflados (?) solo se ven con Scanner. Los enemigos voladores (↑) aparecen desde la oleada 6.',
    achievements: [],
  },
  'cell-swarm': {
    title: 'Cell Swarm',
    icon: '🟣',
    controls: [
      'Mouse / deslizar para mover tu célula',
      'Espacio para dividirte (Split)',
      'E para eyectar masa (Eject)',
      'Shift para Boost (×1.8 velocidad, consume masa)',
      'Gamepad: Stick para mover, A dividir, B eyectar',
    ],
    goal: 'Crece comiendo células más pequeñas y comida. Huí de las más grandes. Boost da velocidad extra. Viruses te dividen si sos grande. Mass decay previene camping. ¡Cuidado con el borde!',
    achievements: [],
  },
  'donkey-kong': {
    title: 'Donkey Kong',
    icon: '🦍',
    controls: [
      '← → o A/D para mover a Mario',
      'Espacio / ↑ / W para saltar',
      'Subí escaleras automáticamente al presionar ↑',
      'Gamepad: Stick mover, A saltar',
    ],
    goal: '4 fases: Barriles (esquivá barriles), Fuego (esquivá fuego), Elevador (plataformas elevadoras), Construcción (barriles aleatorios). Escalá hasta la cima en cada fase.',
    achievements: [
      { icon: '🪜', name: 'Escalador novato', desc: 'Completá tu primer nivel' },
      { icon: '🔥', name: 'Imparable', desc: 'Alcanzá los 5.000 puntos' },
      { icon: '🏆', name: 'Maestro de la obra', desc: 'Llegá al nivel 10' },
    ],
  },
  defender: {
    title: 'Defender',
    icon: '🚀',
    controls: [
      '↑ ↓ ← → o WASD para mover la nave',
      'Espacio para disparar / empezar',
      'B para bomba inteligente',
      'H para hiperspacio (teletransporte, cooldown 5s)',
      'N para bomba nuclear (1 por vida, destruye todo)',
      'R para reiniciar',
      'Gamepad: Stick mover, A disparar, B bomba, X hiperspacio, Y nuclear',
    ],
    goal: 'Defendé humanos de alienígenas. Dispará landers antes de que escapen. Hiperspacio: teleport random. Nuclear: destruye todos los enemigos (1 por vida). Mutantes aparecen SIEMPRE al perder humano. Mini-radar muestra humanos.',
    achievements: [
      { icon: '👽', name: 'Primera sangre', desc: 'Derrotá a tu primer enemigo' },
      { icon: '💣', name: 'Bombardero', desc: 'Usá 3 bombas inteligentes' },
      { icon: '🏆', name: 'Comandante galáctico', desc: 'Alcanzá los 10.000 puntos' },
      { icon: '☢️', name: 'Nuclear', desc: 'Usá la bomba nuclear una vez' },
      { icon: '🌀', name: 'Hiperspacio', desc: 'Usá el hiperspacio una vez' },
      { icon: '⭐', name: '5 oleadas', desc: 'Sobreviví 5 oleadas' },
    ],
  },
  joust: {
    title: 'Joust',
    icon: '🦅',
    controls: [
      '← → o A/D para mover el avestruz',
      'Espacio / ↑ / W para aletear / ascender',
      'R para reiniciar',
      'Tocar para empezar',
      'Gamepad: Stick mover, A aletear',
    ],
    goal: 'Golpeá desde arriba para vencer. 5 tipos: Bounder, Hunter, Shadow Lord, Vulture (zigzag errático, wave 2+), Pterodactyl (fly-dive-climb, wave 5+). Lava sube gradualmente. Recolectá huevos antes de que eclosionen.',
    achievements: [
      { icon: '🥇', name: 'Primera justa', desc: 'Derrotá a tu primer enemigo' },
      { icon: '🥚', name: 'Cazador de huevos', desc: 'Recolectá 10 huevos' },
      { icon: '🏆', name: 'Imbatible', desc: 'Llegá a la oleada 5' },
    ],
  },
};

/**
 * Muestra un modal de ayuda superpuesto al juego.
 * Crea los elementos DOM dinámicamente y los adjunta al body.
 * @param {string} gameId - Identificador del juego (ej. 'pong', 'tetris')
 */
export function showHelp(gameId) {
  const g = GAMES[gameId];
  if (!g) return;

  // Leer logros desbloqueados
  let achData = {};
  try {
    achData = JSON.parse(localStorage.getItem('ach_data') || '{}');
  } catch {
    /* corrupt storage */
  }

  // Crear backdrop
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

  // Modal
  const modal = document.createElement('div');
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'ahTitle');
  modal.setAttribute('tabindex', '-1');
  Object.assign(modal.style, {
    background: 'var(--bg-panel, rgba(0,0,0,0.85))',
    border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
    borderRadius: '16px',
    padding: '28px 32px',
    maxWidth: '480px',
    width: '100%',
    maxHeight: '85vh',
    overflowY: 'auto',
    color: 'var(--text-primary, #f2f2f2)',
    position: 'relative',
    transform: 'scale(0.92) translateY(10px)',
    transition: 'transform 0.3s cubic-bezier(.34,1.56,.64,1)',
    outline: 'none',
  });

  // Guardar el elemento con foco para restaurarlo al cerrar
  const prevFocus = document.activeElement;

  const isDark = document.documentElement.dataset.theme !== 'light';
  if (isDark) {
    modal.style.background = 'rgba(10, 10, 26, 0.92)';
    modal.style.borderColor = 'rgba(255,255,255,0.08)';
  } else {
    modal.style.background = 'rgba(245, 245, 250, 0.95)';
    modal.style.borderColor = 'rgba(0,0,0,0.08)';
    modal.style.color = '#1a1a2e';
  }

  // Botón cerrar
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.setAttribute('aria-label', 'Cerrar ayuda');
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
    borderRadius: '6px',
    transition: 'color 0.2s',
  });
  closeBtn.onmouseenter = () => (closeBtn.style.color = isDark ? '#fff' : '#000');
  closeBtn.onmouseleave = () =>
    (closeBtn.style.color = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)');

  const close = () => {
    document.removeEventListener('keydown', keyHandler);
    backdrop.style.opacity = '0';
    modal.style.transform = 'scale(0.92) translateY(10px)';
    setTimeout(() => {
      backdrop.remove();
      if (prevFocus && typeof prevFocus.focus === 'function') prevFocus.focus();
    }, 250);
  };
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  // Generate achievement cards properly
  const achEl = document.createElement('div');
  achEl.style.cssText = 'display:flex;flex-direction:column;gap:6px';

  // Achievement ID mapping
  const achIds = {
    'Primera victoria': 'pong_first_win',
    Invencible: 'pong_win_streak',
    'Rompe-récords': 'breakout_thousand',
    Decatlón: 'snake_decathlon',
    'Corredor incansable': 'dino_fivehundo',
    'Cazador de asteroides': 'asteroids_thousand',
    'Invasión frustrada': 'invaders_twothousand',
    'Volador implacable': 'flappy_decathlon',
    'Comecocos experto': 'pacman_twothousand',
    'Maestro del Tetris': 'tetris_fivehundo',
    'Cruzador de ríos': 'frogger_thousand',
    'Comandante estelar': 'galaga_twothousand',
    Exterminador: 'centipede_thousand',
    'Excavador implacable': 'digdug_thousand',
    'Defensor de ciudades': 'missile_thousand',
    'Escalador novato': 'dk_first_win',
    Imparable: 'dk_thousand',
    'Maestro de la obra': 'dk_master',
    'Primera sangre': 'def_first_kill',
    Bombardero: 'def_bomb_three',
    'Comandante galáctico': 'def_commander',
    'Primera justa': 'joust_first_joust',
    'Cazador de huevos': 'joust_egg_hunter',
    Imbatible: 'joust_invincible',
  };

  for (const a of g.achievements) {
    const achId = achIds[a.name];
    const unlocked = achId ? !!achData[achId] : false;
    const card = document.createElement('div');
    Object.assign(card.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '8px 12px',
      borderRadius: '10px',
      background: unlocked
        ? isDark
          ? 'rgba(0,255,136,0.06)'
          : 'rgba(0,200,100,0.06)'
        : isDark
          ? 'rgba(255,255,255,0.03)'
          : 'rgba(0,0,0,0.03)',
      border: unlocked
        ? `1px solid ${isDark ? 'rgba(0,255,136,0.15)' : 'rgba(0,200,100,0.15)'}`
        : `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
      opacity: unlocked ? '1' : '0.45',
    });

    card.innerHTML = `
      <span style="font-size:20px">${unlocked ? a.icon : '🔒'}</span>
      <div>
        <div style="font-size:12px;font-weight:500;color:${unlocked ? (isDark ? '#00ff88' : '#008844') : 'inherit'}">${unlocked ? a.name : '???'}</div>
        <div style="font-size:10px;opacity:0.6;margin-top:1px">${unlocked ? a.desc : 'Jugá para descubrir este logro'}</div>
      </div>
    `;
    achEl.appendChild(card);
  }

  // Armado del modal
  modal.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
      <span style="font-size:32px" aria-hidden="true">${g.icon}</span>
      <div>
        <div id="ahTitle" style="font-size:20px;font-weight:700;letter-spacing:2px">${g.title}</div>
        <div style="font-size:11px;opacity:0.5;letter-spacing:2px;text-transform:uppercase;margin-top:2px">Cómo jugar</div>
      </div>
    </div>
    <div style="font-size:13px;line-height:1.7;margin-bottom:16px;opacity:0.85">${g.goal}</div>
    <div style="font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;opacity:0.4;font-family:'Orbitron',monospace">Controles</div>
    <ul style="margin:0 0 18px 0;padding:0;list-style:none">
      ${g.controls.map((c) => `<li style="font-size:12px;padding:4px 0;opacity:0.75;display:flex;align-items:center;gap:6px"><span style="opacity:0.3">▶</span> ${c}</li>`).join('')}
    </ul>
    <div style="font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;opacity:0.4;font-family:'Orbitron',monospace">🏆 Logros</div>
  `;
  modal.appendChild(achEl);

  // ── Metadata: versión, fecha y changelog ──
  const metaSection = document.createElement('div');
  metaSection.id = 'ahMeta';
  metaSection.style.cssText =
    'margin-top:16px;padding-top:12px;border-top:1px solid ' +
    (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)');
  metaSection.innerHTML =
    '<div style="font-size:10px;color:' +
    (isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)') +
    ';text-align:center">Cargando información del juego…</div>';
  modal.appendChild(metaSection);

  // Fetch metadata.json asincrónicamente
  fetch('./metadata.json')
    .then((r) => {
      if (!r.ok) throw new Error('Not found');
      return r.json();
    })
    .then((meta) => {
      metaSection.innerHTML = '';

      // Escapar texto para prevenir XSS
      const esc = (s) =>
        String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      // Versión y fecha
      const infoRow = document.createElement('div');
      infoRow.style.cssText =
        "display:flex;align-items:center;justify-content:center;gap:12px;font-size:10px;font-family:'Orbitron',monospace;letter-spacing:1px;color:" +
        (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)');
      infoRow.innerHTML = `
        <span style="display:flex;align-items:center;gap:4px">📦 v${esc(meta.version)}</span>
        <span style="opacity:0.3">·</span>
        <span style="display:flex;align-items:center;gap:4px">📅 ${esc(meta.created)}</span>
      `;
      metaSection.appendChild(infoRow);

      // Changelog
      if (meta.changelog && meta.changelog.length > 0) {
        const clSection = document.createElement('div');
        clSection.style.cssText = 'margin-top:10px';

        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.setAttribute('aria-label', 'Historial de cambios');
        toggleBtn.style.cssText =
          'display:flex;align-items:center;justify-content:center;gap:4px;font-size:10px;letter-spacing:1px;cursor:pointer;padding:6px 12px;border-radius:6px;border:1px solid transparent;color:' +
          (isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)') +
          ';background:' +
          (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)') +
          ';transition:all .2s;user-select:none;font-family:inherit';
        toggleBtn.innerHTML =
          '📋 Historial de cambios <span class="cl-arrow" aria-hidden="true" style="transition:transform .25s ease">▾</span>';

        const clBody = document.createElement('div');
        clBody.style.cssText =
          'overflow:hidden;max-height:0;transition:max-height 0.35s ease,margin 0.35s ease;margin-top:0';
        clBody.innerHTML = meta.changelog
          .map(
            (entry) => `
          <div style="padding:8px 10px;margin-top:6px;border-radius:6px;background:${isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'};border:1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}">
            <div style="font-size:9px;font-family:'Orbitron',monospace;letter-spacing:1px;color:${isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'};margin-bottom:4px">v${esc(entry.version)} — ${esc(entry.date)}</div>
            <ul style="margin:0;padding:0 0 0 14px;list-style:none">
              ${entry.changes.map((c) => `<li style="font-size:10px;padding:1px 0;opacity:0.5;line-height:1.4"><span style="opacity:0.3;margin-right:4px">›</span>${esc(c)}</li>`).join('')}
            </ul>
          </div>
        `,
          )
          .join('');

        toggleBtn.addEventListener('click', () => {
          const isOpen = clBody.style.maxHeight !== '0px' && clBody.style.maxHeight !== '';
          toggleBtn.setAttribute('aria-expanded', String(!isOpen));
          if (isOpen) {
            clBody.style.maxHeight = '0';
            clBody.style.marginTop = '0';
          } else {
            clBody.style.maxHeight = clBody.scrollHeight + 'px';
            clBody.style.marginTop = '6px';
          }
          const arrow = toggleBtn.querySelector('.cl-arrow');
          if (arrow) arrow.style.transform = isOpen ? '' : 'rotate(180deg)';
        });

        clSection.appendChild(toggleBtn);
        clSection.appendChild(clBody);
        metaSection.appendChild(clSection);
      }
    })
    .catch(() => {
      // Si no se encuentra metadata.json, ocultar la sección
      metaSection.style.display = 'none';
    });

  modal.appendChild(closeBtn);
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  // Animar entrada
  requestAnimationFrame(() => {
    backdrop.style.opacity = '1';
    modal.style.transform = 'scale(1) translateY(0)';
    modal.focus();
  });

  // Tecla Escape para cerrar + focus trap (Tab cicla dentro del modal)
  const keyHandler = (e) => {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', keyHandler);
    }
    if (e.key === 'Tab') {
      const focusables = modal.querySelectorAll(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const atFirst = document.activeElement === first || document.activeElement === modal;
      const atLast = document.activeElement === last || document.activeElement === modal;
      if (e.shiftKey && atFirst) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && atLast) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  document.addEventListener('keydown', keyHandler);
}
