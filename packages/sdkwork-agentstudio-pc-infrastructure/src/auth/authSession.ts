import { resolveBrowserStorage } from '../platform/safeBrowserStorage.ts';

const AUTH_SESSION_STORAGE_KEY = 'agent-studio-auth-session';

export interface AuthSession {
  authToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresIn?: number;
}

function getStorage(): Storage | null {
  return resolveBrowserStorage('localStorage');
}

export function readAuthSession(): AuthSession | null {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  let rawValue: string | null = null;
  try {
    rawValue = storage.getItem(AUTH_SESSION_STORAGE_KEY);
  } catch {
    return null;
  }

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<AuthSession>;
    if (!parsed || typeof parsed.authToken !== 'string' || !parsed.authToken.trim()) {
      return null;
    }

    return {
      authToken: parsed.authToken.trim(),
      refreshToken: typeof parsed.refreshToken === 'string' ? parsed.refreshToken.trim() : undefined,
      tokenType: typeof parsed.tokenType === 'string' ? parsed.tokenType.trim() : undefined,
      expiresIn: typeof parsed.expiresIn === 'number' ? parsed.expiresIn : undefined,
    };
  } catch {
    return null;
  }
}

export function writeAuthSession(session: AuthSession) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ignore blocked or full browser storage so auth bootstrap can keep running.
  }
}

export function clearAuthSession() {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(AUTH_SESSION_STORAGE_KEY);
  } catch {
    // Ignore blocked browser storage during sign-out cleanup.
  }
}

export { AUTH_SESSION_STORAGE_KEY };
