import React, { useEffect, useState } from 'react';
import { Check, Globe, Laptop, Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { type LanguagePreference, type ThemeColor, useAppStore } from '@sdkwork/claw-core';
import {
  LANGUAGE_LABELS,
  hasDedicatedTranslationBundle,
  resolveTranslationBundleSourceLanguage,
  supportedLanguages,
} from '@sdkwork/claw-i18n';
import {
  Checkbox,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sdkwork/claw-ui';
import { Section, ToggleRow } from './Shared';
import { settingsService, type UserPreferences } from './services';

const THEME_COLORS: { id: ThemeColor; labelKey: string; colorClass: string }[] = [
  {
    id: 'tech-blue',
    labelKey: 'settings.general.themeColors.tech-blue',
    colorClass: 'bg-blue-500',
  },
  {
    id: 'lobster',
    labelKey: 'settings.general.themeColors.lobster',
    colorClass: 'bg-red-500',
  },
  {
    id: 'green-tech',
    labelKey: 'settings.general.themeColors.green-tech',
    colorClass: 'bg-emerald-500',
  },
  {
    id: 'zinc',
    labelKey: 'settings.general.themeColors.zinc',
    colorClass: 'bg-zinc-500',
  },
  {
    id: 'violet',
    labelKey: 'settings.general.themeColors.violet',
    colorClass: 'bg-violet-500',
  },
  {
    id: 'rose',
    labelKey: 'settings.general.themeColors.rose',
    colorClass: 'bg-rose-500',
  },
];

const DEFAULT_GENERAL_PREFERENCES: UserPreferences['general'] = {
  launchOnStartup: false,
  startMinimized: false,
  compactModelSelector: true,
};

export function GeneralSettings() {
  const {
    themeMode,
    setThemeMode,
    themeColor,
    setThemeColor,
    languagePreference,
    setLanguage,
    hiddenSidebarItems,
    toggleSidebarItem,
  } = useAppStore();
  const [prefs, setPrefs] = useState<UserPreferences['general']>(DEFAULT_GENERAL_PREFERENCES);
  const { t } = useTranslation();

  useEffect(() => {
    let cancelled = false;

    void settingsService
      .getPreferences()
      .then((preferences) => {
        if (!cancelled) {
          setPrefs(preferences.general);
        }
      })
      .catch(() => {
        if (!cancelled) {
          toast.error(t('settings.general.loadPreferenceFailed'));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [t]);

  const handleToggle = async (key: keyof UserPreferences['general']) => {
    const nextPrefs = { ...prefs, [key]: !prefs[key] };
    setPrefs(nextPrefs);

    try {
      await settingsService.updatePreferences({ general: nextPrefs });
    } catch {
      setPrefs(prefs);
      toast.error(t('settings.general.updatePreferenceFailed'));
    }
  };

  const sidebarItems = [
    { id: 'chat', label: t('sidebar.aiChat') },
    { id: 'channels', label: t('sidebar.channels') },
    { id: 'tasks', label: t('sidebar.cronTasks') },
    { id: 'instances', label: t('sidebar.instances') },
    { id: 'extensions', label: t('sidebar.extensions') },
    { id: 'claw-upload', label: t('sidebar.clawUpload') },
    { id: 'community', label: t('sidebar.community') },
  ];
  const explicitLanguagePreference =
    languagePreference !== 'system' ? languagePreference : null;
  const explicitLanguageFallback =
    explicitLanguagePreference && !hasDedicatedTranslationBundle(explicitLanguagePreference)
      ? LANGUAGE_LABELS[resolveTranslationBundleSourceLanguage(explicitLanguagePreference)]
      : null;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          {t('settings.general.title')}
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {t('settings.general.description')}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <div className="space-y-6">
          <Section title={t('settings.general.appearance')}>
            <div className="space-y-6">
              <div>
                <div className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {t('settings.general.themeMode')}
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <ThemeOption
                    icon={Sun}
                    label={t('settings.general.themeModes.light')}
                    active={themeMode === 'light'}
                    onClick={() => setThemeMode('light')}
                  />
                  <ThemeOption
                    icon={Moon}
                    label={t('settings.general.themeModes.dark')}
                    active={themeMode === 'dark'}
                    onClick={() => setThemeMode('dark')}
                  />
                  <ThemeOption
                    icon={Laptop}
                    label={t('settings.general.themeModes.system')}
                    active={themeMode === 'system'}
                    onClick={() => setThemeMode('system')}
                  />
                </div>
              </div>

              <div>
                <div className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {t('settings.general.themeColor')}
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
                  {THEME_COLORS.map((color) => (
                    <button
                      key={color.id}
                      onClick={() => setThemeColor(color.id)}
                      className="group relative flex flex-col items-center gap-3 rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4 transition-all hover:border-zinc-300 hover:bg-white dark:border-zinc-800 dark:bg-zinc-950/50 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
                    >
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-full ${color.colorClass} shadow-sm ring-2 ring-offset-2 transition-all dark:ring-offset-zinc-950 ${
                          themeColor === color.id
                            ? 'scale-110 ring-zinc-900 dark:ring-zinc-100'
                            : 'ring-transparent group-hover:scale-105'
                        }`}
                      >
                        {themeColor === color.id ? (
                          <Check className="h-5 w-5 text-white" />
                        ) : null}
                      </div>
                      <span
                        className={`text-center text-xs font-medium ${
                          themeColor === color.id
                            ? 'text-zinc-900 dark:text-zinc-100'
                            : 'text-zinc-500 group-hover:text-zinc-700 dark:text-zinc-400 dark:group-hover:text-zinc-300'
                        }`}
                      >
                        {t(color.labelKey)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          <Section title={t('settings.general.sidebarNavigation')}>
            <div className="space-y-4">
              <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
                {t('settings.general.sidebarDescription')}
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {sidebarItems.map((item) => (
                  <label
                    key={item.id}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-zinc-200 p-3 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                  >
                    <Checkbox
                      checked={!hiddenSidebarItems.includes(item.id)}
                      onCheckedChange={() => toggleSidebarItem(item.id)}
                    />
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      {item.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </Section>
        </div>

        <div className="space-y-6">
          <Section title={t('settings.general.languageRegion')}>
            <div className="space-y-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <Globe className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {t('settings.general.language')}
                    </div>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">
                      {t('settings.general.languageDescription')}
                    </div>
                  </div>
                </div>
                <Select
                  value={languagePreference}
                  onValueChange={(value) => setLanguage(value as LanguagePreference)}
                >
                  <SelectTrigger className="w-full sm:w-[220px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">
                      {t('settings.general.themeModes.system')}
                    </SelectItem>
                    {supportedLanguages.map((supportedLanguage) => (
                      <SelectItem key={supportedLanguage} value={supportedLanguage}>
                        <div className="flex flex-col py-0.5 text-left">
                          <span>{LANGUAGE_LABELS[supportedLanguage]}</span>
                          {!hasDedicatedTranslationBundle(supportedLanguage) ? (
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">
                              {t('settings.general.languageFallbackTo', {
                                language:
                                  LANGUAGE_LABELS[
                                    resolveTranslationBundleSourceLanguage(supportedLanguage)
                                  ],
                              })}
                            </span>
                          ) : null}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {explicitLanguageFallback ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {t('settings.general.languageFallbackTo', {
                    language: explicitLanguageFallback,
                  })}
                </p>
              ) : null}
            </div>
          </Section>

          <Section title={t('settings.general.startup')}>
            <div className="space-y-4">
              <ToggleRow
                title={t('settings.general.launchOnStartup')}
                description={t('settings.general.launchOnStartupDescription')}
                enabled={prefs.launchOnStartup}
                onToggle={() => handleToggle('launchOnStartup')}
              />
              <ToggleRow
                title={t('settings.general.startMinimized')}
                description={t('settings.general.startMinimizedDescription')}
                enabled={prefs.startMinimized}
                onToggle={() => handleToggle('startMinimized')}
              />
            </div>
          </Section>

          <Section title={t('settings.general.chatComposer')}>
            <div className="space-y-4">
              <ToggleRow
                title={t('settings.general.compactModelSelector')}
                description={t('settings.general.compactModelSelectorDescription')}
                enabled={prefs.compactModelSelector}
                onToggle={() => handleToggle('compactModelSelector')}
              />
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function ThemeOption({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 p-4 transition-all ${
        active
          ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-500/10'
          : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700'
      }`}
    >
      <Icon
        className={`h-6 w-6 ${
          active ? 'text-primary-500 dark:text-primary-400' : 'text-zinc-500 dark:text-zinc-400'
        }`}
      />
      <span
        className={`text-sm font-medium ${
          active
            ? 'text-primary-700 dark:text-primary-300'
            : 'text-zinc-700 dark:text-zinc-300'
        }`}
      >
        {label}
      </span>
    </button>
  );
}
