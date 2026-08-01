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
      'Flechas ↑↓ o W/S para mover la paleta',
      'Espacio para empezar / reiniciar',
      'R para reiniciar',
      'Gamepad: Stick izquierdo + botón A/Start',
    ],
    goal: 'Primero en llegar a 7 puntos gana la partida. Acumulá victorias para desbloquear logros.',
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
    goal: 'Rompe todos los ladrillos de cada nivel. Cada nivel es más rápido que el anterior. Perdés una vida si la pelota cae.',
    achievements: [
      { icon: '🧱', name: 'Rompe-récords', desc: 'Alcanzá los 1.000 puntos en Breakout' },
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
    goal: 'Atrapá la comida para crecer y sumar puntos. No te choques contra las paredes ni contra vos mismo.',
    achievements: [{ icon: '🐍', name: 'Decatlón', desc: 'Llegá a 10 puntos en Snake' }],
  },
  'dino-runner': {
    title: 'Dino Runner',
    icon: '🦖',
    controls: [
      'Espacio / ↑ / W / tocar para saltar',
      '↓ / S para agacharte',
      'Gamepad: botón A para saltar',
    ],
    goal: 'Corré, saltá y agachate para esquivar cactus y pterodáctilos. La velocidad aumenta con el tiempo.',
    achievements: [
      { icon: '🦖', name: 'Corredor incansable', desc: 'Sobreviví 500 unidades en Dino Runner' },
    ],
  },
  asteroids: {
    title: 'Asteroids',
    icon: '🚀',
    controls: [
      '←→ para girar la nave',
      '↑ para impulsarse',
      'Espacio para disparar',
      'Gamepad: Stick + botón A',
    ],
    goal: 'Destruí asteroides con tu nave. Los grandes se parten en dos medianos, los medianos en dos chicos. No choques!',
    achievements: [
      { icon: '🚀', name: 'Cazador de asteroides', desc: 'Alcanzá los 1.000 puntos en Asteroids' },
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
    goal: 'Destruí oleadas de invasores espaciales antes de que lleguen a la base. Los invasores se aceleran al quedar menos.',
    achievements: [
      {
        icon: '👾',
        name: 'Invasión frustrada',
        desc: 'Alcanzá los 2.000 puntos en Space Invaders',
      },
    ],
  },
  'flappy-bird': {
    title: 'Flappy Bird',
    icon: '🐤',
    controls: ['Espacio / ↑ / tocar la pantalla para aletear', 'Gamepad: botón A para aletear'],
    goal: 'Volá esquivando tubos. Cada hueco que pasás suma un punto. ¡A ver cuánto durás!',
    achievements: [
      { icon: '🐤', name: 'Volador implacable', desc: 'Alcanzá 10 puntos en Flappy Bird' },
    ],
  },
  pacman: {
    title: 'Pac-Man',
    icon: '🟡',
    controls: ['Flechas ←→↑↓ para mover a Pac-Man', 'Gamepad: D-pad o stick direccional'],
    goal: 'Comé todos los puntos del laberinto esquivando a los fantasmas. Los power pellets te dejan comer fantasmas temporalmente.',
    achievements: [
      { icon: '🟡', name: 'Comecocos experto', desc: 'Alcanzá los 2.000 puntos en Pac-Man' },
    ],
  },
  tetris: {
    title: 'Tetris',
    icon: '🧊',
    controls: [
      '←→ para mover la pieza',
      '↑ para rotar',
      '↓ para bajar más rápido',
      'Espacio para caída directa',
      'C para guardar pieza',
      'Gamepad: D-pad + botones A/B',
    ],
    goal: 'Armá líneas completas con las 7 piezas que caen. Cada nivel aumenta la velocidad. El juego termina cuando las piezas llegan al tope.',
    achievements: [
      { icon: '🧊', name: 'Maestro del Tetris', desc: 'Alcanzá los 500 puntos en Tetris' },
    ],
  },
  frogger: {
    title: 'Frogger',
    icon: '🐸',
    controls: ['Flechas ←→↑↓ para mover a la rana', 'Gamepad: D-pad o stick'],
    goal: 'Cruzá la calle esquivando autos y camiones, después cruzá el río saltando sobre troncos y tortugas. Llegá a las 5 zonas seguras para ganar.',
    achievements: [
      { icon: '🐸', name: 'Cruzador de ríos', desc: 'Alcanzá los 1.000 puntos en Frogger' },
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
    goal: 'Destruí oleadas de invasores en formación. Algunos bajarán en picada en espiral. Sobreviví y sumá puntos.',
    achievements: [
      { icon: '🛸', name: 'Comandante estelar', desc: 'Alcanzá los 2.000 puntos en Galaga' },
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
    goal: 'Dispará al ciempiés mientras serpentea por el hongo. Cada segmento que destruyas se convierte en un hongo nuevo. Cuidado con la araña, pulgas y escorpiones.',
    achievements: [
      { icon: '🐛', name: 'Exterminador', desc: 'Alcanzá los 1.000 puntos en Centipede' },
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
    goal: 'Excavá túneles en la tierra. Inflá a los enemigos (Pooka y Fygar) hasta que exploten o derrumbá rocas sobre ellos. Agarrá frutas para puntos extra.',
    achievements: [
      { icon: '⛏️', name: 'Excavador implacable', desc: 'Alcanzá los 1.000 puntos en Dig Dug' },
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
    goal: 'Defendé tus 6 ciudades de los misiles enemigos. Lanzá misiles interceptores. Desde la oleada 2 aparecen misiles inteligentes, desde la 3 satélites.',
    achievements: [
      {
        icon: '🚀',
        name: 'Defensor de ciudades',
        desc: 'Alcanzá los 1.000 puntos en Missile Command',
      },
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
    goal: 'Defendé tu torre geométrica contra oleadas de formas neon. Elegí cartas de poder entre oleadas para construir tu build. Sobreviví el mayor tiempo posible en este tower defense roguelike.',
    achievements: [],
  },
  'cell-swarm': {
    title: 'Cell Swarm',
    icon: '🟣',
    controls: [
      'Mouse / deslizar para mover tu célula',
      'Espacio para dividirte (Split)',
      'E para eyectar masa (Eject)',
      'Gamepad: Stick para mover, A dividir, B eyectar',
    ],
    goal: 'Crece comiendo células más pequeñas y comida. Huí de las más grandes. Usá Split para cazar presas rápidas o escapar. Convertite en la célula más grande del mapa.',
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
    goal: 'Ayudá a Mario a escalar la obra en construcción. Esquivá los barriles que lanza Donkey Kong desde la cima, subí por las escaleras y llegá hasta el último nivel. Cada nivel completado suma puntos y avanza de ronda.',
    achievements: [
      { icon: '🪜', name: 'Escalador novato', desc: 'Completá tu primer nivel en Donkey Kong' },
      { icon: '🔥', name: 'Imparable', desc: 'Alcanzá los 5.000 puntos en Donkey Kong' },
      { icon: '🏆', name: 'Maestro de la obra', desc: 'Llegá al nivel 10 en Donkey Kong' },
    ],
  },
  defender: {
    title: 'Defender',
    icon: '🚀',
    controls: [
      '↑ ↓ ← → o WASD para mover la nave',
      'Espacio para disparar / empezar',
      'B para bomba inteligente',
      'R para reiniciar',
      'Gamepad: Stick mover, A disparar, B bomba',
    ],
    goal: 'Defendé a los humanos de la invasión alienígena. Dispará a los landers antes de que escapen con humanos. Usá bombas inteligentes para limpiar enemigos. Rescatá humanos caídos para sumar puntos y avanzar de nivel.',
    achievements: [
      { icon: '👽', name: 'Primera sangre', desc: 'Derrotá a tu primer enemigo en Defender' },
      { icon: '💣', name: 'Bombardero', desc: 'Usá 3 bombas inteligentes en Defender' },
      { icon: '🏆', name: 'Comandante galáctico', desc: 'Alcanzá los 10.000 puntos en Defender' },
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
    goal: 'Montá tu avestruz y derrotá a los jinetes enemigos en justas aéreas. Golpeá desde arriba para vencer — si el enemigo está más arriba que vos, perdés. Recolectá huevos para puntos extra antes de que eclosionen en nuevos enemigos. Sobreviví oleadas cada vez más difíciles con Bounders, Hunters y Shadow Lords.',
    achievements: [
      { icon: '🥇', name: 'Primera justa', desc: 'Derrotá a tu primer enemigo en Joust' },
      { icon: '🥚', name: 'Cazador de huevos', desc: 'Recolectá 10 huevos en Joust' },
      { icon: '🏆', name: 'Imbatible', desc: 'Llegá a la oleada 5 en Joust' },
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
  const achData = JSON.parse(localStorage.getItem('ach_data') || '{}');

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

      // Versión y fecha
      const infoRow = document.createElement('div');
      infoRow.style.cssText =
        "display:flex;align-items:center;justify-content:center;gap:12px;font-size:10px;font-family:'Orbitron',monospace;letter-spacing:1px;color:" +
        (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)');
      infoRow.innerHTML = `
        <span style="display:flex;align-items:center;gap:4px">📦 v${meta.version}</span>
        <span style="opacity:0.3">·</span>
        <span style="display:flex;align-items:center;gap:4px">📅 ${meta.created}</span>
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
            <div style="font-size:9px;font-family:'Orbitron',monospace;letter-spacing:1px;color:${isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'};margin-bottom:4px">v${entry.version} — ${entry.date}</div>
            <ul style="margin:0;padding:0 0 0 14px;list-style:none">
              ${entry.changes.map((c) => `<li style="font-size:10px;padding:1px 0;opacity:0.5;line-height:1.4"><span style="opacity:0.3;margin-right:4px">›</span>${c}</li>`).join('')}
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
