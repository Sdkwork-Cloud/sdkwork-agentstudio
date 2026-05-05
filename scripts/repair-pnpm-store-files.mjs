#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { copyFile, cp, lstat, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultWorkspaceRootDir = path.resolve(__dirname, '..');

function resolvePnpmStoreDir(workspaceRootDir) {
  return path.join(workspaceRootDir, 'node_modules', '.pnpm');
}

export function resolveDefaultGlobalPnpmStoreRoot(env = process.env) {
  const localAppData = typeof env.LOCALAPPDATA === 'string' ? env.LOCALAPPDATA.trim() : '';
  const candidates = [
    localAppData ? path.join(localAppData, 'pnpm', 'store', 'v10') : null,
    localAppData ? path.join(localAppData, 'pnpm', 'store', 'v3') : null,
  ].filter(Boolean);
  return candidates[0] ?? null;
}

function normalizePackageName(name) {
  return String(name ?? '').trim();
}

function parseStorePackageIdentity(storeName) {
  const normalizedStoreName = normalizePackageName(storeName);
  if (!normalizedStoreName || normalizedStoreName === 'node_modules' || normalizedStoreName.includes('.bak-')) {
    return null;
  }

  if (normalizedStoreName.startsWith('@')) {
    const match = /^(@[^+]+)\+([^@]+)@([^_]+)(?:_|$)/u.exec(normalizedStoreName);
    if (!match) {
      return null;
    }
    return {
      packageName: `${normalizePackageName(match[1])}/${normalizePackageName(match[2])}`,
      version: normalizePackageName(match[3]),
    };
  }

  const match = /^([^@]+)@([^_]+)(?:_|$)/u.exec(normalizedStoreName);
  if (!match) {
    return null;
  }

  return {
    packageName: normalizePackageName(match[1]),
    version: normalizePackageName(match[2]),
  };
}

function normalizeRelativePath(candidatePath) {
  const trimmedPath = String(candidatePath ?? '').trim();
  if (!trimmedPath || trimmedPath.startsWith('!')) {
    return null;
  }

  const withoutLeadingDotSlash = trimmedPath.startsWith('./') ? trimmedPath.slice(2) : trimmedPath;
  if (!withoutLeadingDotSlash || withoutLeadingDotSlash.startsWith('../') || path.isAbsolute(withoutLeadingDotSlash)) {
    return null;
  }

  const normalizedPath = withoutLeadingDotSlash.replace(/\\/g, '/');
  return normalizedPath || null;
}

function extractStaticPathPrefix(candidatePath) {
  const normalizedPath = normalizeRelativePath(candidatePath);
  if (!normalizedPath) {
    return null;
  }

  const wildcardMatch = normalizedPath.match(/[*?[\]{}()!+@]/);
  if (!wildcardMatch) {
    return normalizedPath;
  }

  const staticPrefix = normalizedPath.slice(0, wildcardMatch.index).replace(/\/+$/, '');
  return staticPrefix || null;
}

function hasWildcardPattern(candidatePath) {
  return /[*?[\]{}()!+@]/u.test(String(candidatePath ?? ''));
}

function collectKnownCriticalFilePaths(packageJson) {
  if (normalizePackageName(packageJson?.name) === '@tanstack/react-query'
    && normalizePackageName(packageJson?.version) === '5.96.2') {
    return ['build/modern/types.js', 'build/legacy/types.js'];
  }

  return [];
}

function collectRelativePathsFromConfigValue(configValue, configuredFilePaths, configuredPathPrefixes) {
  if (typeof configValue === 'string') {
    const normalizedPath = normalizeRelativePath(configValue);
    if (!normalizedPath) {
      return;
    }

    if (hasWildcardPattern(normalizedPath)) {
      const staticPath = extractStaticPathPrefix(normalizedPath);
      if (staticPath) {
        configuredPathPrefixes.add(staticPath);
      }
      return;
    }

    configuredFilePaths.add(normalizedPath);
    return;
  }

  if (Array.isArray(configValue)) {
    for (const entry of configValue) {
      collectRelativePathsFromConfigValue(entry, configuredFilePaths, configuredPathPrefixes);
    }
    return;
  }

  if (!configValue || typeof configValue !== 'object') {
    return;
  }

  for (const value of Object.values(configValue)) {
    collectRelativePathsFromConfigValue(value, configuredFilePaths, configuredPathPrefixes);
  }
}

