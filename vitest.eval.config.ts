import { defineConfig } from 'vitest/config';

// `npm run eval`: scores the shape classifier against labelled recordings (eval/classifier.eval.ts).
// Separate from the unit tests, which must not depend on local recordings.
export default defineConfig({
  test: { include: ['eval/**/*.eval.ts'], environment: 'node', testTimeout: 600_000 },
});
