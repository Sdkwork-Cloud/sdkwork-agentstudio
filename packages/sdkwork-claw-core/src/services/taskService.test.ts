import assert from 'node:assert/strict';
import type { StudioInstanceDetailRecord, StudioWorkbenchSnapshot } from '@sdkwork/claw-types';
import { configurePlatformBridge, getPlatformBridge } from '@sdkwork/claw-infrastructure';
import { taskService } from './taskService.ts';

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

function createWorkbenchTask(id: string, overrides: Partial<StudioWorkbenchSnapshot['cronTasks']['tasks'][number]> = {}) {
  return {
    id,
    name: overrides.name || 'Backend Task',
    description: overrides.description,
    prompt: overrides.prompt || 'Summarize current status.',
    schedule: overrides.schedule || '0 * * * *',
    scheduleMode: overrides.scheduleMode || 'cron',
    scheduleConfig: overrides.scheduleConfig || {
      cronExpression: '0 * * * *',
    },
    cronExpression: overrides.cronExpression || '0 * * * *',
    actionType: overrides.actionType || 'skill',
    status: overrides.status || 'active',
    sessionMode: overrides.sessionMode || 'isolated',
    customSessionId: overrides.customSessionId,
    wakeUpMode: overrides.wakeUpMode || 'immediate',
    executionContent: overrides.executionContent || 'runAssistantTask',
    timeoutSeconds: overrides.timeoutSeconds,
    deleteAfterRun: overrides.deleteAfterRun,
    agentId: overrides.agentId,
    model: overrides.model,
    thinking: overrides.thinking,
    lightContext: overrides.lightContext,
    deliveryMode: overrides.deliveryMode || 'publishSummary',
    deliveryBestEffort: overrides.deliveryBestEffort,
    deliveryChannel: overrides.deliveryChannel,
    deliveryLabel: overrides.deliveryLabel,
    recipient: overrides.recipient,
    lastRun: overrides.lastRun,
    nextRun: overrides.nextRun,
    latestExecution: overrides.latestExecution || null,
    rawDefinition: overrides.rawDefinition,
  };
}

function createOpenClawGatewayJob(
  id: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    name: typeof overrides.name === 'string' ? overrides.name : 'OpenClaw Gateway Task',
    description:
      typeof overrides.description === 'string'
        ? overrides.description
        : 'Runtime-authored OpenClaw cron job.',
    enabled: overrides.enabled !== false,
    createdAtMs: typeof overrides.createdAtMs === 'number' ? overrides.createdAtMs : 100,
    updatedAtMs: typeof overrides.updatedAtMs === 'number' ? overrides.updatedAtMs : 200,
    schedule:
      overrides.schedule && typeof overrides.schedule === 'object'
        ? overrides.schedule
        : {
            kind: 'cron',
            expr: '0 * * * *',
          },
    sessionTarget:
      typeof overrides.sessionTarget === 'string' ? overrides.sessionTarget : 'isolated',
    wakeMode: typeof overrides.wakeMode === 'string' ? overrides.wakeMode : 'now',
    payload:
      overrides.payload && typeof overrides.payload === 'object'
        ? overrides.payload
        : {
            kind: 'agentTurn',
            message: typeof overrides.prompt === 'string' ? overrides.prompt : 'Summarize gateway status.',
          },
    delivery:
      overrides.delivery && typeof overrides.delivery === 'object'
        ? overrides.delivery
        : {
            mode: 'announce',
            channel: 'telegram',
          },
    state:
      overrides.state && typeof overrides.state === 'object'
        ? overrides.state
        : {
            nextRunAtMs: 1742432400000,
          },
    ...(overrides.agentId ? { agentId: overrides.agentId } : {}),
    ...(typeof overrides.deleteAfterRun === 'boolean'
      ? { deleteAfterRun: overrides.deleteAfterRun }
      : {}),
  };
}

function createDetail(input: {
  id: string;
  runtimeKind?: 'openclaw' | 'custom';
  deploymentMode?: 'remote' | 'local-managed';
  transportKind?: string;
  isBuiltIn?: boolean;
  authToken?: string;
  workbench?: StudioWorkbenchSnapshot | null;
}): StudioInstanceDetailRecord {
  return {
    instance: {
      id: input.id,
      name: `Instance ${input.id}`,
      description: 'Task service fixture.',
      runtimeKind: input.runtimeKind || 'custom',
      deploymentMode: input.deploymentMode || 'remote',
      transportKind: input.transportKind || 'customHttp',
      status: 'online',
      isBuiltIn: input.isBuiltIn === true,
      isDefault: false,
      iconType: 'server',
      version: 'test',
      typeLabel: 'Fixture',
      host: '127.0.0.1',
      port: 18080,
      baseUrl: 'http://127.0.0.1:18080',
      websocketUrl: null,
      cpu: 0,
      memory: 0,
      totalMemory: '0 GB',
      uptime: '0m',
      capabilities: ['chat', 'tasks', 'models'],
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
        ...(input.authToken ? { authToken: input.authToken } : {}),
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
      ...(input.authToken ? { authToken: input.authToken } : {}),
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
      primaryTransport: input.transportKind || 'customHttp',
      endpoints: [],
    },
    observability: {
      status: 'limited',
      logAvailable: false,
      logPreview: [],
      metricsSource: 'derived',
      lastSeenAt: 1,
    },
    dataAccess: {
      routes: [],
    },
    artifacts: [],
    capabilities: [],
    officialRuntimeNotes: [],
    workbench: input.workbench || null,
  };
}

