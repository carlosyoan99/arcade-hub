import { describe, expect, it } from 'vitest';
import { createGameSimulation, gameSimulationOptions } from '../src/game/adapter.js';
import { runHeadless } from '../src/tools/headless.js';
import type { GameDefinition } from '../src/game/contract.js';
import type { InputFrame } from '../src/input/virtual.js';
import { defenderGame } from '../src/games/defender/game.js';
import { doubleDragonGame } from '../src/games/double-dragon/game.js';
import { moonPatrolGame } from '../src/games/moon-patrol/game.js';
import { neonNexusGame, NEXUS_CARDS, NEXUS_SHOP } from '../src/games/neon-nexus/game.js';
import { outRunGame } from '../src/games/out-run/game.js';
import { PAPERBOY, paperboyGame } from '../src/games/paperboy/game.js';
import { POLE_POSITION, polePositionGame } from '../src/games/pole-position/game.js';
import type { Simulation } from '../src/core/simulation.js';

type InputsAt = (tick: number) => InputFrame;

/** Avanza un tick y devuelve los tipos de evento emitidos (juice). */
function tickEvents<S extends object>(sim: Simulation<S>, input: InputFrame = []): string[] {
  sim.tick(input);
  return sim.events.drain().map((event) => event.type);
}

/** (a) Misma semilla + misma cinta ⇒ mismo hash. */
function expectDeterministic<S extends object>(
  game: GameDefinition<S>,
  seed: number,
  inputsAt: InputsAt,
  ticks = 400,
): void {
  const options = gameSimulationOptions(game, { seed });
  const a = runHeadless({ ...options, ticks, inputsAt });
  const b = runHeadless({ ...options, ticks, inputsAt });
  expect(a.hash).toBe(b.hash);
}

/** (b) La curva declarada se aplica de verdad cuando sube el progreso. */
function expectDifficultyRises<S extends object>(
  game: GameDefinition<S>,
  seed: number,
  setProgress: (state: S) => void,
): void {
  const sim = createGameSimulation(game, { seed });
  sim.tick([]);
  const before = { ...sim.ctx.progression.state };
  setProgress(sim.state);
  sim.tick([]);
  const after = sim.ctx.progression.state;
  expect(after.level).toBeGreaterThan(before.level);
  expect(after.speed).toBeGreaterThan(before.speed);
  expect(after.hazard).toBeGreaterThan(before.hazard);
  if (before.spawnInterval !== null && after.spawnInterval !== null) {
    expect(after.spawnInterval).toBeLessThan(before.spawnInterval);
  }
}

/** (c) observe() siempre devuelve floats normalizados y finitos. */
function expectObservationFinite<S extends object>(game: GameDefinition<S>, seed: number): void {
  const sim = createGameSimulation(game, { seed });
  for (let i = 0; i < 8; i++) sim.tick([]);
  const observation = game.observe?.(sim.state, 0);
  expect(observation).toBeInstanceOf(Float32Array);
  expect(observation?.length).toBeGreaterThan(0);
  expect([...(observation ?? [])].every((v) => Number.isFinite(v) && v >= -1.01 && v <= 1.01)).toBe(true);
}

/** (d) La lógica emite eventos de juice; render/audio los consumen fuera. */
function expectJuiceEvents<S extends object>(
  game: GameDefinition<S>,
  seed: number,
  inputsAt: InputsAt,
  ticks = 160,
): void {
  const options = gameSimulationOptions(game, { seed });
  const result = runHeadless({ ...options, ticks, inputsAt });
  expect(result.events).toBeGreaterThan(0);
}

