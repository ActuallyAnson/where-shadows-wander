// Fails unless exactly one three.js is installed and it is the pinned super-three fork.
// (The aliased package reports its real name, super-three; a stray real three reports "three".)
import { execSync } from 'node:child_process';

const EXPECTED = 'super-three@0.181.0';
const found = JSON.parse(execSync('npm query "[name=three], [name=super-three]"', { encoding: 'utf8' }));
const ids = found.map((p) => `${p.name}@${p.version}`);
if (found.length !== 1 || ids[0] !== EXPECTED) {
  console.error(`Expected exactly one ${EXPECTED}, found:`);
  for (const p of found) console.error(`  ${p.location}  ${p.name}@${p.version}`);
  process.exit(1);
}
console.log(`single three ok (${EXPECTED} at ${found[0].location})`);
