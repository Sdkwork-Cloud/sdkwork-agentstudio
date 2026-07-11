import assert from 'node:assert/strict';
import { groupChatMessagesForDisplay } from './chatMessageGroups.ts';

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
  'groupChatMessagesForDisplay groups consecutive messages with the same role',
  () => {
    assert.deepEqual(
      groupChatMessagesForDisplay([
        { role: 'assistant', content: 'A1' },
        { role: 'assistant', content: 'A2' },
        { role: 'tool', content: 'T1' },
        { role: 'user', content: 'U1' },
        { role: 'user', content: 'U2' },
      ]),
      [
        {
          role: 'assistant',
          items: [
            { index: 0, message: { role: 'assistant', content: 'A1' } },
            { index: 1, message: { role: 'assistant', content: 'A2' } },
          ],
        },
        {
          role: 'tool',
          items: [{ index: 2, message: { role: 'tool', content: 'T1' } }],
        },
        {
          role: 'user',
          senderLabel: null,
          items: [
            { index: 3, message: { role: 'user', content: 'U1' } },
            { index: 4, message: { role: 'user', content: 'U2' } },
          ],
        },
      ],
    );
  },
);

await runTest(
  'groupChatMessagesForDisplay keeps separated blocks when the same role is interrupted',
  () => {
    assert.deepEqual(
      groupChatMessagesForDisplay([
        { role: 'assistant', content: 'A1' },
        { role: 'user', content: 'U1' },
        { role: 'assistant', content: 'A2' },
      ]).map((group) => ({
        role: group.role,
        indices: group.items.map((item) => item.index),
      })),
      [
        { role: 'assistant', indices: [0] },
        { role: 'user', indices: [1] },
        { role: 'assistant', indices: [2] },
      ],
    );
  },
);

await runTest(
  'groupChatMessagesForDisplay splits consecutive user messages when sender labels differ',
  () => {
    assert.deepEqual(
      groupChatMessagesForDisplay([
        { role: 'user', senderLabel: 'Iris', content: 'U1' },
        { role: 'user', senderLabel: 'Iris', content: 'U2' },
        { role: 'user', senderLabel: 'Joaquin', content: 'U3' },
        { role: 'user', senderLabel: null, content: 'U4' },
      ]).map((group) => ({
        role: group.role,
        senderLabel: group.senderLabel ?? null,
        indices: group.items.map((item) => item.index),
      })),
      [
        { role: 'user', senderLabel: 'Iris', indices: [0, 1] },
        { role: 'user', senderLabel: 'Joaquin', indices: [2] },
        { role: 'user', senderLabel: null, indices: [3] },
      ],
    );
  },
);

await runTest(
  'groupChatMessagesForDisplay orders authoritative sequence messages before grouping',
  () => {
    assert.deepEqual(
      groupChatMessagesForDisplay([
        { role: 'assistant', content: 'A2', timestamp: 30, seq: 2 } as {
          role: string;
          content: string;
          timestamp: number;
          seq: number;
        },
        { role: 'user', content: 'U1', timestamp: 20, seq: 1 } as {
          role: string;
          content: string;
          timestamp: number;
          seq: number;
        },
        { role: 'assistant', content: 'A3', timestamp: 40, seq: 3 } as {
          role: string;
          content: string;
          timestamp: number;
          seq: number;
        },
      ]).map((group) => ({
        role: group.role,
        contents: group.items.map((item) => item.message.content),
      })),
      [
        { role: 'user', contents: ['U1'] },
        { role: 'assistant', contents: ['A2', 'A3'] },
      ],
    );
  },
);
