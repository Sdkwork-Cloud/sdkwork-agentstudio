import assert from 'node:assert/strict';
import { formatWorkbenchLabel } from './instanceWorkbenchFormatting.ts';

function runTest(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

await runTest('formatWorkbenchLabel keeps known OpenClaw workbench values readable', () => {
  assert.equal(formatWorkbenchLabel('managedFile'), 'OpenClaw config file');
  assert.equal(formatWorkbenchLabel('managedDirectory'), 'Config Directory');
  assert.equal(formatWorkbenchLabel('configFile'), 'OpenClaw config file');
  assert.equal(formatWorkbenchLabel('appManaged'), 'App Managed');
  assert.equal(formatWorkbenchLabel('openaiResponses'), 'OpenAI Responses');
  assert.equal(formatWorkbenchLabel('readonly'), 'Read Only');
  assert.equal(formatWorkbenchLabel('authoritative'), 'Authoritative');
});

await runTest('formatWorkbenchLabel humanizes unknown camelCase and kebab-case values', () => {
  assert.equal(formatWorkbenchLabel('runtimeLagged'), 'Runtime Lagged');
  assert.equal(formatWorkbenchLabel('local-external'), 'Local External');
});
