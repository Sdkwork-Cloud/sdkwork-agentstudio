import assert from 'node:assert/strict';
import test from 'node:test';

import { DEFAULT_OPENCLAW_VERSION } from '../openclaw-release.mjs';
import {
  normalizeKernelExternalRuntimePolicy,
  readKernelExternalRuntimePolicy,
  readKernelInstallReadyLayout,
  writeKernelExternalRuntimePolicy,
  writeKernelInstallReadiness,
} from './kernel-install-readiness.mjs';

const currentOpenClawInstallKey = `${DEFAULT_OPENCLAW_VERSION}-windows-x64`;

function buildHermesExternalRuntimePolicy() {
  return {
    packagingPolicy: 'external-runtime-only',
    launcherKinds: ['externalWslOrRemote'],
    platformSupport: {
      windows: 'wsl2OrRemoteOnly',
      macos: 'native',
      linux: 'native',
    },
    runtimeRequirements: ['python', 'uv'],
    optionalRuntimeRequirements: ['nodejs'],
  };
}

test('kernel install readiness preserves Hermes external-runtime policy alongside other kernel readiness entries', () => {
  const readiness = writeKernelExternalRuntimePolicy(
    writeKernelInstallReadiness(null, 'openclaw', {
      installReadyLayout: {
        mode: 'archive-extract-ready',
        installKey: currentOpenClawInstallKey,
      },
    }),
    'hermes',
    buildHermesExternalRuntimePolicy(),
  );

  assert.deepEqual(readKernelInstallReadyLayout(readiness, 'openclaw'), {
    mode: 'archive-extract-ready',
    installKey: currentOpenClawInstallKey,
  });
  assert.deepEqual(readKernelExternalRuntimePolicy(readiness, 'hermes'), buildHermesExternalRuntimePolicy());
});

test('kernel external-runtime policy normalization rejects incomplete policy payloads', () => {
  assert.equal(
    normalizeKernelExternalRuntimePolicy({
      launcherKinds: ['externalWslOrRemote'],
      runtimeRequirements: ['python', 'uv'],
    }),
    null,
  );
});
