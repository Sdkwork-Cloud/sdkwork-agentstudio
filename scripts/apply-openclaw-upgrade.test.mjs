import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

import {
  REMOVED_OPENCLAW_RELEASE_CONFIG_ENTRY,
  resolveRemovedOpenClawWorkspaceEntry,
} from './test-support/openclaw-retired-upgrade-entries.mjs';
import { shiftNumericVersion } from './test-support/version-fixtures.mjs';

const rootDir = path.resolve(import.meta.dirname, '..');
const openClawReleaseConfig = JSON.parse(
  readFileSync(path.join(rootDir, 'config', 'kernel-releases', 'openclaw.json'), 'utf8'),
);
const expectedNodeVersion = openClawReleaseConfig.nodeVersion;
const currentOpenClawVersion = String(openClawReleaseConfig.stableVersion);
const previousOpenClawVersion = shiftNumericVersion(currentOpenClawVersion, -1);

function createJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function createReleaseConfig(workspaceRootDir, stableVersion) {
  createJson(path.join(workspaceRootDir, 'config', 'kernel-releases', 'openclaw.json'), {
    kernelId: 'openclaw',
    stableVersion,
    supportedChannels: ['stable'],
    defaultChannel: 'stable',
    nodeVersion: expectedNodeVersion,
    packageName: 'openclaw',
    runtimeRequirements: {
      requiredExternalRuntimes: ['nodejs'],
    },
    runtimeSupplementalPackages: [],
    runtimeSupplementalPackageExceptions: [],
    releaseSource: {
      kind: 'githubRelease',
      repositoryUrl: 'https://github.com/openclaw/openclaw',
      tagPrefix: 'v',
    },
  });
}

function resolveRemovedOpenClawReleaseConfigPath(workspaceRootDir) {
  return resolveRemovedOpenClawWorkspaceEntry(
    workspaceRootDir,
    REMOVED_OPENCLAW_RELEASE_CONFIG_ENTRY,
  );
}

function writeRuntimeVersionState(workspaceRootDir, version) {
  createJson(
    path.join(
      workspaceRootDir,
      'packages',
      'sdkwork-claw-desktop',
      'src-tauri',
      'resources',
      'openclaw',
      'runtime',
      'package',
      'node_modules',
      'openclaw',
      'package.json',
    ),
    {
      name: 'openclaw',
      version,
    },
  );
  createJson(
    path.join(
      workspaceRootDir,
      'packages',
      'sdkwork-claw-desktop',
      'src-tauri',
      'resources',
      'openclaw',
      'manifest.json',
    ),
    {
      schemaVersion: 1,
      runtimeId: 'openclaw',
      openclawVersion: version,
    },
  );
  createJson(
    path.join(
      workspaceRootDir,
      'packages',
      'sdkwork-claw-desktop',
      'src-tauri',
      'generated',
      'release',
      'openclaw-resource',
      'manifest.json',
    ),
    {
      schemaVersion: 1,
      runtimeId: 'openclaw',
      openclawVersion: version,
    },
  );
}

