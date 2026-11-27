import { describe, expect, it, vi } from 'vitest';
import { findGame, GAMES } from '../src/games/index.js';
import { createActionState } from '../src/input/actions.js';
import { createBindings } from '../src/input/bindings.js';
import {
  createInputHost,
  type InputEventLike,
  type InputEventTarget,
} from '../src/input/host.js';
import { captureInputFrame } from '../src/input/virtual.js';
import { createStorage, memoryStorage } from '../src/store/storage.js';
import {
  bindingsFor,
  DEFAULT_SEED,
  filterGames,
  formatPlayers,
  gameCard,
  gamepadButtonsFor,
  isTheme,
  nextTheme,
  parseRoute,
  routeFor,
  tapActionFor,
  THEME_SCHEMA,
  touchActionsFor,
} from '../src/ui/hub-model.js';

describe('hub-model · filtrado', () => {
  it('devuelve los 32 juegos ordenados por título con la consulta vacía', () => {
    const all = filterGames(GAMES, '   ');
    expect(all).toHaveLength(32);
    const titles = all.map((game) => game.meta.title);
    expect([...titles].sort((a, b) => a.localeCompare(b, 'es'))).toEqual(titles);
  });

  it('busca por título/id sin distinguir mayúsculas ni espacios', () => {
    expect(filterGames(GAMES, 'SPACE INVADERS').map((game) => game.id)).toContain('space-invaders');
    expect(filterGames(GAMES, 'space-invaders').map((game) => game.id)).toEqual(['space-invaders']);
    expect(filterGames(GAMES, '  pong  ').map((game) => game.id)).toContain('pong');
  });

  it('exige todas las palabras y no muta el catálogo', () => {
    const before = GAMES.map((game) => game.id);
    const result = filterGames(GAMES, 'invaders space');
    expect(result.map((game) => game.id)).toEqual(['space-invaders']);
    expect(GAMES.map((game) => game.id)).toEqual(before);
  });

  it('filtra por modo cuando se pide', () => {
    const local = filterGames(GAMES, '', 'local');
    expect(local.length).toBeGreaterThan(0);
    for (const game of local) expect(game.meta.modes).toContain('local');
    expect(filterGames(GAMES, 'pong', 'demo').map((game) => game.id)).not.toContain('pong');
  });

  it('devuelve vacío si no hay coincidencias', () => {
    expect(filterGames(GAMES, 'no-existe')).toEqual([]);
  });
});

describe('hub-model · tarjetas', () => {
  it('formatea jugadores', () => {
    expect(formatPlayers([1])).toBe('1 jug');
    expect(formatPlayers([1, 2, 4])).toBe('1–4 jug');
    expect(formatPlayers([])).toBe('— jug');
  });

  it('describe un juego con id con guiones', () => {
    const game = findGame('space-invaders')!;
    expect(gameCard(game)).toEqual({
      id: 'space-invaders',
      title: game.meta.title,
      modes: game.meta.modes,
      players: game.meta.players,
      label: `1 jug · ${game.meta.modes.join(' / ').replace('vsAI', 'vs IA')}`,
    });
  });

  it('la etiqueta de Pong indica rango de jugadores y modos legibles', () => {
    const card = gameCard(findGame('pong')!);
    expect(card.players).toEqual([1, 2]);
    expect(card.label).toContain('1–2 jug');
    expect(card.label).toContain('vs IA');
  });
});

describe('hub-model · rutas #game/<id>', () => {
  it('genera y parsea ids con guiones', () => {
    expect(routeFor('space-invaders')).toBe('#game/space-invaders');
    expect(parseRoute(routeFor('space-invaders'))).toEqual({
      view: 'game',
      id: 'space-invaders',
      seed: DEFAULT_SEED,
    });
  });

  it('acepta prefijo opcional, mayúsculas y barras sobrantes', () => {
    expect(parseRoute('#game/pong/')).toEqual({ view: 'game', id: 'pong', seed: DEFAULT_SEED });
    expect(parseRoute('#/GAME/PONG')).toEqual({ view: 'game', id: 'pong', seed: DEFAULT_SEED });
    expect(parseRoute('game/space-invaders')).toEqual({
      view: 'game',
      id: 'space-invaders',
      seed: DEFAULT_SEED,
    });
  });

  it('comparte la semilla en #game/<id>?seed=<n>', () => {
    expect(routeFor('tetris', 777)).toBe('#game/tetris?seed=777');
    expect(parseRoute('#game/tetris?seed=777')).toEqual({ view: 'game', id: 'tetris', seed: 777 });
    expect(parseRoute('#game/pong?seed=0')).toEqual({ view: 'game', id: 'pong', seed: 0 });
    expect(parseRoute('#game/pong?seed=12345')).toMatchObject({ seed: DEFAULT_SEED });
    expect(routeFor('pong', DEFAULT_SEED)).toBe('#game/pong');
  });

  it('ignora semillas no numéricas, negativas o inseguras', () => {
    for (const bad of ['?seed=abc', '?seed=-1', '?seed=1.5', '?seed=9007199254740993', '?seed=']) {
      expect(parseRoute(`#game/pong${bad}`)).toEqual({
        view: 'game',
        id: 'pong',
        seed: DEFAULT_SEED,
      });
    }
    expect(parseRoute('#game/pong?seed=7&extra=1')).toEqual({
      view: 'game',
      id: 'pong',
      seed: 7,
    });
  });

  it('cae a la vitrina con rutas vacías o inseguras', () => {
    expect(parseRoute('')).toEqual({ view: 'hub' });
    expect(parseRoute('#')).toEqual({ view: 'hub' });
    expect(parseRoute('#shelf')).toEqual({ view: 'hub' });
    expect(parseRoute('#game/')).toEqual({ view: 'hub' });
    expect(parseRoute('#game/<script>')).toEqual({ view: 'hub' });
    expect(parseRoute('#game/%')).toEqual({ view: 'hub' });
    expect(parseRoute('#game/../../etc')).toEqual({ view: 'hub' });
  });
});

