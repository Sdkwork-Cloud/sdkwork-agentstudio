import assert from 'node:assert/strict';
import type { KernelChatMessage } from '@sdkwork/claw-types';
import { resolveChatMessageBinding } from './chatMessageBinding.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function createKernelMessage(input: Partial<KernelChatMessage> = {}): KernelChatMessage {
  return {
    id: 'message-1',
    sessionRef: {
      kernelId: 'openclaw',
      instanceId: 'instance-1',
      sessionId: 'session-1',
    },
    role: 'assistant',
    status: 'complete',
    createdAt: 100,
    updatedAt: 120,
    text: 'Kernel text',
    parts: [],
    ...input,
  };
}

await runTest(
  'resolveChatMessageBinding keeps message-to-session kernel identity and run metadata together',
  () => {
    assert.deepEqual(
      resolveChatMessageBinding({
        id: 'legacy-message',
        runId: 'legacy-run',
        model: 'legacy-model',
        senderLabel: 'Legacy Sender',
        nativeMetadata: {
          legacyChunk: 1,
        },
        kernelMessage: createKernelMessage({
          id: 'kernel-message',
          sessionRef: {
            kernelId: 'hermes',
            instanceId: 'instance-hermes',
            sessionId: 'studio-session-1',
            nativeSessionId: 'native-session-1',
            routingKey: 'hermes/session/native-session-1',
            agentId: 'agent-hermes',
            lineageParentSessionId: 'root-session',
          },
          runId: 'kernel-run',
          model: 'kernel-model',
          senderLabel: 'Kernel Sender',
          nativeMetadata: {
            upstreamId: 'kernel-message-1',
          },
        }),
      }),
      {
        id: 'kernel-message',
        runId: 'kernel-run',
        model: 'kernel-model',
        senderLabel: 'Kernel Sender',
        kernelId: 'hermes',
        instanceId: 'instance-hermes',
        sessionId: 'studio-session-1',
        nativeSessionId: 'native-session-1',
        routingKey: 'hermes/session/native-session-1',
        agentId: 'agent-hermes',
        lineageParentSessionId: 'root-session',
        nativeMetadata: {
          upstreamId: 'kernel-message-1',
        },
      },
    );
  },
);

await runTest(
  'resolveChatMessageBinding falls back to legacy message fields when no kernel message exists',
  () => {
    assert.deepEqual(
      resolveChatMessageBinding({
        id: 'legacy-message',
        runId: 'legacy-run',
        model: 'legacy-model',
        senderLabel: 'Legacy Sender',
        nativeMetadata: {
          legacyChunk: 1,
        },
      }),
      {
        id: 'legacy-message',
        runId: 'legacy-run',
        model: 'legacy-model',
        senderLabel: 'Legacy Sender',
        kernelId: null,
        instanceId: null,
        sessionId: null,
        nativeSessionId: null,
        routingKey: null,
        agentId: null,
        lineageParentSessionId: null,
        nativeMetadata: {
          legacyChunk: 1,
        },
      },
    );
  },
);
