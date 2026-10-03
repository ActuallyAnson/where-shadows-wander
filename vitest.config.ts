import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts so unit tests never load the IWSDK dev plugin.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // The allocation test (frame-pipeline.alloc.test.ts) forces a collection first and gives the young generation
    // room for its whole measuring window, so the heap it reads has seen no collection.
    poolOptions: { forks: { execArgv: ['--expose-gc', '--min-semi-space-size=64', '--max-semi-space-size=128'] } },
  },
});
