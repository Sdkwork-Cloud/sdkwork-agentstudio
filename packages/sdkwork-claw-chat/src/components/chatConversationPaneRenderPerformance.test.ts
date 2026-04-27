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

const source = readFileSync(new URL('./ChatConversationPane.tsx', import.meta.url), 'utf8');

await runTest(
  'ChatConversationPane omits empty message payload arrays so memoized messages do not rerender during streaming updates',
  () => {
    assert.match(
      source,
      /attachments=\{message\.attachments\.length > 0 \? message\.attachments : undefined\}/,
    );
    assert.match(
      source,
      /notices=\{message\.notices\.length > 0 \? message\.notices : undefined\}/,
    );
    assert.match(
      source,
      /toolCards=\{message\.toolCards\.length > 0 \? message\.toolCards : undefined\}/,
    );
  },
);
