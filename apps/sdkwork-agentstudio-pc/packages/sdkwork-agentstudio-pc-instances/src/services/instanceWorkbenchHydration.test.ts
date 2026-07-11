import assert from 'node:assert/strict';
import type { StudioInstanceDetailRecord } from '@sdkwork/agentstudio-pc-types';
import type {
  InstanceWorkbenchFile,
  InstanceWorkbenchMemoryEntry,
  InstanceWorkbenchSectionId,
  InstanceWorkbenchSnapshot,
} from '../types/index.ts';
import {
  createInstanceWorkbenchHydrationResetState,
  mergeLazyLoadedWorkbenchFiles,
  mergeLazyLoadedWorkbenchMemories,
  startLazyLoadInstanceWorkbenchFiles,
  startLazyLoadInstanceWorkbenchMemory,
  shouldLazyLoadInstanceWorkbenchFiles,
  shouldLazyLoadInstanceWorkbenchMemory,
} from './instanceWorkbenchHydration.ts';

const BUILT_IN_INSTANCE_ID = 'managed-openclaw-primary';

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function runAsyncTest(name: string, fn: () => Promise<void>) {
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

function flushMicrotasks() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;

  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return {
    promise,
    resolve,
  };
}

function createDetail(overrides: Partial<StudioInstanceDetailRecord> = {}): StudioInstanceDetailRecord {
  return {
    instance: {
      id: BUILT_IN_INSTANCE_ID,
      name: 'Local Built-in',
      description: 'Built-in OpenClaw runtime.',
      runtimeKind: 'openclaw',
      deploymentMode: 'local-managed',
      transportKind: 'openclawGatewayWs',
      status: 'online',
      isBuiltIn: true,
      isDefault: true,
      iconType: 'server',
      version: '2026.4.1',
      typeLabel: 'OpenClaw Gateway',
      host: '127.0.0.1',
      port: 18797,
      baseUrl: 'http://127.0.0.1:18797',
      websocketUrl: 'ws://127.0.0.1:18797',
      cpu: 0,
      memory: 0,
      totalMemory: '16GB',
      uptime: '1m',
      capabilities: ['files', 'memory'],
      config: {
        port: '18797',
        sandbox: true,
        autoUpdate: true,
        logLevel: 'info',
        corsOrigins: '*',
      },
      createdAt: 1,
      updatedAt: 1,
      lastSeenAt: 1,
    },
    config: {
      port: '18797',
      sandbox: true,
      autoUpdate: true,
      logLevel: 'info',
      corsOrigins: '*',
    },
    logs: '',
    health: {
      score: 90,
      status: 'healthy',
      checks: [],
      evaluatedAt: 1,
    },
    lifecycle: {
      owner: 'appManaged',
      startStopSupported: true,
      configWritable: true,
      notes: [],
    },
    storage: {
      status: 'ready',
      provider: 'localFile',
      namespace: BUILT_IN_INSTANCE_ID,
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
    capabilities: [],
    officialRuntimeNotes: [],
    ...overrides,
  };
}

function createWorkbench(
  overrides: Partial<InstanceWorkbenchSnapshot> = {},
): InstanceWorkbenchSnapshot {
  return {
    instance: {
      id: BUILT_IN_INSTANCE_ID,
      name: 'Local Built-in',
      type: 'OpenClaw Gateway',
      iconType: 'server',
      status: 'online',
      version: '2026.4.1',
      uptime: '1m',
      ip: '127.0.0.1',
      cpu: 0,
      memory: 0,
      totalMemory: '16GB',
      isBuiltIn: true,
      runtimeKind: 'openclaw',
      deploymentMode: 'local-managed',
      transportKind: 'openclawGatewayWs',
      baseUrl: 'http://127.0.0.1:18797',
      websocketUrl: 'ws://127.0.0.1:18797',
      storage: {
        provider: 'localFile',
        namespace: BUILT_IN_INSTANCE_ID,
      },
    },
    config: {
      port: '18797',
      sandbox: true,
      autoUpdate: true,
      logLevel: 'info',
      corsOrigins: '*',
    },
    token: '',
    logs: '',
    detail: createDetail(),
    kernelConfig: null,
    configChannels: undefined,
    kernelConfigInsights: null,
    configWebSearch: null,
    configAuthCooldowns: null,
    healthScore: 90,
    runtimeStatus: 'healthy',
    connectedChannelCount: 0,
    activeTaskCount: 0,
    installedSkillCount: 0,
    readyToolCount: 0,
    sectionCounts: {
      overview: 0,
      channels: 0,
      cronTasks: 0,
      llmProviders: 0,
      agents: 1,
      skills: 0,
      files: 0,
      memory: 0,
      tools: 0,
      config: 0,
    },
    sectionAvailability: {
      overview: { status: 'ready', detail: 'ready' },
      channels: { status: 'ready', detail: 'ready' },
      cronTasks: { status: 'ready', detail: 'ready' },
      llmProviders: { status: 'ready', detail: 'ready' },
      agents: { status: 'ready', detail: 'ready' },
      skills: { status: 'ready', detail: 'ready' },
      files: { status: 'ready', detail: 'ready' },
      memory: { status: 'ready', detail: 'ready' },
      tools: { status: 'ready', detail: 'ready' },
      config: { status: 'planned', detail: 'planned' },
    },
    channels: [],
    tasks: [],
    agents: [
      {
        agent: {
          id: 'ops',
          name: 'Ops',
          description: 'Automation agent.',
          avatar: 'O',
          systemPrompt: 'Handle incidents.',
          creator: 'OpenClaw',
        },
        focusAreas: ['Operations'],
        automationFitScore: 80,
        workspace: '/workspace/ops',
        configSource: 'runtime',
      },
    ],
    skills: [],
    files: [],
    llmProviders: [],
    memories: [],
    tools: [],
    ...overrides,
  };
}

runTest('shouldLazyLoadInstanceWorkbenchFiles keeps built-in OpenClaw eligible for lazy file loading', () => {
  const shouldLoad = shouldLazyLoadInstanceWorkbenchFiles({
    activeSection: 'files',
    detail: createDetail(),
    workbench: createWorkbench(),
  });

  assert.equal(shouldLoad, true);
});

runTest('createInstanceWorkbenchHydrationResetState centralizes page lazy-load reset baselines', () => {
  assert.deepEqual(createInstanceWorkbenchHydrationResetState(), {
    isFilesLoading: false,
    isMemoryLoading: false,
  });
});

runTest('shouldLazyLoadInstanceWorkbenchMemory keeps built-in OpenClaw eligible for lazy memory loading', () => {
  const shouldLoad = shouldLazyLoadInstanceWorkbenchMemory({
    activeSection: 'memory',
    detail: createDetail(),
    workbench: createWorkbench(),
  });

  assert.equal(shouldLoad, true);
});

runTest('mergeLazyLoadedWorkbenchFiles keeps the current snapshot when a lazy file refresh returns nothing', () => {
  const workbench = createWorkbench();
  const merged = mergeLazyLoadedWorkbenchFiles(workbench, []);

  assert.equal(merged, workbench);
});

runTest('mergeLazyLoadedWorkbenchMemories keeps the current snapshot when a lazy memory refresh returns nothing', () => {
  const workbench = createWorkbench();
  const merged = mergeLazyLoadedWorkbenchMemories(workbench, []);

  assert.equal(merged, workbench);
});

runTest('mergeLazyLoadedWorkbenchFiles updates file counts and readiness when files are returned', () => {
  const workbench = createWorkbench();
  const files: InstanceWorkbenchFile[] = [
    {
      id: 'openclaw-agent-file:ops:AGENTS.md',
      name: 'AGENTS.md',
      path: '/workspace/ops/AGENTS.md',
      category: 'prompt',
      language: 'markdown',
      size: '1 KB',
      updatedAt: '2026-04-05T10:00:00.000Z',
      status: 'synced',
      description: 'Main prompt file.',
      content: '',
      isReadonly: false,
    },
  ];
  const merged = mergeLazyLoadedWorkbenchFiles(workbench, files);

  assert.notEqual(merged, workbench);
  assert.equal(merged.files.length, 1);
  assert.equal(merged.sectionCounts.files, 1);
  assert.equal(merged.sectionAvailability.files.status, 'ready');
});

runTest('mergeLazyLoadedWorkbenchMemories updates memory counts and readiness when memories are returned', () => {
  const workbench = createWorkbench();
  const memories: InstanceWorkbenchMemoryEntry[] = [
    {
      id: 'memory-runtime',
      title: 'Memory Runtime',
      type: 'fact',
      summary: 'Runtime memory is available.',
      source: 'system',
      updatedAt: 'Live',
      retention: 'rolling',
      tokens: 24,
    },
  ];
  const merged = mergeLazyLoadedWorkbenchMemories(workbench, memories);

  assert.notEqual(merged, workbench);
  assert.equal(merged.memories.length, 1);
  assert.equal(merged.sectionCounts.memory, 1);
  assert.equal(merged.sectionAvailability.memory.status, 'ready');
});

await runAsyncTest(
  'startLazyLoadInstanceWorkbenchFiles loads files through the injected loader and merges them back into the current workbench',
  async () => {
    const workbench = createWorkbench();
    const files: InstanceWorkbenchFile[] = [
      {
        id: 'openclaw-agent-file:ops:AGENTS.md',
        name: 'AGENTS.md',
        path: '/workspace/ops/AGENTS.md',
        category: 'prompt',
        language: 'markdown',
        size: '1 KB',
        updatedAt: '2026-04-05T10:00:00.000Z',
        status: 'synced',
        description: 'Main prompt file.',
        content: '',
        isReadonly: false,
      },
    ];
    const loadingStates: boolean[] = [];
    let currentWorkbench: InstanceWorkbenchSnapshot | null = workbench;

    const cleanup = startLazyLoadInstanceWorkbenchFiles({
      activeSection: 'files',
      detail: createDetail(),
      instanceId: workbench.instance.id,
      workbench,
      setIsLoading: (value) => {
        loadingStates.push(value);
      },
      setWorkbench: (value) => {
        currentWorkbench =
          typeof value === 'function'
            ? (value as (current: InstanceWorkbenchSnapshot | null) => InstanceWorkbenchSnapshot | null)(
                currentWorkbench,
              )
            : value;
      },
      loadFiles: async (instanceId, agents) => {
        assert.equal(instanceId, workbench.instance.id);
        assert.equal(agents.length, workbench.agents.length);

        return files;
      },
      reportError: (error) => {
        throw error;
      },
    });

    assert.equal(typeof cleanup, 'function');

    await flushMicrotasks();

    assert.deepEqual(loadingStates, [true, false]);
    assert.notEqual(currentWorkbench, workbench);
    assert.deepEqual(currentWorkbench?.files, files);
    assert.equal(currentWorkbench?.sectionCounts.files, 1);
  },
);

await runAsyncTest(
  'startLazyLoadInstanceWorkbenchMemory routes loader failures through the injected error reporter and restores loading when active',
  async () => {
    const workbench = createWorkbench();
    const loadingStates: boolean[] = [];
    const failure = new Error('memory unavailable');
    let currentWorkbench: InstanceWorkbenchSnapshot | null = workbench;
    let reportedError: unknown = null;

    const cleanup = startLazyLoadInstanceWorkbenchMemory({
      activeSection: 'memory',
      detail: createDetail(),
      instanceId: workbench.instance.id,
      workbench,
      setIsLoading: (value) => {
        loadingStates.push(value);
      },
      setWorkbench: (value) => {
        currentWorkbench =
          typeof value === 'function'
            ? (value as (current: InstanceWorkbenchSnapshot | null) => InstanceWorkbenchSnapshot | null)(
                currentWorkbench,
              )
            : value;
      },
      loadMemories: async (instanceId, agents) => {
        assert.equal(instanceId, workbench.instance.id);
        assert.equal(agents.length, workbench.agents.length);

        throw failure;
      },
      reportError: (error) => {
        reportedError = error;
      },
    });

    assert.equal(typeof cleanup, 'function');

    await flushMicrotasks();

    assert.deepEqual(loadingStates, [true, false]);
    assert.equal(currentWorkbench, workbench);
    assert.equal(reportedError, failure);
  },
);

await runAsyncTest(
  'startLazyLoadInstanceWorkbenchFiles suppresses merge and loading reset after cancellation',
  async () => {
    const workbench = createWorkbench();
    const files: InstanceWorkbenchFile[] = [
      {
        id: 'openclaw-agent-file:ops:AGENTS.md',
        name: 'AGENTS.md',
        path: '/workspace/ops/AGENTS.md',
        category: 'prompt',
        language: 'markdown',
        size: '1 KB',
        updatedAt: '2026-04-05T10:00:00.000Z',
        status: 'synced',
        description: 'Main prompt file.',
        content: '',
        isReadonly: false,
      },
    ];
    const loadingStates: boolean[] = [];
    let currentWorkbench: InstanceWorkbenchSnapshot | null = workbench;
    const deferred = createDeferred<InstanceWorkbenchFile[]>();

    const cleanup = startLazyLoadInstanceWorkbenchFiles({
      activeSection: 'files',
      detail: createDetail(),
      instanceId: workbench.instance.id,
      workbench,
      setIsLoading: (value) => {
        loadingStates.push(value);
      },
      setWorkbench: (value) => {
        currentWorkbench =
          typeof value === 'function'
            ? (value as (current: InstanceWorkbenchSnapshot | null) => InstanceWorkbenchSnapshot | null)(
                currentWorkbench,
              )
            : value;
      },
      loadFiles: async () => deferred.promise,
      reportError: (error) => {
        throw error;
      },
    });

    assert.equal(typeof cleanup, 'function');
    cleanup?.();
    deferred.resolve(files);

    await flushMicrotasks();

    assert.deepEqual(loadingStates, [true]);
    assert.equal(currentWorkbench, workbench);
  },
);
