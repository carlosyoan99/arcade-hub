import { describe, expect, it } from 'vitest';
import { createGameSimulation } from '../src/game/adapter.js';
import { pongGame } from '../src/games/pong/game.js';
import type { InputFrame } from '../src/input/virtual.js';
import { createLockstep, type DesyncReport } from '../src/net/lockstep.js';

describe('net/lockstep — cinta por tick, delay y hashes', () => {
  it('aplica el delay local y publica el input con el tick destino', () => {
    const sent: { tick: number; actions: InputFrame }[] = [];
    const lockstep = createLockstep({
      players: ['p1', 'p2'],
      localId: 'p1',
      delay: 3,
      onInput: (tick, actions) => sent.push({ tick, actions }),
    });
    expect(lockstep.delay).toBe(3);
    expect(lockstep.submitLocal(5, ['p1Up', 'p1Up'])).toBe(8);
    expect(sent).toEqual([{ tick: 8, actions: ['p1Up'] }]);
  });

  it('entrega la cinta combinada solo cuando todos aportaron y hace stall si falta input', () => {
    const lockstep = createLockstep({ players: ['p1', 'p2'], localId: 'p1', delay: 2 });
    lockstep.submit('p1', 1, ['p1Up']);
    lockstep.submit('p2', 1, ['p2Down']);
    lockstep.submit('p1', 2, []);

    expect(lockstep.hasFrame(1)).toBe(true);
    expect(lockstep.advance(1)).toEqual(['p1Up', 'p2Down']);
    expect(lockstep.hasFrame(2)).toBe(false);
    expect(lockstep.advance(2)).toBeUndefined();

    lockstep.submit('p2', 2, ['serve']);
    expect(lockstep.advance(2)).toEqual(['serve']);
    expect(lockstep.advance(2)).toEqual(['serve']); // tick repetido devuelve la cinta
    expect(() => lockstep.advance(1)).toThrow(RangeError); // tick antiguo
    expect(() => lockstep.advance(0)).toThrow(RangeError);
  });

  it('replay de la misma cinta produce el mismo hash de simulación', () => {
    const run = (seed: number): string => {
      const simulation = createGameSimulation(pongGame, { seed });
      const lockstep = createLockstep({ players: ['p1', 'p2'], localId: 'p1', delay: 2 });
      for (let tick = 1; tick <= 120; tick++) {
        lockstep.submit('p1', tick, tick % 7 === 0 ? ['p1Up'] : []);
        lockstep.submit('p2', tick, tick % 5 === 0 ? ['p2Down'] : []);
        const tape = lockstep.advance(tick);
        expect(tape).toBeDefined();
        simulation.tick(tape ?? []);
      }
      return simulation.hash();
    };

    const first = run(4242);
    expect(first).toBe(run(4242));
    expect(first).not.toBe(run(9001));
  });

  it('compara hashes cada N ticks y reporta desync una sola vez', () => {
    const reports: DesyncReport[] = [];
    const lockstep = createLockstep({
      players: ['p1', 'p2'],
      localId: 'p1',
      hashInterval: 10,
      onDesync: (report) => reports.push(report),
    });

    lockstep.recordHash('p1', 10, '10:1:aaa');
    lockstep.recordHash('p2', 10, '10:1:aaa');
    expect(lockstep.checkHashes(10)).toBeUndefined();
    expect(lockstep.checkHashes(11)).toBeUndefined();

    lockstep.recordHash('p1', 20, '20:2:aaa');
    lockstep.recordHash('p2', 20, '20:2:bbb');
    const report = lockstep.checkHashes(20);
    expect(report?.tick).toBe(20);
    expect(report?.hashes).toEqual([
      { from: 'p1', value: '20:2:aaa' },
      { from: 'p2', value: '20:2:bbb' },
    ]);
    expect(lockstep.checkHashes(20)).toBeUndefined();
    expect(reports).toHaveLength(1);
  });

  it('soporta jugadores que llegan tarde y eliminar jugadores', () => {
    const lockstep = createLockstep({ players: ['p1'], localId: 'p1' });
    lockstep.addPlayer('p2', 3);
    expect(lockstep.players()).toEqual(['p1', 'p2']);
    lockstep.submit('p1', 2, []);
    expect(lockstep.advance(2)).toEqual([]); // p2 aún no había entrado
    lockstep.submit('p1', 3, []);
    lockstep.submit('p2', 3, ['serve']);
    expect(lockstep.advance(3)).toEqual(['serve']);
    lockstep.removePlayer('p2');
    expect(lockstep.players()).toEqual(['p1']);
  });
});
