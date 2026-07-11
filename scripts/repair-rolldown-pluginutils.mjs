#!/usr/bin/env node

import { mkdtemp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultWorkspaceRootDir = path.resolve(__dirname, '..');

const JS_REGION_MARKERS = {
  utils: '../pluginutils/dist/utils.js',
  composableFilters: '../pluginutils/dist/filter/composable-filters.js',
  filterVitePlugins: '../pluginutils/dist/filter/filter-vite-plugins.js',
  simpleFilters: '../pluginutils/dist/filter/simple-filters.js',
};

const DTS_REGION_MARKERS = {
  composableFilters: '../pluginutils/dist/filter/composable-filters.d.ts',
  filterVitePlugins: '../pluginutils/dist/filter/filter-vite-plugins.d.ts',
  simpleFilters: '../pluginutils/dist/filter/simple-filters.d.ts',
};

const CRITICAL_RELATIVE_PATHS = [
  'dist/index.js',
  'dist/index.d.ts',
  'dist/filter/index.js',
  'dist/filter/index.d.ts',
  'dist/filter/composable-filters.js',
  'dist/filter/composable-filters.d.ts',
  'dist/filter/filter-vite-plugins.js',
  'dist/filter/filter-vite-plugins.d.ts',
  'dist/filter/simple-filters.js',
  'dist/filter/simple-filters.d.ts',
  'dist/utils.js',
];

const MIT_LICENSE_TEXT = `MIT License

Copyright (c) Rolldown contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

function normalizeVersionValue(value) {
  return String(value ?? '').trim();
}

function compareVersionLike(left, right) {
  return left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

export function parsePluginutilsStoreVersion(storeName) {
  const match = /^@rolldown\+pluginutils@(?<version>.+)$/u.exec(storeName);
  return normalizeVersionValue(match?.groups?.version);
}

export function parseRolldownStoreVersion(storeName) {
  const match = /^rolldown@(?<version>[^_]+)(?:_|$)/u.exec(storeName);
  return normalizeVersionValue(match?.groups?.version);
}

export function selectRolldownTemplateStoreName(rolldownStoreNames, pluginutilsVersion) {
  const exactVersion = normalizeVersionValue(pluginutilsVersion);
  const normalized = Array.isArray(rolldownStoreNames)
    ? rolldownStoreNames
        .map((storeName) => ({
          storeName,
          version: parseRolldownStoreVersion(storeName),
        }))
        .filter((entry) => entry.version)
    : [];

  const exactMatch = normalized.find((entry) => entry.version === exactVersion);
  if (exactMatch) {
    return exactMatch.storeName;
  }

  const sorted = [...normalized].sort((left, right) => compareVersionLike(right.version, left.version));
  return sorted[0]?.storeName ?? null;
}

export function extractRegionBody(sourceText, regionMarker) {
  const startMarker = `//#region ${regionMarker}`;
  const startIndex = sourceText.indexOf(startMarker);
  if (startIndex === -1) {
    throw new Error(`Unable to find region marker ${regionMarker}`);
  }

  const bodyStartIndex = sourceText.indexOf('\n', startIndex);
  if (bodyStartIndex === -1) {
    throw new Error(`Unable to locate region body for ${regionMarker}`);
  }

  const endMarker = '\n//#endregion';
  const endIndex = sourceText.indexOf(endMarker, bodyStartIndex);
  if (endIndex === -1) {
    throw new Error(`Unable to locate end marker for ${regionMarker}`);
  }

  return `${sourceText.slice(bodyStartIndex + 1, endIndex).trimEnd()}\n`;
}

function buildStandaloneComposableFiltersDts(regionText) {
  return regionText
    .replace(/^type FilterExpressionKind /mu, 'export type FilterExpressionKind ')
    .replace(/^type FilterExpression /mu, 'export type FilterExpression ')
    .replace(/^interface QueryFilterObject /mu, 'export interface QueryFilterObject ')
    .replace(/^declare function /gmu, 'export declare function ')
    .concat('export {};\n');
}

function buildStandaloneFunctionDts(regionText) {
  return regionText.replace(/^declare function /gmu, 'export declare function ');
}

