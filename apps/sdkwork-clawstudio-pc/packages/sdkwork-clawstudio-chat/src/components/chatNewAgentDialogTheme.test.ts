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

const source = readFileSync(new URL('./ChatNewAgentDialog.tsx', import.meta.url), 'utf8');

runTest('ChatNewAgentDialog kernel selector uses light-mode active selection chrome', () => {
  assert.match(source, /border-primary-200 bg-primary-50 text-primary-700/);
  assert.match(source, /dark:border-primary-500\/30 dark:bg-primary-500\/10 dark:text-primary-300/);
  assert.doesNotMatch(source, /border-zinc-950 bg-zinc-950 text-white/);
  assert.doesNotMatch(source, /bg-white\/15 text-white dark:bg-zinc-950\/10 dark:text-zinc-950/);
});
