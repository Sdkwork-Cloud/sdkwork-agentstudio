import assert from 'node:assert/strict';
import { resolveChatSidebarSessionTitleText } from './chatSidebarSessionTitleText.ts';

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
  'resolveChatSidebarSessionTitleText derives the session row title from the first user message instead of item id or date metadata',
  () => {
    const firstUserMessage = `${'A'.repeat(150)} ${'B'.repeat(150)} ${'C'.repeat(40)}`;
    const title = resolveChatSidebarSessionTitleText({
      itemDisplayTitle: '2026-04-26 10:58',
      session: {
        id: 'thread:agent-studio:20260426105830',
        title: '2026-04-26 10:58',
        messages: [
          {
            role: 'user',
            content: firstUserMessage,
          },
        ],
        lastMessagePreview: 'Assistant reply must not become the title',
      },
    });

    assert.equal(title.length, 300);
    assert.equal(title, `${firstUserMessage.slice(0, 297).trimEnd()}...`);
    assert.notEqual(title, '2026-04-26 10:58');
    assert.notEqual(title, 'thread:agent-studio:20260426105830');
  },
);

await runTest(
  'resolveChatSidebarSessionTitleText keeps readable presentation titles only when the session record is unavailable',
  () => {
    assert.equal(
      resolveChatSidebarSessionTitleText({
        itemDisplayTitle: 'Manual migration checklist',
        session: null,
      }),
      'Manual migration checklist',
    );

    assert.equal(
      resolveChatSidebarSessionTitleText({
        itemDisplayTitle: '20260426105830',
        session: null,
      }),
      'New Conversation',
    );
  },
);