await runTest('taskService uses backend-authored workbench tasks for non-OpenClaw runtimes', async () => {
  const originalBridge = getPlatformBridge();

  configurePlatformBridge({
    studio: {
      ...originalBridge.studio,
      async getInstanceDetail(instanceId) {
        return createDetail({
          id: instanceId,
          workbench: {
            channels: [],
            cronTasks: {
              tasks: [createWorkbenchTask('backend-task-1', { name: 'Backend Authored Task' })],
              taskExecutionsById: {},
            },
            llmProviders: [],
            agents: [],
            skills: [],
            files: [],
            memory: [],
            tools: [],
          },
        });
      },
    },
  });

  try {
    const tasks = await taskService.getTasks('custom-runtime');

    assert.equal(tasks.length, 1);
    assert.equal(tasks[0]?.id, 'backend-task-1');
    assert.equal(tasks[0]?.name, 'Backend Authored Task');
  } finally {
    configurePlatformBridge(originalBridge);
  }
});

await runTest('taskService routes createTask through the studio bridge when a non-OpenClaw workbench exists', async () => {
  const originalBridge = getPlatformBridge();
  const createCalls: Array<{ instanceId: string; taskName: string }> = [];
  let stage: 'before' | 'after' = 'before';

  configurePlatformBridge({
    studio: {
      ...originalBridge.studio,
      async getInstanceDetail(instanceId) {
        return createDetail({
          id: instanceId,
          workbench: {
            channels: [],
            cronTasks: {
              tasks:
                stage === 'after'
                  ? [createWorkbenchTask('backend-task-2', { name: 'Created Through Bridge' })]
                  : [],
              taskExecutionsById: {},
            },
            llmProviders: [],
            agents: [],
            skills: [],
            files: [],
            memory: [],
            tools: [],
          },
        });
      },
      async createInstanceTask(instanceId, payload) {
        createCalls.push({
          instanceId,
          taskName: String((payload as Record<string, unknown>).name || ''),
        });
        stage = 'after';
      },
    },
  });

  try {
    const created = await taskService.createTask('custom-runtime', {
      name: 'Created Through Bridge',
      prompt: 'Create through backend workbench.',
      schedule: '0 * * * *',
      scheduleMode: 'cron',
      scheduleConfig: {
        cronExpression: '0 * * * *',
      },
      cronExpression: '0 * * * *',
      actionType: 'skill',
      status: 'active',
      sessionMode: 'isolated',
      wakeUpMode: 'immediate',
      executionContent: 'runAssistantTask',
      deliveryMode: 'publishSummary',
    });

    assert.deepEqual(createCalls, [
      {
        instanceId: 'custom-runtime',
        taskName: 'Created Through Bridge',
      },
    ]);
    assert.equal(created.id, 'backend-task-2');
    assert.equal(created.name, 'Created Through Bridge');
  } finally {
    configurePlatformBridge(originalBridge);
  }
});

await runTest('taskService rejects createTask when the instance has no real task workbench', async () => {
  const originalBridge = getPlatformBridge();

  configurePlatformBridge({
    studio: {
      ...originalBridge.studio,
      async getInstanceDetail(instanceId) {
        return createDetail({
          id: instanceId,
          workbench: null,
        });
      },
    },
  });

  try {
    await assert.rejects(
      () =>
        taskService.createTask('detail-only-runtime', {
          name: 'Should Fail',
          prompt: 'No task surface available.',
          schedule: '0 * * * *',
          scheduleMode: 'cron',
          scheduleConfig: {
            cronExpression: '0 * * * *',
          },
          cronExpression: '0 * * * *',
          actionType: 'skill',
          status: 'active',
          sessionMode: 'isolated',
          wakeUpMode: 'immediate',
          executionContent: 'runAssistantTask',
          deliveryMode: 'publishSummary',
        }),
      /Task management is not available for this instance\./,
    );
  } finally {
    configurePlatformBridge(originalBridge);
  }
});

await runTest('taskService lists delivery channels from backend-authored non-OpenClaw workbenches', async () => {
  const originalBridge = getPlatformBridge();

  configurePlatformBridge({
    studio: {
      ...originalBridge.studio,
      async getInstanceDetail(instanceId) {
        return createDetail({
          id: instanceId,
          workbench: {
            channels: [
              {
                id: 'telegram',
                name: 'Telegram',
                description: 'Telegram bridge.',
                status: 'connected',
                enabled: true,
                fieldCount: 2,
                configuredFieldCount: 2,
                setupSteps: [],
              },
              {
                id: 'slack',
                name: 'Slack',
                description: 'Slack bridge.',
                status: 'disconnected',
                enabled: true,
                fieldCount: 2,
                configuredFieldCount: 1,
                setupSteps: [],
              },
            ],
            cronTasks: {
              tasks: [],
              taskExecutionsById: {},
            },
            llmProviders: [],
            agents: [],
            skills: [],
            files: [],
            memory: [],
            tools: [],
          },
        });
      },
    },
  });

  try {
    const channels = await taskService.listDeliveryChannels('custom-runtime');

    assert.deepEqual(channels, [
      {
        id: 'telegram',
        name: 'Telegram',
      },
    ]);
  } finally {
    configurePlatformBridge(originalBridge);
  }
});

