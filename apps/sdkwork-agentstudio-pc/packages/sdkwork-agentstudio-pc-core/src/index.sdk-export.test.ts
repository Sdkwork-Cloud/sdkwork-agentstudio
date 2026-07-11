import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function runTest(name: string, callback: () => void | Promise<void>) {
  return Promise.resolve()
    .then(callback)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

await runTest(
  'claw-core root index re-exports sdk contracts for cross-package consumers',
  () => {
    const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');

    assert.match(source, /export \* from '\.\/sdk\/index\.ts';/);
  },
);
