export type BrowserStorageName = 'localStorage' | 'sessionStorage';

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'getItem' | 'setItem'>;

function isReadableStorage(value: unknown): value is ReadableStorage {
  return Boolean(
    value
    && typeof value === 'object'
    && typeof (value as Storage).getItem === 'function',
  );
}

function isWritableStorage(value: unknown): value is WritableStorage {
  return Boolean(
    isReadableStorage(value)
    && typeof (value as Storage).setItem === 'function',
  );
}

export function resolveBrowserStorage(storageName: BrowserStorageName): WritableStorage | null {
  try {
    const candidate = (globalThis as unknown as Record<BrowserStorageName, unknown>)[storageName];
    if (isWritableStorage(candidate)) {
      return candidate;
    }
  } catch {
    // Fall through to the window lookup below.
  }

  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const candidate = (window as unknown as Record<BrowserStorageName, unknown>)[storageName];
    return isWritableStorage(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

export function readBrowserStorageValue(
  storage: ReadableStorage | null | undefined,
  key: string,
): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeBrowserStorageValue(
  storage: WritableStorage | null | undefined,
  key: string,
  value: string,
): void {
  try {
    storage?.setItem(key, value);
  } catch {
    // Ignore blocked browser storage; cookie persistence remains available.
  }
}
