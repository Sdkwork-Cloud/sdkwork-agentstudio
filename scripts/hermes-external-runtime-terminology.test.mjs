import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const rootDir = path.resolve(import.meta.dirname, '..');

function readWorkspaceFile(relativePath) {
  return readFileSync(path.join(rootDir, relativePath), 'utf8');
}

test('Hermes shared surfaces keep external-runtime and WSL2-or-remote semantics', () => {
  const registryWorkbenchSupportSource = readWorkspaceFile(
    'packages/sdkwork-agentstudio-pc-instances/src/services/instanceRegistryWorkbenchSupport.ts',
  );
  assert.match(
    registryWorkbenchSupportSource,
    /Windows hosts must run Hermes through WSL2 or a remote Linux environment\./,
    'registry-backed Hermes detail notes must preserve the Windows WSL2-or-remote support boundary',
  );
  assert.match(
    registryWorkbenchSupportSource,
    /Python and uv must be installed externally\. Node\.js remains external and optional for some Hermes capabilities\./,
    'registry-backed Hermes detail notes must preserve external runtime requirements',
  );

  const nodeInventoryServiceTestSource = readWorkspaceFile(
    'packages/sdkwork-agentstudio-pc-instances/src/services/nodeInventoryService.test.ts',
  );
  assert.doesNotMatch(
    nodeInventoryServiceTestSource,
    /Built-in Hermes runtime\.|Built-In Hermes/,
    'node inventory service fixtures should not describe Hermes as a built-in runtime',
  );

  const nodeInventoryTopologyTestSource = readWorkspaceFile(
    'packages/sdkwork-agentstudio-pc-instances/src/services/nodeInventoryTopology.test.ts',
  );
  assert.doesNotMatch(
    nodeInventoryTopologyTestSource,
    /Built-in Hermes runtime\.|Built-In Hermes/,
    'node inventory topology fixtures should not describe Hermes as a built-in runtime',
  );

  const startupRefreshSupportTestSource = readWorkspaceFile(
    'packages/sdkwork-agentstudio-pc-instances/src/services/instanceStartupRefreshSupport.test.ts',
  );
  assert.doesNotMatch(
    startupRefreshSupportTestSource,
    /Built-In Hermes/,
    'startup refresh fixtures should not describe Hermes as a built-in runtime',
  );
});
