# Auditoría: Arcade Hub — informe

Fecha: 2026-08-16
Repositorio: carlosyoan99/arcade-hub
Descripción: Un hub que reúne recreaciones de juegos clásicos con estética 2D/2.5D.

Resumen ejecutivo
- Revisión realizada: README, package.json, listado top-level, y módulos compartidos clave (shared/audio.js, shared/display.js, shared/loop.js, shared/input.js). También se inspeccionaron README por juego (ej.: asteroids, breakout).
- Conclusión: arquitectura sólida, diseño "zero-deps" bien aplicado, buenas prácticas de rendimiento y accesibilidad. Los problemas principales son de lifecycle (listeners, cleanup), robustez en audio y riesgos operativos del Service Worker.

Hallazgos principales
1) Correctitud de los juegos
- Los smoke tests con jsdom validan carga y ausencia de errores de import, pero no verifican dinámicas visuales ni físicas.
- Recomendación: tests E2E ligeros (headless) para validar jugabilidad mínima por juego.

2) Rendimiento y cuellos de botella
- shared/display.js: DPR-aware y debounce con RAF. Falta establecer canvas.style.width/height explícito; posible desajuste visual si el layout CSS interactúa.
- shared/loop.js: uso correcto de RAF y cap de dt (0.05s). Considerar multi-step physics para objetos muy rápidos.
- shared/effects.js: documentado object-pooling y drawGlow (evita shadowBlur); confirmar ausencia de ctx.filter/getImageData en loops.

3) Memory leaks / fugas
- shared/input.js (original): añadía listeners globales en cada createGamepad() → riesgo de acumulación. También bindHoldButton no devolvía un unbind → listeners persistentes.
- Acción tomada: implementé createGamepad con listeners idempotentes y contador de referencias, y bindHoldButton ahora devuelve un function unbind() para cleanup.

4) Robustez del audio
- startAmbient() dependía de que audioCtx existiera; mejor que startAmbient invoque ensureAudio() internamente o documentar su uso explícito.
- Recomendación: modificar startAmbient() o documentar la obligación de llamar ensureAudio() tras interacción de usuario.

5) Service Worker / offline
- Riesgo: FILES en sw.js debe mantenerse sincronizado con archivos reales; olvidar un archivo rompe offline. Automatizar o validar estrictamente en CI.

6) Seguridad
- Bajo riesgo de supply‑chain (sin deps). Validar sanitización al escribir contenido en DOM y usar textContent en inputs visibles; revisar localStorage usage y namespacing.

7) Mantenibilidad
- Buena separación shared/games. Centralizar patterns de setup/teardown (lifecycle) y exponer API de destroy/unbind en shared modules.

Cambios aplicados (P0/P1)
- P0/P1 implementados en repo:
  - shared/input.js: listeners de gamepad idempotentes, createGamepad devuelve destroy(); bindHoldButton devuelve unbind().
  - Archivo de auditoría creado en /docs/audit-report.md (este fichero).

Recomendaciones priorizadas (resumen)
- P0 (urgente):
  1. Hacer idempotente createGamepad() o exponer destroy (hecho).
  2. Automatizar sincronización FILES ↔ sw.js en scripts/verify.js o en build/release.
- P1 (alta‑media):
  3. startAmbient() debería llamar a ensureAudio() o documentarlo claramente.
  4. Ajustar setupCanvas() para fijar canvas.style.width/height y documentar uso de x/y offsets.
  5. bindHoldButton debe devolver un unbind() (hecho) y los juegos deben invocar cleanup en su secuencia de cleanup.
- P2 (media):
  6. Añadir tests E2E headless por juego.
  7. Añadir logs en catch() en modo dev para debugging de audio/effects.
  8. Ejecutar lint/grep para detectar código muerto o exports no usados.
- P3 (baja):
  9. Integrar axe-core en CI para comprobaciones A11y de un subconjunto de juegos.
 10. Documentar política de autoplay/audio y pattern recomendado para ensureAudio().

Checklist de seguimiento (por PR/release)
- [ ] scripts/verify.js pasa y lista sincronizada con sw.js
- [ ] No listeners globales añadidos sin destroy en shared modules
- [ ] Todos los juegos llaman a cleanup: loop.stop(), canvas.destroy(), closeAudio(), unbind() de botones
- [ ] E2E mínimo (start + 5s) para juegos modificados
- [ ] Verificar que localStorage keys no permitan inyección

Siguientes pasos que puedo ejecutar (opcional)
- Generar PRs con diffs sugeridos para startAmbient(), setupCanvas() y ajustes de sw.js automatizado.
- Preparar tests E2E de ejemplo (Playwright/ Puppeteer) para 3 juegos prioritarios.

Fin del informe.
