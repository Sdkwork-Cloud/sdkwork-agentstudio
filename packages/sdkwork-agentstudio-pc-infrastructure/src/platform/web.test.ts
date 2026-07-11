import assert from 'node:assert/strict';
import { WebPlatform } from './web.ts';

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

await runTest('web platform storage uses an in-memory fallback when browser storage is blocked', async () => {
  const restore = installThrowingLocalStorage();
  const platform = new WebPlatform();

  try {
    const firstDeviceId = await platform.getDeviceId();
    const secondDeviceId = await platform.getDeviceId();

    assert.match(firstDeviceId, /^web-device-/);
    assert.equal(secondDeviceId, firstDeviceId);

    await platform.setStorage('startup-key', 'startup-value');
    assert.equal(await platform.getStorage('startup-key'), 'startup-value');
  } finally {
    restore();
  }
});