await runTest('taskService filters backend workbench tasks with blank or duplicate ids before exposing them to the UI', async () => {
  const originalBridge = getPlatformBridge();

  configurePlatformBridge({
    studio: {
      ...originalBridge.studio,
      async getInstanceDetail(instanceId) {
        return createDetail({
          id: instanceId,
          workbench: {
            channels: [],
            cronTasks: {
              tasks: [
                createWorkbenchTask('', { name: 'Missing Id' }),
                createWorkbenchTask('task-1', { name: 'First Valid Task' }),
                createWorkbenchTask('task-1', { name: 'Duplicate Task' }),
                createWorkbenchTask('task-2', { name: 'Second Valid Task' }),
              ],
              taskExecutionsById: {},
            },
            llmProviders: [],
            agents: [],
            skills: [],
            files: [],
            memory: [],
            tools: [],
          },
        });
      },
    },
  });

  try {
    const tasks = await taskService.getTasks('custom-runtime');

    assert.deepEqual(
      tasks.map((task) => ({ id: task.id, name: task.name })),
      [
        {
          id: 'task-1',
          name: 'First Valid Task',
        },
        {
          id: 'task-2',
          name: 'Second Valid Task',
        },
      ],
    );
  } finally {
    configurePlatformBridge(originalBridge);
  }
});

await runTest('taskService filters delivery channels with blank or duplicate ids before exposing them to the UI', async () => {
  const originalBridge = getPlatformBridge();

  configurePlatformBridge({
    studio: {
      ...originalBridge.studio,
      async getInstanceDetail(instanceId) {
        return createDetail({
          id: instanceId,
          workbench: {
            channels: [
              {
                id: '',
                name: 'Missing Id',
                description: 'Missing id channel.',
                status: 'connected',
                enabled: true,
                fieldCount: 1,
                configuredFieldCount: 1,
                setupSteps: [],
              },
              {
                id: 'telegram',
                name: 'Telegram',
                description: 'Telegram bridge.',
                status: 'connected',
                enabled: true,
                fieldCount: 2,
                configuredFieldCount: 2,
                setupSteps: [],
              },
              {
                id: 'telegram',
                name: 'Telegram Duplicate',
                description: 'Duplicate bridge.',
                status: 'connected',
                enabled: true,
                fieldCount: 2,
                configuredFieldCount: 2,
                setupSteps: [],
              },
              {
                id: 'slack',
                name: 'Slack',
                description: 'Slack bridge.',
                status: 'connected',
                enabled: true,
                fieldCount: 2,
                configuredFieldCount: 2,
                setupSteps: [],
              },
            ],
            cronTasks: {
              tasks: [],
              taskExecutionsById: {},
            },
            llmProviders: [],
            agents: [],
            skills: [],
            files: [],
            memory: [],
            tools: [],
          },
        });
      },
    },
  });

  try {
    const channels = await taskService.listDeliveryChannels('custom-runtime');

    assert.deepEqual(channels, [
      {
        id: 'telegram',
        name: 'Telegram',
      },
      {
        id: 'slack',
        name: 'Slack',
      },
    ]);
  } finally {
    configurePlatformBridge(originalBridge);
  }
});

await runTest('taskService prefers backend-authored OpenClaw workbench tasks before direct gateway fallback', async () => {
  const originalBridge = getPlatformBridge();
  const gatewayCalls: Array<{ instanceId: string; request: Record<string, unknown> }> = [];

  configurePlatformBridge({
    studio: {
      ...originalBridge.studio,
      async getInstanceDetail(instanceId) {
        return createDetail({
          id: instanceId,
          runtimeKind: 'openclaw',
          deploymentMode: 'local-managed',
          transportKind: 'openclawGatewayWs',
          isBuiltIn: true,
          workbench: {
            channels: [],
            cronTasks: {
              tasks: [
                createWorkbenchTask('backend-openclaw-task-1', {
                  name: 'Backend OpenClaw Task',
                  prompt: 'Serve tasks from backend workbench first.',
                }),
              ],
              taskExecutionsById: {},
            },
            llmProviders: [],
            agents: [],
            skills: [],
            files: [],
            memory: [],
            tools: [],
          },
        });
      },
      async invokeOpenClawGateway(instanceId, request) {
        gatewayCalls.push({
          instanceId,
          request: request as Record<string, unknown>,
        });
        throw new Error('gateway should stay idle while backend workbench is available');
      },
    },
  });

  try {
    const tasks = await taskService.getTasks('openclaw-backend-authored');

    assert.deepEqual(
      tasks.map((task) => ({ id: task.id, name: task.name })),
      [
        {
          id: 'backend-openclaw-task-1',
          name: 'Backend OpenClaw Task',
        },
      ],
    );
    assert.deepEqual(gatewayCalls, []);
  } finally {
    configurePlatformBridge(originalBridge);
  }
});

