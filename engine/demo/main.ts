import { createLoop } from '../src/core/loop.js';
import type { ActionName } from '../src/core/types.js';
import { createGameSimulation } from '../src/game/adapter.js';
import type { GameDefinition } from '../src/game/contract.js';
import { createBindings, DEFAULT_BINDINGS, type BindingMap } from '../src/input/bindings.js';
import { createInputHost, type InputHost } from '../src/input/host.js';
import { audioPlugin } from '../src/audio/manager.js';
import { eventFanoutPlugin } from '../src/render/event-fanout.js';
import { particlesPlugin, PARTICLES_SERVICE, type ParticleSystem } from '../src/render/particles.js';
import { findGame, GAMES } from '../src/games/index.js';
import { FLAPPY } from '../src/games/flappy/game.js';
import { PONG } from '../src/games/pong/game.js';
import { filterGames, gameCard, parseRoute, routeFor } from '../src/ui/hub-model.js';

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
const hint = el<HTMLElement>('#hint');
const status = el<HTMLElement>('#status');
const results = el<HTMLElement>('#results');
const canvas = el<HTMLCanvasElement>('#screen');
const context = canvas.getContext('2d');
if (!context) throw new Error('No se pudo obtener el contexto 2D del canvas');
const ctx: CanvasRenderingContext2D = context;

const SEED = 12345;
const DEFAULT_SIZE = { width: 960, height: 600 } as const;
const SIZES: Readonly<Record<string, { readonly width: number; readonly height: number }>> = {
  pong: { width: PONG.width, height: PONG.height },
  flappy: { width: FLAPPY.width, height: FLAPPY.height },
};

const presentationPlugins = [eventFanoutPlugin(), particlesPlugin(), audioPlugin()];

/** Acciones genéricas del teclado → primeras acciones registradas por el juego. */
const ALIASES: Readonly<Record<string, readonly ActionName[]>> = {
  up: ['up', 'p1Up', 'thrust', 'accel', 'flap', 'jump', 'aimUp'],
  down: ['down', 'p1Down', 'brake', 'duck', 'softDrop', 'aimDown'],
  left: ['left', 'aimLeft'],
  right: ['right', 'aimRight'],
  primary: [
    'primary',
    'serve',
    'flap',
    'fire',
    'launch',
    'pump',
    'pepper',
    'throw',
    'split',
    'boost',
    'jump',
    'rotate',
    'hardDrop',
  ],
  confirm: ['confirm', 'fire', 'primary'],
};

/** Etiquetas de ayuda derivadas de `game.actions` (más P/R comunes). */
const ACTION_LABELS: Readonly<Record<string, string>> = {
  left: '←/A izq.',
  right: '→/D der.',
  up: '↑/W arriba',
  down: '↓/S abajo',
  p1Up: '↑ jug. 1',
  p1Down: '↓ jug. 1',
  p2Up: '↑ jug. 2',
  p2Down: '↓ jug. 2',
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
  rotate: 'Espacio girar',
  rotateCCW: 'Q girar',
  hardDrop: 'Espacio caer',
  softDrop: '↓ bajar',
  accel: '↑ acelerar',
  brake: '↓ frenar',
  turbo: 'Espacio turbo',
  boost: 'Espacio impulso',
  hold: 'C retener',
  duck: '↓ agachar',
  bomb: 'Espacio bomba',
  eject: 'Espacio expulsar',
  split: 'Espacio dividir',
  confirm: 'Enter confirmar',
  cancel: 'Esc cancelar',
};

function bindingsFor(game: GameDefinition<object>): BindingMap {
  const map: Record<string, ActionName> = {};
  for (const [code, generic] of Object.entries(DEFAULT_BINDINGS)) {
    const candidates = ALIASES[generic] ?? [generic];
    const action = candidates.find((name) => game.actions.includes(name));
    if (action !== undefined) map[code] = action;
  }
  if (game.actions.includes('p2Up')) {
    map.ArrowUp = 'p2Up';
    map.ArrowDown = 'p2Down';
  }
  return map;
}

