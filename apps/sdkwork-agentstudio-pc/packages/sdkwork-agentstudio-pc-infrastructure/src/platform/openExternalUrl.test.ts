import assert from 'node:assert/strict';
import { openExternalUrl } from './openExternalUrl.ts';

async function runTest(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('openExternalUrl uses the host external opener when available', async () => {
  const calls: string[] = [];

  await openExternalUrl('https://example.com/feishu', {
    openExternal: async (url) => {
      calls.push(url);
    },
    openWindow: () => {
      throw new Error('window fallback should not run');
    },
  });

  assert.deepEqual(calls, ['https://example.com/feishu']);
});

await runTest('openExternalUrl falls back to window.open when the host opener rejects', async () => {
  const calls: string[] = [];

  await openExternalUrl('https://example.com/qq', {
    openExternal: async () => {
      throw new Error('desktop bridge unavailable');
    },
    openWindow: (url, target, features) => {
      calls.push(`${url}|${target}|${features}`);
      return null;
    },
  });

  assert.deepEqual(calls, ['https://example.com/qq|_blank|noopener,noreferrer']);
});
