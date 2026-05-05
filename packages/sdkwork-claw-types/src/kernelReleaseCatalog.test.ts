import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  listKernelReleaseConfigs,
  resolveKernelReleaseConfig,
} from './kernelReleaseCatalog.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..', '..');
const rawOpenClawReleaseConfig = JSON.parse(
  readFileSync(path.join(rootDir, 'config', 'kernel-releases', 'openclaw.json'), 'utf8'),
);
const rawHermesReleaseConfig = JSON.parse(
  readFileSync(path.join(rootDir, 'config', 'kernel-releases', 'hermes.json'), 'utf8'),
);
const kernelReleaseCatalogSource = readFileSync(
  path.join(rootDir, 'packages', 'sdkwork-claw-types', 'src', 'kernelReleaseCatalog.ts'),
  'utf8',
);

test('kernel release catalog canonicalizes configured kernel ids', () => {
  const kernelIds = listKernelReleaseConfigs()
    .map((config) => config.kernelId)
    .sort();

  assert.deepEqual(kernelIds, ['hermes', 'openclaw']);
  assert.equal(resolveKernelReleaseConfig('openclaw').kernelId, 'openclaw');
  assert.equal(resolveKernelReleaseConfig('hermes').kernelId, 'hermes');
});

test('kernel release catalog returns defensive clones', () => {
  const openclaw = resolveKernelReleaseConfig('openclaw');
  openclaw.stableVersion = 'mutated';

  assert.notEqual(
    resolveKernelReleaseConfig('openclaw').stableVersion,
    'mutated',
  );
});

test('frontend kernel release catalog derives OpenClaw release URL and Node runtime version', () => {
  const openClawReleaseConfig = resolveKernelReleaseConfig('openclaw');

  assert.equal(
    Object.hasOwn(rawOpenClawReleaseConfig.releaseSource ?? {}, 'releaseUrl'),
    false,
  );
  assert.equal(
    openClawReleaseConfig.releaseSource?.releaseUrl,
    `https://github.com/openclaw/openclaw/releases/tag/v${rawOpenClawReleaseConfig.stableVersion}`,
  );
  assert.equal(
    Object.hasOwn(
      rawOpenClawReleaseConfig.runtimeRequirements ?? {},
      'requiredExternalRuntimeVersions',
    ),
    false,
  );
  assert.equal(
    openClawReleaseConfig.runtimeRequirements?.requiredExternalRuntimeVersions?.nodejs,
    rawOpenClawReleaseConfig.nodeVersion,
  );
});

test('kernel release catalog exposes platformSupport and rejects compatibility wording in release configs', () => {
  for (const rawReleaseConfig of [rawOpenClawReleaseConfig, rawHermesReleaseConfig]) {
    assert.equal(Object.hasOwn(rawReleaseConfig, 'compatibility'), false);
    assert.equal(Object.hasOwn(rawReleaseConfig, 'platformSupport'), true);
  }

  assert.match(
    kernelReleaseCatalogSource,
    /Object\.hasOwn\(\s*config\s*,\s*['"]compatibility['"]\s*\)/u,
  );
  assert.match(
    kernelReleaseCatalogSource,
    /must use platformSupport instead of compatibility/u,
  );
  assert.match(
    kernelReleaseCatalogSource,
    /must derive runtimeRequirements\.requiredExternalRuntimeVersions\.nodejs from nodeVersion/u,
  );
  assert.match(
    kernelReleaseCatalogSource,
    /must derive releaseSource\.releaseUrl from releaseSource and stableVersion/u,
  );

  for (const releaseConfig of listKernelReleaseConfigs()) {
    assert.equal(Object.hasOwn(releaseConfig, 'compatibility'), false);
    assert.deepEqual(
      Object.keys(releaseConfig.platformSupport ?? {}).sort(),
      ['linux', 'macos', 'packageProfileIds', 'windows'],
    );
  }
});
