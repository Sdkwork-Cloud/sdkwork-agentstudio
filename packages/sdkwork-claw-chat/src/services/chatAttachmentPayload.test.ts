import assert from 'node:assert/strict';
import { createKernelChatAuthority, createKernelChatSessionRef } from '@sdkwork/claw-types';
import { mapChatSession, mapStudioConversation } from '../chatSessionMapping.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('chat attachment payloads round-trip through the studio conversation mapping layer', () => {
  const session = {
    id: 'session-1',
    title: 'Attachment conversation',
    createdAt: 1,
    updatedAt: 2,
    model: 'Gemini 3 Flash',
    messages: [
      {
        id: 'message-1',
        role: 'user',
        content: '',
        timestamp: 2,
        attachments: [
          {
            id: 'asset-1',
            kind: 'image',
            name: 'diagram.png',
            mimeType: 'image/png',
            sizeBytes: 123,
            url: 'https://cdn.example.com/diagram.png',
            previewUrl: 'https://cdn.example.com/diagram.png',
            objectKey: 'chat/2026/03/22/diagram.png',
          },
        ],
      },
    ],
    transport: 'local',
  } as any;

  const record = mapChatSession(session);
  const attachment = record.messages[0]?.attachments?.[0];

  assert.ok(attachment);
  assert.equal(attachment.id, 'asset-1');
  assert.equal(attachment.kind, 'image');
  assert.equal(attachment.name, 'diagram.png');
  assert.equal(attachment.url, 'https://cdn.example.com/diagram.png');
  assert.equal(record.kernelSession?.authority.kind, 'localProjection');
  assert.equal(record.messages[0]?.kernelMessage?.role, 'user');

  const roundTrip = mapStudioConversation(record);
  const roundTripAttachment = roundTrip.messages[0]?.attachments?.[0];

  assert.ok(roundTripAttachment);
  assert.equal(roundTripAttachment.id, 'asset-1');
  assert.equal(roundTripAttachment.kind, 'image');
  assert.equal(roundTripAttachment.url, 'https://cdn.example.com/diagram.png');
  assert.equal(roundTrip.transport, 'local');
  assert.equal(roundTrip.instanceId, undefined);
  assert.equal(roundTrip.kernelSession?.authority.kind, 'localProjection');
  assert.equal(roundTrip.messages[0]?.kernelMessage?.role, 'user');
});

await runTest(
  'chat attachment payloads preserve the standardized direct kernel session binding and agent ownership through studio conversation persistence',
  () => {
    const session = {
      id: 'session-agent-bound',
      title: 'Agent-owned direct conversation',
      createdAt: 10,
      updatedAt: 30,
      model: 'openai/gpt-4.1',
      defaultModel: 'openai/gpt-4.1',
      agentId: 'research',
      sessionKind: 'direct',
      runId: 'run-direct-1',
      thinkingLevel: 'medium',
      fastMode: false,
      verboseLevel: 'standard',
      reasoningLevel: 'balanced',
      messages: [
        {
          id: 'message-agent-1',
          role: 'assistant',
          content: 'Structured answer',
          timestamp: 30,
          senderLabel: 'Research Agent',
          runId: 'run-direct-1',
          reasoning: 'reasoning trace',
          toolCards: [
            {
              kind: 'call',
              name: 'web.search',
              detail: 'query=kernel persistence',
            },
          ],
        },
      ],
      transport: 'local',
    } as any;

    const record = mapChatSession(session);

    assert.equal(record.kernelSession?.ref.agentId, 'research');
    assert.equal(record.kernelSession?.sessionKind, 'direct');
    assert.equal(record.kernelSession?.modelBinding?.model, 'openai/gpt-4.1');
    assert.equal(record.messages[0]?.kernelMessage?.senderLabel, 'Research Agent');
    assert.equal(record.messages[0]?.kernelMessage?.runId, 'run-direct-1');

    const roundTrip = mapStudioConversation(record);

    assert.equal(roundTrip.agentId, 'research');
    assert.equal(roundTrip.sessionKind, 'direct');
    assert.equal(roundTrip.model, 'openai/gpt-4.1');
    assert.equal(roundTrip.defaultModel, 'openai/gpt-4.1');
    assert.equal(roundTrip.runId, 'run-direct-1');
    assert.equal(roundTrip.messages[0]?.senderLabel, 'Research Agent');
    assert.equal(roundTrip.messages[0]?.runId, 'run-direct-1');
    assert.equal(roundTrip.messages[0]?.reasoning, 'reasoning trace');
    assert.deepEqual(roundTrip.messages[0]?.toolCards, [
      {
        kind: 'call',
        name: 'web.search',
        argumentsText: 'query=kernel persistence',
        detail: 'query=kernel persistence',
      },
    ]);
  },
);

