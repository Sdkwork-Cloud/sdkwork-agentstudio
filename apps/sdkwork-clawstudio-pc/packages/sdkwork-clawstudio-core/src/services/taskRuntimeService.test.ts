import assert from 'node:assert/strict';
import { OpenClawGatewayAccessError } from '@sdkwork/clawstudio-infrastructure';
import {
  DEFAULT_BUNDLED_OPENCLAW_VERSION,
  type StudioInstanceDetailRecord,
} from '@sdkwork/clawstudio-types';
import { createTaskRuntimeService } from './taskRuntimeService.ts';

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

function createDetail(input: {
  runtimeKind?: 'openclaw' | 'custom';
  transportKind?: string;
  primaryTransport?: string;
  isBuiltIn?: boolean;
} = {}): StudioInstanceDetailRecord {
  const runtimeKind = input.runtimeKind || 'openclaw';
  const transportKind =
    input.transportKind || (runtimeKind === 'openclaw' ? 'openclawGatewayWs' : 'customHttp');
  const primaryTransport = input.primaryTransport || transportKind;

  return {
    instance: {
      id: 'runtime-1',
      name: 'Runtime One',
      description: 'Task runtime fixture.',
      runtimeKind,
      deploymentMode: runtimeKind === 'openclaw' ? 'local-managed' : 'remote',
      transportKind,
      status: 'online',
      isBuiltIn: input.isBuiltIn ?? runtimeKind === 'openclaw',
      isDefault: false,
      iconType: 'server',
      version:
        runtimeKind === 'openclaw' ? DEFAULT_BUNDLED_OPENCLAW_VERSION : 'custom-runtime-fixture',
      typeLabel: 'Fixture',
      host: '127.0.0.1',
      port: 18080,
      baseUrl: 'http://127.0.0.1:18080',
      websocketUrl: null,
      cpu: 0,
      memory: 0,
      totalMemory: '0 GB',
      uptime: '0m',
      capabilities: ['chat', 'tasks'],
      storage: {
        provider: 'localFile',
        namespace: 'fixture',
      },
      config: {
        port: '18080',
        sandbox: true,
        autoUpdate: false,
        logLevel: 'info',
        corsOrigins: '*',
      },
      createdAt: 1,
      updatedAt: 1,
      lastSeenAt: 1,
    },
    config: {
      port: '18080',
      sandbox: true,
      autoUpdate: false,
      logLevel: 'info',
      corsOrigins: '*',
    },
    logs: '',
    health: {
      score: 100,
      status: 'healthy',
      checks: [],
      evaluatedAt: 1,
    },
    lifecycle: {
      owner: 'remoteService',
      startStopSupported: false,
      configWritable: false,
      notes: [],
    },
    storage: {
      status: 'ready',
      provider: 'localFile',
      namespace: 'fixture',
      durable: true,
      queryable: false,
      transactional: false,
      remote: false,
    },
    connectivity: {
      primaryTransport,
      endpoints: [],
    },
    observability: {
      status: 'ready',
      logAvailable: true,
      logPreview: [],
      metricsSource: 'runtime',
      lastSeenAt: 1,
    },
    dataAccess: {
      routes: [],
    },
    artifacts: [],
    capabilities: [],
    officialRuntimeNotes: [],
    workbench: null,
  };
}

