# DDT F3 — IA neuronal

> 25-nov-2026 · Misma `step()` del juego, sin DOM, sin `Math.random`, sin `Date.now`.

## 1. Módulos

| Módulo | Responsabilidad |
| --- | --- |
| `ai/mlp.ts` | MLP configurable (tanh/sigmoid/relu), pesos `Float32Array`, serialización hexadecimal little-endian |
| `ai/brain.ts` | Cerebro v1 `{v, gameId, gameVersion, topology, weights, meta}` con checksum FNV-1a y validación estricta |
| `ai/evolution.ts` | Torneo, elitismo, crossover uniforme y mutación; todo con el RNG inyectado |
| `ai/agents.ts` | `RuleBot`, `NeuralBot`, `SearchBot`; devuelven acciones nombradas compatibles con `InputFrame` |
| `ai/sensors.ts` | Recorte y normalización de observaciones |
| `ai/brain-store.ts` | Guardado/carga con almacenamiento inyectado y validación al cargar |
| `ai/trainer.ts` | `trainHeadless` corre el `step()` real del juego y elige campeón con semillas de validación separadas |
| `ai/difficulty.ts` | Checkpoints Fácil/Normal/Difícil, retraso y error inyectables sin reentrenar |

## 2. Contrato

El juego expone `observe(state, playerId) → Float32Array` y `rules.fitness(state)`. El trainer no conoce la física del juego: usa `gameSimulationOptions` y `createSimulation`, por lo que **no hay copia de constantes** y un cambio en el juego se refleja automáticamente en el entrenamiento.

```ts
trainHeadless({
  game: flappyGame,
  seed: 4242,
  generations: 3,
  population: 8,
  ticksPerEval: 200,
  validationSeeds: 3,
});
```

## 3. Evaluación honesta

- Las semillas de entrenamiento y validación se generan disjuntas.
- El campeón se elige por **mediana** y se desempata por **peor caso**, no por el mejor resultado.
- `checkpoints` conserva el mejor de cada generación para los perfiles de dificultad.

## 4. Juego limpio

`observe()` debe devolver solo lo que ve el jugador. Los bots entran por `virtual-input` igual que un humano; no hay acceso privado al estado más allá de la observación declarada.

## 5. Validación

26 tests unitarios + 2 de integración (`test/ai-integration.test.ts`): MLP con pesos conocidos, rechazo de cerebro corrupto, determinismo de la evolución con la misma semilla, entrenamiento reproducible sobre Pong y Flappy, y validación con semillas nunca vistas.
