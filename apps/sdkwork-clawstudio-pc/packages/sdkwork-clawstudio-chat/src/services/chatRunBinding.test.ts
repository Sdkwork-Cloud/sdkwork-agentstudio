import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { resolveChatRunBinding } from './chatRunBinding.ts';

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
  'resolveChatRunBinding keeps kernel run identity and durable session ownership together',
  () => {
    assert.deepEqual(
      resolveChatRunBinding({
        id: 'studio-session-1',
        instanceId: 'scope-instance-1',
        runId: null,
        kernelSession: {
          ref: {
            kernelId: 'hermes',
            instanceId: 'kernel-instance-1',
            sessionId: 'studio-session-1',
            nativeSessionId: 'native-session-1',
            routingKey: 'hermes/session/native-session-1',
            agentId: 'agent-hermes',
            lineageParentSessionId: 'root-session',
          },
          authority: {
            kind: 'sqlite',
            source: 'kernel',
            durable: true,
            writable: true,
          },
          lifecycle: 'running',
          activeRunId: 'kernel-run-1',
        },
      }),
      {
        scopeInstanceId: 'scope-instance-1',
        sessionId: 'studio-session-1',
        kernelOwnedSessionId: 'native-session-1',
        kernelId: 'hermes',
        kernelInstanceId: 'kernel-instance-1',
        nativeSessionId: 'native-session-1',
        routingKey: 'hermes/session/native-session-1',
        agentId: 'agent-hermes',
        lineageParentSessionId: 'root-session',
        authorityKind: 'sqlite',
        lifecycle: 'running',
        runId: 'kernel-run-1',
        isActive: true,
        isKernelAuthoritative: true,
      },
    );
  },
);

await runTest(
  'resolveChatRunBinding falls back to local run mirrors when no kernel projection exists',
  () => {
    assert.deepEqual(
      resolveChatRunBinding({
        id: 'local-session-1',
        instanceId: null,
        runId: 'local-run-1',
        kernelSession: null,
      }),
      {
        scopeInstanceId: null,
        sessionId: 'local-session-1',
        kernelOwnedSessionId: 'local-session-1',
        kernelId: null,
        kernelInstanceId: null,
        nativeSessionId: null,
        routingKey: null,
        agentId: null,
        lineageParentSessionId: null,
        authorityKind: null,
        lifecycle: null,
        runId: 'local-run-1',
        isActive: true,
        isKernelAuthoritative: false,
      },
    );
  },
);

await runTest(
  'chatRunBinding exports a shared run binding source contract for service consumers',
  () => {
    const source = readFileSync(new URL('./chatRunBinding.ts', import.meta.url), 'utf8');
    assert.match(source, /export type ChatRunBindingSource = \{/);
  },
);