await runTest('taskRuntimeService loads recent runtime tasks and task flows for OpenClaw instances', async () => {
  const taskCalls: string[] = [];
  const flowCalls: string[] = [];
  const service = createTaskRuntimeService({
    getInstanceDetail: async () => createDetail({ runtimeKind: 'openclaw' }),
    listRuntimeTasks: async (instanceId) => {
      taskCalls.push(instanceId);
      return [
        {
          id: 'task-run-1',
          kind: 'subagent',
          status: 'running',
          summary: 'Expand the release evidence review.',
          deliveryStatus: 'pending',
          notifyPolicy: 'state_changes',
          runId: 'run-42',
          childSessionKey: 'session-child',
          requesterSessionKey: 'main',
          flowId: 'flow-1',
          flowLookupKey: 'release-review',
          flowState: 'running',
          flowSyncMode: 'managed',
          flowRevision: 3,
          updatedAt: '2026-04-07T08:00:00.000Z',
          raw: {
            id: 'task-run-1',
          },
        },
      ];
    },
    listTaskFlows: async (instanceId) => {
      flowCalls.push(instanceId);
      return [
        {
          id: 'flow-1',
          lookupKey: 'release-review',
          state: 'running',
          ownerKey: 'agent:main:main',
          requesterOrigin: {
            channel: 'slack',
            to: 'channel:ops',
            accountId: 'ops-bot',
            threadId: '171234',
          },
          notifyPolicy: 'state_changes',
          goal: 'Review the release package',
          currentStep: 'Compare desktop and server artifacts',
          cancelRequestedAt: '2026-04-07T08:00:50.000Z',
          syncMode: 'managed',
          revision: 3,
          taskCount: 2,
          activeTaskCount: 1,
          summary: 'Release review orchestration',
          updatedAt: '2026-04-07T08:00:00.000Z',
          raw: {
            id: 'flow-1',
          },
        },
      ];
    },
  });

  const overview = await service.getOverview('runtime-1');

  assert.equal(overview.runtimeTaskSurface, true);
  assert.equal(overview.taskBoard.supported, true);
  assert.equal(overview.taskFlows.supported, true);
  assert.equal(overview.taskBoard.items[0]?.id, 'task-run-1');
  assert.equal(overview.taskBoard.items[0]?.deliveryStatus, 'pending');
  assert.equal(overview.taskBoard.items[0]?.flowLookupKey, 'release-review');
  assert.equal(overview.taskFlows.items[0]?.syncMode, 'managed');
  assert.equal(overview.taskFlows.items[0]?.goal, 'Review the release package');
  assert.equal(overview.taskFlows.items[0]?.currentStep, 'Compare desktop and server artifacts');
  assert.equal(overview.taskFlows.items[0]?.notifyPolicy, 'state_changes');
  assert.equal(overview.taskFlows.items[0]?.ownerKey, 'agent:main:main');
  assert.deepEqual(overview.taskFlows.items[0]?.requesterOrigin, {
    channel: 'slack',
    to: 'channel:ops',
    accountId: 'ops-bot',
    threadId: '171234',
  });
  assert.equal(overview.taskFlows.items[0]?.cancelRequestedAt, '2026-04-07T08:00:50.000Z');
  assert.deepEqual(taskCalls, ['runtime-1']);
  assert.deepEqual(flowCalls, ['runtime-1']);
});

await runTest('taskRuntimeService loads recent runtime tasks and task flows for gateway task-surface instances even when runtimeKind is custom', async () => {
  const taskCalls: string[] = [];
  const flowCalls: string[] = [];
  const service = createTaskRuntimeService({
    getInstanceDetail: async () =>
      createDetail({
        runtimeKind: 'custom',
        transportKind: 'openclawGatewayWs',
        primaryTransport: 'openclawGatewayWs',
      }),
    listRuntimeTasks: async (instanceId) => {
      taskCalls.push(instanceId);
      return [
        {
          id: 'task-run-custom-1',
          kind: 'subagent',
          status: 'queued',
          summary: 'Gateway-routed runtime task.',
          raw: {
            id: 'task-run-custom-1',
          },
        },
      ];
    },
    listTaskFlows: async (instanceId) => {
      flowCalls.push(instanceId);
      return [
        {
          id: 'flow-custom-1',
          lookupKey: 'custom-gateway-flow',
          state: 'running',
          summary: 'Gateway-routed task flow.',
          updatedAt: '2026-04-07T08:00:00.000Z',
          raw: {
            id: 'flow-custom-1',
          },
        },
      ];
    },
  });

  const overview = await service.getOverview('runtime-1');

  assert.equal(overview.runtimeTaskSurface, true);
  assert.equal(overview.taskBoard.supported, true);
  assert.equal(overview.taskFlows.supported, true);
  assert.equal(overview.taskBoard.items[0]?.id, 'task-run-custom-1');
  assert.equal(overview.taskFlows.items[0]?.lookupKey, 'custom-gateway-flow');
  assert.deepEqual(taskCalls, ['runtime-1']);
  assert.deepEqual(flowCalls, ['runtime-1']);
});