export function buildPluginutilsFileMap({
  filterIndexSource,
  filterIndexDtsSource,
  packageJsonText,
  readmeText,
}) {
  const utilsJs = extractRegionBody(filterIndexSource, JS_REGION_MARKERS.utils).concat(
    'export { cleanUrl, extractQueryWithoutFragment };\n',
  );
  const composableFiltersJs = extractRegionBody(
    filterIndexSource,
    JS_REGION_MARKERS.composableFilters,
  ).concat(
    'export { and, code, exclude, exprInterpreter, id, importerId, include, interpreter, interpreterImpl, moduleType, not, or, queries, query };\n',
  );
  const filterVitePluginsJs = extractRegionBody(
    filterIndexSource,
    JS_REGION_MARKERS.filterVitePlugins,
  ).concat('export { filterVitePlugins };\n');
  const simpleFiltersJs = extractRegionBody(
    filterIndexSource,
    JS_REGION_MARKERS.simpleFilters,
  ).concat('export { exactRegex, makeIdFiltersToMatchWithQuery, prefixRegex };\n');

  const composableFiltersDts = buildStandaloneComposableFiltersDts(
    extractRegionBody(filterIndexDtsSource, DTS_REGION_MARKERS.composableFilters),
  );
  const filterVitePluginsDts = buildStandaloneFunctionDts(
    extractRegionBody(filterIndexDtsSource, DTS_REGION_MARKERS.filterVitePlugins),
  );
  const simpleFiltersDts = buildStandaloneFunctionDts(
    extractRegionBody(filterIndexDtsSource, DTS_REGION_MARKERS.simpleFilters),
  );

  return new Map([
    ['package.json', packageJsonText],
    ['README.md', readmeText],
    ['LICENSE', MIT_LICENSE_TEXT],
    ['dist/index.js', 'export * from "./filter/index.js";\n'],
    ['dist/index.d.ts', "export * from './filter/index.ts';\n"],
    [
      'dist/filter/index.js',
      'export * from "./composable-filters.js";\nexport * from "./filter-vite-plugins.js";\nexport * from "./simple-filters.js";\n',
    ],
    [
      'dist/filter/index.d.ts',
      "export * from './composable-filters.ts';\nexport * from './filter-vite-plugins.ts';\nexport * from './simple-filters.ts';\n",
    ],
    ['dist/utils.js', utilsJs],
    ['dist/filter/composable-filters.js', composableFiltersJs],
    ['dist/filter/composable-filters.d.ts', composableFiltersDts],
    ['dist/filter/filter-vite-plugins.js', filterVitePluginsJs],
    ['dist/filter/filter-vite-plugins.d.ts', filterVitePluginsDts],
    ['dist/filter/simple-filters.js', simpleFiltersJs],
    ['dist/filter/simple-filters.d.ts', simpleFiltersDts],
  ]);
}

function resolvePnpmStoreDir(workspaceRootDir) {
  return path.join(workspaceRootDir, 'node_modules', '.pnpm');
}

function resolvePluginutilsPackageRoot(pluginutilsStoreDir) {
  return path.join(pluginutilsStoreDir, 'node_modules', '@rolldown', 'pluginutils');
}

function resolveRolldownDistDir(pnpmStoreDir, rolldownStoreName) {
  return path.join(pnpmStoreDir, rolldownStoreName, 'node_modules', 'rolldown', 'dist');
}