function tapActionFor(game: GameDefinition<object>): ActionName {
  const preferred: readonly ActionName[] = [
    'primary',
    'serve',
    'flap',
    'fire',
    'launch',
    'pump',
    'jump',
    'rotate',
    'hardDrop',
    'confirm',
    'bomb',
  ];
  return preferred.find((name) => game.actions.includes(name)) ?? 'primary';
}

function controlsFor(game: GameDefinition<object>): string {
  const parts = game.actions
    .filter((action) => action !== 'pause' && action !== 'restart')
    .map((action) => ACTION_LABELS[action] ?? action.replace(/([A-Z])/g, ' $1').toLowerCase());
  const base = parts.length > 0 ? parts.join(' · ') : 'Teclado, gamepad o táctil';
  return `${base} · P pausa · R reinicio`;
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

  const title = document.createElement('span');
  title.className = 'card__title';
  title.textContent = card.title;

  const meta = document.createElement('span');
  meta.className = 'card__meta';
  meta.textContent = card.label;

  link.append(number, title, meta);
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

let current: GameDefinition<object> | undefined;
let simulation = createGameSimulation(findGame('pong')!, { seed: SEED, plugins: presentationPlugins });
let host: InputHost | undefined;
let paused = false;
let lastTick = 0;

function drawWithoutRender(): void {
  ctx.fillStyle = '#080a12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#9aa3bd';
  ctx.font = '15px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Este juego corre en modo lógica; render en preparación.', canvas.width / 2, canvas.height / 2);
  ctx.textAlign = 'left';
}

const loop = createLoop({
  get simulation() {
    return simulation;
  },
  getInputs: () => {
    host?.poll(simulation.clock.tick);
    return host?.frame().actions ?? [];
  },
  render: () => {
    const steps = simulation.clock.tick - lastTick;
    if (steps > 0 && simulation.services.has(PARTICLES_SERVICE)) {
      simulation.services.get<ParticleSystem>(PARTICLES_SERVICE).update(steps);
      lastTick = simulation.clock.tick;
    }

    if (current?.render) current.render(ctx, simulation.state, loop.alpha);
    else drawWithoutRender();

    if (simulation.services.has(PARTICLES_SERVICE)) {
      simulation.services.get<ParticleSystem>(PARTICLES_SERVICE).draw(ctx);
    }
  },
});

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
  current = undefined;
  paused = false;
  loop.stop();
  stage.hidden = true;
  shelf.hidden = false;
  document.title = `Arcade Engine · ${GAMES.length} juegos`;
  status.textContent = message;
}

function mount(game: GameDefinition<object>): void {
  host?.detach();
  current = game;
  simulation = createGameSimulation(game, { seed: SEED, plugins: presentationPlugins });
  lastTick = 0;
  paused = false;

  const size = SIZES[game.id] ?? DEFAULT_SIZE;
  canvas.width = size.width;
  canvas.height = size.height;
  canvas.setAttribute('aria-label', `Pantalla de ${game.meta.title}`);
  stageTitle.textContent = game.meta.title;
  hint.textContent = controlsFor(game);
  shelf.hidden = true;
  stage.hidden = false;
  document.title = `${game.meta.title} · Arcade Engine`;
  status.textContent = `Juego activo: ${game.meta.title}`;

  host = createInputHost({
    actions: simulation.actions,
    bindings: createBindings(bindingsFor(game)),
    pointer: canvas,
    tapAction: tapActionFor(game),
    onAction: (action, down) => {
      if (!down) return;
      const title = current?.meta.title ?? 'Juego';
      if (action === 'pause') {
        paused = !paused;
        if (paused) loop.pause();
        else loop.resume();
        status.textContent = paused ? `${title} en pausa` : `Juego activo: ${title}`;
      } else if (action === 'restart') {
        if (loop.isPaused) loop.resume();
        paused = false;
        status.textContent = `${title} reiniciado`;
      }
    },
  });
  host.attach();
  ensureLoop();
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
  if (current?.id === game.id && !stage.hidden) return;
  mount(game);
}

search.addEventListener('input', () => renderGrid(search.value));
back.addEventListener('click', () => {
  location.hash = '';
});
window.addEventListener('hashchange', syncRoute);

renderGrid('');
syncRoute();
