import assert from 'node:assert/strict';
import { resolveChatConversationBodyState } from './chatConversationBodyState.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest(
  'resolveChatConversationBodyState shows a loading state when history is still being fetched for an empty session',
  () => {
    assert.deepEqual(
      resolveChatConversationBodyState({
        messageCount: 0,
        isHistoryLoading: true,
      }),
      {
        mode: 'loading',
      },
    );
  },
);

await runTest(
  'resolveChatConversationBodyState shows the empty state when there are no messages and no history request in flight',
  () => {
    assert.deepEqual(
      resolveChatConversationBodyState({
        messageCount: 0,
        isHistoryLoading: false,
      }),
      {
        mode: 'empty',
      },
    );
  },
);

await runTest(
  'resolveChatConversationBodyState shows messages as soon as the active session has message content',
  () => {
    assert.deepEqual(
      resolveChatConversationBodyState({
        messageCount: 2,
        isHistoryLoading: true,
      }),
      {
        mode: 'messages',
      },
    );
  },
);
