import assert from 'node:assert/strict';
import type { StudioConversationRecord } from '@sdkwork/claw-types';
import { configurePlatformBridge, getPlatformBridge } from '@sdkwork/claw-infrastructure';
import { studioConversationService } from './studioConversationService.ts';

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
  'studioConversationService repairs an empty database title from the first user message before returning sessions',
  async () => {
    const originalStudio = getPlatformBridge().studio;
    const firstUserMessage = 'Use the first user message as the durable session title';
    const putCalls: StudioConversationRecord[] = [];

    try {
      configurePlatformBridge({
        studio: {
          async listConversations(instanceId: string) {
            assert.equal(instanceId, 'managed-openclaw-primary');
            return [
              {
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
              },
            ];
          },
          async putConversation(record: StudioConversationRecord) {
            putCalls.push(record);
            return record;
          },
          async deleteConversation() {
            return true;
          },
        } as any,
      });

      const sessions = await studioConversationService.listConversations(
        'managed-openclaw-primary',
      );

      assert.equal(sessions[0]?.title, firstUserMessage);
      assert.equal(sessions[0]?.titleSource, 'firstUser');
      assert.equal(putCalls.length, 1);
      assert.equal(putCalls[0]?.title, firstUserMessage);
      assert.equal(
        (putCalls[0]?.kernelSession?.nativeMetadata as Record<string, unknown> | null | undefined)
          ?.__clawStudioTitleSource,
        'firstUser',
      );
    } finally {
      configurePlatformBridge({
        studio: originalStudio,
      });
    }
  },
);

await runTest(
  'studioConversationService keeps title repair quiet when the platform has no putConversation bridge',
  async () => {
    const originalStudio = getPlatformBridge().studio;
    const consoleErrors: unknown[][] = [];
    const originalConsoleError = console.error;

    try {
      console.error = ((...args: unknown[]) => {
        consoleErrors.push(args);
      }) as typeof console.error;
      configurePlatformBridge({
        studio: {
          async listConversations() {
            return [
              {
                id: 'session-missing-put',
                title: '',
                primaryInstanceId: 'managed-openclaw-primary',
                participantInstanceIds: ['managed-openclaw-primary'],
                createdAt: 100,
                updatedAt: 120,
                messageCount: 1,
                lastMessagePreview: 'First user title',
                kernelSession: null,
                messages: [
                  {
                    id: 'msg-user-1',
                    conversationId: 'session-missing-put',
                    role: 'user',
                    content: 'First user title',
                    createdAt: 105,
                    updatedAt: 105,
                    status: 'complete',
                  },
                ],
              },
            ];
          },
        } as any,
      });

      const sessions = await studioConversationService.listConversations(
        'managed-openclaw-primary',
      );

      assert.equal(sessions[0]?.title, 'First user title');
      assert.deepEqual(consoleErrors, []);
    } finally {
      console.error = originalConsoleError;
      configurePlatformBridge({
        studio: originalStudio,
      });
    }
  },
);
