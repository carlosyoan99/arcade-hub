import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    target: 'es2022',
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: 'index',
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