await runTest('taskRuntimeService skips runtime task loading for non-OpenClaw instances', async () => {
  const calls: string[] = [];
  const service = createTaskRuntimeService({
    getInstanceDetail: async () => createDetail({ runtimeKind: 'custom' }),
    listRuntimeTasks: async (instanceId) => {
      calls.push(`task:${instanceId}`);
      return [];
    },
    listTaskFlows: async (instanceId) => {
      calls.push(`flow:${instanceId}`);
      return [];
    },
  });

  const overview = await service.getOverview('runtime-1');

  assert.equal(overview.runtimeTaskSurface, false);
  assert.equal(overview.taskBoard.supported, false);
  assert.equal(overview.taskFlows.supported, false);
  assert.deepEqual(calls, []);
});

await runTest('taskRuntimeService degrades gracefully when the runtime does not expose the latest task runtime surfaces', async () => {
  const unsupportedError = new OpenClawGatewayAccessError({
    status: 'tool_denied',
    message: 'tasks.list is not available on this runtime.',
    endpoint: 'http://127.0.0.1:18080',
    httpStatus: 404,
  });
  const service = createTaskRuntimeService({
    getInstanceDetail: async () => createDetail({ runtimeKind: 'openclaw' }),
    listRuntimeTasks: async () => {
      throw unsupportedError;
    },
    listTaskFlows: async () => {
      throw unsupportedError;
    },
  });

  const overview = await service.getOverview('runtime-1');

  assert.equal(overview.runtimeTaskSurface, true);
  assert.equal(overview.taskBoard.supported, false);
  assert.equal(overview.taskFlows.supported, false);
  assert.match(String(overview.taskBoard.message), /tasks\.list is not available/i);
  assert.match(String(overview.taskFlows.message), /tasks\.list is not available/i);
});

await runTest('taskRuntimeService delegates Task Flow detail lookup for OpenClaw instances', async () => {
  const detailCalls: Array<{ instanceId: string; lookup: string }> = [];
  const service = createTaskRuntimeService({
    getInstanceDetail: async () => createDetail({ runtimeKind: 'openclaw' }),
    getTaskFlowDetail: async (instanceId, lookup) => {
      detailCalls.push({ instanceId, lookup });
      return {
        id: 'flow-1',
        lookupKey: 'release-review',
        state: 'waiting',
        goal: 'Review the release package',
        currentStep: 'Wait for release-manager approval',
        requesterOrigin: {
          channel: 'slack',
          to: 'channel:ops',
          accountId: 'ops-bot',
          threadId: '171234',
        },
        statePayload: {
          phase: 'approval',
        },
        waitPayload: {
          kind: 'approval',
        },
        blocked: {
          taskId: 'task-approve-1',
          summary: 'Awaiting release-manager approval',
        },
        tasks: [
          {
            id: 'task-approve-1',
            runtime: 'subagent',
            label: 'Approval',
            title: 'Request release approval',
            status: 'running',
            progressSummary: 'Waiting for release-manager approval.',
            terminalSummary: 'Needs manual approval.',
            terminalOutcome: 'blocked',
            raw: {
              id: 'task-approve-1',
            },
          },
        ],
        taskSummary: {
          total: 1,
          active: 1,
          terminal: 0,
          failures: 0,
          byStatus: {
            running: 1,
          },
          byRuntime: {
            subagent: 1,
          },
        },
        raw: {
          id: 'flow-1',
        },
      };
    },
  });

  const detail = await service.getTaskFlowDetail('runtime-1', 'release-review');

  assert.equal(detail?.lookupKey, 'release-review');
  assert.equal(detail?.state, 'waiting');
  assert.deepEqual(detail?.requesterOrigin, {
    channel: 'slack',
    to: 'channel:ops',
    accountId: 'ops-bot',
    threadId: '171234',
  });
  assert.equal(detail?.blocked?.summary, 'Awaiting release-manager approval');
  assert.equal(detail?.tasks[0]?.label, 'Approval');
  assert.equal(detail?.tasks[0]?.title, 'Request release approval');
  assert.equal(detail?.tasks[0]?.progressSummary, 'Waiting for release-manager approval.');
  assert.equal(detail?.tasks[0]?.terminalSummary, 'Needs manual approval.');
  assert.equal(detail?.tasks[0]?.terminalOutcome, 'blocked');
  assert.equal(detail?.taskSummary?.byRuntime?.subagent, 1);
  assert.deepEqual(detailCalls, [
    {
      instanceId: 'runtime-1',
      lookup: 'release-review',
    },
  ]);
});

