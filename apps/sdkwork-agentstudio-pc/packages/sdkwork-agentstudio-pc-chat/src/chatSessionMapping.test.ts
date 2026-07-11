import assert from 'node:assert/strict';
import { mapChatSession, mapStudioConversation } from './chatSessionMapping.ts';
import type { ChatSession } from './store/useChatStore';

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
  'mapChatSession persists the conversation title field from the first user message instead of id/date metadata',
  () => {
    const session: ChatSession = {
      id: 'session-direct-title',
      title: 'session-direct-title(2026-04-26)',
      titleSource: 'default',
      createdAt: 100,
      updatedAt: 120,
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Repair the stored session title before the sidebar reads conversations',
          timestamp: 120,
        },
      ],
      model: 'openai/gpt-4.1',
      transport: 'local',
      sessionKind: 'direct',
    };

    const record = mapChatSession(session);

    assert.equal(
      record.title,
      'Repair the stored session title before the sidebar reads conversations',
    );
    assert.equal(
      record.kernelSession?.title,
      'Repair the stored session title before the sidebar reads conversations',
    );
    assert.equal(
      (record.kernelSession?.nativeMetadata as Record<string, unknown> | null | undefined)
        ?.__agentstudioTitleSource,
      'firstUser',
    );
  },
);

await runTest(
  'mapStudioConversation reads an empty database title from the first user message and caps it at 300 characters',
  () => {
    const firstUserMessage = `${'A'.repeat(160)} ${'B'.repeat(160)} ${'C'.repeat(40)}`;
    const session = mapStudioConversation({
      id: 'session-empty-title',
      title: '',
      primaryInstanceId: 'managed-openclaw-primary',
      participantInstanceIds: ['managed-openclaw-primary'],
      createdAt: 100,
      updatedAt: 120,
      messageCount: 2,
      lastMessagePreview: 'Assistant reply must not become the title',
      kernelSession: null,
      messages: [
        {
          id: 'msg-user-1',
          conversationId: 'session-empty-title',
          role: 'user',
          content: firstUserMessage,
          createdAt: 105,
          updatedAt: 105,
          status: 'complete',
        },
        {
          id: 'msg-assistant-1',
          conversationId: 'session-empty-title',
          role: 'assistant',
          content: 'Assistant reply must not become the title',
          createdAt: 120,
          updatedAt: 120,
          status: 'complete',
        },
      ],
    });

    assert.equal(session.title.length, 300);
    assert.equal(session.title, `${firstUserMessage.slice(0, 297).trimEnd()}...`);
    assert.equal(session.titleSource, 'firstUser');
  },
);