describe('Juegos migrados al motor — determinismo, dificultad, observación y juice', () => {
  describe('Defender', () => {
    const inputsAt: InputsAt = (tick) => (tick % 5 === 1 ? ['fire'] : tick === 40 ? ['bomb'] : []);
    it('es determinista', () => expectDeterministic(defenderGame, 101, inputsAt));
    it('sube la dificultad por oleada', () =>
      expectDifficultyRises(defenderGame, 101, (state) => {
        state.waves = 1;
      }));
    it('observa en rango', () => expectObservationFinite(defenderGame, 101));
    it('emite eventos', () => expectJuiceEvents(defenderGame, 101, inputsAt));
  });

  describe('Double Dragon', () => {
    const inputsAt: InputsAt = (tick) => (tick % 7 === 1 ? ['punch'] : tick % 11 === 3 ? ['combo'] : []);
    it('es determinista', () => expectDeterministic(doubleDragonGame, 202, inputsAt));
    it('sube la dificultad por acto', () =>
      expectDifficultyRises(doubleDragonGame, 202, (state) => {
        state.act = 1;
      }));
    it('observa en rango', () => expectObservationFinite(doubleDragonGame, 202));
    it('emite eventos', () => expectJuiceEvents(doubleDragonGame, 202, inputsAt));
  });

  describe('Moon Patrol', () => {
    const inputsAt: InputsAt = (tick) =>
      tick % 5 === 1 ? ['fire'] : tick % 23 === 1 ? ['jump'] : tick % 17 === 2 ? ['fireUp'] : [];
    it('es determinista', () => expectDeterministic(moonPatrolGame, 303, inputsAt));
    it('sube la dificultad por distancia', () =>
      expectDifficultyRises(moonPatrolGame, 303, (state) => {
        state.distance = 500;
      }));
    it('observa en rango', () => expectObservationFinite(moonPatrolGame, 303));
    it('emite eventos', () => expectJuiceEvents(moonPatrolGame, 303, inputsAt));
  });

  describe('Neon Nexus', () => {
    const inputsAt: InputsAt = (tick) => (tick % 10 === 1 ? ['fire'] : []);
    it('es determinista', () => expectDeterministic(neonNexusGame, 404, inputsAt));
    it('sube la dificultad por oleada', () =>
      expectDifficultyRises(neonNexusGame, 404, (state) => {
        state.wave = 1;
      }));
    it('observa en rango', () => expectObservationFinite(neonNexusGame, 404));
    it('emite eventos', () => expectJuiceEvents(neonNexusGame, 404, inputsAt));
  });

  describe('Out Run', () => {
    const inputsAt: InputsAt = (tick) => (tick === 1 ? ['turbo', 'accel'] : ['accel']);
    it('es determinista', () => expectDeterministic(outRunGame, 505, inputsAt));
    it('sube la dificultad por tramo', () =>
      expectDifficultyRises(outRunGame, 505, (state) => {
        state.stage = 1;
      }));
    it('observa en rango', () => expectObservationFinite(outRunGame, 505));
    it('emite eventos', () => expectJuiceEvents(outRunGame, 505, inputsAt));
  });

  describe('Paperboy', () => {
    const inputsAt: InputsAt = (tick) => (tick % 20 === 1 ? ['throw'] : tick % 37 === 5 ? ['down'] : []);
    it('es determinista', () => expectDeterministic(paperboyGame, 606, inputsAt));
    it('sube la dificultad por calle', () =>
      expectDifficultyRises(paperboyGame, 606, (state) => {
        state.day = 1;
      }));
    it('observa en rango', () => expectObservationFinite(paperboyGame, 606));
    it('emite eventos', () => expectJuiceEvents(paperboyGame, 606, inputsAt));
  });

  describe('Pole Position', () => {
    const inputsAt: InputsAt = (tick) => (tick === 1 ? ['turbo', 'accel'] : ['accel']);
    it('es determinista', () => expectDeterministic(polePositionGame, 707, inputsAt));
    it('sube la dificultad por circuito', () =>
      expectDifficultyRises(polePositionGame, 707, (state) => {
        state.circuit = 1;
      }));
    it('observa en rango', () => expectObservationFinite(polePositionGame, 707));
    it('emite eventos', () => expectJuiceEvents(polePositionGame, 707, inputsAt));
  });
});

