import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

import {
  REMOVED_OPENCLAW_RUNTIME_CLEANUP_SCRIPT_ENTRY,
} from './test-support/openclaw-retired-upgrade-entries.mjs';
import { shiftNumericVersion } from './test-support/version-fixtures.mjs';
import {
  buildOpenClawManifest,
  prepareOpenClawRuntimeFromSource,
  resolveOpenClawTarget,
  syncPackagedOpenClawReleaseArtifacts,
} from './prepare-openclaw-runtime.mjs';

const rootDir = path.resolve(import.meta.dirname, '..');
const releaseConfig = JSON.parse(
  readFileSync(path.join(rootDir, 'config', 'kernel-releases', 'openclaw.json'), 'utf8'),
);
const expectedOpenClawVersion = releaseConfig.stableVersion;
const expectedNodeVersion = releaseConfig.nodeVersion;
const retiredOpenClawVersion = shiftNumericVersion(expectedOpenClawVersion, -1);

function createJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function createAlreadyPatchedOpenClawServerImpl(packageRootDir) {
  const serverImplPath = path.join(
    packageRootDir,
    'node_modules',
    'openclaw',
    'dist',
    'server.impl-fixture.js',
  );
  mkdirSync(path.dirname(serverImplPath), { recursive: true });
  writeFileSync(
    serverImplPath,
    [
      'function materializeConfigAgentPaths(config, previousConfig) {',
      '  const hasCanonicalAgentDirShape = true;',
      '  return { config, previousConfig, hasCanonicalAgentDirShape };',
      '}',
      '',
    ].join('\n'),
    'utf8',
  );
}

function createUnsupportedSourceRuntime(workspaceRootDir, version = retiredOpenClawVersion) {
  const sourceRuntimeDir = path.join(
    workspaceRootDir,
    'packages',
    'sdkwork-agentstudio-pc-desktop',
    'src-tauri',
    'resources',
    'openclaw-runtime',
  );
  createJson(path.join(sourceRuntimeDir, 'manifest.json'), {
    schemaVersion: 1,
    runtimeId: 'openclaw',
    openclawVersion: version,
    nodeVersion: expectedNodeVersion,
    platform: 'windows',
    arch: 'x64',
  });
  createJson(
    path.join(
      sourceRuntimeDir,
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
  return sourceRuntimeDir;
}

function createUnsupportedBundledNodeRuntime(workspaceRootDir) {
  const bundledNodeRuntimeDir = path.join(
    workspaceRootDir,
    'packages',
    'sdkwork-agentstudio-pc-desktop',
    'src-tauri',
    'resources',
    'openclaw',
    'runtime',
    'node',
  );
  mkdirSync(bundledNodeRuntimeDir, { recursive: true });
  writeFileSync(path.join(bundledNodeRuntimeDir, 'node.exe'), 'synthetic-node-runtime', 'utf8');
  return bundledNodeRuntimeDir;
}

function createPreparedReleaseFixture({
  platform = 'windows',
  arch = 'x64',
} = {}) {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'assert-openclaw-runtime-layout-'));
  const sourceRuntimeDir = path.join(tempRoot, 'source-runtime');
  const resourceDir = path.join(tempRoot, 'resource-runtime');
  const workspaceRootDir = path.join(tempRoot, 'workspace-root');
  const target = resolveOpenClawTarget(platform, arch);
  const manifest = buildOpenClawManifest({
    openclawVersion: expectedOpenClawVersion,
    nodeVersion: expectedNodeVersion,
    target,
  });
  const cliPath = path.join(
    sourceRuntimeDir,
    manifest.cliRelativePath.replace(/^runtime[\\/]/, ''),
  );
  const openclawPackageJsonPath = path.join(
    sourceRuntimeDir,
    'package',
    'node_modules',
    'openclaw',
    'package.json',
  );
  const carbonPackageJsonPath = path.join(
    sourceRuntimeDir,
    'package',
    'node_modules',
    '@buape',
    'carbon',
    'package.json',
  );

  mkdirSync(path.dirname(cliPath), { recursive: true });
  mkdirSync(path.dirname(openclawPackageJsonPath), { recursive: true });
  mkdirSync(path.dirname(carbonPackageJsonPath), { recursive: true });
  mkdirSync(resourceDir, { recursive: true });
  writeFileSync(cliPath, 'console.log("openclaw");\n', 'utf8');
  createAlreadyPatchedOpenClawServerImpl(path.join(sourceRuntimeDir, 'package'));
  writeFileSync(
    openclawPackageJsonPath,
    `${JSON.stringify({ name: 'openclaw', version: expectedOpenClawVersion }, null, 2)}\n`,
    'utf8',
  );
  writeFileSync(
    carbonPackageJsonPath,
    `${JSON.stringify({ name: '@buape/carbon', version: '0.14.0' }, null, 2)}\n`,
    'utf8',
  );

  return prepareOpenClawRuntimeFromSource({
    sourceRuntimeDir,
    resourceDir,
    openclawVersion: expectedOpenClawVersion,
    nodeVersion: expectedNodeVersion,
    target,
  }).then((result) => ({
    tempRoot,
    workspaceRootDir,
    resourceDir,
    target,
    manifest: result.manifest,
  }));
}

