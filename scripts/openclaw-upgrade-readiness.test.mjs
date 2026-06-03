import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  assessOpenClawUpgradeReadiness,
} from './openclaw-upgrade-readiness.mjs';
import { shiftNumericVersion } from './test-support/version-fixtures.mjs';

const rootDir = path.resolve(import.meta.dirname, '..');
const openClawReleaseConfig = JSON.parse(
  readFileSync(path.join(rootDir, 'config', 'kernel-releases', 'openclaw.json'), 'utf8'),
);
const expectedNodeVersion = openClawReleaseConfig.nodeVersion;
const currentOpenClawVersion = String(openClawReleaseConfig.stableVersion);
const previousOpenClawVersion = shiftNumericVersion(currentOpenClawVersion, -1);
const staleOpenClawVersion = shiftNumericVersion(currentOpenClawVersion, -2);
const retiredOpenClawVersion = shiftNumericVersion(currentOpenClawVersion, -3);

function createJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function createText(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, 'utf8');
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
      requiredExternalRuntimeVersions: {
        nodejs: expectedNodeVersion,
      },
    },
    runtimeSupplementalPackages: [],
    runtimeSupplementalPackageExceptions: [],
  });
}

function createGitHeadRepo(repoDir, { head = '0123456789abcdef0123456789abcdef01234567', tags = {} } = {}) {
  mkdirSync(path.join(repoDir, '.git', 'refs', 'tags'), { recursive: true });
  createText(path.join(repoDir, '.git', 'HEAD'), `${head}\n`);
  for (const [tagName, sha] of Object.entries(tags)) {
    createText(path.join(repoDir, '.git', 'refs', 'tags', tagName), `${sha}\n`);
  }
}