await runTest('taskRuntimeService delegates detached runtime task detail lookup for OpenClaw instances', async () => {
  const detailCalls: Array<{ instanceId: string; lookup: string }> = [];
  const service = createTaskRuntimeService({
    getInstanceDetail: async () => createDetail({ runtimeKind: 'openclaw' }),
    getRuntimeTaskDetail: async (instanceId, lookup) => {
      detailCalls.push({ instanceId, lookup });
      return {
        id: 'task-run-1',
        runtime: 'subagent',
        sourceId: 'release-review-cron',
        sessionKey: 'main',
        ownerKey: 'agent:main:main',
        childSessionKey: 'session-child',
        parentTaskId: 'task-parent-1',
        agentId: 'release-manager',
        runId: 'run-42',
        label: 'Approval',
        title: 'Request release approval',
        status: 'running',
        deliveryStatus: 'pending',
        notifyPolicy: 'state_changes',
        progressSummary: 'Waiting for release-manager approval.',
        terminalSummary: 'Needs manual approval.',
        terminalOutcome: 'blocked',
        updatedAt: '2026-04-07T08:00:00.000Z',
        cleanupAfter: '2026-04-07T09:00:00.000Z',
        raw: {
          id: 'task-run-1',
        },
      };
    },
  });

  const detail = await service.getRuntimeTaskDetail('runtime-1', 'task-run-1');

  assert.equal(detail?.id, 'task-run-1');
  assert.equal(detail?.sourceId, 'release-review-cron');
  assert.equal(detail?.ownerKey, 'agent:main:main');
  assert.equal(detail?.deliveryStatus, 'pending');
  assert.equal(detail?.progressSummary, 'Waiting for release-manager approval.');
  assert.equal(detail?.terminalSummary, 'Needs manual approval.');
  assert.equal(detail?.terminalOutcome, 'blocked');
  assert.deepEqual(detailCalls, [
    {
      instanceId: 'runtime-1',
      lookup: 'task-run-1',
    },
  ]);
});

await runTest('taskRuntimeService skips Task Flow detail lookup for non-OpenClaw instances', async () => {
  const detailCalls: Array<{ instanceId: string; lookup: string }> = [];
  const service = createTaskRuntimeService({
    getInstanceDetail: async () => createDetail({ runtimeKind: 'custom' }),
    getTaskFlowDetail: async (instanceId, lookup) => {
      detailCalls.push({ instanceId, lookup });
      return null;
    },
  });

  const detail = await service.getTaskFlowDetail('runtime-1', 'release-review');

  assert.equal(detail, null);
  assert.deepEqual(detailCalls, []);
});

await runTest('taskRuntimeService skips detached runtime task detail lookup for non-OpenClaw instances', async () => {
  const detailCalls: Array<{ instanceId: string; lookup: string }> = [];
  const service = createTaskRuntimeService({
    getInstanceDetail: async () => createDetail({ runtimeKind: 'custom' }),
    getRuntimeTaskDetail: async (instanceId, lookup) => {
      detailCalls.push({ instanceId, lookup });
      return null;
    },
  });

  const detail = await service.getRuntimeTaskDetail('runtime-1', 'task-run-1');

  assert.equal(detail, null);
  assert.deepEqual(detailCalls, []);
});
