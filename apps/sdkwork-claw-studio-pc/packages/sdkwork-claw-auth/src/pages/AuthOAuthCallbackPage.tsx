import { startTransition, useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, LoaderCircle, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { platform, useAuthStore } from '@sdkwork/claw-core';
import { Button } from '@sdkwork/claw-ui';
import {
  isAuthOAuthLoginEnabled,
  isConfiguredAuthOAuthProvider,
  normalizeAuthOAuthProvider,
  resolveAuthOAuthProviders,
} from '../components/auth/authConfig.ts';
import { resolveRedirectTarget } from './authRouteUtils.ts';

type CallbackState = 'loading' | 'error';

function buildLoginPath(redirectTarget: string) {
  if (redirectTarget === '/dashboard') {
    return '/login';
  }
  return `/login?redirect=${encodeURIComponent(redirectTarget)}`;
}

export function AuthOAuthCallbackPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { provider } = useParams<{ provider: string }>();
  const [searchParams] = useSearchParams();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const signInWithOAuth = useAuthStore((state) => state.signInWithOAuth);
  const isDesktop = platform.getPlatform() === 'desktop';
  const redirectTarget = resolveRedirectTarget(searchParams.get('redirect'));
  const [callbackState, setCallbackState] = useState<CallbackState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const configuredProviders = isAuthOAuthLoginEnabled()
    ? resolveAuthOAuthProviders()
    : [];

  useEffect(() => {
    const normalizedProvider = normalizeAuthOAuthProvider(provider);
    if (!normalizedProvider || !isConfiguredAuthOAuthProvider(normalizedProvider, configuredProviders)) {
      const message = t('auth.oauth.invalidProvider');
      setCallbackState('error');
      setErrorMessage(message);
      return;
    }

    const providerError =
      (searchParams.get('error_description') || searchParams.get('error') || '').trim();
    if (providerError) {
      setCallbackState('error');
      setErrorMessage(providerError);
      return;
    }

    const code = (searchParams.get('code') || '').trim();
    if (!code) {
      const message = t('auth.oauth.missingCode');
      setCallbackState('error');
      setErrorMessage(message);
      return;
    }

    let disposed = false;

    void (async () => {
      try {
        await signInWithOAuth({
          provider: normalizedProvider,
          code,
          state: (searchParams.get('state') || '').trim() || undefined,
          deviceType: isDesktop ? 'desktop' : 'web',
        });
        if (disposed) {
          return;
        }
        startTransition(() => {
          navigate(redirectTarget, { replace: true });
        });
      } catch (error) {
        if (disposed) {
          return;
        }
        const message =
          error instanceof Error && error.message
            ? error.message
            : t('auth.oauth.failed');
        toast.error(message);
        setCallbackState('error');
        setErrorMessage(message);
      }
    })();

    return () => {
      disposed = true;
    };
  }, [configuredProviders, isDesktop, navigate, provider, redirectTarget, searchParams, signInWithOAuth, t]);

  if (isAuthenticated) {
    return <Navigate to={redirectTarget} replace />;
  }

  return (
    <div className="relative flex min-h-full items-center justify-center p-4 sm:p-8">
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-zinc-900">
        <div className="border-b border-zinc-200/80 bg-zinc-950 px-8 py-6 text-white dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-600/90">
              {callbackState === 'loading' ? (
                <LoaderCircle className="h-6 w-6 animate-spin" />
              ) : (
                <AlertCircle className="h-6 w-6" />
              )}
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-200">
                {t('auth.oauth.badge')}
              </div>
              <h1 className="mt-1 text-2xl font-black tracking-tight">
                {callbackState === 'loading'
                  ? t('auth.oauth.processingTitle')
                  : t('auth.oauth.failedTitle')}
              </h1>
            </div>
          </div>
        </div>

        <div className="space-y-6 px-8 py-8">
          {callbackState === 'loading' ? (
            <>
              <p className="text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                {t('auth.oauth.processingDesc')}
              </p>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                <div className="flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-200">
                  <ShieldCheck className="h-5 w-5 text-primary-500" />
                  <span>{t('auth.oauth.processingHint')}</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm leading-7 text-zinc-600 dark:text-zinc-300">{errorMessage}</p>
              <Button
                type="button"
                onClick={() => navigate(buildLoginPath(redirectTarget), { replace: true })}
                className="h-auto w-full py-3 font-bold"
              >
                {t('auth.backToLogin')}
                <ArrowRight className="h-4 w-4 rotate-180" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
