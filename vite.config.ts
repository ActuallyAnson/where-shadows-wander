import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { iwsdkDev } from '@iwsdk/vite-plugin-dev';
import { defineConfig } from 'vite';

function buildId(): string {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'unknown';
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [iwsdkDev()],
  server: { host: '0.0.0.0', port: 8081, open: false },
  // Relative URLs so the build works under a GitHub Pages project subpath.
  base: './',
  publicDir: 'public',
  define: { __BUILD_ID__: JSON.stringify(buildId()) },
  build: {
    outDir: 'dist',
    // No source maps in production builds (vite build), whatever NODE_ENV is.
    sourcemap: mode !== 'production',
    // Not esnext: other headset browsers (Pico) may run an older Chromium than
    // Quest Browser. Chrome 100 still covers WebXR hands, anchors and planes.
    target: ['es2022', 'chrome100'],
    rollupOptions: { input: { main: './index.html', webcam: './webcam.html' } },
  },
  esbuild: { target: 'esnext' },
  resolve: {
    alias: [
      // @drawcall/uikitml imports the whole lucide icon set at module top level,
      // even with spatialUI off (about 1 MB gzipped). Keep only the two icons
      // @pmndrs/uikit-horizon needs. Remove this if we ever use lucide icons.
      // See docs/adr/0001-iwsdk-as-xr-and-view-layer.md.
      {
        find: /^@pmndrs\/uikit-lucide$/,
        replacement: fileURLToPath(new URL('./src/app/stubs/lucide-subset.ts', import.meta.url)),
      },
    ],
    // One three.js (super-three@0.181) and one uikit graph, never two.
    dedupe: ['three', '@pmndrs/uikit', '@pmndrs/uikit-horizon'],
  },
  optimizeDeps: {
    exclude: ['@babylonjs/havok'],
    // Pre-bundle the lucide subset so the first dev load doesn't re-optimise (504s).
    include: ['@pmndrs/uikit-lucide/dist/Check.js', '@pmndrs/uikit-lucide/dist/ChevronDown.js'],
    esbuildOptions: { target: 'esnext' },
  },
}));
