import assert from 'node:assert/strict';

import { resolveKernelChatSessionState } from './kernelChatSessionState.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('resolveKernelChatSessionState prefers kernel session bindings over legacy gateway fields', () => {
  assert.deepEqual(
    resolveKernelChatSessionState({
      model: 'legacy-model',
      defaultModel: 'legacy-default',
      runId: 'legacy-run',
      thinkingLevel: 'legacy-thinking',
      fastMode: false,
      verboseLevel: 'legacy-verbose',
      reasoningLevel: 'legacy-reasoning',
      sessionKind: 'direct',
      kernelSession: {
        ref: {
          kernelId: 'openclaw',
          instanceId: 'instance-a',
          sessionId: 'agent:research:main',
          nativeSessionId: 'native-research-main',
          agentId: 'research',
          routingKey: 'agent:research:main',
          lineageParentSessionId: 'agent:main:main',
        },
        authority: {
          kind: 'gateway',
          source: 'kernel',
          durable: true,
          writable: true,
        },
        lifecycle: 'running',
        title: 'Research',
        createdAt: 1,
        updatedAt: 2,
        messageCount: 0,
        sessionKind: 'global',
        nativeMetadata: {
          routingKind: 'agent',
          nativeSessionKey: 'research-main',
        },
        modelBinding: {
          model: 'kernel-model',
          defaultModel: 'kernel-default',
          thinkingLevel: 'kernel-thinking',
          fastMode: true,
          verboseLevel: 'kernel-verbose',
          reasoningLevel: 'kernel-reasoning',
        },
        activeRunId: 'kernel-run',
      },
    }),
    {
      kernelId: 'openclaw',
      instanceId: 'instance-a',
      sessionId: 'agent:research:main',
      nativeSessionId: 'native-research-main',
      agentId: 'research',
      routingKey: 'agent:research:main',
      lineageParentSessionId: 'agent:main:main',
      authorityKind: 'gateway',
      authoritySource: 'kernel',
      authorityDurable: true,
      authorityWritable: true,
      lifecycle: 'running',
      sessionKind: 'global',
      nativeMetadata: {
        routingKind: 'agent',
        nativeSessionKey: 'research-main',
      },
      activeRunId: 'kernel-run',
      model: 'kernel-model',
      defaultModel: 'kernel-default',
      thinkingLevel: 'kernel-thinking',
      fastMode: true,
      verboseLevel: 'kernel-verbose',
      reasoningLevel: 'kernel-reasoning',
    },
  );
});

await runTest('resolveKernelChatSessionState falls back to legacy chat session fields when no kernel projection exists', () => {
  assert.deepEqual(
    resolveKernelChatSessionState({
      model: 'legacy-model',
      defaultModel: 'legacy-default',
      runId: 'legacy-run',
      thinkingLevel: 'legacy-thinking',
      fastMode: false,
      verboseLevel: 'legacy-verbose',
      reasoningLevel: 'legacy-reasoning',
      sessionKind: 'direct',
      kernelSession: null,
    }),
    {
      kernelId: null,
      instanceId: null,
      sessionId: null,
      nativeSessionId: null,
      agentId: null,
      routingKey: null,
      lineageParentSessionId: null,
      authorityKind: null,
      authoritySource: null,
      authorityDurable: null,
      authorityWritable: null,
      lifecycle: null,
      sessionKind: 'direct',
      nativeMetadata: null,
      activeRunId: 'legacy-run',
      model: 'legacy-model',
      defaultModel: 'legacy-default',
      thinkingLevel: 'legacy-thinking',
      fastMode: false,
      verboseLevel: 'legacy-verbose',
      reasoningLevel: 'legacy-reasoning',
    },
  );
});

await runTest('resolveKernelChatSessionState drops unknown authority kinds instead of widening them to arbitrary strings', () => {
  const state = resolveKernelChatSessionState({
    kernelSession: {
      authority: {
        kind: 'unsupported-authority',
        source: 'kernel',
        durable: false,
        writable: false,
      },
    },
  });

  assert.equal(state.authorityKind, null);
  assert.equal(state.authoritySource, 'kernel');
  assert.equal(state.authorityDurable, false);
  assert.equal(state.authorityWritable, false);
  assert.equal(state.nativeMetadata, null);
});
