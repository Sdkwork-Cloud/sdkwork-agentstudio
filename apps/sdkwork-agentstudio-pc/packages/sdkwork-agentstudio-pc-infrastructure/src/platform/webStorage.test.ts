import assert from 'node:assert/strict';
import { WebStoragePlatform } from './webStorage.ts';

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

async function runTest(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('web storage platform keeps working with an in-memory fallback when localStorage is blocked', async () => {
  const restore = installThrowingLocalStorage();
  const platform = new WebStoragePlatform();

  try {
    await platform.putText({
      namespace: 'startup',
      key: 'probe',
      value: 'ready',
    });

    assert.deepEqual(await platform.getText({ namespace: 'startup', key: 'probe' }), {
      profileId: 'web-local',
      namespace: 'startup',
      key: 'probe',
      value: 'ready',
    });
    assert.deepEqual(await platform.listKeys({ namespace: 'startup' }), {
      profileId: 'web-local',
      namespace: 'startup',
      keys: ['probe'],
    });
  } finally {
    restore();
  }
});
