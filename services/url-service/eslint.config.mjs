import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import nPlugin from 'eslint-plugin-n';
import jestPlugin from 'eslint-plugin-jest';
import securityPlugin from 'eslint-plugin-security';
import globals from 'globals';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

export default [
  // ─── Global ignores ───────────────────────────────────────────────
  {
    ignores: ['node_modules/**', 'dist/**', 'build/**', 'coverage/**', '.nyc_output/**'],
  },

  // ─── Airbnb base ──────────────────────────────────────────────────
  ...compat.extends('airbnb-base'),

  // ─── Main source config ───────────────────────────────────────────
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    plugins: {
      prettier: prettierPlugin,
      import: importPlugin,
      n: nPlugin,
      security: securityPlugin,
    },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module', // change to 'commonjs' if you use require()
      globals: {
        ...globals.node,
      },
    },
    settings: {
      'import/resolver': {
        node: {
          extensions: ['.js', '.mjs', '.cjs', '.json'],
        },
      },
    },
    rules: {
      // ── Prettier owns all formatting ──────────────────────────────
      'prettier/prettier': 'error',

      // ── Node ──────────────────────────────────────────────────────
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'n/no-process-exit': 'error',

      // ── Airbnb overrides for Fastify ──────────────────────────────
      'no-underscore-dangle': 'off',
      'class-methods-use-this': 'off',
      'import/prefer-default-export': 'off',
      'no-restricted-syntax': ['error', 'LabeledStatement', 'WithStatement'],
      'import/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: [
            '**/*.test.js',
            '**/*.spec.js',
            '**/tests/**',
            'eslint.config.mjs', // ✅ allows devDeps in this file
            '*.config.mjs',
            '*.config.js',
          ],
        },
      ],

      // ── Security ──────────────────────────────────────────────────
      'security/detect-object-injection': 'warn',
      'security/detect-non-literal-fs-filename': 'warn',
    },
  },

  // ─── Jest / Supertest test files ──────────────────────────────────
  {
    files: ['**/*.test.js', '**/*.spec.js', '**/tests/**/*.js', '**/__tests__/**/*.js'],
    plugins: {
      jest: jestPlugin,
    },
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    rules: {
      ...jestPlugin.configs.recommended.rules,
      'jest/no-focused-tests': 'error',
      'jest/no-disabled-tests': 'warn',
      'jest/expect-expect': 'error',
      'jest/valid-expect': 'error',
      'no-await-in-loop': 'off',
      'import/no-extraneous-dependencies': 'off',
    },
  },

  // ─── Prettier must be last ─────────────────────────────────────────
  prettierConfig,
];
