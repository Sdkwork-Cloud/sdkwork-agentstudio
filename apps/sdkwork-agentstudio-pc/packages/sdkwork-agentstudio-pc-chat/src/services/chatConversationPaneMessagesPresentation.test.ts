import assert from 'node:assert/strict';
import { presentChatConversationPaneMessageGroups } from './chatConversationPaneMessagesPresentation.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const groupTimeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
});

await runTest(
  'presentChatConversationPaneMessageGroups does not mark a stale assistant message as typing for a newer active run',
  () => {
    const [group] = presentChatConversationPaneMessageGroups({
      sessionId: 'session-a',
      messageGroups: [
        {
          role: 'assistant',
          items: [
            {
              index: 1,
              message: {
                role: 'assistant',
                status: 'complete',
                content: 'previous answer',
                timestamp: 20,
                runId: 'run-old',
                senderLabel: null,
                nativeMetadata: null,
                attachments: [],
                reasoning: null,
                toolCards: [],
                notices: [],
              },
            },
          ],
        },
      ],
      messageCount: 2,
      isActiveSessionGenerating: true,
      activeRunId: 'run-new',
      groupTimeFormatter,
      assistantLabel: 'Assistant',
      userLabel: 'You',
      toolLabel: 'Tool',
      systemLabel: 'System',
    });

    assert.equal(group?.items[0]?.isTyping, false);
  },
);

await runTest(
  'presentChatConversationPaneMessageGroups marks the assistant message for the active run as typing',
  () => {
    const [group] = presentChatConversationPaneMessageGroups({
      sessionId: 'session-a',
      messageGroups: [
        {
          role: 'assistant',
          items: [
            {
              index: 1,
              message: {
                role: 'assistant',
                status: 'streaming',
                content: 'current answer',
                timestamp: 20,
                runId: 'run-current',
                senderLabel: null,
                nativeMetadata: null,
                attachments: [],
                reasoning: null,
                toolCards: [],
                notices: [],
              },
            },
          ],
        },
      ],
      messageCount: 2,
      isActiveSessionGenerating: true,
      activeRunId: 'run-current',
      groupTimeFormatter,
      assistantLabel: 'Assistant',
      userLabel: 'You',
      toolLabel: 'Tool',
      systemLabel: 'System',
    });

    assert.equal(group?.items[0]?.isTyping, true);
  },
);

await runTest(
  'presentChatConversationPaneMessageGroups only marks the latest assistant message for an active run as typing',
  () => {
    const [group] = presentChatConversationPaneMessageGroups({
      sessionId: 'session-a',
      messageGroups: [
        {
          role: 'assistant',
          items: [
            {
              index: 1,
              message: {
                role: 'assistant',
                status: 'complete',
                content: 'earlier run output',
                timestamp: 20,
                runId: 'run-current',
                senderLabel: null,
                nativeMetadata: null,
                attachments: [],
                reasoning: null,
                toolCards: [],
                notices: [],
              },
            },
            {
              index: 2,
              message: {
                role: 'assistant',
                status: 'streaming',
                content: 'latest run output',
                timestamp: 30,
                runId: 'run-current',
                senderLabel: null,
                nativeMetadata: null,
                attachments: [],
                reasoning: null,
                toolCards: [],
                notices: [],
              },
            },
          ],
        },
      ],
      messageCount: 3,
      isActiveSessionGenerating: true,
      activeRunId: 'run-current',
      groupTimeFormatter,
      assistantLabel: 'Assistant',
      userLabel: 'You',
      toolLabel: 'Tool',
      systemLabel: 'System',
    });

    assert.deepEqual(
      group?.items.map((item) => item.isTyping),
      [false, true],
    );
  },
);

await runTest(
  'presentChatConversationPaneMessageGroups falls back to the latest streaming assistant when active run messages do not carry run ids yet',
  () => {
    const [group] = presentChatConversationPaneMessageGroups({
      sessionId: 'session-a',
      messageGroups: [
        {
          role: 'assistant',
          items: [
            {
              index: 1,
              message: {
                role: 'assistant',
                status: 'complete',
                content: 'previous answer',
                timestamp: 20,
                senderLabel: null,
                nativeMetadata: null,
                attachments: [],
                reasoning: null,
                toolCards: [],
                notices: [],
              },
            },
            {
              index: 2,
              message: {
                role: 'assistant',
                status: 'streaming',
                content: 'current answer',
                timestamp: 30,
                senderLabel: null,
                nativeMetadata: null,
                attachments: [],
                reasoning: null,
                toolCards: [],
                notices: [],
              },
            },
          ],
        },
      ],
      messageCount: 3,
      isActiveSessionGenerating: true,
      activeRunId: 'run-current',
      groupTimeFormatter,
      assistantLabel: 'Assistant',
      userLabel: 'You',
      toolLabel: 'Tool',
      systemLabel: 'System',
    });

    assert.deepEqual(
      group?.items.map((item) => item.isTyping),
      [false, true],
    );
  },
);

await runTest(
  'presentChatConversationPaneMessageGroups prefers a newer run-idless streaming assistant over an older active-run assistant',
  () => {
    const [group] = presentChatConversationPaneMessageGroups({
      sessionId: 'session-a',
      messageGroups: [
        {
          role: 'assistant',
          items: [
            {
              index: 1,
              message: {
                role: 'assistant',
                status: 'complete',
                content: 'earlier active run output',
                timestamp: 20,
                runId: 'run-current',
                senderLabel: null,
                nativeMetadata: null,
                attachments: [],
                reasoning: null,
                toolCards: [],
                notices: [],
              },
            },
            {
              index: 2,
              message: {
                role: 'assistant',
                status: 'streaming',
                content: 'newer active run output without run id yet',
                timestamp: 30,
                senderLabel: null,
                nativeMetadata: null,
                attachments: [],
                reasoning: null,
                toolCards: [],
                notices: [],
              },
            },
          ],
        },
      ],
      messageCount: 3,
      isActiveSessionGenerating: true,
      activeRunId: 'run-current',
      groupTimeFormatter,
      assistantLabel: 'Assistant',
      userLabel: 'You',
      toolLabel: 'Tool',
      systemLabel: 'System',
    });

    assert.deepEqual(
      group?.items.map((item) => item.isTyping),
      [false, true],
    );
  },
);

