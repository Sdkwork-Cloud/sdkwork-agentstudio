export const SUPPORTED_LANGUAGES = [
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
] as const;

export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const DEDICATED_TRANSLATION_BUNDLE_LANGUAGES = ['en', 'zh'] as const;
export type TranslationBundleSourceLanguage =
  (typeof DEDICATED_TRANSLATION_BUNDLE_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: AppLanguage = 'en';
export const APP_STORE_STORAGE_KEY = 'claw-studio-app-storage';
export const LANGUAGE_COOKIE_KEY = 'claw_lang';
export const I18N_STORAGE_KEY = 'claw-language';
export const LANGUAGE_QUERY_PARAMETER = 'lang';

export const LANGUAGE_LABELS: Record<AppLanguage, string> = {
  en: 'English',
  zh: '\u7b80\u4f53\u4e2d\u6587',
  'zh-TW': '\u7e41\u9ad4\u4e2d\u6587',
  fr: 'Fran\u00e7ais',
  de: 'Deutsch',
  'pt-BR': 'Portugu\u00eas (Brasil)',
  ja: '\u65e5\u672c\u8a9e',
  ko: '\ud55c\uad6d\uc5b4',
  es: 'Espa\u00f1ol',
  tr: 'T\u00fcrk\u00e7e',
  uk: '\u0423\u043a\u0440\u0430\u0457\u043d\u0441\u044c\u043a\u0430',
  pl: 'Polski',
  id: 'Bahasa Indonesia',
};

export const INTL_LOCALES: Record<AppLanguage, string> = {
  en: 'en-US',
  zh: 'zh-CN',
  'zh-TW': 'zh-TW',
  fr: 'fr-FR',
  de: 'de-DE',
  'pt-BR': 'pt-BR',
  ja: 'ja-JP',
  ko: 'ko-KR',
  es: 'es-ES',
  tr: 'tr-TR',
  uk: 'uk-UA',
  pl: 'pl-PL',
  id: 'id-ID',
};

const TRANSLATION_BUNDLE_SOURCE_LANGUAGE_MAP: Record<AppLanguage, TranslationBundleSourceLanguage> = {
  en: 'en',
  zh: 'zh',
  'zh-TW': 'zh',
  fr: 'en',
  de: 'en',
  'pt-BR': 'en',
  ja: 'en',
  ko: 'en',
  es: 'en',
  tr: 'en',
  uk: 'en',
  pl: 'en',
  id: 'en',
};

const LANGUAGE_NORMALIZATION_RULES: ReadonlyArray<{
  language: AppLanguage;
  prefixes: readonly string[];
}> = [
  { language: 'zh-TW', prefixes: ['zh-tw', 'zh-hk', 'zh-mo', 'zh-hant'] },
  { language: 'zh', prefixes: ['zh'] },
  { language: 'en', prefixes: ['en'] },
  { language: 'fr', prefixes: ['fr'] },
  { language: 'de', prefixes: ['de'] },
  { language: 'pt-BR', prefixes: ['pt-br', 'pt'] },
  { language: 'ja', prefixes: ['ja'] },
  { language: 'ko', prefixes: ['ko'] },
  { language: 'es', prefixes: ['es'] },
  { language: 'tr', prefixes: ['tr'] },
  { language: 'uk', prefixes: ['uk'] },
  { language: 'pl', prefixes: ['pl'] },
  { language: 'id', prefixes: ['id'] },
];

function matchesLanguagePrefix(value: string, prefix: string) {
  return value === prefix || value.startsWith(`${prefix}-`);
}

export function isSupportedLanguage(value: string | null | undefined): value is AppLanguage {
  return SUPPORTED_LANGUAGES.includes(value as AppLanguage);
}

export function normalizeLanguage(value?: string | null): AppLanguage {
  if (!value) {
    return DEFAULT_LANGUAGE;
  }

  const normalized = value.trim().toLowerCase().replaceAll('_', '-');

  for (const rule of LANGUAGE_NORMALIZATION_RULES) {
    if (rule.prefixes.some((prefix) => matchesLanguagePrefix(normalized, prefix))) {
      return rule.language;
    }
  }

  return DEFAULT_LANGUAGE;
}

export function getIntlLocale(language?: string | null) {
  return INTL_LOCALES[normalizeLanguage(language)];
}

export function resolveTranslationBundleSourceLanguage(
  language?: string | null,
): TranslationBundleSourceLanguage {
  return TRANSLATION_BUNDLE_SOURCE_LANGUAGE_MAP[normalizeLanguage(language)];
}

export function hasDedicatedTranslationBundle(language?: string | null) {
  const normalizedLanguage = normalizeLanguage(language);
  return resolveTranslationBundleSourceLanguage(normalizedLanguage) === normalizedLanguage;
}
