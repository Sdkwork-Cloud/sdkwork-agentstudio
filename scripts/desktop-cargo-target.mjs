#!/usr/bin/env node

import { createHash } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function normalizePath(value) {
  return path.resolve(String(value ?? '').trim());
}

function buildDesktopTargetScopeId(desktopPackageDir) {
  return createHash('sha1')
    .update(normalizePath(desktopPackageDir).toLowerCase())
    .digest('hex')
    .slice(0, 10);
}

export function resolveDesktopPackageDir(workspaceRootDir = rootDir) {
  return path.join(path.resolve(workspaceRootDir), 'packages', 'sdkwork-agentstudio-pc-desktop');
}

export function resolveDesktopSrcTauriDir({
  workspaceRootDir = rootDir,
  desktopPackageDir = resolveDesktopPackageDir(workspaceRootDir),
} = {}) {
  return path.join(normalizePath(desktopPackageDir), 'src-tauri');
}

export function resolveDefaultDesktopCargoTargetDir({
  workspaceRootDir = rootDir,
  desktopPackageDir = resolveDesktopPackageDir(workspaceRootDir),
  platform = process.platform,
} = {}) {
  const resolvedDesktopPackageDir = normalizePath(desktopPackageDir);

  if (platform !== 'win32') {
    return path.join(resolvedDesktopPackageDir, 'src-tauri', 'target');
  }

  return path.join(
    path.parse(resolvedDesktopPackageDir).root,
    '.sdkwork-claw',
    'cargo-target',
    buildDesktopTargetScopeId(resolvedDesktopPackageDir),
    'desktop',
  );
}

export function resolveDesktopCargoTargetDir({
  workspaceRootDir = rootDir,
  desktopPackageDir = resolveDesktopPackageDir(workspaceRootDir),
  env = process.env,
  platform = process.platform,
  cwd = workspaceRootDir,
} = {}) {
  const configuredTargetDir = String(env?.CARGO_TARGET_DIR ?? '').trim();
  if (configuredTargetDir.length > 0) {
    return path.isAbsolute(configuredTargetDir)
      ? normalizePath(configuredTargetDir)
      : path.resolve(cwd, configuredTargetDir);
  }

  return resolveDefaultDesktopCargoTargetDir({
    workspaceRootDir,
    desktopPackageDir,
    platform,
  });
}

export function buildDesktopCargoTargetEnv(options = {}) {
  const env = {
    ...(options.env ?? process.env),
  };

  env.CARGO_TARGET_DIR = resolveDesktopCargoTargetDir({
    workspaceRootDir: options.workspaceRootDir,
    desktopPackageDir: options.desktopPackageDir,
    env,
    platform: options.platform,
    cwd: options.cwd,
  });
  return env;
}
