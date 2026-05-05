import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

import {
  BUNDLED_RESOURCE_RUNTIME_ARCHIVE_FILENAME,
  buildOpenClawManifest,
  prepareOpenClawRuntimeFromSource,
  resolveOpenClawTarget,
  resolvePackagedOpenClawInstallRootLayoutDir,
  resolvePackagedOpenClawResourceDir,
  syncPackagedOpenClawReleaseArtifacts,
} from './prepare-openclaw-runtime.mjs';
import { resolveKernelReleaseConfig } from './release/kernel-releases.mjs';
import { createStoredZipArchive } from './test-support/archive-fixtures.mjs';
import { shiftNumericVersion } from './test-support/version-fixtures.mjs';

const rootDir = path.resolve(import.meta.dirname, '..');
const fakeNodeExecutableContent = 'synthetic-node-runtime';
const releaseConfig = resolveKernelReleaseConfig('openclaw');
const expectedOpenClawVersion = releaseConfig.stableVersion;
const expectedNodeVersion = releaseConfig.nodeVersion;
const retiredOpenClawVersion = shiftNumericVersion(expectedOpenClawVersion, -1);

function buildRuntimeArchiveEntries(sourceRoot, extraEntries = []) {
  const manifest = JSON.parse(readFileSync(path.join(sourceRoot, 'manifest.json'), 'utf8'));
  const sidecarManifest = {
    ...manifest,
    runtimeIntegrity: {
      schemaVersion: 1,
      files: [
        {
          relativePath: manifest.cliRelativePath,
          sha256: 'synthetic',
          size: 1,
        },
      ],
    },
  };

  return [
    {
      name: 'runtime/.sdkwork-openclaw-runtime.json',
      content: `${JSON.stringify(sidecarManifest, null, 2)}\n`,
    },
    {
      name: manifest.cliRelativePath,
      content: 'console.log("synthetic runtime archive cli");\n',
    },
    ...extraEntries,
  ];
}

function buildExpectedInstallReadyLayout(manifest, mode) {
  return {
    mode,
    installKey: `${manifest.openclawVersion}-${manifest.platform}-${manifest.arch}`,
    reuseOnFirstLaunch: true,
    requiresArchiveExtractionOnFirstLaunch: false,
    manifestRelativePath: 'manifest.json',
    runtimeSidecarRelativePath: 'runtime/.sdkwork-openclaw-runtime.json',
    cliEntryRelativePath: manifest.cliRelativePath,
  };
}

async function setupPreparedReleaseAssets({
  platform,
  arch,
  createArchiveImpl,
  includeBundledNode = false,
} = {}) {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'verify-openclaw-release-assets-'));
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
  const openclawServerImplPath = path.join(
    sourceRuntimeDir,
    'package',
    'node_modules',
    'openclaw',
    'dist',
    'server.impl-fixture.js',
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
  mkdirSync(path.dirname(openclawServerImplPath), { recursive: true });
  mkdirSync(path.dirname(carbonPackageJsonPath), { recursive: true });
  mkdirSync(resourceDir, { recursive: true });
  if (includeBundledNode) {
    const nodePath = path.join(
      sourceRuntimeDir,
      target.nodeBinaryRelativePath.replace(/^runtime[\\/]/, ''),
    );
    mkdirSync(path.dirname(nodePath), { recursive: true });
    writeFileSync(nodePath, fakeNodeExecutableContent, 'utf8');
  }
  writeFileSync(cliPath, 'console.log("openclaw");\n', 'utf8');
  writeFileSync(
    openclawServerImplPath,
    [
      'function materializeConfigAgentPaths(config, previousConfig) {',
      '  const hasCanonicalAgentDirShape = true;',
      '  return { config, previousConfig, hasCanonicalAgentDirShape };',
      '}',
      '',
    ].join('\n'),
    'utf8',
  );
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

  await prepareOpenClawRuntimeFromSource({
    sourceRuntimeDir,
    resourceDir,
    openclawVersion: expectedOpenClawVersion,
    nodeVersion: expectedNodeVersion,
    target,
  });

  await syncPackagedOpenClawReleaseArtifacts({
    resourceDir,
    workspaceRootDir,
    target,
    createArchiveImpl,
  });

  return {
    tempRoot,
    manifest,
    resourceDir,
    target,
    workspaceRootDir,
    packagedResourceDir: resolvePackagedOpenClawResourceDir(workspaceRootDir, target.platformId),
    packagedInstallRootLayoutDir: resolvePackagedOpenClawInstallRootLayoutDir(
      workspaceRootDir,
      target.platformId,
    ),
  };
}

