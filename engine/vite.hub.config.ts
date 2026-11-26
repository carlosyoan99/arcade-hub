import { defineConfig } from 'vite';

/** Build del HUB como sitio estático en la raíz del repo, separado del build de librería. */
export default defineConfig({
  base: './',
  build: {
    outDir: '..',
    emptyOutDir: false,
    target: 'es2022',
  },
});
