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
  'userCenterStandard consumes claw-core user-center contracts from the package root instead of a subpath export',
  () => {
    const source = readFileSync(new URL('./userCenterStandard.ts', import.meta.url), 'utf8');

    assert.match(source, /from '@sdkwork\/claw-core';/);
    assert.doesNotMatch(source, /from '@sdkwork\/claw-core\/sdk';/);
  },
);
