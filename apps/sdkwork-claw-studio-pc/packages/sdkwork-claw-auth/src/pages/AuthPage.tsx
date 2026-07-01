import { startTransition, useEffect, useState, type ReactElement } from 'react';
import * as QRCode from 'qrcode';
import { KeyRound, Mail, ShieldCheck, Smartphone, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  appAuthService,
  platform,
  useAuthStore,
  type AppAuthLoginQrCode,
  type AppAuthSocialProvider,
  type PasswordResetInput,
  type PasswordResetRequestInput,
  type RegisterInput,
} from '@sdkwork/claw-core';
import { AccountPasswordLoginForm } from '../components/auth/AccountPasswordLoginForm.tsx';
import { AuthMethodTabs } from '../components/auth/AuthMethodTabs.tsx';
import { EmailCodeLoginForm } from '../components/auth/EmailCodeLoginForm.tsx';
import { ForgotPasswordFlow } from '../components/auth/ForgotPasswordFlow.tsx';
import { OAuthProviderGrid } from '../components/auth/OAuthProviderGrid.tsx';
import { PhoneCodeLoginForm } from '../components/auth/PhoneCodeLoginForm.tsx';
import { QrLoginPanel } from '../components/auth/QrLoginPanel.tsx';
import { RegisterFlow } from '../components/auth/RegisterFlow.tsx';
import {
  DEFAULT_AUTH_LOGIN_METHODS,
  humanizeAuthProvider,
  isAuthOAuthLoginEnabled,
  isAuthQrLoginEnabled,
  looksLikeEmailAddress,
  looksLikePhoneNumber,
  readErrorMessage,
  resolveAuthLoginMethods,
  resolveAuthRecoveryMethods,
  resolveAuthMode,
  resolveAuthOAuthProviders,
  resolveAuthProviderTranslationKey,
  resolveAuthRegisterMethods,
  type AuthLoginMethod,
  type QrPanelState,
} from '../components/auth/authConfig.ts';
import { buildOAuthCallbackUri, resolveRedirectTarget } from './authRouteUtils.ts';

const QR_POLL_INTERVAL_MS = 2_000;

interface AuthSideHighlight {
  key: string;
  icon: ReactElement;
  title: string;
  description: string;
}

function resolveHintedEmail(searchParams: URLSearchParams) {
  const email = (searchParams.get('email') || '').trim();
  if (looksLikeEmailAddress(email)) {
    return email;
  }

  const account = (searchParams.get('account') || '').trim();
  return looksLikeEmailAddress(account) ? account : '';
}

function resolveHintedPhone(searchParams: URLSearchParams) {
  const phone = (searchParams.get('phone') || '').trim();
  if (looksLikePhoneNumber(phone)) {
    return phone;
  }

  const account = (searchParams.get('account') || '').trim();
  return looksLikePhoneNumber(account) ? account : '';
}

