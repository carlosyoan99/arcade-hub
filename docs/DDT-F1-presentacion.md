# DDT F1 — Presentación

> 25-nov-2026 · Sistemas reutilizables de render, audio, UI y guardado. Ninguno vive dentro de un juego.

## 1. Objetivo

Que cualquier juego pueda pedir "juice" (partículas, sonido, HUD, ayuda, ajustes, récords) sin copiar código. Un `GameEvent` del `step()` alimenta todos los subsistemas.

## 2. Módulos

| Módulo | Export principal | Responsabilidad |
| --- | --- | --- |
| `render/canvas2d.ts` | `computeLetterbox`, `createCanvasRenderer` | DPR, letterbox y resize determinista |
| `render/camera.ts` | `createCamera` | follow/clamp y transformación |
| `render/sprites.ts` | `createSprite`, `drawSprite` | sprites y frames |
| `render/particles.ts` | `createParticles`, `particlesPlugin` | pool, update por ticks, consume eventos |
| `render/event-fanout.ts` | `eventFanoutPlugin` | **único** `events.drain()` por tick, publica a los consumidores |
| `render/ui-draw.ts` | `drawText`, `drawBar`, `drawCorners`, `drawPanel` | primitivas de HUD |
| `audio/synth.ts` | `createAudio`, `createSynth` | beeps/ruidos sintetizados, sin assets |
| `audio/music.ts` | `createMusic`, `SONGS`, `noteHz` | secuencias musicales por id |
| `audio/manager.ts` | `createAudioManager`, `audioPlugin` | mapea eventos → sonido, mute/volumen |
| `ui/shell.ts` | `createShell`, `shellPlugin` | menú, overlay, `aria-live` |
| `ui/hud.ts`, `ui/help.ts`, `ui/settings.ts` | `hudPlugin`, `helpPlugin`, `settingsPlugin` | HUD, ayuda, remapeo y `prefers-reduced-motion` |
| `store/storage.ts` | `createStorage`, `memoryStorage` | clave+versión, validador, migración, `try/catch` |
| `store/scores.ts` | `createScores`, `scoreSchema` | récords por modo; la IA nunca escribe |
| `store/achievements.ts` | `createAchievements` | logros versionados |

## 3. Regla del drenaje único

`audioPlugin` y `particlesPlugin` declaran `requires: ['presentation.events']`. El host instala `eventFanoutPlugin()` primero; su hook `postStep` drena la cola y publica a los suscriptores. Así dos plugins no se roban eventos entre sí.

## 4. Determinismo

Las partículas usan `api.rng.fork(0x50415254)`: un stream independiente que no consume el RNG de la simulación. El audio usa su propio RNG privado. Ningún sistema de presentación muta el estado del juego.

## 5. Validación

`test/render.test.ts`, `audio.test.ts`, `ui.test.ts`, `store.test.ts` → 44 tests: letterbox, partículas por ticks, storage versionado/migración y rechazo de datos inválidos, scores por modo, audio inerte en Node.

`engine/demo/main.ts` integra los tres plugins en la demo visual Pong/Flappy y actualiza partículas según `clock.tick`.
