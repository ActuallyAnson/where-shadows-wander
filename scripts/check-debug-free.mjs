// The judges' build must not contain the debug tools (src/debug/debug-flag.ts). This builds the game twice, in fresh
// processes the way `npm run build` runs: once normally and once as a tester build (`--mode tester`), and looks for text
// that only the debug code has. The tester build proves the markers can be found, so the normal build lacking them means
// something. Usage: node scripts/check-debug-free.mjs   (about 10 seconds; exit code 1 on a leak)
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Text that is in the bundle only if a debug tool is. Add one when a new debug tool is added. */
const MARKERS = [
  'Alt+K capsules', // the HUD line (debug-tools.ts)
  'Joint dots', // the debug menu (debug-controller.ts)
  'Testing: switches', // the launcher's Testing panel (testing-panel.ts)
  'Copy report', // the report panel (report-panel.ts)
  'WebXR Launcher Ready', // the launcher's log box (enter-ar-button.ts)
  'Copy Logs', // the launcher's log button (enter-ar-button.ts)
  'Save room layout', // the room editor (room-editor.ts)
  'Add to room', // the room editor's asset browser (room-editor-assets.ts)
];

const jsIn = (dir) =>
  readdirSync(dir, { withFileTypes: true })
    .map((e) => {
      const p = join(dir, e.name);
      if (e.isDirectory()) return jsIn(p);
      return /\.(js|mjs)$/.test(e.name) ? readFileSync(p, 'utf8') : '';
    })
    .join('');

function build(mode) {
  const dir = mkdtempSync(join(tmpdir(), `wsw-${mode}-`));
  const env = { ...process.env, NODE_ENV: 'production' };
  execFileSync(
    process.execPath,
    [
      './node_modules/vite/bin/vite.js',
      'build',
      '--mode',
      mode,
      '--outDir',
      dir,
      '--emptyOutDir',
      '--logLevel',
      'error',
    ],
    {
      env,
      stdio: ['ignore', 'ignore', 'inherit'],
    },
  );
  const text = jsIn(dir);
  rmSync(dir, { recursive: true, force: true });
  return text;
}

const tester = build('tester');
const missing = MARKERS.filter((m) => !tester.includes(m));
if (missing.length) {
  console.error(
    `check-debug-free: the tester build is missing ${missing.map((m) => `"${m}"`).join(', ')}: the markers are stale.`,
  );
  process.exit(1);
}
const plain = build('production');
const leaked = MARKERS.filter((m) => plain.includes(m));
if (leaked.length) {
  console.error(`check-debug-free: the normal build contains debug code: ${leaked.map((m) => `"${m}"`).join(', ')}`);
  process.exit(1);
}
console.log(
  `debug tools: absent from the normal build (${Math.round(plain.length / 1024)} KB of JS), present in the tester build (${Math.round(tester.length / 1024)} KB)`,
);
