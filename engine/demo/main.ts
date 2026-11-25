import { createLoop } from '../src/core/loop.js';
import type { GameDefinition } from '../src/game/contract.js';
import { createGameSimulation } from '../src/game/adapter.js';
import { createBindings } from '../src/input/bindings.js';
import { audioPlugin } from '../src/audio/manager.js';
import { eventFanoutPlugin } from '../src/render/event-fanout.js';
import { particlesPlugin, PARTICLES_SERVICE, type ParticleSystem } from '../src/render/particles.js';
import { flappyGame, FLAPPY } from '../src/games/flappy/game.js';
import { pongGame, PONG } from '../src/games/pong/game.js';

const canvas = document.querySelector<HTMLCanvasElement>('#screen')!;
const hint = document.querySelector<HTMLParagraphElement>('#hint')!;
const ctx = canvas.getContext('2d')!;
const bindings = createBindings({
  KeyW: 'p1Up',
  KeyS: 'p1Down',
  ArrowUp: 'p2Up',
  ArrowDown: 'p2Down',
  Space: 'serve',
  KeyF: 'flap',
  KeyP: 'pause',
  KeyR: 'restart',
});

const presentationPlugins = [eventFanoutPlugin(), particlesPlugin(), audioPlugin()];

let current: GameDefinition<object> = pongGame as GameDefinition<object>;
let simulation = createGameSimulation(current, { seed: 12345, plugins: presentationPlugins });
let lastTick = 0;

function mount(game: GameDefinition<object>): void {
  current = game;
  simulation = createGameSimulation(game, { seed: 12345, plugins: presentationPlugins });
  lastTick = 0;
  const width = game.id === 'flappy' ? FLAPPY.width : PONG.width;
  const height = game.id === 'flappy' ? FLAPPY.height : PONG.height;
  canvas.width = width;
  canvas.height = height;
  bindings.remap('Space', game.id === 'flappy' ? 'flap' : 'serve');
  hint.textContent =
    game.id === 'flappy'
      ? 'F/Espacio aletear · la IA puede usar la misma acción flap'
      : 'W/S mover · ↑/↓ jugador 2 · Espacio sacar · P pausa';
  for (const button of document.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.id === game.id));
  }
}

let paused = false;
const loop = createLoop({
  get simulation() {
    return simulation;
  },
  render: () => {
    const tick = simulation.clock.tick;
    const steps = tick - lastTick;
    if (steps > 0) {
      simulation.services.get<ParticleSystem>(PARTICLES_SERVICE).update(steps);
      lastTick = tick;
    }
    current.render?.(ctx, simulation.state, loop.alpha);
    if (simulation.services.has(PARTICLES_SERVICE)) {
      simulation.services.get<ParticleSystem>(PARTICLES_SERVICE).draw(ctx);
    }
  },
});

function applyKey(code: string, down: boolean): void {
  const action = bindings.resolve(code);
  if (!action || !simulation.actions.registered.includes(action)) return;
  bindings.apply(code, down, simulation.actions);
}

window.addEventListener('keydown', (event) => {
  if (bindings.resolve(event.code) === 'pause') {
    paused = !paused;
    if (paused) loop.pause();
    else loop.resume();
    event.preventDefault();
    return;
  }
  applyKey(event.code, true);
  event.preventDefault();
});
window.addEventListener('keyup', (event) => {
  applyKey(event.code, false);
});

document.querySelector('#pong')!.addEventListener('click', () => mount(pongGame as GameDefinition<object>));
document.querySelector('#flappy')!.addEventListener('click', () => mount(flappyGame as GameDefinition<object>));

mount(current);
loop.start();
