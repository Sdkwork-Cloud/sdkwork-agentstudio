import { useTranslation } from 'react-i18next';
import { DEFAULT_LANGUAGE, normalizeLanguage, type AppLanguage } from './config.ts';

export interface LocalizedText {
  en: string;
  zh: string;
}

type Primitive = boolean | null | number | string | undefined;

export function localizedText(en: string, zh: string): LocalizedText {
  return { en, zh };
}

export function isLocalizedText(value: unknown): value is LocalizedText {
  return (
    value !== null &&
    typeof value === 'object' &&
    'en' in value &&
    'zh' in value &&
    typeof (value as LocalizedText).en === 'string' &&
    typeof (value as LocalizedText).zh === 'string'
  );
}

export function resolveLocalizedText(value: LocalizedText, language?: string | null) {
  const normalizedLanguage = normalizeLanguage(language);
  return normalizedLanguage === 'zh' || normalizedLanguage === 'zh-TW'
    ? value.zh
    : value.en;
}

function localizeValueDeep<T>(value: T, language: AppLanguage): T {
  if (isLocalizedText(value)) {
    return resolveLocalizedText(value, language) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => localizeValueDeep(item, language)) as T;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, localizeValueDeep(nestedValue, language)]),
    ) as T;
  }

  return value;
}

export function localizeValue<T>(value: T, language?: string | null): T {
  return localizeValueDeep(value, normalizeLanguage(language));
}

export function useLocalizedText() {
  const { i18n } = useTranslation();

  return {
    text: (en: string, zh: string) => resolveLocalizedText(localizedText(en, zh), i18n.resolvedLanguage ?? i18n.language),
    language: normalizeLanguage(i18n.resolvedLanguage ?? i18n.language),
  };
}

export type LocalizedValue<T extends Primitive | Record<string, unknown> | unknown[]> =
  T extends Primitive ? T | LocalizedText : T;
