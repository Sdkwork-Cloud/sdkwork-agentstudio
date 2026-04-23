import assert from 'node:assert/strict';
import {
  STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID,
  type StudioConversationAttachment,
} from '@sdkwork/claw-types';
import { hydrateLocalChatKernelProjection } from './localChatKernelProjection.ts';

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest(
  'local chat kernel projection maps direct sessions into the shared kernel standard',
  () => {
    const attachment: StudioConversationAttachment = {
      id: 'file-1',
      kind: 'file',
      name: 'brief.md',
    };

    const projected = hydrateLocalChatKernelProjection({
      session: {
        id: 'session-1',
        title: 'Direct Session',
        createdAt: 10,
        updatedAt: 50,
        instanceId: 'instance-http',
        model: 'openai/gpt-4.1',
        defaultModel: 'openai/gpt-4.1',
        thinkingLevel: 'medium',
        fastMode: false,
        verboseLevel: 'standard',
        reasoningLevel: 'balanced',
        runId: 'run-1',
        sessionKind: 'direct',
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
                detail: 'query=kernel standard',
              },
              {
                kind: 'result',
                name: 'web.search',
                preview: 'found docs',
              },
            ],
            runId: 'run-1',
          },
        ],
      },
    });

    assert.deepEqual(projected.kernelSession.ref, {
      kernelId: 'studio-direct',
      instanceId: 'instance-http',
      sessionId: 'session-1',
      nativeSessionId: null,
      routingKey: null,
      agentId: null,
      lineageParentSessionId: null,
    });
    assert.equal(projected.kernelSession.authority.kind, 'localProjection');
    assert.equal(projected.kernelSession.authority.source, 'studioProjection');
    assert.equal(projected.kernelSession.authority.durable, false);
    assert.equal(projected.kernelSession.authority.writable, false);
    assert.equal(projected.kernelSession.lifecycle, 'running');
    assert.equal(projected.kernelSession.sessionKind, 'direct');
    assert.equal(projected.kernelSession.activeRunId, 'run-1');
    assert.equal(projected.messages[0]?.kernelMessage.status, 'streaming');
    assert.deepEqual(projected.messages[0]?.kernelMessage.nativeMetadata, {
      upstreamMessageId: 'message-1',
      seq: 7,
    });
    assert.deepEqual(
      projected.messages[0]?.kernelMessage.parts.map((part) => part.kind),
      ['text', 'reasoning', 'attachment', 'toolCall', 'toolResult'],
    );
  },
);

runTest(
  'local chat kernel projection derives the display preview from authoritative sequence order while keeping timestamps independent',
  () => {
    const projected = hydrateLocalChatKernelProjection({
      session: {
        id: 'session-preview',
        title: 'Preview Session',
        createdAt: 1,
        updatedAt: 1,
        model: 'gpt-4.1',
        messages: [
          {
            id: 'message-2',
            role: 'assistant',
            content: 'assistant final',
            timestamp: 10,
            seq: 2,
          },
          {
            id: 'message-1',
            role: 'user',
            content: 'user first but newer timestamp',
            timestamp: 30,
            seq: 1,
          },
        ],
      },
    });

    assert.equal(projected.kernelSession.lastMessagePreview, 'assistant final');
    assert.deepEqual(
      projected.messages.map((message) => message.kernelMessage.nativeMetadata?.seq ?? null),
      [2, 1],
    );
  },
);

runTest(
  'local chat kernel projection persists agent binding into the shared kernel session identity',
  () => {
    const projected = hydrateLocalChatKernelProjection({
      session: {
        id: 'session-agent',
        title: 'Agent Bound Session',
        createdAt: 20,
        updatedAt: 40,
        model: 'openai/gpt-4.1',
        agentId: 'research',
        messages: [],
      },
    });

    assert.equal(projected.kernelSession.ref.agentId, 'research');
    assert.deepEqual(projected.kernelSession.actorBinding, {
      agentId: 'research',
      profileId: null,
      label: null,
    });
  },
);

runTest(
  'local chat kernel projection keeps local built-in identity for direct draft sessions',
  () => {
    const projected = hydrateLocalChatKernelProjection({
      session: {
        id: 'session-draft',
        title: 'New Conversation',
        createdAt: 1,
        updatedAt: 1,
        model: 'gpt-4.1',
        messages: [],
      },
    });

    assert.equal(projected.kernelSession.ref.kernelId, 'studio-direct');
    assert.equal(
      projected.kernelSession.ref.instanceId,
      STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID,
    );
    assert.equal(projected.kernelSession.authority.durable, false);
    assert.equal(projected.kernelSession.lifecycle, 'draft');
    assert.equal(projected.kernelSession.sessionKind, 'direct');
    assert.deepEqual(projected.messages, []);
  },
);

runTest(
  'local chat kernel projection marks only active assistant run messages as streaming',
  () => {
    const projected = hydrateLocalChatKernelProjection({
      session: {
        id: 'session-streaming',
        title: 'Streaming Session',
        createdAt: 1,
        updatedAt: 2,
        model: 'gpt-4.1',
        runId: 'run-active',
        messages: [
          {
            id: 'message-user',
            role: 'user',
            content: 'hello',
            timestamp: 1,
            runId: 'run-active',
          },
          {
            id: 'message-streaming',
            role: 'assistant',
            content: 'partial',
            timestamp: 2,
            runId: 'run-active',
          },
          {
            id: 'message-finished',
            role: 'assistant',
            content: 'done',
            timestamp: 3,
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
  'local chat kernel projection treats stale run-linked assistant messages as complete after the session run clears',
  () => {
    const projected = hydrateLocalChatKernelProjection({
      session: {
        id: 'session-complete',
        title: 'Completed Session',
        createdAt: 1,
        updatedAt: 2,
        model: 'gpt-4.1',
        runId: null,
        messages: [
          {
            id: 'message-finished',
            role: 'assistant',
            content: 'done',
            timestamp: 3,
            runId: 'run-finished',
          },
        ],
      },
    });

    assert.equal(projected.messages[0]?.kernelMessage.status, 'complete');
  },
);