function collectConfiguredPathExpectations(packageJson) {
  const configuredFilePaths = new Set();
  const configuredPathPrefixes = new Set();

  if (typeof packageJson.main === 'string' && packageJson.main.trim()) {
    configuredFilePaths.add(packageJson.main.trim());
  }
  if (typeof packageJson.module === 'string' && packageJson.module.trim()) {
    configuredFilePaths.add(packageJson.module.trim());
  }
  if (typeof packageJson.types === 'string' && packageJson.types.trim()) {
    configuredFilePaths.add(packageJson.types.trim());
  }
  if (typeof packageJson.typings === 'string' && packageJson.typings.trim()) {
    configuredFilePaths.add(packageJson.typings.trim());
  }

  const binField = packageJson.bin;
  if (typeof binField === 'string' && binField.trim()) {
    configuredFilePaths.add(binField.trim());
  } else if (binField && typeof binField === 'object') {
    for (const value of Object.values(binField)) {
      if (typeof value === 'string' && value.trim()) {
        configuredFilePaths.add(value.trim());
      }
    }
  }

  if (Array.isArray(packageJson.files)) {
    for (const fileEntry of packageJson.files) {
      const normalizedPath = normalizeRelativePath(fileEntry);
      if (!normalizedPath) {
        continue;
      }

      if (hasWildcardPattern(normalizedPath)) {
        const staticPath = extractStaticPathPrefix(normalizedPath);
        if (staticPath) {
          configuredPathPrefixes.add(staticPath);
        }
        continue;
      }

      if (path.extname(normalizedPath)) {
        configuredFilePaths.add(normalizedPath);
      } else {
        configuredPathPrefixes.add(normalizedPath);
      }
    }
  }

  for (const relativePath of collectKnownCriticalFilePaths(packageJson)) {
    configuredFilePaths.add(relativePath);
  }

  collectRelativePathsFromConfigValue(packageJson.exports, configuredFilePaths, configuredPathPrefixes);
  collectRelativePathsFromConfigValue(packageJson.imports, configuredFilePaths, configuredPathPrefixes);

  return {
    configuredFilePaths,
    configuredPathPrefixes,
  };
}

function resolveKnownSyntheticPackageFiles(damagedPackage) {
  if (damagedPackage.packageName !== 'vite') {
    if (damagedPackage.packageName === '@tanstack/react-query' && damagedPackage.version === '5.96.2') {
      return [
        {
          relativePath: 'build/modern/types.js',
          content: '//# sourceMappingURL=types.js.map\n',
        },
        {
          relativePath: 'build/legacy/types.js',
          content: '//# sourceMappingURL=types.js.map\n',
        },
      ];
    }

    return [];
  }

  const importsField = damagedPackage.packageJson?.imports;
  const moduleSyncCondition =
    importsField && typeof importsField === 'object' ? importsField['#module-sync-enabled'] : null;

  if (!moduleSyncCondition || typeof moduleSyncCondition !== 'object') {
    return [];
  }

  const syntheticEntries = [];
  const moduleSyncPath = normalizeRelativePath(moduleSyncCondition['module-sync']);
  const defaultPath = normalizeRelativePath(moduleSyncCondition.default);

  if (moduleSyncPath === 'misc/true.js') {
    syntheticEntries.push({
      relativePath: moduleSyncPath,
      content: 'export default true\n',
    });
  }

  if (defaultPath === 'misc/false.js') {
    syntheticEntries.push({
      relativePath: defaultPath,
      content: 'export default false\n',
    });
  }

  return syntheticEntries;
}

function isBackupPackageDirName(name) {
  return String(name ?? '').includes('.bak-');
}

