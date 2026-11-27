import { createLoop } from '../src/core/loop.js';
import type { ActionName } from '../src/core/types.js';
import type { GameDefinition } from '../src/game/contract.js';
import { createDifficultySimulation, type Difficulty } from '../src/ai/difficulty.js';
import { createBindings } from '../src/input/bindings.js';
import { createInputHost, type InputHost } from '../src/input/host.js';
import { audioPlugin } from '../src/audio/manager.js';
import { eventFanoutPlugin } from '../src/render/event-fanout.js';
import { particlesPlugin, PARTICLES_SERVICE, type ParticleSystem } from '../src/render/particles.js';
import { createCanvasRenderer, type CanvasRenderer } from '../src/render/canvas2d.js';
import { captureThumbnail } from '../src/render/thumbnail.js';
import { findGame, GAMES } from '../src/games/index.js';
import { createStorage } from '../src/store/storage.js';
import {
  bindingsFor,
  DEFAULT_SEED,
  filterGames,
  gamepadButtonsFor,
  gameCard,
  isTheme,
  nextTheme,
  parseRoute,
  routeFor,
  tapActionFor,
  touchActionsFor,
  THEME_SCHEMA,
  type Theme,
} from '../src/ui/hub-model.js';

function el<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`Falta el elemento ${selector}`);
  return found;
}

const shelf = el<HTMLElement>('#shelf');
const grid = el<HTMLUListElement>('#grid');
const count = el<HTMLElement>('#count');
const empty = el<HTMLElement>('#empty');
const search = el<HTMLInputElement>('#search');
const stage = el<HTMLElement>('#stage');
const stageTitle = el<HTMLHeadingElement>('#stage-title');
const back = el<HTMLButtonElement>('#back');
const fullscreenButton = el<HTMLButtonElement>('#fullscreen');
const themeButton = el<HTMLButtonElement>('#theme');
const seedOutput = el<HTMLOutputElement>('#seed');
const copySeedButton = el<HTMLButtonElement>('#copy-seed');
const hashOutput = el<HTMLOutputElement>('#hash');
const actionsOutput = el<HTMLOutputElement>('#actions');
const touchContainer = el<HTMLElement>('#touch-actions');
const hint = el<HTMLElement>('#hint');
const status = el<HTMLElement>('#status');
const results = el<HTMLElement>('#results');
const difficultySelect = el<HTMLSelectElement>('#difficulty');
const canvas = el<HTMLCanvasElement>('#screen');

const presentationPlugins = [eventFanoutPlugin(), particlesPlugin(), audioPlugin()];

/**
 * Mundo lógico de la vista. Coincide con el lienzo de `captureThumbnail`, así
 * que la partida y las miniaturas comparten el mismo sistema de coordenadas.
 * `createCanvasRenderer` aplica `computeLetterbox` a este mundo.
 */
const WORLD = { width: 1024, height: 700 } as const;
const THEME_LABELS: Readonly<Record<Theme, string>> = {
  dark: 'Oscuro',
  light: 'Claro',
  retro: 'Retro',
};