await runTest('taskService routes backend-authored OpenClaw task mutations and follow-up actions through the studio bridge', async () => {
  const originalBridge = getPlatformBridge();
  const gatewayCalls: Array<{ instanceId: string; request: Record<string, unknown> }> = [];
  const studioUpdateCalls: Array<{ instanceId: string; id: string }> = [];
  const studioCloneCalls: Array<{ instanceId: string; id: string; name: string | undefined }> = [];
  const studioRunCalls: Array<{ instanceId: string; id: string }> = [];
  const studioHistoryCalls: Array<{ instanceId: string; id: string }> = [];
  const studioStatusCalls: Array<{ instanceId: string; id: string; status: string }> = [];
  const studioDeleteCalls: Array<{ instanceId: string; id: string }> = [];
  let tasks = [
    createWorkbenchTask('backend-openclaw-task-2', {
      name: 'Backend OpenClaw Mutable Task',
      prompt: 'Original backend-authored prompt.',
      status: 'active',
    }),
  ];
  const taskExecutionsById: Record<string, Array<Record<string, unknown>>> = {
    'backend-openclaw-task-2': [
      {
        id: 'exec-backend-openclaw-task-2-1',
        taskId: 'backend-openclaw-task-2',
        status: 'success',
        trigger: 'schedule',
        startedAt: '2026-04-06T00:00:00.000Z',
        finishedAt: '2026-04-06T00:01:00.000Z',
        summary: 'Existing backend execution.',
      },
    ],
  };

  configurePlatformBridge({
    studio: {
      ...originalBridge.studio,
      async getInstanceDetail(instanceId) {
        return createDetail({
          id: instanceId,
          runtimeKind: 'openclaw',
          deploymentMode: 'local-managed',
          transportKind: 'openclawGatewayWs',
          isBuiltIn: true,
          workbench: {
            channels: [],
            cronTasks: {
              tasks,
              taskExecutionsById,
            },
            llmProviders: [],
            agents: [],
            skills: [],
            files: [],
            memory: [],
            tools: [],
          },
        });
      },
      async invokeOpenClawGateway(instanceId, request) {
        gatewayCalls.push({
          instanceId,
          request: request as Record<string, unknown>,
        });
        throw new Error('gateway should stay idle for backend-authored openclaw task actions');
      },
      async updateInstanceTask(instanceId, id) {
        studioUpdateCalls.push({ instanceId, id });
        tasks = tasks.map((task) =>
          task.id === id
            ? createWorkbenchTask(id, {
                name: 'Backend OpenClaw Task Updated',
                prompt: 'Updated through backend task bridge.',
                status: 'active',
              })
            : task,
        );
      },
      async cloneInstanceTask(instanceId, id, name) {
        studioCloneCalls.push({ instanceId, id, name });
        tasks = [
          ...tasks,
          createWorkbenchTask('backend-openclaw-task-2-clone', {
            name: name || 'Backend OpenClaw Task Clone',
            prompt: 'Original backend-authored prompt.',
            status: 'active',
          }),
        ];
      },
      async runInstanceTaskNow(instanceId, id) {
        studioRunCalls.push({ instanceId, id });
        const execution = {
          id: `exec-${id}-manual`,
          taskId: id,
          status: 'running',
          trigger: 'manual',
          startedAt: '2026-04-06T02:00:00.000Z',
          summary: 'Backend execution queued.',
        };
        taskExecutionsById[id] = [execution, ...(taskExecutionsById[id] || [])];
        return execution;
      },
      async listInstanceTaskExecutions(instanceId, id) {
        studioHistoryCalls.push({ instanceId, id });
        return (taskExecutionsById[id] || []) as never;
      },
      async updateInstanceTaskStatus(instanceId, id, status) {
        studioStatusCalls.push({ instanceId, id, status });
        tasks = tasks.map((task) =>
          task.id === id
            ? createWorkbenchTask(id, {
                name: task.name,
                prompt: task.prompt,
                status,
              })
            : task,
        );
      },
      async deleteInstanceTask(instanceId, id) {
        studioDeleteCalls.push({ instanceId, id });
        tasks = tasks.filter((task) => task.id !== id);
        delete taskExecutionsById[id];
        return true;
      },
    },
  });

  try {
    await taskService.getTasks('openclaw-backend-actions');
    const updated = await taskService.updateTask(
      'backend-openclaw-task-2',
      {
        name: 'Backend OpenClaw Task Updated',
        prompt: 'Updated through backend task bridge.',
      },
      'openclaw-backend-actions',
    );
    const cloned = await taskService.cloneTask(
      'backend-openclaw-task-2',
      {
        name: 'Backend OpenClaw Task Clone',
      },
      'openclaw-backend-actions',
    );
    const execution = await taskService.runTaskNow(
      'backend-openclaw-task-2',
      'openclaw-backend-actions',
    );
    const history = await taskService.listTaskExecutions(
      'backend-openclaw-task-2',
      'openclaw-backend-actions',
    );
    await taskService.updateTaskStatus(
      'backend-openclaw-task-2',
      'paused',
      'openclaw-backend-actions',
    );
    await taskService.deleteTask(
      'backend-openclaw-task-2-clone',
      'openclaw-backend-actions',
    );

    assert.equal(updated.name, 'Backend OpenClaw Task Updated');
    assert.equal(updated.prompt, 'Updated through backend task bridge.');
    assert.equal(cloned.id, 'backend-openclaw-task-2-clone');
    assert.equal(cloned.name, 'Backend OpenClaw Task Clone');
    assert.equal(execution.taskId, 'backend-openclaw-task-2');
    assert.equal(execution.status, 'running');
    assert.equal(history[0]?.taskId, 'backend-openclaw-task-2');
    assert.deepEqual(studioUpdateCalls, [
      {
        instanceId: 'openclaw-backend-actions',
        id: 'backend-openclaw-task-2',
      },
    ]);
    assert.deepEqual(studioCloneCalls, [
      {
        instanceId: 'openclaw-backend-actions',
        id: 'backend-openclaw-task-2',
        name: 'Backend OpenClaw Task Clone',
      },
    ]);
    assert.deepEqual(studioRunCalls, [
      {
        instanceId: 'openclaw-backend-actions',
        id: 'backend-openclaw-task-2',
      },
    ]);
    assert.deepEqual(studioHistoryCalls, [
      {
        instanceId: 'openclaw-backend-actions',
        id: 'backend-openclaw-task-2',
      },
    ]);
    assert.deepEqual(studioStatusCalls, [
      {
        instanceId: 'openclaw-backend-actions',
        id: 'backend-openclaw-task-2',
        status: 'paused',
      },
    ]);
    assert.deepEqual(studioDeleteCalls, [
      {
        instanceId: 'openclaw-backend-actions',
        id: 'backend-openclaw-task-2-clone',
      },
    ]);
    assert.deepEqual(gatewayCalls, []);
  } finally {
    configurePlatformBridge(originalBridge);
  }
});

