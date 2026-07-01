import React, { useEffect, useState } from 'react';
import { AlertTriangle, Database, Download, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Section, ToggleRow } from './Shared';
import { settingsService, type UserPreferences } from './services';

const DEFAULT_PRIVACY_PREFERENCES: UserPreferences['privacy'] = {
  shareUsageData: false,
  personalizedRecommendations: false,
};

export function DataPrivacySettings() {
  const [prefs, setPrefs] = useState<UserPreferences['privacy']>(DEFAULT_PRIVACY_PREFERENCES);
  const { t } = useTranslation();

  useEffect(() => {
    let cancelled = false;

    void settingsService
      .getPreferences()
      .then((preferences) => {
        if (!cancelled) {
          setPrefs(preferences.privacy);
        }
      })
      .catch(() => {
        if (!cancelled) {
          toast.error(t('settings.dataPrivacy.loadPreferenceFailed'));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [t]);

  const handleToggle = async (key: keyof UserPreferences['privacy']) => {
    const nextPrefs = { ...prefs, [key]: !prefs[key] };
    setPrefs(nextPrefs);

    try {
      await settingsService.updatePreferences({ privacy: nextPrefs });
    } catch {
      setPrefs(prefs);
      toast.error(t('settings.dataPrivacy.updatePreferenceFailed'));
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          {t('settings.dataPrivacy.title')}
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {t('settings.dataPrivacy.description')}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <div className="space-y-6">
          <Section title={t('settings.dataPrivacy.telemetry.title')}>
            <div className="space-y-4">
              <ToggleRow
                title={t('settings.dataPrivacy.telemetry.shareUsageData')}
                description={t('settings.dataPrivacy.telemetry.shareUsageDataDescription')}
                enabled={prefs.shareUsageData}
                onToggle={() => handleToggle('shareUsageData')}
              />
              <ToggleRow
                title={t('settings.dataPrivacy.telemetry.personalizedRecommendations')}
                description={t('settings.dataPrivacy.telemetry.personalizedRecommendationsDescription')}
                enabled={prefs.personalizedRecommendations}
                onToggle={() => handleToggle('personalizedRecommendations')}
              />
            </div>
          </Section>

          <Section title={t('settings.dataPrivacy.export.title')}>
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                <Database className="h-6 w-6 text-zinc-500 dark:text-zinc-400" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {t('settings.dataPrivacy.export.downloadTitle')}
                </h4>
                <p className="mb-4 mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {t('settings.dataPrivacy.export.description')}
                </p>
                <button
                  onClick={() =>
                    toast.success(t('settings.dataPrivacy.export.requested'))
                  }
                  className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <Download className="h-4 w-4" />
                  {t('settings.dataPrivacy.export.action')}
                </button>
              </div>
            </div>
          </Section>
        </div>

        <div className="space-y-6">
          <Section title={t('settings.dataPrivacy.deleteAccount.title')}>
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-50 dark:bg-red-500/10">
                <AlertTriangle className="h-6 w-6 text-red-500 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-red-600 dark:text-red-400">
                  {t('settings.dataPrivacy.deleteAccount.heading')}
                </h4>
                <p className="mb-4 mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {t('settings.dataPrivacy.deleteAccount.description')}
                </p>
                <button
                  onClick={() =>
                    toast.success(t('settings.dataPrivacy.deleteAccount.requested'))
                  }
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                  {t('settings.dataPrivacy.deleteAccount.action')}
                </button>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
