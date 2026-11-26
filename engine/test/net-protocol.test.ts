import { describe, expect, it } from 'vitest';
import {
  HASH_INTERVAL,
  NET_VERSION,
  ProtocolError,
  encode,
  parseClientMessage,
  parseClientText,
  parseServerMessage,
  parseServerText,
} from '../src/net/protocol.js';

function codeOf(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    return error instanceof ProtocolError ? error.code : String(error);
  }
  return undefined;
}

describe('net/protocol — validación de mensajes v1', () => {
  it('acepta y sanea los cinco mensajes cliente→servidor', () => {
    expect(parseClientMessage({ v: 1, t: 'hello', name: 'Ada' })).toEqual({
      v: 1,
      t: 'hello',
      name: 'Ada',
    });
    expect(parseClientMessage({ v: 1, t: 'join', code: 'abcd' })).toEqual({
      v: 1,
      t: 'join',
      code: 'ABCD',
      role: 'player',
    });
    expect(
      parseClientMessage({ v: 1, t: 'join', code: 'ABCD', role: 'spectator' }),
    ).toEqual({ v: 1, t: 'join', code: 'ABCD', role: 'spectator' });
    expect(parseClientMessage({ v: 1, t: 'input', tick: 7, actions: ['p1Up'] })).toEqual({
      v: 1,
      t: 'input',
      tick: 7,
      actions: ['p1Up'],
    });
    expect(parseClientMessage({ v: 1, t: 'hash', tick: 30, value: '30:1:abc' })).toEqual({
      v: 1,
      t: 'hash',
      tick: 30,
      value: '30:1:abc',
    });
    expect(parseClientMessage({ v: 1, t: 'left' })).toEqual({ v: 1, t: 'left' });
    expect(NET_VERSION).toBe(1);
    expect(HASH_INTERVAL).toBe(30);
  });

  it('rechaza versión incorrecta, tipo desconocido y envelope roto', () => {
    expect(codeOf(() => parseClientMessage({ v: 2, t: 'hello', name: 'A' }))).toBe('bad-version');
    expect(codeOf(() => parseClientMessage({ v: '1', t: 'hello', name: 'A' }))).toBe('bad-version');
    expect(codeOf(() => parseClientMessage({ v: 1, t: 'nope' }))).toBe('unknown-type');
    expect(codeOf(() => parseClientMessage(null))).toBe('bad-envelope');
    expect(codeOf(() => parseClientMessage([]))).toBe('bad-envelope');
    expect(codeOf(() => parseClientText('{'))).toBe('bad-json');
  });

  it('rechaza input malformado: tick, acciones duplicadas o inválidas', () => {
    expect(codeOf(() => parseClientMessage({ v: 1, t: 'input', tick: -1, actions: [] }))).toBe(
      'bad-tick',
    );
    expect(codeOf(() => parseClientMessage({ v: 1, t: 'input', tick: 1.5, actions: [] }))).toBe(
      'bad-tick',
    );
    expect(codeOf(() => parseClientMessage({ v: 1, t: 'input', tick: '3', actions: [] }))).toBe(
      'bad-tick',
    );
    expect(codeOf(() => parseClientMessage({ v: 1, t: 'input', tick: 1, actions: 'up' }))).toBe(
      'bad-actions',
    );
    expect(
      codeOf(() => parseClientMessage({ v: 1, t: 'input', tick: 1, actions: ['up', 'up'] })),
    ).toBe('bad-actions');
    expect(codeOf(() => parseClientMessage({ v: 1, t: 'input', tick: 1, actions: [4] }))).toBe(
      'bad-actions',
    );
    expect(
      codeOf(() =>
        parseClientMessage({
          v: 1,
          t: 'input',
          tick: 1,
          actions: Array.from({ length: 65 }, () => 'up'),
        }),
      ),
    ).toBe('bad-actions');
  });

  it('rechaza join/hello/hash malformados', () => {
    expect(codeOf(() => parseClientMessage({ v: 1, t: 'join', code: 'abc' }))).toBe('bad-code');
    expect(codeOf(() => parseClientMessage({ v: 1, t: 'join', code: 'ab!d' }))).toBe('bad-code');
    expect(codeOf(() => parseClientMessage({ v: 1, t: 'join', code: 'ABCD', role: 'bot' }))).toBe(
      'bad-role',
    );
    expect(codeOf(() => parseClientMessage({ v: 1, t: 'hello', name: '' }))).toBe('bad-name');
    expect(codeOf(() => parseClientMessage({ v: 1, t: 'hello', name: 'a'.repeat(25) }))).toBe(
      'bad-name',
    );
    expect(codeOf(() => parseClientMessage({ v: 1, t: 'hello', name: 'a\nb' }))).toBe('bad-name');
    expect(codeOf(() => parseClientMessage({ v: 1, t: 'hash', tick: 1, value: '' }))).toBe(
      'bad-value',
    );
    expect(codeOf(() => parseClientMessage({ v: 1, t: 'hash', tick: 1, value: 'mal hash' }))).toBe(
      'bad-hash',
    );
  });

  it('parsea mensajes servidor→cliente y rechaza payloads rotos', () => {
    const joined = {
      v: 1,
      t: 'joined',
      code: 'ABCD',
      id: 'p1',
      hostId: 'p1',
      seed: 12345,
      players: [{ id: 'p1', name: 'A', role: 'player' }],
      spectators: [{ id: 's1', name: 'S', role: 'spectator' }],
    } as const;
    expect(parseServerMessage(joined).t).toBe('joined');
    expect(parseServerMessage({ v: 1, t: 'input', from: 'p1', tick: 2, actions: ['up'] })).toEqual({
      v: 1,
      t: 'input',
      from: 'p1',
      tick: 2,
      actions: ['up'],
    });
    expect(
      parseServerMessage({ v: 1, t: 'desync', tick: 30, hashes: [{ from: 'p1', value: 'a' }] }),
    ).toEqual({ v: 1, t: 'desync', tick: 30, hashes: [{ from: 'p1', value: 'a' }] });
    expect(codeOf(() => parseServerMessage({ v: 2, t: 'welcome', id: 'p1' }))).toBe('bad-version');
    expect(codeOf(() => parseServerMessage({ v: 1, t: 'peer-left', id: '!' }))).toBe('bad-id');
    expect(codeOf(() => parseServerText('not json'))).toBe('bad-json');
  });

  it('encode/text son simétricos', () => {
    const message = { v: 1 as const, t: 'left' as const };
    expect(parseClientText(encode(message))).toEqual(message);
  });
});
