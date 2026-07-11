import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const rootDir = path.resolve(import.meta.dirname, '..');

function readWorkspaceFile(relativePath) {
  return readFileSync(path.join(rootDir, relativePath), 'utf8');
}

test('shared kernel host provenance contracts use runtimeVersion instead of OpenClaw-specific version naming', () => {
  const infrastructureKernelContractSource = readWorkspaceFile(
    'packages/sdkwork-agentstudio-pc-infrastructure/src/platform/contracts/kernel.ts',
  );
  assert.match(infrastructureKernelContractSource, /\bruntimeVersion\?: string \| null;/);
  assert.doesNotMatch(infrastructureKernelContractSource, /\bopenclawVersion\?: string \| null;/);

  const kernelPlatformServiceSource = readWorkspaceFile(
    'packages/sdkwork-agentstudio-pc-core/src/services/kernelPlatformService.ts',
  );
  assert.match(kernelPlatformServiceSource, /\bruntimeVersion\?: string \| null;/);
  assert.match(kernelPlatformServiceSource, /runtimeVersion: status\.provenance\.runtimeVersion \?\? null/);
  assert.doesNotMatch(kernelPlatformServiceSource, /\bopenclawVersion\?: string \| null;/);
  assert.doesNotMatch(kernelPlatformServiceSource, /status\.provenance\.openclawVersion/);

  const kernelCenterServiceSource = readWorkspaceFile(
    'packages/sdkwork-agentstudio-pc-settings/src/services/kernelCenterService.ts',
  );
  assert.match(kernelCenterServiceSource, /\bruntimeVersion: string \| null;/);
  assert.match(kernelCenterServiceSource, /runtimeVersion: openClawRuntime\?\.openclawVersion \?\? snapshot\?\.runtimeVersion \?\? null/);
  assert.doesNotMatch(kernelCenterServiceSource, /\bopenclawVersion: string \| null;/);

  const kernelCenterPageSource = readWorkspaceFile(
    'packages/sdkwork-agentstudio-pc-settings/src/KernelCenter.tsx',
  );
  assert.match(kernelCenterPageSource, /\bruntimeVersion: null,/);
  assert.match(kernelCenterPageSource, /settings\.kernelCenter\.fields\.runtimeVersion/);
  assert.match(kernelCenterPageSource, /provenance\.runtimeVersion \|\| null/);
  assert.doesNotMatch(kernelCenterPageSource, /settings\.kernelCenter\.fields\.openclawVersion/);
  assert.doesNotMatch(kernelCenterPageSource, /provenance\.openclawVersion \|\| null/);

  const nodeInventoryServiceCoreSource = readWorkspaceFile(
    'packages/sdkwork-agentstudio-pc-instances/src/services/nodeInventoryServiceCore.ts',
  );
  assert.match(nodeInventoryServiceCoreSource, /version: snapshot\.runtimeVersion \?\? null/);
  assert.doesNotMatch(nodeInventoryServiceCoreSource, /snapshot\.openclawVersion \?\? null/);

  const rustKernelHostTypesSource = readWorkspaceFile(
    'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/kernel_host/types.rs',
  );
  assert.match(rustKernelHostTypesSource, /\bpub runtime_version: Option<String>,/);
  assert.doesNotMatch(rustKernelHostTypesSource, /\bpub openclaw_version: Option<String>,/);
});
