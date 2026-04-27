import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(import.meta.dirname, '..');

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
    nodeVersion: '22.16.0',
    packageName: 'openclaw',
    runtimeRequirements: {
      requiredExternalRuntimes: ['nodejs'],
      requiredExternalRuntimeVersions: {
        nodejs: '22.16.0',
      },
    },
    runtimeSupplementalPackages: [],
    runtimeSupplementalPackageExceptions: [],
  });
}

test('applyOpenClawUpgrade refuses to mutate release config when readiness is blocked', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'apply-openclaw-upgrade.mjs');
  const upgrade = await import(pathToFileURL(modulePath).href);

  assert.equal(typeof upgrade.applyOpenClawUpgrade, 'function');

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'apply-openclaw-upgrade-blocked-'));
  try {
    createReleaseConfig(tempRoot, '2026.4.9');

    await assert.rejects(
      upgrade.applyOpenClawUpgrade({
        workspaceRootDir: tempRoot,
        targetVersion: '2026.4.11',
        assessOpenClawUpgradeReadinessFn: async () => ({
          targetVersion: '2026.4.11',
          readyToUpgrade: false,
          blockers: ['No local openclaw-2026.4.11.tgz tarball is available for an offline packaged OpenClaw upgrade.'],
        }),
      }),
      /offline packaged OpenClaw upgrade/i,
    );

    const releaseConfig = JSON.parse(
      readFileSync(path.join(tempRoot, 'config', 'kernel-releases', 'openclaw.json'), 'utf8'),
    );
    assert.equal(releaseConfig.stableVersion, '2026.4.9');
    assert.equal(
      existsSync(path.join(tempRoot, 'config', 'openclaw-release.json')),
      false,
      'applyOpenClawUpgrade must not synthesize the legacy compatibility projection when readiness blocks the upgrade before mutation starts',
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
    createReleaseConfig(tempRoot, '2026.4.9');
    createJson(
      path.join(
        tempRoot,
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
        version: '2026.4.9',
      },
    );
    createJson(
      path.join(
        tempRoot,
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
        openclawVersion: '2026.4.9',
      },
    );
    createJson(
      path.join(
        tempRoot,
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
        openclawVersion: '2026.4.9',
      },
    );

    const calls = [];
    const result = await upgrade.applyOpenClawUpgrade({
      workspaceRootDir: tempRoot,
      targetVersion: '2026.4.11',
      assessOpenClawUpgradeReadinessFn: async () => ({
        targetVersion: '2026.4.11',
        readyToUpgrade: true,
        blockers: [],
      }),
      runNodeScriptFn: async ({ scriptRelativePath }) => {
        calls.push(scriptRelativePath);

        if (scriptRelativePath === 'scripts/prepare-openclaw-runtime.mjs') {
          createJson(
            path.join(
              tempRoot,
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
              openclawVersion: '2026.4.11',
            },
          );
          createJson(
            path.join(
              tempRoot,
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
              openclawVersion: '2026.4.11',
            },
          );
          createJson(
            path.join(
              tempRoot,
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
              version: '2026.4.11',
            },
          );
        }
      },
    });

    assert.deepEqual(calls, [
      'scripts/sync-bundled-components.mjs',
      'scripts/prepare-openclaw-runtime.mjs',
      'scripts/verify-desktop-openclaw-release-assets.mjs',
      'scripts/openclaw-upgrade-rollback-evidence.mjs',
    ]);
    assert.equal(result.versionState.configuredVersion, '2026.4.11');
    assert.equal(result.versionState.preparedRuntimeVersion, '2026.4.11');
    assert.equal(result.versionState.bundledManifestVersion, '2026.4.11');
    assert.equal(result.versionState.generatedManifestVersion, '2026.4.11');
    const releaseConfig = JSON.parse(
      readFileSync(path.join(tempRoot, 'config', 'kernel-releases', 'openclaw.json'), 'utf8'),
    );
    assert.equal(releaseConfig.stableVersion, '2026.4.11');
    const legacyReleaseConfig = JSON.parse(
      readFileSync(path.join(tempRoot, 'config', 'openclaw-release.json'), 'utf8'),
    );
    assert.equal(legacyReleaseConfig.stableVersion, '2026.4.11');
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('applyOpenClawUpgrade restores the previous release baseline if a downstream step fails', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'apply-openclaw-upgrade.mjs');
  const upgrade = await import(pathToFileURL(modulePath).href);

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'apply-openclaw-upgrade-rollback-'));
  try {
    createReleaseConfig(tempRoot, '2026.4.9');

    await assert.rejects(
      upgrade.applyOpenClawUpgrade({
        workspaceRootDir: tempRoot,
        targetVersion: '2026.4.11',
        assessOpenClawUpgradeReadinessFn: async () => ({
          targetVersion: '2026.4.11',
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
    assert.equal(releaseConfig.stableVersion, '2026.4.9');
    const legacyReleaseConfig = JSON.parse(
      readFileSync(path.join(tempRoot, 'config', 'openclaw-release.json'), 'utf8'),
    );
    assert.equal(legacyReleaseConfig.stableVersion, '2026.4.9');
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
