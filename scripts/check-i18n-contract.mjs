import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const rootDir = process.cwd();
const packagesDir = path.join(rootDir, 'packages');

const localeSourceDir = path.join(packagesDir, 'sdkwork-clawstudio-i18n', 'src', 'locales');
const duplicateLocaleDir = path.join(
  packagesDir,
  'sdkwork-clawstudio-infrastructure',
  'src',
  'i18n',
  'locales',
);
const appStorePath = path.join(
  packagesDir,
  'sdkwork-clawstudio-core',
  'src',
  'stores',
  'useAppStore.ts',
);
const settingsPath = path.join(
  packagesDir,
  'sdkwork-clawstudio-settings',
  'src',
  'GeneralSettings.tsx',
);
const i18nIndexPath = path.join(packagesDir, 'sdkwork-clawstudio-i18n', 'src', 'index.ts');
const appProvidersPath = path.join(
  packagesDir,
  'sdkwork-clawstudio-shell',
  'src',
  'application',
  'providers',
  'AppProviders.tsx',
);
const webServerPathCandidates = [
  path.join(packagesDir, 'sdkwork-clawstudio-web', 'server.ts'),
  path.join(rootDir, 'server.ts'),
];

const uiStringAttributes = new Set(['placeholder', 'title', 'alt', 'aria-label']);
const ignoredUiTags = new Set(['code', 'pre', 'kbd']);
let failures = [];

function fail(message) {
  failures.push(message);
}

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function normalizePath(filePath) {
  return path.relative(rootDir, filePath).replaceAll('\\', '/');
}

function listFiles(dirPath, predicate) {
  const output = [];

  if (!fs.existsSync(dirPath)) {
    return output;
  }

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      output.push(...listFiles(entryPath, predicate));
      continue;
    }

    if (predicate(entryPath)) {
      output.push(entryPath);
    }
  }

  return output;
}

function getJsxTagName(node) {
  const nameNode = node?.openingElement?.tagName ?? node?.tagName ?? node?.parent?.tagName;
  if (!nameNode) {
    return null;
  }

  if (ts.isIdentifier(nameNode)) {
    return nameNode.text;
  }

  if (ts.isPropertyAccessExpression(nameNode)) {
    return nameNode.name.text;
  }

  return null;
}

function isIgnoredTextNode(node) {
  let current = node.parent;
  while (current) {
    if (ts.isJsxElement(current) || ts.isJsxSelfClosingElement(current)) {
      const tagName = getJsxTagName(current);
      if (tagName && ignoredUiTags.has(tagName)) {
        return true;
      }
    }

    current = current.parent;
  }

  return false;
}

function collectStaticUiText(filePath) {
  const sourceText = readFile(filePath);
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const findings = [];

  function visit(node) {
    if (ts.isJsxText(node)) {
      const text = node.getText(sourceFile).replace(/\s+/g, ' ').trim();
      if (text && /[\p{Script=Han}A-Za-z]/u.test(text) && !isIgnoredTextNode(node)) {
        findings.push(`static JSX text "${text}"`);
      }
    }

    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && node.initializer) {
      if (uiStringAttributes.has(node.name.text) && ts.isStringLiteral(node.initializer)) {
        const text = node.initializer.text.trim();
        if (text && /[\p{Script=Han}A-Za-z]/u.test(text)) {
          findings.push(`${node.name.text}="${text}"`);
        }
      }
    }

    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'toast' &&
      node.arguments.length > 0 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      findings.push(`toast message "${node.arguments[0].text}"`);
    }

    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'confirm' &&
      node.arguments.length > 0 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      findings.push(`confirm message "${node.arguments[0].text}"`);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return findings;
}

function checkLocaleOwnership() {
  const localeFiles = listFiles(localeSourceDir, (filePath) => filePath.endsWith('.json'));
  if (localeFiles.length === 0) {
    fail('packages/sdkwork-clawstudio-i18n/src/locales must exist and own locale resources.');
  }

  const duplicateLocaleFiles = listFiles(duplicateLocaleDir, (filePath) => filePath.endsWith('.json'));
  if (duplicateLocaleFiles.length > 0) {
    fail('packages/sdkwork-clawstudio-infrastructure/src/i18n/locales must not exist; locale JSON must have a single owner.');
  }
}

