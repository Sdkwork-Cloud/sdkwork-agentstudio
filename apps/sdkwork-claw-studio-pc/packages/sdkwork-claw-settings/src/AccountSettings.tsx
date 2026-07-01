import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  BadgeCheck,
  CheckCircle2,
  Cloud,
  CloudOff,
  ImageIcon,
  LoaderCircle,
  LogIn,
  LogOut,
  Mail,
  PencilLine,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@sdkwork/claw-core';
import { Button, Input, Label, cn } from '@sdkwork/claw-ui';
import {
  buildAccountProfileState,
  EMPTY_USER_PROFILE,
  resolveAccountProfileBaseline,
  type AccountProfileField,
  type AccountProfileSource,
  type AccountProfileStatus,
} from './accountProfileModel';
import { Section } from './Shared';
import { settingsService, type UserProfile } from './services';

const LOGIN_PATH = '/login?redirect=%2Fsettings%3Ftab%3Daccount';
type Translate = (key: string, options?: Record<string, unknown>) => string;

function getProfileFieldLabel(field: AccountProfileField, t: Translate) {
  switch (field) {
    case 'firstName':
      return t('settings.account.firstName');
    case 'lastName':
      return t('settings.account.lastName');
    case 'email':
      return t('settings.account.email');
    case 'avatar':
      return t('settings.account.avatarTitle');
    default:
      return field;
  }
}

function getProfileStatusPresentation(status: AccountProfileStatus, t: Translate) {
  switch (status) {
    case 'saving':
      return {
        icon: LoaderCircle,
        label: t('settings.account.status.saving'),
        className:
          'border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-500/20 dark:bg-primary-500/10 dark:text-primary-300',
        iconClassName: 'animate-spin',
      };
    case 'attention':
      return {
        icon: AlertCircle,
        label: t('settings.account.status.attention'),
        className:
          'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300',
        iconClassName: '',
      };
    case 'dirty':
      return {
        icon: PencilLine,
        label: t('settings.account.status.dirty'),
        className:
          'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300',
        iconClassName: '',
      };
    case 'session':
      return {
        icon: CloudOff,
        label: t('settings.account.status.session'),
        className:
          'border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
        iconClassName: '',
      };
    case 'synced':
    default:
      return {
        icon: BadgeCheck,
        label: t('settings.account.status.synced'),
        className:
          'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300',
        iconClassName: '',
      };
  }
}

function getCompletionPresentation(completionPercentage: number, t: Translate) {
  if (completionPercentage >= 100) {
    return {
      label: t('settings.account.completion.levels.complete'),
      barClassName: 'bg-emerald-500',
      badgeClassName:
        'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300',
    };
  }

  if (completionPercentage >= 50) {
    return {
      label: t('settings.account.completion.levels.growing'),
      barClassName: 'bg-primary-500',
      badgeClassName:
        'border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-500/20 dark:bg-primary-500/10 dark:text-primary-300',
    };
  }

  return {
    label: t('settings.account.completion.levels.starter'),
    barClassName: 'bg-amber-500',
    badgeClassName:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300',
  };
}

function getEmailHealthLabel(emailState: 'missing' | 'invalid' | 'valid', t: Translate) {
  switch (emailState) {
    case 'valid':
      return t('settings.account.emailHealth.valid');
    case 'invalid':
      return t('settings.account.emailHealth.invalid');
    case 'missing':
    default:
      return t('settings.account.emailHealth.missing');
  }
}

function getSourcePresentation(
  source: AccountProfileSource,
  loadFailed: boolean,
  t: Translate,
) {
  if (source === 'remote' && !loadFailed) {
    return {
      icon: Cloud,
      title: t('settings.account.source.remoteTitle'),
      description: t('settings.account.source.remoteDescription'),
    };
  }

  return {
    icon: CloudOff,
    title: t('settings.account.source.sessionTitle'),
    description: loadFailed
      ? t('settings.account.source.sessionFailedDescription')
      : t('settings.account.source.sessionDescription'),
  };
}

function getEmailSupportMessage(emailState: 'missing' | 'invalid' | 'valid', t: Translate) {
  switch (emailState) {
    case 'missing':
      return t('settings.account.form.emailMissing');
    case 'invalid':
      return t('settings.account.form.emailInvalid');
    case 'valid':
    default:
      return t('settings.account.form.emailHint');
  }
}

function LoadingBlock({ className }: { className: string }) {
  return <div className={cn('animate-pulse rounded-2xl bg-zinc-200/80 dark:bg-zinc-800/80', className)} />;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-sm backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/70">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        {value}
      </div>
      <div className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
        {description}
      </div>
    </div>
  );
}

