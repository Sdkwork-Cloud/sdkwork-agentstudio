export type BrowserStorageName = 'localStorage' | 'sessionStorage';

function isStorageLike(value: unknown): value is Storage {
  return Boolean(
    value
    && typeof value === 'object'
    && typeof (value as Storage).getItem === 'function'
    && typeof (value as Storage).setItem === 'function'
    && typeof (value as Storage).removeItem === 'function',
  );
}

function readGlobalStorage(storageName: BrowserStorageName): Storage | null {
  try {
    const candidate = (globalThis as unknown as Record<BrowserStorageName, unknown>)[storageName];
    return isStorageLike(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

function readWindowStorage(storageName: BrowserStorageName): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const candidate = (window as unknown as Record<BrowserStorageName, unknown>)[storageName];
    return isStorageLike(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

export function resolveBrowserStorage(storageName: BrowserStorageName): Storage | null {
  return readGlobalStorage(storageName) ?? readWindowStorage(storageName);
}
