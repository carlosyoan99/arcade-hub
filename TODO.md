# TODO — Arcade Hub

> **Estado:** 🟢 Proyecto cerrado — modo mantenimiento
> **Última auditoría:** 2026-08-29
> **Catálogo:** 32 juegos (19 originales + 13 nuevos)
> **Tests:** 320/320 pasando

---

## 🟢 MANTENIMIENTO — Auditorías periódicas

El proyecto está cerrado para desarrollo activo. Se realizarán auditorías periódicas para:

- Detectar y corregir bugs reportados
- Mantener consistencia de metadata y documentación
- Verificar que los tests siguen pasando
- Actualizar dependencias de tooling (ESLint, Prettier)

### Checklist de auditoría periódica

```bash
npm run lint        # 0 errores / 0 warnings
npm run verify      # Consistencia games.js ↔ disco ↔ sw.js
npm test            # 320/320 tests
```

---

## ✅ COMPLETADO — Fases de desarrollo

### Fase 0: Juegos originales (19)

| Juego           | Género      | Versión |
| --------------- | ----------- | ------- |
| Pong            | Deportes    | 1.7.0   |
| Breakout        | Arcade      | 1.5.0   |
| Snake           | Arcade      | 1.5.1   |
| Asteroids       | Shooter     | 1.5.0   |
| Space Invaders  | Shooter     | 1.5.0   |
| Flappy Bird     | Arcade      | 1.5.0   |
| Pac-Man         | Laberinto   | 1.5.0   |
| Tetris          | Puzzle      | 1.5.0   |
| Frogger         | Arcade      | 1.5.0   |
| Galaga          | Shooter     | 1.5.0   |
| Centipede       | Shooter     | 1.5.0   |
| Dig Dug         | Arcade      | 1.4.0   |
| Missile Command | Shooter     | 1.4.0   |
| Cell Swarm      | Arcade      | 1.4.0   |
| Neon Nexus      | Arcade      | 1.4.0   |
| Defender        | Shooter     | 1.3.0   |
| Donkey Kong     | Plataformas | 1.3.0   |
| Joust           | Arcade      | 1.3.0   |
| Dino Runner     | Arcade      | 1.5.0   |

### Fase 1: Nuevos juegos — Batch 1 (4)

| Juego         | Género            | Commit    |
| ------------- | ----------------- | --------- |
| Columns       | Puzzle de gemas   | `b3e78d4` |
| Pole Position | Racing top-down   | `b3e78d4` |
| Moon Patrol   | Side-scroll lunar | `b3e78d4` |
| Tempest       | Tube shooter      | `b3e78d4` |

### Fase 2: Nuevos juegos — Batch 2 (4)

| Juego     | Género              | Commit    |
| --------- | ------------------- | --------- |
| Bomberman | Laberinto/bombas    | `ac4674b` |
| Raiden    | Vertical shooter    | `ac4674b` |
| Gradius   | Side-scroll shooter | `ac4674b` |
| Q*bert    | Isométrico/puzzle   | `e5a526d` |

### Fase 3: Nuevos juegos — Batch 3 (3)

| Juego         | Género               | Commit    |
| ------------- | -------------------- | --------- |
| Double Dragon | Beat 'em up          | `6ff2751` |
| BurgerTime    | Plataformas          | `6ff2751` |
| Paperboy      | Delivery/side-scroll | `6ff2751` |

### Fase 4: Nuevos juegos — Batch 4 (2)

| Juego     | Género             | Commit    |
| --------- | ------------------ | --------- |
| Puyo Puyo | Puzzle competitivo | `20c27be` |
| Out Run   | Racing pseudo-3D   | `20c27be` |

---

## ✅ COMPLETADO — Infraestructura

- [x] Estructura de carpetas (`games/`, `shared/`, `.agents/skills/`)
- [x] Hub (`index.html` + `games.js`) con grilla responsiva
- [x] Service Worker (`sw.js`) con cache-first + network-first para metadata
- [x] ESLint + Prettier configurados y funcionando (`npm run check`)
- [x] GitHub Pages: rutas relativas verificadas
- [x] Hash routing `#game/{id}` → iframe embebido
- [x] Meta tags OG dinámicos + Schema.org JSON-LD
- [x] Sitemap XML + robots.txt
- [x] Entry sequence cinemática (split-door reveal + logo scale-up)

