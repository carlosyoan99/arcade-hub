---

name: ✨ Feature request
about: Sugerí una mejora o un juego nuevo
title: "[Feature] "
labels: ["enhancement"]
assignees: ""

body:

- type: markdown
  attributes:
  value: |
  Gracias por proponer una mejora ✨
  Antes de abrir, revisá la [guía de contribución](CONTRIBUTING.md) — incluye cómo agregar un juego nuevo paso a paso.
- type: input
  id: summary
  attributes:
  label: 🎯 Resumen de la propuesta
  description: Una frase clara sobre qué querés proponer.
  placeholder: "Ej: Agregar un juego estilo Frogger con modo 2 jugadores"
  validations:
  required: true
- type: textarea
  id: description
  attributes:
  label: 📝 Descripción detallada
  description: Explicá la feature o el juego propuesto con detalle (mecánicas, pantallas, controles...).
  validations:
  required: true
- type: textarea
  id: problem
  attributes:
  label: 🎯 Problema que resuelve
  description: ¿Qué necesidad cubre? ¿Por qué sería valioso para el Arcade Hub?
  validations:
  required: true
- type: dropdown
  id: proposal_type
  attributes:
  label: 🏷️ Tipo de propuesta
  description: ¿Qué es lo que proponés?
  options: - Juego nuevo - Mejora de un juego existente - Mejora del hub - Mejora de accesibilidad / rendimiento - Otro
  default: 0
  validations:
  required: true
- type: textarea
  id: alternatives
  attributes:
  label: 🔄 Alternativas consideradas
  description: ¿Consideraste otras soluciones o enfoques?
- type: checkboxes
  id: conventions
  attributes:
  label: 📋 Convenciones del proyecto
  description: Marcá lo que aplique a tu propuesta (ver CONTRIBUTING.md para más detalle)
  options: - label: Canvas 2D / 2.5D (sin motores 3D) - label: Cero dependencias externas - label: Paridad de controles (teclado / táctil / gamepad) - label: Accesibilidad (aria-live, prefers-reduced-motion, role="img")
- type: textarea
  id: extra
  attributes:
  label: 📎 Contexto adicional
  description: Capturas, bocetos, referencias o cualquier otra información útil.
