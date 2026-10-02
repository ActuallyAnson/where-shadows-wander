// Lint rules. The important one is the pure-code boundary: hand maths, the
// simulation, stage maths and gameplay must not import IWSDK, three.js, the
// emulator or any engine-facing folder, and must not touch browser globals.
// That keeps them unit-testable in Node and the plain three.js fallback cheap
// (docs/adr/0001-iwsdk-as-xr-and-view-layer.md, 0002-plain-threejs-fallback.md).
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// src/engine/shadow/pure holds the shadow projection maths: pure, so it's unit-tested
// in Node, while the rest of src/engine/shadow draws with three.js.
const PURE_FOLDERS = [
  'src/engine/hands/**',
  'src/engine/sim/**',
  'src/engine/stage/**',
  'src/game/**',
  'src/engine/shadow/pure/**',
];

export default tseslint.config(
  { ignores: ['dist/**', 'dist-*/**', 'spikes/**', 'recordings/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: { globals: globals.browser },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['info', 'warn', 'error'] }],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    files: PURE_FOLDERS,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@iwsdk/*', 'three', 'three/*', 'super-three', 'iwer', 'iwer/*', '@mediapipe/*'],
              message: 'Pure code must not import IWSDK, three.js, the emulator or MediaPipe.',
            },
            {
              group: [
                '**/app/**',
                '**/debug/**',
                '**/input-mock/**',
                '**/ui/**',
                '**/xr/**',
                '**/shadow/**',
                '**/render/**',
                '**/anim/**',
                '**/services/**',
              ],
              message: 'Pure code must not import engine-facing folders.',
            },
          ],
        },
      ],
      'no-restricted-globals': ['error', 'window', 'document', 'navigator', 'localStorage', 'location', 'performance'],
    },
  },
  {
    files: ['**/*.test.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
  {
    files: ['scripts/**/*.mjs', '*.config.{js,ts}', 'eslint.config.js', 'eval/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Scripts run inside the managed browser by `npx iwsdk browser run`.
    files: ['scripts/census.mjs', 'scripts/read-report.mjs'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  prettier,
);