export function AuthPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const mode = resolveAuthMode(location.pathname);
  const redirectTarget = resolveRedirectTarget(searchParams.get('redirect'));
  const hintedAccount = (searchParams.get('account') || searchParams.get('email') || '').trim();
  const hintedEmail = resolveHintedEmail(searchParams);
  const hintedPhone = resolveHintedPhone(searchParams);
  const isDesktop = platform.getPlatform() === 'desktop';
  const deviceType = isDesktop ? 'desktop' : 'web';
  const loginMethods = resolveAuthLoginMethods();
  const registerMethods = resolveAuthRegisterMethods();
  const recoveryMethods = resolveAuthRecoveryMethods();
  const loginMethodsKey = loginMethods.join(',');
  const qrLoginEnabled = isAuthQrLoginEnabled();
  const oauthLoginEnabled = isAuthOAuthLoginEnabled();
  const oauthProviders = oauthLoginEnabled ? resolveAuthOAuthProviders() : [];
  const oauthProviderSummary = oauthProviders
    .map((provider) => {
      const label = t(resolveAuthProviderTranslationKey(provider));
      return label.startsWith('auth.providers.')
        ? humanizeAuthProvider(provider)
        : label;
    })
    .join(' / ');
  const sideHighlights: AuthSideHighlight[] = mode === 'register'
    ? [
      registerMethods.includes('email')
        ? {
          key: 'register-email',
          icon: <Mail className="h-5 w-5 text-primary-200" />,
          title: t('auth.registerMethods.email'),
          description: t('auth.registerHighlights.email'),
        }
        : null,
      registerMethods.includes('phone')
        ? {
          key: 'register-phone',
          icon: <Smartphone className="h-5 w-5 text-primary-200" />,
          title: t('auth.registerMethods.phone'),
          description: t('auth.registerHighlights.phone'),
        }
        : null,
      {
        key: 'register-password',
        icon: <ShieldCheck className="h-5 w-5 text-primary-200" />,
        title: t('auth.password'),
        description: t('auth.registerHighlights.password'),
      },
    ].filter((item): item is AuthSideHighlight => Boolean(item))
    : mode === 'forgot'
      ? [
        recoveryMethods.includes('email')
          ? {
            key: 'reset-email',
            icon: <Mail className="h-5 w-5 text-primary-200" />,
            title: t('auth.email'),
            description: t('auth.resetHighlights.email'),
          }
          : null,
        recoveryMethods.includes('phone')
          ? {
            key: 'reset-phone',
            icon: <Smartphone className="h-5 w-5 text-primary-200" />,
            title: t('auth.phone'),
            description: t('auth.resetHighlights.phone'),
          }
          : null,
        {
          key: 'reset-password',
          icon: <KeyRound className="h-5 w-5 text-primary-200" />,
          title: t('auth.resetPassword'),
          description: t('auth.resetHighlights.password'),
        },
      ].filter((item): item is AuthSideHighlight => Boolean(item))
      : [
        loginMethods.includes('password')
          ? {
            key: 'login-password',
            icon: <ShieldCheck className="h-5 w-5 text-primary-200" />,
            title: t('auth.loginMethods.password'),
            description: t('auth.actions.usePassword'),
          }
          : null,
        loginMethods.includes('emailCode')
          ? {
            key: 'login-email',
            icon: <Sparkles className="h-5 w-5 text-primary-200" />,
            title: t('auth.loginMethods.emailCode'),
            description: t('auth.actions.useEmailCode'),
          }
          : null,
        loginMethods.includes('phoneCode')
          ? {
            key: 'login-phone',
            icon: <KeyRound className="h-5 w-5 text-primary-200" />,
            title: t('auth.loginMethods.phoneCode'),
            description: t('auth.actions.usePhoneCode'),
          }
          : null,
        oauthProviders.length
        ? {
          key: 'login-oauth',
          icon: <Sparkles className="h-5 w-5 text-primary-200" />,
          title: t('auth.oauth.badge'),
          description: oauthProviderSummary,
        }
          : null,
      ].filter((item): item is AuthSideHighlight => Boolean(item));

  const {
    isAuthenticated,
    signIn,
    signInWithPhoneCode,
    signInWithEmailCode,
    register,
    requestPasswordReset,
    resetPassword,
    signInWithOAuth,
    applySession,
  } = useAuthStore();

  const [loginMethod, setLoginMethod] = useState<AuthLoginMethod>('password');
  const showForgotPasswordAction = loginMethods.includes('password') && loginMethod === 'password';
  const [activeOAuthProvider, setActiveOAuthProvider] = useState<AppAuthSocialProvider | null>(null);
  const [qrState, setQrState] = useState<QrPanelState>('idle');
  const [qrCode, setQrCode] = useState<AppAuthLoginQrCode | null>(null);
  const [qrImageSrc, setQrImageSrc] = useState('');
  const [qrErrorMessage, setQrErrorMessage] = useState('');
  const [qrReloadNonce, setQrReloadNonce] = useState(0);

  useEffect(() => {
    if (mode !== 'login') {
      return;
    }

    const requestedMethod = (searchParams.get('method') || '').trim();
    if (requestedMethod === 'email' || requestedMethod === 'emailCode') {
      setLoginMethod(
        loginMethods.includes('emailCode')
          ? 'emailCode'
          : loginMethods[0] || DEFAULT_AUTH_LOGIN_METHODS[0],
      );
      return;
    }

    if (requestedMethod === 'phone' || requestedMethod === 'phoneCode') {
      setLoginMethod(
        loginMethods.includes('phoneCode')
          ? 'phoneCode'
          : loginMethods[0] || DEFAULT_AUTH_LOGIN_METHODS[0],
      );
      return;
    }

    setLoginMethod((current) =>
      loginMethods.includes(current)
        ? current
        : loginMethods[0] || DEFAULT_AUTH_LOGIN_METHODS[0],
    );
  }, [loginMethodsKey, mode, searchParams]);

  useEffect(() => {
    if (mode !== 'login' || !qrLoginEnabled) {
      setQrState('idle');
      setQrCode(null);
      setQrImageSrc('');
      setQrErrorMessage('');
      return;
    }

    let disposed = false;
    let pollTimer: number | null = null;

    const clearPollTimer = () => {
      if (pollTimer !== null) {
        window.clearTimeout(pollTimer);
        pollTimer = null;
      }
    };

    const schedulePoll = (qrKey: string, delayMs = QR_POLL_INTERVAL_MS) => {
      clearPollTimer();
      pollTimer = window.setTimeout(() => {
        void pollStatus(qrKey);
      }, delayMs);
    };

    const pollStatus = async (qrKey: string) => {
      try {
        const statusResult = await appAuthService.checkLoginQrCodeStatus(qrKey);
        if (disposed) {
          return;
        }

        if (statusResult.status === 'confirmed' && statusResult.session) {
          setQrState('confirmed');
          applySession(statusResult.session);
          startTransition(() => {
            navigate(redirectTarget, { replace: true });
          });
          return;
        }

        setQrState(statusResult.status);

        if (statusResult.status === 'expired') {
          clearPollTimer();
          return;
        }

        schedulePoll(qrKey);
      } catch (error) {
        if (disposed) {
          return;
        }

        setQrState('error');
        setQrErrorMessage(readErrorMessage(error, t('auth.errors.qrStatusFailed')));
        clearPollTimer();
      }
    };

    const loadQrCode = async () => {
      setQrState('loading');
      setQrCode(null);
      setQrImageSrc('');
      setQrErrorMessage('');

      try {
        const nextQrCode = await appAuthService.generateLoginQrCode();
        if (disposed) {
          return;
        }

        let nextImageSrc = '';
        if (nextQrCode.qrUrl) {
          nextImageSrc = nextQrCode.qrUrl;
        } else if (nextQrCode.qrContent) {
          nextImageSrc = await QRCode.toDataURL(nextQrCode.qrContent, {
            errorCorrectionLevel: 'M',
            margin: 1,
            width: 320,
            color: {
              dark: '#111827',
              light: '#ffffff',
            },
          });
        } else {
          throw new Error(t('auth.errors.invalidQrPayload'));
        }

        if (disposed) {
          return;
        }

        setQrCode(nextQrCode);
        setQrImageSrc(nextImageSrc);
        setQrState('pending');
        schedulePoll(nextQrCode.qrKey);
      } catch (error) {
        if (disposed) {
          return;
        }

        setQrState('error');
        setQrErrorMessage(readErrorMessage(error, t('auth.errors.qrGenerateFailed')));
      }
    };

    void loadQrCode();

    return () => {
      disposed = true;
      clearPollTimer();
    };
  }, [applySession, mode, navigate, qrLoginEnabled, qrReloadNonce, redirectTarget, t]);

  const withRedirect = (pathname: string) => {
    const [basePath, rawQuery = ''] = pathname.split('?');
    const params = new URLSearchParams(rawQuery);
    if (redirectTarget !== '/dashboard') {
      params.set('redirect', redirectTarget);
    }

    const queryString = params.toString();
    return queryString ? `${basePath}?${queryString}` : basePath;
  };

  const handleOAuthSignIn = async (provider: AppAuthSocialProvider) => {
    if (activeOAuthProvider) {
      return;
    }

    setActiveOAuthProvider(provider);

    try {
      const authUrl = await appAuthService.getOAuthAuthorizationUrl({
        provider,
        redirectUri: buildOAuthCallbackUri(provider, redirectTarget),
        state: redirectTarget !== '/dashboard' ? redirectTarget : undefined,
      });
      window.location.assign(authUrl);
    } catch (error) {
      setActiveOAuthProvider(null);
      toast.error(readErrorMessage(error, t('auth.errors.oauthStartFailed')));
    }
  };

  const handlePasswordLogin = async (payload: { account: string; password: string }) => {
    await signIn(payload);
    startTransition(() => {
      navigate(redirectTarget, { replace: true });
    });
  };

  const handlePhoneCodeLogin = async (payload: { phone: string; code: string }) => {
    await signInWithPhoneCode({
      ...payload,
      deviceType,
    });
    startTransition(() => {
      navigate(redirectTarget, { replace: true });
    });
  };

  const handleEmailCodeLogin = async (payload: { email: string; code: string }) => {
    await signInWithEmailCode({
      ...payload,
      deviceType,
    });
    startTransition(() => {
      navigate(redirectTarget, { replace: true });
    });
  };

  const handleRegister = async (payload: RegisterInput) => {
    await register(payload);
    startTransition(() => {
      navigate(redirectTarget, { replace: true });
    });
  };

  const handleRequestPasswordReset = async (payload: PasswordResetRequestInput) => {
    await requestPasswordReset(payload);
  };

  const handlePasswordReset = async (payload: PasswordResetInput) => {
    await resetPassword(payload);
    startTransition(() => {
      navigate(
        withRedirect(`/login?account=${encodeURIComponent(payload.account.trim())}`),
        { replace: true },
      );
    });
  };

  if (isAuthenticated) {
    return <Navigate to={redirectTarget} replace />;
  }

  return (
    <div className="relative flex min-h-full items-center justify-center bg-zinc-100 dark:bg-zinc-950 p-4 sm:p-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[8%] top-[10%] h-56 w-56 rounded-full bg-primary-500/10 blur-3xl dark:bg-primary-500/14" />
        <div className="absolute bottom-[8%] right-[10%] h-64 w-64 rounded-full bg-white/40 blur-3xl dark:bg-zinc-900/80" />
      </div>

      <div className="relative z-10 flex w-full max-w-6xl flex-col overflow-hidden rounded-[32px] bg-white/92 md:min-h-[720px] md:flex-row dark:bg-zinc-950/88">
        <div className="w-full p-4 md:w-[42%] md:p-6">
          {mode === 'login' && qrLoginEnabled ? (
            <QrLoginPanel
              qrCode={qrCode}
              qrImageSrc={qrImageSrc}
              qrState={qrState}
              qrErrorMessage={qrErrorMessage}
              onRefresh={() => setQrReloadNonce((value) => value + 1)}
            />
          ) : (
            <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-[28px] bg-zinc-950 p-8 text-white">
              <div className="absolute inset-0 bg-[linear-gradient(180deg,_rgba(255,255,255,0.05),_transparent_30%)]" />
              <div className="relative z-10">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.08]">
                  {mode === 'register' ? (
                    <Sparkles className="h-8 w-8 text-primary-200" />
                  ) : (
                    <ShieldCheck className="h-8 w-8 text-primary-200" />
                  )}
                </div>
                <h2 className="text-2xl font-black tracking-tight">
                  {mode === 'register'
                    ? t('auth.createAccount')
                    : mode === 'forgot'
                      ? t('auth.resetPassword')
                      : t('auth.welcomeBack')}
                </h2>
                <p className="mt-3 max-w-[320px] text-sm leading-7 text-zinc-300">
                  {mode === 'register'
                    ? t('auth.registerDesc')
                    : mode === 'forgot'
                      ? t('auth.resetDesc')
                      : t('auth.loginDesc')}
                </p>
              </div>

              <div className="relative z-10 grid gap-4">
                {sideHighlights.map((item) => (
                  <div
                    key={item.key}
                    className="rounded-3xl bg-white/[0.06] p-5"
                  >
                    <div className="flex items-center gap-3">
                      {item.icon}
                      <div className="text-sm font-semibold">{item.title}</div>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-zinc-300">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="w-full p-8 md:w-[58%] md:px-10 md:py-12">
          <div className="mx-auto flex h-full max-w-xl flex-col justify-center">
            <div className="mb-8">
              {mode !== 'login' ? (
                <div className="inline-flex rounded-full bg-primary-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-primary-700 dark:bg-primary-500/14 dark:text-primary-200">
                  {mode === 'register'
                    ? t('auth.createAccount')
                    : t('auth.resetPassword')}
                </div>
              ) : null}
              <h1 className={`${mode === 'login' ? '' : 'mt-4 '}text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white sm:text-4xl`}>
                {mode === 'login'
                  ? t('auth.welcomeBack')
                  : mode === 'register'
                    ? t('auth.createAccount')
                    : t('auth.resetPassword')}
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-7 text-zinc-500 dark:text-zinc-400">
                {mode === 'login'
                  ? t('auth.loginDesc')
                  : mode === 'register'
                    ? t('auth.registerDesc')
                    : t('auth.resetDesc')}
              </p>
            </div>

            {mode === 'login' ? (
              <div className="space-y-6">
                {loginMethods.length > 1 ? (
                  <AuthMethodTabs
                    value={loginMethod}
                    onChange={(value) => setLoginMethod(value as AuthLoginMethod)}
                    items={loginMethods.map((item) => ({
                      value: item,
                      label: t(`auth.loginMethods.${item}`),
                      icon:
                        item === 'password'
                          ? <ShieldCheck className="h-4 w-4" />
                          : item === 'phoneCode'
                            ? <KeyRound className="h-4 w-4" />
                            : <Sparkles className="h-4 w-4" />,
                    }))}
                  />
                ) : null}

                {loginMethods.includes('password') && loginMethod === 'password' ? (
                  <AccountPasswordLoginForm
                    initialAccount={hintedAccount}
                    onSubmit={handlePasswordLogin}
                  />
                ) : null}

                {loginMethods.includes('phoneCode') && loginMethod === 'phoneCode' ? (
                  <PhoneCodeLoginForm
                    initialPhone={hintedPhone}
                    onSubmit={handlePhoneCodeLogin}
                  />
                ) : null}

                {loginMethods.includes('emailCode') && loginMethod === 'emailCode' ? (
                  <EmailCodeLoginForm
                    initialEmail={hintedEmail}
                    onSubmit={handleEmailCodeLogin}
                  />
                ) : null}

                <div
                  className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-sm ${
                    showForgotPasswordAction ? 'justify-between' : 'justify-end'
                  }`}
                >
                  {showForgotPasswordAction ? (
                    <button
                      type="button"
                      onClick={() => navigate(withRedirect('/forgot-password'))}
                      className="font-medium text-zinc-500 transition-colors hover:text-primary-600 dark:text-zinc-400 dark:hover:text-primary-300"
                    >
                      {t('auth.forgotPassword')}
                    </button>
                  ) : null}

                  <div className="text-zinc-500 dark:text-zinc-400">
                    {t('auth.noAccount')}{' '}
                    <button
                      type="button"
                      onClick={() => navigate(withRedirect('/register'))}
                      className="font-semibold text-primary-600 transition-colors hover:text-primary-500"
                    >
                      {t('auth.signUp')}
                    </button>
                  </div>
                </div>

                {oauthLoginEnabled ? (
                  <OAuthProviderGrid
                    providers={oauthProviders}
                    activeProvider={activeOAuthProvider}
                    onSelect={(provider) => {
                      void handleOAuthSignIn(provider);
                    }}
                  />
                ) : null}
              </div>
            ) : null}

            {mode === 'register' ? (
              <RegisterFlow
                methods={registerMethods}
                onSubmit={handleRegister}
              />
            ) : null}

            {mode === 'forgot' ? (
              <ForgotPasswordFlow
                initialAccount={hintedAccount || hintedEmail || hintedPhone}
                methods={recoveryMethods}
                onRequestReset={handleRequestPasswordReset}
                onSubmit={handlePasswordReset}
              />
            ) : null}

            {mode === 'register' || mode === 'forgot' ? (
              <div className="mt-8 text-center text-sm text-zinc-600 dark:text-zinc-400">
                {mode === 'register' ? (
                  <>
                    {t('auth.hasAccount')}{' '}
                    <button
                      type="button"
                      onClick={() => navigate(withRedirect('/login'))}
                      className="font-bold text-primary-600 transition-colors hover:text-primary-500"
                    >
                      {t('auth.signIn')}
                    </button>
                  </>
                ) : mode === 'forgot' ? (
                  <button
                    type="button"
                    onClick={() => navigate(withRedirect('/login'))}
                    className="font-bold text-primary-600 transition-colors hover:text-primary-500"
                  >
                    {t('auth.backToLogin')}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
