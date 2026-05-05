#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

import {
  BUNDLED_RESOURCE_RUNTIME_ARCHIVE_FILENAME,
  DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES,
  DEFAULT_RESOURCE_DIR,
  inspectPreparedOpenClawRuntime,
  resolvePackagedOpenClawInstallRootLayoutDir,
  resolvePackagedOpenClawResourceDir,
  resolveRequestedOpenClawTarget,
} from './prepare-openclaw-runtime.mjs';
import {
  buildDesktopInstallReadyLayout,
  resolveDesktopOpenClawInstallKeyFromManifest,
} from './release/desktop-install-ready-layout.mjs';
import { readZipArchiveEntries } from './release/archive-entry-safety.mjs';
import { assertNoUnsupportedOpenClawRuntimeLayout } from './assert-openclaw-runtime-layout.mjs';

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(import.meta.dirname, '..');
const RUNTIME_SIDECAR_MANIFEST_FILENAME = '.sdkwork-openclaw-runtime.json';

function resolveOpenClawInstallKey(manifest) {
  return resolveDesktopOpenClawInstallKeyFromManifest(manifest);
}

function assertManifestMatchesTarget(manifest, target, contextLabel) {
  assert.equal(
    manifest.runtimeId,
    'openclaw',
    `${contextLabel} must declare runtimeId=openclaw`,
  );
  assert.equal(
    manifest.platform,
    target.platformId,
    `${contextLabel} must target ${target.platformId}`,
  );
  assert.equal(
    manifest.arch,
    target.archId,
    `${contextLabel} must target ${target.archId}`,
  );
  assert.equal(
    manifest.cliRelativePath,
    target.cliRelativePath,
    `${contextLabel} must expose the target-specific OpenClaw CLI entrypoint`,
  );
  assert.notEqual(
    String(manifest.openclawVersion ?? '').trim(),
    '',
    `${contextLabel} must include an OpenClaw version`,
  );
  assert.notEqual(
    JSON.stringify(manifest.requiredExternalRuntimes ?? []),
    JSON.stringify([]),
    `${contextLabel} must include at least one required external runtime`,
  );
  assert.deepEqual(
    manifest.requiredExternalRuntimes,
    ['nodejs'],
    `${contextLabel} must require external Node.js instead of a packaged runtime`,
  );
  assert.notEqual(
    String(manifest.requiredExternalRuntimeVersions?.nodejs ?? '').trim(),
    '',
    `${contextLabel} must include an external Node version requirement`,
  );
  assert.equal(
    Object.hasOwn(manifest, 'nodeVersion'),
    false,
    `${contextLabel} must not expose a legacy top-level nodeVersion field`,
  );
}

function assertRuntimeSidecarMatchesManifest(sidecarManifest, expectedManifest, contextLabel) {
  for (const [fieldName, expectedValue] of Object.entries(expectedManifest)) {
    assert.deepEqual(
      sidecarManifest?.[fieldName],
      expectedValue,
      `${contextLabel} must preserve ${fieldName} from the prepared source manifest`,
    );
  }

  assert.equal(
    sidecarManifest?.runtimeIntegrity?.schemaVersion,
    1,
    `${contextLabel} must declare runtimeIntegrity.schemaVersion=1`,
  );
  assert.equal(
    Array.isArray(sidecarManifest?.runtimeIntegrity?.files),
    true,
    `${contextLabel} must expose runtimeIntegrity.files`,
  );
  assert.ok(
    sidecarManifest.runtimeIntegrity.files.length > 0,
    `${contextLabel} must include at least one integrity file entry`,
  );
}

