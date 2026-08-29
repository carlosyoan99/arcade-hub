/**
 * Manifiesto de juegos del hub.
 *
 * Para agregar un juego nuevo:
 *   1. Soltar su archivo .html autocontenido en /games/
 *   2. Agregar una entrada acá abajo
 *
 * status:
 *   'listo'         -> jugable, aparece con enlace activo
 *   'en-desarrollo' -> aparece en el hub pero sin enlace (placeholder)
 */

export const games = [
  {
    id: 'pong',
    title: 'Pong',
    description:
      'El clásico de tenis de mesa. Primero en llegar a 7 puntos gana. Con IA, partículas y soporte para teclado, táctil y mando.',
    file: 'games/pong/index.html',
    icon: '<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="6" r="4" fill="currentColor" stroke="none"/><path d="M8 22V18a4 4 0 0 1 8 0v4" fill="currentColor" stroke="none"/></svg></span>',
    thumbnail: './asset/icons/game-pong.svg',
    status: 'listo',
    created: '2026-06-01',
  },
  {
    id: 'breakout',
    title: 'Breakout',
    description:
      'Rompe todos los ladrillos con la pelota. 5 filas de colores con diferentes puntajes, niveles que se aceleran, y récord persistido.',
    file: 'games/breakout/index.html',
    icon: '<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="6" rx="1" fill="currentColor" stroke="none"/><rect x="3" y="11" width="12" height="6" rx="1" fill="currentColor" stroke="none"/></svg></span>',
    thumbnail: './asset/icons/game-breakout.svg',
    status: 'listo',
    created: '2026-06-03',
  },
  {
    id: 'snake',
    title: 'Snake',
    description:
      'El clásico de la serpiente. Atrapá la comida para crecer y sumar puntos sin chocarte contra las paredes ni contra vos mismo.',
    file: 'games/snake/index.html',
    icon: '<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12c0-4 4-8 8-8s8 4 8 8-4 4-8 4-4-4-4-4z" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.5" fill="var(--bg-mid, #0c0922)" stroke="none"/></svg></span>',
    thumbnail: './asset/icons/game-snake.svg',
    status: 'listo',
    created: '2026-06-05',
  },
  {
    id: 'dino-runner',
    title: 'Dino Runner',
    description:
      'Corré, saltá y agachate para esquivar cactus y pterodáctilos. La velocidad aumenta con el tiempo. ¿Cuánto podés durar?',
    file: 'games/dino-runner/index.html',
    icon: '<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 4h2v2H8zM6 6h2v4H6zM8 10h8v2H8zM16 6h2v4h-2zM18 4h2v2h-2z" fill="currentColor" stroke="none"/><path d="M6 14h2v6H6zM14 12h2v8h-2z" fill="currentColor" stroke="none"/></svg></span>',
    thumbnail: './asset/icons/game-dino-runner.svg',
    status: 'listo',
    created: '2026-06-08',
  },
  {
    id: 'asteroids',
    title: 'Asteroids',
    description:
      'Navegá por el espacio destruyendo asteroides. Los grandes se parten en medianos, los medianos en chicos. ¡A sobrevivir!',
    file: 'games/asteroids/index.html',
    icon: '<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3 2 4-1 2 4 1 4-2 3 1 4-4 2-3 1-4-2-4 2-3-1-1-4 2-3-1-4 2-4 4-1z" fill="currentColor" stroke="none"/></svg></span>',
    thumbnail: './asset/icons/game-asteroids.svg',
    status: 'listo',
    created: '2026-06-10',
  },
  {
    id: 'space-invaders',
    title: 'Space Invaders',
    description:
      'Destruí oleadas de invasores espaciales antes de que lleguen a la base. Escudos, nave misteriosa y velocidad progresiva.',
    file: 'games/space-invaders/index.html',
    icon: '<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="6" width="8" height="14" rx="4" fill="currentColor" stroke="none"/><circle cx="10" cy="11" r="1" fill="var(--bg-mid, #0c0922)" stroke="none"/><circle cx="14" cy="11" r="1" fill="var(--bg-mid, #0c0922)" stroke="none"/><path d="M6 6l-3-3M18 6l3-3M6 13l-3 2M18 13l3 2M6 17l-3 1M18 17l3 1"/></svg></span>',
    thumbnail: './asset/icons/game-space-invaders.svg',
    status: 'listo',
    created: '2026-06-12',
  },
  {
    id: 'flappy-bird',
    title: 'Flappy Bird',
    description:
      'Volá esquivando tubos. Tocá la pantalla o presioná Espacio para aletear. ¡A ver cuánto durás!',
    file: 'games/flappy-bird/index.html',
    icon: '<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10a4 4 0 0 0-8 0c0 3-2 5-5 6 4 2 7 1 9 0 1 2 4 2 6 0-1-2-2-4-2-6z" fill="currentColor" stroke="none"/></svg></span>',
    thumbnail: './asset/icons/game-flappy-bird.svg',
    status: 'listo',
    created: '2026-06-15',
  },
  {
    id: 'pacman',
    title: 'Pac-Man',
    description:
      'Comé todos los puntos del laberinto esquivando a los fantasmas. Power pellets te dejan comer fantasmas. ¡4 IAs distintas!',
    file: 'games/pacman/index.html',
    icon: '<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 4a6 6 0 0 0-6 6v8h12v-8a6 6 0 0 0-6-6z" fill="currentColor" stroke="none"/><path d="M6 18l-1 4 3-3 3 3 3-3 3 3 3-3 1 4" stroke-width="1.5"/><circle cx="9.5" cy="10" r="1.5" fill="var(--bg-mid, #0c0922)" stroke="none"/><circle cx="14.5" cy="10" r="1.5" fill="var(--bg-mid, #0c0922)" stroke="none"/></svg></span>',
    thumbnail: './asset/icons/game-pacman.svg',
    status: 'listo',
    created: '2026-06-18',
  },
  {
    id: 'tetris',
    title: 'Tetris',
    description:
      'Armá líneas con las 7 piezas que caen. Rotación, ghost piece, niveles progresivos. ¡Clásico infinito!',
    file: 'games/tetris/index.html',
    icon: '<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l8 4.5v11L12 22l-8-4.5v-11z" fill="currentColor" stroke="none"/><path d="M12 12l8-4.5M12 12l-8-4.5M12 12v10" stroke-width="1.5"/></svg></span>',
    thumbnail: './asset/icons/game-tetris.svg',
    status: 'listo',
    created: '2026-06-20',
  },
  {
    id: 'frogger',
    title: 'Frogger',
    description:
      'Cruzá la calle y el río esquivando autos, camiones y cayendo al agua. ¡Llegá a las 5 zonas seguras!',
    file: 'games/frogger/index.html',
    icon: '<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="14" rx="8" ry="6" fill="currentColor" stroke="none"/><circle cx="8" cy="9" r="3" fill="currentColor" stroke="none"/><circle cx="16" cy="9" r="3" fill="currentColor" stroke="none"/><circle cx="8" cy="9" r="1.2" fill="var(--bg-mid, #0c0922)" stroke="none"/><circle cx="16" cy="9" r="1.2" fill="var(--bg-mid, #0c0922)" stroke="none"/></svg></span>',
    thumbnail: './asset/icons/game-frogger.svg',
    status: 'listo',
    created: '2026-06-22',
  },
  {
    id: 'galaga',
    title: 'Galaga',
    description:
      'Destruí oleadas de invasores en formación. Esquivá sus picados en espiral y sobreviví el mayor tiempo posible.',
    file: 'games/galaga/index.html',
    icon: '<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="12" rx="10" ry="4" fill="currentColor" stroke="none"/><circle cx="12" cy="8" r="4" fill="currentColor" stroke="none"/><circle cx="12" cy="8" r="2" fill="var(--bg-mid, #0c0922)" stroke="none"/><circle cx="6" cy="13" r="1.5" fill="currentColor" stroke="none"/><circle cx="18" cy="13" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="14" r="1.5" fill="currentColor" stroke="none"/></svg></span>',
    thumbnail: './asset/icons/game-galaga.svg',
    status: 'listo',
    created: '2026-07-15',
  },
  {
    id: 'centipede',
    title: 'Centipede',
    description:
      'Dispará al ciempiés mientras serpentea por el hongo. Cada segmento que destruyas se convierte en un hongo nuevo. ¡Cuidado con la araña saltarina!',
    file: 'games/centipede/index.html',
    icon: '<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="12" rx="4" ry="8" fill="currentColor" stroke="none"/><circle cx="12" cy="4" r="2.5" fill="currentColor" stroke="none"/><line x1="8" y1="8" x2="3" y2="6"/><line x1="16" y1="8" x2="21" y2="6"/><line x1="8" y1="12" x2="3" y2="12"/><line x1="16" y1="12" x2="21" y2="12"/><line x1="8" y1="16" x2="3" y2="18"/><line x1="16" y1="16" x2="21" y2="18"/></svg></span>',
    thumbnail: './asset/icons/game-centipede.svg',
    status: 'listo',
    created: '2026-07-20',
  },
  {
    id: 'digdug',
    title: 'Dig Dug',
    description:
      'Excavá túneles en la tierra, inflá a los enemigos hasta que exploten o derrumbá rocas sobre ellos. Dos tipos de enemigos con IA propia.',
    file: 'games/digdug/index.html',
    icon: '<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 18l4-4M14 8l4-4M10 14l-4 4" stroke-width="3"/><circle cx="18" cy="4" r="2" fill="currentColor" stroke="none"/></svg></span>',
    thumbnail: './asset/icons/game-digdug.svg',
    status: 'listo',
    created: '2026-07-25',
  },
  {
    id: 'missile-command',
    title: 'Missile Command',
    description:
      'Defendé tus ciudades de misiles enemigos. Apuntá con el mouse o el stick y dispará interceptores. Misiles inteligentes y satélites desde la oleada 2.',
    file: 'games/missile-command/index.html',
    icon: '<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg></span>',
    thumbnail: './asset/icons/game-missile-command.svg',
    status: 'listo',
    created: '2026-07-28',
  },
  {
    id: 'neon-nexus',
    title: 'Neon Nexus',
    description:
      'Defiende tu torre geométrica contra oleadas de formas neon. Torre auto-dispara, haz clic para daño extra, mejora con estrellas y elige cartas de poder entre oleadas. ¡Roguelike!',
    file: 'games/neon-nexus/index.html',
    icon: '<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 12c0-2 2-4 4-4s4 2 4 4-2 6-6 6-8-2-8-6 2-8 6-8 10 2 10 6-2 8-6 8"/></svg></span>',
    thumbnail: './asset/icons/game-neon-nexus.svg',
    status: 'listo',
    created: '2026-07-28',
  },
  {
    id: 'cell-swarm',
    title: 'Cell Swarm',
    description:
      'Battle royale de células neón. Crece comiendo comida y células más pequeñas, divide tu masa para cazar, eyecta para distraer. ¡Conviértete en la célula más grande del mapa!',
    file: 'games/cell-swarm/index.html',
    icon: '<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="12" r="4" fill="currentColor" stroke="none"/><circle cx="16" cy="8" r="3" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r="3" fill="currentColor" stroke="none"/><line x1="12" y1="12" x2="13" y2="10" stroke-width="1.5"/><line x1="12" y1="12" x2="13" y2="14" stroke-width="1.5"/></svg></span>',
    thumbnail: './asset/icons/game-cell-swarm.svg',
    status: 'listo',
    created: '2026-07-28',
  },
  {
    id: 'donkey-kong',
    title: 'Donkey Kong',
    description:
      'Ayudá a Mario a escalar la obra en construcción. Esquivá los barriles que lanza Donkey Kong y llegá hasta la cima. ¡Plataformas clásico!',
    file: 'games/donkey-kong/index.html',
    icon: '<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 4l-8 8 4 4 8-8z" fill="currentColor" stroke="none"/><path d="M10 16l-6 6" stroke-width="2.5"/></svg></span>',
    thumbnail: './asset/icons/game-donkey-kong.svg',
    status: 'listo',
    created: '2026-07-28',
  },
  {
    id: 'defender',
    title: 'Defender',
    description:
      'Side-scrolling shooter. Volá sobre montañas, dispará a los landers que secuestran humanos, usá bombas inteligentes y rescatá a todos en este clásico frenético.',
    file: 'games/defender/index.html',
    icon: '<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="currentColor" stroke="none"/></svg></span>',
    thumbnail: './asset/icons/game-defender.svg',
    status: 'listo',
    created: '2026-07-28',
  },
  {
    id: 'joust',
    title: 'Joust',
    description:
      'Montá tu avestruz y derrotá a los jinetes enemigos en justas aéreas. Golpeá desde arriba para vencer, recolectá huevos y sobreviví oleadas cada vez más difíciles.',
    file: 'games/joust/index.html',
    icon: '<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 14c0-4 4-8 8-10 4 2 8 6 8 10-4 0-6-2-8-2s-4 2-8 2z" fill="currentColor" stroke="none"/><circle cx="10" cy="12" r="1" fill="var(--bg-mid, #0c0922)" stroke="none"/></svg></span>',
    thumbnail: './asset/icons/game-joust.svg',
    status: 'listo',
    created: '2026-07-29',
  },
  {
    id: 'columns',
    title: 'Columns',
    description:
      'Puzzle de gemas. Armá combinaciones de 3+ gemas del mismo color para eliminarlas. Nivel progresivo y ghost piece.',
    file: 'games/columns/index.html',
    icon: '<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3h12l4 6-10 13L2 9z" fill="currentColor" stroke="none"/><path d="M2 9h20" stroke-width="1.5"/><path d="M12 22L6 9l6-6 6 6-6 13z"/></svg></span>',
    thumbnail: './asset/icons/game-columns.svg',
    status: 'listo',
    created: '2026-08-28',
  },
  {
    id: 'pole-position',
    title: 'Pole Position',
    description:
      'Racing top-down. Calificá en menos de 35 segundos y ganá la carrera de 3 vueltas contra 8 rivales con turbo.',
    file: 'games/pole-position/index.html',
    icon: '<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 17h14v-5l-2-5H7L5 12v5z" fill="currentColor" stroke="none"/><rect x="7" y="10" width="4" height="3" rx="1" fill="var(--bg-mid, #0c0922)" stroke="none"/><rect x="13" y="10" width="4" height="3" rx="1" fill="var(--bg-mid, #0c0922)" stroke="none"/><circle cx="8" cy="17" r="2" fill="currentColor" stroke="none"/><circle cx="16" cy="17" r="2" fill="currentColor" stroke="none"/></svg></span>',
    thumbnail: './asset/icons/game-pole-position.svg',
    status: 'listo',
    created: '2026-08-28',
  },
  {
    id: 'moon-patrol',
    title: 'Moon Patrol',
    description:
      'Side-scroll lunar shooter. Patrullá la luna esquivando cráteres y destruyendo enemigos con disparos hacia adelante y hacia arriba.',
    file: 'games/moon-patrol/index.html',
    icon: '<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="currentColor" stroke="none"/></svg></span>',
    thumbnail: './asset/icons/game-moon-patrol.svg',
    status: 'listo',
    created: '2026-08-28',
  },
  {
    id: 'tempest',
    title: 'Tempest',
    description:
      'Tube shooter de 16 lados. Dispará a los enemigos que suben por el tubo y usá jump para esquivar.',
    file: 'games/tempest/index.html',
    icon: '<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg></span>',
    thumbnail: './asset/icons/game-tempest.svg',
    status: 'listo',
    created: '2026-08-28',
  },
  {
    id: 'bomberman',
    title: 'Bomberman',
    description:
      'Maze action. Destruí muros con bombas, juntá power-ups y eliminá a todos los enemigos para abrir la puerta del siguiente nivel.',
    file: 'games/bomberman/index.html',
    icon: '<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="14" r="7" fill="currentColor" stroke="none"/><circle cx="10" cy="12" r="2" fill="var(--bg-mid, #0c0922)" stroke="none"/><path d="M16 4l2-2" stroke-width="2.5"/><circle cx="18" cy="2" r="1" fill="currentColor" stroke="none"/></svg></span>',
    thumbnail: './asset/icons/game-bomberman.svg',
    status: 'listo',
    created: '2026-08-28',
  },
  {
    id: 'raiden',
    title: 'Raiden',
    description:
      'Vertical shmup. Destruí oleadas y derrotá al jefe de cada uno de los 7 sectores. Elegí tu arma al inicio de cada ronda.',
    file: 'games/raiden/index.html',
    icon: '<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/></svg></span>',
    thumbnail: './asset/icons/game-raiden.svg',
    status: 'listo',
    created: '2026-08-28',
  },
  {
    id: 'gradius',
    title: 'Gradius',
    description:
      'Side-scroll shooter. Juntá cápsulas para potenciar la nave (speed, missile, double, option, shield) y derrotá a los 7 jefes.',
    file: 'games/gradius/index.html',
    icon: '<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="12" rx="10" ry="4" fill="currentColor" stroke="none"/><circle cx="12" cy="8" r="4" fill="currentColor" stroke="none"/><circle cx="12" cy="8" r="2" fill="var(--bg-mid, #0c0922)" stroke="none"/><circle cx="6" cy="13" r="1.5" fill="currentColor" stroke="none"/><circle cx="18" cy="13" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="14" r="1.5" fill="currentColor" stroke="none"/></svg></span>',
    thumbnail: './asset/icons/game-gradius.svg',
    status: 'listo',
    created: '2026-08-28',
  },
  {
    id: 'qbert',
    title: 'Q*bert',
    description:
      'Acción/puzzle isométrico. Saltá sobre los cubos de la pirámide para cambiarles el color y completá cada nivel esquivando a Coily.',
    file: 'games/qbert/index.html',
    icon: '<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l8 5v10l-8 5-8-5V7z" fill="currentColor" stroke="none"/><path d="M12 12l8-5M12 12l-8-5" stroke-width="1.5"/><circle cx="12" cy="12" r="2" fill="var(--bg-mid, #0c0922)" stroke="none"/></svg></span>',
    thumbnail: './asset/icons/game-qbert.svg',
    status: 'listo',
    created: '2026-08-28',
  },
  {
    id: 'double-dragon',
    title: 'Double Dragon',
    description: 'Beat em up. 4 actos, combos, armas y boss final.',
    file: 'games/double-dragon/index.html',
    icon: '<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 11V6a2 2 0 0 0-4 0v1M14 10V4a2 2 0 0 0-4 0v6M10 10V6a2 2 0 0 0-4 0v8l-1.2-2.4a1.5 1.5 0 0 0-2.6 1.5L4 22h16l2-8a2 2 0 0 0-2-2h-2z" fill="currentColor" stroke="none"/></svg></span>',
    thumbnail: './asset/icons/game-double-dragon.svg',
    status: 'listo',
    created: '2026-08-28',
  },
  {
    id: 'burger-time',
    title: 'BurgerTime',
    description: 'Plataformas y cooking. Caminá sobre ingredientes para armar burgers.',
    file: 'games/burger-time/index.html',
    icon: '<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 22h20L12 2z" fill="currentColor" stroke="none"/><circle cx="10" cy="16" r="1.5" fill="var(--bg-mid, #0c0922)" stroke="none"/><circle cx="14" cy="13" r="1.5" fill="var(--bg-mid, #0c0922)" stroke="none"/></svg></span>',
    thumbnail: './asset/icons/game-burger-time.svg',
    status: 'listo',
    created: '2026-08-28',
  },
  {
    id: 'paperboy',
    title: 'Paperboy',
    description: 'Side-scroll delivery. Entregá periódicos y esquivá obstáculos.',
    file: 'games/paperboy/index.html',
    icon: '<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v16H4z" fill="currentColor" stroke="none"/><line x1="7" y1="8" x2="17" y2="8" stroke="var(--bg-mid, #0c0922)" stroke-width="1.5"/><line x1="7" y1="11" x2="17" y2="11" stroke="var(--bg-mid, #0c0922)" stroke-width="1"/><line x1="7" y1="14" x2="12" y2="14" stroke="var(--bg-mid, #0c0922)" stroke-width="1"/><line x1="7" y1="17" x2="14" y2="17" stroke="var(--bg-mid, #0c0922)" stroke-width="1"/></svg></span>',
    thumbnail: './asset/icons/game-paperboy.svg',
    status: 'listo',
    created: '2026-08-28',
  },
  {
    id: 'puyo-puyo',
    title: 'Puyo Puyo',
    description: 'Puzzle competitivo. Cadenas de puyos + modo vs CPU.',
    file: 'games/puyo-puyo/index.html',
    icon: '<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="12" r="4" fill="currentColor" stroke="none"/><circle cx="16" cy="8" r="3" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r="3" fill="currentColor" stroke="none"/><line x1="12" y1="12" x2="13" y2="10" stroke-width="1.5"/><line x1="12" y1="12" x2="13" y2="14" stroke-width="1.5"/></svg></span>',
    thumbnail: './asset/icons/game-puyo-puyo.svg',
    status: 'listo',
    created: '2026-08-28',
  },
  {
    id: 'out-run',
    title: 'Out Run',
    description: 'Racing pseudo-3D. Highway con perspective, turbo, 5 stages.',
    file: 'games/out-run/index.html',
    icon: '<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 17h14v-5l-2-5H7L5 12v5z" fill="currentColor" stroke="none"/><rect x="7" y="10" width="4" height="3" rx="1" fill="var(--bg-mid, #0c0922)" stroke="none"/><rect x="13" y="10" width="4" height="3" rx="1" fill="var(--bg-mid, #0c0922)" stroke="none"/><circle cx="8" cy="17" r="2" fill="currentColor" stroke="none"/><circle cx="16" cy="17" r="2" fill="currentColor" stroke="none"/></svg></span>',
    thumbnail: './asset/icons/game-out-run.svg',
    status: 'listo',
    created: '2026-08-28',
  },
];