await runTest(
  'chat attachment payloads refuse kernel-authoritative sessions even when legacy transport strings are absent',
  () => {
    const session = {
      id: 'kernel-authoritative-session-1',
      title: 'Kernel authoritative session',
      createdAt: 1,
      updatedAt: 2,
      model: 'Hermes',
      messages: [],
      transport: 'local',
      kernelSession: {
        ref: createKernelChatSessionRef({
          kernelId: 'hermes',
          instanceId: 'instance-hermes-1',
          sessionId: 'kernel-authoritative-session-1',
        }),
        authority: createKernelChatAuthority({
          kind: 'sqlite',
        }),
        lifecycle: 'ready',
        title: 'Kernel authoritative session',
        createdAt: 1,
        updatedAt: 2,
        messageCount: 0,
      },
    } as any;

    assert.throws(
      () => mapChatSession(session),
      /must not be persisted through the studio conversation store/i,
    );
  },
);

await runTest(
  'chat attachment payloads round-trip non-durable instance-scoped kernel sessions through the studio conversation mapping layer',
  () => {
    const session = {
      id: 'transport-session-1',
      title: 'Transport-backed instance conversation',
      createdAt: 5,
      updatedAt: 15,
      model: 'openai/gpt-4.1-mini',
      defaultModel: 'openai/gpt-4.1-mini',
      instanceId: 'instance-http-1',
      transport: 'kernelAdapter',
      sessionKind: 'transport',
      agentId: 'ops',
      messages: [
        {
          id: 'message-transport-1',
          role: 'user',
          content: 'hello transport',
          timestamp: 10,
          attachments: [
            {
              id: 'asset-transport-1',
              kind: 'file',
              name: 'runbook.md',
              mimeType: 'text/markdown',
            },
          ],
        },
        {
          id: 'message-transport-2',
          role: 'assistant',
          content: 'transport reply',
          timestamp: 15,
          senderLabel: 'Ops Agent',
        },
      ],
      kernelSession: {
        ref: createKernelChatSessionRef({
          kernelId: 'zeroclaw',
          instanceId: 'instance-http-1',
          sessionId: 'transport-session-1',
          agentId: 'ops',
        }),
        authority: createKernelChatAuthority({
          kind: 'http',
          durable: false,
        }),
        lifecycle: 'ready',
        title: 'Transport-backed instance conversation',
        createdAt: 5,
        updatedAt: 15,
        messageCount: 2,
        lastMessagePreview: 'transport reply',
        sessionKind: 'transport',
        modelBinding: {
          model: 'openai/gpt-4.1-mini',
          defaultModel: 'openai/gpt-4.1-mini',
        },
        actorBinding: {
          agentId: 'ops',
          profileId: null,
          label: 'Ops Agent',
        },
        activeRunId: null,
      },
    } as any;

    const record = mapChatSession(session);

    assert.equal(record.primaryInstanceId, 'instance-http-1');
    assert.deepEqual(record.participantInstanceIds, ['instance-http-1']);
    assert.equal(record.kernelSession?.authority.kind, 'http');
    assert.equal(record.kernelSession?.authority.durable, false);
    assert.equal(record.kernelSession?.ref.agentId, 'ops');
    assert.equal(record.messages[1]?.kernelMessage?.senderLabel, 'Ops Agent');

    const roundTrip = mapStudioConversation(record);

    assert.equal(roundTrip.instanceId, 'instance-http-1');
    assert.equal(roundTrip.transport, 'kernelAdapter');
    assert.equal(roundTrip.agentId, 'ops');
    assert.equal(roundTrip.sessionKind, 'transport');
    assert.equal(roundTrip.kernelSession?.authority.kind, 'http');
    assert.equal(roundTrip.kernelSession?.authority.durable, false);
    assert.equal(roundTrip.messages[0]?.attachments?.[0]?.name, 'runbook.md');
    assert.equal(roundTrip.messages[1]?.senderLabel, 'Ops Agent');
  },
);

