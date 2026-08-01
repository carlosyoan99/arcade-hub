---

name: 🐛 Bug report
about: Reportá un error para ayudarnos a mejorar
title: "[Bug] "
labels: ["bug"]
assignees: ""

body:

- type: markdown
  attributes:
  value: |
  Gracias por tomarte el tiempo de reportar un bug 🐛
  Antes de abrir, revisá la [guía de contribución](CONTRIBUTING.md) y los issues existentes para evitar duplicados.
- type: input
  id: game
  attributes:
  label: 🎮 Juego afectado
  description: ¿Qué juego presenta el problema? (o "Hub" si es el hub principal)
  placeholder: "Ej: Pac-Man, Tetris, Hub..."
  validations:
  required: true
- type: textarea
  id: description
  attributes:
  label: 📝 Descripción del bug
  description: Describí qué está pasando con el mayor detalle posible.
  placeholder: "El juego se congela cuando llego a la oleada 3..."
  validations:
  required: true
- type: textarea
  id: steps
  attributes:
  label: 🔁 Pasos para reproducir
  description: Pasos concretos para que podamos reproducirlo.
  placeholder: | 1. Abro el juego desde el hub 2. Presiono Espacio para empezar 3. Al llegar a la oleada 3...
  value: | 1. 2. 3.
  validations:
  required: true
- type: textarea
  id: expected
  attributes:
  label: ✅ Comportamiento esperado
  placeholder: "Debería continuar la partida sin congelarse."
  validations:
  required: true
- type: textarea
  id: actual
  attributes:
  label: ❌ Comportamiento actual
  placeholder: "En cambio, el juego se detiene y no responde."
  validations:
  required: true
- type: dropdown
  id: input_mode
  attributes:
  label: 🎮 Modo de entrada
  description: ¿Cómo estabas jugando?
  options: - Teclado - Táctil (móvil/tablet) - Gamepad - No sé
  default: 0
  validations:
  required: false
- type: input
  id: environment
  attributes:
  label: 🌐 Entorno
  description: Navegador, versión y sistema operativo.
  placeholder: "Ej: Chrome 150, Windows 11"
  validations:
  required: false
- type: textarea
  id: console
  attributes:
  label: 🖥️ Errores de consola
  description: Pegá acá cualquier error visible en DevTools (F12 → Console).
  render: shell
- type: textarea
  id: extra
  attributes:
  label: 📎 Contexto adicional
  description: Capturas de pantalla, videos o notas extra que ayuden a diagnosticar.