describe('Regresiones documentadas y mecánicas completas', () => {
  it('B2 — Out Run: turbo y pausa son acciones independientes', () => {
    const sim = createGameSimulation(outRunGame, { seed: 11 });
    sim.tick(['pause']);
    expect(sim.state.paused).toBe(true);
    expect(sim.state.turbo).toBe(0);
    sim.tick([]);
    expect(sim.state.turbo).toBe(0);
    sim.tick(['pause']);
    expect(sim.state.paused).toBe(false);
    sim.tick(['turbo']);
    expect(sim.state.turbo).toBeGreaterThan(0);
  });

  it('B5 — Double Dragon: el D-pad mantenido mueve de forma continua', () => {
    const sim = createGameSimulation(doubleDragonGame, { seed: 12 });
    const startX = sim.state.player.x;
    for (let i = 0; i < 10; i++) sim.tick(['right']);
    expect(sim.state.player.x).toBeGreaterThan(startX + 5);
  });

  it('B6 — Defender: los timers no spawnean en pausa ni tras reiniciar', () => {
    const sim = createGameSimulation(defenderGame, { seed: 13 });
    sim.tick(['pause']);
    for (let i = 0; i < 200; i++) sim.tick([]);
    expect(sim.state.enemies.length).toBe(0);
    expect(sim.state.pendingSpawns).toBe(0);
    sim.tick(['restart']);
    expect(sim.state.generation).toBe(2);
    for (let i = 0; i < 50; i++) sim.tick([]);
    expect(sim.state.enemies.length).toBe(0);
    expect(sim.state.pendingSpawns).toBe(0);
  });

  it('B6 — Double Dragon: el acto no avanza durante la pausa', () => {
    const sim = createGameSimulation(doubleDragonGame, { seed: 14 });
    sim.tick([]);
    sim.state.enemies = [];
    sim.state.phase = 'grunts';
    sim.state.waiting = false;
    sim.tick(['pause']);
    for (let i = 0; i < 100; i++) sim.tick([]);
    expect(sim.state.enemies.length).toBe(0);
    sim.tick(['pause']);
    for (let i = 0; i < 100; i++) sim.tick([]);
    expect(sim.state.enemies.some((enemy) => enemy.type === 'boss')).toBe(true);
  });

  it('Pole Position: la clasificación es alcanzable con acelerador + turbo sostenidos', () => {
    const sim = createGameSimulation(polePositionGame, { seed: 9 });
    let qualified = false;
    let qualifyingTime = -1;
    for (let tick = 1; tick <= 4500 && !qualified; tick++) {
      sim.tick(['accel', 'turbo']);
      for (const event of sim.events.drain()) {
        if (event.type === 'qualified') {
          qualified = true;
          qualifyingTime = sim.state.qualifyingTime;
        }
      }
    }
    expect(qualified).toBe(true);
    expect(sim.state.phase).toBe('race');
    expect(qualifyingTime).toBeGreaterThan(0);
    expect(qualifyingTime).toBeLessThan(75);
  });

  it('Neon Nexus conserva las 17 cartas, la tienda de 4 objetos y las oleadas', () => {
    expect(NEXUS_CARDS).toHaveLength(17);
    expect(NEXUS_SHOP).toHaveLength(4);
    const sim = createGameSimulation(neonNexusGame, { seed: 15 });
    for (let i = 0; i < 600; i++) sim.tick(i % 10 === 1 ? ['fire'] : []);
    expect(sim.state.wave).toBeGreaterThan(0);
    expect(sim.state.kills + sim.state.stars).toBeGreaterThan(0);
  });
});

