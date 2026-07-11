import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

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

const instancesPagePath = new URL('./Instances.tsx', import.meta.url);

await runTest(
  'Instances wires a built-in OpenClaw startup banner and retry recovery support into the page source',
  async () => {
    const source = await readFile(instancesPagePath, 'utf8');

    assert.match(source, /BuiltInOpenClawStartupBanner/);
    assert.match(source, /buildBundledOpenClawStartupAlert/);
    assert.match(source, /buildBundledStartupRecoveryHandler/);
    assert.match(source, /isRetryingBuiltInStartup/);
    assert.match(source, /openDiagnosticPath/);
    assert.match(source, /handleOpenBuiltInDiagnosticPath/);
  },
);
