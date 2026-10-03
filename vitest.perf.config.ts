import { defineConfig } from 'vitest/config';

// `npm run perf`: times the per-frame hand pipeline stage by stage on this machine.
// Not part of `npm run check`: timings on shared CI machines are too noisy to fail a build.
export default defineConfig({
  test: { benchmark: { include: ['src/**/*.perf.ts'] }, environment: 'node' },
});
