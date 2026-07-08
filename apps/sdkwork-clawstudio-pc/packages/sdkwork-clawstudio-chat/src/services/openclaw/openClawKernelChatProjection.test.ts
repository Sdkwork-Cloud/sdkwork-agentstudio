import assert from 'node:assert/strict';
import type { StudioConversationAttachment } from '@sdkwork/clawstudio-types';
import {
  buildOpenClawKernelChatMessage,
  buildOpenClawKernelChatSession,
  hydrateOpenClawKernelChatProjection,
  parseOpenClawAgentSessionRoutingKey,
} from './openClawKernelChatProjection.ts';

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('openclaw kernel chat projection parses agent-scoped routing keys', () => {
  assert.deepEqual(
    parseOpenClawAgentSessionRoutingKey('agent:research:thread-1'),
    {
      agentId: 'research',
      logicalKey: 'thread-1',
      routingKey: 'agent:research:thread-1',
    },
  );
  assert.deepEqual(
    parseOpenClawAgentSessionRoutingKey('main'),
    {
      agentId: null,
      logicalKey: 'main',
      routingKey: 'main',
    },
  );
});

runTest('openclaw kernel chat projection maps sessions and structured messages into the shared standard', () => {
  const attachment: StudioConversationAttachment = {
    id: 'file-1',
    kind: 'file',
    name: 'brief.md',
  };

  const session = buildOpenClawKernelChatSession({
    instanceId: 'instance-a',
    session: {
      id: 'agent:research:thread-1',
      title: 'Research Thread',
      createdAt: 10,
      updatedAt: 50,
      model: 'openai/gpt-4.1',
      defaultModel: 'openai/gpt-4.1',
      messages: [
        {
          id: 'message-1',
          role: 'assistant',
          content: 'Result body',
          timestamp: 50,
          seq: 7,
          reasoning: 'hidden chain',
          attachments: [attachment],
          toolCards: [
            {
              kind: 'call',
              name: 'web.search',
              toolCallId: 'tool-call-1',
              argumentsText: '{"q":"multi kernel"}',
              detail: 'query=multi kernel',
            },
            {
              kind: 'result',
              name: 'web.search',
              toolCallId: 'tool-call-1',
              text: 'found docs',
              isError: false,
              preview: 'found docs',
            },
          ],
        },
      ],
      sessionKind: 'direct',
    },
  });

  const message = buildOpenClawKernelChatMessage({
    sessionRef: session.ref,
      message: {
        id: 'message-1',
        role: 'assistant',
        content: 'Result body',
        timestamp: 50,
        seq: 7,
        reasoning: 'hidden chain',
        attachments: [attachment],
        toolCards: [
        {
          kind: 'call',
          name: 'web.search',
          toolCallId: 'tool-call-1',
          argumentsText: '{"q":"multi kernel"}',
          detail: 'query=multi kernel',
        },
        {
          kind: 'result',
          name: 'web.search',
          toolCallId: 'tool-call-1',
          text: 'found docs',
          isError: false,
          preview: 'found docs',
        },
      ],
    },
  });

  assert.deepEqual(session.ref, {
    kernelId: 'openclaw',
    instanceId: 'instance-a',
    sessionId: 'agent:research:thread-1',
    nativeSessionId: null,
    routingKey: 'agent:research:thread-1',
    agentId: 'research',
    lineageParentSessionId: null,
  });
  assert.equal(session.authority.kind, 'gateway');
  assert.equal(session.sessionKind, 'direct');
  assert.equal(session.messageCount, 1);
  assert.deepEqual(session.nativeMetadata, {
    upstreamSessionId: 'agent:research:thread-1',
    routingKey: 'agent:research:thread-1',
    logicalSessionId: 'thread-1',
    agentId: 'research',
  });
  assert.equal(message.text, 'Result body');
  assert.deepEqual(message.nativeMetadata, {
    upstreamMessageId: 'message-1',
    routingKey: 'agent:research:thread-1',
    agentId: 'research',
    seq: 7,
  });
  assert.deepEqual(message.parts.slice(3), [
    {
      kind: 'toolCall',
      toolName: 'web.search',
      toolCallId: 'tool-call-1',
      argumentsText: '{"q":"multi kernel"}',
      detail: 'query=multi kernel',
    },
    {
      kind: 'toolResult',
      toolName: 'web.search',
      toolCallId: 'tool-call-1',
      text: 'found docs',
      isError: false,
      preview: 'found docs',
    },
  ]);
  assert.equal(
    hydrateOpenClawKernelChatProjection({
      instanceId: 'instance-a',
      session: {
        id: 'agent:research:thread-1',
        title: 'Research Thread',
        createdAt: 10,
        updatedAt: 50,
        model: 'openai/gpt-4.1',
        messages: [
          {
            id: 'message-1',
            role: 'assistant',
            content: 'Result body',
            timestamp: 50,
            seq: 7,
          } as {
            id: string;
            role: 'assistant';
            content: string;
            timestamp: number;
            seq: number;
          },
        ],
      },
    }).messages[0]?.seq,
    7,
  );
});

runTest(
  'openclaw kernel chat projection marks only messages from the active assistant run as streaming',
  () => {
    const projected = hydrateOpenClawKernelChatProjection({
      instanceId: 'instance-a',
      session: {
        id: 'agent:research:thread-1',
        title: 'Research Thread',
        createdAt: 10,
        updatedAt: 50,
        model: 'openai/gpt-4.1',
        runId: 'run-active',
        messages: [
          {
            id: 'message-user',
            role: 'user',
            content: 'User prompt',
            timestamp: 20,
            runId: 'run-active',
          },
          {
            id: 'message-active',
            role: 'assistant',
            content: 'Still streaming',
            timestamp: 30,
            runId: 'run-active',
          },
          {
            id: 'message-finished',
            role: 'assistant',
            content: 'Finished reply',
            timestamp: 40,
            runId: 'run-finished',
          },
        ],
      },
    });

    assert.equal(projected.messages[0]?.kernelMessage.status, 'complete');
    assert.equal(projected.messages[1]?.kernelMessage.status, 'streaming');
    assert.equal(projected.messages[2]?.kernelMessage.status, 'complete');
  },
);

runTest(
  'openclaw kernel chat projection treats stale run-linked assistant messages as complete when the session has no active run',
  () => {
    const projected = hydrateOpenClawKernelChatProjection({
      instanceId: 'instance-a',
      session: {
        id: 'agent:research:thread-1',
        title: 'Research Thread',
        createdAt: 10,
        updatedAt: 50,
        model: 'openai/gpt-4.1',
        runId: null,
        messages: [
          {
            id: 'message-finished',
            role: 'assistant',
            content: 'Finished reply',
            timestamp: 40,
            runId: 'run-finished',
          },
        ],
      },
    });

    assert.equal(projected.messages[0]?.kernelMessage.status, 'complete');
  },
);
