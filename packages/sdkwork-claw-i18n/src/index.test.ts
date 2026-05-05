import assert from 'node:assert/strict';
import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import en from './locales/en/index.ts';
import zh from './locales/zh/index.ts';
import {
  APP_STORE_STORAGE_KEY,
  DEFAULT_LANGUAGE,
  LANGUAGE_LABELS,
  I18N_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
  detectBrowserLanguage,
  detectRequestLanguage,
  ensureI18n,
  formatCurrency,
  formatDate,
  formatNumber,
  formatRelativeTime,
  formatTime,
  getAppStoreLanguageFromSnapshot,
  hasDedicatedTranslationBundle,
  localizeValue,
  localizedText,
  normalizeLanguage,
  resolveTranslationBundleSourceLanguage,
  resolveLocalizedText,
  translationResources,
} from './index.ts';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(currentDirectory, '../../..');
const packagesRoot = join(workspaceRoot, 'packages');
const approvedLocaleDirectory = join(packagesRoot, 'sdkwork-claw-i18n', 'src', 'locales');
const legacyEnglishLocalePath = join(approvedLocaleDirectory, 'en.json');
const legacyChineseLocalePath = join(approvedLocaleDirectory, 'zh.json');

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }

  return Object.entries(value).flatMap(([key, nestedValue]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    return flattenKeys(nestedValue, nextPrefix);
  });
}

function collectStrings(value: unknown, results: string[] = []): string[] {
  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, results));
    return results;
  }

  if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectStrings(item, results));
    return results;
  }

  if (typeof value === 'string') {
    results.push(value);
  }

  return results;
}

function collectWorkspaceFiles(directory: string, results: string[] = []) {
  for (const entry of readdirSync(directory)) {
    const nextPath = join(directory, entry);
    let stats;
    try {
      stats = lstatSync(nextPath);
    } catch {
      continue;
    }

    if (stats.isSymbolicLink()) {
      continue;
    }

    if (stats.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') {
        continue;
      }

      collectWorkspaceFiles(nextPath, results);
      continue;
    }

    if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'].includes(extname(nextPath))) {
      results.push(nextPath);
    }
  }

  return results;
}

await runTest('supported languages mirror the current OpenClaw control-ui language surface', () => {
  assert.deepEqual(SUPPORTED_LANGUAGES, [
    'en',
    'zh',
    'zh-TW',
    'fr',
    'de',
    'pt-BR',
    'ja',
    'ko',
    'es',
    'tr',
    'uk',
    'pl',
    'id',
  ]);
  assert.equal(DEFAULT_LANGUAGE, 'en');
});

await runTest('normalizeLanguage collapses locale variants onto the supported app language set', () => {
  assert.equal(normalizeLanguage('en-US'), 'en');
  assert.equal(normalizeLanguage('zh-CN'), 'zh');
  assert.equal(normalizeLanguage('zh-Hant-TW'), 'zh-TW');
  assert.equal(normalizeLanguage('fr-CA'), 'fr');
  assert.equal(normalizeLanguage('de-AT'), 'de');
  assert.equal(normalizeLanguage('pt-PT'), 'pt-BR');
  assert.equal(normalizeLanguage('ja-JP'), 'ja');
  assert.equal(normalizeLanguage('ko-KR'), 'ko');
  assert.equal(normalizeLanguage('es-MX'), 'es');
  assert.equal(normalizeLanguage('tr-TR'), 'tr');
  assert.equal(normalizeLanguage('uk-UA'), 'uk');
  assert.equal(normalizeLanguage('pl-PL'), 'pl');
  assert.equal(normalizeLanguage('id-ID'), 'id');
  assert.equal(normalizeLanguage(undefined), 'en');
});

await runTest('language metadata exposes native labels and truthful translation-bundle sourcing', () => {
  assert.equal(LANGUAGE_LABELS.en, 'English');
  assert.equal(LANGUAGE_LABELS.zh, '\u7b80\u4f53\u4e2d\u6587');
  assert.equal(LANGUAGE_LABELS['zh-TW'], '\u7e41\u9ad4\u4e2d\u6587');
  assert.equal(LANGUAGE_LABELS['pt-BR'], 'Portugu\u00eas (Brasil)');
  assert.equal(LANGUAGE_LABELS.ja, '\u65e5\u672c\u8a9e');
  assert.equal(LANGUAGE_LABELS.ko, '\ud55c\uad6d\uc5b4');
  assert.equal(LANGUAGE_LABELS.es, 'Espa\u00f1ol');
  assert.equal(LANGUAGE_LABELS.pl, 'Polski');
  assert.equal(LANGUAGE_LABELS.id, 'Bahasa Indonesia');

  assert.equal(resolveTranslationBundleSourceLanguage('en'), 'en');
  assert.equal(resolveTranslationBundleSourceLanguage('zh-CN'), 'zh');
  assert.equal(resolveTranslationBundleSourceLanguage('zh-TW'), 'zh');
  assert.equal(resolveTranslationBundleSourceLanguage('pt-BR'), 'en');
  assert.equal(resolveTranslationBundleSourceLanguage('ja-JP'), 'en');

  assert.equal(hasDedicatedTranslationBundle('en'), true);
  assert.equal(hasDedicatedTranslationBundle('zh'), true);
  assert.equal(hasDedicatedTranslationBundle('zh-TW'), false);
  assert.equal(hasDedicatedTranslationBundle('pt-BR'), false);
  assert.equal(hasDedicatedTranslationBundle('ja'), false);
});

