import { execSync } from 'node:child_process';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { iwsdkDev } from '@iwsdk/vite-plugin-dev';
import { defineConfig, normalizePath, type Plugin } from 'vite';
import {
  buildAssetTree,
  folderPathProblem,
  glbProblem,
  idProblem,
  MODEL_MAX_BYTES,
  MODELS_FOLDER,
  modelPathProblem,
  moveProblem,
  type AssetFileInfo,
} from './src/engine/services/assets/asset-tree';
import { assetIdOf } from './src/engine/services/assets/budgets.mjs';
import { modelIdsOf, parseRoomLayout } from './src/engine/stage/room-layout';

const ASSETS_DIR = fileURLToPath(new URL('./src/assets/', import.meta.url));
const MODELS_DIR = resolve(ASSETS_DIR, MODELS_FOLDER);
const ROOMS_DIR = fileURLToPath(new URL('./content/rooms/', import.meta.url));
/** What src/app/assets.ts globs into the asset manifest. */
const MANIFEST_FILE = /\.(glb|png|jpg|jpeg|webp|ktx2|hdr|exr|mp3|ogg|opus|m4a|wav)$/;

/** Folders and files under `dir` (paths relative to it, forward slashes), leaving out dot-files and half-written `.part` files. */
function walk(dir: string, rel = '', out = { folders: [] as string[], files: [] as string[] }) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name.endsWith('.part')) continue;
    const path = rel === '' ? entry.name : `${rel}/${entry.name}`;
    if (entry.isDirectory()) {
      out.folders.push(path);
      walk(join(dir, entry.name), path, out);
    } else out.files.push(path);
  }
  return out;
}

/** Every file the asset manifest takes, relative to src/assets ('models/chair.glb', 'audio/rain.ogg'). */
function manifestFiles(): string[] {
  return walk(ASSETS_DIR).files.filter((f) => MANIFEST_FILE.test(f));
}

/** The asset ids the room layouts in content/rooms place. */
function usedModelIds(): Set<string> {
  const used = new Set<string>();
  if (!existsSync(ROOMS_DIR)) return used;
  for (const name of readdirSync(ROOMS_DIR)) {
    if (!name.endsWith('.json')) continue;
    try {
      for (const id of modelIdsOf(parseRoomLayout(JSON.parse(readFileSync(join(ROOMS_DIR, name), 'utf8'))).layout))
        used.add(id);
    } catch {
      // A broken layout file places nothing; the game reports it.
    }
  }
  return used;
}

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
 * (src/debug/room-editor.ts, opened from the launcher's Developer panel) saves straight into the repository. The body must read as a
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
          if (problems.length === 0) {
            // A placed model must have its file, or the game would stand nothing there.
            const ids = new Set(manifestFiles().map((f) => assetIdOf(f)));
            const layout = parseRoomLayout(JSON.parse(text)).layout;
            for (const model of modelIdsOf(layout))
              if (!ids.has(model)) problems.push(`no model "${model}" in src/assets`);
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

/** Reads a request's body, up to `max` bytes; null if it was longer (the rest is read and dropped). */
function readBody(req: IncomingMessage, max: number): Promise<Buffer | null> {
  return new Promise((done, fail) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size <= max) chunks.push(c);
    });
    req.on('end', () => done(size > max ? null : Buffer.concat(chunks)));
    req.on('error', fail);
  });
}

/** Renames, trying again for a moment when Windows still holds the file (a virus scanner, the file watcher). */
function renameRetrying(from: string, to: string): void {
  for (let attempt = 0; ; attempt++) {
    try {
      renameSync(from, to);
      return;
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (attempt >= 20 || (code !== 'EBUSY' && code !== 'EPERM' && code !== 'EACCES')) throw e;
      const until = Date.now() + 25;
      while (Date.now() < until) {
        // A short wait: this runs on the dev server, for one request, rarely.
      }
    }
  }
}

/**
 * Dev server only: the room editor's asset browser (src/debug/room-editor-assets.ts) changes src/assets/models through
 * /__wsw/assets/: GET tree, POST file?path=&overwrite=1 (the body is the .glb), POST mkdir?path=, POST move?from=&to=
 * (a rename too) and POST delete?path=. The rules are in src/engine/services/assets/asset-tree.ts: names, ids that would clash
 * in the asset manifest, the model budget, a self-contained .glb, and nothing the room layouts place may be renamed or
 * deleted. Every answer that changes something is the new tree.
 *
 * A file added, changed or deleted under src/assets/models doesn't reload the page (it would end the editor's session); the
 * asset list module is still marked stale, so the next reload sees the files as they are. See docs/adr/0015.
 */
