import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { KernelChatMessage, StudioConversationAttachment } from '@sdkwork/claw-types';
import { resolveKernelChatMessageState } from './kernelChatMessageState.ts';

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

function createKernelMessage(input: Partial<KernelChatMessage> = {}): KernelChatMessage {
  return {
    id: 'message-1',
          sessionRef: {
            kernelId: 'openclaw',
            instanceId: 'instance-1',
            sessionId: 'session-1',
            nativeSessionId: 'native-session-1',
            routingKey: 'agent:main:session-1',
            agentId: 'main',
            lineageParentSessionId: 'root-session',
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
  'resolveKernelChatMessageState prefers kernel message parts over legacy display fields',
  () => {
    const legacyAttachment: StudioConversationAttachment = {
      id: 'legacy-attachment',
      kind: 'file',
      name: 'legacy.txt',
    };
    const kernelAttachment: StudioConversationAttachment = {
      id: 'kernel-attachment',
      kind: 'image',
      name: 'diagram.png',
      previewUrl: 'file:///diagram.png',
    };

    assert.deepEqual(
      resolveKernelChatMessageState({
        id: 'legacy-message',
        role: 'tool',
        content: 'Legacy text',
        timestamp: 50,
        senderLabel: 'Legacy Sender',
        model: 'legacy-model',
        runId: 'legacy-run',
        attachments: [legacyAttachment],
        reasoning: 'Legacy reasoning',
        toolCards: [
          {
            kind: 'call',
            name: 'LegacyTool',
            detail: 'legacy detail',
          },
        ],
        kernelMessage: createKernelMessage({
          id: 'kernel-message',
          role: 'user',
          status: 'streaming',
          createdAt: 200,
          updatedAt: 220,
          text: '',
          parts: [
            {
              kind: 'text',
              text: 'Kernel text from parts',
            },
            {
              kind: 'reasoning',
              text: 'Kernel reasoning',
            },
            {
              kind: 'attachment',
              attachment: kernelAttachment,
            },
            {
              kind: 'toolCall',
              toolName: 'Search',
              detail: 'query=release notes',
            },
            {
              kind: 'toolResult',
              toolName: 'Search',
              preview: 'Found 3 release notes',
            },
          ],
          runId: 'kernel-run',
          model: 'kernel-model',
          senderLabel: 'Kernel Sender',
          nativeMetadata: {
            upstreamId: 'openclaw-message-1',
            seq: 7,
            chunkCount: 2,
          },
        }),
      }),
      {
        id: 'kernel-message',
        role: 'user',
        status: 'streaming',
        content: 'Kernel text from parts',
        timestamp: 220,
        senderLabel: 'Kernel Sender',
        model: 'kernel-model',
        runId: 'kernel-run',
        kernelId: 'openclaw',
        instanceId: 'instance-1',
        sessionId: 'session-1',
        nativeSessionId: 'native-session-1',
        routingKey: 'agent:main:session-1',
        agentId: 'main',
        lineageParentSessionId: 'root-session',
        seq: 7,
        nativeMetadata: {
          upstreamId: 'openclaw-message-1',
          seq: 7,
          chunkCount: 2,
        },
        attachments: [kernelAttachment],
        reasoning: 'Kernel reasoning',
        toolCards: [
          {
            kind: 'call',
            name: 'Search',
            detail: 'query=release notes',
          },
          {
            kind: 'result',
            name: 'Search',
            isError: false,
            preview: 'Found 3 release notes',
          },
        ],
        notices: [],
      },
    );
  },
);

await runTest(
  'resolveKernelChatMessageState falls back to the legacy message sequence when no kernel message is attached',
  () => {
    assert.equal(
      resolveKernelChatMessageState({
        id: 'legacy-seq-message',
        role: 'assistant',
        content: 'Legacy seq text',
        timestamp: 80,
        seq: 11,
      } as {
        id: string;
        role: string;
        content: string;
        timestamp: number;
        seq: number;
      }).seq,
      11,
    );
  },
);

await runTest(
  'resolveKernelChatMessageState falls back to legacy chat fields when no kernel message is attached',
  () => {
    const legacyAttachment: StudioConversationAttachment = {
      id: 'legacy-attachment',
      kind: 'file',
      name: 'legacy.txt',
    };

    assert.deepEqual(
      resolveKernelChatMessageState({
        id: 'legacy-message',
        role: 'assistant',
        content: 'Legacy text',
        timestamp: 50,
        senderLabel: 'Legacy Sender',
        model: 'legacy-model',
        runId: 'legacy-run',
        attachments: [legacyAttachment],
        reasoning: 'Legacy reasoning',
        toolCards: [
          {
            kind: 'call',
            name: 'LegacyTool',
            detail: 'legacy detail',
          },
        ],
      }),
      {
        id: 'legacy-message',
        role: 'assistant',
        status: 'complete',
        content: 'Legacy text',
        timestamp: 50,
        senderLabel: 'Legacy Sender',
        model: 'legacy-model',
        runId: 'legacy-run',
        kernelId: undefined,
        instanceId: undefined,
        sessionId: undefined,
        nativeSessionId: undefined,
        routingKey: undefined,
        agentId: undefined,
        lineageParentSessionId: undefined,
        nativeMetadata: null,
        attachments: [legacyAttachment],
        reasoning: 'Legacy reasoning',
        toolCards: [
          {
            kind: 'call',
            name: 'LegacyTool',
            detail: 'legacy detail',
          },
        ],
        notices: [],
      },
    );
  },
);

await runTest(
  'resolveKernelChatMessageState keeps kernel notices separate from the main markdown content surface',
  () => {
    assert.deepEqual(
      resolveKernelChatMessageState({
        kernelMessage: createKernelMessage({
          text: '',
          parts: [
            {
              kind: 'notice',
              code: 'tool-progress',
              text: 'Tool execution moved to background replay.',
              level: 'info',
            },
          ],
        }),
      }).notices,
      [
        {
          code: 'tool-progress',
          text: 'Tool execution moved to background replay.',
          level: 'info',
        },
      ],
    );
  },
);

await runTest(
  'kernelChatMessageState composes the shared kernel message parts presenter instead of inlining part parsing logic',
  () => {
    const source = readFileSync(new URL('./kernelChatMessageState.ts', import.meta.url), 'utf8');

    assert.match(
      source,
      /import \{ presentKernelChatMessageParts \} from '\.\/kernelChatMessagePartsPresentation\.ts';/,
    );
    assert.doesNotMatch(source, /function resolveKernelContent/);
    assert.doesNotMatch(source, /function resolveKernelReasoning/);
    assert.doesNotMatch(source, /function resolveKernelAttachments/);
    assert.doesNotMatch(source, /function resolveKernelToolCards/);
  },
);