await runTest('getAppStoreLanguageFromSnapshot safely parses persisted Zustand state', () => {
  assert.equal(getAppStoreLanguageFromSnapshot('{"state":{"language":"zh"}}'), undefined);
  assert.equal(getAppStoreLanguageFromSnapshot('{"language":"en"}'), undefined);
  assert.equal(
    getAppStoreLanguageFromSnapshot('{"state":{"languagePreference":"system","language":"zh"}}'),
    undefined,
  );
  assert.equal(
    getAppStoreLanguageFromSnapshot('{"state":{"languagePreference":"en","language":"zh"}}'),
    'en',
  );
  assert.equal(getAppStoreLanguageFromSnapshot('{"state":{"language":1}}'), undefined);
  assert.equal(getAppStoreLanguageFromSnapshot('not-json'), undefined);
});

await runTest(
  'browser language detection prefers persisted app language over stale cookie and browser hints',
  () => {
    const storage = {
      getItem(key: string) {
        if (key === APP_STORE_STORAGE_KEY) {
          return '{"state":{"languagePreference":"zh","language":"zh"}}';
        }

        if (key === I18N_STORAGE_KEY) {
          return 'en-US';
        }

        return null;
      },
    };

    assert.equal(
      detectBrowserLanguage({
        storage,
        cookie: 'claw_lang=en',
        htmlLanguage: 'en-US',
        navigatorLanguage: 'en-US',
      }),
      'zh',
    );
  },
);

await runTest(
  'browser language detection still prefers persisted app preference over detector cache when no cookie exists',
  () => {
    const storage = {
      getItem(key: string) {
        if (key === APP_STORE_STORAGE_KEY) {
          return '{"state":{"languagePreference":"zh","language":"zh"}}';
        }

        if (key === I18N_STORAGE_KEY) {
          return 'en-US';
        }

        return null;
      },
    };

    assert.equal(
      detectBrowserLanguage({
        storage,
        htmlLanguage: 'en-US',
        navigatorLanguage: 'en-US',
      }),
      'zh',
    );
  },
);

await runTest(
  'browser language detection prefers navigator locale over detector/html fallbacks when language preference is system',
  () => {
    const storage = {
      getItem(key: string) {
        if (key === APP_STORE_STORAGE_KEY) {
          return '{"state":{"languagePreference":"system","language":"en"}}';
        }

        if (key === I18N_STORAGE_KEY) {
          return 'en-US';
        }

        return null;
      },
    };

    assert.equal(
      detectBrowserLanguage({
        storage,
        cookie: 'claw_lang=en',
        htmlLanguage: 'en',
        navigatorLanguage: 'zh-CN',
      }),
      'zh',
    );
  },
);

await runTest('browser language detection falls back when browser storage access is blocked', () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      get localStorage() {
        throw new DOMException('localStorage is blocked', 'SecurityError');
      },
    },
  });

  try {
    assert.equal(
      detectBrowserLanguage({
        cookie: 'claw_lang=en',
        htmlLanguage: 'en',
        navigatorLanguage: 'zh-CN',
      }),
      'zh',
    );
  } finally {
    if (previousWindow) {
      Object.defineProperty(globalThis, 'window', previousWindow);
    } else {
      delete (globalThis as { window?: unknown }).window;
    }
  }
});

await runTest('request language detection falls back cleanly to the default language', () => {
  assert.equal(detectRequestLanguage('zh-CN,zh;q=0.9,en;q=0.8'), 'zh');
  assert.equal(detectRequestLanguage('zh-Hant-TW,zh;q=0.9,en;q=0.8'), 'zh-TW');
  assert.equal(detectRequestLanguage('pt-PT,pt;q=0.9,en;q=0.8'), 'pt-BR');
  assert.equal(detectRequestLanguage('ja-JP,ja;q=0.9'), 'ja');
  assert.equal(detectRequestLanguage(undefined), 'en');
});