async function listPackageRoots(nodeModulesDir) {
  const entries = await readdir(nodeModulesDir, { withFileTypes: true });
  const packageRoots = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || isBackupPackageDirName(entry.name)) {
      continue;
    }
    if (entry.name.startsWith('@')) {
      const scopeDir = path.join(nodeModulesDir, entry.name);
      const scopedEntries = await readdir(scopeDir, { withFileTypes: true });
      for (const scopedEntry of scopedEntries) {
        if (scopedEntry.isDirectory() && !isBackupPackageDirName(scopedEntry.name)) {
          packageRoots.push(path.join(scopeDir, scopedEntry.name));
        }
      }
      continue;
    }
    packageRoots.push(path.join(nodeModulesDir, entry.name));
  }

  return packageRoots;
}

async function hasMissingConfiguredFile(packageRoot, packageJson) {
  const { configuredFilePaths, configuredPathPrefixes } = collectConfiguredPathExpectations(packageJson);

  for (const relativePath of configuredFilePaths) {
    const targetPath = path.join(packageRoot, relativePath);
    try {
      const stats = await lstat(targetPath);
      if (!stats.isFile()) {
        return true;
      }
      await readFile(targetPath);
    } catch (error) {
      if (error && typeof error === 'object' && ['ENOENT', 'EPERM', 'EACCES', 'EISDIR'].includes(error.code)) {
        return true;
      }
      throw error;
    }
  }

  for (const relativePath of configuredPathPrefixes) {
    if (!existsSync(path.join(packageRoot, relativePath))) {
      return true;
    }
  }

  return false;
}

async function restoreMetadataFiles({
  packageRoot,
  metadata,
  globalStoreRootDir,
  replacePackageRoot = false,
}) {
  if (!metadata?.files || typeof metadata.files !== 'object') {
    return [];
  }

  const metadataEntries = Object.entries(metadata.files);
  const missingEntries = [];

  if (!replacePackageRoot) {
    for (const [relativePath, fileMetadata] of metadataEntries) {
      const targetPath = path.join(packageRoot, relativePath);
      try {
        await readFile(targetPath);
      } catch (error) {
        if (!(error && typeof error === 'object')) {
          continue;
        }
        if (error.code === 'ENOENT') {
          missingEntries.push([relativePath, fileMetadata]);
          continue;
        }
        if (['EPERM', 'EACCES', 'EISDIR'].includes(error.code)) {
          replacePackageRoot = true;
          break;
        }
      }
    }
  }

  if (replacePackageRoot) {
    if (existsSync(packageRoot)) {
      let backupPackageRoot = `${packageRoot}.bak-${Date.now()}`;
      let attempt = 0;
      while (existsSync(backupPackageRoot)) {
        attempt += 1;
        backupPackageRoot = `${packageRoot}.bak-${Date.now()}-${attempt}`;
      }
      try {
        await rename(packageRoot, backupPackageRoot);
      } catch (error) {
        if (!(error && typeof error === 'object' && error.code === 'ENOENT')) {
          await rm(packageRoot, { recursive: true, force: true });
        }
      }
    }
  } else if (missingEntries.length === 0) {
    return [];
  }

  const restored = [];
  const entriesToRestore = replacePackageRoot ? metadataEntries : missingEntries;

  for (const [relativePath, fileMetadata] of entriesToRestore) {
    const targetPath = path.join(packageRoot, relativePath);
    const sourcePath = resolveStoreFilePath(globalStoreRootDir, fileMetadata.integrity);
    await mkdir(path.dirname(targetPath), { recursive: true });
    if (!replacePackageRoot) {
      await clearTargetPath(targetPath);
    }
    await copyFile(sourcePath, targetPath);
    restored.push({
      relativePath,
      targetPath,
    });
  }

  return restored;
}