function checkSupportedLocales() {
  const appStoreSource = readFile(appStorePath);
  if (appStoreSource.includes("'ja'")) {
    fail('packages/sdkwork-clawstudio-core/src/stores/useAppStore.ts still exposes unsupported language "ja".');
  }

  const settingsSource = readFile(settingsPath);
  if (/value="ja"/.test(settingsSource)) {
    fail('packages/sdkwork-clawstudio-settings/src/GeneralSettings.tsx still exposes a Japanese language option.');
  }
}

function checkRequestAwareRuntime() {
  const webServerPath = webServerPathCandidates.find((candidate) => fs.existsSync(candidate));

  if (webServerPath) {
    const serverSource = readFile(webServerPath);
    if (!/Accept-Language/i.test(serverSource)) {
      fail(`${normalizePath(webServerPath)} must parse Accept-Language.`);
    }
    if (!/Content-Language/i.test(serverSource)) {
      fail(`${normalizePath(webServerPath)} must set Content-Language.`);
    }
  } else {
    const providersSource = readFile(appProvidersPath);
    if (!/ensureI18n/.test(providersSource)) {
      fail(
        'packages/sdkwork-clawstudio-shell/src/application/providers/AppProviders.tsx must bootstrap ensureI18n when no request-aware server runtime exists.',
      );
    }
  }

  const i18nSource = readFile(i18nIndexPath);
  if (!/cookie/i.test(i18nSource)) {
    fail('packages/sdkwork-clawstudio-i18n/src/index.ts must configure cookie-based language detection.');
  }
  if (!/supportedLngs/i.test(i18nSource)) {
    fail('packages/sdkwork-clawstudio-i18n/src/index.ts must declare supportedLngs.');
  }
}

function checkChineseOutsideLocales() {
  const sourceFiles = listFiles(packagesDir, (filePath) => {
    const normalized = filePath.replaceAll('/', '\\');
    return (
      !normalized.includes('\\node_modules\\') &&
      /\\.*\.(ts|tsx|js|jsx|mjs)$/.test(normalized) &&
      !normalized.includes('\\dist\\') &&
      !normalized.includes('\\target\\') &&
      !normalized.includes('.test.') &&
      !normalized.includes('\\sdkwork-clawstudio-i18n\\src\\locales\\') &&
      !normalized.includes('\\sdkwork-clawstudio-infrastructure\\src\\i18n\\locales\\')
    );
  });

  for (const filePath of sourceFiles) {
    const source = readFile(filePath);
    if (/[\p{Script=Han}\uFFFD]/u.test(source)) {
      fail(`${normalizePath(filePath)} contains Chinese source text outside locale resources.`);
    }
  }
}

function flattenLocaleEntries(value, prefix = '') {
  if (typeof value === 'string') {
    return [[prefix, value]];
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }

  return Object.entries(value).flatMap(([key, nestedValue]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    return flattenLocaleEntries(nestedValue, nextPrefix);
  });
}

function checkCorruptedLocaleValues() {
  const zhLocalePath = path.join(localeSourceDir, 'zh.json');
  const zhLocale = JSON.parse(readFile(zhLocalePath));
  const corruptedEntries = flattenLocaleEntries(zhLocale)
    .filter(([, value]) => /\?{2,}|^\?/.test(value))
    .map(([key]) => key);

  if (corruptedEntries.length > 0) {
    fail(
      `packages/sdkwork-clawstudio-i18n/src/locales/zh.json contains corrupted placeholder values: ${corruptedEntries
        .slice(0, 10)
        .join(', ')}`,
    );
  }

  const anchorEntries = [
    ['common.back', zhLocale.common?.back],
    ['sidebar.instances', zhLocale.sidebar?.instances],
    ['dashboard.page.title', zhLocale.dashboard?.page?.title],
  ];

  const missingChineseAnchors = anchorEntries
    .filter(([, value]) => typeof value !== 'string' || !/[\p{Script=Han}]/u.test(value))
    .map(([key]) => key);

  if (missingChineseAnchors.length > 0) {
    fail(
      `packages/sdkwork-clawstudio-i18n/src/locales/zh.json contains mojibake or missing Chinese copy in: ${missingChineseAnchors.join(
        ', ',
      )}`,
    );
  }
}

