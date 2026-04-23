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

const source = readFileSync(new URL('./useChatMessageDisplayState.ts', import.meta.url), 'utf8');

await runTest(
  'useChatMessageDisplayState derives empty-session loading from the selected session history state instead of gateway-only authority checks',
  () => {
    assert.match(source, /const isHistoryLoading = displaySession\?\.historyState === 'loading';/);
    assert.match(
      source,
      /resolveChatConversationBodyState\(\{\s*messageCount: activeMessages.length,\s*isHistoryLoading,\s*\}\)/s,
    );
    assert.doesNotMatch(source, /authorityKind === 'gateway'/);
    assert.doesNotMatch(source, /isGatewayHistoryLoading/);
  },
);
