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

const overviewSectionPath = new URL('./InstanceDetailOverviewSection.tsx', import.meta.url);

await runTest(
  'InstanceDetailOverviewSection exposes bundled OpenClaw retry labels in the management alert source',
  async () => {
    const source = await readFile(overviewSectionPath, 'utf8');

    assert.match(source, /instances\.detail\.actions\.retryBundledStartup/);
    assert.match(source, /instances\.detail\.actions\.retryingBundledStartup/);
    assert.match(source, /instances\.detail\.actions\.openGatewayLog/);
    assert.match(source, /instances\.detail\.actions\.revealDesktopMainLog/);
    assert.match(source, /onOpenDiagnosticPath/);
  },
);