### Módulos compartidos

- [x] `shared/audio.js` — Web Audio API (beep, ambient, closeAudio)
- [x] `shared/effects.js` — Screen shake, partículas, hit-stop, flash, drawGlow(), feedbackBundle(), squash & stretch
- [x] `shared/achievements.js` — Sistema de logros persistido + contador de partidas
- [x] `shared/help.js` — Modal de ayuda contextual con metadata, logros y changelog toggle
- [x] `shared/base.css` — Variables neon, overlay, HUD, touch controls, game bar, CRT effects
- [x] `shared/display.js` — setupCanvas() con DPR + letterboxing + RAF-based resize debounce
- [x] `shared/dom.js` — injectCommonElements() — loading, announce, gameBar
- [x] `shared/loop.js` — createGameLoop() — RAF + dt calculation + cleanup unificado
- [x] `shared/input.js` — createGamepad() + bindHoldButton() — gamepad y táctil compartidos
- [x] `shared/music.js` — Web Audio procedural music con temas por juego
- [x] `shared/scores.js` — Persistencia de high scores

---

## ✅ COMPLETADO — Fases técnicas

### R1–R4: Refactor

- [x] Renombrar vars 3D vestigios (0 matches restantes)
- [x] Extraer game loop compartido (19/19 → 32/32 juegos)
- [x] Eliminar magic numbers
- [x] CSS selector cleanup

### P0–P10: Rendimiento

- [x] Reemplazar `shadowBlur` en todos los juegos
- [x] RAF-based debounce en resize
- [x] Pruebas de rendimiento — 19/19 originales a 60fps, 0 Long Tasks

### A1–A5: Accesibilidad

- [x] Modal de ayuda con focus trap
- [x] Quitar `user-scalable=no` del viewport
- [x] `role="img"` en canvas de todos los juegos
- [x] `:focus-visible` global con `--accent`
- [x] Hub — badge, aria-label, focus-visible en toolbar

### G1–G6: Game Feel

- [x] Sistema de feedback por tiers (`feedbackBundle`)
- [x] Screen shake suave por trauma
- [x] Hit-stop / freeze frame
- [x] Squash & stretch en saltos/landings
- [x] 32/32 juegos con feedbackBundle integrado

### H1–H7: Premium Hub UI

- [x] Entry sequence cinemática
- [x] Cursor personalizado con interpolación
- [x] Glassmorphism en overlays y gameBar
- [x] Navegación scroll-aware
- [x] Micro-interacciones magnéticas
- [x] Transiciones de página con stagger
- [x] Grain overlay CRT mejorado

### D1–D6: Documentación

- [x] READMEs de 32 juegos actualizados
- [x] CLAUDE.md actualizado
- [x] README principal reescrito
- [x] metadata.json version bump + changelog
- [x] CONTRIBUTING.md creado
- [x] Screenshots 32/32

### M1–M7: Mejoras menores

- [x] `shared/input.js` — createGamepad() + bindHoldButton()
- [x] `scripts/verify.js` — Consistencia games.js ↔ disco ↔ sw.js
- [x] `test/smoke.test.js` — 32 smoke tests jsdom
- [x] `prefers-reduced-motion` en canvas
- [x] `package-lock.json` versionado
- [x] CLAUDE.md con skills completas
- [x] `.prettierignore` configurado

---

## 📊 Resumen final

| Métrica              | Valor                            |
| -------------------- | -------------------------------- |
| **Juegos**           | 32 (19 originales + 13 nuevos)   |
| **Tests**            | 320 (32 smoke + 288 específicos) |
| **Módulos shared**   | 11                               |
| **Commits totales**  | ~50+                             |
| **Última auditoría** | 2026-08-29                       |
| **Estado**           | 🟢 Cerrado — mantenimiento       |
