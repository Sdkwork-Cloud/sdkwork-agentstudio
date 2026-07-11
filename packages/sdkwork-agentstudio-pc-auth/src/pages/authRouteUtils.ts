import type { AppAuthSocialProvider } from '@sdkwork/agentstudio-pc-core';

export function resolveRedirectTarget(rawTarget: string | null) {
  if (!rawTarget || !rawTarget.startsWith('/') || rawTarget.startsWith('//')) {
    return '/dashboard';
  }

  const [targetPathname] = rawTarget.split(/[?#]/, 1);

  if (
    targetPathname === '/auth' ||
    targetPathname === '/login' ||
    targetPathname === '/register' ||
    targetPathname === '/forgot-password' ||
    targetPathname.startsWith('/login/oauth/callback')
  ) {
    return '/dashboard';
  }

  return rawTarget;
}

export function buildOAuthCallbackUri(
  provider: AppAuthSocialProvider,
  redirectTarget: string,
): string {
  if (typeof window === 'undefined' || !window.location?.origin) {
    throw new Error('OAuth callback URL is unavailable in the current runtime.');
  }

  const callbackUrl = new URL(`/login/oauth/callback/${provider}`, window.location.origin);
  if (redirectTarget !== '/dashboard') {
    callbackUrl.searchParams.set('redirect', redirectTarget);
  }
  return callbackUrl.toString();
}