describe('Correcciones P0/P1 del batch conducción (efecto real en el motor)', () => {
  it('todas las acciones del original están declaradas', () => {
    expect(defenderGame.actions).toEqual(expect.arrayContaining(['fire', 'bomb', 'hyperspace', 'nuclear']));
    expect(doubleDragonGame.actions).toEqual(expect.arrayContaining(['punch', 'kick', 'combo']));
    expect(moonPatrolGame.actions).toEqual(expect.arrayContaining(['jump', 'fireUp']));
    expect(neonNexusGame.actions).toEqual(
      expect.arrayContaining([
        'card1', 'card2', 'card3', 'upgradeAtk', 'upgradeHp', 'upgradeSpd',
        'shop', 'buyMaxHp', 'buyAtkBonus', 'buyStartShield', 'buyRegenBonus', 'closeShop',
      ]),
    );
    expect(outRunGame.actions).toContain('turbo');
    expect(polePositionGame.actions).toContain('turbo');
    expect(paperboyGame.actions).toEqual(expect.arrayContaining(['up', 'down']));
    expect(paperboyGame.actions).not.toContain('left');
    expect(paperboyGame.actions).not.toContain('right');
  });

  it('Defender: bomb, hyperspace y nuclear gastan recursos y surten efecto', () => {
    const bombSim = createGameSimulation(defenderGame, { seed: 801 });
    bombSim.state.enemies = [
      {
        type: 'lander', x: 100, y: 100, vx: 0, vy: 0, speed: 10, hp: 1, size: 14,
        targetX: 100, phase: 'hunting', carrying: null, timer: 0, wobble: 0,
      },
    ];
    const bombs = bombSim.state.bombsLeft;
    const bombEvents = tickEvents(bombSim, ['bomb']);
    expect(bombSim.state.bombsLeft).toBe(bombs - 1);
    expect(bombSim.state.enemies).toHaveLength(0);
    expect(bombEvents).toContain('smartBomb');
    expect(bombEvents).toContain('explode');

    const hyperSim = createGameSimulation(defenderGame, { seed: 802 });
    const x0 = hyperSim.state.ship.x;
    const hyperEvents = tickEvents(hyperSim, ['hyperspace']);
    expect(hyperSim.state.hyperspaceCd).toBeGreaterThan(0);
    expect(hyperSim.state.ship.x).not.toBe(x0);
    expect(hyperEvents).toContain('hyperspace');

    const nukeSim = createGameSimulation(defenderGame, { seed: 803 });
    const nukes = nukeSim.state.nuclearLeft;
    const nukeEvents = tickEvents(nukeSim, ['nuclear']);
    expect(nukeSim.state.nuclearLeft).toBe(nukes - 1);
    expect(nukeEvents).toContain('nuke');
  });

  it('Double Dragon: punch, kick y combo dañan y emiten hit', () => {
    for (const [action, damage] of [['punch', 10], ['kick', 18], ['combo', 30]] as const) {
      const sim = createGameSimulation(doubleDragonGame, { seed: 811 });
      sim.state.waiting = false;
      sim.state.phase = 'grunts';
      sim.state.player.facing = 1;
      sim.state.enemies = [
        {
          x: 260, y: 250, type: 'punk', hp: 60, maxHp: 60, speed: 0,
          attackTimer: 999, hit: 0, facing: -1, alive: true,
        },
      ];
      const events = tickEvents(sim, [action]);
      expect(sim.state.enemies[0]?.hp, action).toBe(60 - damage);
      expect(events, action).toContain('attack');
      expect(events, action).toContain('hit');
    }
  });

  it('Moon Patrol: jump salta y fireUp dispara arriba; los impactos emiten hit', () => {
    const jumpSim = createGameSimulation(moonPatrolGame, { seed: 821 });
    tickEvents(jumpSim, ['jump']);
    expect(jumpSim.state.player.grounded).toBe(false);

    const fireSim = createGameSimulation(moonPatrolGame, { seed: 822 });
    const shootEvents = tickEvents(fireSim, ['fireUp']);
    expect(fireSim.state.bullets.some((bullet) => !bullet.enemy && bullet.vy < 0)).toBe(true);
    expect(shootEvents).toContain('shootUp');

    const hitSim = createGameSimulation(moonPatrolGame, { seed: 823 });
    hitSim.state.enemies = [{ x: 130, y: 260, type: 'rover', speed: 0, w: 20, h: 10, shootTimer: 999 }];
    hitSim.state.bullets = [{ x: 125, y: 260, vx: 300, vy: 0, w: 8, h: 3, enemy: false }];
    const hitEvents = tickEvents(hitSim, []);
    expect(hitEvents).toContain('hit');
    expect(hitEvents).toContain('explode');
  });

  it('Neon Nexus: card1..3 se consumen sin que offerPending bloquee el bucle', () => {
    const sim = createGameSimulation(neonNexusGame, { seed: 831 });
    sim.tick([]);
    sim.state.offerPending = true;
    sim.state.offeredCards = ['atkUp', 'regen', 'magnet'];
    const ticks = sim.state.ticks;
    const events = tickEvents(sim, ['card1']);
    expect(sim.state.ticks).toBe(ticks + 1);
    expect(sim.state.offerPending).toBe(false);
    expect(sim.state.cards.atkUp).toBe(1);
    expect(events).toContain('card');

    sim.state.offerPending = true;
    sim.state.offeredCards = ['atkUp', 'regen', 'magnet'];
    const idleTicks = sim.state.ticks;
    tickEvents(sim, []);
    expect(sim.state.ticks).toBe(idleTicks + 1);
    expect(sim.state.offerPending).toBe(true);
  });

  it('Neon Nexus: mejoras y tienda consumen recursos y la tienda persiste al reiniciar', () => {
    const sim = createGameSimulation(neonNexusGame, { seed: 832 });
    sim.state.stars = 100;
    // Evita que el bonus de la oleada recién iniciada añada estrellas al total.
    sim.state.cleared = true;
    sim.state.clearTimer = 120;
    tickEvents(sim, ['upgradeAtk']);
    expect(sim.state.atkLevel).toBe(1);
    expect(sim.state.stars).toBe(90);

    sim.state.over = true;
    expect(tickEvents(sim, ['shop'])).toContain('shop');
    expect(sim.state.shopOpen).toBe(true);
    sim.state.coins = 100;
    tickEvents(sim, ['buyMaxHp']);
    expect(sim.state.perm.maxHP).toBe(1);
    expect(sim.state.coins).toBe(85);
    tickEvents(sim, ['closeShop']);
    expect(sim.state.shopOpen).toBe(false);

    tickEvents(sim, ['restart']);
    expect(sim.state.perm.maxHP).toBe(1);
    expect(sim.state.coins).toBe(85);
    expect(sim.state.wave).toBe(0);
  });

  it('Neon Nexus: la oleada de jefe emite boss', () => {
    const sim = createGameSimulation(neonNexusGame, { seed: 833 });
    sim.state.wave = 5;
    sim.state.waveQueue = ['boss'];
    sim.state.spawned = 0;
    sim.state.spawnTimer = 0;
    expect(tickEvents(sim, [])).toContain('boss');
  });

  it('Out Run: turbo y colisión emiten eventos de juice', () => {
    const sim = createGameSimulation(outRunGame, { seed: 841 });
    expect(tickEvents(sim, ['turbo', 'accel'])).toContain('turbo');
    expect(sim.state.turbo).toBeGreaterThan(0);

    const crashSim = createGameSimulation(outRunGame, { seed: 842 });
    crashSim.state.player.speed = 100;
    crashSim.state.rivals = [{ z: crashSim.state.camZ, x: crashSim.state.player.x, speed: 0 }];
    const events = tickEvents(crashSim, []);
    expect(events).toContain('crash');
    expect(events).toContain('hit');
    expect(events).toContain('explode');
  });

  it('Paperboy: ↑↓ cambian de carril, ←→ no, y los obstáculos se reciclan', () => {
    const sim = createGameSimulation(paperboyGame, { seed: 851 });
    tickEvents(sim, ['down']);
    expect(sim.state.playerLane).toBe(2);
    tickEvents(sim, []);
    tickEvents(sim, ['up']);
    expect(sim.state.playerLane).toBe(1);
    tickEvents(sim, []);
    const lane = sim.state.playerLane;
    tickEvents(sim, ['right']);
    expect(sim.state.playerLane).toBe(lane);

    sim.state.obstacles = [{ x: -61, lane: 0, type: 'car', w: 35, speed: 0 }];
    tickEvents(sim, []);
    expect(sim.state.obstacles).toHaveLength(1);
    expect(sim.state.obstacles[0]?.x).toBeGreaterThan(PAPERBOY.width);

    const crashSim = createGameSimulation(paperboyGame, { seed: 852 });
    crashSim.state.obstacles = [
      { x: PAPERBOY.playerX, lane: crashSim.state.playerLane, type: 'car', w: 35, speed: 0 },
    ];
    const events = tickEvents(crashSim, []);
    expect(events).toEqual(expect.arrayContaining(['crash', 'hit', 'explode', 'gameOver']));
  });

  it('Pole Position: la carrera dura 3 vueltas y turbo/colisión emiten juice', () => {
    expect(POLE_POSITION.raceLaps).toBe(3);
    const sim = createGameSimulation(polePositionGame, { seed: 861 });
    expect(tickEvents(sim, ['turbo', 'accel'])).toContain('turbo');
    expect(sim.state.turbo).toBeGreaterThan(0);

    const crashSim = createGameSimulation(polePositionGame, { seed: 862 });
    crashSim.state.phase = 'race';
    crashSim.state.player.speed = 100;
    crashSim.state.rivals = [{ x: crashSim.state.player.x, y: crashSim.state.player.y, speed: 0, phase: 0 }];
    const crashEvents = tickEvents(crashSim, []);
    expect(crashEvents).toEqual(expect.arrayContaining(['crash', 'hit', 'explode']));

    const race = createGameSimulation(polePositionGame, { seed: 863 });
    const roadLength = POLE_POSITION.segments * (POLE_POSITION.height / 6);
    race.state.phase = 'race';
    race.state.circuit = POLE_POSITION.circuits - 1; // última vuelta del último circuito
    race.state.laps = POLE_POSITION.raceLaps - 1;
    race.state.roadOffset = roadLength - 1;
    race.state.player.speed = POLE_POSITION.maxSpeed;
    race.state.player.x = POLE_POSITION.width / 2;
    race.state.rivals = [];
    race.state.pickups = [];
    race.state.time = 60;
    const events = tickEvents(race, ['accel']);
    expect(race.state.laps).toBe(3);
    expect(race.state.over).toBe(true);
    expect(events).toContain('lap');
  });

  it('los juegos de conducción emiten gameOver al agotarse el tiempo', () => {
    const out = createGameSimulation(outRunGame, { seed: 871 });
    out.state.time = 0.01;
    expect(tickEvents(out, [])).toContain('gameOver');
    const pole = createGameSimulation(polePositionGame, { seed: 872 });
    pole.state.time = 0.01;
    expect(tickEvents(pole, [])).toContain('gameOver');
  });
});