test('desktop OpenClaw release asset verifier accepts Windows archive-only packaged resources', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'verify-desktop-openclaw-release-assets.mjs');
  const verifier = await import(pathToFileURL(modulePath).href);

  assert.equal(typeof verifier.verifyDesktopOpenClawReleaseAssets, 'function');

  const fixture = await setupPreparedReleaseAssets({
    platform: 'windows',
    arch: 'x64',
  });

  try {
    const result = await verifier.verifyDesktopOpenClawReleaseAssets({
      workspaceRootDir: fixture.workspaceRootDir,
      resourceDir: fixture.resourceDir,
      target: fixture.target,
    });

    assert.equal(result.manifest.platform, 'windows');
    assert.equal(result.manifest.arch, 'x64');
    assert.equal(Object.hasOwn(result.manifest, 'nodeVersion'), false);
    assert.deepEqual(result.manifest.requiredExternalRuntimes, ['nodejs']);
    assert.equal(result.manifest.requiredExternalRuntimeVersions?.nodejs, expectedNodeVersion);
    assert.equal(result.packagedResourceDir, fixture.packagedResourceDir);
    assert.deepEqual(
      result.installReadyLayout,
      buildExpectedInstallReadyLayout(result.manifest, 'archive-extract-ready'),
    );
    assert.equal(
      existsSync(path.join(fixture.packagedResourceDir, BUNDLED_RESOURCE_RUNTIME_ARCHIVE_FILENAME)),
      true,
    );
    assert.equal(existsSync(path.join(fixture.packagedResourceDir, 'runtime')), false);
  } finally {
    rmSync(fixture.tempRoot, { recursive: true, force: true });
  }
});

test('desktop OpenClaw release asset verifier accepts macOS staged install-root layouts', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'verify-desktop-openclaw-release-assets.mjs');
  const verifier = await import(pathToFileURL(modulePath).href);

  const fixture = await setupPreparedReleaseAssets({
    platform: 'macos',
    arch: 'arm64',
  });

  try {
    const result = await verifier.verifyDesktopOpenClawReleaseAssets({
      workspaceRootDir: fixture.workspaceRootDir,
      resourceDir: fixture.resourceDir,
      target: fixture.target,
    });
    const installKey = `${result.manifest.openclawVersion}-${result.manifest.platform}-${result.manifest.arch}`;

    assert.equal(result.manifest.platform, 'macos');
    assert.equal(result.manifest.arch, 'arm64');
    assert.equal(result.packagedInstallRootLayoutDir, fixture.packagedInstallRootLayoutDir);
    assert.deepEqual(
      result.installReadyLayout,
      {
        ...buildExpectedInstallReadyLayout(result.manifest, 'staged-layout'),
        installKey,
      },
    );
    assert.equal(
      existsSync(
        path.join(
          fixture.packagedInstallRootLayoutDir,
          'runtimes',
          'openclaw',
          installKey,
          'runtime',
          '.sdkwork-openclaw-runtime.json',
        ),
      ),
      true,
    );
  } finally {
    rmSync(fixture.tempRoot, { recursive: true, force: true });
  }
});

test('desktop OpenClaw release asset verifier accepts Linux archive-only packaged resources and validates simulated install-root readiness', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'verify-desktop-openclaw-release-assets.mjs');
  const verifier = await import(pathToFileURL(modulePath).href);

  const fixture = await setupPreparedReleaseAssets({
    platform: 'linux',
    arch: 'x64',
  });

  try {
    const result = await verifier.verifyDesktopOpenClawReleaseAssets({
      workspaceRootDir: fixture.workspaceRootDir,
      resourceDir: fixture.resourceDir,
      target: fixture.target,
    });

    assert.equal(result.manifest.platform, 'linux');
    assert.equal(result.manifest.arch, 'x64');
    assert.equal(result.packagedInstallRootLayoutDir, null);
    assert.deepEqual(
      result.installReadyLayout,
      buildExpectedInstallReadyLayout(result.manifest, 'archive-extract-ready'),
    );
  } finally {
    rmSync(fixture.tempRoot, { recursive: true, force: true });
  }
});