async function clearTargetPath(targetPath) {
  try {
    await rm(targetPath, { recursive: true, force: true });
    return;
  } catch (error) {
    if (!(error && typeof error === 'object' && ['EPERM', 'EACCES'].includes(error.code))) {
      throw error;
    }
  }

  if (!existsSync(targetPath)) {
    return;
  }

  let backupTargetPath = `${targetPath}.bak-${Date.now()}`;
  let attempt = 0;
  while (existsSync(backupTargetPath)) {
    attempt += 1;
    backupTargetPath = `${targetPath}.bak-${Date.now()}-${attempt}`;
  }

  await rename(targetPath, backupTargetPath);
}

async function replacePackageRootWithSyntheticEntries(damagedPackage, syntheticEntries) {
  const packageRoot = damagedPackage.packageRoot;
  let backupPackageRoot = `${packageRoot}.bak-${Date.now()}`;
  let attempt = 0;
  while (existsSync(backupPackageRoot)) {
    attempt += 1;
    backupPackageRoot = `${packageRoot}.bak-${Date.now()}-${attempt}`;
  }

  await rename(packageRoot, backupPackageRoot);
  const syntheticRelativePaths = new Set(syntheticEntries.map((entry) => entry.relativePath.replace(/\\/g, '/')));

  await cp(backupPackageRoot, packageRoot, {
    recursive: true,
    filter: (sourcePath) => {
      const relativePath = path.relative(backupPackageRoot, sourcePath).replace(/\\/g, '/');
      if (!relativePath) {
        return true;
      }
      for (const syntheticRelativePath of syntheticRelativePaths) {
        if (relativePath === syntheticRelativePath || relativePath.startsWith(`${syntheticRelativePath}/`)) {
          return false;
        }
      }
      return true;
    },
  });

  const restored = [];
  for (const syntheticEntry of syntheticEntries) {
    const targetPath = path.join(packageRoot, syntheticEntry.relativePath);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, syntheticEntry.content, 'utf8');
    restored.push({
      relativePath: syntheticEntry.relativePath,
      targetPath,
    });
  }

  return restored;
}

async function collectDamagedPackages(pnpmStoreDir) {
  const storeEntries = await readdir(pnpmStoreDir, { withFileTypes: true });
  const damagedPackages = [];

  for (const entry of storeEntries) {
    if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name.includes('.bak-')) {
      continue;
    }

    const nodeModulesDir = path.join(pnpmStoreDir, entry.name, 'node_modules');
    try {
      const packageRoots = await listPackageRoots(nodeModulesDir);
      for (const packageRoot of packageRoots) {
        try {
          const packageJson = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'));
          if (!(await hasMissingConfiguredFile(packageRoot, packageJson))) {
            continue;
          }
          damagedPackages.push({
            storeName: entry.name,
            packageName: normalizePackageName(packageJson.name),
            version: normalizePackageName(packageJson.version),
            packageRoot,
            packageJson,
            repairMode: 'restore_missing_files',
          });
        } catch (error) {
          if (!(error && typeof error === 'object' && ['ENOENT', 'EPERM', 'EACCES'].includes(error.code))) {
            throw error;
          }

          const parsedIdentity = parseStorePackageIdentity(entry.name);
          if (!parsedIdentity) {
            continue;
          }

          damagedPackages.push({
            storeName: entry.name,
            packageName: parsedIdentity.packageName,
            version: parsedIdentity.version,
            packageRoot,
            packageJson: null,
            repairMode: 'replace_package_root',
          });
        }
      }
    } catch (error) {
      if (!(error && typeof error === 'object' && error.code === 'ENOENT')) {
        throw error;
      }
    }
  }

  return damagedPackages;
}