await runTest(
  'presentChatConversationPaneMessageGroups marks the latest streaming assistant as typing when no active run id is available',
  () => {
    const groups = presentChatConversationPaneMessageGroups({
      sessionId: 'session-a',
      messageGroups: [
        {
          role: 'assistant',
          items: [
            {
              index: 1,
              message: {
                role: 'assistant',
                status: 'streaming',
                content: 'current answer',
                timestamp: 20,
                senderLabel: null,
                nativeMetadata: null,
                attachments: [],
                reasoning: null,
                toolCards: [],
                notices: [],
              },
            },
          ],
        },
        {
          role: 'tool',
          items: [
            {
              index: 2,
              message: {
                role: 'tool',
                status: 'complete',
                content: '',
                timestamp: 30,
                senderLabel: null,
                nativeMetadata: null,
                attachments: [],
                reasoning: null,
                toolCards: [
                  {
                    kind: 'call',
                    name: 'search',
                  },
                ],
                notices: [],
              },
            },
          ],
        },
      ],
      messageCount: 3,
      isActiveSessionGenerating: true,
      activeRunId: null,
      groupTimeFormatter,
      assistantLabel: 'Assistant',
      userLabel: 'You',
      toolLabel: 'Tool',
      systemLabel: 'System',
    });

    assert.equal(groups[0]?.items[0]?.isTyping, true);
    assert.equal(groups[1]?.items[0]?.isTyping, false);
  },
);

await runTest(
  'presentChatConversationPaneMessageGroups appends a typing assistant placeholder when a new run has no assistant message yet',
  () => {
    const groups = presentChatConversationPaneMessageGroups({
      sessionId: 'session-a',
      messageGroups: [
        {
          role: 'user',
          items: [
            {
              index: 0,
              message: {
                role: 'user',
                status: 'complete',
                content: 'first prompt',
                timestamp: 10,
                senderLabel: null,
                nativeMetadata: null,
                attachments: [],
                reasoning: null,
                toolCards: [],
                notices: [],
              },
            },
          ],
        },
        {
          role: 'assistant',
          items: [
            {
              index: 1,
              message: {
                role: 'assistant',
                status: 'complete',
                content: 'previous answer',
                timestamp: 20,
                senderLabel: null,
                nativeMetadata: null,
                attachments: [],
                reasoning: null,
                toolCards: [],
                notices: [],
              },
            },
          ],
        },
        {
          role: 'user',
          items: [
            {
              index: 2,
              message: {
                role: 'user',
                status: 'complete',
                content: 'new prompt',
                timestamp: 30,
                senderLabel: null,
                nativeMetadata: null,
                attachments: [],
                reasoning: null,
                toolCards: [],
                notices: [],
              },
            },
          ],
        },
      ],
      messageCount: 3,
      isActiveSessionGenerating: true,
      activeRunId: null,
      groupTimeFormatter,
      assistantLabel: 'Assistant',
      userLabel: 'You',
      toolLabel: 'Tool',
      systemLabel: 'System',
    });

    assert.equal(groups.length, 4);
    assert.equal(groups[1]?.items[0]?.isTyping, false);
    assert.equal(groups[3]?.role, 'assistant');
    assert.equal(groups[3]?.items[0]?.isTyping, true);
    assert.equal(groups[3]?.items[0]?.message.content, '');
    assert.equal(groups[3]?.items[0]?.message.runId, undefined);
  },
);

await runTest(
  'presentChatConversationPaneMessageGroups keeps group keys stable when older groups are prepended',
  () => {
    const targetGroup = {
      role: 'assistant',
      items: [
        {
          index: 1,
          message: {
            id: 'assistant-message-1',
            role: 'assistant' as const,
            status: 'complete' as const,
            content: 'stable group',
            timestamp: 20,
            senderLabel: null,
            nativeMetadata: null,
            attachments: [],
            reasoning: null,
            toolCards: [],
            notices: [],
          },
        },
      ],
    };
    const [targetOnlyGroup] = presentChatConversationPaneMessageGroups({
      sessionId: 'session-a',
      messageGroups: [targetGroup],
      messageCount: 2,
      isActiveSessionGenerating: false,
      groupTimeFormatter,
      assistantLabel: 'Assistant',
      userLabel: 'You',
      toolLabel: 'Tool',
      systemLabel: 'System',
    });
    const [, targetAfterPrependGroup] = presentChatConversationPaneMessageGroups({
      sessionId: 'session-a',
      messageGroups: [
        {
          role: 'user',
          senderLabel: null,
          items: [
            {
              index: 0,
              message: {
                id: 'user-message-1',
                role: 'user',
                status: 'complete',
                content: 'older prompt',
                timestamp: 10,
                senderLabel: null,
                nativeMetadata: null,
                attachments: [],
                reasoning: null,
                toolCards: [],
                notices: [],
              },
            },
          ],
        },
        targetGroup,
      ],
      messageCount: 2,
      isActiveSessionGenerating: false,
      groupTimeFormatter,
      assistantLabel: 'Assistant',
      userLabel: 'You',
      toolLabel: 'Tool',
      systemLabel: 'System',
    });

    assert.equal(targetOnlyGroup?.key, targetAfterPrependGroup?.key);
  },
);
