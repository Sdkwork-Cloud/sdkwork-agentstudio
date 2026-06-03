import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptFilePath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptFilePath);
const repositoryRootDir = path.resolve(scriptDir, '..');

export const WEB_PERFORMANCE_BUDGETS = {
  appEntryScript: {
    label: 'app entry script chunk',
    pattern: /^index-.*\.js$/,
    maxBytes: 325 * 1024,
  },
  appEntryStylesheet: {
    label: 'app entry stylesheet chunk',
    pattern: /^index-.*\.css$/,
    maxBytes: 310 * 1024,
  },
  communityEditor: {
    label: 'community editor chunk',
    pattern: /^community-editor-.*\.js$/,
    maxBytes: 375 * 1024,
  },
  instanceStore: {
    label: 'instance store chunk',
    pattern: /^useInstanceStore-.*\.js$/,
    maxBytes: 260 * 1024,
  },
  newPostRouteShell: {
    label: 'NewPost route shell chunk',
    pattern: /^NewPost-.*\.js$/,
    maxBytes: 8 * 1024,
  },
  instanceDetail: {
    label: 'InstanceDetail route chunk',
    pattern: /^InstanceDetail-.*\.js$/,
    maxBytes: 225 * 1024,
  },
  instanceConfigWorkbenchPanel: {
    label: 'InstanceConfigWorkbenchPanel chunk',
    pattern: /^InstanceConfigWorkbenchPanel-.*\.js$/,
    maxBytes: 80 * 1024,
  },
  instanceDetailFilesSection: {
    label: 'InstanceDetailFilesSection chunk',
    pattern: /^InstanceDetailFilesSection-.*\.js$/,
    maxBytes: 10 * 1024,
  },
  markdownRuntime: {
    label: 'markdown-runtime chunk',
    pattern: /^markdown-runtime-.*\.js$/,
    maxBytes: 225 * 1024,
  },
  clawI18nRuntime: {
    label: 'claw-i18n runtime chunk',
    pattern: /^claw-i18n-runtime-.*\.js$/,
    maxBytes: 70 * 1024,
  },
  clawI18nEnglish: {
    label: 'claw-i18n English bundle chunk',
    pattern: /^claw-i18n-en-.*\.js$/,
    maxBytes: 245 * 1024,
  },
  clawI18nChinese: {
    label: 'claw-i18n Chinese bundle chunk',
    pattern: /^claw-i18n-zh-.*\.js$/,
    maxBytes: 235 * 1024,
  },
};

export const WEB_ASSET_GLOBAL_BUDGETS = {
  maxJavaScriptAssetBytes: 400 * 1024,
  maxStylesheetAssetBytes: 325 * 1024,
};

export function resolveWebDistAssetsDir(rootDir = repositoryRootDir) {
  return path.join(rootDir, 'packages', 'sdkwork-claw-web', 'dist', 'assets');
}

function formatKiB(bytes) {
  return `${(bytes / 1024).toFixed(2)} KiB`;
}

function listDistAssets(distAssetsDir) {
  if (!fs.existsSync(distAssetsDir)) {
    throw new Error(
      `Missing build output: ${path.relative(process.cwd(), distAssetsDir) || distAssetsDir}`,
    );
  }

  return fs
    .readdirSync(distAssetsDir)
    .filter((entry) => fs.statSync(path.join(distAssetsDir, entry)).isFile());
}

function findSingleAsset(entries, { label, pattern }) {
  const matches = entries.filter((entry) => pattern.test(entry));
  if (matches.length !== 1) {
    throw new Error(
      `${label} budget requires exactly one built asset, found ${matches.length}: ${matches.join(', ') || '(none)'}`,
    );
  }
  return matches[0];
}

export function assertWebPerformanceBudget(distAssetsDir = resolveWebDistAssetsDir()) {
  const entries = listDistAssets(distAssetsDir);
  const report = [];

  for (const entry of entries) {
    const assetPath = path.join(distAssetsDir, entry);
    const size = fs.statSync(assetPath).size;
    if (entry.endsWith('.js') && size > WEB_ASSET_GLOBAL_BUDGETS.maxJavaScriptAssetBytes) {
      throw new Error(
        `Web JavaScript asset exceeded the global budget: ${entry} is ${formatKiB(size)} (limit ${formatKiB(WEB_ASSET_GLOBAL_BUDGETS.maxJavaScriptAssetBytes)})`,
      );
    }
    if (entry.endsWith('.css') && size > WEB_ASSET_GLOBAL_BUDGETS.maxStylesheetAssetBytes) {
      throw new Error(
        `Web stylesheet asset exceeded the global budget: ${entry} is ${formatKiB(size)} (limit ${formatKiB(WEB_ASSET_GLOBAL_BUDGETS.maxStylesheetAssetBytes)})`,
      );
    }
  }

  for (const budget of Object.values(WEB_PERFORMANCE_BUDGETS)) {
    const assetName = findSingleAsset(entries, budget);
    const assetPath = path.join(distAssetsDir, assetName);
    const size = fs.statSync(assetPath).size;
    if (size > budget.maxBytes) {
      throw new Error(
        `${budget.label} exceeded the frozen budget: ${assetName} is ${formatKiB(size)} (limit ${formatKiB(budget.maxBytes)})`,
      );
    }
    report.push({ label: budget.label, assetName, size, maxBytes: budget.maxBytes });
  }

  return report;
}

export function formatWebPerformanceBudgetReport(report) {
  return report
    .map(
      ({ label, assetName, size, maxBytes }) =>
        `- ${label}: ${assetName} ${formatKiB(size)} / ${formatKiB(maxBytes)}`,
    )
    .join('\n');
}

export function main() {
  const report = assertWebPerformanceBudget();
  console.log(
    `Web performance budget check passed for ${report.length} frozen assets:\n${formatWebPerformanceBudgetReport(report)}`,
  );
}

const isDirectExecution =
  typeof process.argv[1] === 'string' &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirectExecution) {
  try {
    main();
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : `Web performance budget check failed: ${String(error)}`,
    );
    process.exit(1);
  }
}
