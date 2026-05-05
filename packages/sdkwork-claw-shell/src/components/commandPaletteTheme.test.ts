import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('CommandPalette selected command uses theme-aware active chrome instead of a dark light-mode block', () => {
  const source = readFileSync(new URL('./CommandPalette.tsx', import.meta.url), 'utf8');

  assert.match(source, /border-primary-200 bg-primary-50 text-primary-700/);
  assert.match(source, /dark:border-primary-500\/30 dark:bg-primary-500\/10 dark:text-primary-300/);
  assert.doesNotMatch(source, /bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900/);
  assert.match(source, /text-primary-600 dark:text-primary-300/);
  assert.match(source, /text-primary-700 dark:text-primary-200/);
});
