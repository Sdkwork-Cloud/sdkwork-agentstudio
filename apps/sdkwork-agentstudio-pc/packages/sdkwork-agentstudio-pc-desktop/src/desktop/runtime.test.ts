import assert from 'node:assert/strict';
import test from 'node:test';

type GlobalWithWindow = typeof globalThis & {
  window?: Record<string, unknown>;
  isTauri?: boolean;
};

function restoreProperty(
  target: object,
  key: string,
  descriptor: PropertyDescriptor | undefined,
) {
  if (descriptor) {
    Object.defineProperty(target, key, descriptor);
    return;
  }

  delete (target as Record<string, unknown>)[key];
}

test('isTauriRuntime treats the injected Tauri internals as a desktop runtime signal', async () => {
  const globals = globalThis as GlobalWithWindow;
  const windowDescriptor = Object.getOwnPropertyDescriptor(globals, 'window');
  const isTauriDescriptor = Object.getOwnPropertyDescriptor(globals, 'isTauri');

  Object.defineProperty(globals, 'window', {
    configurable: true,
    value: {
      __TAURI_INTERNALS__: {
        invoke() {
          return Promise.resolve(null);
        },
      },
    },
  });
  delete globals.isTauri;

  try {
    const { isTauriRuntime } = await import('./runtime.ts');
    assert.equal(isTauriRuntime(), true);
  } finally {
    restoreProperty(globals, 'window', windowDescriptor);
    restoreProperty(globals, 'isTauri', isTauriDescriptor);
  }
});
