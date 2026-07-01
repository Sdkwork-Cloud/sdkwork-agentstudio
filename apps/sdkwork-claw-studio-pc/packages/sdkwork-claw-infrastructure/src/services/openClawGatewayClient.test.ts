import assert from 'node:assert/strict';
import {
  DEFAULT_BUNDLED_OPENCLAW_VERSION,
  type StudioInstanceDetailRecord,
} from '@sdkwork/claw-types';
import { configurePlatformBridge, getPlatformBridge } from '../platform/index.ts';
import {
  createOpenClawGatewayClient,
  type OpenClawInvokeRequest,
} from './openClawGatewayClient.ts';

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

function createInstanceDetail(
  overrides: Partial<StudioInstanceDetailRecord> = {},
): StudioInstanceDetailRecord {
  return {
    instance: {
      id: 'openclaw-prod',
      name: 'OpenClaw Prod',
      description: 'Primary OpenClaw gateway.',
      runtimeKind: 'openclaw',
      deploymentMode: 'remote',
      transportKind: 'openclawGatewayWs',
      status: 'online',
      isBuiltIn: false,
      isDefault: false,
      iconType: 'server',
      version: DEFAULT_BUNDLED_OPENCLAW_VERSION,
      typeLabel: 'OpenClaw Gateway',
      host: '10.0.0.8',
      port: 21280,
      baseUrl: 'http://10.0.0.8:21280',
      websocketUrl: 'ws://10.0.0.8:21280',
      cpu: 12,
      memory: 35,
      totalMemory: '64GB',
      uptime: '18h',
      capabilities: ['chat', 'health', 'tasks'],
      storage: {
        provider: 'localFile',
        namespace: 'openclaw-prod',
      },
      config: {
        port: '21280',
        sandbox: true,
        autoUpdate: true,
        logLevel: 'info',
        corsOrigins: '*',
        baseUrl: 'http://10.0.0.8:21280',
        websocketUrl: 'ws://10.0.0.8:21280',
        authToken: 'gateway-token',
      },
      createdAt: 1,
      updatedAt: 1,
      lastSeenAt: 1,
    },
    config: {
      port: '21280',
      sandbox: true,
      autoUpdate: true,
      logLevel: 'info',
      corsOrigins: '*',
      baseUrl: 'http://10.0.0.8:21280',
      websocketUrl: 'ws://10.0.0.8:21280',
      authToken: 'gateway-token',
    },
    logs: '',
    health: {
      score: 91,
      status: 'healthy',
      checks: [],
      evaluatedAt: 1,
    },
    lifecycle: {
      owner: 'remoteService',
      startStopSupported: false,
      configWritable: true,
      notes: [],
    },
    storage: {
      status: 'ready',
      provider: 'localFile',
      namespace: 'openclaw-prod',
      durable: true,
      queryable: false,
      transactional: false,
      remote: false,
    },
    connectivity: {
      primaryTransport: 'openclawGatewayWs',
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
    capabilities: [
      {
        id: 'tasks',
        status: 'ready',
        detail: 'Cron tasks are enabled.',
        source: 'runtime',
      },
    ],
    officialRuntimeNotes: [],
    ...overrides,
  };
}

function createJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function parseInvokeRequest(init: RequestInit | undefined) {
  return JSON.parse(String(init?.body || '{}')) as OpenClawInvokeRequest;
}

await runTest('invokeTool sends authenticated instance-scoped requests', async () => {
  const client = createOpenClawGatewayClient({
    getInstanceDetail: async () => createInstanceDetail(),
    fetchImpl: async (input, init) => {
      assert.equal(String(input), 'http://10.0.0.8:21280/tools/invoke');
      assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer gateway-token');
      assert.deepEqual(parseInvokeRequest(init), {
        tool: 'session_status',
        args: {
          sessionKey: 'main',
        },
      });
      return createJsonResponse({
        ok: true,
        result: {
          sessionKey: 'main',
          connected: true,
        },
      });
    },
  });

  const result = await client.invokeTool('openclaw-prod', {
    tool: 'session_status',
    args: {
      sessionKey: 'main',
    },
  });

  assert.deepEqual(result, {
    sessionKey: 'main',
    connected: true,
  });
});

await runTest('invokeTool forwards optional OpenClaw HTTP context headers', async () => {
  const client = createOpenClawGatewayClient({
    getInstanceDetail: async () => createInstanceDetail(),
    fetchImpl: async (_input, init) => {
      const headers = new Headers(init?.headers);
      assert.equal(headers.get('x-openclaw-message-channel'), 'slack');
      assert.equal(headers.get('x-openclaw-account-id'), 'primary');
      assert.equal(headers.get('x-trace-id'), 'trace-1');
      return createJsonResponse({
        ok: true,
        result: {
          ok: true,
        },
      });
    },
  });

  const result = await client.invokeTool(
    'openclaw-prod',
    {
      tool: 'status',
      args: {},
    },
    {
      messageChannel: 'slack',
      accountId: 'primary',
      headers: {
        'x-trace-id': 'trace-1',
      },
    },
  );

  assert.deepEqual(result, {
    ok: true,
  });
});

await runTest('openClawGatewayClient prefers the desktop bridge over browser fetch when available', async () => {
  const originalBridge = getPlatformBridge();
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  const desktopCalls: Array<{
    instanceId: string;
    request: OpenClawInvokeRequest<object>;
    options: Record<string, unknown> | undefined;
  }> = [];

  globalThis.fetch = (async () => {
    fetchCalled = true;
    throw new Error('browser fetch should not be used when desktop bridge is available');
  }) as typeof fetch;

  const client = createOpenClawGatewayClient();

  configurePlatformBridge({
    studio: {
      ...originalBridge.studio,
      getInstanceDetail: async () =>
        createInstanceDetail({
          instance: {
            ...createInstanceDetail().instance,
            isBuiltIn: true,
            deploymentMode: 'local-managed',
            host: '127.0.0.1',
            port: 18845,
            baseUrl: 'http://127.0.0.1:18845',
          },
          config: {
            ...createInstanceDetail().config,
            baseUrl: 'http://127.0.0.1:18845',
          },
        }),
      invokeOpenClawGateway: async (instanceId, request, options) => {
        desktopCalls.push({
          instanceId,
          request: request as OpenClawInvokeRequest<object>,
          options: options as Record<string, unknown> | undefined,
        });
        return {
          models: [
            {
              id: 'openai/gpt-5.4',
              provider: 'openai',
              label: 'GPT-5.4',
            },
          ],
        };
      },
    } as typeof originalBridge.studio,
  });

  try {
    const models = await client.listModels('openclaw-prod');

    assert.equal(fetchCalled, false);
    assert.deepEqual(desktopCalls, [
      {
        instanceId: 'openclaw-prod',
        request: {
          tool: 'models',
          action: 'list',
          args: {},
        },
        options: {},
      },
    ]);
    assert.deepEqual(models, [
      {
        id: 'openai/gpt-5.4',
        provider: 'openai',
        label: 'GPT-5.4',
      },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    configurePlatformBridge(originalBridge);
  }
});

await runTest('openClawGatewayClient does not route non-OpenClaw built-in kernels through the desktop OpenClaw bridge', async () => {
  const originalBridge = getPlatformBridge();
  const desktopCalls: Array<{
    instanceId: string;
    request: OpenClawInvokeRequest<object>;
    options: Record<string, unknown> | undefined;
  }> = [];
  let fetchCalled = false;
  const baseDetail = createInstanceDetail();

  configurePlatformBridge({
    studio: {
      ...originalBridge.studio,
      invokeOpenClawGateway: async (instanceId, request, options) => {
        desktopCalls.push({
          instanceId,
          request: request as OpenClawInvokeRequest<object>,
          options: options as Record<string, unknown> | undefined,
        });
        return {
          models: [{ id: 'bridge-should-not-run' }],
        };
      },
    } as typeof originalBridge.studio,
  });

  try {
    const client = createOpenClawGatewayClient({
      getInstanceDetail: async () => ({
        ...baseDetail,
        instance: {
          ...baseDetail.instance,
          id: 'managed-hermes-primary',
          name: 'Built-In Hermes Primary',
          runtimeKind: 'hermes',
          deploymentMode: 'local-managed',
          transportKind: 'openclawGatewayWs',
          isBuiltIn: true,
          isDefault: true,
          host: '127.0.0.1',
          port: 24001,
          baseUrl: 'http://127.0.0.1:24001',
          websocketUrl: 'ws://127.0.0.1:24001',
        },
        config: {
          ...baseDetail.config,
          baseUrl: 'http://127.0.0.1:24001',
          websocketUrl: 'ws://127.0.0.1:24001',
          authToken: 'hermes-gateway-token',
        },
      }),
      fetchImpl: async (_input, _init) => {
        fetchCalled = true;
        return createJsonResponse({
          ok: true,
          result: {
            models: [{ id: 'hermes-via-http' }],
          },
        });
      },
    });

    const models = await client.listModels('managed-hermes-primary');

    assert.equal(fetchCalled, true);
    assert.deepEqual(desktopCalls, []);
    assert.deepEqual(models, [{ id: 'hermes-via-http' }]);
  } finally {
    configurePlatformBridge(originalBridge);
  }
});

await runTest('openClawGatewayClient keeps remote OpenClaw instances on HTTP fetch even when a desktop bridge exists', async () => {
  const originalBridge = getPlatformBridge();
  const desktopCalls: Array<{
    instanceId: string;
    request: OpenClawInvokeRequest<object>;
    options: Record<string, unknown> | undefined;
  }> = [];
  let fetchCalled = false;

  configurePlatformBridge({
    studio: {
      ...originalBridge.studio,
      invokeOpenClawGateway: async (instanceId, request, options) => {
        desktopCalls.push({
          instanceId,
          request: request as OpenClawInvokeRequest<object>,
          options: options as Record<string, unknown> | undefined,
        });
        return {
          models: [{ id: 'bridge-should-not-run' }],
        };
      },
    } as typeof originalBridge.studio,
  });

  try {
    const client = createOpenClawGatewayClient({
      getInstanceDetail: async () => createInstanceDetail(),
      fetchImpl: async (_input, _init) => {
        fetchCalled = true;
        return createJsonResponse({
          ok: true,
          result: {
            models: [
              {
                id: 'openai/gpt-5.4',
                provider: 'openai',
              },
            ],
          },
        });
      },
    });

    const models = await client.listModels('openclaw-prod');

    assert.equal(fetchCalled, true);
    assert.deepEqual(desktopCalls, []);
    assert.deepEqual(models, [
      {
        id: 'openai/gpt-5.4',
        provider: 'openai',
      },
    ]);
  } finally {
    configurePlatformBridge(originalBridge);
  }
});

await runTest('openClawGatewayClient accepts any instance that exposes the OpenClaw gateway transport even when runtimeKind is custom', async () => {
  const requests: OpenClawInvokeRequest[] = [];
  const baseDetail = createInstanceDetail();
  const client = createOpenClawGatewayClient({
    getInstanceDetail: async () => ({
      ...baseDetail,
      instance: {
        ...baseDetail.instance,
        id: 'custom-gateway-runtime',
        name: 'Custom Gateway Runtime',
        runtimeKind: 'custom',
      },
      connectivity: {
        ...baseDetail.connectivity,
        primaryTransport: 'openclawGatewayWs',
      },
    }),
    fetchImpl: async (_input, init) => {
      requests.push(parseInvokeRequest(init));
      return createJsonResponse({
        ok: true,
        result: {
          items: [
            {
              id: 'gateway-task-1',
              name: 'Gateway Task',
              description: 'Gateway task on a custom runtime kind.',
              enabled: true,
              createdAtMs: 100,
              updatedAtMs: 200,
              schedule: {
                kind: 'cron',
                expr: '0 * * * *',
              },
              sessionTarget: 'isolated',
              wakeMode: 'now',
              payload: {
                kind: 'agentTurn',
                message: 'Route by transport, not runtime kind.',
              },
              delivery: {
                mode: 'announce',
              },
              state: {
                nextRunAtMs: 1742432400000,
              },
            },
          ],
        },
      });
    },
  });

  const jobs = await client.listWorkbenchCronJobs('custom-gateway-runtime');

  assert.equal(requests[0]?.tool, 'cron');
  assert.equal(requests[0]?.action, 'list');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0]?.id, 'gateway-task-1');
  assert.equal(jobs[0]?.name, 'Gateway Task');
});

await runTest('getInvokeHttpRequestInfo exposes validated request metadata', async () => {
  const requests: OpenClawInvokeRequest[] = [];
  const client = createOpenClawGatewayClient({
    getInstanceDetail: async () => createInstanceDetail(),
    fetchImpl: async (_input, init) => {
      const request = parseInvokeRequest(init);
      requests.push(request);
      return createJsonResponse({
        ok: true,
        result: {
          ok: true,
        },
      });
    },
  });

  const info = await client.getInvokeHttpRequestInfo(
    'openclaw-prod',
    {
      tool: 'chat',
      action: 'send',
      args: {
        sessionKey: 'main',
        message: 'ping',
      },
    },
    {
      messageChannel: 'webchat',
      accountId: 'primary',
      headers: {
        'x-trace-id': 'trace-2',
      },
    },
  );

  assert.deepEqual(info, {
    instanceId: 'openclaw-prod',
    runtimeKind: 'openclaw',
    endpoint: 'http://10.0.0.8:21280',
    url: 'http://10.0.0.8:21280/tools/invoke',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: 'Bearer gateway-token',
      'x-openclaw-message-channel': 'webchat',
      'x-openclaw-account-id': 'primary',
      'x-trace-id': 'trace-2',
    },
    request: {
      tool: 'chat',
      action: 'send',
      args: {
        sessionKey: 'main',
        message: 'ping',
      },
    },
    validation: {
      status: 'ok',
      message: 'OpenClaw Gateway access validated.',
      endpoint: 'http://10.0.0.8:21280',
    },
  });
  assert.deepEqual(requests, [
    {
      tool: 'session_status',
      args: {
        sessionKey: 'main',
      },
    },
  ]);
});

