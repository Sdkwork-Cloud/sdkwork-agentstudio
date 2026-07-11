import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function runTest(name: string, callback: () => void) {
  try {
    callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('Settings sidebar and tabs keep light defaults with dark-mode variants', () => {
  const source = readFileSync(new URL('./Settings.tsx', import.meta.url), 'utf8');

  assert.match(source, /bg-zinc-50\/50 dark:bg-zinc-950\/50/);
  assert.match(source, /border-r border-zinc-200 bg-zinc-50\/80/);
  assert.match(source, /dark:border-zinc-800 dark:bg-zinc-900\/80/);
  assert.match(source, /border-zinc-200\/50 bg-white text-primary-600/);
  assert.match(source, /dark:border-zinc-700\/50 dark:bg-zinc-800 dark:text-primary-400/);
  assert.doesNotMatch(source, /border-r border-zinc-800 bg-zinc-900/);
  assert.doesNotMatch(source, /bg-zinc-900 text-white/);
});
