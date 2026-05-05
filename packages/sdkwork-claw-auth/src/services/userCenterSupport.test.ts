import assert from 'node:assert/strict';
import {
  createUserCenterStoragePlan,
  createUserCenterTokenStore,
} from './userCenterSupport.ts';

function installThrowingSessionStorage() {
  const previousWindow = (globalThis as typeof globalThis & { window?: unknown }).window;

  (globalThis as typeof globalThis & { window?: unknown }).window = {
    get sessionStorage() {
      throw new DOMException('sessionStorage is blocked', 'SecurityError');
    },
  };

  return () => {
    (globalThis as typeof globalThis & { window?: unknown }).window = previousWindow;
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

runTest('user-center support token store tolerates blocked browser sessionStorage', () => {
  const restore = installThrowingSessionStorage();
  const tokenStore = createUserCenterTokenStore(createUserCenterStoragePlan('claw-studio'));

  try {
    assert.deepEqual(tokenStore.readTokenBundle(), {
      authToken: undefined,
      accessToken: undefined,
      refreshToken: undefined,
    });
    assert.doesNotThrow(() => {
      tokenStore.persistTokenBundle({
        authToken: 'auth-token',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      tokenStore.clearTokenBundle();
    });
  } finally {
    restore();
  }
});