describe('hub-model · temas', () => {
  it('valida y persiste los tres temas con sobre versionado', () => {
    const storage = createStorage(memoryStorage());
    expect(isTheme('retro')).toBe(true);
    expect(isTheme('azul')).toBe(false);
    expect(storage.save(THEME_SCHEMA, 'light')).toBe(true);
    expect(storage.load(THEME_SCHEMA)).toBe('light');
    expect(storage.raw(THEME_SCHEMA.key)).toBe('{"v":1,"data":"light"}');
    expect(storage.save(THEME_SCHEMA, 'azul')).toBe(false);
    expect(nextTheme('dark')).toBe('light');
    expect(nextTheme('light')).toBe('retro');
    expect(nextTheme('retro')).toBe('dark');
  });

  it('migra el tema legacy sin versión del HUB anterior', () => {
    const storage = createStorage(memoryStorage({ [THEME_SCHEMA.key]: '"light"' }));
    expect(storage.load(THEME_SCHEMA)).toBe('light');
  });
});

describe('hub-model · bindings por juego', () => {
  it('nunca enlaza una acción no registrada en ninguno de los 32 juegos', () => {
    for (const game of GAMES) {
      const bindings = bindingsFor(game);
      expect(Object.keys(bindings).length, `${game.id} sin bindings`).toBeGreaterThan(0);
      for (const [code, action] of Object.entries(bindings)) {
        expect(game.actions, `${game.id}:${code}`).toContain(action);
      }
      expect(bindings.Escape, `${game.id}: Escape debe quedar libre`).toBeUndefined();
      const tap = tapActionFor(game);
      if (tap !== undefined) expect(game.actions, `${game.id}: tapAction no registrada`).toContain(tap);
    }
  });

  const expected: Readonly<Record<string, Readonly<Record<string, string>>>> = {
    tetris: { Space: 'hardDrop', KeyZ: 'rotateCCW', KeyC: 'hold' },
    columns: { Space: 'hardDrop' },
    'puyo-puyo': { Space: 'hardDrop' },
    snake: { Space: 'pause' },
    'cell-swarm': { Space: 'split', KeyZ: 'eject', KeyX: 'boost' },
    qbert: { KeyQ: 'upLeft', KeyE: 'upRight', KeyA: 'downLeft', KeyD: 'downRight' },
    'out-run': { Space: 'turbo' },
    'pole-position': { Space: 'turbo' },
    'double-dragon': { KeyZ: 'punch', KeyX: 'kick', KeyC: 'combo' },
    defender: { KeyB: 'bomb', KeyH: 'hyperspace', KeyN: 'nuclear' },
    'moon-patrol': { ArrowUp: 'jump', KeyW: 'fireUp' },
    'neon-nexus': { Digit1: 'card1', Digit2: 'card2', Digit3: 'card3' },
    'missile-command': { Space: 'fire', ArrowUp: 'aimUp' },
  };

  for (const [id, bindings] of Object.entries(expected)) {
    it(`${id} responde a sus acciones reales`, () => {
      const game = findGame(id)!;
      expect(bindingsFor(game)).toMatchObject(bindings);
    });
  }

  it('Cell Swarm: E expulsa y Q impulsa, además de los alias históricos', () => {
    const bindings = bindingsFor(findGame('cell-swarm')!);
    expect(bindings).toMatchObject({
      Space: 'split',
      KeyE: 'eject',
      KeyQ: 'boost',
      KeyZ: 'eject',
      KeyX: 'boost',
    });
  });

  it('Neon Nexus: 1/2/3 cartas y todas las mejoras/tienda tienen tecla', () => {
    const game = findGame('neon-nexus')!;
    const bindings = bindingsFor(game);
    expect(bindings).toMatchObject({
      Digit1: 'card1',
      Digit2: 'card2',
      Digit3: 'card3',
      Digit4: 'upgradeAtk',
      Digit5: 'upgradeHp',
      Digit6: 'upgradeSpd',
      KeyB: 'shop',
      Digit7: 'buyMaxHp',
      Digit8: 'buyAtkBonus',
      Digit9: 'buyStartShield',
      Digit0: 'buyRegenBonus',
      KeyC: 'closeShop',
    });
    for (const name of game.actions) {
      if (name === 'pause' || name === 'restart' || name === 'fire' || name.startsWith('left') || name.startsWith('right') || name.startsWith('up') || name.startsWith('down')) continue;
      expect(Object.values(bindings), `${name} sin tecla`).toContain(name);
    }
  });

  it('usa rotateCCW/hold en puzzle cuando el juego los registra', () => {
    // Nunca se inventa una acción: si el juego no registra `rotateCCW`/`hold`
    // se usa `rotate` o no se enlaza la tecla, respectivamente.
    for (const id of ['columns', 'puyo-puyo']) {
      const game = findGame(id)!;
      const bindings = bindingsFor(game);
      expect(bindings.KeyZ).toBe(game.actions.includes('rotateCCW') ? 'rotateCCW' : 'rotate');
      expect(bindings.KeyC).toBe(game.actions.includes('hold') ? 'hold' : undefined);
    }
  });
});