await runTest(
  'chat attachment payloads round-trip gateway-authoritative instance-scoped kernel sessions through the studio conversation mapping layer for local mirror recovery',
  () => {
    const gatewaySessionRef = createKernelChatSessionRef({
      kernelId: 'openclaw',
      instanceId: 'instance-openclaw-1',
      sessionId: 'agent:research:main',
      nativeSessionId: 'agent:research:main',
      routingKey: 'agent:research:main',
      agentId: 'research',
    });
    const session = {
      id: 'agent:research:main',
      title: 'Gateway mirrored session',
      createdAt: 25,
      updatedAt: 45,
      model: 'openai/gpt-4.1',
      defaultModel: 'openai/gpt-4.1',
      instanceId: 'instance-openclaw-1',
      transport: 'openclawGateway',
      sessionKind: 'agent',
      agentId: 'research',
      agentLabel: 'Research Agent',
      runId: 'run-gateway-1',
      messages: [
        {
          id: 'message-gateway-1',
          role: 'user',
          content: 'summarize the docs',
          timestamp: 30,
          seq: 1,
        },
        {
          id: 'message-gateway-2',
          role: 'assistant',
          content: 'Here is the summary.',
          timestamp: 45,
          senderLabel: 'Research Agent',
          runId: 'run-gateway-1',
          kernelMessage: {
            id: 'message-gateway-2',
            sessionRef: gatewaySessionRef,
            role: 'assistant',
            status: 'streaming',
            createdAt: 45,
            updatedAt: 45,
            text: 'Here is the summary.',
            parts: [
              {
                kind: 'text',
                text: 'Here is the summary.',
              },
            ],
            runId: 'run-gateway-1',
            senderLabel: 'Research Agent',
            nativeMetadata: {
              messageSeq: 2,
            },
          },
        },
      ],
      kernelSession: {
        ref: gatewaySessionRef,
        authority: createKernelChatAuthority({
          kind: 'gateway',
        }),
        lifecycle: 'running',
        title: 'Gateway mirrored session',
        createdAt: 25,
        updatedAt: 45,
        messageCount: 2,
        lastMessagePreview: 'Here is the summary.',
        sessionKind: 'agent',
        modelBinding: {
          model: 'openai/gpt-4.1',
          defaultModel: 'openai/gpt-4.1',
        },
        actorBinding: {
          agentId: 'research',
          profileId: 'research',
          label: 'Research Agent',
        },
        activeRunId: 'run-gateway-1',
        nativeMetadata: {
          routingKey: 'agent:research:main',
        },
      },
    } as any;

    const record = mapChatSession(session);

    assert.equal(record.primaryInstanceId, 'instance-openclaw-1');
    assert.equal(record.kernelSession?.authority.kind, 'gateway');
    assert.equal(record.kernelSession?.ref.routingKey, 'agent:research:main');
    assert.equal(record.kernelSession?.actorBinding?.label, 'Research Agent');
    assert.equal(record.messages[0]?.kernelMessage?.nativeMetadata?.seq, 1);
    assert.equal(record.messages[1]?.kernelMessage?.nativeMetadata?.seq, 2);
    assert.equal(record.messages[1]?.kernelMessage?.runId, 'run-gateway-1');

    const roundTrip = mapStudioConversation(record);

    assert.equal(roundTrip.instanceId, 'instance-openclaw-1');
    assert.equal(roundTrip.transport, 'openclawGateway');
    assert.equal(roundTrip.agentId, 'research');
    assert.equal(roundTrip.agentLabel, 'Research Agent');
    assert.equal(roundTrip.runId, 'run-gateway-1');
    assert.equal(roundTrip.kernelSession?.authority.kind, 'gateway');
    assert.equal(roundTrip.kernelSession?.ref.routingKey, 'agent:research:main');
    assert.deepEqual(
      roundTrip.messages.map((message) => message.seq),
      [1, 2],
    );
    assert.equal(roundTrip.messages[1]?.senderLabel, 'Research Agent');
    assert.equal(roundTrip.messages[1]?.runId, 'run-gateway-1');
  },
);

