#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(import.meta.dirname, '..');

export const UNSUPPORTED_OPENCLAW_SOURCE_RUNTIME_RELATIVE_DIR = path.join(
  'packages',
  'sdkwork-claw-desktop',
  'src-tauri',
  'resources',
  'openclaw-runtime',
);
export const UNSUPPORTED_OPENCLAW_BUNDLED_NODE_RUNTIME_RELATIVE_DIR = path.join(
  'packages',
  'sdkwork-claw-desktop',
  'src-tauri',
  'resources',
  'openclaw',
  'runtime',
  'node',
);

function normalizeVersion(value) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

async function tryReadJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function relativeLabel(workspaceRootDir, absolutePath) {
  return path.relative(workspaceRootDir, absolutePath).replaceAll('\\', '/');
}

export async function inspectUnsupportedOpenClawRuntimeLayout({
  workspaceRootDir = rootDir,
} = {}) {
  const sourceRuntimeDir = path.join(
    workspaceRootDir,
    UNSUPPORTED_OPENCLAW_SOURCE_RUNTIME_RELATIVE_DIR,
  );
  const bundledNodeRuntimeDir = path.join(
    workspaceRootDir,
    UNSUPPORTED_OPENCLAW_BUNDLED_NODE_RUNTIME_RELATIVE_DIR,
  );
  const sourceRuntimeDirPresent = existsSync(sourceRuntimeDir);
  const bundledNodeRuntimeDirPresent = existsSync(bundledNodeRuntimeDir);

  let sourceRuntimeVersion = null;
  if (sourceRuntimeDirPresent) {
    const [manifest, packageJson] = await Promise.all([
      tryReadJson(path.join(sourceRuntimeDir, 'manifest.json')),
      tryReadJson(
        path.join(
          sourceRuntimeDir,
          'runtime',
          'package',
          'node_modules',
          'openclaw',
          'package.json',
        ),
      ),
    ]);
    sourceRuntimeVersion =
      normalizeVersion(manifest?.openclawVersion) ?? normalizeVersion(packageJson?.version);
  }

  const violations = [];
  if (sourceRuntimeDirPresent) {
    violations.push({
      id: 'unsupported-source-runtime-layout',
      path: sourceRuntimeDir,
      relativePath: relativeLabel(workspaceRootDir, sourceRuntimeDir),
      version: sourceRuntimeVersion,
    });
  }
  if (bundledNodeRuntimeDirPresent) {
    violations.push({
      id: 'unsupported-bundled-node-runtime-layout',
      path: bundledNodeRuntimeDir,
      relativePath: relativeLabel(workspaceRootDir, bundledNodeRuntimeDir),
      version: null,
    });
  }

  return {
    workspaceRootDir,
    sourceRuntimeDir,
    sourceRuntimeDirPresent,
    sourceRuntimeVersion,
    bundledNodeRuntimeDir,
    bundledNodeRuntimeDirPresent,
    violations,
  };
}

export function formatUnsupportedOpenClawRuntimeLayoutMessage(inspection) {
  const violations = inspection?.violations ?? [];
  if (violations.length === 0) {
    return null;
  }

  const details = violations.map((violation) => {
    const versionSuffix = violation.version ? ` (detected version ${violation.version})` : '';
    if (violation.id === 'unsupported-source-runtime-layout') {
      return `unsupported source runtime directory ${violation.relativePath}${versionSuffix}`;
    }
    if (violation.id === 'unsupported-bundled-node-runtime-layout') {
      return `unsupported bundled Node runtime directory ${violation.relativePath}`;
    }
    return `${violation.id} at ${violation.relativePath}${versionSuffix}`;
  });

  return `Unsupported OpenClaw runtime layout detected. Remove retired layout artifacts before continuing: ${details.join('; ')}.`;
}

export async function assertNoUnsupportedOpenClawRuntimeLayout({
  workspaceRootDir = rootDir,
} = {}) {
  const inspection = await inspectUnsupportedOpenClawRuntimeLayout({ workspaceRootDir });
  const message = formatUnsupportedOpenClawRuntimeLayoutMessage(inspection);
  if (message) {
    throw new Error(message);
  }
  return inspection;
}

export async function main() {
  await assertNoUnsupportedOpenClawRuntimeLayout();
  console.log('OpenClaw runtime layout conforms to the current external-runtime standard.');
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