function wswAssets(): Plugin[] {
  const modelsPrefix = normalizePath(MODELS_DIR) + '/';
  const underModels = (file: string) => normalizePath(file).startsWith(modelsPrefix);

  /** The absolute path of `rel` in the models folder, or null if it would be outside it. */
  const abs = (rel: string): string | null => {
    const p = resolve(MODELS_DIR, rel);
    return p === MODELS_DIR || p.startsWith(MODELS_DIR + sep) ? p : null;
  };

  const tree = () => {
    const { folders, files } = walk(MODELS_DIR);
    const infos: AssetFileInfo[] = files
      .filter((f) => f.endsWith('.glb'))
      .map((path) => {
        const st = statSync(join(MODELS_DIR, path));
        return { path, id: assetIdOf(path), bytes: st.size, mtimeMs: Math.round(st.mtimeMs) };
      });
    return { tree: buildAssetTree(folders, infos), used: [...usedModelIds()].sort() };
  };

  const answer = (res: ServerResponse, status: number, body: unknown) => {
    res.statusCode = status;
    if (typeof body === 'string') {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(body);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(body));
    }
  };

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '', 'http://localhost');
    const action = url.pathname.replace(/^\/+/, '');
    const q = (name: string) => url.searchParams.get(name) ?? '';
    if (req.method === 'GET' && action === 'tree') return answer(res, 200, tree());
    if (req.method !== 'POST') return answer(res, 405, 'use POST');

    if (action === 'file') {
      const rel = q('path');
      const problem = modelPathProblem(rel);
      const target = abs(rel);
      if (problem || !target) return answer(res, 400, problem ?? 'outside the models folder');
      if (Number(req.headers['content-length'] ?? 0) > MODEL_MAX_BYTES) {
        req.resume();
        return answer(res, 413, `over the ${Math.round(MODEL_MAX_BYTES / 1024)} KB model budget`);
      }
      const body = await readBody(req, MODEL_MAX_BYTES);
      if (!body) return answer(res, 413, `over the ${Math.round(MODEL_MAX_BYTES / 1024)} KB model budget`);
      const bad = glbProblem(new Uint8Array(body.buffer, body.byteOffset, body.byteLength));
      if (bad) return answer(res, 422, bad);
      const exists = existsSync(target);
      if (exists && q('overwrite') !== '1') return answer(res, 409, `there is already a ${rel}`);
      const self = exists ? `${MODELS_FOLDER}/${rel}` : undefined;
      const clash = idProblem(`${MODELS_FOLDER}/${rel}`, manifestFiles(), self);
      if (clash) return answer(res, 409, clash);
      mkdirSync(resolve(target, '..'), { recursive: true });
      writeFileSync(`${target}.part`, body);
      renameRetrying(`${target}.part`, target);
      return answer(res, 200, tree());
    }

    if (action === 'mkdir') {
      const rel = q('path');
      const problem = rel === '' ? 'name the folder' : folderPathProblem(rel);
      const target = abs(rel);
      if (problem || !target) return answer(res, 400, problem ?? 'outside the models folder');
      if (existsSync(target)) return answer(res, 409, `there is already a ${rel}`);
      mkdirSync(target, { recursive: true });
      return answer(res, 200, tree());
    }

    if (action === 'move') {
      const from = q('from'),
        to = q('to');
      const source = abs(from),
        target = abs(to);
      if (!source || !target || from === '') return answer(res, 400, 'outside the models folder');
      if (!existsSync(source)) return answer(res, 404, `there is no ${from}`);
      const isFolder = statSync(source).isDirectory();
      const problem = moveProblem(from, to, isFolder, manifestFiles(), usedModelIds());
      if (problem) return answer(res, 409, problem);
      const caseOnly = from.toLowerCase() === to.toLowerCase();
      if (existsSync(target) && !caseOnly) return answer(res, 409, `there is already a ${to}`);
      mkdirSync(resolve(target, '..'), { recursive: true });
      if (caseOnly) {
        // Windows' file names ignore case: go by a spare name.
        const spare = `${source}.renaming`;
        renameRetrying(source, spare);
        renameRetrying(spare, target);
      } else renameRetrying(source, target);
      return answer(res, 200, tree());
    }

    if (action === 'delete') {
      const rel = q('path');
      const target = abs(rel);
      if (!target || rel === '') return answer(res, 400, 'name a file or folder in the models folder');
      if (!existsSync(target)) return answer(res, 404, `there is no ${rel}`);
      const used = usedModelIds();
      const inside = statSync(target).isDirectory() ? walk(target).files.map((f) => `${rel}/${f}`) : [rel];
      const placed = inside.filter((f) => f.endsWith('.glb') && used.has(assetIdOf(f)));
      if (placed.length > 0)
        return answer(res, 409, `placed in the room: ${placed.join(', ')}. Remove it there and save first`);
      rmSync(target, { recursive: true });
      return answer(res, 200, tree());
    }
    return answer(res, 404, 'no such action');
  }

  return [
    {
      name: 'wsw-assets',
      apply: 'serve',
      enforce: 'pre',
      // Overwriting a model: no reload (IWSDK's dev plugin would reload its scene editor's page otherwise).
      hotUpdate({ type, file }) {
        if (type === 'update' && underModels(file)) return [];
      },
      configureServer(server) {
        server.middlewares.use('/__wsw/assets/', (req, res) => {
          handle(req, res).catch((e: unknown) => answer(res, 500, String(e)));
        });
      },
    },
    {
      name: 'wsw-assets-after-glob',
      apply: 'serve',
      // Adding or deleting a model: Vite's glob plugin hands back the asset list module, and nothing takes that update, so the
      // page would reload. Mark the modules stale (the next reload reads the folder as it is) and send nothing.
      hotUpdate: {
        order: 'post',
        handler({ type, file, modules }) {
          if ((type === 'create' || type === 'delete') && underModels(file)) {
            for (const m of modules) this.environment.moduleGraph.invalidateModule(m);
            return [];
          }
        },
      },
    },
  ];
}

export default defineConfig(({ mode }) => ({
  plugins: [iwsdkDev(), saveRecordings(), saveRoomLayouts(), ...wswAssets()],
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