async function runTest(name, callback) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('assessOpenClawUpgradeReadiness reports ready when local upgrade inputs already exist', async () => {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'openclaw-upgrade-readiness-ready-'));

  try {
    createReleaseConfig(tempRoot, previousOpenClawVersion);
    createJson(path.join(tempRoot, 'packages', 'sdkwork-claw-desktop', 'src-tauri', 'resources', 'openclaw', 'manifest.json'), {
      schemaVersion: 1,
      runtimeId: 'openclaw',
      openclawVersion: previousOpenClawVersion,
      nodeVersion: expectedNodeVersion,
      platform: 'windows',
      arch: 'x64',
    });
    createJson(path.join(tempRoot, 'packages', 'sdkwork-claw-desktop', 'src-tauri', 'resources', 'openclaw', 'runtime', 'package', 'node_modules', 'openclaw', 'package.json'), {
      name: 'openclaw',
      version: previousOpenClawVersion,
    });
    createJson(path.join(tempRoot, '.cache', 'bundled-components', 'upstreams', 'openclaw', 'package.json'), {
      name: 'openclaw',
      version: currentOpenClawVersion,
    });
    createGitHeadRepo(path.join(tempRoot, '.cache', 'bundled-components', 'upstreams', 'openclaw'), {
      head: '89abcdef0123456789abcdef0123456789abcdef',
      tags: {
        [`v${currentOpenClawVersion}`]: '89abcdef0123456789abcdef0123456789abcdef',
      },
    });
    createText(
      path.join(tempRoot, '.cache', 'bundled-components', 'upstreams', 'openclaw', '.git', 'status.fake'),
      '',
    );
    createText(path.join(tempRoot, `openclaw-${currentOpenClawVersion}.tgz`), 'tarball');

    const result = await assessOpenClawUpgradeReadiness({
      workspaceRootDir: tempRoot,
      targetVersion: currentOpenClawVersion,
    });

    assert.equal(result.targetVersion, currentOpenClawVersion);
    assert.equal(result.configuredVersion, previousOpenClawVersion);
    assert.equal(result.localPreparedRuntimeVersion, previousOpenClawVersion);
    assert.equal(result.localUpstreamVersion, currentOpenClawVersion);
    assert.equal(result.localUpstreamHasTargetTag, true);
    assert.equal(result.localUpstreamDirty, false);
    assert.equal(result.localUpstreamDirtyCheck, 'fixture');
    assert.equal(result.localTarballPresent, true);
    assert.equal(result.readyToUpgrade, true);
    assert.deepEqual(result.blockers, []);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

await runTest('assessOpenClawUpgradeReadiness accepts a local release tarball without a matching upstream checkout', async () => {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'openclaw-upgrade-readiness-tarball-source-'));

  try {
    createReleaseConfig(tempRoot, previousOpenClawVersion);
    createJson(path.join(tempRoot, 'packages', 'sdkwork-claw-desktop', 'src-tauri', 'resources', 'openclaw', 'manifest.json'), {
      schemaVersion: 1,
      runtimeId: 'openclaw',
      openclawVersion: previousOpenClawVersion,
      nodeVersion: expectedNodeVersion,
      platform: 'windows',
      arch: 'x64',
    });
    createJson(path.join(tempRoot, 'packages', 'sdkwork-claw-desktop', 'src-tauri', 'resources', 'openclaw', 'runtime', 'package', 'node_modules', 'openclaw', 'package.json'), {
      name: 'openclaw',
      version: previousOpenClawVersion,
    });
    createJson(path.join(tempRoot, '.cache', 'bundled-components', 'upstreams', 'openclaw', 'package.json'), {
      name: 'openclaw',
      version: staleOpenClawVersion,
    });
    createGitHeadRepo(path.join(tempRoot, '.cache', 'bundled-components', 'upstreams', 'openclaw'), {
      tags: {
        [`v${staleOpenClawVersion}`]: '0123456789abcdef0123456789abcdef01234567',
      },
    });
    createText(
      path.join(tempRoot, '.cache', 'bundled-components', 'upstreams', 'openclaw', '.git', 'status.fake'),
      '',
    );
    createText(path.join(tempRoot, `openclaw-${currentOpenClawVersion}.tgz`), 'tarball');

    const result = await assessOpenClawUpgradeReadiness({
      workspaceRootDir: tempRoot,
      targetVersion: currentOpenClawVersion,
    });

    assert.equal(result.localUpstreamVersion, staleOpenClawVersion);
    assert.equal(result.localUpstreamHasTargetTag, false);
    assert.equal(result.localUpstreamDirty, false);
    assert.equal(result.localTarballPresent, true);
    assert.equal(result.readyToUpgrade, true);
    assert.deepEqual(result.blockers, []);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

await runTest('OpenClaw upgrade readiness git probes hide Windows console windows', async () => {
  const source = readFileSync(
    path.join(rootDir, 'scripts', 'openclaw-upgrade-readiness.mjs'),
    'utf8',
  );

  assert.match(
    source,
    /spawnSync\('git', \['-C', repoDir, 'status', '--short'\][\s\S]*windowsHide:\s*true/,
    'OpenClaw upgrade readiness git probes must not show Windows console windows',
  );
});

await runTest('assessOpenClawUpgradeReadiness reports missing local upgrade inputs honestly', async () => {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'openclaw-upgrade-readiness-blocked-'));

  try {
    createReleaseConfig(tempRoot, previousOpenClawVersion);
    createJson(path.join(tempRoot, 'packages', 'sdkwork-claw-desktop', 'src-tauri', 'resources', 'openclaw', 'manifest.json'), {
      schemaVersion: 1,
      runtimeId: 'openclaw',
      openclawVersion: previousOpenClawVersion,
      nodeVersion: expectedNodeVersion,
      platform: 'windows',
      arch: 'x64',
    });
    createJson(path.join(tempRoot, 'packages', 'sdkwork-claw-desktop', 'src-tauri', 'resources', 'openclaw', 'runtime', 'package', 'node_modules', 'openclaw', 'package.json'), {
      name: 'openclaw',
      version: previousOpenClawVersion,
    });
    createJson(path.join(tempRoot, '.cache', 'bundled-components', 'upstreams', 'openclaw', 'package.json'), {
      name: 'openclaw',
      version: previousOpenClawVersion,
    });
    createGitHeadRepo(path.join(tempRoot, '.cache', 'bundled-components', 'upstreams', 'openclaw'));
    createText(
      path.join(tempRoot, '.cache', 'bundled-components', 'upstreams', 'openclaw', '.git', 'status.fake'),
      ' M src/runtime.ts\n',
    );

    const result = await assessOpenClawUpgradeReadiness({
      workspaceRootDir: tempRoot,
      targetVersion: currentOpenClawVersion,
    });

    assert.equal(result.readyToUpgrade, false);
    assert.equal(result.localUpstreamHasTargetTag, false);
    assert.equal(result.localUpstreamDirty, true);
    assert.equal(result.localUpstreamDirtyCheck, 'fixture');
    assert.equal(result.localTarballPresent, false);
    assert.equal(result.localUpstreamVersion, previousOpenClawVersion);
    assert.deepEqual(result.blockers, [
      `Local OpenClaw upstream checkout is still at ${previousOpenClawVersion} instead of ${currentOpenClawVersion}.`,
      `Local OpenClaw upstream checkout does not contain git tag v${currentOpenClawVersion}.`,
      'Local OpenClaw upstream checkout has uncommitted changes and should not be hard-reset in place.',
      `No local openclaw-${currentOpenClawVersion}.tgz tarball is available for an offline packaged OpenClaw upgrade.`,
    ]);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

await runTest(
  'assessOpenClawUpgradeReadiness reports unsupported source runtime layouts as upgrade blockers',
  async () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'openclaw-upgrade-readiness-unsupported-source-'));

    try {
      createReleaseConfig(tempRoot, previousOpenClawVersion);
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
          openclawVersion: previousOpenClawVersion,
          nodeVersion: expectedNodeVersion,
          platform: 'windows',
          arch: 'x64',
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
          version: previousOpenClawVersion,
        },
      );
      createJson(path.join(tempRoot, '.cache', 'bundled-components', 'upstreams', 'openclaw', 'package.json'), {
        name: 'openclaw',
        version: currentOpenClawVersion,
      });
      createGitHeadRepo(path.join(tempRoot, '.cache', 'bundled-components', 'upstreams', 'openclaw'), {
        head: '89abcdef0123456789abcdef0123456789abcdef',
        tags: {
          [`v${currentOpenClawVersion}`]: '89abcdef0123456789abcdef0123456789abcdef',
        },
      });
      createText(
        path.join(tempRoot, '.cache', 'bundled-components', 'upstreams', 'openclaw', '.git', 'status.fake'),
        '',
      );
      createText(path.join(tempRoot, `openclaw-${currentOpenClawVersion}.tgz`), 'tarball');
      createJson(
        path.join(
          tempRoot,
          'packages',
          'sdkwork-claw-desktop',
          'src-tauri',
          'resources',
          'openclaw-runtime',
          'manifest.json',
        ),
        {
          schemaVersion: 1,
          runtimeId: 'openclaw',
          openclawVersion: retiredOpenClawVersion,
          nodeVersion: expectedNodeVersion,
          platform: 'windows',
          arch: 'x64',
        },
      );
      createJson(
        path.join(
          tempRoot,
          'packages',
          'sdkwork-claw-desktop',
          'src-tauri',
          'resources',
          'openclaw-runtime',
          'runtime',
          'package',
          'node_modules',
          'openclaw',
          'package.json',
        ),
        {
          name: 'openclaw',
          version: retiredOpenClawVersion,
        },
      );

      const result = await assessOpenClawUpgradeReadiness({
        workspaceRootDir: tempRoot,
        targetVersion: currentOpenClawVersion,
      });

      assert.equal(result.readyToUpgrade, false);
      assert.equal(result.unsupportedSourceRuntimeDirPresent, true);
      assert.equal(result.unsupportedSourceRuntimeVersion, retiredOpenClawVersion);
      assert.equal(result.unsupportedBundledNodeRuntimeDirPresent, false);
      assert.deepEqual(result.blockers, [
        `Unsupported OpenClaw runtime layout is present at packages/sdkwork-claw-desktop/src-tauri/resources/openclaw-runtime (detected version ${retiredOpenClawVersion}). Remove retired layout artifacts before upgrading the packaged OpenClaw runtime.`,
      ]);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  },
);