/** Etiquetas de ayuda derivadas de `game.actions` (más P/R/F comunes). */
const ACTION_LABELS: Readonly<Record<string, string>> = {
  left: '←/A izq.',
  right: '→/D der.',
  up: '↑/W arriba',
  down: '↓/S abajo',
  p1Up: '↑ jug. 1',
  p1Down: '↓ jug. 1',
  p2Up: '↑ jug. 2',
  p2Down: '↓ jug. 2',
  upLeft: '↑← diagonal',
  upRight: '↑→ diagonal',
  downLeft: '↓← diagonal',
  downRight: '↓→ diagonal',
  aimLeft: '← mirilla',
  aimRight: '→ mirilla',
  aimUp: '↑ mirilla',
  aimDown: '↓ mirilla',
  primary: 'Espacio acción',
  serve: 'Espacio sacar',
  fire: 'Espacio disparar',
  flap: 'Espacio aletear',
  jump: 'Espacio saltar',
  launch: 'Espacio lanzar',
  throw: 'Espacio lanzar',
  pepper: 'Espacio drogar',
  pump: 'Espacio bombar',
  rotate: 'Z girar',
  rotateCCW: 'Z girar',
  hardDrop: 'Espacio caer',
  softDrop: '↓ bajar',
  accel: '↑ acelerar',
  brake: '↓ frenar',
  turbo: 'Espacio turbo',
  hold: 'C retener',
  duck: '↓ agachar',
  bomb: 'B bomba',
  hyperspace: 'H hiperespacio',
  nuclear: 'N nuclear',
  punch: 'Z puñetazo',
  kick: 'X patada',
  combo: 'C combinación',
  card1: '1 carta 1',
  card2: '2 carta 2',
  card3: '3 carta 3',
  eject: 'E expulsar',
  split: 'Espacio dividir',
  boost: 'Q impulso',
  upgradeAtk: '4 mejorar ataque',
  upgradeHp: '5 mejorar vida',
  upgradeSpd: '6 mejorar velocidad',
  shop: 'B tienda',
  buyMaxHp: '7 comprar vida máxima',
  buyAtkBonus: '8 comprar ataque',
  buyStartShield: '9 comprar escudo',
  buyRegenBonus: '0 comprar regen',
  closeShop: 'C cerrar tienda',
  confirm: 'Enter confirmar',
};

/**
 * Botones en pantalla para juegos donde un solo tap no alcanza todas las
 * acciones (Cell Swarm y Q*bert). Escriben en `ActionState`, la misma vía que
 * teclado, mando y puntero; no contienen lógica de juego.
 */
function renderTouchActions(game: GameDefinition<object>): void {
  const buttons = touchActionsFor(game).map(({ action, label }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'touch-action';
    button.dataset.action = action;
    button.setAttribute('aria-label', `Acción ${label}`);
    button.textContent = label;

    const set = (down: boolean): void => {
      if (simulation.actions.registered.includes(action)) simulation.actions.setDown(action, down);
    };
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      set(true);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      button.addEventListener(type, () => set(false));
    }
    return button;
  });
  touchContainer.replaceChildren(...buttons);
}

function controlsFor(game: GameDefinition<object>): string {
  const parts = game.actions
    .filter((action) => action !== 'pause' && action !== 'restart')
    .map((action) => ACTION_LABELS[action] ?? action.replace(/([A-Z])/g, ' $1').toLowerCase());
  const base = parts.length > 0 ? parts.join(' · ') : 'Teclado, gamepad o táctil';
  return `${base} · P pausa · R reinicio · F pantalla completa`;
}

function thumbFor(game: GameDefinition<object>): HTMLImageElement | null {
  const image = document.createElement('img');
  image.className = 'card__thumb';
  image.alt = game.meta.title;
  image.decoding = 'async';
  try {
    const source = captureThumbnail(game, {
      seed: DEFAULT_SEED,
      tick: 12,
      width: 320,
      height: 200,
    });
    if (!source.startsWith('data:image/')) throw new Error('Captura vacía');
    image.src = source;
    return image;
  } catch {
    return null;
  }
}

function cardElement(game: GameDefinition<object>, index: number): HTMLLIElement {
  const card = gameCard(game);
  const item = document.createElement('li');
  const link = document.createElement('a');
  link.className = 'card';
  link.href = routeFor(card.id);
  link.setAttribute('aria-label', `${card.title}. ${card.label}`);
  link.style.setProperty('--i', String(index));

  const number = document.createElement('span');
  number.className = 'card__n';
  number.textContent = String(GAMES.indexOf(game) + 1).padStart(2, '0');

  const thumb = thumbFor(game);
  if (thumb !== null) {
    link.append(number, thumb);
  } else {
    const fallback = document.createElement('span');
    fallback.className = 'card__fallback';
    fallback.textContent = `${card.title} · vista previa no disponible`;
    link.append(number, fallback);
  }

  const title = document.createElement('span');
  title.className = 'card__title';
  title.textContent = card.title;

  const meta = document.createElement('span');
  meta.className = 'card__meta';
  meta.textContent = card.label;

  link.append(title, meta);
  item.append(link);
  return item;
}

