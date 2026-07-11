import type {
  StorageDeleteRequest,
  StorageDeleteResult,
  StorageGetTextRequest,
  StorageGetTextResult,
  StorageListKeysRequest,
  StorageListKeysResult,
  StoragePlatformAPI,
  StoragePlatformInfo,
  StoragePutTextRequest,
  StoragePutTextResult,
} from './contracts/storage.ts';
import { resolveBrowserStorage } from './safeBrowserStorage.ts';

const STORAGE_KEY_PREFIX = 'sdkwork-claw:storage';
const WEB_PROFILE_ID = 'web-local';
const WEB_NAMESPACE = 'sdkwork-claw';
const fallbackStorage = new Map<string, string>();

function getStorageAdapter() {
  const browserStorage = resolveBrowserStorage('localStorage');

  if (!browserStorage) {
    return {
      getItem: (key: string) => fallbackStorage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        fallbackStorage.set(key, value);
      },
      removeItem: (key: string) => {
        fallbackStorage.delete(key);
      },
      key: (index: number) => Array.from(fallbackStorage.keys())[index] ?? null,
      get length() {
        return fallbackStorage.size;
      },
    };
  }

  return {
    getItem: (key: string) => {
      try {
        return browserStorage.getItem(key) ?? fallbackStorage.get(key) ?? null;
      } catch {
        return fallbackStorage.get(key) ?? null;
      }
    },
    setItem: (key: string, value: string) => {
      fallbackStorage.set(key, value);
      try {
        browserStorage.setItem(key, value);
      } catch {
        // Keep the fallback value authoritative for this browser session.
      }
    },
    removeItem: (key: string) => {
      fallbackStorage.delete(key);
      try {
        browserStorage.removeItem(key);
      } catch {
        // Ignore blocked browser storage cleanup.
      }
    },
    key: (index: number) => {
      const keys = new Set(fallbackStorage.keys());
      try {
        for (let storageIndex = 0; storageIndex < browserStorage.length; storageIndex += 1) {
          const key = browserStorage.key(storageIndex);
          if (key) {
            keys.add(key);
          }
        }
      } catch {
        // Fall back to the in-memory key set.
      }
      return Array.from(keys)[index] ?? null;
    },
    get length() {
      const keys = new Set(fallbackStorage.keys());
      try {
        for (let storageIndex = 0; storageIndex < browserStorage.length; storageIndex += 1) {
          const key = browserStorage.key(storageIndex);
          if (key) {
            keys.add(key);
          }
        }
      } catch {
        // Fall back to the in-memory key set.
      }
      return keys.size;
    },
  };
}

function normalizeText(value: string | null | undefined, fallback: string) {
  const next = value?.trim();
  return next && next.length > 0 ? next : fallback;
}

function normalizeRequiredText(label: string, value: string) {
  const next = value.trim();
  if (next.length === 0) {
    throw new Error(`${label} is required.`);
  }

  return next;
}

function storageKey(profileId: string, namespace: string, key: string) {
  return `${STORAGE_KEY_PREFIX}:${profileId}:${namespace}:${key}`;
}

function resolveProfileId(profileId?: string | null) {
  return normalizeText(profileId, WEB_PROFILE_ID);
}

function resolveNamespace(namespace?: string | null) {
  return normalizeText(namespace, WEB_NAMESPACE);
}

function createInfo(): StoragePlatformInfo {
  return {
    activeProfileId: WEB_PROFILE_ID,
    rootDir: 'browser://localStorage',
    providers: [
      {
        id: 'browser-local-storage',
        kind: 'localFile',
        label: 'Browser Local Storage',
        availability: 'ready',
        requiresConfiguration: false,
        capabilities: {
          durable: true,
          structured: true,
          queryable: false,
          transactional: false,
          remote: false,
        },
      },
    ],
    profiles: [
      {
        id: WEB_PROFILE_ID,
        label: 'Browser Local Storage',
        provider: 'localFile',
        active: true,
        availability: 'ready',
        namespace: WEB_NAMESPACE,
        readOnly: false,
        connectionConfigured: false,
        databaseConfigured: false,
        endpointConfigured: false,
      },
    ],
  };
}

export class WebStoragePlatform implements StoragePlatformAPI {
  async getStorageInfo(): Promise<StoragePlatformInfo> {
    return createInfo();
  }

  async getText(request: StorageGetTextRequest): Promise<StorageGetTextResult> {
    const profileId = resolveProfileId(request.profileId);
    const namespace = resolveNamespace(request.namespace);
    const key = normalizeRequiredText('storage key', request.key);
    const value = getStorageAdapter().getItem(storageKey(profileId, namespace, key));

    return {
      profileId,
      namespace,
      key,
      value,
    };
  }

  async putText(request: StoragePutTextRequest): Promise<StoragePutTextResult> {
    const profileId = resolveProfileId(request.profileId);
    const namespace = resolveNamespace(request.namespace);
    const key = normalizeRequiredText('storage key', request.key);
    getStorageAdapter().setItem(storageKey(profileId, namespace, key), request.value);

    return {
      profileId,
      namespace,
      key,
    };
  }

  async delete(request: StorageDeleteRequest): Promise<StorageDeleteResult> {
    const profileId = resolveProfileId(request.profileId);
    const namespace = resolveNamespace(request.namespace);
    const key = normalizeRequiredText('storage key', request.key);
    const adapter = getStorageAdapter();
    const targetKey = storageKey(profileId, namespace, key);
    const existed = adapter.getItem(targetKey) !== null;
    adapter.removeItem(targetKey);

    return {
      profileId,
      namespace,
      key,
      existed,
    };
  }

  async listKeys(request: StorageListKeysRequest = {}): Promise<StorageListKeysResult> {
    const profileId = resolveProfileId(request.profileId);
    const namespace = resolveNamespace(request.namespace);
    const adapter = getStorageAdapter();
    const prefix = `${STORAGE_KEY_PREFIX}:${profileId}:${namespace}:`;
    const keys: string[] = [];

    for (let index = 0; index < adapter.length; index += 1) {
      const rawKey = adapter.key(index);
      if (!rawKey || !rawKey.startsWith(prefix)) {
        continue;
      }

      keys.push(rawKey.slice(prefix.length));
    }

    keys.sort((left, right) => left.localeCompare(right));

    return {
      profileId,
      namespace,
      keys,
    };
  }
}