await runTest('translation bundles stay lazy until a source language is actually requested', async () => {
  assert.equal(translationResources.en, undefined);
  assert.equal(translationResources.zh, undefined);
  assert.equal(translationResources['zh-TW'], undefined);

  const english = await ensureI18n('en');

  assert.equal(english.hasResourceBundle('en', 'translation'), true);
  assert.equal(translationResources.en?.translation.account.title, 'Account & Wallet');
  assert.equal(translationResources.fr?.translation.account.title, 'Account & Wallet');
  assert.equal(translationResources.zh, undefined);
  assert.equal(translationResources['zh-TW'], undefined);
});

await runTest('ensureI18n exposes both translated bundles and fallback language bundles', async () => {
  const instance = await ensureI18n('pt-BR');

  assert.equal(instance.hasResourceBundle('en', 'translation'), true);
  assert.equal(instance.hasResourceBundle('pt-BR', 'translation'), true);
  assert.equal(instance.hasResourceBundle('zh', 'translation'), false);
  assert.equal(instance.hasResourceBundle('zh-TW', 'translation'), false);
  assert.equal(instance.language, 'pt-BR');
  assert.equal(translationResources.en?.translation.account.title, 'Account & Wallet');
  assert.equal(translationResources.fr?.translation.account.title, 'Account & Wallet');
  assert.equal(translationResources['pt-BR']?.translation.account.title, 'Account & Wallet');
  assert.equal(typeof translationResources.en?.translation.account.confirmRecharge, 'string');
  assert.equal(translationResources.zh, undefined);
  assert.equal(translationResources['zh-TW'], undefined);
});

await runTest('i18n interpolation formats numeric counts using the active locale', async () => {
  const english = await ensureI18n('en');
  assert.equal(english.t('community.postDetail.meta.views', { count: 12345 }), '12,345 views');

  const chinese = await ensureI18n('zh');
  assert.equal(chinese.hasResourceBundle('zh', 'translation'), true);
  assert.equal(chinese.hasResourceBundle('zh-TW', 'translation'), true);
  assert.equal(typeof translationResources.zh?.translation.account.confirmRecharge, 'string');
  assert.equal(typeof translationResources['zh-TW']?.translation.account.title, 'string');
  assert.equal(
    chinese.t('community.postDetail.meta.views', { count: 12345 }),
    '12,345 \u6d4f\u89c8\u6b21\u6570',
  );
});

await runTest('english and chinese locale key sets remain aligned', () => {
  assert.deepEqual(flattenKeys(en).sort(), flattenKeys(zh).sort());
});

await runTest('chinese usage locale keeps the shared OpenClaw workspace strings readable', () => {
  assert.equal(zh.sidebar.usage, '\u7f51\u5173\u7528\u91cf');
  assert.equal(
    zh.commandPalette.commands.usage.title,
    '\u6253\u5f00\u7f51\u5173\u7528\u91cf',
  );
  assert.equal(
    zh.dashboard.usage.page.title,
    '\u7f51\u5173\u7528\u91cf',
  );
  assert.equal(
    zh.dashboard.usage.filters.query,
    '\u67e5\u8be2\u7b5b\u9009',
  );
  assert.equal(
    zh.dashboard.usage.labels.noMatchingLogs,
    '\u6ca1\u6709\u65e5\u5fd7\u6761\u76ee\u5339\u914d\u5f53\u524d\u65e5\u5fd7\u7b5b\u9009\u6761\u4ef6\u3002',
  );
});

await runTest('critical chinese feature domains stay readable and free of known mojibake markers', () => {
  assert.equal(
    zh.providerCenter.page.title,
    '\u6a21\u578b\u914d\u7f6e\u4e2d\u5fc3',
  );
  assert.equal(
    zh.settings.general.title,
    '\u901a\u7528',
  );
  assert.equal(
    zh.tasks.page.title,
    '\u5b9a\u65f6\u4efb\u52a1',
  );

  const suspiciousPattern = /[ÃÂæçèéêëîïðñòóôõöøùúûüýþÿ]|閫|瀹|鏉|鍒|锟|鈥|é–|ç€|å®¸|æµ/u;
  const suspiciousStrings = [
    ...collectStrings(zh.providerCenter).map((value) => `providerCenter:${value}`),
    ...collectStrings(zh.settings).map((value) => `settings:${value}`),
    ...collectStrings(zh.tasks).map((value) => `tasks:${value}`),
  ].filter((value) => suspiciousPattern.test(value));

  assert.deepEqual(suspiciousStrings, []);
});

