import { resolveWebPlatformFetch, type WebPlatformFetch } from './webHttp.ts';

export const SERVER_BROWSER_SESSION_HEADER_NAME = 'x-claw-browser-session';

export function createBrowserSessionAwareFetch(
  fetchImpl: WebPlatformFetch | undefined,
  browserSessionToken: string | null | undefined,
): WebPlatformFetch | undefined {
  const normalizedToken = normalizeBrowserSessionToken(browserSessionToken);
  if (!normalizedToken) {
    return fetchImpl;
  }

  const resolvedFetch = fetchImpl;
  if (!resolvedFetch) {
    return async (input, init) => {
      const headers = new Headers(init?.headers);
      headers.set(SERVER_BROWSER_SESSION_HEADER_NAME, normalizedToken);
      return resolveWebPlatformFetch()(input, {
        ...init,
        headers,
      });
    };
  }

  return async (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set(SERVER_BROWSER_SESSION_HEADER_NAME, normalizedToken);
    return resolvedFetch(input, {
      ...init,
      headers,
    });
  };
}

function normalizeBrowserSessionToken(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
