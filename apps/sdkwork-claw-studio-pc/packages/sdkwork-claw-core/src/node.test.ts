import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

async function runTest(name: string, callback: () => void | Promise<void>) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('sdkwork-claw-core node root entry loads under Node without browser-only runtime wiring', async () => {
  const moduleUrl = pathToFileURL(path.join(process.cwd(), 'packages/sdkwork-claw-core/src/node.ts')).href;
  const nodeModule = (await import(moduleUrl)) as typeof import('./node');

  assert.ok(nodeModule.instanceStore);
  assert.ok(nodeModule.llmStore);
  assert.equal(typeof nodeModule.createDashboardCommerceService, 'function');
});
