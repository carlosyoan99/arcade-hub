import { defineConfig } from 'vite';

/** Build del HUB como sitio estático (dist-hub/), separado del build de librería. */
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist-hub',
    emptyOutDir: true,
    target: 'es2022',
  },
});
