import assert from 'node:assert/strict';
import {
  createUserCenterStoragePlan,
  createUserCenterTokenStore,
} from './userCenterStorage.ts';

function installThrowingBrowserStorages() {
  const previousSessionStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const previousLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    get() {
      throw new DOMException('sessionStorage is blocked', 'SecurityError');
    },
  });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new DOMException('localStorage is blocked', 'SecurityError');
    },
  });

  return () => {
    if (previousSessionStorage) {
      Object.defineProperty(globalThis, 'sessionStorage', previousSessionStorage);
    } else {
      delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
    }

    if (previousLocalStorage) {
      Object.defineProperty(globalThis, 'localStorage', previousLocalStorage);
    } else {
      delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  };
}

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('user-center token storage ignores blocked browser storages during auth bootstrap', () => {
  const restore = installThrowingBrowserStorages();
  const store = createUserCenterTokenStore(createUserCenterStoragePlan('claw-studio'), {
    legacySessionTokenKeys: ['legacy-session'],
  });

  try {
    assert.deepEqual(store.readTokenBundle(), {});
    assert.doesNotThrow(() => {
      store.persistTokenBundle({
        authToken: 'auth-token',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });
    assert.doesNotThrow(() => {
      store.clearTokenBundle();
    });
  } finally {
    restore();
  }
});