test('assertOpenClawRuntimeLayout rejects retired source-runtime layouts without deleting them', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'assert-openclaw-runtime-layout.mjs');
  const layout = await import(pathToFileURL(modulePath).href);

  assert.equal(typeof layout.inspectUnsupportedOpenClawRuntimeLayout, 'function');
  assert.equal(typeof layout.assertNoUnsupportedOpenClawRuntimeLayout, 'function');

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'assert-openclaw-layout-source-'));
  try {
    const sourceRuntimeDir = createUnsupportedSourceRuntime(tempRoot);

    const inspection = await layout.inspectUnsupportedOpenClawRuntimeLayout({
      workspaceRootDir: tempRoot,
    });
    assert.equal(inspection.sourceRuntimeDirPresent, true);
    assert.equal(inspection.sourceRuntimeVersion, retiredOpenClawVersion);

    await assert.rejects(
      layout.assertNoUnsupportedOpenClawRuntimeLayout({ workspaceRootDir: tempRoot }),
      /Unsupported OpenClaw runtime layout|openclaw-runtime|before continuing/i,
    );
    assert.equal(existsSync(sourceRuntimeDir), true);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('assertOpenClawRuntimeLayout rejects bundled Node runtime residue without deleting it', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'assert-openclaw-runtime-layout.mjs');
  const layout = await import(pathToFileURL(modulePath).href);

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'assert-openclaw-layout-node-'));
  try {
    const bundledNodeRuntimeDir = createUnsupportedBundledNodeRuntime(tempRoot);

    const inspection = await layout.inspectUnsupportedOpenClawRuntimeLayout({
      workspaceRootDir: tempRoot,
    });
    assert.equal(inspection.bundledNodeRuntimeDirPresent, true);

    await assert.rejects(
      layout.assertNoUnsupportedOpenClawRuntimeLayout({ workspaceRootDir: tempRoot }),
      /Unsupported OpenClaw runtime layout|bundled Node runtime/i,
    );
    assert.equal(existsSync(bundledNodeRuntimeDir), true);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('syncPackagedOpenClawReleaseArtifacts rejects unsupported source runtime layouts before mirroring assets', async () => {
  const fixture = await createPreparedReleaseFixture({
    platform: 'linux',
    arch: 'x64',
  });

  try {
    const sourceRuntimeDir = createUnsupportedSourceRuntime(fixture.workspaceRootDir);

    await assert.rejects(
      syncPackagedOpenClawReleaseArtifacts({
        resourceDir: fixture.resourceDir,
        workspaceRootDir: fixture.workspaceRootDir,
        target: fixture.target,
        manifest: fixture.manifest,
      }),
      /Unsupported OpenClaw runtime layout|openclaw-runtime/i,
    );
    assert.equal(existsSync(sourceRuntimeDir), true);
  } finally {
    rmSync(fixture.tempRoot, { recursive: true, force: true });
  }
});

test('syncPackagedOpenClawReleaseArtifacts rejects bundled Node residue before mirroring assets', async () => {
  const fixture = await createPreparedReleaseFixture({
    platform: 'linux',
    arch: 'x64',
  });

  try {
    const bundledNodeRuntimeDir = createUnsupportedBundledNodeRuntime(fixture.workspaceRootDir);

    await assert.rejects(
      syncPackagedOpenClawReleaseArtifacts({
        resourceDir: fixture.resourceDir,
        workspaceRootDir: fixture.workspaceRootDir,
        target: fixture.target,
        manifest: fixture.manifest,
      }),
      /Unsupported OpenClaw runtime layout|bundled Node runtime/i,
    );
    assert.equal(existsSync(bundledNodeRuntimeDir), true);
  } finally {
    rmSync(fixture.tempRoot, { recursive: true, force: true });
  }
});

test('desktop openclaw runtime check fails hard on unsupported runtime layouts', () => {
  const packageJson = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'));

  assert.match(
    packageJson.scripts['check:desktop-openclaw-runtime'],
    /node scripts\/assert-openclaw-runtime-layout\.test\.mjs/,
    'check:desktop-openclaw-runtime must execute the current runtime layout assertion contract',
  );
  assert.match(
    packageJson.scripts['check:desktop-openclaw-runtime'],
    /node scripts\/assert-openclaw-runtime-layout\.mjs/,
    'check:desktop-openclaw-runtime must reject unsupported runtime layouts before probing the current workspace',
  );
  assert.doesNotMatch(
    packageJson.scripts['check:desktop-openclaw-runtime'],
    REMOVED_OPENCLAW_RUNTIME_CLEANUP_SCRIPT_ENTRY.fileNamePattern,
    'check:desktop-openclaw-runtime must not repair retired OpenClaw runtime layouts',
  );
});