await runTest('validateAccess resolves the instance endpoint and bearer token with session_status', async () => {
  const client = createOpenClawGatewayClient({
    getInstanceDetail: async () => createInstanceDetail(),
    fetchImpl: async (input, init) => {
      assert.equal(String(input), 'http://10.0.0.8:21280/tools/invoke');
      assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer gateway-token');
      assert.deepEqual(parseInvokeRequest(init), {
        tool: 'session_status',
        args: {
          sessionKey: 'main',
        },
      });
      return createJsonResponse({
        ok: true,
        result: {
          sessionKey: 'main',
          connected: true,
        },
      });
    },
  });

  const result = await client.validateAccess('openclaw-prod');

  assert.deepEqual(result, {
    status: 'ok',
    message: 'OpenClaw Gateway access validated.',
    endpoint: 'http://10.0.0.8:21280',
  });
});

await runTest('validateAccess reports missing_auth when the instance token is absent', async () => {
  const detail = createInstanceDetail({
    instance: {
      ...createInstanceDetail().instance,
      config: {
        ...createInstanceDetail().instance.config,
        authToken: null,
      },
    },
    config: {
      port: '21280',
      sandbox: true,
      autoUpdate: true,
      logLevel: 'info',
      corsOrigins: '*',
      baseUrl: 'http://10.0.0.8:21280',
      websocketUrl: 'ws://10.0.0.8:21280',
      authToken: null,
    },
  });

  const client = createOpenClawGatewayClient({
    getInstanceDetail: async () => detail,
    fetchImpl: async () => {
      throw new Error('fetch should not be called when auth is missing');
    },
  });

  const result = await client.validateAccess('openclaw-prod');

  assert.equal(result.status, 'missing_auth');
  assert.equal(result.endpoint, 'http://10.0.0.8:21280');
});

