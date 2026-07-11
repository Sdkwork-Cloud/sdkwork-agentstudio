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

runTest('AgentMarket uses top tabs, full-width workspace layout, and an adaptive auto-fit catalog grid', () => {
  const source = readFileSync(resolve(import.meta.dirname, 'AgentMarket.tsx'), 'utf8');

  assert.match(source, /TaskStudioTabs/);
  assert.match(source, /data-slot="agent-market-topbar"/);
  assert.match(source, /data-slot="agent-market-category-tabs"/);
  assert.match(source, /w-fit max-w-full min-w-0 overflow-x-auto/);
  assert.match(source, /flex-1 overflow-y-auto p-4 md:p-6/);
  assert.match(source, /w-full space-y-4/);
  assert.match(source, /\[grid-template-columns:repeat\(auto-fit,minmax\(19rem,1fr\)\)\]/);
  assert.doesNotMatch(source, /md:grid-cols-2 xl:grid-cols-3/);
});
