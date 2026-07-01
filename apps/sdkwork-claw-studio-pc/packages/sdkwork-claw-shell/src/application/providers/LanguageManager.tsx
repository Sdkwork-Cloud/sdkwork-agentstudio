import { useEffect } from 'react';
import { useAppStore, type LanguagePreference } from '@sdkwork/claw-core';
import { ensureI18n, normalizeLanguage } from '@sdkwork/claw-i18n';

interface LanguageManagerProps {
  onLanguagePreferenceChange?: (languagePreference: LanguagePreference) => void;
}

export function LanguageManager({ onLanguagePreferenceChange }: LanguageManagerProps) {
  const language = useAppStore((state) => state.language);
  const languagePreference = useAppStore((state) => state.languagePreference);

  useEffect(() => {
    const nextLanguage = normalizeLanguage(language);

    document.documentElement.setAttribute('lang', nextLanguage);
    void ensureI18n(nextLanguage);
  }, [language]);

  useEffect(() => {
    onLanguagePreferenceChange?.(languagePreference);
  }, [languagePreference, onLanguagePreferenceChange]);

  return null;
}