await runTest('validateAccess classifies unauthorized responses from the gateway', async () => {
  const client = createOpenClawGatewayClient({
    getInstanceDetail: async () => createInstanceDetail(),
    fetchImpl: async () => createJsonResponse({ ok: false }, 401),
  });

  const result = await client.validateAccess('openclaw-prod');

  assert.equal(result.status, 'unauthorized');
  assert.equal(result.httpStatus, 401);
});

await runTest('getSessionStatus uses the official session_status tool', async () => {
  const client = createOpenClawGatewayClient({
    getInstanceDetail: async () => createInstanceDetail(),
    fetchImpl: async (_input, init) => {
      assert.deepEqual(parseInvokeRequest(init), {
        tool: 'session_status',
        args: {
          sessionKey: 'main',
          model: 'openai/gpt-5.4',
        },
      });
      return createJsonResponse({
        ok: true,
        result: {
          sessionKey: 'main',
          model: 'openai/gpt-5.4',
          connected: true,
        },
      });
    },
  });

  const result = await client.getSessionStatus('openclaw-prod', {
    sessionKey: 'main',
    model: 'openai/gpt-5.4',
  });

  assert.deepEqual(result, {
    sessionKey: 'main',
    model: 'openai/gpt-5.4',
    connected: true,
  });
});

await runTest('listRuntimeTasks uses the latest tasks.list gateway surface and preserves task-flow linkage fields', async () => {
  const client = createOpenClawGatewayClient({
    getInstanceDetail: async () => createInstanceDetail(),
    fetchImpl: async (_input, init) => {
      assert.deepEqual(parseInvokeRequest(init), {
        tool: 'tasks',
        action: 'list',
        args: {},
      });
      return createJsonResponse({
        ok: true,
        result: {
          items: [
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
              updatedAtMs: 1_775_552_000_000,
            },
          ],
        },
      });
    },
  });

  const result = await client.listRuntimeTasks('openclaw-prod');

  assert.deepEqual(result, [
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
      startedAt: undefined,
      updatedAt: new Date(1_775_552_000_000).toISOString(),
      finishedAt: undefined,
      error: undefined,
      raw: {
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
        updatedAtMs: 1_775_552_000_000,
      },
    },
  ]);
});

await runTest('listTaskFlows uses the latest tasks.flow.list gateway surface and normalizes recent flow metadata', async () => {
  const client = createOpenClawGatewayClient({
    getInstanceDetail: async () => createInstanceDetail(),
    fetchImpl: async (_input, init) => {
      assert.deepEqual(parseInvokeRequest(init), {
        tool: 'tasks',
        action: 'flow.list',
        args: {},
      });
      return createJsonResponse({
        ok: true,
        result: {
          items: [
            {
              id: 'flow-1',
              lookupKey: 'release-review',
              ownerKey: 'agent:main:main',
              requesterOrigin: {
                channel: 'slack',
                to: 'channel:ops',
                accountId: 'ops-bot',
                threadId: '171234',
              },
              status: 'running',
              notifyPolicy: 'state_changes',
              goal: 'Review the release package',
              currentStep: 'Compare desktop and server artifacts',
              cancelRequestedAt: 1_775_552_050_000,
              syncMode: 'managed',
              revision: 3,
              taskCount: 2,
              activeTaskCount: 1,
              summary: 'Release review orchestration',
              createdAt: 1_775_551_000_000,
              updatedAtMs: 1_775_552_000_000,
            },
          ],
        },
      });
    },
  });

  const result = await client.listTaskFlows('openclaw-prod');

  assert.deepEqual(result, [
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
      cancelRequestedAt: new Date(1_775_552_050_000).toISOString(),
      syncMode: 'managed',
      revision: 3,
      taskCount: 2,
      activeTaskCount: 1,
      summary: 'Release review orchestration',
      startedAt: new Date(1_775_551_000_000).toISOString(),
      updatedAt: new Date(1_775_552_000_000).toISOString(),
      finishedAt: undefined,
      raw: {
        id: 'flow-1',
        lookupKey: 'release-review',
        ownerKey: 'agent:main:main',
        requesterOrigin: {
          channel: 'slack',
          to: 'channel:ops',
          accountId: 'ops-bot',
          threadId: '171234',
        },
        status: 'running',
        notifyPolicy: 'state_changes',
        goal: 'Review the release package',
        currentStep: 'Compare desktop and server artifacts',
        cancelRequestedAt: 1_775_552_050_000,
        syncMode: 'managed',
        revision: 3,
        taskCount: 2,
        activeTaskCount: 1,
        summary: 'Release review orchestration',
        createdAt: 1_775_551_000_000,
        updatedAtMs: 1_775_552_000_000,
      },
    },
  ]);
});

await runTest('getRuntimeTaskDetail uses the latest tasks.show gateway surface and preserves upstream task detail fields', async () => {
  const rawTask = {
    id: 'task-run-1',
    runtime: 'subagent',
    sourceId: 'release-review-cron',
    sessionKey: 'main',
    ownerKey: 'agent:main:main',
    scope: 'session',
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
    createdAt: 1_775_551_010_000,
    startedAt: 1_775_551_020_000,
    lastEventAt: 1_775_552_000_000,
    cleanupAfter: 1_775_912_000_000,
  };
  const client = createOpenClawGatewayClient({
    getInstanceDetail: async () => createInstanceDetail(),
    fetchImpl: async (_input, init) => {
      assert.deepEqual(parseInvokeRequest(init), {
        tool: 'tasks',
        action: 'show',
        args: {
          lookup: 'task-run-1',
        },
      });
      return createJsonResponse({
        ok: true,
        result: rawTask,
      });
    },
  });

  const result = await client.getRuntimeTaskDetail('openclaw-prod', 'task-run-1');

  assert.deepEqual(result, {
    id: 'task-run-1',
    runtime: 'subagent',
    sourceId: 'release-review-cron',
    sessionKey: 'main',
    ownerKey: 'agent:main:main',
    scope: 'session',
    childSessionKey: 'session-child',
    parentTaskId: 'task-parent-1',
    agentId: 'release-manager',
    runId: 'run-42',
    label: 'Approval',
    title: 'Request release approval',
    status: 'running',
    deliveryStatus: 'pending',
    notifyPolicy: 'state_changes',
    createdAt: new Date(1_775_551_010_000).toISOString(),
    startedAt: new Date(1_775_551_020_000).toISOString(),
    updatedAt: new Date(1_775_552_000_000).toISOString(),
    finishedAt: undefined,
    cleanupAfter: new Date(1_775_912_000_000).toISOString(),
    progressSummary: 'Waiting for release-manager approval.',
    terminalSummary: 'Needs manual approval.',
    terminalOutcome: 'blocked',
    raw: rawTask,
  });
});