function checkComponentPageLocaleBoundary() {
  const uiFiles = listFiles(packagesDir, (filePath) => {
    const normalized = filePath.replaceAll('/', '\\');
    return (
      filePath.endsWith('.tsx') &&
      normalized.includes('\\src\\') &&
      /\\(components|pages)\\/.test(normalized) &&
      !normalized.includes('\\node_modules\\') &&
      !normalized.includes('\\dist\\') &&
      !normalized.includes('\\target\\') &&
      !normalized.includes('.test.')
    );
  });

  for (const filePath of uiFiles) {
    const source = readFile(filePath);

    if (/\buseLocalizedText\b/.test(source)) {
      fail(
        `${normalizePath(filePath)} must not use useLocalizedText in page/component UI; move copy into locale resources and use t(...).`,
      );
    }
  }
}

function checkStaticUiCopy() {
  const sourceTsxFiles = listFiles(packagesDir, (filePath) => {
    const normalized = filePath.replaceAll('/', '\\');
    return (
      filePath.endsWith('.tsx') &&
      !normalized.includes('\\node_modules\\') &&
      !normalized.includes('\\dist\\') &&
      !normalized.includes('\\target\\') &&
      !normalized.includes('.test.') &&
      normalized.includes('\\src\\')
    );
  });

  for (const filePath of sourceTsxFiles) {
    const findings = collectStaticUiText(filePath);
    if (findings.length > 0) {
      fail(`${normalizePath(filePath)} has untranslated UI copy: ${findings.slice(0, 3).join(', ')}`);
    }
  }
}

function checkInstanceConfigWorkbenchTranslationKeys() {
  const targetFiles = [
    path.join(
      packagesDir,
      'sdkwork-clawstudio-instances',
      'src',
      'components',
      'InstanceConfigWorkbenchPanel.tsx',
    ),
    path.join(
      packagesDir,
      'sdkwork-clawstudio-instances',
      'src',
      'components',
      'InstanceConfigWorkbenchToolbar.tsx',
    ),
    path.join(
      packagesDir,
      'sdkwork-clawstudio-instances',
      'src',
      'components',
      'InstanceConfigWorkbenchOverview.tsx',
    ),
    path.join(
      packagesDir,
      'sdkwork-clawstudio-instances',
      'src',
      'components',
      'InstanceConfigWorkbenchRawPanel.tsx',
    ),
    path.join(
      packagesDir,
      'sdkwork-clawstudio-instances',
      'src',
      'components',
      'InstanceConfigWorkbenchSectionHero.tsx',
    ),
    path.join(
      packagesDir,
      'sdkwork-clawstudio-instances',
      'src',
      'components',
      'InstanceConfigWorkbenchConfigNavigation.tsx',
    ),
    path.join(
      packagesDir,
      'sdkwork-clawstudio-instances',
      'src',
      'components',
      'InstanceConfigWorkbenchDiffPanel.tsx',
    ),
  ];

  for (const filePath of targetFiles) {
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const source = readFile(filePath);
    if (/\b(?:tr|props\.tr|props\.t|params\.t)\(\s*''\s*,/u.test(source)) {
      fail(
        `${normalizePath(filePath)} must not use empty translation keys in the instance config workbench; move copy into locale resources and reference a stable key.`,
      );
    }
  }
}

checkLocaleOwnership();
checkSupportedLocales();
checkRequestAwareRuntime();
checkChineseOutsideLocales();
checkCorruptedLocaleValues();
checkComponentPageLocaleBoundary();
checkStaticUiCopy();
checkInstanceConfigWorkbenchTranslationKeys();

if (failures.length > 0) {
  console.error('i18n contract failed:\n');
  for (const message of failures) {
    console.error(`- ${message}`);
  }
  process.exit(1);
}

console.log('i18n contract passed');