function renderGrid(query: string): void {
  const games = filterGames(GAMES, query);
  const cards = games.map((game, index) => cardElement(game, index));
  grid.replaceChildren(...cards);
  count.textContent = `${games.length} títulos`;
  empty.hidden = games.length > 0;
  results.textContent = `${games.length} ${games.length === 1 ? 'juego' : 'juegos'} encontrados`;
}

const DIFFICULTY_LABELS: Readonly<Record<Difficulty, string>> = {
  easy: 'Fácil',
  normal: 'Normal',
  hard: 'Difícil',
};

function parseDifficulty(value: string): Difficulty {
  return value === 'easy' || value === 'hard' ? value : 'normal';
}

// Persistencia versionada del tema; el script inline de index.html evita FOUC.
const storage = createStorage();

function initialTheme(): Theme {
  const fromDom = document.documentElement.dataset.theme;
  if (isTheme(fromDom)) return fromDom;
  const saved = storage.load(THEME_SCHEMA);
  if (saved !== null) return saved;
  try {
    return globalThis.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

let theme = initialTheme();

function applyTheme(next: Theme, announce = false): void {
  theme = next;
  document.documentElement.dataset.theme = next;
  themeButton.textContent = `Tema: ${THEME_LABELS[next]}`;
  themeButton.setAttribute('aria-label', `Cambiar tema. Tema actual: ${THEME_LABELS[next]}`);
  storage.save(THEME_SCHEMA, next);
  if (announce) status.textContent = `Tema ${THEME_LABELS[next]} activado`;
}

let current: GameDefinition<object> | undefined;
let difficulty: Difficulty = parseDifficulty(difficultySelect.value);
let activeSeed = DEFAULT_SEED;
let simulation = createDifficultySimulation(findGame('pong')!, {
  seed: activeSeed,
  difficulty,
  plugins: presentationPlugins,
});
let renderer: CanvasRenderer | undefined;
let host: InputHost | undefined;
let paused = false;
let lastTick = 0;
/** Acciones de gestos que el host no conoce (double tap táctil), de un tick. */
let queuedActions: ActionName[] = [];

const loop = createLoop({
  get simulation() {
    return simulation;
  },
  getInputs: () => {
    host?.poll(simulation.clock.tick);
    const frame = host?.frame();
    const queued = queuedActions;
    queuedActions = [];
    const actions: ActionName[] = [...(frame?.actions ?? []), ...queued];
    const pressed = actions.join(' ');
    if (actionsOutput.textContent !== pressed) actionsOutput.textContent = pressed;
    if (frame === undefined && queued.length === 0) return [];
    // El host normaliza al canvas; el letterbox convierte a coordenadas del
    // mundo antes de escribir el puntero virtual en la cinta del tick.
    if (frame?.pointer !== undefined) {
      const view = renderer;
      const { x, y, active } = frame.pointer;
      if (view !== undefined) {
        const world = view.toWorld(x * view.viewWidth, y * view.viewHeight);
        const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
        simulation.actions.setPointer(
          clamp01(world.x / view.worldWidth),
          clamp01(world.y / view.worldHeight),
          active,
        );
      }
    }
    return actions;
  },
  render: () => paint(),
});

function drawWithoutRender(target: CanvasRenderingContext2D): void {
  target.fillStyle = '#080a12';
  target.fillRect(0, 0, WORLD.width, WORLD.height);
  target.fillStyle = '#9aa3bd';
  target.font = '15px ui-monospace, monospace';
  target.textAlign = 'center';
  target.fillText('Este juego corre en modo lógica; render en preparación.', WORLD.width / 2, WORLD.height / 2);
  target.textAlign = 'left';
}

function paint(): void {
  if (renderer === undefined) return;
  const steps = simulation.clock.tick - lastTick;
  if (steps > 0 && simulation.services.has(PARTICLES_SERVICE)) {
    simulation.services.get<ParticleSystem>(PARTICLES_SERVICE).update(steps);
    lastTick = simulation.clock.tick;
  }

  renderer.begin();
  if (current?.render) current.render(renderer.ctx, simulation.state, loop.alpha);
  else drawWithoutRender(renderer.ctx);
  if (simulation.services.has(PARTICLES_SERVICE)) {
    simulation.services.get<ParticleSystem>(PARTICLES_SERVICE).draw(renderer.ctx);
  }
  renderer.end();
  hashOutput.textContent = simulation.hash();
}

function updateLetterboxData(): void {
  if (renderer === undefined) return;
  const box = renderer.letterbox;
  canvas.dataset.worldWidth = String(renderer.worldWidth);
  canvas.dataset.worldHeight = String(renderer.worldHeight);
  canvas.dataset.viewport = `${renderer.viewWidth}x${renderer.viewHeight}`;
  canvas.dataset.letterbox = JSON.stringify({
    scale: box.scale,
    x: box.css.x,
    y: box.css.y,
    width: box.css.width,
    height: box.css.height,
  });
}

function refreshViewport(): void {
  if (renderer === undefined) return;
  renderer.resize();
  updateLetterboxData();
  paint();
}

function ensureLoop(): void {
  if (loop.isRunning) {
    if (loop.isPaused) loop.resume();
  } else {
    loop.start();
  }
}

function showHub(message = 'Vitrina de juegos'): void {
  host?.detach();
  host = undefined;
  renderer = undefined;
  current = undefined;
  paused = false;
  queuedActions = [];
  loop.stop();
  touchContainer.replaceChildren();
  actionsOutput.textContent = '';
  if (document.fullscreenElement !== null) void document.exitFullscreen().catch(() => undefined);
  stage.hidden = true;
  shelf.hidden = false;
  document.title = `Arcade Engine · ${GAMES.length} juegos`;
  status.textContent = message;
}

function mount(game: GameDefinition<object>, seed: number): void {
  host?.detach();
  current = game;
  activeSeed = seed;
  simulation = createDifficultySimulation(game, {
    seed,
    difficulty,
    plugins: presentationPlugins,
  });
  lastTick = 0;
  paused = false;
  queuedActions = [];

  renderer = createCanvasRenderer(canvas, {
    width: WORLD.width,
    height: WORLD.height,
    background: '#080a12',
  });
  canvas.style.aspectRatio = `${WORLD.width} / ${WORLD.height}`;
  canvas.setAttribute('aria-label', `Pantalla de ${game.meta.title}`);
  seedOutput.textContent = String(seed);
  const initialHash = simulation.hash();
  hashOutput.textContent = initialHash;
  hashOutput.dataset.initialHash = initialHash;
  stageTitle.textContent = game.meta.title;
  hint.textContent = controlsFor(game);
  renderTouchActions(game);
  shelf.hidden = true;
  stage.hidden = false;
  document.title = `${game.meta.title} · Arcade Engine`;
  status.textContent = `Juego activo: ${game.meta.title}`;

  // La URL siempre lleva la semilla efectiva: «Copiar enlace» es compartible.
  history.replaceState(null, '', `${location.pathname}${location.search}${routeFor(game.id, seed)}`);
  refreshViewport();

  const tap = tapActionFor(game);
  host = createInputHost({
    actions: simulation.actions,
    bindings: createBindings(bindingsFor(game)),
    // Sin acción canónica de tap (Q*bert) se desactiva el puntero del canvas:
    // las cuatro diagonales se alcanzan con los botones en pantalla.
    ...(tap === undefined ? {} : { pointer: canvas, tapAction: tap }),
    gamepadButtons: gamepadButtonsFor(game),
    onAction: (action, down) => {
      if (!down) return;
      const title = current?.meta.title ?? 'Juego';
      if (action === 'pause') {
        paused = !paused;
        if (paused) loop.pause();
        else loop.resume();
        status.textContent = paused ? `${title} en pausa` : `Juego activo: ${title}`;
      } else if (action === 'restart') {
        // Re-montaje real: misma semilla, tick 0 y hash inicial recalculado.
        const restarted = current;
        const restartedSeed = activeSeed;
        if (restarted !== undefined) {
          mount(restarted, restartedSeed);
          status.textContent = `${title} reiniciado · semilla ${restartedSeed} · hash ${hashOutput.dataset.initialHash}`;
        }
      }
    },
  });
  host.attach();
  ensureLoop();
}

function isFullscreen(): boolean {
  return document.fullscreenElement === stage;
}

async function toggleFullscreen(): Promise<void> {
  if (stage.hidden) return;
  try {
    if (isFullscreen()) await document.exitFullscreen();
    else await stage.requestFullscreen();
  } catch {
    status.textContent = 'Pantalla completa no disponible en este navegador';
  }
}

function syncRoute(): void {
  const route = parseRoute(location.hash);
  if (route.view === 'hub') {
    showHub();
    return;
  }
  const game = findGame(route.id) as GameDefinition<object> | undefined;
  if (!game) {
    showHub(`Juego no encontrado: ${route.id}`);
    history.replaceState(null, '', `${location.pathname}${location.search}`);
    return;
  }
  if (current?.id === game.id && activeSeed === route.seed && !stage.hidden) return;
  mount(game, route.seed);
}

themeButton.addEventListener('click', () => applyTheme(nextTheme(theme), true));
copySeedButton.addEventListener('click', () => {
  const url = location.href;
  const clipboard = globalThis.navigator?.clipboard;
  if (clipboard === undefined) {
    status.textContent = `Enlace de la partida: ${url}`;
    return;
  }
  void clipboard.writeText(url).then(
    () => {
      status.textContent = `Enlace copiado: ${url}`;
    },
    () => {
      status.textContent = `Enlace de la partida: ${url}`;
    },
  );
});
fullscreenButton.addEventListener('click', () => void toggleFullscreen());
// Cell Swarm: doble tap sobre el mundo activa el impulso; el tap simple ya
// divide (host) y las tres zonas en pantalla cubren dividir/expulsar/impulso.
canvas.addEventListener('dblclick', (event) => {
  if (current?.id !== 'cell-swarm' || stage.hidden) return;
  event.preventDefault();
  if (simulation.actions.registered.includes('boost')) queuedActions.push('boost');
});
window.addEventListener('keydown', (event) => {
  if (event.code !== 'KeyF' || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
  if (stage.hidden) return;
  const target = event.target;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return;
  }
  event.preventDefault();
  void toggleFullscreen();
});
document.addEventListener('fullscreenchange', () => {
  refreshViewport();
  const title = current?.meta.title ?? 'Juego';
  if (isFullscreen()) {
    status.textContent = `Pantalla completa activa: ${title}`;
  } else {
    status.textContent = `Pantalla completa desactivada: ${title}`;
    fullscreenButton.focus();
  }
});
window.addEventListener('resize', () => refreshViewport());
search.addEventListener('input', () => renderGrid(search.value));
difficultySelect.addEventListener('change', () => {
  difficulty = parseDifficulty(difficultySelect.value);
  if (current !== undefined && !stage.hidden) mount(current, activeSeed);
});
back.addEventListener('click', () => {
  location.hash = '';
});
window.addEventListener('hashchange', syncRoute);

applyTheme(theme);
renderGrid('');
syncRoute();