async function readJsonFile(absolutePath, description) {
  try {
    return JSON.parse(await readFile(absolutePath, 'utf8'));
  } catch (error) {
    throw new Error(
      `Unable to read ${description} at ${absolutePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function ensurePathExists(absolutePath, description) {
  try {
    await stat(absolutePath);
  } catch (error) {
    throw new Error(
      `Missing ${description} at ${absolutePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function ensurePathMissing(absolutePath, description) {
  try {
    await stat(absolutePath);
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      return;
    }
    throw new Error(
      `Unable to inspect ${description} at ${absolutePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  throw new Error(`${description} must remain archive-only and must not exist at ${absolutePath}`);
}

async function assertUnsupportedOpenClawRuntimeLayoutMissing(workspaceRootDir) {
  await assertNoUnsupportedOpenClawRuntimeLayout({ workspaceRootDir });
}

function readZipEntryContent(buffer, entry, archivePath) {
  const offset = entry.localHeaderOffset;
  if (buffer.readUInt32LE(offset) !== 0x04034b50) {
    throw new Error(`Invalid ZIP local header for ${entry.fileName} in ${archivePath}.`);
  }

  const fileNameLength = buffer.readUInt16LE(offset + 26);
  const extraFieldLength = buffer.readUInt16LE(offset + 28);
  const dataStart = offset + 30 + fileNameLength + extraFieldLength;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataEnd > buffer.length) {
    throw new Error(`ZIP entry ${entry.fileName} exceeds archive bounds in ${archivePath}.`);
  }

  const rawContent = buffer.subarray(dataStart, dataEnd);
  if (entry.compressionMethod === 0) {
    return rawContent;
  }
  if (entry.compressionMethod === 8) {
    return inflateRawSync(rawContent);
  }

  throw new Error(
    `ZIP entry ${entry.fileName} in ${archivePath} uses unsupported compression method ${entry.compressionMethod}.`,
  );
}

async function verifyPackagedRuntimeArchive({
  packagedResourceDir,
  manifest,
  archiveFileName,
} = {}) {
  const archivePath = path.join(packagedResourceDir, archiveFileName);
  const archiveBuffer = await readFile(archivePath);
  const entries = readZipArchiveEntries(archivePath, {
    context: 'Desktop OpenClaw runtime',
  });
  const entryNames = new Set(entries.map((entry) => entry.normalizedPath));
  const cliRelativePath = String(manifest.cliRelativePath ?? '').replaceAll('\\', '/');

  assert.equal(
    entryNames.has(`runtime/${RUNTIME_SIDECAR_MANIFEST_FILENAME}`),
    true,
    'packaged OpenClaw runtime archive must contain the runtime sidecar manifest',
  );
  assert.equal(
    [...entryNames].some((entryName) => String(entryName ?? '').startsWith('runtime/node/')),
    false,
    'packaged OpenClaw runtime archive must not contain a bundled Node payload',
  );
  assert.equal(
    entryNames.has(cliRelativePath),
    true,
    'packaged OpenClaw runtime archive must contain the OpenClaw CLI entrypoint',
  );

  const runtimeSidecarEntry = entries.find(
    (entry) => entry.normalizedPath === `runtime/${RUNTIME_SIDECAR_MANIFEST_FILENAME}`,
  );
  const runtimeSidecarManifest = JSON.parse(
    readZipEntryContent(archiveBuffer, runtimeSidecarEntry, archivePath).toString('utf8'),
  );
  assertRuntimeSidecarMatchesManifest(
    runtimeSidecarManifest,
    manifest,
    'packaged OpenClaw runtime sidecar manifest must match the prepared source manifest',
  );
}

async function verifyMacosInstallRootLayout({
  manifest,
  packagedInstallRootLayoutDir,
} = {}) {
  const installKey = resolveOpenClawInstallKey(manifest);
  const installDir = path.join(
    packagedInstallRootLayoutDir,
    'runtimes',
    'openclaw',
    installKey,
  );
  await verifyMaterializedInstallRoot({
    manifest,
    installDir,
    contextLabel: 'staged macOS OpenClaw install root',
  });

  return buildDesktopInstallReadyLayout({
    manifest,
    mode: 'staged-layout',
  });
}

async function verifyMaterializedInstallRoot({
  manifest,
  installDir,
  contextLabel,
} = {}) {
  const installManifest = await readJsonFile(
    path.join(installDir, 'manifest.json'),
    `${contextLabel} manifest`,
  );
  assert.deepEqual(
    installManifest,
    manifest,
    `${contextLabel} manifest must match the prepared source manifest`,
  );

  const runtimeSidecarManifest = await readJsonFile(
    path.join(installDir, 'runtime', RUNTIME_SIDECAR_MANIFEST_FILENAME),
    `${contextLabel} runtime sidecar manifest`,
  );
  assertRuntimeSidecarMatchesManifest(
    runtimeSidecarManifest,
    manifest,
    `${contextLabel} runtime sidecar manifest must match the prepared source manifest`,
  );

  await ensurePathMissing(
    path.join(installDir, 'runtime', 'node'),
    `${contextLabel} bundled Node payload`,
  );
  await ensurePathExists(
    path.join(installDir, manifest.cliRelativePath),
    `${contextLabel} OpenClaw CLI entrypoint`,
  );
}

function resolveInstallReadyEntryPath(installDir, entryFileName) {
  const normalizedEntryName = String(entryFileName ?? '').replaceAll('\\', '/');
  const relativeSegments = normalizedEntryName
    .split('/')
    .filter(Boolean);

  if (
    relativeSegments.length === 0
    || normalizedEntryName.startsWith('/')
    || relativeSegments.some((segment) => segment === '.' || segment === '..')
  ) {
    throw new Error(`Packaged OpenClaw archive entry resolves outside the install root: ${normalizedEntryName}`);
  }

  return path.join(installDir, ...relativeSegments);
}

async function materializePackagedRuntimeArchiveIntoInstallDir({
  packagedResourceDir,
  installDir,
  archiveFileName,
} = {}) {
  const archivePath = path.join(packagedResourceDir, archiveFileName);
  const archiveBuffer = await readFile(archivePath);
  const entries = readZipArchiveEntries(archivePath, {
    context: 'Desktop OpenClaw runtime',
  });

  for (const entry of entries) {
    const entryPath = resolveInstallReadyEntryPath(installDir, entry.normalizedPath);
    if (entry.type === 'directory') {
      await mkdir(entryPath, { recursive: true });
      continue;
    }

    await mkdir(path.dirname(entryPath), { recursive: true });
    await writeFile(entryPath, readZipEntryContent(archiveBuffer, entry, archivePath));
  }
}

async function verifyArchiveInstallReadyLayout({
  packagedResourceDir,
  manifest,
  archiveFileName,
} = {}) {
  const installKey = resolveOpenClawInstallKey(manifest);
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'claw-openclaw-install-ready-'));
  const installDir = path.join(tempRoot, 'runtimes', 'openclaw', installKey);

  try {
    await mkdir(installDir, { recursive: true });
    await materializePackagedRuntimeArchiveIntoInstallDir({
      packagedResourceDir,
      installDir,
      archiveFileName,
    });
    await writeFile(
      path.join(installDir, 'manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
      'utf8',
    );
    await verifyMaterializedInstallRoot({
      manifest,
      installDir,
      contextLabel: 'simulated archive-prewarmed OpenClaw install root',
    });
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }

  return buildDesktopInstallReadyLayout({
    manifest,
    mode: 'archive-extract-ready',
  });
}

export async function verifyDesktopOpenClawReleaseAssets({
  workspaceRootDir = rootDir,
  resourceDir = DEFAULT_RESOURCE_DIR,
  target = resolveRequestedOpenClawTarget(),
  runtimeSupplementalPackages = DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES,
  packagedResourceDir = resolvePackagedOpenClawResourceDir(workspaceRootDir, target.platformId),
  packagedInstallRootLayoutDir = resolvePackagedOpenClawInstallRootLayoutDir(
    workspaceRootDir,
    target.platformId,
  ),
  archiveFileName = BUNDLED_RESOURCE_RUNTIME_ARCHIVE_FILENAME,
} = {}) {
  await assertUnsupportedOpenClawRuntimeLayoutMissing(workspaceRootDir);

  const sourceInspection = await inspectPreparedOpenClawRuntime({
    resourceDir,
    runtimeSupplementalPackages,
  });
  if (!sourceInspection.reusable) {
    throw new Error(
      `Prepared OpenClaw source runtime is not reusable (${sourceInspection.reason}) at ${resourceDir}: ${sourceInspection.error ?? sourceInspection.manifestReadError ?? 'unknown error'}`,
    );
  }

  const manifest = sourceInspection.manifest;
  assertManifestMatchesTarget(
    manifest,
    target,
    'prepared OpenClaw source manifest',
  );

  const packagedManifest = await readJsonFile(
    path.join(packagedResourceDir, 'manifest.json'),
    'packaged OpenClaw release manifest',
  );
  assert.deepEqual(
    packagedManifest,
    manifest,
    'packaged OpenClaw release manifest must match the prepared source manifest',
  );

  await ensurePathExists(
    path.join(packagedResourceDir, archiveFileName),
    'packaged OpenClaw runtime archive',
  );
  await ensurePathMissing(
    path.join(packagedResourceDir, 'runtime'),
    'packaged OpenClaw resource root runtime directory',
  );
  await verifyPackagedRuntimeArchive({
    packagedResourceDir,
    manifest,
    archiveFileName,
  });

  let installReadyLayout = null;
  if (target.platformId === 'macos') {
    installReadyLayout = await verifyMacosInstallRootLayout({
      manifest,
      packagedInstallRootLayoutDir,
    });
  } else {
    installReadyLayout = await verifyArchiveInstallReadyLayout({
      packagedResourceDir,
      manifest,
      archiveFileName,
    });
  }

  return {
    manifest,
    resourceDir,
    packagedResourceDir,
    packagedInstallRootLayoutDir: target.platformId === 'macos'
      ? packagedInstallRootLayoutDir
      : null,
    installReadyLayout,
  };
}

export async function main() {
  const target = resolveRequestedOpenClawTarget();
  const result = await verifyDesktopOpenClawReleaseAssets({ target });
  console.log(
    `Verified desktop OpenClaw release assets ${result.manifest.openclawVersion} for ${target.platformId}-${target.archId} at ${result.packagedResourceDir}`,
  );
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
