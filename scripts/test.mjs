// Runs every src/engine/*.test.mjs (works on Windows and Unix shells).
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const dir = 'src/engine';
const files = readdirSync(dir).filter((f) => f.endsWith('.test.mjs')).sort();
let failed = 0;
for (const f of files) {
  console.log(`\n=== ${f}`);
  const r = spawnSync(process.execPath, [`${dir}/${f}`], { stdio: 'inherit' });
  if (r.status !== 0) failed++;
}
console.log(`\n${files.length - failed}/${files.length} test files passed`);
process.exit(failed ? 1 : 0);
