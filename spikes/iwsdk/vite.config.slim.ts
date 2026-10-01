// Experiment: same as vite.config.ts, but stubs @pmndrs/uikit-lucide (pulled in
// unconditionally by @drawcall/uikitml even when spatialUI is disabled).
import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig } from 'vite';
import base from './vite.config';

export default mergeConfig(base, defineConfig({
  resolve: {
    alias: {
      '@pmndrs/uikit-lucide': fileURLToPath(new URL('./src/stubs/empty-lucide.ts', import.meta.url)),
    },
  },
  build: { outDir: 'dist-slim' },
}));
