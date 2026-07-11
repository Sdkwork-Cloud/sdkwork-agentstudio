import React, { useEffect, useState } from 'react';
import { Laptop, Smartphone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button, Input, Label, Switch } from '@sdkwork/agentstudio-pc-ui';
import { Section, ToggleRow } from './Shared';
import { settingsService, type UserPreferences } from './services';

const DEFAULT_SECURITY_PREFERENCES: UserPreferences['security'] = {
  twoFactorAuth: false,
  loginAlerts: true,
};

export function SecuritySettings() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [prefs, setPrefs] = useState<UserPreferences['security']>(DEFAULT_SECURITY_PREFERENCES);
  const { t } = useTranslation();
  const passwordPlaceholder = '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022';

  useEffect(() => {
    let cancelled = false;

    void settingsService
      .getPreferences()
      .then((preferences) => {
        if (!cancelled) {
          setPrefs(preferences.security);
        }
      })
      .catch(() => {
        if (!cancelled) {
          toast.error(t('settings.security.toasts.loadPreferenceFailed'));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [t]);

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error(t('settings.security.toasts.fillAllFields'));
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(t('settings.security.toasts.passwordMismatch'));
      return;
    }

    setIsUpdating(true);
    try {
      await settingsService.updatePassword(currentPassword, newPassword);
      toast.success(t('settings.security.toasts.passwordUpdated'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      toast.error(t('settings.security.toasts.passwordUpdateFailed'));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggle = async (key: keyof UserPreferences['security']) => {
    const nextPrefs = { ...prefs, [key]: !prefs[key] };
    setPrefs(nextPrefs);

    try {
      await settingsService.updatePreferences({ security: nextPrefs });
    } catch {
      setPrefs(prefs);
      toast.error(t('settings.security.toasts.preferenceUpdateFailed'));
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          {t('settings.security.title')}
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {t('settings.security.description')}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <div className="space-y-6">
          <Section title={t('settings.security.changePassword')}>
            <div className="grid gap-4 xl:grid-cols-2">
              <div>
                <Label className="mb-2 block">
                  {t('settings.security.currentPassword')}
                </Label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  placeholder={passwordPlaceholder}
                />
              </div>
              <div>
                <Label className="mb-2 block">
                  {t('settings.security.newPassword')}
                </Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder={passwordPlaceholder}
                />
              </div>
              <div className="xl:col-span-2">
                <Label className="mb-2 block">
                  {t('settings.security.confirmNewPassword')}
                </Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder={passwordPlaceholder}
                />
              </div>
              <div className="pt-2 xl:col-span-2">
                <Button
                  onClick={handleUpdatePassword}
                  disabled={isUpdating}
                  variant="outline"
                  className="bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {isUpdating ? t('settings.security.updating') : t('settings.security.updatePassword')}
                </Button>
              </div>
            </div>
          </Section>

          <Section title={t('settings.security.twoFactor.title')}>
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-500/10">
                <Smartphone className="h-6 w-6 text-primary-500 dark:text-primary-400" />
              </div>
              <div className="flex-1 space-y-4">
                <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {t('settings.security.twoFactor.authenticatorApp')}
                </h4>
                <p className="mb-4 mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {t('settings.security.twoFactor.description')}
                </p>
                <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                  <div>
                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {prefs.twoFactorAuth
                        ? t('settings.security.twoFactor.disable')
                        : t('settings.security.twoFactor.enable')}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {t('settings.security.twoFactor.toggleDescription')}
                    </div>
                  </div>
                  <Switch
                    checked={prefs.twoFactorAuth}
                    onCheckedChange={() => handleToggle('twoFactorAuth')}
                  />
                </div>
              </div>
            </div>
          </Section>
        </div>

        <div className="space-y-6">
          <Section title={t('settings.security.alerts.title')}>
            <div className="space-y-4">
              <ToggleRow
                title={t('settings.security.alerts.loginAlerts')}
                description={t('settings.security.alerts.loginAlertsDescription')}
                enabled={prefs.loginAlerts}
                onToggle={() => handleToggle('loginAlerts')}
              />
            </div>
          </Section>

          <Section title={t('settings.security.sessions.title')}>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/50">
                <div className="flex items-center gap-4">
                  <Laptop className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
                  <div>
                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {t('settings.security.sessions.currentDeviceName')}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {t('settings.security.sessions.currentDeviceLocation')}
                    </div>
                  </div>
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
                  {t('settings.security.sessions.current')}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-zinc-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center gap-4">
                  <Smartphone className="h-5 w-5 text-zinc-400 dark:text-zinc-500" />
                  <div>
                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {t('settings.security.sessions.mobileDeviceName')}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {t('settings.security.sessions.mobileDeviceLocation')}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => toast.success(t('settings.security.toasts.sessionRevoked'))}
                  className="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400"
                >
                  {t('settings.security.sessions.revoke')}
                </button>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
