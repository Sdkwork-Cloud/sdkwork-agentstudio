import assert from 'node:assert/strict';
import {
  orderChatMessagesForDisplay,
  resolveLatestChatMessageTimestamp,
} from './chatMessageOrdering.ts';

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
  'orderChatMessagesForDisplay returns the original array when messages are already display ordered',
  () => {
    const orderedMessages = [
      { role: 'user', content: 'first', seq: 1, timestamp: 10 },
      { role: 'assistant', content: 'second', seq: 2, timestamp: 20 },
      { role: 'assistant', content: 'third', seq: 3, timestamp: 30 },
    ];

    assert.equal(orderChatMessagesForDisplay(orderedMessages), orderedMessages);
  },
);

await runTest(
  'orderChatMessagesForDisplay still returns an ordered copy for out-of-order messages',
  () => {
    const outOfOrderMessages = [
      { role: 'assistant', content: 'second', seq: 2, timestamp: 20 },
      { role: 'user', content: 'first', seq: 1, timestamp: 10 },
      { role: 'assistant', content: 'third', seq: 3, timestamp: 30 },
    ];

    const orderedMessages = orderChatMessagesForDisplay(outOfOrderMessages);

    assert.notEqual(orderedMessages, outOfOrderMessages);
    assert.deepEqual(
      orderedMessages.map((message) => message.content),
      ['first', 'second', 'third'],
    );
  },
);

await runTest(
  'resolveLatestChatMessageTimestamp handles very large transcripts without spreading timestamps as call arguments',
  () => {
    const messages = Array.from({ length: 300_000 }, (_, index) => ({
      timestamp: index,
    }));

    assert.equal(resolveLatestChatMessageTimestamp(messages), 299_999);
  },
);