test('desktop OpenClaw release asset verifier rejects packaged resource roots that are not archive-only', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'verify-desktop-openclaw-release-assets.mjs');
  const verifier = await import(pathToFileURL(modulePath).href);

  const fixture = await setupPreparedReleaseAssets({
    platform: 'linux',
    arch: 'x64',
  });

  try {
    mkdirSync(path.join(fixture.packagedResourceDir, 'runtime'), { recursive: true });
    writeFileSync(path.join(fixture.packagedResourceDir, 'runtime', 'stale.txt'), 'stale\n', 'utf8');

    await assert.rejects(
      verifier.verifyDesktopOpenClawReleaseAssets({
        workspaceRootDir: fixture.workspaceRootDir,
        resourceDir: fixture.resourceDir,
        target: fixture.target,
      }),
      /archive-only|runtime/i,
    );
  } finally {
    rmSync(fixture.tempRoot, { recursive: true, force: true });
  }
});

test('desktop OpenClaw release asset verifier rejects unsupported source runtime layouts under src-tauri/resources/openclaw-runtime', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'verify-desktop-openclaw-release-assets.mjs');
  const verifier = await import(pathToFileURL(modulePath).href);

  const fixture = await setupPreparedReleaseAssets({
    platform: 'linux',
    arch: 'x64',
  });

  try {
    const unsupportedRuntimeRoot = path.join(
      fixture.workspaceRootDir,
      'packages',
      'sdkwork-claw-desktop',
      'src-tauri',
      'resources',
      'openclaw-runtime',
    );
    mkdirSync(
      path.join(unsupportedRuntimeRoot, 'runtime', 'package', 'node_modules', 'openclaw'),
      { recursive: true },
    );
    writeFileSync(
      path.join(unsupportedRuntimeRoot, 'manifest.json'),
      `${JSON.stringify({
        schemaVersion: 1,
        runtimeId: 'openclaw',
        openclawVersion: retiredOpenClawVersion,
        nodeVersion: expectedNodeVersion,
        platform: 'windows',
        arch: 'x64',
      }, null, 2)}\n`,
      'utf8',
    );
    writeFileSync(
      path.join(
        unsupportedRuntimeRoot,
        'runtime',
        'package',
        'node_modules',
        'openclaw',
        'package.json',
      ),
      `${JSON.stringify({ name: 'openclaw', version: retiredOpenClawVersion }, null, 2)}\n`,
      'utf8',
    );

    await assert.rejects(
      verifier.verifyDesktopOpenClawReleaseAssets({
        workspaceRootDir: fixture.workspaceRootDir,
        resourceDir: fixture.resourceDir,
        target: fixture.target,
      }),
      new RegExp(
        `Unsupported OpenClaw runtime layout|openclaw-runtime|${retiredOpenClawVersion.replaceAll('.', '\\.')}`,
        'i',
      ),
    );
  } finally {
    rmSync(fixture.tempRoot, { recursive: true, force: true });
  }
});

test('desktop OpenClaw release asset verifier rejects invalid archive payloads', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'verify-desktop-openclaw-release-assets.mjs');
  const verifier = await import(pathToFileURL(modulePath).href);

  const fixture = await setupPreparedReleaseAssets({
    platform: 'linux',
    arch: 'x64',
    createArchiveImpl: async ({ archivePath }) => {
      await writeFile(archivePath, 'not-a-real-zip-archive', 'utf8');
    },
  });

  try {
    await assert.rejects(
      verifier.verifyDesktopOpenClawReleaseAssets({
        workspaceRootDir: fixture.workspaceRootDir,
        resourceDir: fixture.resourceDir,
        target: fixture.target,
      }),
      /archive|extract|runtime/i,
    );
  } finally {
    rmSync(fixture.tempRoot, { recursive: true, force: true });
  }
});