function AccountLoadingState() {
  return (
    <div className="space-y-8">
      <div>
        <LoadingBlock className="mb-3 h-8 w-40" />
        <LoadingBlock className="h-4 w-72" />
      </div>

      <div className="overflow-hidden rounded-[1.75rem] border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900 sm:p-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-5">
            <LoadingBlock className="h-24 w-24 rounded-[2rem]" />
            <div className="space-y-3">
              <LoadingBlock className="h-7 w-52" />
              <LoadingBlock className="h-4 w-60" />
              <LoadingBlock className="h-9 w-56" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:w-[360px]">
            <LoadingBlock className="h-32 w-full" />
            <LoadingBlock className="h-32 w-full" />
            <LoadingBlock className="h-32 w-full" />
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]">
        <div className="space-y-6">
          <LoadingBlock className="h-[420px] w-full rounded-[1.5rem]" />
        </div>
        <div className="space-y-6">
          <LoadingBlock className="h-[260px] w-full rounded-[1.5rem]" />
          <LoadingBlock className="h-[180px] w-full rounded-[1.5rem]" />
          <LoadingBlock className="h-[140px] w-full rounded-[1.5rem]" />
        </div>
      </div>
    </div>
  );
}

export function AccountSettings() {
  const navigate = useNavigate();
  const { isAuthenticated, user, signOut, syncUserProfile } = useAuthStore();
  const [profile, setProfile] = useState<UserProfile>(EMPTY_USER_PROFILE);
  const [baselineProfile, setBaselineProfile] = useState<UserProfile>(EMPTY_USER_PROFILE);
  const [profileSource, setProfileSource] = useState<AccountProfileSource>('session');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (!isAuthenticated) {
      setProfile(EMPTY_USER_PROFILE);
      setBaselineProfile(EMPTY_USER_PROFILE);
      setProfileSource('session');
      setLoadFailed(false);
      setIsLoading(false);
      return;
    }

    const fallback = resolveAccountProfileBaseline({
      authUser: user,
      remoteProfile: null,
      hasRemoteProfile: false,
    });

    setProfile(fallback.profile);
    setBaselineProfile(fallback.profile);
    setProfileSource(fallback.source);

    const fetchProfile = async () => {
      setIsLoading(true);
      setLoadFailed(false);

      try {
        const remoteProfile = await settingsService.getProfile();
        const resolved = resolveAccountProfileBaseline({
          authUser: user,
          remoteProfile,
          hasRemoteProfile: true,
        });
        setProfile(resolved.profile);
        setBaselineProfile(resolved.profile);
        setProfileSource(resolved.source);
      } catch {
        setLoadFailed(true);
        toast.error(t('settings.account.toasts.loadFailed'));
      } finally {
        setIsLoading(false);
      }
    };

    void fetchProfile();
  }, [isAuthenticated, user?.email, user?.avatarUrl]);

  const profileState = buildAccountProfileState({
    baselineProfile,
    draftProfile: profile,
    source: profileSource,
    isSaving,
  });
  const statusPresentation = getProfileStatusPresentation(profileState.status, t);
  const completionPresentation = getCompletionPresentation(
    profileState.completionPercentage,
    t,
  );
  const sourcePresentation = getSourcePresentation(profileSource, loadFailed, t);
  const emailSupportMessage = getEmailSupportMessage(profileState.emailState, t);

  const handleSave = async () => {
    if (!isAuthenticated) {
      navigate(LOGIN_PATH, { replace: true });
      return;
    }

    if (profileState.emailState === 'missing') {
      toast.error(t('settings.account.toasts.emailRequired'));
      return;
    }

    if (profileState.emailState === 'invalid') {
      toast.error(t('settings.account.toasts.invalidEmail'));
      return;
    }

    setIsSaving(true);
    try {
      const updatedProfile = await settingsService.updateProfile(profileState.profile);
      const resolved = resolveAccountProfileBaseline({
        authUser: user,
        remoteProfile: updatedProfile,
        hasRemoteProfile: true,
      });

      setProfile(resolved.profile);
      setBaselineProfile(resolved.profile);
      setProfileSource(resolved.source);
      setLoadFailed(false);
      syncUserProfile(updatedProfile);
      toast.success(t('settings.account.toasts.updated'));
    } catch {
      toast.error(t('settings.account.toasts.updateFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    if (!isAuthenticated) {
      navigate(LOGIN_PATH, { replace: true });
      return;
    }

    try {
      await signOut();
      toast.success(t('settings.account.toasts.signedOut'));
      navigate('/login', { replace: true });
    } catch {
      toast.error(t('settings.account.toasts.signOutFailed'));
    }
  };

  if (isLoading) {
    return <AccountLoadingState />;
  }

  if (!isAuthenticated) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="mb-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {t('settings.account.title')}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {t('settings.account.signedOutDescription')}
          </p>
        </div>

        <div className="overflow-hidden rounded-[1.75rem] border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900">
          <div className="relative overflow-hidden p-6 sm:p-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_42%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_42%)]" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[1.5rem] bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
                  <UserRound className="h-6 w-6" />
                </div>
                <h3 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                  {t('settings.account.signInRequired')}
                </h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  {t('settings.account.signInPrompt')}
                </p>
              </div>

              <Button
                onClick={() => navigate(LOGIN_PATH)}
                className="min-w-[160px]"
              >
                <LogIn className="h-4 w-4" />
                {t('settings.account.goToLogin')}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 border-t border-zinc-100 bg-zinc-50/70 p-6 dark:border-zinc-800/80 dark:bg-zinc-950/50 md:grid-cols-3">
            <MetricCard
              icon={Cloud}
              label={t('settings.account.source.remoteTitle')}
              value={t('settings.account.signedOutCards.syncTitle')}
              description={t('settings.account.signedOutCards.syncDescription')}
            />
            <MetricCard
              icon={ShieldCheck}
              label={t('settings.account.access.title')}
              value={t('settings.account.signedOutCards.securityTitle')}
              description={t('settings.account.signedOutCards.securityDescription')}
            />
            <MetricCard
              icon={Sparkles}
              label={t('settings.account.completion.title')}
              value={t('settings.account.signedOutCards.profileTitle')}
              description={t('settings.account.signedOutCards.profileDescription')}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          {t('settings.account.title')}
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {t('settings.account.description')}
        </p>
      </div>

      <div className="overflow-hidden rounded-[1.75rem] border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900">
        <div className="relative overflow-hidden p-6 sm:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.1),transparent_38%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_38%)]" />
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[2rem] border border-white/70 bg-zinc-900 text-2xl font-semibold text-white shadow-sm dark:border-zinc-800/80 dark:bg-zinc-100 dark:text-zinc-900">
                {profileState.profile.avatarUrl ? (
                  <img
                    src={profileState.profile.avatarUrl}
                    alt={profileState.displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  profileState.initials
                )}
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                    {profileState.displayName}
                  </h3>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium',
                      statusPresentation.className,
                    )}
                  >
                    <statusPresentation.icon
                      className={cn('h-3.5 w-3.5', statusPresentation.iconClassName)}
                    />
                    {statusPresentation.label}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 shadow-sm dark:bg-zinc-950/70">
                    <Mail className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                    {profileState.profile.email || t('settings.account.emailHealth.missing')}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 shadow-sm dark:bg-zinc-950/70">
                    <sourcePresentation.icon className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                    {sourcePresentation.title}
                  </span>
                </div>

                <p className="max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  {sourcePresentation.description}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:w-[360px]">
              <MetricCard
                icon={Sparkles}
                label={t('settings.account.metrics.completeness')}
                value={`${profileState.completionPercentage}%`}
                description={completionPresentation.label}
              />
              <MetricCard
                icon={sourcePresentation.icon}
                label={t('settings.account.metrics.sync')}
                value={sourcePresentation.title}
                description={sourcePresentation.description}
              />
              <MetricCard
                icon={Mail}
                label={t('settings.account.metrics.email')}
                value={getEmailHealthLabel(profileState.emailState, t)}
                description={emailSupportMessage}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]">
        <div className="space-y-6">
          <Section title={t('settings.account.profileTitle')}>
            <div className="space-y-6">
              <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                <div className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  {t('settings.account.form.displayName')}
                </div>
                <div className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {profileState.displayName}
                </div>
                <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {t('settings.account.form.displayNameHint')}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <Label className="mb-2 block">
                    {t('settings.account.firstName')}
                  </Label>
                  <Input
                    type="text"
                    value={profile.firstName}
                    onChange={(event) =>
                      setProfile((current) => ({
                        ...current,
                        firstName: event.target.value,
                      }))}
                    placeholder={t('settings.account.placeholders.firstName')}
                  />
                </div>
                <div>
                  <Label className="mb-2 block">
                    {t('settings.account.lastName')}
                  </Label>
                  <Input
                    type="text"
                    value={profile.lastName}
                    onChange={(event) =>
                      setProfile((current) => ({
                        ...current,
                        lastName: event.target.value,
                      }))}
                    placeholder={t('settings.account.placeholders.lastName')}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="mb-2 block">
                    {t('settings.account.email')}
                  </Label>
                  <Input
                    type="email"
                    value={profile.email}
                    onChange={(event) =>
                      setProfile((current) => ({
                        ...current,
                        email: event.target.value,
                      }))}
                    placeholder={t('settings.account.placeholders.email')}
                    className={cn(
                      profileState.emailState === 'invalid'
                        ? 'border-amber-300 focus-visible:ring-amber-500 dark:border-amber-500/40'
                        : '',
                    )}
                  />
                  <p
                    className={cn(
                      'mt-2 text-xs leading-5',
                      profileState.emailState === 'valid'
                        ? 'text-zinc-500 dark:text-zinc-400'
                        : 'text-amber-700 dark:text-amber-300',
                    )}
                  >
                    {emailSupportMessage}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    <ImageIcon className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {t('settings.account.avatarTitle')}
                    </div>
                    <p className="text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                      {t('settings.account.form.avatarReadonly')}
                    </p>
                  </div>
                </div>
              </div>

              {loadFailed ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                  {t('settings.account.source.sessionFailedDescription')}
                </div>
              ) : null}

              <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {profileState.hasChanges
                        ? t('settings.account.form.unsavedTitle')
                        : t('settings.account.form.upToDateTitle')}
                    </div>
                    <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      {profileState.hasChanges
                        ? t('settings.account.form.unsavedDescription')
                        : t('settings.account.form.upToDateDescription')}
                    </div>
                  </div>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium',
                      completionPresentation.badgeClassName,
                    )}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {t('settings.account.completion.summary', {
                      completed: profileState.completedFields,
                      total: profileState.totalFields,
                    })}
                  </span>
                </div>

                <div className="flex flex-wrap justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setProfile(baselineProfile)}
                    disabled={!profileState.canReset}
                  >
                    <RefreshCcw className="h-4 w-4" />
                    {t('settings.account.resetChanges')}
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={!profileState.canSave}
                  >
                    {isSaving ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <BadgeCheck className="h-4 w-4" />
                    )}
                    {isSaving
                      ? t('settings.account.saving')
                      : t('settings.account.saveChanges')}
                  </Button>
                </div>
              </div>
            </div>
          </Section>
        </div>

        <div className="space-y-6">
          <Section title={t('settings.account.completion.title')}>
            <div className="space-y-5">
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {t('settings.account.completion.summary', {
                      completed: profileState.completedFields,
                      total: profileState.totalFields,
                    })}
                  </div>
                  <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {profileState.completionPercentage}%
                  </div>
                </div>
                <div className="h-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      completionPresentation.barClassName,
                    )}
                    style={{ width: `${profileState.completionPercentage}%` }}
                  />
                </div>
                <div className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                  {profileState.nextRecommendedField
                    ? t('settings.account.completion.nextStep', {
                        field: getProfileFieldLabel(profileState.nextRecommendedField, t),
                      })
                    : t('settings.account.completion.done')}
                </div>
              </div>

              <div className="space-y-3">
                {profileState.completionItems.map((item) => (
                  <div
                    key={item.field}
                    className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/50"
                  >
                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {getProfileFieldLabel(item.field, t)}
                    </div>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
                        item.complete
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                          : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
                      )}
                    >
                      {item.complete ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5" />
                      )}
                      {item.complete
                        ? t('settings.account.completion.complete')
                        : t('settings.account.completion.missing')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          <Section title={t('settings.account.access.title')}>
            <div className="space-y-4">
              <div className="flex items-start gap-4 rounded-2xl border border-zinc-100 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
                  <sourcePresentation.icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {sourcePresentation.title}
                  </div>
                  <div className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                    {sourcePresentation.description}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4 rounded-2xl border border-zinc-100 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
                  <ImageIcon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {t('settings.account.avatarTitle')}
                  </div>
                  <div className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                    {t('settings.account.access.avatarDescription')}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4 rounded-2xl border border-zinc-100 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {t('settings.account.access.securityTitle')}
                  </div>
                  <div className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                    {t('settings.account.access.securityDescription')}
                  </div>
                </div>
              </div>
            </div>
          </Section>

          <Section title={t('settings.account.dangerZone')}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {t('settings.account.signOut')}
                </div>
                <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {t('settings.account.signOutDescription')}
                </div>
              </div>
              <Button
                variant="destructive"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4" />
                {t('settings.account.signOut')}
              </Button>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
