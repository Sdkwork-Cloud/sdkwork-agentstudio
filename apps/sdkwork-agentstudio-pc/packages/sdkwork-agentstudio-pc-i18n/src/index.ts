import { createInstance } from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import {
  DEFAULT_LANGUAGE,
  I18N_STORAGE_KEY,
  LANGUAGE_COOKIE_KEY,
  LANGUAGE_QUERY_PARAMETER,
  SUPPORTED_LANGUAGES,
  getIntlLocale,
  normalizeLanguage,
  resolveTranslationBundleSourceLanguage,
  type TranslationBundleSourceLanguage,
} from './config.ts';
import {
  detectBrowserLanguage,
  detectRequestLanguage,
  getLanguageFromCookieString,
  parseCookieValue,
} from './detectLanguage.ts';
import {
  resolveBrowserStorage,
  writeBrowserStorageValue,
} from './safeBrowserStorage.ts';

export * from './config.ts';
export * from './detectLanguage.ts';
export * from './format.ts';
export * from './localize.ts';

export const supportedLanguages = SUPPORTED_LANGUAGES;
export type SupportedLanguage = (typeof supportedLanguages)[number];
export const defaultLanguage = DEFAULT_LANGUAGE;
export const languageCookieName = LANGUAGE_COOKIE_KEY;
export const languageStorageKey = I18N_STORAGE_KEY;
export const languageQueryParameter = LANGUAGE_QUERY_PARAMETER;
export const resolveRequestLanguage = detectRequestLanguage;
export { normalizeLanguage, parseCookieValue, getLanguageFromCookieString };

type TranslationLocale = typeof import('./locales/en/index.ts').default;
type TranslationResourceBundle = {
  translation: TranslationLocale;
};

type TranslationResourceMap = Partial<Record<SupportedLanguage, TranslationResourceBundle>>;

export const translationResources: TranslationResourceMap = {};

const translationBundleLoaders: Record<
  TranslationBundleSourceLanguage,
  () => Promise<TranslationLocale>
> = {
  en: async () => (await import('./locales/en/index.ts')).default,
  zh: async () => (await import('./locales/zh/index.ts')).default,
};

const translationBundlePromises = new Map<
  TranslationBundleSourceLanguage,
  Promise<TranslationResourceBundle>
>();

const i18n = createInstance();

let initialization: Promise<typeof i18n> | null = null;

function listTranslationBundleLanguages(
  sourceLanguage: TranslationBundleSourceLanguage,
): SupportedLanguage[] {
  return supportedLanguages.filter(
    (language) => resolveTranslationBundleSourceLanguage(language) === sourceLanguage,
  );
}

async function loadTranslationBundle(
  sourceLanguage: TranslationBundleSourceLanguage,
): Promise<TranslationResourceBundle> {
  const existing = translationBundlePromises.get(sourceLanguage);
  if (existing) {
    return existing;
  }

  const pending = translationBundleLoaders[sourceLanguage]().then((translation) => ({
    translation,
  }));
  translationBundlePromises.set(sourceLanguage, pending);
  return pending;
}

function registerTranslationBundle(
  language: SupportedLanguage,
  bundle: TranslationResourceBundle,
) {
  translationResources[language] = bundle;

  if (i18n.isInitialized && !i18n.hasResourceBundle(language, 'translation')) {
    i18n.addResourceBundle(language, 'translation', bundle.translation, true, true);
  }
}

async function ensureTranslationResources(language: SupportedLanguage) {
  const requiredSourceLanguages = new Set<TranslationBundleSourceLanguage>([
    resolveTranslationBundleSourceLanguage(defaultLanguage),
    resolveTranslationBundleSourceLanguage(language),
  ]);

  for (const sourceLanguage of requiredSourceLanguages) {
    const bundle = await loadTranslationBundle(sourceLanguage);

    for (const bundleLanguage of listTranslationBundleLanguages(sourceLanguage)) {
      registerTranslationBundle(bundleLanguage, bundle);
    }
  }
}

function getLanguageFromQuery() {
  if (typeof window === 'undefined') {
    return null;
  }

  const value = new URLSearchParams(window.location.search).get(languageQueryParameter);
  return value ? normalizeLanguage(value) : null;
}

export function resolveInitialLanguage(): SupportedLanguage {
  if (typeof window === 'undefined') {
    return defaultLanguage;
  }

  return (
    getLanguageFromQuery() ||
    detectBrowserLanguage() ||
    defaultLanguage
  );
}

function persistLanguage(language: SupportedLanguage) {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('lang', language);
    document.cookie = `${languageCookieName}=${encodeURIComponent(language)}; Path=/; SameSite=Lax`;
  }

  writeBrowserStorageValue(resolveBrowserStorage('localStorage'), languageStorageKey, language);
}

export async function ensureI18n(initialLanguage = resolveInitialLanguage()) {
  const nextLanguage = normalizeLanguage(initialLanguage);

  if (!initialization) {
    initialization = (async () => {
      await ensureTranslationResources(nextLanguage);

      if (!i18n.isInitialized) {
        if (typeof window !== 'undefined') {
          i18n.use(LanguageDetector);
        }

        i18n.use(initReactI18next);
        const interpolation = {
          escapeValue: false,
          format: (value: unknown, format?: string, language?: string) => {
            if (format === 'number' && (typeof value === 'number' || typeof value === 'bigint')) {
              return new Intl.NumberFormat(getIntlLocale(language)).format(value);
            }

            return String(value);
          },
        };
        await i18n.init({
          resources: translationResources as Record<SupportedLanguage, TranslationResourceBundle>,
          lng: nextLanguage,
          fallbackLng: defaultLanguage,
          supportedLngs: [...supportedLanguages],
          load: 'currentOnly',
          interpolation,
          detection: {
            order: ['querystring', 'cookie', 'localStorage', 'navigator', 'htmlTag'],
            lookupQuerystring: languageQueryParameter,
            lookupCookie: languageCookieName,
            lookupLocalStorage: languageStorageKey,
            caches: ['cookie'],
          },
        });

        i18n.on('languageChanged', (language) => {
          persistLanguage(normalizeLanguage(language));
        });
      }

      persistLanguage(normalizeLanguage(i18n.resolvedLanguage ?? i18n.language));
      return i18n;
    })();
  }

  const instance = await initialization;
  await ensureTranslationResources(nextLanguage);

  if (normalizeLanguage(instance.resolvedLanguage ?? instance.language) !== nextLanguage) {
    await instance.changeLanguage(nextLanguage);
  }

  persistLanguage(nextLanguage);
  return instance;
}

export async function changeAppLanguage(language: SupportedLanguage) {
  await ensureI18n(language);
}

export { i18n };
export default i18n;