async function listStoreNames(pnpmStoreDir, predicate) {
  const entries = await readdir(pnpmStoreDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && predicate(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => compareVersionLike(left, right));
}

async function readText(filePath) {
  return readFile(filePath, 'utf8');
}

async function readTextOrFallback(filePath, fallbackText) {
  try {
    return await readText(filePath);
  } catch {
    return fallbackText;
  }
}

export async function inspectPluginutilsStoreHealth({
  pluginutilsStoreDir,
  readFileImpl = readText,
} = {}) {
  const packageRoot = resolvePluginutilsPackageRoot(pluginutilsStoreDir);
  const unhealthyFiles = [];

  for (const relativePath of CRITICAL_RELATIVE_PATHS) {
    try {
      await readFileImpl(path.join(packageRoot, relativePath));
    } catch (error) {
      unhealthyFiles.push({
        relativePath,
        code: error && typeof error === 'object' ? error.code ?? 'UNKNOWN' : 'UNKNOWN',
      });
    }
  }

  return {
    pluginutilsStoreDir,
    unhealthyFiles,
  };
}

async function materializeReplacementStoreDir({
  pnpmStoreDir,
  pluginutilsStoreName,
  templateStoreName,
}) {
  const targetStoreDir = path.join(pnpmStoreDir, pluginutilsStoreName);
  const targetPackageRoot = resolvePluginutilsPackageRoot(targetStoreDir);
  const templateDistDir = resolveRolldownDistDir(pnpmStoreDir, templateStoreName);
  const filterIndexSource = await readText(path.join(templateDistDir, 'filter-index.mjs'));
  const filterIndexDtsSource = await readText(path.join(templateDistDir, 'filter-index.d.mts'));
  const packageJsonText = await readText(path.join(targetPackageRoot, 'package.json'));
  const readmeText = await readTextOrFallback(path.join(targetPackageRoot, 'README.md'), '# @rolldown/pluginutils\n');
  const fileMap = buildPluginutilsFileMap({
    filterIndexSource,
    filterIndexDtsSource,
    packageJsonText,
    readmeText,
  });
  const tempRootDir = await mkdtemp(path.join(pnpmStoreDir, '.repair-rolldown-pluginutils-'));
  const replacementStoreDir = path.join(tempRootDir, pluginutilsStoreName);
  const replacementPackageRoot = resolvePluginutilsPackageRoot(replacementStoreDir);

  await mkdir(replacementPackageRoot, { recursive: true });
  for (const [relativePath, content] of fileMap) {
    const absolutePath = path.join(replacementPackageRoot, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content);
  }

  return {
    tempRootDir,
    replacementStoreDir,
  };
}

async function resolveBackupStoreDir(targetStoreDir) {
  let attempt = 0;
  while (true) {
    const suffix = `${Date.now()}${attempt === 0 ? '' : `-${attempt}`}`;
    const candidate = `${targetStoreDir}.bak-${suffix}`;
    try {
      await readdir(candidate);
    } catch (error) {
      if (error && typeof error === 'object' && error.code === 'ENOENT') {
        return candidate;
      }
      throw error;
    }
    attempt += 1;
  }
}

async function replaceStoreDir({ targetStoreDir, replacementStoreDir }) {
  const backupStoreDir = await resolveBackupStoreDir(targetStoreDir);
  await rename(targetStoreDir, backupStoreDir);
  try {
    await rename(replacementStoreDir, targetStoreDir);
  } catch (error) {
    await rename(backupStoreDir, targetStoreDir);
    throw error;
  }
  return backupStoreDir;
}

export async function repairRolldownPluginutils({
  workspaceRootDir = defaultWorkspaceRootDir,
  pnpmStoreDir = resolvePnpmStoreDir(workspaceRootDir),
  logger = console,
} = {}) {
  const pluginutilsStoreNames = await listStoreNames(pnpmStoreDir, (storeName) => {
    return storeName.startsWith('@rolldown+pluginutils@') && !storeName.includes('.bak-');
  });
  const rolldownStoreNames = await listStoreNames(pnpmStoreDir, (storeName) => {
    return /^rolldown@.+$/u.test(storeName);
  });
  const repaired = [];
  const skipped = [];

  for (const pluginutilsStoreName of pluginutilsStoreNames) {
    const pluginutilsStoreDir = path.join(pnpmStoreDir, pluginutilsStoreName);
    const health = await inspectPluginutilsStoreHealth({ pluginutilsStoreDir });
    if (health.unhealthyFiles.length === 0) {
      skipped.push({
        storeName: pluginutilsStoreName,
        reason: 'healthy',
      });
      continue;
    }

    const pluginutilsVersion = parsePluginutilsStoreVersion(pluginutilsStoreName);
    const templateStoreName = selectRolldownTemplateStoreName(
      rolldownStoreNames,
      pluginutilsVersion,
    );

    if (!templateStoreName) {
      throw new Error(
        `Unable to repair ${pluginutilsStoreName}: no rolldown template package exists under ${pnpmStoreDir}`,
      );
    }

    const { tempRootDir, replacementStoreDir } = await materializeReplacementStoreDir({
      pnpmStoreDir,
      pluginutilsStoreName,
      templateStoreName,
    });

    try {
      const backupStoreDir = await replaceStoreDir({
        targetStoreDir: pluginutilsStoreDir,
        replacementStoreDir,
      });
      const postRepairHealth = await inspectPluginutilsStoreHealth({
        pluginutilsStoreDir,
      });
      if (postRepairHealth.unhealthyFiles.length > 0) {
        throw new Error(
          `Repaired ${pluginutilsStoreName} but critical files are still unreadable: ${postRepairHealth.unhealthyFiles
            .map((entry) => entry.relativePath)
            .join(', ')}`,
        );
      }

      repaired.push({
        storeName: pluginutilsStoreName,
        templateStoreName,
        backupStoreDir,
        repairedFiles: CRITICAL_RELATIVE_PATHS,
      });
    } finally {
      await rm(tempRootDir, { recursive: true, force: true });
    }
  }

  if (repaired.length > 0) {
    logger.info?.(
      `[repair-rolldown-pluginutils] repaired ${repaired.length} store package(s): ${repaired
        .map((entry) => `${entry.storeName} <- ${entry.templateStoreName}`)
        .join(', ')}`,
    );
  }

  return {
    pnpmStoreDir,
    repaired,
    skipped,
  };
}

async function runCli() {
  const report = await repairRolldownPluginutils();
  if (report.repaired.length === 0) {
    console.log('[repair-rolldown-pluginutils] no damaged pnpm\u2019s pluginutils packages detected');
    return;
  }

  console.log(
    `[repair-rolldown-pluginutils] repaired ${report.repaired.length} package(s) under ${report.pnpmStoreDir}`,
  );
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  runCli().catch((error) => {
    console.error(`[repair-rolldown-pluginutils] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
