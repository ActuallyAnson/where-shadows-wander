// Fails if a file the game downloads is over its size budget, or the first-load JavaScript is. The rules and
// numbers are in src/engine/services/assets/budgets.mjs, which the unit tests cover.
//   node scripts/check-budgets.mjs            the asset files in src/assets and public, and the critical total
//   node scripts/check-budgets.mjs --bundle   also the first-load JavaScript in dist/ (gzipped); run after
//                                             `vite build` (npm run build does)
// "Critical" means a file whose first folder under src/assets is `critical`: the world waits for those at start.
// Files in dist/ are not checked one by one: Vite flattens their folders (so music could not be told from
// sound effects) and the same files are checked here at their source.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import {
  BUDGETS,
  checkCriticalTotal,
  checkFile,
  checkInitialBundle,
  checkSourceName,
  classify,
  firstLoadFiles,
  priorityOf,
} from '../src/engine/services/assets/budgets.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const kb = (b) => (b / 1024).toFixed(b < 10240 ? 1 : 0);
const problems = [];
const add = (message) => message && problems.push(message);

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}

const assetsDir = join(root, 'src/assets');
const sources = walk(assetsDir).map((f) => ({ path: relative(root, f), bytes: statSync(f).size }));
for (const f of sources) {
  add(checkSourceName(f.path));
  add(checkFile(f.path, f.bytes));
}
const publicFiles = walk(join(root, 'public')).map((f) => ({ path: relative(root, f), bytes: statSync(f).size }));
for (const f of publicFiles) add(checkFile(f.path, f.bytes));
const checked = [...sources, ...publicFiles].filter((f) => classify(f.path) !== null).length;
console.log(`source: ${checked} asset file${checked === 1 ? '' : 's'} checked`);

const critical = sources.filter((f) => priorityOf(f.path) === 'critical' && classify(f.path) !== null);
const criticalBytes = critical.reduce((sum, f) => sum + f.bytes, 0);
console.log(`critical: ${critical.length} file(s), ${kb(criticalBytes)} KB of ${kb(BUDGETS.criticalTotalBytes)} KB`);
add(checkCriticalTotal(critical));

if (process.argv.includes('--bundle')) {
  const dist = join(root, 'dist');
  const htmlPath = join(dist, 'index.html');
  if (!existsSync(htmlPath)) {
    console.error('no dist/index.html: run `vite build` first');
    process.exit(2);
  }
  const ageMin = Math.round((Date.now() - statSync(htmlPath).mtimeMs) / 60000);
  const files = firstLoadFiles(readFileSync(htmlPath, 'utf8'), (f) =>
    existsSync(join(dist, f)) ? readFileSync(join(dist, f), 'utf8') : null,
  );
  if (files.length === 0) {
    add(
      'dist/index.html names no script under assets/, so the first-load size could not be measured (is the base path absolute?)',
    );
  } else {
    // Gzip at the default level, as a static host uses, not the slowest and smallest.
    const gzip = files.reduce((sum, f) => sum + gzipSync(readFileSync(join(dist, f))).length, 0);
    console.log(
      `initial bundle: ${files.length} files, ${kb(gzip)} KB gzipped of ${kb(BUDGETS.initialBundleGzipBytes)} KB (dist built ${ageMin} min ago)`,
    );
    add(checkInitialBundle(gzip));
  }
}

if (problems.length) {
  console.error('\nOver budget or not usable:');
  for (const p of problems) console.error('  ' + p);
  process.exit(1);
}
console.log('within budget');