await runTest(
  'assessOpenClawUpgradeReadiness distinguishes current baseline alignment from future upgrade readiness',
  async () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'openclaw-upgrade-readiness-current-baseline-'));

    try {
      createReleaseConfig(tempRoot, currentOpenClawVersion);
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
          openclawVersion: currentOpenClawVersion,
          nodeVersion: expectedNodeVersion,
          platform: 'windows',
          arch: 'x64',
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
          openclawVersion: currentOpenClawVersion,
          nodeVersion: expectedNodeVersion,
          platform: 'windows',
          arch: 'x64',
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
          version: currentOpenClawVersion,
        },
      );
      createJson(path.join(tempRoot, '.cache', 'bundled-components', 'upstreams', 'openclaw', 'package.json'), {
        name: 'openclaw',
        version: currentOpenClawVersion,
      });
      createGitHeadRepo(path.join(tempRoot, '.cache', 'bundled-components', 'upstreams', 'openclaw'), {
        head: '0123456789abcdef0123456789abcdef01234567',
        tags: {
          [`v${previousOpenClawVersion}`]: 'fedcba9876543210fedcba9876543210fedcba98',
        },
      });
      createText(
        path.join(tempRoot, '.cache', 'bundled-components', 'upstreams', 'openclaw', '.git', 'status.fake'),
        '',
      );

      const result = await assessOpenClawUpgradeReadiness({
        workspaceRootDir: tempRoot,
        targetVersion: currentOpenClawVersion,
      });

      assert.equal(result.versionSourcesAligned, true);
      assert.equal(result.readyToUpgrade, false);
      assert.deepEqual(result.blockers, [
        `Local OpenClaw upstream checkout does not contain git tag v${currentOpenClawVersion}.`,
      ]);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  },
);