await runTest(
  'chat attachment payloads normalize persisted message order by authoritative sequence when studio conversation records arrive out of order',
  () => {
    const unorderedSessionRef = createKernelChatSessionRef({
      kernelId: 'zeroclaw',
      instanceId: 'instance-http-2',
      sessionId: 'session-unordered-messages',
      agentId: 'ops',
    });
    const record = {
      id: 'session-unordered-messages',
      title: 'Unordered persisted record',
      primaryInstanceId: 'instance-http-2',
      participantInstanceIds: ['instance-http-2'],
      createdAt: 10,
      updatedAt: 40,
      messageCount: 3,
      lastMessagePreview: 'assistant latest',
      kernelSession: {
        ref: unorderedSessionRef,
        authority: createKernelChatAuthority({
          kind: 'http',
          durable: false,
        }),
        lifecycle: 'ready',
        title: 'Unordered persisted record',
        createdAt: 10,
        updatedAt: 40,
        messageCount: 3,
        lastMessagePreview: 'assistant latest',
        sessionKind: 'transport',
      },
      messages: [
        {
          id: 'message-3',
          conversationId: 'session-unordered-messages',
          role: 'assistant' as const,
          content: 'assistant latest',
          createdAt: 15,
          updatedAt: 15,
          status: 'complete' as const,
          kernelMessage: {
            id: 'message-3',
            sessionRef: unorderedSessionRef,
            role: 'assistant' as const,
            status: 'complete' as const,
            createdAt: 15,
            updatedAt: 15,
            text: 'assistant latest',
            parts: [
              {
                kind: 'text',
                text: 'assistant latest',
              },
            ],
            nativeMetadata: {
              seq: 3,
            },
          },
        },
        {
          id: 'message-1',
          conversationId: 'session-unordered-messages',
          role: 'user' as const,
          content: 'first user turn',
          createdAt: 40,
          updatedAt: 40,
          status: 'complete' as const,
          kernelMessage: {
            id: 'message-1',
            sessionRef: unorderedSessionRef,
            role: 'user' as const,
            status: 'complete' as const,
            createdAt: 40,
            updatedAt: 40,
            text: 'first user turn',
            parts: [
              {
                kind: 'text',
                text: 'first user turn',
              },
            ],
            nativeMetadata: {
              seq: 1,
            },
          },
        },
        {
          id: 'message-2',
          conversationId: 'session-unordered-messages',
          role: 'assistant' as const,
          content: 'assistant middle',
          createdAt: 25,
          updatedAt: 25,
          status: 'complete' as const,
          kernelMessage: {
            id: 'message-2',
            sessionRef: unorderedSessionRef,
            role: 'assistant' as const,
            status: 'complete' as const,
            createdAt: 25,
            updatedAt: 25,
            text: 'assistant middle',
            parts: [
              {
                kind: 'text',
                text: 'assistant middle',
              },
            ],
            nativeMetadata: {
              seq: 2,
            },
          },
        },
      ],
    } as any;

    const roundTrip = mapStudioConversation(record);

    assert.deepEqual(
      roundTrip.messages.map((message) => message.id),
      ['message-1', 'message-2', 'message-3'],
    );
    assert.deepEqual(
      roundTrip.messages.map((message) => message.seq),
      [1, 2, 3],
    );
    assert.deepEqual(
      roundTrip.messages.map((message) => message.timestamp),
      [40, 25, 15],
    );
  },
);

await runTest(
  'chat attachment payloads normalize stale persisted session updatedAt values from the latest message timestamp',
  () => {
    const record = {
      id: 'session-stale-updated-at',
      title: 'Stale updatedAt',
      primaryInstanceId: 'instance-http-3',
      participantInstanceIds: ['instance-http-3'],
      createdAt: 10,
      updatedAt: 20,
      messageCount: 2,
      lastMessagePreview: 'latest persisted reply',
      kernelSession: {
        ref: createKernelChatSessionRef({
          kernelId: 'zeroclaw',
          instanceId: 'instance-http-3',
          sessionId: 'session-stale-updated-at',
        }),
        authority: createKernelChatAuthority({
          kind: 'http',
          durable: false,
        }),
        lifecycle: 'ready',
        title: 'Stale updatedAt',
        createdAt: 10,
        updatedAt: 20,
        messageCount: 2,
        lastMessagePreview: 'latest persisted reply',
        sessionKind: 'transport',
      },
      messages: [
        {
          id: 'message-1',
          conversationId: 'session-stale-updated-at',
          role: 'user' as const,
          content: 'first turn',
          createdAt: 12,
          updatedAt: 12,
          status: 'complete' as const,
        },
        {
          id: 'message-2',
          conversationId: 'session-stale-updated-at',
          role: 'assistant' as const,
          content: 'latest persisted reply',
          createdAt: 55,
          updatedAt: 55,
          status: 'complete' as const,
        },
      ],
    } as any;

    const roundTrip = mapStudioConversation(record);

    assert.equal(roundTrip.updatedAt, 55);
    assert.equal(roundTrip.kernelSession?.updatedAt, 55);
  },
);
