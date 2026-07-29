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
    icon: '🏓',
    status: 'listo',
  },
  {
    id: 'breakout',
    title: 'Breakout',
    description:
      'Rompe todos los ladrillos con la pelota. 5 filas de colores con diferentes puntajes, niveles que se aceleran, y récord persistido.',
    file: 'games/breakout/index.html',
    icon: '🧱',
    status: 'listo',
  },
  {
    id: 'snake',
    title: 'Snake',
    description:
      'El clásico de la serpiente. Atrapá la comida para crecer y sumar puntos sin chocarte contra las paredes ni contra vos mismo.',
    file: 'games/snake/index.html',
    icon: '🐍',
    status: 'listo',
  },
  {
    id: 'dino-runner',
    title: 'Dino Runner',
    description:
      'Corré, saltá y agachate para esquivar cactus y pterodáctilos. La velocidad aumenta con el tiempo. ¿Cuánto podés durar?',
    file: 'games/dino-runner/index.html',
    icon: '🦖',
    status: 'listo',
  },
  {
    id: 'asteroids',
    title: 'Asteroids',
    description:
      'Navegá por el espacio destruyendo asteroides. Los grandes se parten en medianos, los medianos en chicos. ¡A sobrevivir!',
    file: 'games/asteroids/index.html',
    icon: '🚀',
    status: 'listo',
  },
  {
    id: 'space-invaders',
    title: 'Space Invaders',
    description:
      'Destruí oleadas de invasores espaciales antes de que lleguen a la base. Escudos, nave misteriosa y velocidad progresiva.',
    file: 'games/space-invaders/index.html',
    icon: '👾',
    status: 'listo',
  },
  {
    id: 'flappy-bird',
    title: 'Flappy Bird',
    description:
      'Volá esquivando tubos. Tocá la pantalla o presioná Espacio para aletear. ¡A ver cuánto durás!',
    file: 'games/flappy-bird/index.html',
    icon: '🐤',
    status: 'listo',
  },
  {
    id: 'pacman',
    title: 'Pac-Man',
    description:
      'Comé todos los puntos del laberinto esquivando a los fantasmas. Power pellets te dejan comer fantasmas. ¡4 IAs distintas!',
    file: 'games/pacman/index.html',
    icon: '🟡',
    status: 'listo',
  },
  {
    id: 'tetris',
    title: 'Tetris',
    description:
      'Armá líneas con las 7 piezas que caen. Rotación, ghost piece, niveles progresivos. ¡Clásico infinito!',
    file: 'games/tetris/index.html',
    icon: '🧊',
    status: 'listo',
  },
  {
    id: 'frogger',
    title: 'Frogger',
    description:
      'Cruzá la calle y el río esquivando autos, camiones y cayendo al agua. ¡Llegá a las 5 zonas seguras!',
    file: 'games/frogger/index.html',
    icon: '🐸',
    status: 'listo',
  },
  {
    id: 'galaga',
    title: 'Galaga',
    description:
      'Destruí oleadas de invasores en formación. Esquivá sus picados en espiral y sobreviví el mayor tiempo posible.',
    file: 'games/galaga/index.html',
    icon: '🛸',
    status: 'listo',
  },
  {
    id: 'centipede',
    title: 'Centipede',
    description:
      'Dispará al ciempiés mientras serpentea por el hongo. Cada segmento que destruyas se convierte en un hongo nuevo. ¡Cuidado con la araña saltarina!',
    file: 'games/centipede/index.html',
    icon: '🐛',
    status: 'listo',
  },
  {
    id: 'digdug',
    title: 'Dig Dug',
    description:
      'Excavá túneles en la tierra, inflá a los enemigos hasta que exploten o derrumbá rocas sobre ellos. Dos tipos de enemigos con IA propia.',
    file: 'games/digdug/index.html',
    icon: '⛏️',
    status: 'listo',
  },
  {
    id: 'missile-command',
    title: 'Missile Command',
    description:
      'Defendé tus ciudades de misiles enemigos. Apuntá con el mouse o el stick y dispará interceptores. Misiles inteligentes y satélites desde la oleada 2.',
    file: 'games/missile-command/index.html',
    icon: '🚀',
    status: 'listo',
  },
  {
    id: 'neon-nexus',
    title: 'Neon Nexus',
    description:
      'Defiende tu torre geométrica contra oleadas de formas neon. Torre auto-dispara, haz clic para daño extra, mejora con estrellas y elige cartas de poder entre oleadas. ¡Roguelike!',
    file: 'games/neon-nexus/index.html',
    icon: '◈',
    status: 'listo',
  },
  {
    id: 'cell-swarm',
    title: 'Cell Swarm',
    description:
      'Battle royale de células neón. Crece comiendo comida y células más pequeñas, divide tu masa para cazar, eyecta para distraer. ¡Conviértete en la célula más grande del mapa!',
    file: 'games/cell-swarm/index.html',
    icon: '🟣',
    status: 'listo',
  },
];
