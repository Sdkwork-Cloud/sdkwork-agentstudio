export interface UserCenterStoragePlan {
  namespace: string;
  authTokenKey: string;
  accessTokenKey: string;
  refreshTokenKey: string;
}

export interface UserCenterTokenBundle {
  authToken?: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface CreateUserCenterTokenStoreOptions {
  legacySessionTokenKeys?: readonly string[];
  storage?: Storage;
}

function normalizeTokenValue(value?: string | null): string | undefined {
  const normalized = (value || '').trim();
  return normalized || undefined;
}

function hasStorage(value: unknown): value is Storage {
  return Boolean(
    value
    && typeof value === 'object'
    && typeof (value as Storage).getItem === 'function'
    && typeof (value as Storage).setItem === 'function'
    && typeof (value as Storage).removeItem === 'function',
  );
}

function resolveSessionStorage(explicitStorage?: Storage): Storage | null {
  if (hasStorage(explicitStorage)) {
    return explicitStorage;
  }

  if (hasStorage(globalThis.sessionStorage)) {
    return globalThis.sessionStorage;
  }

  if (typeof window !== 'undefined' && hasStorage(window.sessionStorage)) {
    return window.sessionStorage;
  }

  return null;
}

function resolveLocalStorage(): Storage | null {
  if (hasStorage(globalThis.localStorage)) {
    return globalThis.localStorage;
  }

  if (typeof window !== 'undefined' && hasStorage(window.localStorage)) {
    return window.localStorage;
  }

  return null;
}

function readStorageValue(storage: Storage | null, key: string): string | undefined {
  if (!storage) {
    return undefined;
  }

  try {
    return normalizeTokenValue(storage.getItem(key));
  } catch {
    return undefined;
  }
}

function removeStorageValue(storage: Storage | null, key: string): void {
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage failures so auth bootstrap can continue in constrained runtimes.
  }
}

function writeStorageValue(storage: Storage | null, key: string, value?: string): void {
  if (!storage) {
    return;
  }

  const normalized = normalizeTokenValue(value);

  try {
    if (normalized) {
      storage.setItem(key, normalized);
      return;
    }

    storage.removeItem(key);
  } catch {
    // Ignore storage failures so auth bootstrap can continue in constrained runtimes.
  }
}

function readLegacyTokenBundle(
  legacySessionTokenKeys: readonly string[],
  storages: ReadonlyArray<Storage | null>,
): UserCenterTokenBundle {
  for (const storage of storages) {
    if (!storage) {
      continue;
    }

    for (const key of legacySessionTokenKeys) {
      const raw = readStorageValue(storage, key);
      if (!raw) {
        continue;
      }

      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const authToken = normalizeTokenValue(
          typeof parsed.authToken === 'string' ? parsed.authToken : undefined,
        );
        const accessToken = normalizeTokenValue(
          typeof parsed.accessToken === 'string' ? parsed.accessToken : undefined,
        );
        const refreshToken = normalizeTokenValue(
          typeof parsed.refreshToken === 'string' ? parsed.refreshToken : undefined,
        );

        if (authToken || accessToken || refreshToken) {
          return {
            ...(authToken ? { authToken } : {}),
            ...(accessToken ? { accessToken } : {}),
            ...(refreshToken ? { refreshToken } : {}),
          };
        }
      } catch {
        return {
          authToken: raw,
        };
      }
    }
  }

  return {};
}

export function createUserCenterStoragePlan(namespace: string): UserCenterStoragePlan {
  const normalizedNamespace = namespace.trim();

  return Object.freeze({
    namespace: normalizedNamespace,
    authTokenKey: `${normalizedNamespace}.user-center.auth-token`,
    accessTokenKey: `${normalizedNamespace}.user-center.access-token`,
    refreshTokenKey: `${normalizedNamespace}.user-center.refresh-token`,
  });
}

export function createUserCenterTokenStore(
  storagePlan: UserCenterStoragePlan,
  options: CreateUserCenterTokenStoreOptions = {},
) {
  const legacySessionTokenKeys = options.legacySessionTokenKeys ?? [];

  return {
    readTokenBundle(): UserCenterTokenBundle {
      const sessionStorage = resolveSessionStorage(options.storage);
      const authToken = readStorageValue(sessionStorage, storagePlan.authTokenKey);
      const accessToken = readStorageValue(sessionStorage, storagePlan.accessTokenKey);
      const refreshToken = readStorageValue(sessionStorage, storagePlan.refreshTokenKey);

      if (authToken || accessToken || refreshToken) {
        return {
          ...(authToken ? { authToken } : {}),
          ...(accessToken ? { accessToken } : {}),
          ...(refreshToken ? { refreshToken } : {}),
        };
      }

      return readLegacyTokenBundle(legacySessionTokenKeys, [
        sessionStorage,
        resolveLocalStorage(),
      ]);
    },

    persistTokenBundle(bundle: UserCenterTokenBundle): void {
      const sessionStorage = resolveSessionStorage(options.storage);

      writeStorageValue(sessionStorage, storagePlan.authTokenKey, bundle.authToken);
      writeStorageValue(sessionStorage, storagePlan.accessTokenKey, bundle.accessToken);
      writeStorageValue(sessionStorage, storagePlan.refreshTokenKey, bundle.refreshToken);
    },

    clearTokenBundle(): void {
      const sessionStorage = resolveSessionStorage(options.storage);

      removeStorageValue(sessionStorage, storagePlan.authTokenKey);
      removeStorageValue(sessionStorage, storagePlan.accessTokenKey);
      removeStorageValue(sessionStorage, storagePlan.refreshTokenKey);
    },
  };
}