test('desktop OpenClaw release asset verifier rejects duplicate normalized runtime archive entries', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'verify-desktop-openclaw-release-assets.mjs');
  const verifier = await import(pathToFileURL(modulePath).href);

  const fixture = await setupPreparedReleaseAssets({
    platform: 'linux',
    arch: 'x64',
    createArchiveImpl: async ({ archivePath, sourceRoot }) => {
      await writeFile(
        archivePath,
        createStoredZipArchive(buildRuntimeArchiveEntries(sourceRoot, [
          {
            name: 'runtime/package/node_modules/openclaw/duplicate.js',
            content: 'first\n',
          },
          {
            name: 'runtime\\package\\node_modules\\openclaw\\duplicate.js',
            content: 'second\n',
          },
        ])),
      );
    },
  });

  try {
    await assert.rejects(
      verifier.verifyDesktopOpenClawReleaseAssets({
        workspaceRootDir: fixture.workspaceRootDir,
        resourceDir: fixture.resourceDir,
        target: fixture.target,
      }),
      /duplicate archive entry/i,
    );
  } finally {
    rmSync(fixture.tempRoot, { recursive: true, force: true });
  }
});

test('desktop OpenClaw release asset verifier rejects symlink runtime archive entries', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'verify-desktop-openclaw-release-assets.mjs');
  const verifier = await import(pathToFileURL(modulePath).href);

  const fixture = await setupPreparedReleaseAssets({
    platform: 'linux',
    arch: 'x64',
    createArchiveImpl: async ({ archivePath, sourceRoot }) => {
      await writeFile(
        archivePath,
        createStoredZipArchive(buildRuntimeArchiveEntries(sourceRoot, [
          {
            name: 'runtime/package/node_modules/openclaw/symlink',
            content: 'openclaw.mjs',
            externalAttributes: 0o120777 << 16,
          },
        ])),
      );
    },
  });

  try {
    await assert.rejects(
      verifier.verifyDesktopOpenClawReleaseAssets({
        workspaceRootDir: fixture.workspaceRootDir,
        resourceDir: fixture.resourceDir,
        target: fixture.target,
      }),
      /unsupported archive entry type/i,
    );
  } finally {
    rmSync(fixture.tempRoot, { recursive: true, force: true });
  }
});

test('desktop OpenClaw release asset verifier rejects packaged runtime archives that still contain a bundled Node payload', async () => {
  const modulePath = path.join(rootDir, 'scripts', 'verify-desktop-openclaw-release-assets.mjs');
  const verifier = await import(pathToFileURL(modulePath).href);

  const fixture = await setupPreparedReleaseAssets({
    platform: 'linux',
    arch: 'x64',
  });

  try {
    mkdirSync(path.join(fixture.packagedResourceDir, 'runtime', 'node'), { recursive: true });
    writeFileSync(
      path.join(fixture.packagedResourceDir, 'runtime', 'node', 'node'),
      fakeNodeExecutableContent,
      'utf8',
    );

    await assert.rejects(
      verifier.verifyDesktopOpenClawReleaseAssets({
        workspaceRootDir: fixture.workspaceRootDir,
        resourceDir: fixture.resourceDir,
        target: fixture.target,
      }),
      /bundled node|runtime\/node|must not contain|archive-only|runtime/i,
    );
  } finally {
    rmSync(fixture.tempRoot, { recursive: true, force: true });
  }
});

test('desktop OpenClaw release asset verifier cli wraps the entrypoint with a top-level error handler', () => {
  const source = readFileSync(
    path.join(rootDir, 'scripts', 'verify-desktop-openclaw-release-assets.mjs'),
    'utf8',
  );

  assert.match(
    source,
    /if \(path\.resolve\(process\.argv\[1\] \?\? ''\) === __filename\) \{\s*main\(\)\.catch\(\(error\) => \{\s*console\.error\(error instanceof Error \? error\.message : String\(error\)\);\s*process\.exit\(1\);\s*\}\);\s*\}/s,
  );
});

test('prepare-openclaw-runtime cli verifies staged desktop release assets before reporting success', () => {
  const source = readFileSync(
    path.join(rootDir, 'scripts', 'prepare-openclaw-runtime.mjs'),
    'utf8',
  );

  assert.match(
    source,
    /await import\('\.\/verify-desktop-openclaw-release-assets\.mjs'\)/,
    'prepare-openclaw-runtime must import the desktop OpenClaw release asset verifier before reporting success',
  );
  assert.match(
    source,
    /await verifyDesktopOpenClawReleaseAssets\(\{\s*resourceDir: result\.resourceDir,\s*target: resolveRequestedOpenClawTarget\(\),\s*\}\)/s,
    'prepare-openclaw-runtime must verify the prepared desktop OpenClaw release assets after preparation succeeds',
  );
});
