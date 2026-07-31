import js from '@eslint/js';
import globals from 'globals';
import { defineConfig } from 'eslint/config';
import eslintPluginPrettier from 'eslint-plugin-prettier';
import configPrettier from 'eslint-config-prettier';

export default defineConfig([
  // ── Ignorar carpetas que no son parte del proyecto activo ──
  {
    ignores: ['node_modules/', 'games/legacy-3d/', 'server.log'],
  },

  // ── Configuración JS principal ──
  {
    files: ['**/*.{js,mjs,cjs}'],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'warn',
      'no-constant-binary-expression': 'error',
      'no-var': 'error',
      'prefer-const': 'warn',
    },
  },

  // ── Scripts de Node (verificación/CLI) — globals de Node, no browser ──
  {
    files: ['scripts/**/*.{js,mjs,cjs}', 'test/**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    rules: {
      // CLI y tests legitiman console.log
      'no-console': 'off',
    },
  },

  // ── Integración con Prettier (formateo) ──
  {
    plugins: { prettier: eslintPluginPrettier },
    rules: {
      ...configPrettier.rules,
      'prettier/prettier': 'warn',
    },
  },
]);