test('applyOpenClawUpgrade refuses to mutate release config when readiness is blocked', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'apply-openclaw-upgrade.mjs');
  const upgrade = await import(pathToFileURL(modulePath).href);

  assert.equal(typeof upgrade.applyOpenClawUpgrade, 'function');

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'apply-openclaw-upgrade-blocked-'));
  try {
    createReleaseConfig(tempRoot, previousOpenClawVersion);

    await assert.rejects(
      upgrade.applyOpenClawUpgrade({
        workspaceRootDir: tempRoot,
        targetVersion: currentOpenClawVersion,
        assessOpenClawUpgradeReadinessFn: async () => ({
          targetVersion: currentOpenClawVersion,
          readyToUpgrade: false,
          blockers: [`No local openclaw-${currentOpenClawVersion}.tgz tarball is available for an offline packaged OpenClaw upgrade.`],
        }),
      }),
      /offline packaged OpenClaw upgrade/i,
    );

    const releaseConfig = JSON.parse(
      readFileSync(path.join(tempRoot, 'config', 'kernel-releases', 'openclaw.json'), 'utf8'),
    );
    assert.equal(releaseConfig.stableVersion, previousOpenClawVersion);
    assert.equal(
      existsSync(resolveRemovedOpenClawReleaseConfigPath(tempRoot)),
      false,
      'applyOpenClawUpgrade must not synthesize the removed release config projection when readiness blocks the upgrade before mutation starts',
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('applyOpenClawUpgrade updates the release baseline and runs sync, prepare, verify, and rollback evidence in order', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'apply-openclaw-upgrade.mjs');
  const upgrade = await import(pathToFileURL(modulePath).href);

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'apply-openclaw-upgrade-success-'));
  try {
    createReleaseConfig(tempRoot, previousOpenClawVersion);
    writeRuntimeVersionState(tempRoot, previousOpenClawVersion);

    const calls = [];
    const result = await upgrade.applyOpenClawUpgrade({
      workspaceRootDir: tempRoot,
      targetVersion: currentOpenClawVersion,
      assessOpenClawUpgradeReadinessFn: async () => ({
        targetVersion: currentOpenClawVersion,
        readyToUpgrade: true,
        blockers: [],
      }),
      runNodeScriptFn: async ({ scriptRelativePath }) => {
        calls.push(scriptRelativePath);

        if (scriptRelativePath === 'scripts/prepare-openclaw-runtime.mjs') {
          writeRuntimeVersionState(tempRoot, currentOpenClawVersion);
        }
      },
    });

    assert.deepEqual(calls, [
      'scripts/sync-bundled-components.mjs',
      'scripts/prepare-openclaw-runtime.mjs',
      'scripts/verify-desktop-openclaw-release-assets.mjs',
      'scripts/openclaw-upgrade-rollback-evidence.mjs',
    ]);
    assert.equal(result.versionState.configuredVersion, currentOpenClawVersion);
    assert.equal(result.versionState.preparedRuntimeVersion, currentOpenClawVersion);
    assert.equal(result.versionState.bundledManifestVersion, currentOpenClawVersion);
    assert.equal(result.versionState.generatedManifestVersion, currentOpenClawVersion);
    const releaseConfig = JSON.parse(
      readFileSync(path.join(tempRoot, 'config', 'kernel-releases', 'openclaw.json'), 'utf8'),
    );
    assert.equal(releaseConfig.stableVersion, currentOpenClawVersion);
    assert.equal(
      Object.hasOwn(releaseConfig.releaseSource, 'releaseUrl'),
      false,
      'applyOpenClawUpgrade must not write a derived releaseUrl back into the release config',
    );
    assert.equal(
      existsSync(resolveRemovedOpenClawReleaseConfigPath(tempRoot)),
      false,
      'applyOpenClawUpgrade must not create the removed release config projection after a successful upgrade',
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('applyOpenClawUpgrade fast mode skips sync and prepare when target runtime state is already aligned', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'apply-openclaw-upgrade.mjs');
  const upgrade = await import(pathToFileURL(modulePath).href);

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'apply-openclaw-upgrade-fast-aligned-'));
  try {
    createReleaseConfig(tempRoot, currentOpenClawVersion);
    writeRuntimeVersionState(tempRoot, currentOpenClawVersion);

    const calls = [];
    const result = await upgrade.applyOpenClawUpgrade({
      workspaceRootDir: tempRoot,
      targetVersion: currentOpenClawVersion,
      fast: true,
      assessOpenClawUpgradeReadinessFn: async () => ({
        targetVersion: currentOpenClawVersion,
        readyToUpgrade: false,
        versionSourcesAligned: true,
        blockers: [
          `Local OpenClaw upstream checkout does not contain git tag v${currentOpenClawVersion}.`,
        ],
      }),
      runNodeScriptFn: async ({ scriptRelativePath, args }) => {
        calls.push({ scriptRelativePath, args });
      },
    });

    assert.deepEqual(calls, [
      { scriptRelativePath: 'scripts/verify-desktop-openclaw-release-assets.mjs', args: [] },
      {
        scriptRelativePath: 'scripts/openclaw-upgrade-rollback-evidence.mjs',
        args: ['--target-version', currentOpenClawVersion],
      },
    ]);
    assert.equal(result.workflowMode, 'fast-already-aligned');
    assert.equal(result.versionState.configuredVersion, currentOpenClawVersion);
    assert.equal(result.versionState.preparedRuntimeVersion, currentOpenClawVersion);
    assert.equal(result.versionState.bundledManifestVersion, currentOpenClawVersion);
    assert.equal(result.versionState.generatedManifestVersion, currentOpenClawVersion);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('applyOpenClawUpgrade fast mode falls back to the full workflow when target runtime state is not aligned', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'apply-openclaw-upgrade.mjs');
  const upgrade = await import(pathToFileURL(modulePath).href);

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'apply-openclaw-upgrade-fast-fallback-'));
  try {
    createReleaseConfig(tempRoot, previousOpenClawVersion);
    writeRuntimeVersionState(tempRoot, previousOpenClawVersion);

    const calls = [];
    const result = await upgrade.applyOpenClawUpgrade({
      workspaceRootDir: tempRoot,
      targetVersion: currentOpenClawVersion,
      fast: true,
      assessOpenClawUpgradeReadinessFn: async () => ({
        targetVersion: currentOpenClawVersion,
        readyToUpgrade: true,
        versionSourcesAligned: false,
        blockers: [],
      }),
      runNodeScriptFn: async ({ scriptRelativePath }) => {
        calls.push(scriptRelativePath);

        if (scriptRelativePath === 'scripts/prepare-openclaw-runtime.mjs') {
          writeRuntimeVersionState(tempRoot, currentOpenClawVersion);
        }
      },
    });

    assert.deepEqual(calls, [
      'scripts/sync-bundled-components.mjs',
      'scripts/prepare-openclaw-runtime.mjs',
      'scripts/verify-desktop-openclaw-release-assets.mjs',
      'scripts/openclaw-upgrade-rollback-evidence.mjs',
    ]);
    assert.equal(result.workflowMode, 'full');
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('applyOpenClawUpgrade restores the previous release baseline if a downstream step fails', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'apply-openclaw-upgrade.mjs');
  const upgrade = await import(pathToFileURL(modulePath).href);

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'apply-openclaw-upgrade-rollback-'));
  try {
    createReleaseConfig(tempRoot, previousOpenClawVersion);

    await assert.rejects(
      upgrade.applyOpenClawUpgrade({
        workspaceRootDir: tempRoot,
        targetVersion: currentOpenClawVersion,
        assessOpenClawUpgradeReadinessFn: async () => ({
          targetVersion: currentOpenClawVersion,
          readyToUpgrade: true,
          blockers: [],
        }),
        runNodeScriptFn: async ({ scriptRelativePath }) => {
          if (scriptRelativePath === 'scripts/prepare-openclaw-runtime.mjs') {
            throw new Error('synthetic prepare failure');
          }
        },
      }),
      /restored config\/kernel-releases\/openclaw\.json/i,
    );

    const releaseConfig = JSON.parse(
      readFileSync(path.join(tempRoot, 'config', 'kernel-releases', 'openclaw.json'), 'utf8'),
    );
    assert.equal(releaseConfig.stableVersion, previousOpenClawVersion);
    assert.equal(
      Object.hasOwn(releaseConfig.releaseSource, 'releaseUrl'),
      false,
      'applyOpenClawUpgrade must preserve the canonical release config shape when restoring a failed upgrade',
    );
    assert.equal(
      existsSync(resolveRemovedOpenClawReleaseConfigPath(tempRoot)),
      false,
      'applyOpenClawUpgrade must not create the removed release config projection while restoring a failed upgrade',
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('workspace exposes the apply-openclaw-upgrade entrypoint and validates it in desktop runtime checks', () => {
  const packageJson = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'));

  assert.equal(
    packageJson.scripts['openclaw:upgrade:apply'],
    'sdkwork-run-node scripts/apply-openclaw-upgrade.mjs',
  );
  assert.equal(
    packageJson.scripts['openclaw:upgrade:fast'],
    'sdkwork-run-node scripts/apply-openclaw-upgrade.mjs --fast',
  );
  assert.match(
    packageJson.scripts['check:desktop-openclaw-runtime'],
    /sdkwork-run-node scripts\/apply-openclaw-upgrade\.test\.mjs/,
    'check:desktop-openclaw-runtime must validate the apply-openclaw-upgrade workflow contract',
  );
});

test('apply-openclaw-upgrade hides child Node workflow windows on Windows', () => {
  const source = readFileSync(
    path.join(rootDir, 'scripts', 'apply-openclaw-upgrade.mjs'),
    'utf8',
  );

  assert.match(
    source,
    /spawn\(process\.execPath, \[scriptRelativePath, \.\.\.args\][\s\S]*windowsHide:\s*true/,
    'OpenClaw upgrade workflow subcommands must not show Windows console windows',
  );
});
