import assert from 'node:assert/strict';

import {
  clearAppSdkSessionTokens,
  persistAppSdkSessionTokens,
  readAppSdkSessionTokens,
  resetAppSdkClient,
} from '../packages/sdkwork-agentstudio-pc-core/src/sdk/useAppSdkClient.ts';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key) {
      return store.get(key) ?? null;
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key) {
      store.delete(key);
    },
    setItem(key, value) {
      store.set(key, value);
    },
  };
}

function installBrowserStorage(localStorage: Storage, sessionStorage: Storage): void {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: localStorage,
  });
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: sessionStorage,
  });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage,
      sessionStorage,
    },
  });
}

function prepareRuntime() {
  const localStorage = createMemoryStorage();
  const sessionStorage = createMemoryStorage();
  installBrowserStorage(localStorage, sessionStorage);
  resetAppSdkClient();
  clearAppSdkSessionTokens();
  return {
    localStorage,
    sessionStorage,
  };
}

async function runTest(name: string, test: () => Promise<void> | void) {
  try {
    await test();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest(
  'claw core persists app sdk auth tokens into canonical core storage and the claw user-center token store',
  () => {
    const storage = prepareRuntime();

    persistAppSdkSessionTokens({
      accessToken: 'owner-access-token',
      authToken: 'Bearer auth-token',
      refreshToken: 'refresh-token',
    });

    assert.equal(
      storage.localStorage.getItem('sdkwork.core.pc-react.auth-token'),
      'auth-token',
    );
    assert.equal(
      storage.localStorage.getItem('sdkwork.core.pc-react.access-token'),
      'owner-access-token',
    );
    assert.equal(
      storage.localStorage.getItem('sdkwork.core.pc-react.refresh-token'),
      'refresh-token',
    );
    assert.equal(
      storage.sessionStorage.getItem('agent-studio.user-center.auth-token'),
      'auth-token',
    );
    assert.equal(
      storage.sessionStorage.getItem('agent-studio.user-center.access-token'),
      'owner-access-token',
    );
    assert.equal(
      storage.sessionStorage.getItem('agent-studio.user-center.refresh-token'),
      'refresh-token',
    );
    assert.equal(storage.localStorage.getItem('agent-studio-auth-session'), null);
  },
);

await runTest(
  'claw core reads app sdk auth tokens back from the claw user-center token store when runtime storage is empty',
  () => {
    const storage = prepareRuntime();

    storage.sessionStorage.setItem('agent-studio.user-center.auth-token', 'user-center-auth');
    storage.sessionStorage.setItem(
      'agent-studio.user-center.access-token',
      'user-center-access',
    );
    storage.sessionStorage.setItem(
      'agent-studio.user-center.refresh-token',
      'user-center-refresh',
    );

    const tokens = readAppSdkSessionTokens();

    assert.equal(tokens.authToken, 'user-center-auth');
    assert.equal(tokens.accessToken, 'user-center-access');
    assert.equal(tokens.refreshToken, 'user-center-refresh');
  },
);
