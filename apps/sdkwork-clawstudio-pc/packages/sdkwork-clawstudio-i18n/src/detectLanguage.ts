import {
  APP_STORE_STORAGE_KEY,
  DEFAULT_LANGUAGE,
  I18N_STORAGE_KEY,
  LANGUAGE_COOKIE_KEY,
  type AppLanguage,
  normalizeLanguage,
} from './config.ts';
import {
  readBrowserStorageValue,
  resolveBrowserStorage,
} from './safeBrowserStorage.ts';

export interface ResolveLanguageOptions {
  appStoreLanguage?: string | null;
  detectorLanguage?: string | null;
  cookieLanguage?: string | null;
  requestLanguage?: string | null;
  htmlLanguage?: string | null;
  navigatorLanguage?: string | null;
}

interface BrowserLanguageOptions {
  storage?: Pick<Storage, 'getItem'> | null;
  cookie?: string | null;
  htmlLanguage?: string | null;
  navigatorLanguage?: string | null;
}

export function parseCookieValue(cookieHeader?: string | null) {
  if (!cookieHeader) {
    return {};
  }

  return Object.fromEntries(
    cookieHeader
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, ...rest] = part.split('=');
        return [name, decodeURIComponent(rest.join('='))];
      }),
  );
}

export function getLanguageFromCookieString(cookieHeader?: string | null) {
  const value = parseCookieValue(cookieHeader)[LANGUAGE_COOKIE_KEY];
  return value ? normalizeLanguage(value) : null;
}

export function extractLanguageFromAcceptLanguage(header?: string | null) {
  return header
    ?.split(',')
    .map((entry) => entry.trim().split(';')[0]?.trim())
    .find(Boolean);
}

export function getAppStoreLanguageFromSnapshot(snapshot?: string | null) {
  if (!snapshot) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(snapshot) as
      | {
          state?: { language?: string; languagePreference?: string } | null;
          languagePreference?: string;
          language?: string;
        }
      | null;

    if (!parsed || typeof parsed !== 'object') {
      return undefined;
    }

    const languagePreference =
      typeof parsed.state?.languagePreference === 'string'
        ? parsed.state.languagePreference
        : typeof parsed.languagePreference === 'string'
          ? parsed.languagePreference
          : undefined;

    if (languagePreference === 'system') {
      return undefined;
    }

    if (typeof languagePreference === 'string') {
      return languagePreference;
    }

    // Legacy snapshots that only persisted `language` (without `languagePreference`)
    // are treated as "system" to avoid freezing the app on a stale default.
    return undefined;
  } catch {
    return undefined;
  }
}

export function resolveLanguage(options: ResolveLanguageOptions = {}): AppLanguage {
  const candidates = [
    options.requestLanguage,
    options.appStoreLanguage,
    // System locale should win when there is no explicit user preference.
    options.navigatorLanguage,
    options.cookieLanguage,
    options.detectorLanguage,
    // HTML lang often starts as a static template default (for example "en"),
    // so it stays as the final browser-side fallback.
    options.htmlLanguage,
  ];

  for (const candidate of candidates) {
    if (candidate) {
      return normalizeLanguage(candidate);
    }
  }

  return DEFAULT_LANGUAGE;
}

export function detectBrowserLanguage(options: BrowserLanguageOptions = {}) {
  const storage =
    options.storage ??
    resolveBrowserStorage('localStorage');
  const cookie =
    options.cookie ??
    (typeof document !== 'undefined' ? document.cookie : undefined);
  const htmlLanguage =
    options.htmlLanguage ??
    (typeof document !== 'undefined' ? document.documentElement.getAttribute('lang') : undefined);
  const navigatorLanguage =
    options.navigatorLanguage ??
    (typeof navigator !== 'undefined' ? navigator.language : undefined);

  const appStoreLanguage = storage
    ? getAppStoreLanguageFromSnapshot(readBrowserStorageValue(storage, APP_STORE_STORAGE_KEY))
    : undefined;

  const detectorLanguage = readBrowserStorageValue(storage, I18N_STORAGE_KEY);
  const cookieLanguage = getLanguageFromCookieString(cookie);

  return resolveLanguage({
    appStoreLanguage,
    detectorLanguage,
    cookieLanguage,
    htmlLanguage,
    navigatorLanguage,
  });
}

export function detectRequestLanguage(acceptLanguageHeader?: string | null) {
  return resolveLanguage({
    requestLanguage: extractLanguageFromAcceptLanguage(acceptLanguageHeader),
  });
}
