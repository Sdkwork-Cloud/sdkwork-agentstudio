import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function runTest(name: string, callback: () => void | Promise<void>) {
  return Promise.resolve()
    .then(callback)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

const source = readFileSync(new URL('../pages/Chat.tsx', import.meta.url), 'utf8');

await runTest(
  'Chat no longer renders a dedicated in-page header rail',
  () => {
    assert.doesNotMatch(source, /<header className="z-10 flex min-h-\[3\.75rem\]/);
    assert.doesNotMatch(source, /border-b border-zinc-200 bg-white\/80/);
    assert.doesNotMatch(source, /className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3"/);
    assert.doesNotMatch(source, /className="mt-0\.5 flex min-w-0 flex-wrap items-center gap-x-1\.5 gap-y-0\.5 text-\[11px\] text-zinc-500 dark:text-zinc-400"/);
  },
);