await runTest('getTaskFlowDetail uses the latest tasks.flow.show gateway surface and normalizes detail-only metadata', async () => {
  const rawTask = {
    id: 'task-approve-1',
    runtime: 'subagent',
    sessionKey: 'main',
    ownerKey: 'agent:main:main',
    scope: 'flow',
    flowId: 'flow-1',
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
    createdAt: 1_775_551_010_000,
    startedAt: 1_775_551_020_000,
    lastEventAt: 1_775_552_000_000,
    cleanupAfter: 1_775_912_000_000,
  };
  const rawFlow = {
    id: 'flow-1',
    lookupKey: 'release-review',
    ownerKey: 'agent:main:main',
    requesterOrigin: {
      channel: 'slack',
      to: 'channel:ops',
      accountId: 'ops-bot',
      threadId: '171234',
    },
    status: 'waiting',
    notifyPolicy: 'state_changes',
    goal: 'Review the release package',
    currentStep: 'Wait for release-manager approval',
    cancelRequestedAt: 1_775_552_050_000,
    syncMode: 'managed',
    revision: 3,
    createdAt: 1_775_551_000_000,
    updatedAtMs: 1_775_552_000_000,
    state: {
      phase: 'approval',
      attempt: 2,
    },
    wait: {
      kind: 'approval',
      approver: 'release-manager',
    },
    blocked: {
      taskId: 'task-approve-1',
      summary: 'Awaiting release-manager approval',
    },
    tasks: [rawTask],
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
  };
  const client = createOpenClawGatewayClient({
    getInstanceDetail: async () => createInstanceDetail(),
    fetchImpl: async (_input, init) => {
      assert.deepEqual(parseInvokeRequest(init), {
        tool: 'tasks',
        action: 'flow.show',
        args: {
          lookup: 'release-review',
        },
      });
      return createJsonResponse({
        ok: true,
        result: rawFlow,
      });
    },
  });

  const result = await client.getTaskFlowDetail('openclaw-prod', 'release-review');

  assert.deepEqual(result, {
    id: 'flow-1',
    lookupKey: 'release-review',
    state: 'waiting',
    ownerKey: 'agent:main:main',
    requesterOrigin: {
      channel: 'slack',
      to: 'channel:ops',
      accountId: 'ops-bot',
      threadId: '171234',
    },
    notifyPolicy: 'state_changes',
    goal: 'Review the release package',
    currentStep: 'Wait for release-manager approval',
    cancelRequestedAt: new Date(1_775_552_050_000).toISOString(),
    syncMode: 'managed',
    revision: 3,
    taskCount: 1,
    activeTaskCount: 1,
    summary: undefined,
    startedAt: new Date(1_775_551_000_000).toISOString(),
    updatedAt: new Date(1_775_552_000_000).toISOString(),
    finishedAt: undefined,
    statePayload: {
      phase: 'approval',
      attempt: 2,
    },
    waitPayload: {
      kind: 'approval',
      approver: 'release-manager',
    },
    blocked: {
      taskId: 'task-approve-1',
      summary: 'Awaiting release-manager approval',
    },
    tasks: [
      {
        id: 'task-approve-1',
        runtime: 'subagent',
        sessionKey: 'main',
        ownerKey: 'agent:main:main',
        scope: 'flow',
        flowId: 'flow-1',
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
        createdAt: new Date(1_775_551_010_000).toISOString(),
        startedAt: new Date(1_775_551_020_000).toISOString(),
        updatedAt: new Date(1_775_552_000_000).toISOString(),
        cleanupAfter: new Date(1_775_912_000_000).toISOString(),
        raw: rawTask,
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
    raw: rawFlow,
  });
});

await runTest('listSessions uses the official sessions_list tool', async () => {
  const client = createOpenClawGatewayClient({
    getInstanceDetail: async () => createInstanceDetail(),
    fetchImpl: async (_input, init) => {
      assert.deepEqual(parseInvokeRequest(init), {
        tool: 'sessions_list',
        args: {
          kinds: ['main', 'group'],
          limit: 20,
          activeMinutes: 120,
          messageLimit: 2,
        },
      });
      return createJsonResponse({
        ok: true,
        result: {
          sessions: [
            {
              key: 'main',
              kind: 'main',
            },
          ],
        },
      });
    },
  });

  const result = await client.listSessions('openclaw-prod', {
    kinds: ['main', 'group'],
    limit: 20,
    activeMinutes: 120,
    messageLimit: 2,
  });

  assert.deepEqual(result, {
    sessions: [
      {
        key: 'main',
        kind: 'main',
      },
    ],
  });
});

await runTest('listSessionHistory uses the official sessions_history tool', async () => {
  const client = createOpenClawGatewayClient({
    getInstanceDetail: async () => createInstanceDetail(),
    fetchImpl: async (_input, init) => {
      assert.deepEqual(parseInvokeRequest(init), {
        tool: 'sessions_history',
        args: {
          sessionKey: 'main',
          limit: 10,
          includeTools: false,
        },
      });
      return createJsonResponse({
        ok: true,
        result: {
          sessionKey: 'main',
          messages: [
            {
              role: 'assistant',
              text: 'Ready.',
            },
          ],
        },
      });
    },
  });

  const result = await client.listSessionHistory('openclaw-prod', {
    sessionKey: 'main',
    limit: 10,
    includeTools: false,
  });

  assert.deepEqual(result, {
    sessionKey: 'main',
    messages: [
      {
        role: 'assistant',
        text: 'Ready.',
      },
    ],
  });
});

await runTest('sendToSession uses the official sessions_send tool', async () => {
  const client = createOpenClawGatewayClient({
    getInstanceDetail: async () => createInstanceDetail(),
    fetchImpl: async (_input, init) => {
      assert.deepEqual(parseInvokeRequest(init), {
        tool: 'sessions_send',
        args: {
          sessionKey: 'main',
          message: 'ping',
          label: 'health-check',
          timeoutSeconds: 45,
        },
      });
      return createJsonResponse({
        ok: true,
        result: {
          ok: true,
          enqueued: true,
        },
      });
    },
  });

  const result = await client.sendToSession('openclaw-prod', {
    sessionKey: 'main',
    message: 'ping',
    label: 'health-check',
    timeoutSeconds: 45,
  });

  assert.deepEqual(result, {
    ok: true,
    enqueued: true,
  });
});

await runTest('spawnSession uses the official sessions_spawn tool', async () => {
  const client = createOpenClawGatewayClient({
    getInstanceDetail: async () => createInstanceDetail(),
    fetchImpl: async (_input, init) => {
      assert.deepEqual(parseInvokeRequest(init), {
        tool: 'sessions_spawn',
        args: {
          task: 'Summarize today',
          runtime: 'subagent',
          agentId: 'ops',
          model: 'openai/gpt-5.4',
        },
      });
      return createJsonResponse({
        ok: true,
        result: {
          ok: true,
          sessionKey: 'agent:ops:run-1',
        },
      });
    },
  });

  const result = await client.spawnSession('openclaw-prod', {
    task: 'Summarize today',
    runtime: 'subagent',
    agentId: 'ops',
    model: 'openai/gpt-5.4',
  });

  assert.deepEqual(result, {
    ok: true,
    sessionKey: 'agent:ops:run-1',
  });
});

await runTest('listSubagents uses the official subagents tool action bridge', async () => {
  const client = createOpenClawGatewayClient({
    getInstanceDetail: async () => createInstanceDetail(),
    fetchImpl: async (_input, init) => {
      assert.deepEqual(parseInvokeRequest(init), {
        tool: 'subagents',
        action: 'list',
        args: {
          recentMinutes: 30,
        },
      });
      return createJsonResponse({
        ok: true,
        result: {
          items: [
            {
              id: 'subagent-1',
              status: 'running',
            },
          ],
        },
      });
    },
  });

  const result = await client.listSubagents('openclaw-prod', {
    recentMinutes: 30,
  });

  assert.deepEqual(result, {
    items: [
      {
        id: 'subagent-1',
        status: 'running',
      },
    ],
  });
});

await runTest('listAgents uses the official agents_list tool', async () => {
  const client = createOpenClawGatewayClient({
    getInstanceDetail: async () => createInstanceDetail(),
    fetchImpl: async (_input, init) => {
      assert.deepEqual(parseInvokeRequest(init), {
        tool: 'agents_list',
        args: {},
      });
      return createJsonResponse({
        ok: true,
        result: {
          requester: 'main',
          agents: [
            {
              id: 'ops',
              name: 'Ops',
              configured: true,
            },
          ],
        },
      });
    },
  });

  const result = await client.listAgents('openclaw-prod');

  assert.deepEqual(result, {
    requester: 'main',
    agents: [
      {
        id: 'ops',
        name: 'Ops',
        configured: true,
      },
    ],
  });
});

await runTest('searchMemory uses the official memory_search tool', async () => {
  const client = createOpenClawGatewayClient({
    getInstanceDetail: async () => createInstanceDetail(),
    fetchImpl: async (_input, init) => {
      assert.deepEqual(parseInvokeRequest(init), {
        tool: 'memory_search',
        args: {
          query: 'release notes',
          maxResults: 5,
          minScore: 0.42,
        },
      });
      return createJsonResponse({
        ok: true,
        result: {
          results: [
            {
              path: 'MEMORY.md',
              score: 0.91,
            },
          ],
        },
      });
    },
  });

  const result = await client.searchMemory('openclaw-prod', {
    query: 'release notes',
    maxResults: 5,
    minScore: 0.42,
  });

  assert.deepEqual(result, {
    results: [
      {
        path: 'MEMORY.md',
        score: 0.91,
      },
    ],
  });
});

await runTest('getMemoryContent uses the official memory_get tool', async () => {
  const client = createOpenClawGatewayClient({
    getInstanceDetail: async () => createInstanceDetail(),
    fetchImpl: async (_input, init) => {
      assert.deepEqual(parseInvokeRequest(init), {
        tool: 'memory_get',
        args: {
          path: 'MEMORY.md',
          from: 10,
          lines: 20,
        },
      });
      return createJsonResponse({
        ok: true,
        result: {
          path: 'MEMORY.md',
          from: 10,
          lines: [
            'alpha',
            'beta',
          ],
        },
      });
    },
  });

  const result = await client.getMemoryContent('openclaw-prod', {
    path: 'MEMORY.md',
    from: 10,
    lines: 20,
  });

  assert.deepEqual(result, {
    path: 'MEMORY.md',
    from: 10,
    lines: [
      'alpha',
      'beta',
    ],
  });
});

await runTest('listModels uses the official models.list method bridge', async () => {
  const client = createOpenClawGatewayClient({
    getInstanceDetail: async () => createInstanceDetail(),
    fetchImpl: async (_input, init) => {
      assert.deepEqual(parseInvokeRequest(init), {
        tool: 'models',
        action: 'list',
        args: {},
      });
      return createJsonResponse({
        ok: true,
        result: {
          models: [
            {
              provider: 'openai',
              model: 'gpt-5.4',
              label: 'GPT-5.4',
            },
          ],
        },
      });
    },
  });

  const result = await client.listModels('openclaw-prod');

  assert.deepEqual(result, [
    {
      provider: 'openai',
      model: 'gpt-5.4',
      label: 'GPT-5.4',
    },
  ]);
});

await runTest('getChannelStatus uses the official channels.status method bridge', async () => {
  const client = createOpenClawGatewayClient({
    getInstanceDetail: async () => createInstanceDetail(),
    fetchImpl: async (_input, init) => {
      assert.deepEqual(parseInvokeRequest(init), {
        tool: 'channels',
        action: 'status',
        args: {
          probe: true,
          timeoutMs: 1500,
        },
      });
      return createJsonResponse({
        ok: true,
        result: {
          ts: 1,
          channelOrder: ['slack'],
          channels: {
            slack: {
              enabled: true,
              configured: true,
            },
          },
        },
      });
    },
  });

  const result = await client.getChannelStatus('openclaw-prod', {
    probe: true,
    timeoutMs: 1500,
  });

  assert.deepEqual(result, {
    ts: 1,
    channelOrder: ['slack'],
    channels: {
      slack: {
        enabled: true,
        configured: true,
      },
    },
  });
});

await runTest('tailLogs uses the official logs.tail method bridge', async () => {
  const client = createOpenClawGatewayClient({
    getInstanceDetail: async () => createInstanceDetail(),
    fetchImpl: async (_input, init) => {
      assert.deepEqual(parseInvokeRequest(init), {
        tool: 'logs',
        action: 'tail',
        args: {
          cursor: 100,
          limit: 200,
          maxBytes: 4096,
        },
      });
      return createJsonResponse({
        ok: true,
        result: {
          file: '/tmp/openclaw.log',
          cursor: 120,
          content: 'tail',
        },
      });
    },
  });

  const result = await client.tailLogs('openclaw-prod', {
    cursor: 100,
    limit: 200,
    maxBytes: 4096,
  });

  assert.deepEqual(result, {
    file: '/tmp/openclaw.log',
    cursor: 120,
    content: 'tail',
  });
});

await runTest('getSkillsStatus uses the official skills.status method bridge', async () => {
  const client = createOpenClawGatewayClient({
    getInstanceDetail: async () => createInstanceDetail(),
    fetchImpl: async (_input, init) => {
      assert.deepEqual(parseInvokeRequest(init), {
        tool: 'skills',
        action: 'status',
        args: {
          agentId: 'ops',
        },
      });
      return createJsonResponse({
        ok: true,
        result: {
          agentId: 'ops',
          skills: [
            {
              id: 'diag-helper',
              name: 'Diagnostics Helper',
            },
          ],
        },
      });
    },
  });

  const result = await client.getSkillsStatus('openclaw-prod', {
    agentId: 'ops',
  });

  assert.deepEqual(result, {
    agentId: 'ops',
    skills: [
      {
        id: 'diag-helper',
        name: 'Diagnostics Helper',
      },
    ],
  });
});

await runTest('getToolsCatalog uses the official tools.catalog method bridge', async () => {
  const client = createOpenClawGatewayClient({
    getInstanceDetail: async () => createInstanceDetail(),
    fetchImpl: async (_input, init) => {
      assert.deepEqual(parseInvokeRequest(init), {
        tool: 'tools',
        action: 'catalog',
        args: {
          agentId: 'ops',
          includePlugins: true,
        },
      });
      return createJsonResponse({
        ok: true,
        result: {
          agentId: 'ops',
          profiles: [
            {
              id: 'coding',
              label: 'Coding',
            },
          ],
          groups: [
            {
              id: 'group:automation',
              label: 'Automation',
              source: 'core',
              tools: [
                {
                  id: 'cron',
                  label: 'cron',
                },
              ],
            },
          ],
        },
      });
    },
  });

  const result = await client.getToolsCatalog('openclaw-prod', {
    agentId: 'ops',
    includePlugins: true,
  });

  assert.deepEqual(result, {
    agentId: 'ops',
    profiles: [
      {
        id: 'coding',
        label: 'Coding',
      },
    ],
    groups: [
      {
        id: 'group:automation',
        label: 'Automation',
        source: 'core',
        tools: [
          {
            id: 'cron',
            label: 'cron',
          },
        ],
      },
    ],
  });
});

await runTest('getConfig uses the official config.get method bridge', async () => {
  const client = createOpenClawGatewayClient({
    getInstanceDetail: async () => createInstanceDetail(),
    fetchImpl: async (_input, init) => {
      assert.deepEqual(parseInvokeRequest(init), {
        tool: 'config',
        action: 'get',
        args: {},
      });
      return createJsonResponse({
        ok: true,
        result: {
          path: '/tmp/config.json5',
          baseHash: 'hash-1',
          config: {
            models: {
              providers: {
                openai: {
                  baseUrl: 'https://api.openai.com/v1',
                },
              },
            },
          },
        },
      });
    },
  });

  const result = await client.getConfig('openclaw-prod');

  assert.deepEqual(result, {
    path: '/tmp/config.json5',
    baseHash: 'hash-1',
    config: {
      models: {
        providers: {
          openai: {
            baseUrl: 'https://api.openai.com/v1',
          },
        },
      },
    },
  });
});

await runTest('openConfigFile uses the official config.openFile method bridge', async () => {
  const client = createOpenClawGatewayClient({
    getInstanceDetail: async () => createInstanceDetail(),
    fetchImpl: async (_input, init) => {
      assert.deepEqual(parseInvokeRequest(init), {
        tool: 'config',
        action: 'openFile',
        args: {},
      });
      return createJsonResponse({
        ok: true,
        result: {
          ok: true,
          path: '/tmp/config.json5',
        },
      });
    },
  });

  const result = await client.openConfigFile('openclaw-prod');

  assert.deepEqual(result, {
    ok: true,
    path: '/tmp/config.json5',
  });
});

await runTest('patchConfig uses the official config.patch method bridge', async () => {
  const client = createOpenClawGatewayClient({
    getInstanceDetail: async () => createInstanceDetail(),
    fetchImpl: async (_input, init) => {
      assert.deepEqual(parseInvokeRequest(init), {
        tool: 'config',
        action: 'patch',
        args: {
          raw: '{ models: { default: "openai/gpt-5.4" } }',
          baseHash: 'hash-1',
        },
      });
      return createJsonResponse({
        ok: true,
        result: {
          ok: true,
          path: '/tmp/config.json5',
        },
      });
    },
  });

  const result = await client.patchConfig('openclaw-prod', {
    raw: '{ models: { default: "openai/gpt-5.4" } }',
    baseHash: 'hash-1',
  });

  assert.deepEqual(result, {
    ok: true,
    path: '/tmp/config.json5',
  });
});

await runTest('listAgentFiles uses the official agents.files.list method bridge', async () => {
  const client = createOpenClawGatewayClient({
    getInstanceDetail: async () => createInstanceDetail(),
    fetchImpl: async (_input, init) => {
      assert.deepEqual(parseInvokeRequest(init), {
        tool: 'agents.files',
        action: 'list',
        args: {
          agentId: 'ops',
        },
      });
      return createJsonResponse({
        ok: true,
        result: {
          agentId: 'ops',
          workspace: '/workspace/ops',
          files: [
            {
              name: 'AGENTS.md',
              path: '/workspace/ops/AGENTS.md',
              missing: false,
            },
          ],
        },
      });
    },
  });

  const result = await client.listAgentFiles('openclaw-prod', {
    agentId: 'ops',
  });

  assert.deepEqual(result, {
    agentId: 'ops',
    workspace: '/workspace/ops',
    files: [
      {
        name: 'AGENTS.md',
        path: '/workspace/ops/AGENTS.md',
        missing: false,
      },
    ],
  });
});

await runTest('getAgentFile uses the official agents.files.get method bridge', async () => {
  const client = createOpenClawGatewayClient({
    getInstanceDetail: async () => createInstanceDetail(),
    fetchImpl: async (_input, init) => {
      assert.deepEqual(parseInvokeRequest(init), {
        tool: 'agents.files',
        action: 'get',
        args: {
          agentId: 'ops',
          name: 'AGENTS.md',
        },
      });
      return createJsonResponse({
        ok: true,
        result: {
          agentId: 'ops',
          workspace: '/workspace/ops',
          file: {
            name: 'AGENTS.md',
            path: '/workspace/ops/AGENTS.md',
            missing: false,
            content: '# Ops',
          },
        },
      });
    },
  });

  const result = await client.getAgentFile('openclaw-prod', {
    agentId: 'ops',
    name: 'AGENTS.md',
  });

  assert.deepEqual(result, {
    agentId: 'ops',
    workspace: '/workspace/ops',
    file: {
      name: 'AGENTS.md',
      path: '/workspace/ops/AGENTS.md',
      missing: false,
      content: '# Ops',
    },
  });
});

await runTest('setAgentFile uses the official agents.files.set method bridge', async () => {
  const client = createOpenClawGatewayClient({
    getInstanceDetail: async () => createInstanceDetail(),
    fetchImpl: async (_input, init) => {
      assert.deepEqual(parseInvokeRequest(init), {
        tool: 'agents.files',
        action: 'set',
        args: {
          agentId: 'ops',
          name: 'AGENTS.md',
          content: '# Updated Ops',
        },
      });
      return createJsonResponse({
        ok: true,
        result: {
          ok: true,
          agentId: 'ops',
        },
      });
    },
  });

  const result = await client.setAgentFile('openclaw-prod', {
    agentId: 'ops',
    name: 'AGENTS.md',
    content: '# Updated Ops',
  });

  assert.deepEqual(result, {
    ok: true,
    agentId: 'ops',
  });
});

await runTest('invokeMethod exposes the official tool-action bridge for additional management methods', async () => {
  const client = createOpenClawGatewayClient({
    getInstanceDetail: async () => createInstanceDetail(),
    fetchImpl: async (_input, init) => {
      assert.deepEqual(parseInvokeRequest(init), {
        tool: 'usage',
        action: 'status',
        args: {
          window: '24h',
        },
      });
      return createJsonResponse({
        ok: true,
        result: {
          requests: 42,
        },
      });
    },
  });

  const result = await client.invokeMethod('openclaw-prod', 'usage', 'status', {
    window: '24h',
  });

  assert.deepEqual(result, {
    requests: 42,
  });
});

await runTest('invokeOfficialMethod maps official gateway methods onto tools/invoke requests', async () => {
  const expectedRequests = [
    {
      tool: 'health',
      args: {
        verbose: true,
      },
    },
    {
      tool: 'doctor.memory',
      action: 'status',
      args: {
        limit: 5,
      },
    },
    {
      tool: 'doctor.memory',
      action: 'dreamDiary',
      args: {
        lines: 120,
      },
    },
    {
      tool: 'node.pair',
      action: 'request',
      args: {
        label: 'studio-web',
      },
    },
    {
      tool: 'chat',
      action: 'send',
      args: {
        sessionKey: 'main',
        text: 'ping',
      },
    },
  ];
  let requestIndex = 0;

  const client = createOpenClawGatewayClient({
    getInstanceDetail: async () => createInstanceDetail(),
    fetchImpl: async (_input, init) => {
      assert.deepEqual(parseInvokeRequest(init), expectedRequests[requestIndex]);
      requestIndex += 1;
      return createJsonResponse({
        ok: true,
        result: {
          ok: true,
          requestIndex,
        },
      });
    },
  });

  const results = [
    await client.invokeOfficialMethod('openclaw-prod', 'health', {
      verbose: true,
    }),
    await client.invokeOfficialMethod('openclaw-prod', 'doctor.memory.status', {
      limit: 5,
    }),
    await client.invokeOfficialMethod('openclaw-prod', 'doctor.memory.dreamDiary', {
      lines: 120,
    }),
    await client.invokeOfficialMethod('openclaw-prod', 'node.pair.request', {
      label: 'studio-web',
    }),
    await client.invokeOfficialMethod('openclaw-prod', 'chat.send', {
      sessionKey: 'main',
      text: 'ping',
    }),
  ];

  assert.equal(requestIndex, expectedRequests.length);
  assert.deepEqual(results, [
    {
      ok: true,
      requestIndex: 1,
    },
    {
      ok: true,
      requestIndex: 2,
    },
    {
      ok: true,
      requestIndex: 3,
    },
    {
      ok: true,
      requestIndex: 4,
    },
    {
      ok: true,
      requestIndex: 5,
    },
  ]);
});

await runTest('remaining official convenience wrappers use the mapped gateway methods', async () => {
  const expectedRequests = [
    {
      tool: 'health',
      args: {
        scope: 'full',
      },
    },
    {
      tool: 'tts',
      action: 'providers',
      args: {},
    },
    {
      tool: 'sessions',
      action: 'preview',
      args: {
        sessionKey: 'main',
      },
    },
    {
      tool: 'last-heartbeat',
      args: {},
    },
  ];
  let requestIndex = 0;

  const client = createOpenClawGatewayClient({
    getInstanceDetail: async () => createInstanceDetail(),
    fetchImpl: async (_input, init) => {
      assert.deepEqual(parseInvokeRequest(init), expectedRequests[requestIndex]);
      requestIndex += 1;
      return createJsonResponse({
        ok: true,
        result: {
          requestIndex,
        },
      });
    },
  });

  assert.deepEqual(
    await client.getHealth('openclaw-prod', {
      scope: 'full',
    }),
    {
      requestIndex: 1,
    },
  );
  assert.deepEqual(await client.getTtsProviders('openclaw-prod'), {
    requestIndex: 2,
  });
  assert.deepEqual(
    await client.previewGatewaySession('openclaw-prod', {
      sessionKey: 'main',
    }),
    {
      requestIndex: 3,
    },
  );
  assert.deepEqual(await client.getLastHeartbeat('openclaw-prod'), {
    requestIndex: 4,
  });
});

await runTest('remaining uncovered gateway wrappers map the official session, push, web login, and chat inject methods', async () => {
  const expectedRequests = [
    {
      tool: 'sessions',
      action: 'resolve',
      args: {
        key: 'thread:claw-studio:ops',
      },
    },
    {
      tool: 'sessions',
      action: 'get',
      args: {
        key: 'thread:claw-studio:ops',
        limit: 50,
      },
    },
    {
      tool: 'sessions',
      action: 'usage',
      args: {
        key: 'thread:claw-studio:ops',
        days: 7,
      },
    },
    {
      tool: 'sessions',
      action: 'usage.timeseries',
      args: {
        key: 'thread:claw-studio:ops',
      },
    },
    {
      tool: 'sessions',
      action: 'usage.logs',
      args: {
        key: 'thread:claw-studio:ops',
        limit: 25,
      },
    },
    {
      tool: 'web',
      action: 'login.start',
      args: {
        force: true,
        timeoutMs: 15000,
        accountId: 'primary',
      },
    },
    {
      tool: 'web',
      action: 'login.wait',
      args: {
        timeoutMs: 15000,
        accountId: 'primary',
      },
    },
    {
      tool: 'chat',
      action: 'inject',
      args: {
        sessionKey: 'thread:claw-studio:ops',
        message: 'Injected assistant output.',
        label: 'system',
      },
    },
    {
      tool: 'push',
      action: 'test',
      args: {
        channel: 'slack',
        to: 'channel:C001',
      },
    },
  ];
  let requestIndex = 0;

  const client = createOpenClawGatewayClient({
    getInstanceDetail: async () => createInstanceDetail(),
    fetchImpl: async (_input, init) => {
      assert.deepEqual(parseInvokeRequest(init), expectedRequests[requestIndex]);
      requestIndex += 1;
      return createJsonResponse({
        ok: true,
        result: {
          requestIndex,
        },
      });
    },
  });

  assert.deepEqual(
    await client.resolveGatewaySession('openclaw-prod', {
      key: 'thread:claw-studio:ops',
    }),
    {
      requestIndex: 1,
    },
  );
  assert.deepEqual(
    await client.getGatewaySession('openclaw-prod', {
      key: 'thread:claw-studio:ops',
      limit: 50,
    }),
    {
      requestIndex: 2,
    },
  );
  assert.deepEqual(
    await client.getGatewaySessionUsage('openclaw-prod', {
      key: 'thread:claw-studio:ops',
      days: 7,
    }),
    {
      requestIndex: 3,
    },
  );
  assert.deepEqual(
    await client.getGatewaySessionUsageTimeseries('openclaw-prod', {
      key: 'thread:claw-studio:ops',
    }),
    {
      requestIndex: 4,
    },
  );
  assert.deepEqual(
    await client.getGatewaySessionUsageLogs('openclaw-prod', {
      key: 'thread:claw-studio:ops',
      limit: 25,
    }),
    {
      requestIndex: 5,
    },
  );
  assert.deepEqual(
    await client.startWebLogin('openclaw-prod', {
      force: true,
      timeoutMs: 15000,
      accountId: 'primary',
    }),
    {
      requestIndex: 6,
    },
  );
  assert.deepEqual(
    await client.waitForWebLogin('openclaw-prod', {
      timeoutMs: 15000,
      accountId: 'primary',
    }),
    {
      requestIndex: 7,
    },
  );
  assert.deepEqual(
    await client.injectChatMessage('openclaw-prod', {
      sessionKey: 'thread:claw-studio:ops',
      message: 'Injected assistant output.',
      label: 'system',
    }),
    {
      requestIndex: 8,
    },
  );
  assert.deepEqual(
    await client.testPushDelivery('openclaw-prod', {
      channel: 'slack',
      to: 'channel:C001',
    }),
    {
      requestIndex: 9,
    },
  );
});

await runTest(
  'exec approval wrappers keep gateway and node approval methods official while normalizing persistent approval decisions',
  async () => {
    const expectedRequests = [
      {
        tool: 'exec.approvals',
        action: 'get',
        args: {
          scope: 'gateway',
        },
      },
      {
        tool: 'exec.approvals',
        action: 'set',
        args: {
          file: {
            ask: 'always',
          },
        },
      },
      {
        tool: 'exec.approvals.node',
        action: 'get',
        args: {
          nodeId: 'node-alpha',
        },
      },
      {
        tool: 'exec.approvals.node',
        action: 'set',
        args: {
          nodeId: 'node-alpha',
          file: {
            ask: 'always',
          },
        },
      },
      {
        tool: 'exec.approval',
        action: 'resolve',
        args: {
          id: 'approval-1',
          decision: 'allow-always',
        },
      },
      {
        tool: 'exec.approval',
        action: 'resolve',
        args: {
          id: 'approval-2',
          decision: 'allow-once',
        },
      },
    ];
    let requestIndex = 0;

    const client = createOpenClawGatewayClient({
      getInstanceDetail: async () => createInstanceDetail(),
      fetchImpl: async (_input, init) => {
        assert.deepEqual(parseInvokeRequest(init), expectedRequests[requestIndex]);
        requestIndex += 1;
        return createJsonResponse({
          ok: true,
          result: {
            requestIndex,
          },
        });
      },
    });

    assert.deepEqual(
      await client.getExecApprovals('openclaw-prod', {
        scope: 'gateway',
      }),
      {
        requestIndex: 1,
      },
    );
    assert.deepEqual(
      await client.setExecApprovals('openclaw-prod', {
        file: {
          ask: 'always',
        },
      }),
      {
        requestIndex: 2,
      },
    );
    assert.deepEqual(
      await client.getNodeExecApprovals('openclaw-prod', {
        nodeId: 'node-alpha',
      }),
      {
        requestIndex: 3,
      },
    );
    assert.deepEqual(
      await client.setNodeExecApprovals('openclaw-prod', {
        nodeId: 'node-alpha',
        file: {
          ask: 'always',
        },
      }),
      {
        requestIndex: 4,
      },
    );
    assert.deepEqual(
      await client.resolveExecApproval('openclaw-prod', {
        id: 'approval-1',
        decision: 'always',
      } as any),
      {
        requestIndex: 5,
      },
    );
    assert.deepEqual(
      await client.resolveExecApproval('openclaw-prod', {
        id: 'approval-2',
        decision: 'allow',
      } as any),
      {
        requestIndex: 6,
      },
    );
  },
);

await runTest('getStatus uses the official status tool', async () => {
  const client = createOpenClawGatewayClient({
    getInstanceDetail: async () => createInstanceDetail(),
    fetchImpl: async (_input, init) => {
      assert.deepEqual(parseInvokeRequest(init), {
        tool: 'status',
        args: {},
      });
      return createJsonResponse({
        ok: true,
        result: {
          status: 'ok',
        },
      });
    },
  });

  const result = await client.getStatus('openclaw-prod');

  assert.deepEqual(result, {
    status: 'ok',
  });
});

await runTest('logoutChannel uses the official channels.logout method bridge', async () => {
  const client = createOpenClawGatewayClient({
    getInstanceDetail: async () => createInstanceDetail(),
    fetchImpl: async (_input, init) => {
      assert.deepEqual(parseInvokeRequest(init), {
        tool: 'channels',
        action: 'logout',
        args: {
          channel: 'slack',
        },
      });
      return createJsonResponse({
        ok: true,
        result: {
          ok: true,
        },
      });
    },
  });

  const result = await client.logoutChannel('openclaw-prod', {
    channel: 'slack',
  });

  assert.deepEqual(result, {
    ok: true,
  });
});

await runTest('listWorkbenchCronJobs maps cron jobs into Studio workbench tasks', async () => {
  const rawJob = {
    id: 'job-ops-daily',
    name: 'Ops Daily Brief',
    description: 'Morning operations summary',
    enabled: true,
    deleteAfterRun: true,
    agentId: 'ops',
    createdAtMs: 100,
    updatedAtMs: 200,
    schedule: {
      kind: 'cron',
      expr: '0 9 * * *',
      tz: 'Asia/Shanghai',
      staggerMs: 30000,
    },
    sessionTarget: 'session:project-alpha-monitor',
    wakeMode: 'next-heartbeat',
    payload: {
      kind: 'agentTurn',
      message: 'Summarize operations updates.',
      model: 'openai/gpt-5.4',
      thinking: 'high',
      timeoutSeconds: 120,
      lightContext: true,
      tools: ['exec', 'group:filesystem'],
    },
    delivery: {
      mode: 'webhook',
      to: 'https://hooks.example.com/openclaw/cron',
      bestEffort: true,
    },
    state: {
      nextRunAtMs: 1742432400000,
      lastRunAtMs: 1742346000000,
      lastRunStatus: 'ok',
    },
  };
  const client = createOpenClawGatewayClient({
    getInstanceDetail: async () => createInstanceDetail(),
    fetchImpl: async (_input, init) => {
      const request = parseInvokeRequest(init);
      assert.equal(request.tool, 'cron');
      assert.equal(request.action, 'list');

      return createJsonResponse({
        ok: true,
        result: {
          items: [rawJob],
        },
      });
    },
  });

  const tasks = await client.listWorkbenchCronJobs('openclaw-prod');

  assert.equal(tasks.length, 1);
  assert.deepEqual(tasks[0], {
    id: 'job-ops-daily',
    name: 'Ops Daily Brief',
    description: 'Morning operations summary',
    prompt: 'Summarize operations updates.',
    schedule: '0 9 * * *',
    scheduleMode: 'cron',
    scheduleConfig: {
      cronExpression: '0 9 * * *',
      cronTimezone: 'Asia/Shanghai',
      staggerMs: 30000,
    },
    cronExpression: '0 9 * * *',
    actionType: 'skill',
    status: 'active',
    sessionMode: 'custom',
    customSessionId: 'project-alpha-monitor',
    wakeUpMode: 'nextCycle',
    executionContent: 'runAssistantTask',
    timeoutSeconds: 120,
    deleteAfterRun: true,
    agentId: 'ops',
    model: 'openai/gpt-5.4',
    thinking: 'high',
    lightContext: true,
    deliveryMode: 'webhook',
    deliveryBestEffort: true,
    recipient: 'https://hooks.example.com/openclaw/cron',
    lastRun: '2025-03-19T01:00:00.000Z',
    nextRun: '2025-03-20T01:00:00.000Z',
    latestExecution: {
      id: 'job-ops-daily-latest',
      taskId: 'job-ops-daily',
      status: 'success',
      trigger: 'schedule',
      startedAt: '2025-03-19T01:00:00.000Z',
      finishedAt: '2025-03-19T01:00:00.000Z',
      summary: 'Cron job completed successfully.',
      details: undefined,
    },
    rawDefinition: rawJob,
  });
});

await runTest('listWorkbenchCronRuns maps gateway run history into workbench executions', async () => {
  const client = createOpenClawGatewayClient({
    getInstanceDetail: async () => createInstanceDetail(),
    fetchImpl: async (_input, init) => {
      const request = parseInvokeRequest(init);
      assert.equal(request.tool, 'cron');
      assert.equal(request.action, 'runs');
      assert.deepEqual(request.args, { id: 'job-ops-daily' });

      return createJsonResponse({
        ok: true,
        result: [
          {
            ts: 1742346060000,
            jobId: 'job-ops-daily',
            action: 'finished',
            status: 'error',
            error: 'Slack delivery failed.',
            summary: 'Delivery failed after the run completed.',
            delivered: false,
            runAtMs: 1742346000000,
            durationMs: 60000,
          },
        ],
      });
    },
  });

  const executions = await client.listWorkbenchCronRuns('openclaw-prod', 'job-ops-daily');

  assert.equal(executions.length, 1);
  assert.deepEqual(executions[0], {
    id: 'job-ops-daily-1742346060000',
    taskId: 'job-ops-daily',
    status: 'failed',
    trigger: 'schedule',
    startedAt: '2025-03-19T01:00:00.000Z',
    finishedAt: '2025-03-19T01:01:00.000Z',
    summary: 'Delivery failed after the run completed.',
    details: 'Slack delivery failed.',
  });
});
