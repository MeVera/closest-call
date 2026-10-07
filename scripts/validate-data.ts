// npm run validate:data [-- --data-dir DIR] [-- --photos-dir DIR] [-- --skip-generation] [-- --skip-photos]
// Exits 1 on any error. The skip flags are for development only and are printed loudly.

import path from 'node:path';
import { THEMES } from '../src/config';
import type { Theme } from '../src/types';
import { DATA_DIR, PHOTOS_DIR, readJson } from './lib';
import { checkGeneration, validateItems } from './validation';
import fs from 'node:fs';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const opt = (name: string, fallback: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? path.resolve(args[i + 1]) : fallback;
};

const dataDir = opt('--data-dir', DATA_DIR);
const photosDir = opt('--photos-dir', PHOTOS_DIR);
const skipGeneration = flag('--skip-generation');
const skipPhotos = flag('--skip-photos');

const byTheme: Partial<Record<Theme, unknown[]>> = {};
const errors: string[] = [];
for (const t of THEMES) {
  const file = path.join(dataDir, `${t}.json`);
  if (!fs.existsSync(file)) errors.push(`${t}: missing ${file}`);
  else {
    try {
      byTheme[t] = readJson<unknown[]>(file);
    } catch (e) {
      errors.push(`${t}: invalid JSON (${(e as Error).message})`);
    }
  }
}
const creditsFile = path.join(dataDir, 'photo-credits.json');
const credits = fs.existsSync(creditsFile) ? readJson<Record<string, never>>(creditsFile) : {};

errors.push(...validateItems(byTheme, { photosDir, credits, checkPhotos: !skipPhotos }));

console.log('Item checks');
for (const t of THEMES) console.log(`  ${t.padEnd(10)} ${(byTheme[t]?.length ?? 0).toString().padStart(4)} items`);
if (errors.length) {
  console.log(`\n✗ ${errors.length} item error(s):`);
  for (const e of errors) console.log(`  - ${e}`);
} else console.log('  ✓ all item fields valid');

let genFailed = false;
if (skipGeneration) {
  console.log('\n⚠ Generation check SKIPPED (--skip-generation). Do not ship on this result.');
} else if (errors.length) {
  console.log('\nGeneration check not run because item checks failed.');
  genFailed = true;
} else {
  console.log('\nGeneration check');
  for (const t of THEMES) {
    const started = Date.now();
    const r = checkGeneration(t, byTheme[t] as never);
    const ok = !r.dailyFailures.length && !r.endlessFailures.length;
    console.log(
      `  ${ok ? '✓' : '✗'} ${t.padEnd(10)} daily failures: ${r.dailyFailures.length}, endless failures: ${r.endlessFailures.length} (${Date.now() - started} ms)`,
    );
    for (const f of r.dailyFailures.slice(0, 5)) console.log(`      daily ${f.date}: ${f.reason}`);
    for (const f of r.endlessFailures.slice(0, 5)) console.log(`      endless ${f.seed}: ${f.reason}`);
    if (!ok) genFailed = true;
  }
}
if (skipPhotos) console.log('\n⚠ Photo checks SKIPPED (--skip-photos). Do not ship on this result.');

if (errors.length || genFailed) {
  console.log('\nValidation FAILED');
  process.exit(1);
}
console.log('\nValidation passed');
