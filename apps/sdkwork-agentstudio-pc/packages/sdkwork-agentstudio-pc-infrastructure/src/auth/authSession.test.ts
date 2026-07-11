import assert from 'node:assert/strict';
import {
  clearAuthSession,
  readAuthSession,
  writeAuthSession,
} from './authSession.ts';

function installThrowingLocalStorage() {
  const previousDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new DOMException('localStorage is blocked', 'SecurityError');
    },
  });

  return () => {
    if (previousDescriptor) {
      Object.defineProperty(globalThis, 'localStorage', previousDescriptor);
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

runTest('auth session storage degrades when browser localStorage access is blocked', () => {
  const restore = installThrowingLocalStorage();

  try {
    assert.equal(readAuthSession(), null);
    assert.doesNotThrow(() => {
      writeAuthSession({ authToken: 'token' });
    });
    assert.doesNotThrow(() => {
      clearAuthSession();
    });
  } finally {
    restore();
  }
});
