import assert from 'node:assert/strict';
import { createPersistedSimpleStore } from './simpleStore.ts';

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

runTest('persisted simple stores keep in-memory startup state when localStorage is blocked', () => {
  const restore = installThrowingLocalStorage();

  try {
    const store = createPersistedSimpleStore(
      () => ({
        count: 1,
      }),
      {
        name: 'blocked-storage-store',
      },
    );

    assert.deepEqual(store.getState(), { count: 1 });
    assert.doesNotThrow(() => {
      store.setState({ count: 2 });
      store.persist.clearStorage();
      store.persist.rehydrate();
    });
    assert.deepEqual(store.getState(), { count: 2 });
  } finally {
    restore();
  }
});