async function collectMetadataDamagedPackages({
  pnpmStoreDir,
  globalStoreRootDir,
  existingDamagedPackages = [],
}) {
  const knownDamageKeys = new Set(
    existingDamagedPackages.map((entry) => `${entry.packageName}@${entry.version}:${entry.packageRoot}`),
  );
  const packageEntries = [];
  const storeEntries = await readdir(pnpmStoreDir, { withFileTypes: true });

  for (const entry of storeEntries) {
    if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name.includes('.bak-')) {
      continue;
    }

    const nodeModulesDir = path.join(pnpmStoreDir, entry.name, 'node_modules');
    try {
      const packageRoots = await listPackageRoots(nodeModulesDir);
      for (const packageRoot of packageRoots) {
        try {
          const packageJson = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'));
          const packageEntry = {
            storeName: entry.name,
            packageName: normalizePackageName(packageJson.name),
            version: normalizePackageName(packageJson.version),
            packageRoot,
            packageJson,
          };
          if (!knownDamageKeys.has(`${packageEntry.packageName}@${packageEntry.version}:${packageRoot}`)) {
            packageEntries.push(packageEntry);
          }
        } catch (error) {
          if (!(error && typeof error === 'object' && ['ENOENT', 'EPERM', 'EACCES'].includes(error.code))) {
            throw error;
          }
        }
      }
    } catch (error) {
      if (!(error && typeof error === 'object' && error.code === 'ENOENT')) {
        throw error;
      }
    }
  }

  if (packageEntries.length === 0) {
    return [];
  }

  const metadataEntries = await findMetadataEntries(globalStoreRootDir, packageEntries);
  const damagedPackages = [];

  for (const packageEntry of packageEntries) {
    const metadata = metadataEntries.get(`${packageEntry.packageName}@${packageEntry.version}`);
    if (!metadata?.files || typeof metadata.files !== 'object') {
      continue;
    }

    let hasUnreadableMetadataFile = false;
    for (const relativePath of Object.keys(metadata.files)) {
      const targetPath = path.join(packageEntry.packageRoot, relativePath);
      try {
        const stats = await lstat(targetPath);
        if (!stats.isFile()) {
          hasUnreadableMetadataFile = true;
          break;
        }
        await readFile(targetPath);
      } catch (error) {
        if (error && typeof error === 'object' && ['ENOENT', 'EPERM', 'EACCES', 'EISDIR'].includes(error.code)) {
          hasUnreadableMetadataFile = true;
          break;
        }
        throw error;
      }
    }

    if (!hasUnreadableMetadataFile) {
      continue;
    }

    damagedPackages.push({
      ...packageEntry,
      repairMode: 'replace_package_root',
    });
  }

  return damagedPackages;
}

async function findMetadataEntries(globalStoreRootDir, damagedPackages) {
  const remaining = new Set(damagedPackages.map((entry) => `${entry.packageName}@${entry.version}`));
  const metadataEntries = new Map();
  const indexRootDir = path.join(globalStoreRootDir, 'index');

  async function walkIndexDir(directoryPath) {
    if (remaining.size === 0) {
      return;
    }
    const entries = await readdir(directoryPath, { withFileTypes: true });
    for (const entry of entries) {
      if (remaining.size === 0) {
        return;
      }
      const absolutePath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        await walkIndexDir(absolutePath);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.json')) {
        continue;
      }
      try {
        const metadata = JSON.parse(await readFile(absolutePath, 'utf8'));
        const key = `${normalizePackageName(metadata.name)}@${normalizePackageName(metadata.version)}`;
        if (remaining.has(key)) {
          metadataEntries.set(key, metadata);
          remaining.delete(key);
        }
      } catch {
        continue;
      }
    }
  }

  try {
    await walkIndexDir(indexRootDir);
  } catch (error) {
    if (!(error && typeof error === 'object' && error.code === 'ENOENT')) {
      throw error;
    }
  }

  return metadataEntries;
}

export function resolveStoreFilePath(globalStoreRootDir, integrity) {
  const normalizedIntegrity = String(integrity ?? '').trim();
  const [, base64Hash = ''] = normalizedIntegrity.split('-', 2);
  const hexDigest = Buffer.from(base64Hash, 'base64').toString('hex');
  return path.join(globalStoreRootDir, 'files', hexDigest.slice(0, 2), hexDigest.slice(2));
}

