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

const source = readFileSync(new URL('./useChatAutoScroll.ts', import.meta.url), 'utf8');

await runTest(
  'useChatAutoScroll tracks message identity and content changes instead of relying only on the messages array reference',
  () => {
    assert.match(source, /resolveChatMessageScrollSignature/);
    assert.match(source, /const messageScrollSignature = resolveChatMessageScrollSignature\(messages\);/);
    assert.match(source, /\[\s*isBusy,\s*messageScrollSignature\s*\]/);
    assert.doesNotMatch(source, /\[\s*isBusy,\s*messages\s*\]/);
  },
);