await runTest('locale resources keep split directories and compatibility aggregate json files aligned', () => {
  const englishDirectory = join(approvedLocaleDirectory, 'en');
  const chineseDirectory = join(approvedLocaleDirectory, 'zh');
  assert.equal(existsSync(legacyEnglishLocalePath), true);
  assert.equal(existsSync(legacyChineseLocalePath), true);
  assert.equal(existsSync(englishDirectory), true);
  assert.equal(existsSync(chineseDirectory), true);

  const englishFiles = readdirSync(englishDirectory).filter((entry) => extname(entry) === '.json').sort();
  const chineseFiles = readdirSync(chineseDirectory).filter((entry) => extname(entry) === '.json').sort();
  const compatibilityDomains = englishFiles.map((entry) => entry.slice(0, -'.json'.length)).sort();
  const englishCompatibility = JSON.parse(readFileSync(legacyEnglishLocalePath, 'utf8')) as Record<string, unknown>;
  const chineseCompatibility = JSON.parse(readFileSync(legacyChineseLocalePath, 'utf8')) as Record<string, unknown>;
  assert.deepEqual(englishFiles, chineseFiles);
  assert.equal(englishFiles.length > 10, true);
  assert.deepEqual(Object.keys(englishCompatibility).sort(), compatibilityDomains);
  assert.deepEqual(Object.keys(chineseCompatibility).sort(), compatibilityDomains);
});

await runTest('locale structure validation script passes for the current split-resource layout', () => {
  return import('../scripts/check-locale-structure.mjs').then((module) => {
    assert.equal(typeof module.validateLocaleStructure, 'function');
    const result = module.validateLocaleStructure();
    assert.equal(result.ok, true);
    assert.match(result.message, /locale structure ok/i);
  });
});

await runTest('formatting helpers use the selected application language', () => {
  assert.equal(formatNumber(1234567, 'en'), '1,234,567');
  assert.equal(formatNumber(1234567, 'zh'), '1,234,567');
  assert.equal(formatCurrency(42.2, 'en'), '$42.20');
  assert.equal(formatCurrency(42.2, 'zh', 'USD').length > 0, true);
  assert.equal(formatDate('2026-03-17T00:00:00.000Z', 'en').length > 0, true);
  assert.equal(formatTime('2026-03-17T14:35:00.000Z', 'zh').length > 0, true);
  assert.equal(
    formatRelativeTime(
      '2026-03-17T14:33:00.000Z',
      'en',
      '2026-03-17T14:35:00.000Z',
    ),
    '2 minutes ago',
  );
  assert.equal(
    formatRelativeTime(
      '2026-03-17T14:33:00.000Z',
      'zh',
      '2026-03-17T14:35:00.000Z',
    ).includes('2'),
    true,
  );
});

await runTest('localized text helpers resolve the active language and deep-map nested structures', () => {
  assert.equal(
    resolveLocalizedText(localizedText('Settings', '\u8bbe\u7f6e'), 'en-US'),
    'Settings',
  );
  assert.equal(
    resolveLocalizedText(localizedText('Settings', '\u8bbe\u7f6e'), 'zh-CN'),
    '\u8bbe\u7f6e',
  );
  assert.equal(
    resolveLocalizedText(localizedText('Settings', '\u8bbe\u7f6e'), 'zh-TW'),
    '\u8bbe\u7f6e',
  );
  assert.equal(
    resolveLocalizedText(localizedText('Settings', '\u8bbe\u7f6e'), 'ja-JP'),
    'Settings',
  );

  assert.deepEqual(
    localizeValue(
      {
        title: localizedText('Security', '\u5b89\u5168'),
        actions: [localizedText('Save', '\u4fdd\u5b58')],
        nested: {
          subtitle: localizedText(
            'Protect your account',
            '\u4fdd\u62a4\u4f60\u7684\u8d26\u6237',
          ),
        },
      },
      'zh-CN',
    ),
    {
      title: '\u5b89\u5168',
      actions: ['\u4fdd\u5b58'],
      nested: {
        subtitle: '\u4fdd\u62a4\u4f60\u7684\u8d26\u6237',
      },
    },
  );
});

await runTest('infrastructure no longer ships duplicate locale files', () => {
  const duplicateLocaleDirectory = join(
    packagesRoot,
    'sdkwork-claw-infrastructure',
    'src',
    'i18n',
    'locales',
  );
  const duplicateLocaleFiles = existsSync(duplicateLocaleDirectory)
    ? readdirSync(duplicateLocaleDirectory)
    : [];

  assert.deepEqual(duplicateLocaleFiles, []);
});

await runTest('only approved locale resource files contain Chinese characters or mojibake', () => {
  const offenders = collectWorkspaceFiles(packagesRoot)
    .filter((filePath) => {
      if (!filePath.split(/[/\\]/).includes('src')) {
        return false;
      }

      if (filePath.includes('.test.')) {
        return false;
      }

      if (filePath.startsWith(approvedLocaleDirectory)) {
        return false;
      }

      const content = readFileSync(filePath, 'utf8');
      return /[\p{Script=Han}]|\uFFFD/u.test(content);
    })
    .map((filePath) => relative(workspaceRoot, filePath));

  assert.deepEqual(offenders, []);
});
