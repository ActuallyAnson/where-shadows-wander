// Fallback build: plain three.js + @iwsdk/xr-input. No IWSDK vite plugin, no ECS.
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'fallback',
  base: './',
  resolve: { alias: { '@iwsdk/core': 'three' }, dedupe: ['three'] },
  server: { port: 8082 },
  build: { outDir: '../dist-fallback', emptyOutDir: true, target: 'esnext' },
  esbuild: { target: 'esnext' },
});
