import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts so unit tests never load the IWSDK dev plugin.
export default defineConfig({
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
