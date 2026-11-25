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

const canvas = document.querySelector<HTMLCanvasElement>('#screen')!;
const hint = document.querySelector<HTMLParagraphElement>('#hint')!;
const selector = document.querySelector<HTMLSelectElement>('#game')!;
const ctx = canvas.getContext('2d')!;

for (const game of GAMES) {
  const option = document.createElement('option');
  option.value = game.id;
  option.textContent = game.meta.title;
  selector.append(option);
}

const presentationPlugins = [eventFanoutPlugin(), particlesPlugin(), audioPlugin()];

const SIZES: Readonly<Record<string, { readonly width: number; readonly height: number }>> = {
  pong: { width: PONG.width, height: PONG.height },
  flappy: { width: FLAPPY.width, height: FLAPPY.height },
};

/** Acciones genéricas del teclado → primeras acciones registradas por el juego. */
const ALIASES: Readonly<Record<string, readonly ActionName[]>> = {
  up: ['up', 'p1Up', 'thrust', 'accel', 'flap', 'jump'],
  down: ['down', 'p1Down', 'brake', 'duck', 'softDrop'],
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

function hintFor(game: GameDefinition<object>): string {
  if (game.id === 'pong') {
    return 'W/S mover · ↑/↓ jugador 2 · Espacio sacar · P pausa · gamepad/táctil también';
  }
  if (game.id === 'flappy') {
    return 'Espacio/↑ aletear · P pausa · gamepad/táctil también';
  }
  return `Teclado, gamepad o táctil · acciones: ${game.actions.join(', ')} · P pausa · R reinicio`;
}

let current: GameDefinition<object> = findGame('pong')!;
let simulation = createGameSimulation(current, { seed: 12345, plugins: presentationPlugins });
let host: InputHost | undefined;
let paused = false;
let lastTick = 0;

function mount(game: GameDefinition<object>): void {
  host?.detach();
  current = game;
  simulation = createGameSimulation(game, { seed: 12345, plugins: presentationPlugins });
  lastTick = 0;
  if (paused) {
    paused = false;
    loop.resume();
  }

  const size = SIZES[game.id];
  canvas.width = size?.width ?? 960;
  canvas.height = size?.height ?? 600;
  selector.value = game.id;
  hint.textContent = hintFor(game);

  host = createInputHost({
    actions: simulation.actions,
    bindings: createBindings(bindingsFor(game)),
    pointer: canvas,
    tapAction: tapActionFor(game),
    onAction: (action, down) => {
      if (action !== 'pause' || !down) return;
      paused = !paused;
      if (paused) loop.pause();
      else loop.resume();
    },
  });
  host.attach();
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
    if (steps > 0) {
      simulation.services.get<ParticleSystem>(PARTICLES_SERVICE).update(steps);
      lastTick = simulation.clock.tick;
    }

    if (current.render) {
      current.render(ctx, simulation.state, loop.alpha);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#05060f';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#9aa5c4';
      ctx.font = '16px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('este juego corre en modo lógica (sin render)', canvas.width / 2, canvas.height / 2);
      ctx.textAlign = 'left';
    }

    if (simulation.services.has(PARTICLES_SERVICE)) {
      simulation.services.get<ParticleSystem>(PARTICLES_SERVICE).draw(ctx);
    }
  },
});

selector.addEventListener('change', () => {
  const game = findGame(selector.value);
  if (game) mount(game as GameDefinition<object>);
});

mount(current);
loop.start();
