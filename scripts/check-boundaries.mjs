// Fails if pure code (hand maths, sim, stage maths, gameplay) imports IWSDK,
// three.js, or an engine-facing folder.
// Keeps the plain three.js fallback (docs/adr/0002-plain-threejs-fallback.md) cheap.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const PURE_DIRS = ['src/engine/hands', 'src/engine/sim', 'src/engine/stage', 'src/game'];
const FORBIDDEN = [
  { re: /^@iwsdk\//, why: 'IWSDK' },
  { re: /^(three|super-three)(\/|$)/, why: 'three.js' },
  { re: /^iwer(\/|$)/, why: 'the emulator' },
  { re: /(^|\/)(app|debug|input-mock|ui|xr|shadow|render|anim|services)(\/|$)/, why: 'an engine-facing folder' },
];
const IMPORT = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g;

function* files(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/\.(ts|js|mjs)$/.test(name)) yield p;
  }
}

const problems = [];
for (const dir of PURE_DIRS) {
  for (const file of files(dir)) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(IMPORT)) {
      const spec = m[1] ?? m[2] ?? m[3];
      const hit = FORBIDDEN.find((f) => f.re.test(spec));
      if (hit) problems.push(`${relative('.', file)}: imports '${spec}' (${hit.why})`);
    }
  }
}
if (problems.length) {
  console.error(`Pure code must not import IWSDK, three.js or engine-facing folders:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`boundaries ok (${PURE_DIRS.join(', ')})`);
