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

await runTest(
  'instanceServiceCore create-instance DTO reuses shared extensible kernel and transport contracts',
  async () => {
    const source = await readFile(new URL('./instanceServiceCore.ts', import.meta.url), 'utf8');

    assert.match(source, /type\s+{\s*[\s\S]*StudioRuntimeKind[\s\S]*}\s+from '@sdkwork\/claw-types'/);
    assert.match(
      source,
      /type\s+{\s*[\s\S]*StudioInstanceTransportKind[\s\S]*}\s+from '@sdkwork\/claw-types'/,
    );
    assert.match(
      source,
      /type\s+{\s*[\s\S]*StudioInstanceDeploymentMode[\s\S]*}\s+from '@sdkwork\/claw-types'/,
    );
    assert.match(source, /runtimeKind\?:\s*StudioRuntimeKind;/);
    assert.match(source, /deploymentMode\?:\s*StudioInstanceDeploymentMode;/);
    assert.match(source, /transportKind\?:\s*StudioInstanceTransportKind;/);

    assert.doesNotMatch(
      source,
      /runtimeKind\?:\s*'openclaw'\s*\|\s*'hermes'\s*\|\s*'zeroclaw'\s*\|\s*'ironclaw'\s*\|\s*'custom';/,
    );
    assert.doesNotMatch(
      source,
      /transportKind\?:\s*\|\s*'openclawGatewayWs'[\s\S]*'customWs';/,
    );
  },
);
