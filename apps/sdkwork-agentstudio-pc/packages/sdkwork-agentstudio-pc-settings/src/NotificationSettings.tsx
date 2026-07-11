import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Section, ToggleRow } from './Shared';
import { settingsService, type UserPreferences } from './services';

const DEFAULT_NOTIFICATION_PREFERENCES: UserPreferences['notifications'] = {
  systemUpdates: false,
  taskFailures: false,
  securityAlerts: false,
  taskCompletions: false,
  newMessages: false,
};

export function NotificationSettings() {
  const [prefs, setPrefs] = useState<UserPreferences['notifications']>(DEFAULT_NOTIFICATION_PREFERENCES);
  const { t } = useTranslation();

  useEffect(() => {
    let cancelled = false;

    void settingsService
      .getPreferences()
      .then((preferences) => {
        if (!cancelled) {
          setPrefs(preferences.notifications);
        }
      })
      .catch(() => {
        if (!cancelled) {
          toast.error(t('settings.notifications.loadPreferenceFailed'));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [t]);

  const handleToggle = async (key: keyof UserPreferences['notifications']) => {
    const nextPrefs = { ...prefs, [key]: !prefs[key] };
    setPrefs(nextPrefs);

    try {
      await settingsService.updatePreferences({ notifications: nextPrefs });
    } catch {
      setPrefs(prefs);
      toast.error(t('settings.notifications.updatePreferenceFailed'));
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          {t('settings.notifications.title')}
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {t('settings.notifications.description')}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title={t('settings.notifications.emailTitle')}>
          <div className="space-y-4">
            <ToggleRow
              title={t('settings.notifications.systemUpdates')}
              description={t('settings.notifications.systemUpdatesDescription')}
              enabled={prefs.systemUpdates}
              onToggle={() => handleToggle('systemUpdates')}
            />
            <ToggleRow
              title={t('settings.notifications.taskFailures')}
              description={t('settings.notifications.taskFailuresDescription')}
              enabled={prefs.taskFailures}
              onToggle={() => handleToggle('taskFailures')}
            />
            <ToggleRow
              title={t('settings.notifications.securityAlerts')}
              description={t('settings.notifications.securityAlertsDescription')}
              enabled={prefs.securityAlerts}
              onToggle={() => handleToggle('securityAlerts')}
            />
          </div>
        </Section>
        <Section title={t('settings.notifications.desktopTitle')}>
          <div className="space-y-4">
            <ToggleRow
              title={t('settings.notifications.taskCompletions')}
              description={t('settings.notifications.taskCompletionsDescription')}
              enabled={prefs.taskCompletions}
              onToggle={() => handleToggle('taskCompletions')}
            />
            <ToggleRow
              title={t('settings.notifications.newMessages')}
              description={t('settings.notifications.newMessagesDescription')}
              enabled={prefs.newMessages}
              onToggle={() => handleToggle('newMessages')}
            />
          </div>
        </Section>
      </div>
    </div>
  );
}
