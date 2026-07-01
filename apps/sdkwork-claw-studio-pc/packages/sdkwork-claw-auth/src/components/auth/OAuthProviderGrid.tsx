import type { ReactNode } from 'react';
import { ArrowRight, GitBranch, Globe, MessageCircle, Music2, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { type AppAuthSocialProvider } from '@sdkwork/claw-core';
import { LoaderCircle } from 'lucide-react';
import {
  humanizeAuthProvider,
  resolveAuthOAuthProviders,
  resolveAuthProviderTranslationKey,
} from './authConfig.ts';

interface OAuthProviderGridProps {
  providers?: AppAuthSocialProvider[];
  activeProvider?: AppAuthSocialProvider | null;
  onSelect: (provider: AppAuthSocialProvider) => void;
}

function resolveProviderIcon(provider: AppAuthSocialProvider): ReactNode {
  if (provider === 'github') {
    return <GitBranch className="h-5 w-5" />;
  }

  if (provider === 'google') {
    return <Globe className="h-5 w-5" />;
  }

  if (provider === 'wechat') {
    return <MessageCircle className="h-5 w-5" />;
  }

  if (provider === 'douyin') {
    return <Music2 className="h-5 w-5" />;
  }

  return <ShieldCheck className="h-5 w-5" />;
}

export function OAuthProviderGrid({
  providers,
  activeProvider,
  onSelect,
}: OAuthProviderGridProps) {
  const { t } = useTranslation();
  const oauthProviders = resolveAuthOAuthProviders(providers);

  if (!oauthProviders.length) {
    return null;
  }

  return (
    <div className="space-y-5">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="h-px w-full bg-zinc-200 dark:bg-zinc-800" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-white px-2 text-zinc-500 dark:bg-zinc-900">
            {t('auth.continueWith')}
          </span>
        </div>
      </div>

      <p className="text-xs leading-6 text-zinc-500 dark:text-zinc-400">
        {t('auth.oauth.helper')}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {oauthProviders.map((provider) => {
          const isBusy = activeProvider === provider;

          return (
            <button
              key={provider}
              type="button"
              onClick={() => onSelect(provider)}
              disabled={Boolean(activeProvider)}
              className={`group flex min-h-[72px] w-full items-center justify-between rounded-2xl bg-zinc-100/80 px-4 py-3 dark:bg-zinc-900/80 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                isBusy
                  ? 'text-primary-700 dark:text-primary-200'
                  : 'text-zinc-700 hover:bg-white/88 hover:text-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-950/88 dark:hover:text-white'
              }`}
            >
              <span className="flex items-center gap-3">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    isBusy
                      ? 'bg-white text-primary-600 dark:bg-zinc-950 dark:text-primary-200'
                      : 'bg-white/90 text-zinc-500 group-hover:text-primary-600 dark:bg-zinc-950 dark:text-zinc-400 dark:group-hover:text-primary-200'
                  }`}
                >
                  {resolveProviderIcon(provider)}
                </span>
                <span className="min-w-0">
                  <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                    {t(resolveAuthProviderTranslationKey(provider), {
                      defaultValue: humanizeAuthProvider(provider),
                    })}
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                    {t(`auth.oauth.providerHints.${provider}`, {
                      defaultValue: t('auth.oauth.helper'),
                    })}
                  </span>
                </span>
              </span>
              {isBusy ? (
                <LoaderCircle className="h-4 w-4 animate-spin text-primary-500" />
              ) : (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-zinc-400 transition-colors group-hover:text-primary-600 dark:text-zinc-500 dark:group-hover:text-primary-200">
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
