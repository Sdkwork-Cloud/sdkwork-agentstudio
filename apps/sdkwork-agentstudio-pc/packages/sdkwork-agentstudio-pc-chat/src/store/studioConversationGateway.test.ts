import assert from 'node:assert/strict';
import {
  deleteInstanceConversation,
  getInstanceConversation,
  listInstanceConversations,
  putInstanceConversation,
  resetInstanceConversation,
} from './studioConversationGateway.ts';

function runTest(name: string, fn: () => Promise<void> | void) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

await runTest(
  'studioConversationGateway hard-blocks instance-scoped conversation reads after the adapter-first cut',
  async () => {
    const conversations = await listInstanceConversations('instance-http');

    assert.deepEqual(conversations, []);
  },
);

await runTest(
  'studioConversationGateway rejects instance-scoped conversation writes after the adapter-first cut',
  async () => {
    await assert.rejects(
      putInstanceConversation({
        id: 'session-1',
        title: 'Blocked',
        createdAt: 1,
        updatedAt: 1,
        messages: [],
        model: 'gpt-4.1',
        instanceId: 'instance-http',
        transport: 'kernelAdapter',
      }),
      /not persisted through the studio conversation store/i,
    );
  },
);

await runTest(
  'studioConversationGateway keeps reset/delete/get as no-op safety shims for callers that have not been removed yet',
  async () => {
    const session = {
      id: 'session-1',
      title: 'Blocked',
      createdAt: 1,
      updatedAt: 2,
      messages: [
        {
          id: 'message-1',
          role: 'user' as const,
          content: 'hello',
          timestamp: 2,
        },
      ],
      model: 'gpt-4.1',
      instanceId: 'instance-http',
      transport: 'kernelAdapter' as const,
      lastMessagePreview: 'hello',
    };

    assert.equal(await deleteInstanceConversation('session-1', 'instance-http'), true);
    assert.equal(await getInstanceConversation('instance-http', 'session-1', session), session);
    assert.deepEqual(await resetInstanceConversation(session), {
      ...session,
      messages: [],
      lastMessagePreview: undefined,
    });
  },
);
