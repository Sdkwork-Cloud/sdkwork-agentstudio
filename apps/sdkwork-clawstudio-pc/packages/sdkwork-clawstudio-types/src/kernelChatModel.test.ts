import assert from 'node:assert/strict';
import {
  KERNEL_CHAT_AUTHORITY_KINDS,
  KERNEL_CHAT_MESSAGE_PART_KINDS,
  KERNEL_CHAT_MESSAGE_ROLES,
  KERNEL_CHAT_RUN_STATUSES,
  createKernelChatCapabilitySet,
  createKernelChatAuthority,
  createKernelChatSessionRef,
} from './kernelChatModel.ts';

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('kernel chat model exports canonical runtime vocabularies', () => {
  assert.deepEqual(KERNEL_CHAT_MESSAGE_ROLES, [
    'system',
    'user',
    'assistant',
    'tool',
    'runtime',
  ]);
  assert.deepEqual(KERNEL_CHAT_MESSAGE_PART_KINDS, [
    'text',
    'reasoning',
    'toolCall',
    'toolResult',
    'attachment',
    'notice',
  ]);
  assert.deepEqual(KERNEL_CHAT_AUTHORITY_KINDS, [
    'gateway',
    'sqlite',
    'http',
    'localProjection',
  ]);
  assert.deepEqual(KERNEL_CHAT_RUN_STATUSES, [
    'queued',
    'running',
    'streaming',
    'completed',
    'aborted',
    'failed',
  ]);
});

runTest('kernel chat model normalizes session refs and authority defaults', () => {
  const ref = createKernelChatSessionRef({
    kernelId: 'openclaw',
    instanceId: 'instance-a',
    sessionId: 'session-a',
    nativeSessionId: '  ses-123  ',
    routingKey: '  agent:research:main  ',
    agentId: '  research  ',
    lineageParentSessionId: '  root-session  ',
  });
  const authority = createKernelChatAuthority({
    kind: 'gateway',
  });
  const capabilitySet = createKernelChatCapabilitySet({
    supportsStreaming: true,
    supportsRuns: true,
    supportsAgentProfiles: true,
    supportsSessionMutation: true,
  });

  assert.deepEqual(ref, {
    kernelId: 'openclaw',
    instanceId: 'instance-a',
    sessionId: 'session-a',
    nativeSessionId: 'ses-123',
    routingKey: 'agent:research:main',
    agentId: 'research',
    lineageParentSessionId: 'root-session',
  });
  assert.deepEqual(authority, {
    kind: 'gateway',
    source: 'kernel',
    durable: true,
    writable: true,
  });
  assert.deepEqual(capabilitySet, {
    supportsAgentProfiles: true,
    supportsSessionMutation: true,
    supportsStreaming: true,
    supportsRuns: true,
    supportsRunAbort: false,
    supportsModelSelection: false,
    supportsReasoningControl: false,
    supportsThinkingLevel: false,
    supportsFastMode: false,
    supportsVerboseLevel: false,
    supportsAttachments: false,
  });
});
