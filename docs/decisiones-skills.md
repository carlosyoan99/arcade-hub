# Decisiones — skills aplicables al proyecto

> 25-nov-2026 · Análisis de skills del repo y del host, con recomendaciones aceptadas/rechazadas.

## Inventario real

| Capa | Ubicación | Cantidad |
| --- | --- | --- |
| Registradas | `.agents/skills/<nombre>/SKILL.md` (`skills-lock.json`) | 9: accessibility, frontend-design, nodejs-backend-patterns, nodejs-best-practices, playwright-best-practices, seo, typescript-advanced-types, vite, vitest |
| Planas | `.agents/skills/*.md` | 26 (game-feel, audio-design, input-systems, save-systems, procedural-gen, refactor, documentation-writter, …) |
| Host | OpenCode | 2: `opencode`, `report` |
| Biblioteca | `.agents/skills/assets/`, `references/` | 35 documentos de apoyo |

`AGENTS.md` mencionaba solo 5; el inventario completo está aquí.

## Aceptadas

| Skill | Cuándo | Acción concreta |
| --- | --- | --- |
| **playwright-best-practices** | Ahora | Page Objects para el HUB, test WebSocket para F5 y gate de axe; sin nuevas deps y sin subir los 2 workers. |
| **accessibility** | Ahora | Checklist WCAG 2.2 AA sobre `ui/shell`, `hud`, `help`, `settings` y el futuro HUB; `prefers-reduced-motion` modera partículas. El juice nunca depende solo de color/audio. |
| **typescript-advanced-types** | Ahora | Uniones discriminadas para eventos y mensajes ws; `expectTypeOf` en tests de contrato; `unknown` en lugar de `any`. Ya hay catálogo `game/events.ts`. |
| **vitest (API v2)** | Ahora | Timers falsos solo en tests de `scheduler`/`clock`; fixtures de juegos. **No** usar `vi.when` ni otras APIs de v4/v5. |
| **game-feel** | Tras migrar los juegos | Mapa evento → partícula/audio (trauma², hit-stop, squash) **solo** en `render/` y `audio/`; nunca dentro de `step()`. |
| **frontend-design** | Fase HUB minimalista | 4-6 tokens de color, una familia tipográfica, wireframe y autocrítica Anti-defaults. Sin Google Fonts nuevas. |
| **nodejs-best-practices / nodejs-backend-patterns** | F5, filtrado | Capas transporte→sala→relay, validación en frontera, shutdown limpio, `ws` como única dependencia. Descartar Express/Fastify/Zod/Pino/BD. |
| **documentation-writter / refactor / refactor-plan** | Fase final | Reorganización Diátaxis de `docs/`, extracción de duplicados del motor con verificación del hash golden y plan con rollback. |

## Rechazadas o limitadas

- **vite** (skill documenta Vite 8/Rolldown): el repo usa Vite 6 con Vitest 2; migrar rompería build y golden hash. Solo consulta puntual de configuración.
- **seo**: no aplica al motor; solo regenerar `sitemap.xml`/`lastmod` en la fase final del HUB. Sin SSR ni JSON-LD en runtime.
- **game-engine / premium-frontend-ui / dialogue-systems / shader-programming**: genéricas, con frameworks o narrativa/WebGL fuera del alcance (arcade 2D, Canvas 2D, cero dependencias).
- **create-agentsmd / create-readme**: regenerarlas borraría las reglas no negociables del motor. Edición manual.
- **report (host)**: solo para bugs de OpenCode; requiere confirmación antes de publicar. Los bugs B1-B8 se documentan en `docs/`, no se publican con ese skill.
- **opencode (host)**: configuración del harness, no del producto.

## Restricción transversal

La regla 6 (`AGENTS.md`: sin dependencias de runtime nuevas) es el filtro más importante. Cualquier skill que proponga frameworks, Zod o animación pesada se descarta o se recorta a sus ideas engine-neutral. Ninguna skill puede alterar el orden de consumo del RNG ni el hash golden `600:3336926330:e22d095e-20`.