await runTest('taskService uses gateway-authored cron jobs for instances that expose the gateway task transport even when runtimeKind is custom', async () => {
  const originalBridge = getPlatformBridge();
  const originalFetch = globalThis.fetch;
  const gatewayCalls: Array<{ instanceId: string; request: Record<string, unknown> }> = [];
  const httpCalls: Array<{
    url: string;
    authorization: string | null;
    request: Record<string, unknown>;
  }> = [];

  configurePlatformBridge({
    studio: {
      ...originalBridge.studio,
      async getInstanceDetail(instanceId) {
        return createDetail({
          id: instanceId,
          runtimeKind: 'custom',
          deploymentMode: 'local-managed',
          transportKind: 'openclawGatewayWs',
          isBuiltIn: true,
          authToken: 'custom-gateway-token',
          workbench: null,
        });
      },
      async invokeOpenClawGateway(instanceId, request) {
        gatewayCalls.push({
          instanceId,
          request: request as Record<string, unknown>,
        });
        return {
          items: [
            createOpenClawGatewayJob('gateway-custom-task-1', {
              name: 'Gateway Task Surface',
              prompt: 'Route by transport, not runtime kind.',
            }),
          ],
        };
      },
    },
  });
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    httpCalls.push({
      url: String(input),
      authorization:
        init?.headers && typeof init.headers === 'object' && !Array.isArray(init.headers)
          ? ((init.headers as Record<string, string>).Authorization ?? null)
          : null,
      request: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        result: {
          items: [
            createOpenClawGatewayJob('gateway-custom-task-1', {
              name: 'Gateway Task Surface',
              prompt: 'Route by transport, not runtime kind.',
            }),
          ],
        },
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );
  }) as typeof fetch;

  try {
    const tasks = await taskService.getTasks('custom-gateway-runtime');

    assert.equal(tasks.length, 1);
    assert.equal(tasks[0]?.id, 'gateway-custom-task-1');
    assert.equal(tasks[0]?.name, 'Gateway Task Surface');
    assert.deepEqual(gatewayCalls, []);
    assert.deepEqual(httpCalls, [
      {
        url: 'http://127.0.0.1:18080/tools/invoke',
        authorization: 'Bearer custom-gateway-token',
        request: {
          tool: 'cron',
          action: 'list',
          args: {
            includeDisabled: true,
          },
        },
      },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    configurePlatformBridge(originalBridge);
  }
});

await runTest('taskService uses gateway-authored cron jobs for OpenClaw runtimes', async () => {
  const originalBridge = getPlatformBridge();
  const gatewayCalls: Array<{ instanceId: string; request: Record<string, unknown> }> = [];

  configurePlatformBridge({
    studio: {
      ...originalBridge.studio,
      async getInstanceDetail(instanceId) {
        return createDetail({
          id: instanceId,
          runtimeKind: 'openclaw',
          deploymentMode: 'local-managed',
          transportKind: 'openclawGatewayWs',
          isBuiltIn: true,
          workbench: null,
        });
      },
      async invokeOpenClawGateway(instanceId, request) {
        gatewayCalls.push({
          instanceId,
          request: request as Record<string, unknown>,
        });
        return {
          items: [
            createOpenClawGatewayJob('gateway-task-1', {
              name: 'Gateway Authored Task',
              prompt: 'Summarize gateway operations.',
            }),
          ],
        };
      },
      async createInstanceTask() {
        throw new Error('studio create should not be used for OpenClaw tasks');
      },
    },
  });

  try {
    const tasks = await taskService.getTasks('openclaw-local');

    assert.equal(tasks.length, 1);
    assert.equal(tasks[0]?.id, 'gateway-task-1');
    assert.equal(tasks[0]?.name, 'Gateway Authored Task');
    assert.deepEqual(gatewayCalls, [
      {
        instanceId: 'openclaw-local',
        request: {
          tool: 'cron',
          action: 'list',
          args: {
            includeDisabled: true,
          },
        },
      },
    ]);
  } finally {
    configurePlatformBridge(originalBridge);
  }
});

await runTest('taskService routes OpenClaw task creation through native cron.add', async () => {
  const originalBridge = getPlatformBridge();
  let jobs = [
    createOpenClawGatewayJob('gateway-task-1', {
      name: 'Existing Gateway Task',
      prompt: 'Existing gateway prompt.',
    }),
  ];
  const gatewayCalls: Array<{ instanceId: string; request: Record<string, unknown> }> = [];

  configurePlatformBridge({
    studio: {
      ...originalBridge.studio,
      async getInstanceDetail(instanceId) {
        return createDetail({
          id: instanceId,
          runtimeKind: 'openclaw',
          deploymentMode: 'local-managed',
          transportKind: 'openclawGatewayWs',
          isBuiltIn: true,
          workbench: null,
        });
      },
      async invokeOpenClawGateway(instanceId, request) {
        const typedRequest = request as {
          tool: string;
          action?: string;
          args?: Record<string, unknown>;
        };
        gatewayCalls.push({
          instanceId,
          request: typedRequest as Record<string, unknown>,
        });
        if (typedRequest.tool === 'cron' && typedRequest.action === 'add') {
          const payload = typedRequest.args?.job as Record<string, unknown>;
          const created = createOpenClawGatewayJob('gateway-task-2', {
            name: payload.name,
            description: payload.description,
            enabled: payload.enabled,
            schedule: payload.schedule,
            sessionTarget: payload.sessionTarget,
            wakeMode: payload.wakeMode,
            payload: payload.payload,
            delivery: payload.delivery,
            agentId: payload.agentId,
            deleteAfterRun: payload.deleteAfterRun,
          });
          jobs = [...jobs, created];
          return created;
        }
        if (typedRequest.tool === 'cron' && typedRequest.action === 'list') {
          return {
            items: jobs,
          };
        }
        throw new Error(`Unexpected gateway request ${typedRequest.tool}.${typedRequest.action}`);
      },
      async createInstanceTask() {
        throw new Error('studio create should not be used for OpenClaw tasks');
      },
    },
  });

  try {
    const created = await taskService.createTask('openclaw-local', {
      name: 'Created Through Gateway',
      prompt: 'Create through native cron api.',
      schedule: '0 * * * *',
      scheduleMode: 'cron',
      scheduleConfig: {
        cronExpression: '0 * * * *',
      },
      cronExpression: '0 * * * *',
      actionType: 'skill',
      status: 'active',
      sessionMode: 'isolated',
      wakeUpMode: 'immediate',
      executionContent: 'runAssistantTask',
      deliveryMode: 'publishSummary',
      deliveryChannel: 'telegram',
      recipient: 'channel:ops',
    });

    assert.equal(created.id, 'gateway-task-2');
    assert.equal(created.name, 'Created Through Gateway');
    assert.equal(gatewayCalls[0]?.instanceId, 'openclaw-local');
    assert.equal(gatewayCalls[0]?.request.tool, 'cron');
    assert.equal(gatewayCalls[0]?.request.action, 'add');
    assert.equal(gatewayCalls[1]?.request.action, 'list');
  } finally {
    configurePlatformBridge(originalBridge);
  }
});

await runTest('taskService updates OpenClaw tasks through native cron.update', async () => {
  const originalBridge = getPlatformBridge();
  let jobs = [
    createOpenClawGatewayJob('gateway-task-edit', {
      name: 'Gateway Editable Task',
      prompt: 'Original gateway prompt.',
    }),
  ];
  const gatewayCalls: Array<{ instanceId: string; request: Record<string, unknown> }> = [];

  configurePlatformBridge({
    studio: {
      ...originalBridge.studio,
      async getInstanceDetail(instanceId) {
        return createDetail({
          id: instanceId,
          runtimeKind: 'openclaw',
          deploymentMode: 'local-managed',
          transportKind: 'openclawGatewayWs',
          isBuiltIn: true,
          workbench: null,
        });
      },
      async invokeOpenClawGateway(instanceId, request) {
        const typedRequest = request as {
          tool: string;
          action?: string;
          args?: Record<string, unknown>;
        };
        gatewayCalls.push({
          instanceId,
          request: typedRequest as Record<string, unknown>,
        });
        if (typedRequest.tool === 'cron' && typedRequest.action === 'list') {
          return {
            items: jobs,
          };
        }
        if (typedRequest.tool === 'cron' && typedRequest.action === 'update') {
          const patch = typedRequest.args?.patch as Record<string, unknown>;
          jobs = jobs.map((job) =>
            job.id === typedRequest.args?.id
              ? {
                  ...job,
                  name: typeof patch.name === 'string' ? patch.name : job.name,
                  payload:
                    patch.payload && typeof patch.payload === 'object'
                      ? {
                          ...job.payload,
                          ...patch.payload,
                        }
                      : job.payload,
                }
              : job,
          );
          return jobs.find((job) => job.id === typedRequest.args?.id);
        }
        throw new Error(`Unexpected gateway request ${typedRequest.tool}.${typedRequest.action}`);
      },
      async updateInstanceTask() {
        throw new Error('studio update should not be used for OpenClaw tasks');
      },
    },
  });

  try {
    await taskService.getTasks('openclaw-local');
    const updated = await taskService.updateTask('gateway-task-edit', {
      name: 'Gateway Task Updated',
      prompt: 'Updated through native cron api.',
    });

    assert.equal(updated.name, 'Gateway Task Updated');
    assert.equal(updated.prompt, 'Updated through native cron api.');
    assert.deepEqual(
      gatewayCalls.map((entry) => entry.request.action),
      ['list', 'list', 'update', 'list'],
    );
  } finally {
    configurePlatformBridge(originalBridge);
  }
});

await runTest('taskService clones OpenClaw tasks through native cron.add', async () => {
  const originalBridge = getPlatformBridge();
  let jobs = [
    createOpenClawGatewayJob('gateway-task-source', {
      name: 'Gateway Clone Source',
      prompt: 'Source gateway prompt.',
    }),
  ];
  const gatewayCalls: Array<{ instanceId: string; request: Record<string, unknown> }> = [];

  configurePlatformBridge({
    studio: {
      ...originalBridge.studio,
      async getInstanceDetail(instanceId) {
        return createDetail({
          id: instanceId,
          runtimeKind: 'openclaw',
          deploymentMode: 'local-managed',
          transportKind: 'openclawGatewayWs',
          isBuiltIn: true,
          workbench: null,
        });
      },
      async invokeOpenClawGateway(instanceId, request) {
        const typedRequest = request as {
          tool: string;
          action?: string;
          args?: Record<string, unknown>;
        };
        gatewayCalls.push({
          instanceId,
          request: typedRequest as Record<string, unknown>,
        });
        if (typedRequest.tool === 'cron' && typedRequest.action === 'list') {
          return {
            items: jobs,
          };
        }
        if (typedRequest.tool === 'cron' && typedRequest.action === 'add') {
          const payload = typedRequest.args?.job as Record<string, unknown>;
          const created = createOpenClawGatewayJob('gateway-task-copy', {
            name: payload.name,
            prompt:
              payload.payload && typeof payload.payload === 'object'
                ? (payload.payload as Record<string, unknown>).message
                : 'Source gateway prompt.',
          });
          jobs = [...jobs, created];
          return created;
        }
        throw new Error(`Unexpected gateway request ${typedRequest.tool}.${typedRequest.action}`);
      },
      async cloneInstanceTask() {
        throw new Error('studio clone should not be used for OpenClaw tasks');
      },
    },
  });

  try {
    await taskService.getTasks('openclaw-local');
    const cloned = await taskService.cloneTask('gateway-task-source', {
      name: 'Gateway Clone Copy',
    });

    assert.equal(cloned.id, 'gateway-task-copy');
    assert.equal(cloned.name, 'Gateway Clone Copy');
    assert.deepEqual(
      gatewayCalls.map((entry) => entry.request.action),
      ['list', 'list', 'add', 'list'],
    );
  } finally {
    configurePlatformBridge(originalBridge);
  }
});

await runTest('taskService runs OpenClaw tasks through cron.run and reads execution history from cron.runs', async () => {
  const originalBridge = getPlatformBridge();
  const gatewayCalls: Array<{ instanceId: string; request: Record<string, unknown> }> = [];

  configurePlatformBridge({
    studio: {
      ...originalBridge.studio,
      async getInstanceDetail(instanceId) {
        return createDetail({
          id: instanceId,
          runtimeKind: 'openclaw',
          deploymentMode: 'local-managed',
          transportKind: 'openclawGatewayWs',
          isBuiltIn: true,
          workbench: null,
        });
      },
      async invokeOpenClawGateway(instanceId, request) {
        const typedRequest = request as {
          tool: string;
          action?: string;
          args?: Record<string, unknown>;
        };
        gatewayCalls.push({
          instanceId,
          request: typedRequest as Record<string, unknown>,
        });
        if (typedRequest.tool === 'cron' && typedRequest.action === 'list') {
          return {
            items: [
              createOpenClawGatewayJob('gateway-task-run', {
                name: 'Gateway Run Task',
                prompt: 'Run through native gateway.',
              }),
            ],
          };
        }
        if (typedRequest.tool === 'cron' && typedRequest.action === 'run') {
          return {
            ok: true,
            enqueued: true,
            runId: 'run-1',
          };
        }
        if (typedRequest.tool === 'cron' && typedRequest.action === 'runs') {
          return {
            items: [
              {
                ts: 1742346060000,
                jobId: 'gateway-task-run',
                action: 'finished',
                status: 'ok',
                summary: 'Gateway run finished successfully.',
                runAtMs: 1742346000000,
                durationMs: 60000,
              },
            ],
          };
        }
        throw new Error(`Unexpected gateway request ${typedRequest.tool}.${typedRequest.action}`);
      },
      async runInstanceTaskNow() {
        throw new Error('studio run should not be used for OpenClaw tasks');
      },
      async listInstanceTaskExecutions() {
        throw new Error('studio history should not be used for OpenClaw tasks');
      },
    },
  });

  try {
    await taskService.getTasks('openclaw-local');
    const execution = await taskService.runTaskNow('gateway-task-run');

    assert.equal(execution.taskId, 'gateway-task-run');
    assert.equal(execution.status, 'success');
    assert.equal(execution.summary, 'Gateway run finished successfully.');
    assert.deepEqual(
      gatewayCalls.map((entry) => ({
        instanceId: entry.instanceId,
        tool: entry.request.tool,
        action: entry.request.action,
      })),
      [
        {
          instanceId: 'openclaw-local',
          tool: 'cron',
          action: 'list',
        },
        {
          instanceId: 'openclaw-local',
          tool: 'cron',
          action: 'run',
        },
        {
          instanceId: 'openclaw-local',
          tool: 'cron',
          action: 'runs',
        },
      ],
    );
  } finally {
    configurePlatformBridge(originalBridge);
  }
});

await runTest('taskService toggles and deletes OpenClaw tasks through cron.update and cron.remove', async () => {
  const originalBridge = getPlatformBridge();
  let jobs = [
    createOpenClawGatewayJob('gateway-task-toggle', {
      name: 'Gateway Toggle Task',
    }),
  ];
  const gatewayCalls: Array<{ instanceId: string; request: Record<string, unknown> }> = [];

  configurePlatformBridge({
    studio: {
      ...originalBridge.studio,
      async getInstanceDetail(instanceId) {
        return createDetail({
          id: instanceId,
          runtimeKind: 'openclaw',
          deploymentMode: 'local-managed',
          transportKind: 'openclawGatewayWs',
          isBuiltIn: true,
          workbench: null,
        });
      },
      async invokeOpenClawGateway(instanceId, request) {
        const typedRequest = request as {
          tool: string;
          action?: string;
          args?: Record<string, unknown>;
        };
        gatewayCalls.push({
          instanceId,
          request: typedRequest as Record<string, unknown>,
        });
        if (typedRequest.tool === 'cron' && typedRequest.action === 'list') {
          return {
            items: jobs,
          };
        }
        if (typedRequest.tool === 'cron' && typedRequest.action === 'update') {
          jobs = jobs.map((job) =>
            job.id === typedRequest.args?.id
              ? {
                  ...job,
                  enabled: typedRequest.args?.patch?.enabled !== false,
                }
              : job,
          );
          return jobs.find((job) => job.id === typedRequest.args?.id);
        }
        if (typedRequest.tool === 'cron' && typedRequest.action === 'remove') {
          jobs = jobs.filter((job) => job.id !== typedRequest.args?.id);
          return {
            ok: true,
            removed: true,
          };
        }
        throw new Error(`Unexpected gateway request ${typedRequest.tool}.${typedRequest.action}`);
      },
      async updateInstanceTaskStatus() {
        throw new Error('studio status updates should not be used for OpenClaw tasks');
      },
      async deleteInstanceTask() {
        throw new Error('studio delete should not be used for OpenClaw tasks');
      },
    },
  });

  try {
    await taskService.getTasks('openclaw-local');
    await taskService.updateTaskStatus('gateway-task-toggle', 'paused');
    await taskService.deleteTask('gateway-task-toggle');

    assert.deepEqual(
      gatewayCalls.map((entry) => ({
        instanceId: entry.instanceId,
        tool: entry.request.tool,
        action: entry.request.action,
        args: entry.request.args,
      })),
      [
        {
          instanceId: 'openclaw-local',
          tool: 'cron',
          action: 'list',
          args: {
            includeDisabled: true,
          },
        },
        {
          instanceId: 'openclaw-local',
          tool: 'cron',
          action: 'update',
          args: {
            id: 'gateway-task-toggle',
            patch: {
              enabled: false,
            },
          },
        },
        {
          instanceId: 'openclaw-local',
          tool: 'cron',
          action: 'remove',
          args: {
            id: 'gateway-task-toggle',
          },
        },
      ],
    );
  } finally {
    configurePlatformBridge(originalBridge);
  }
});
