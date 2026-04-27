import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  assessOpenClawUpgradeReadiness,
} from './openclaw-upgrade-readiness.mjs';

const rootDir = path.resolve(import.meta.dirname, '..');

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
    createReleaseConfig(tempRoot, '2026.4.2');
    createJson(path.join(tempRoot, 'packages', 'sdkwork-claw-desktop', 'src-tauri', 'resources', 'openclaw', 'manifest.json'), {
      schemaVersion: 1,
      runtimeId: 'openclaw',
      openclawVersion: '2026.4.2',
      nodeVersion: '22.16.0',
      platform: 'windows',
      arch: 'x64',
    });
    createJson(path.join(tempRoot, 'packages', 'sdkwork-claw-desktop', 'src-tauri', 'resources', 'openclaw', 'runtime', 'package', 'node_modules', 'openclaw', 'package.json'), {
      name: 'openclaw',
      version: '2026.4.2',
    });
    createJson(path.join(tempRoot, '.cache', 'bundled-components', 'upstreams', 'openclaw', 'package.json'), {
      name: 'openclaw',
      version: '2026.4.5',
    });
    createGitHeadRepo(path.join(tempRoot, '.cache', 'bundled-components', 'upstreams', 'openclaw'), {
      head: '89abcdef0123456789abcdef0123456789abcdef',
      tags: {
        'v2026.4.5': '89abcdef0123456789abcdef0123456789abcdef',
      },
    });
    createText(
      path.join(tempRoot, '.cache', 'bundled-components', 'upstreams', 'openclaw', '.git', 'status.fake'),
      '',
    );
    createText(path.join(tempRoot, 'openclaw-2026.4.5.tgz'), 'tarball');

    const result = await assessOpenClawUpgradeReadiness({
      workspaceRootDir: tempRoot,
      targetVersion: '2026.4.5',
    });

    assert.equal(result.targetVersion, '2026.4.5');
    assert.equal(result.configuredVersion, '2026.4.2');
    assert.equal(result.localPreparedRuntimeVersion, '2026.4.2');
    assert.equal(result.localUpstreamVersion, '2026.4.5');
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
    createReleaseConfig(tempRoot, '2026.4.2');
    createJson(path.join(tempRoot, 'packages', 'sdkwork-claw-desktop', 'src-tauri', 'resources', 'openclaw', 'manifest.json'), {
      schemaVersion: 1,
      runtimeId: 'openclaw',
      openclawVersion: '2026.4.2',
      nodeVersion: '22.16.0',
      platform: 'windows',
      arch: 'x64',
    });
    createJson(path.join(tempRoot, 'packages', 'sdkwork-claw-desktop', 'src-tauri', 'resources', 'openclaw', 'runtime', 'package', 'node_modules', 'openclaw', 'package.json'), {
      name: 'openclaw',
      version: '2026.4.2',
    });
    createJson(path.join(tempRoot, '.cache', 'bundled-components', 'upstreams', 'openclaw', 'package.json'), {
      name: 'openclaw',
      version: '2026.4.2',
    });
    createGitHeadRepo(path.join(tempRoot, '.cache', 'bundled-components', 'upstreams', 'openclaw'));
    createText(
      path.join(tempRoot, '.cache', 'bundled-components', 'upstreams', 'openclaw', '.git', 'status.fake'),
      ' M src/runtime.ts\n',
    );

    const result = await assessOpenClawUpgradeReadiness({
      workspaceRootDir: tempRoot,
      targetVersion: '2026.4.5',
    });

    assert.equal(result.readyToUpgrade, false);
    assert.equal(result.localUpstreamHasTargetTag, false);
    assert.equal(result.localUpstreamDirty, true);
    assert.equal(result.localUpstreamDirtyCheck, 'fixture');
    assert.equal(result.localTarballPresent, false);
    assert.equal(result.localUpstreamVersion, '2026.4.2');
    assert.deepEqual(result.blockers, [
      'Local OpenClaw upstream checkout is still at 2026.4.2 instead of 2026.4.5.',
      'Local OpenClaw upstream checkout does not contain git tag v2026.4.5.',
      'Local OpenClaw upstream checkout has uncommitted changes and should not be hard-reset in place.',
      'No local openclaw-2026.4.5.tgz tarball is available for an offline packaged OpenClaw upgrade.',
    ]);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

await runTest(
  'assessOpenClawUpgradeReadiness reports legacy source runtime residue as an upgrade blocker',
  async () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'openclaw-upgrade-readiness-legacy-source-'));

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
          'manifest.json',
        ),
        {
          schemaVersion: 1,
          runtimeId: 'openclaw',
          openclawVersion: '2026.4.9',
          nodeVersion: '22.16.0',
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
          version: '2026.4.9',
        },
      );
      createJson(path.join(tempRoot, '.cache', 'bundled-components', 'upstreams', 'openclaw', 'package.json'), {
        name: 'openclaw',
        version: '2026.4.11',
      });
      createGitHeadRepo(path.join(tempRoot, '.cache', 'bundled-components', 'upstreams', 'openclaw'), {
        head: '89abcdef0123456789abcdef0123456789abcdef',
        tags: {
          'v2026.4.11': '89abcdef0123456789abcdef0123456789abcdef',
        },
      });
      createText(
        path.join(tempRoot, '.cache', 'bundled-components', 'upstreams', 'openclaw', '.git', 'status.fake'),
        '',
      );
      createText(path.join(tempRoot, 'openclaw-2026.4.11.tgz'), 'tarball');
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
          openclawVersion: '2026.3.28',
          nodeVersion: '22.16.0',
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
          version: '2026.3.28',
        },
      );

      const result = await assessOpenClawUpgradeReadiness({
        workspaceRootDir: tempRoot,
        targetVersion: '2026.4.11',
      });

      assert.equal(result.readyToUpgrade, false);
      assert.equal(result.legacySourceRuntimeDirPresent, true);
      assert.equal(result.legacySourceRuntimeVersion, '2026.3.28');
      assert.deepEqual(result.blockers, [
        'Legacy desktop source runtime residue is still present at packages/sdkwork-claw-desktop/src-tauri/resources/openclaw-runtime (detected version 2026.3.28). Remove it before upgrading the packaged OpenClaw runtime.',
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
      createReleaseConfig(tempRoot, '2026.4.2');
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
          openclawVersion: '2026.4.2',
          nodeVersion: '22.16.0',
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
          openclawVersion: '2026.4.2',
          nodeVersion: '22.16.0',
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
          version: '2026.4.2',
        },
      );
      createJson(path.join(tempRoot, '.cache', 'bundled-components', 'upstreams', 'openclaw', 'package.json'), {
        name: 'openclaw',
        version: '2026.4.2',
      });
      createGitHeadRepo(path.join(tempRoot, '.cache', 'bundled-components', 'upstreams', 'openclaw'), {
        head: '0123456789abcdef0123456789abcdef01234567',
        tags: {
          'v2026.4.1': 'fedcba9876543210fedcba9876543210fedcba98',
        },
      });
      createText(
        path.join(tempRoot, '.cache', 'bundled-components', 'upstreams', 'openclaw', '.git', 'status.fake'),
        '',
      );

      const result = await assessOpenClawUpgradeReadiness({
        workspaceRootDir: tempRoot,
        targetVersion: '2026.4.2',
      });

      assert.equal(result.versionSourcesAligned, true);
      assert.equal(result.readyToUpgrade, false);
      assert.deepEqual(result.blockers, [
        'Local OpenClaw upstream checkout does not contain git tag v2026.4.2.',
      ]);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  },
);
