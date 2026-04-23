import assert from 'node:assert/strict';
import type { KernelChatMessage } from '@sdkwork/claw-types';

import { presentKernelChatMessageParts } from './kernelChatMessagePartsPresentation.ts';

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
      kernelId: 'hermes',
      instanceId: 'instance-1',
      sessionId: 'session-1',
    },
    role: 'assistant',
    status: 'complete',
    createdAt: 100,
    updatedAt: 120,
    text: 'Fallback text',
    parts: [],
    ...input,
  };
}

await runTest(
  'presentKernelChatMessageParts normalizes renderable content, tool activity, and notices from shared kernel parts',
  () => {
    const attachment = {
      id: 'attachment-1',
      kind: 'image' as const,
      name: 'diagram.png',
      previewUrl: 'file:///diagram.png',
    };
    const presentation = presentKernelChatMessageParts(
      createKernelMessage({
        text: '',
        parts: [
          {
            kind: 'text',
            text: 'First paragraph',
          },
          {
            kind: 'text',
            text: 'Second paragraph',
          },
          {
            kind: 'reasoning',
            text: 'Need to inspect the session lineage.',
          },
          {
            kind: 'attachment',
            attachment,
          },
          {
            kind: 'toolCall',
            toolName: 'browser.search',
            toolCallId: 'tool-call-1',
            argumentsText: '{"q":"Hermes tool_calls"}',
          },
          {
            kind: 'toolResult',
            toolName: 'browser.search',
            toolCallId: 'tool-call-1',
            text: 'Found 3 matching entries.',
          },
          {
            kind: 'notice',
            code: 'context-truncated',
            text: 'Context window was truncated before replay.',
            level: 'warning',
          },
        ],
      }),
    );

    assert.deepEqual(presentation, {
      content: 'First paragraph\n\nSecond paragraph',
      reasoning: 'Need to inspect the session lineage.',
      attachments: [attachment],
      toolCards: [
        {
          kind: 'call',
          name: 'browser.search',
          toolCallId: 'tool-call-1',
          argumentsText: '{"q":"Hermes tool_calls"}',
          detail: '{"q":"Hermes tool_calls"}',
        },
        {
          kind: 'result',
          name: 'browser.search',
          toolCallId: 'tool-call-1',
          text: 'Found 3 matching entries.',
          isError: false,
          preview: 'Found 3 matching entries.',
        },
      ],
      notices: [
        {
          code: 'context-truncated',
          text: 'Context window was truncated before replay.',
          level: 'warning',
        },
      ],
    });
  },
);