await runTest(
  'assessOpenClawUpgradeReadiness keeps packaged version alignment separate from missing local upgrade inputs',
  async () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'openclaw-upgrade-readiness-missing-upstream-'));

    try {
      createReleaseConfig(tempRoot, currentOpenClawVersion);
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
          openclawVersion: currentOpenClawVersion,
          nodeVersion: expectedNodeVersion,
          platform: 'windows',
          arch: 'x64',
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
          openclawVersion: currentOpenClawVersion,
          nodeVersion: expectedNodeVersion,
          platform: 'windows',
          arch: 'x64',
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
          version: currentOpenClawVersion,
        },
      );

      const result = await assessOpenClawUpgradeReadiness({
        workspaceRootDir: tempRoot,
        targetVersion: currentOpenClawVersion,
      });

      assert.equal(result.configuredVersion, currentOpenClawVersion);
      assert.equal(result.bundledManifestVersion, currentOpenClawVersion);
      assert.equal(result.generatedManifestVersion, currentOpenClawVersion);
      assert.equal(result.localPreparedRuntimeVersion, currentOpenClawVersion);
      assert.equal(result.localUpstreamVersion, null);
      assert.equal(result.versionSourcesAligned, true);
      assert.equal(result.readyToUpgrade, false);
      assert.deepEqual(result.blockers, [
        `Local OpenClaw upstream checkout is still at unknown instead of ${currentOpenClawVersion}.`,
        `Local OpenClaw upstream checkout does not contain git tag v${currentOpenClawVersion}.`,
        `No local openclaw-${currentOpenClawVersion}.tgz tarball is available for an offline packaged OpenClaw upgrade.`,
      ]);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  },
);
