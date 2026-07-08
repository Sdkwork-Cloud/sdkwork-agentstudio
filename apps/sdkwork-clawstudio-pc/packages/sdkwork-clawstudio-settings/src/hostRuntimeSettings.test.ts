import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest(
  'HostRuntimeSettings renders host runtime governance cards and a compact endpoint table, and KernelCenter wires it in',
  async () => {
    const settingsRoot = import.meta.dirname;
    const hostRuntimeSettingsSource = fs.readFileSync(
      path.join(settingsRoot, 'HostRuntimeSettings.tsx'),
      'utf8',
    );
    const kernelCenterSource = fs.readFileSync(
      path.join(settingsRoot, 'KernelCenter.tsx'),
      'utf8',
    );
    const settingsIndexSource = fs.readFileSync(
      path.join(settingsRoot, 'index.ts'),
      'utf8',
    );

    assert.match(hostRuntimeSettingsSource, /data-slot="host-runtime-settings"/);
    assert.match(hostRuntimeSettingsSource, /data-slot="host-runtime-endpoints-table"/);
    assert.match(hostRuntimeSettingsSource, /hostRuntimeContract/);
    assert.match(hostRuntimeSettingsSource, /distributionFamily/);
    assert.match(hostRuntimeSettingsSource, /deploymentFamily/);
    assert.match(hostRuntimeSettingsSource, /stateStoreDriver/);
    assert.match(hostRuntimeSettingsSource, /runtimeDataDir/);
    assert.match(hostRuntimeSettingsSource, /webDistDir/);
    assert.match(hostRuntimeSettingsSource, /browserBaseUrl/);
    assert.match(kernelCenterSource, /import \{ HostRuntimeSettings \} from '\.\/HostRuntimeSettings';/);
    assert.match(kernelCenterSource, /<HostRuntimeSettings dashboard=\{dashboard\} \/>/);
    assert.match(settingsIndexSource, /export \* from '\.\/HostRuntimeSettings\.ts';/);
  },
);