export async function repairPnpmStoreFiles({
  workspaceRootDir = defaultWorkspaceRootDir,
  pnpmStoreDir = resolvePnpmStoreDir(workspaceRootDir),
  globalStoreRootDir = resolveDefaultGlobalPnpmStoreRoot(),
  logger = console,
} = {}) {
  if (!globalStoreRootDir) {
    return {
      damagedPackages: [],
      restored: [],
      skipped: [],
    };
  }

  const initialDamagedPackages = await collectDamagedPackages(pnpmStoreDir);
  const metadataDamagedPackages = await collectMetadataDamagedPackages({
    pnpmStoreDir,
    globalStoreRootDir,
    existingDamagedPackages: initialDamagedPackages,
  });
  const damagedPackages = [...initialDamagedPackages, ...metadataDamagedPackages];

  if (damagedPackages.length === 0) {
    return {
      damagedPackages,
      restored: [],
      skipped: [],
    };
  }

  const metadataEntries = await findMetadataEntries(globalStoreRootDir, damagedPackages);
  const restored = [];
  const skipped = [];

  for (const damagedPackage of damagedPackages) {
    const metadata = metadataEntries.get(`${damagedPackage.packageName}@${damagedPackage.version}`);
    const hasMetadataFiles = Boolean(metadata && metadata.files && typeof metadata.files === 'object');

    if (hasMetadataFiles) {
      try {
        const restoredFiles = await restoreMetadataFiles({
          packageRoot: damagedPackage.packageRoot,
          metadata,
          globalStoreRootDir,
          replacePackageRoot: damagedPackage.repairMode === 'replace_package_root',
        });
        for (const restoredFile of restoredFiles) {
          restored.push({
            packageName: damagedPackage.packageName,
            version: damagedPackage.version,
            relativePath: restoredFile.relativePath,
            targetPath: restoredFile.targetPath,
          });
        }
      } catch (error) {
        if (!(error && typeof error === 'object' && error.code === 'ENOENT')) {
          throw error;
        }
      }
    }

    const syntheticEntries = resolveKnownSyntheticPackageFiles(damagedPackage);
    if (
      syntheticEntries.length > 0
      && damagedPackage.packageName === '@tanstack/react-query'
      && damagedPackage.version === '5.96.2'
    ) {
      const restoredSyntheticFiles = await replacePackageRootWithSyntheticEntries(
        damagedPackage,
        syntheticEntries,
      );
      for (const restoredFile of restoredSyntheticFiles) {
        restored.push({
          packageName: damagedPackage.packageName,
          version: damagedPackage.version,
          relativePath: restoredFile.relativePath,
          targetPath: restoredFile.targetPath,
        });
      }
      continue;
    }

    for (const syntheticEntry of syntheticEntries) {
      const targetPath = path.join(damagedPackage.packageRoot, syntheticEntry.relativePath);
      try {
        await readFile(targetPath);
        continue;
      } catch (error) {
        if (!(error && typeof error === 'object' && ['ENOENT', 'EPERM', 'EACCES', 'EISDIR'].includes(error.code))) {
          continue;
        }
      }

      await mkdir(path.dirname(targetPath), { recursive: true });
      await clearTargetPath(targetPath);
      await writeFile(targetPath, syntheticEntry.content, 'utf8');
      restored.push({
        packageName: damagedPackage.packageName,
        version: damagedPackage.version,
        relativePath: syntheticEntry.relativePath,
        targetPath,
      });
    }

    if (!hasMetadataFiles && syntheticEntries.length === 0) {
      skipped.push(damagedPackage);
    }
  }

  if (restored.length > 0) {
    logger.info?.(
      `[repair-pnpm-store-files] restored ${restored.length} missing file(s) from ${globalStoreRootDir}`,
    );
  }

  return {
    damagedPackages,
    restored,
    skipped,
  };
}

async function runCli() {
  const report = await repairPnpmStoreFiles();
  if (report.restored.length === 0) {
    console.log('[repair-pnpm-store-files] no missing package files restored');
    return;
  }

  console.log(
    `[repair-pnpm-store-files] restored ${report.restored.length} missing file(s) from the local pnpm store`,
  );
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  runCli().catch((error) => {
    console.error(`[repair-pnpm-store-files] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
