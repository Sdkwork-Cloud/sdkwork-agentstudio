import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { resolveChatSessionBinding } from './chatSessionBinding.ts';

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
  'resolveChatSessionBinding keeps studio scope identity separate from kernel-native binding metadata',
  () => {
    assert.deepEqual(
      resolveChatSessionBinding({
        id: 'agent:research:main',
        instanceId: null,
        kernelSession: {
          ref: {
            kernelId: 'openclaw',
            instanceId: 'instance-openclaw',
            sessionId: 'agent:research:main',
            nativeSessionId: 'native-research-main',
            routingKey: 'agent:research:main',
            agentId: 'research',
            lineageParentSessionId: 'agent:main:main',
          },
          authority: {
            kind: 'gateway',
            source: 'kernel',
            durable: true,
            writable: true,
          },
          sessionKind: 'assistant-thread',
        },
      }),
      {
        scopeInstanceId: null,
        sessionId: 'agent:research:main',
        kernelId: 'openclaw',
        kernelInstanceId: 'instance-openclaw',
        nativeSessionId: 'native-research-main',
        routingKey: 'agent:research:main',
        agentId: 'research',
        lineageParentSessionId: 'agent:main:main',
        authorityKind: 'gateway',
        sessionKind: 'assistant-thread',
        isKernelAuthoritative: true,
        isMainAgentSession: true,
      },
    );
  },
);

await runTest(
  'resolveChatSessionBinding falls back to the OpenClaw session key when no explicit agent binding exists',
  () => {
    assert.deepEqual(
      resolveChatSessionBinding({
        id: 'agent:ops:main:thread:claw-studio:session-1',
        instanceId: 'instance-a',
        kernelSession: null,
      }),
      {
        scopeInstanceId: 'instance-a',
        sessionId: 'agent:ops:main:thread:claw-studio:session-1',
        kernelId: null,
        kernelInstanceId: null,
        nativeSessionId: null,
        routingKey: null,
        agentId: 'ops',
        lineageParentSessionId: null,
        authorityKind: null,
        sessionKind: null,
        isKernelAuthoritative: false,
        isMainAgentSession: false,
      },
    );
  },
);

await runTest(
  'resolveKernelOwnedSessionId prefers the kernel-native durable session id when it differs from the studio-facing session id',
  async () => {
    const { resolveKernelOwnedSessionId } = await import('./chatSessionBinding.ts');

    assert.equal(
      resolveKernelOwnedSessionId({
        id: 'studio-session-1',
        kernelSession: {
          ref: {
            kernelId: 'hermes',
            instanceId: 'instance-hermes',
            sessionId: 'studio-session-1',
            nativeSessionId: 'native-session-1',
          },
        },
      }),
      'native-session-1',
    );

    assert.equal(
      resolveKernelOwnedSessionId({
        id: 'studio-session-2',
        kernelSession: {
          ref: {
            kernelId: 'openclaw',
            instanceId: 'instance-openclaw',
            sessionId: 'studio-session-2',
            nativeSessionId: null,
          },
        },
      }),
      'studio-session-2',
    );
  },
);

await runTest(
  'chatSessionBinding exports shared session source and selection contracts for downstream consumers',
  () => {
    const source = readFileSync(new URL('./chatSessionBinding.ts', import.meta.url), 'utf8');
    assert.match(source, /export type ChatSessionBindingSource = \{/);
    assert.match(
      source,
      /export type ChatSessionSelectionBinding = Pick<ChatSessionBinding, 'sessionId' \| 'agentId'>;/,
    );
  },
);