describe('hub-model · acciones táctiles y de gamepad', () => {
  class LocalTarget implements InputEventTarget {
    private readonly listeners = new Map<string, ((event: InputEventLike) => void)[]>();

    addEventListener(type: string, listener: (event: InputEventLike) => void): void {
      const bucket = this.listeners.get(type) ?? [];
      bucket.push(listener);
      this.listeners.set(type, bucket);
    }

    removeEventListener(type: string, listener: (event: InputEventLike) => void): void {
      const bucket = this.listeners.get(type) ?? [];
      this.listeners.set(type, bucket.filter((candidate) => candidate !== listener));
    }

    emit(type: string, event: InputEventLike): void {
      for (const listener of [...(this.listeners.get(type) ?? [])]) listener(event);
    }
  }

  function hostFor(id: string) {
    const game = findGame(id)!;
    const actions = createActionState(game.actions);
    const target = new LocalTarget();
    const tap = tapActionFor(game);
    const host = createInputHost({
      actions,
      bindings: createBindings(bindingsFor(game)),
      target,
      gamepadButtons: gamepadButtonsFor(game),
      ...(tap === undefined ? {} : { pointer: target, tapAction: tap }),
    });
    host.attach();
    return { actions, target, host };
  }

  const key = (code: string): InputEventLike => ({ code, preventDefault: () => undefined });

  it('Cell Swarm: split/eject/boost llegan a InputFrame por teclado', () => {
    const { actions, target } = hostFor('cell-swarm');
    for (const [code, action] of [
      ['Space', 'split'],
      ['KeyZ', 'eject'],
      ['KeyX', 'boost'],
    ] as const) {
      target.emit('keydown', key(code));
      expect(captureInputFrame(actions)).toContain(action);
      target.emit('keyup', key(code));
      expect(captureInputFrame(actions)).not.toContain(action);
    }
  });

  it('Cell Swarm: el gamepad alcanza boost y ofrece tres botones táctiles', () => {
    const game = findGame('cell-swarm')!;
    expect(touchActionsFor(game).map((entry) => entry.action)).toEqual(['split', 'eject', 'boost']);
    expect(tapActionFor(game)).toBe('split');

    const { actions, host } = hostFor('cell-swarm');
    const pad = {
      connected: true,
      buttons: Array.from({ length: 8 }, (_, index) => ({
        pressed: index === 3,
        value: index === 3 ? 1 : 0,
      })),
      axes: [0, 0, 0, 0],
    } as unknown as Gamepad;
    vi.stubGlobal('navigator', { getGamepads: () => [pad] });
    host.poll(1);
    expect(captureInputFrame(actions)).toContain('boost');
    vi.unstubAllGlobals();
  });

  it('Q*bert: cuatro diagonales por teclado y botones táctiles (sin tap único)', () => {
    const game = findGame('qbert')!;
    expect(tapActionFor(game)).toBeUndefined();
    expect(touchActionsFor(game).map((entry) => entry.action)).toEqual([
      'upLeft',
      'upRight',
      'downLeft',
      'downRight',
    ]);

    const { actions, target } = hostFor('qbert');
    for (const [code, action] of [
      ['KeyQ', 'upLeft'],
      ['KeyE', 'upRight'],
      ['KeyA', 'downLeft'],
      ['KeyD', 'downRight'],
    ] as const) {
      target.emit('keydown', key(code));
      expect(captureInputFrame(actions)).toEqual([action]);
      target.emit('keyup', key(code));
    }
  });
});
