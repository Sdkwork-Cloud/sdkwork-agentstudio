import assert from 'node:assert/strict';
import type { StudioInstanceRecord } from '@sdkwork/clawstudio-types';
import { createTransportBackedKernelChatAdapter } from './transportBackedKernelChatAdapter.ts';

function runTest(name: string, fn: () => Promise<void> | void) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

function createInstance(
  input: Partial<StudioInstanceRecord> & Pick<StudioInstanceRecord, 'id'>,
): StudioInstanceRecord {
  return {
    id: input.id,
    name: input.name ?? 'HTTP Runtime',
    description: input.description ?? 'Fixture',
    runtimeKind: input.runtimeKind ?? 'zeroclaw',
    deploymentMode: input.deploymentMode ?? 'remote',
    transportKind: input.transportKind ?? 'openaiHttp',
    status: input.status ?? 'online',
    isBuiltIn: input.isBuiltIn ?? false,
    isDefault: input.isDefault ?? false,
    iconType: input.iconType ?? 'server',
    version: input.version ?? 'test',
    typeLabel: input.typeLabel ?? 'Fixture',
    host: input.host ?? '127.0.0.1',
    port: input.port ?? 18080,
    baseUrl: input.baseUrl ?? 'http://127.0.0.1:18080',
    websocketUrl: input.websocketUrl ?? 'ws://127.0.0.1:18080',
    cpu: input.cpu ?? 0,
    memory: input.memory ?? 0,
    totalMemory: input.totalMemory ?? '0 GB',
    uptime: input.uptime ?? '0m',
    capabilities: input.capabilities ?? ['chat'],
    storage: input.storage ?? {
      provider: 'localFile',
      namespace: 'fixture',
    },
    config: input.config ?? {
      port: '18080',
      sandbox: true,
      autoUpdate: false,
      logLevel: 'info',
      corsOrigins: '*',
    },
    createdAt: input.createdAt ?? 1,
    updatedAt: input.updatedAt ?? 1,
    lastSeenAt: input.lastSeenAt ?? 1,
  };
}

await runTest('transport-backed kernel chat adapter creates non-durable http authority sessions in memory', async () => {
  const adapter = createTransportBackedKernelChatAdapter({
    instance: createInstance({
      id: 'instance-http',
    }),
    now: () => 42,
    createSessionId: () => 'transport-session-1',
  });

  const created = await adapter.createSession?.({
    instanceId: 'instance-http',
    model: 'gpt-4.1',
    title: 'HTTP session',
    agentId: 'ops',
  });
  const sessions = await adapter.listSessions?.('instance-http');
  const capabilities = adapter.getCapabilities();

  assert.ok(created);
  assert.equal(capabilities.authorityKind, 'http');
  assert.equal(capabilities.durable, false);
  assert.equal(capabilities.supportsStreaming, false);
  assert.equal(capabilities.supportsRuns, false);
  assert.equal(capabilities.supportsAgentProfiles, false);
  assert.equal(capabilities.capabilitySet.supportsStreaming, false);
  assert.equal(capabilities.capabilitySet.supportsRuns, false);
  assert.equal(created?.ref.kernelId, 'zeroclaw');
  assert.equal(created?.ref.instanceId, 'instance-http');
  assert.equal(created?.ref.agentId, 'ops');
  assert.equal(created?.authority.kind, 'http');
  assert.equal(created?.authority.durable, false);
  assert.equal(created?.actorBinding?.agentId, 'ops');
  assert.deepEqual(created?.nativeMetadata, {
    runtimeKind: 'zeroclaw',
    transportKind: 'openaiHttp',
    authoritySource: 'transportBacked',
  });
  assert.deepEqual(
    sessions?.map((session) => session.ref.sessionId),
    ['transport-session-1'],
  );
});
