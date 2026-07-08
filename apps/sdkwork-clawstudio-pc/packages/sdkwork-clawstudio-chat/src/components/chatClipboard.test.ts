import assert from 'node:assert/strict';
import { copyChatTextToClipboard } from './chatClipboard.ts';

function runTest(name: string, fn: () => Promise<void> | void) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

async function withNavigatorClipboard(
  clipboard: { writeText?: (text: string) => Promise<void> } | undefined,
  fn: () => Promise<void>,
) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: clipboard ? { clipboard } : {},
  });

  try {
    await fn();
  } finally {
    if (descriptor) {
      Object.defineProperty(globalThis, 'navigator', descriptor);
    } else {
      delete (globalThis as typeof globalThis & { navigator?: unknown }).navigator;
    }
  }
}

await runTest('copyChatTextToClipboard reports success only after the clipboard write resolves', async () => {
  const writes: string[] = [];
  await withNavigatorClipboard(
    {
      async writeText(text) {
        writes.push(text);
      },
    },
    async () => {
      assert.equal(await copyChatTextToClipboard('hello'), true);
    },
  );

  assert.deepEqual(writes, ['hello']);
});

await runTest('copyChatTextToClipboard reports false when clipboard access fails', async () => {
  await withNavigatorClipboard(
    {
      async writeText() {
        throw new Error('permission denied');
      },
    },
    async () => {
      assert.equal(await copyChatTextToClipboard('hello'), false);
    },
  );
});

await runTest('copyChatTextToClipboard reports false when Clipboard API is unavailable', async () => {
  await withNavigatorClipboard(undefined, async () => {
    assert.equal(await copyChatTextToClipboard('hello'), false);
  });
});
