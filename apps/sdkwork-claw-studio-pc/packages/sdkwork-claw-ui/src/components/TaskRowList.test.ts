import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function runTest(name: string, callback: () => void) {
  try {
    callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('TaskRowList renders with a tighter outer radius', () => {
  const source = readFileSync(resolve(import.meta.dirname, 'TaskRowList.tsx'), 'utf8');

  assert.match(source, /data-slot="task-row-list"/);
  assert.match(source, /rounded-\[20px\]/);
  assert.doesNotMatch(source, /rounded-\[1\.75rem\]/);
});
