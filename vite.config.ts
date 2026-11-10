import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { iwsdkDev } from '@iwsdk/vite-plugin-dev';
import { defineConfig, normalizePath, type Plugin } from 'vite';
import { parseRoomLayout } from './src/engine/stage/room-layout';

function buildId(): string {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'unknown';
  }
}

/**
 * Dev server only: POST /__wsw/recordings/<name>.handrec.json writes the body
 * to recordings/, so the Hand Lab can save a recording without a browser
 * download (which can crash Chrome for Testing) and the file lands where
 * `npm run eval` reads it.
 */
function saveRecordings(): Plugin {
  const dir = fileURLToPath(new URL('./recordings/', import.meta.url));
  return {
    name: 'wsw-save-recordings',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__wsw/recordings/', (req, res) => {
        const name = (req.url ?? '').replace(/^\//, '');
        if (req.method !== 'POST' || !/^[\w.-]+\.handrec\.json$/.test(name)) {
          res.statusCode = 400;
          return res.end('bad request');
        }
        const chunks: Buffer[] = [];
        let size = 0;
        req.on('data', (c: Buffer) => {
          size += c.length;
          if (size > 64e6) req.destroy();
          else chunks.push(c);
        });
        req.on('end', () => {
          mkdirSync(dir, { recursive: true });
          writeFileSync(dir + name, Buffer.concat(chunks));
          res.end('ok');
        });
      });
    },
  };
}

/**
 * Dev server only: POST /__wsw/rooms/<name>.json writes a room layout to content/rooms/, so the room editor
 * (src/debug/room-editor.ts, ?mock=1&edit=room) saves straight into the repository. The body must read as a
 * layout with no problems (src/engine/stage/room-layout.ts); anything else is refused and nothing is written.
 */
function saveRoomLayouts(): Plugin {
  const dir = fileURLToPath(new URL('./content/rooms/', import.meta.url));
  const rooms = normalizePath(dir);
  return {
    name: 'wsw-save-room-layouts',
    apply: 'serve',
    enforce: 'pre',
    // A change to a room layout (a save from the editor, or an edit by hand) doesn't reload the page, which would throw away
    // the editor's session; Vite still drops its cached copy, so the next reload reads the file as it is now.
    hotUpdate({ file }) {
      if (normalizePath(file).startsWith(rooms)) return [];
    },
    configureServer(server) {
      server.middlewares.use('/__wsw/rooms/', (req, res) => {
        const name = (req.url ?? '').replace(/^\//, '');
        if (req.method !== 'POST' || !/^[a-z0-9-]+\.json$/.test(name)) {
          res.statusCode = 400;
          return res.end('bad request');
        }
        const chunks: Buffer[] = [];
        let size = 0;
        req.on('data', (c: Buffer) => {
          size += c.length;
          if (size > 256e3) req.destroy();
          else chunks.push(c);
        });
        req.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let problems: string[];
          try {
            problems = parseRoomLayout(JSON.parse(text)).problems;
          } catch (e) {
            problems = [`not JSON: ${String(e)}`];
          }
          if (problems.length > 0) {
            res.statusCode = 422;
            return res.end(problems.join('; '));
          }
          mkdirSync(dir, { recursive: true });
          writeFileSync(dir + name, text);
          res.end('ok');
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [iwsdkDev(), saveRecordings(), saveRoomLayouts()],
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
