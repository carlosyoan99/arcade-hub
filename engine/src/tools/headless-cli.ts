import { gameSimulationOptions } from '../game/adapter.js';
import { demoGame } from '../game/example.js';
import { runHeadless } from './headless.js';

function argument(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value !== undefined && !value.startsWith('--') ? value : fallback;
}

const ticks = Number(argument('ticks', '600'));
const seed = Number(argument('seed', '12345'));

if (!Number.isInteger(ticks) || ticks < 0 || !Number.isFinite(seed)) {
  console.error('Uso: headless --ticks <N> --seed <semilla>');
  process.exitCode = 1;
} else {
  const result = runHeadless({
    ...gameSimulationOptions(demoGame, { seed }),
    ticks,
  });
  console.log(JSON.stringify(result));
}
