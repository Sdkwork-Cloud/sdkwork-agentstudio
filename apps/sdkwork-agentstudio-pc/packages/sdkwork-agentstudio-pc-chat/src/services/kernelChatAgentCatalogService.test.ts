import assert from 'node:assert/strict';
import type { StudioInstanceDetailRecord } from '@sdkwork/agentstudio-pc-types';
import { createKernelChatAgentCatalogService } from './kernelChatAgentCatalogService.ts';

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

function createDetail(
  runtimeKind: StudioInstanceDetailRecord['instance']['runtimeKind'],
  agents: Array<{
    id: string;
    name: string;
    description: string;
    avatar: string;
    systemPrompt: string;
    creator: string;
  }> = [],
): StudioInstanceDetailRecord {
  return {
    instance: {
      id: 'instance-a',
      name: 'Kernel Runtime',
      description: 'Fixture',
      runtimeKind,
      deploymentMode: 'remote',
      transportKind: runtimeKind === 'openclaw' ? 'openclawGatewayWs' : 'customHttp',
      status: 'online',
      isBuiltIn: false,
      isDefault: false,
      iconType: 'server',
      version: 'test',
      typeLabel: 'Fixture',
      host: '127.0.0.1',
      port: 18080,
      baseUrl: 'http://127.0.0.1:18080',
      websocketUrl: 'ws://127.0.0.1:18080',
      cpu: 0,
      memory: 0,
      totalMemory: '0 GB',
      uptime: '0m',
      capabilities: ['chat'],
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
      primaryTransport: runtimeKind === 'openclaw' ? 'openclawGatewayWs' : 'customHttp',
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
    workbench: {
      channels: [],
      cronTasks: {
        tasks: [],
        taskExecutionsById: {},
      },
      llmProviders: [],
      agents: agents.map((agent) => ({
        agent,
        focusAreas: [],
        automationFitScore: 80,
      })),
      skills: [],
      files: [],
      memory: [],
      tools: [],
    },
  };
}

function createAdapterResolution(input: {
  instanceId?: string;
  adapterId: string;
  authorityKind: 'gateway' | 'sqlite' | 'http' | 'localProjection';
  supported?: boolean;
  supportsAgentProfiles?: boolean;
  listAgentProfiles?: (instanceId: string) => Promise<
    Array<{
      kernelId: string;
      instanceId: string;
      agentId: string;
      label: string;
      description?: string | null;
      source: 'kernelCatalog' | 'workbenchProjection' | 'sessionBinding';
      systemPrompt?: string | null;
      avatar?: string | null;
      creator?: string | null;
    }>
  >;
}) {
  const instanceId = input.instanceId ?? 'instance-a';
  const capabilities = {
    adapterId: input.adapterId,
    authorityKind: input.authorityKind,
    supported: input.supported ?? true,
    durable: input.authorityKind !== 'http' && input.authorityKind !== 'localProjection',
    writable: input.authorityKind !== 'localProjection',
    supportsStreaming: true,
    supportsRuns: true,
    supportsAgentProfiles: input.supportsAgentProfiles ?? input.adapterId === 'openclawGateway',
    supportsSessionMutation: true,
    reason: input.supported === false ? 'Kernel adapter is not supported.' : null,
  };

  return {
    instanceId,
    instance: null,
    adapterId: input.adapterId,
    capabilities,
    adapter: {
      adapterId: input.adapterId,
      getCapabilities() {
        return capabilities;
      },
      listAgentProfiles: input.listAgentProfiles,
    },
  };
}

await runTest('kernelChatAgentCatalogService prefers OpenClaw kernel catalogs when the resolved adapter is the gateway authority', async () => {
  const service = createKernelChatAgentCatalogService({
    async getInstanceDetail() {
      return createDetail('custom', [
        {
          id: 'stale',
          name: 'Stale Agent',
          description: 'Should not win over kernel catalog.',
          avatar: 'S',
          systemPrompt: 'stale',
          creator: 'Workbench',
        },
      ]);
    },
    async resolveAdapterResolution() {
      return createAdapterResolution({
        adapterId: 'openclawGateway',
        authorityKind: 'gateway',
      });
    },
    async getOpenClawCatalog() {
      return {
        defaultAgentId: 'main',
        agents: [
          {
            id: 'main',
            name: 'Main',
            description: 'Main kernel agent.',
            avatar: 'M',
            systemPrompt: 'main',
            creator: 'OpenClaw',
            isDefault: true,
          },
        ],
      };
    },
  });

  const profiles = await service.listAgentProfiles('instance-a');
  const catalog = await service.getCatalog('instance-a');

  assert.deepEqual(profiles, [
    {
      kernelId: 'openclaw',
      instanceId: 'instance-a',
      agentId: 'main',
      label: 'Main',
      description: 'Main kernel agent.',
      source: 'kernelCatalog',
      systemPrompt: 'main',
      avatar: 'M',
      creator: 'OpenClaw',
    },
  ]);
  assert.deepEqual(catalog, {
    source: 'kernelCatalog',
    defaultAgentId: 'main',
    profiles: [
      {
        kernelId: 'openclaw',
        instanceId: 'instance-a',
        agentId: 'main',
        label: 'Main',
        description: 'Main kernel agent.',
        source: 'kernelCatalog',
        systemPrompt: 'main',
        avatar: 'M',
        creator: 'OpenClaw',
      },
    ],
    agents: [
      {
        id: 'main',
        name: 'Main',
        description: 'Main kernel agent.',
        avatar: 'M',
        systemPrompt: 'main',
        creator: 'OpenClaw',
      },
    ],
  });
});

await runTest('kernelChatAgentCatalogService prefers OpenClaw kernel catalogs from gateway authority even when the adapter id is not openclawGateway', async () => {
  const service = createKernelChatAgentCatalogService({
    async getInstanceDetail() {
      return createDetail('openclaw', [
        {
          id: 'stale',
          name: 'Stale Agent',
          description: 'Should not win over kernel catalog.',
          avatar: 'S',
          systemPrompt: 'stale',
          creator: 'Workbench',
        },
      ]);
    },
    async resolveAdapterResolution() {
      return createAdapterResolution({
        adapterId: 'customGatewayBridge',
        authorityKind: 'gateway',
      });
    },
    async getOpenClawCatalog() {
      return {
        defaultAgentId: 'ops',
        agents: [
          {
            id: 'ops',
            name: 'Ops',
            description: 'Gateway catalog agent.',
            avatar: 'O',
            systemPrompt: 'ops',
            creator: 'OpenClaw',
            isDefault: true,
          },
        ],
      };
    },
  });

  const catalog = await service.getCatalog('instance-a');

  assert.deepEqual(catalog, {
    source: 'kernelCatalog',
    defaultAgentId: 'ops',
    profiles: [
      {
        kernelId: 'openclaw',
        instanceId: 'instance-a',
        agentId: 'ops',
        label: 'Ops',
        description: 'Gateway catalog agent.',
        source: 'kernelCatalog',
        systemPrompt: 'ops',
        avatar: 'O',
        creator: 'OpenClaw',
      },
    ],
    agents: [
      {
        id: 'ops',
        name: 'Ops',
        description: 'Gateway catalog agent.',
        avatar: 'O',
        systemPrompt: 'ops',
        creator: 'OpenClaw',
      },
    ],
  });
});

await runTest('kernelChatAgentCatalogService falls back to workbench agents for non-openclaw runtimes', async () => {
  const service = createKernelChatAgentCatalogService({
    async getInstanceDetail() {
      return createDetail('custom', [
        {
          id: 'ops',
          name: 'Ops',
          description: 'Operations agent.',
          avatar: 'O',
          systemPrompt: 'ops',
          creator: 'Workbench',
        },
      ]);
    },
    async resolveAdapterResolution() {
      return createAdapterResolution({
        adapterId: 'transportBacked',
        authorityKind: 'http',
      });
    },
    async getOpenClawCatalog() {
      throw new Error('should not call openclaw catalog for non-openclaw runtimes');
    },
  });

  const profiles = await service.listAgentProfiles('instance-a');
  const agents = await service.listAgents('instance-a');
  const catalog = await service.getCatalog('instance-a');

  assert.deepEqual(profiles, [
    {
      kernelId: 'custom',
      instanceId: 'instance-a',
      agentId: 'ops',
      label: 'Ops',
      description: 'Operations agent.',
      source: 'workbenchProjection',
      systemPrompt: 'ops',
      avatar: 'O',
      creator: 'Workbench',
    },
  ]);
  assert.deepEqual(agents, [
    {
      id: 'ops',
      name: 'Ops',
      description: 'Operations agent.',
      avatar: 'O',
      systemPrompt: 'ops',
      creator: 'Workbench',
    },
  ]);
  assert.deepEqual(catalog, {
    source: 'workbenchProjection',
    defaultAgentId: null,
    profiles: [
      {
        kernelId: 'custom',
        instanceId: 'instance-a',
        agentId: 'ops',
        label: 'Ops',
        description: 'Operations agent.',
        source: 'workbenchProjection',
        systemPrompt: 'ops',
        avatar: 'O',
        creator: 'Workbench',
      },
    ],
    agents: [
      {
        id: 'ops',
        name: 'Ops',
        description: 'Operations agent.',
        avatar: 'O',
        systemPrompt: 'ops',
        creator: 'Workbench',
      },
    ],
  });
});

await runTest('kernelChatAgentCatalogService prefers adapter-backed kernel agent catalogs for non-openclaw authoritative runtimes', async () => {
  let openClawCatalogCalls = 0;
  const service = createKernelChatAgentCatalogService({
    async getInstanceDetail() {
      return createDetail('hermes', [
        {
          id: 'stale',
          name: 'Stale Workbench Agent',
          description: 'Should not override the authoritative kernel catalog.',
          avatar: 'S',
          systemPrompt: 'stale',
          creator: 'Workbench',
        },
      ]);
    },
    async resolveAdapterResolution() {
      return createAdapterResolution({
        adapterId: 'hermes',
        authorityKind: 'http',
        supportsAgentProfiles: true,
        async listAgentProfiles(instanceId) {
          assert.equal(instanceId, 'instance-a');
          return [
            {
              kernelId: 'hermes',
              instanceId,
              agentId: 'planner',
              label: 'Planner',
              description: 'Hermes planner agent.',
              source: 'kernelCatalog',
              systemPrompt: 'plan first',
              avatar: 'P',
              creator: 'Hermes',
            },
          ];
        },
      });
    },
    async getOpenClawCatalog() {
      openClawCatalogCalls++;
      throw new Error('should not call openclaw catalog for hermes kernel adapters');
    },
  });

  const profiles = await service.listAgentProfiles('instance-a');
  const agents = await service.listAgents('instance-a');
  const catalog = await service.getCatalog('instance-a');

  assert.deepEqual(profiles, [
    {
      kernelId: 'hermes',
      instanceId: 'instance-a',
      agentId: 'planner',
      label: 'Planner',
      description: 'Hermes planner agent.',
      source: 'kernelCatalog',
      systemPrompt: 'plan first',
      avatar: 'P',
      creator: 'Hermes',
    },
  ]);
  assert.deepEqual(agents, [
    {
      id: 'planner',
      name: 'Planner',
      description: 'Hermes planner agent.',
      avatar: 'P',
      systemPrompt: 'plan first',
      creator: 'Hermes',
    },
  ]);
  assert.deepEqual(catalog, {
    source: 'kernelCatalog',
    defaultAgentId: null,
    profiles: [
      {
        kernelId: 'hermes',
        instanceId: 'instance-a',
        agentId: 'planner',
        label: 'Planner',
        description: 'Hermes planner agent.',
        source: 'kernelCatalog',
        systemPrompt: 'plan first',
        avatar: 'P',
        creator: 'Hermes',
      },
    ],
    agents: [
      {
        id: 'planner',
        name: 'Planner',
        description: 'Hermes planner agent.',
        avatar: 'P',
        systemPrompt: 'plan first',
        creator: 'Hermes',
      },
    ],
  });
  assert.equal(openClawCatalogCalls, 0);
});

await runTest('kernelChatAgentCatalogService returns no profiles when the resolved adapter is explicitly unsupported', async () => {
  let openClawCatalogCalls = 0;
  const service = createKernelChatAgentCatalogService({
    async getInstanceDetail() {
      return createDetail('custom', [
        {
          id: 'ops',
          name: 'Ops',
          description: 'Operations agent.',
          avatar: 'O',
          systemPrompt: 'ops',
          creator: 'Workbench',
        },
      ]);
    },
    async resolveAdapterResolution() {
      return createAdapterResolution({
        adapterId: 'unsupported',
        authorityKind: 'localProjection',
        supported: false,
      });
    },
    async getOpenClawCatalog() {
      openClawCatalogCalls++;
      throw new Error('unsupported adapter should not request kernel catalog');
    },
  });

  const profiles = await service.listAgentProfiles('instance-a');
  const agents = await service.listAgents('instance-a');
  const catalog = await service.getCatalog('instance-a');

  assert.deepEqual(profiles, []);
  assert.deepEqual(agents, []);
  assert.deepEqual(catalog, {
    source: 'none',
    defaultAgentId: null,
    profiles: [],
    agents: [],
  });
  assert.equal(openClawCatalogCalls, 0);
});

await runTest('kernelChatAgentCatalogService synchronizes runtime agent catalogs into persisted local agent records before resolving the visible catalog', async () => {
  let persistedRecords: Array<{
    id: string;
    instanceId: string;
    kernelId: string;
    agentId: string;
    label: string;
    description?: string | null;
    source: 'kernelCatalog' | 'workbenchProjection' | 'sessionBinding';
    systemPrompt?: string | null;
    avatar?: string | null;
    creator?: string | null;
    isDefault: boolean;
    sortOrder: number;
    syncedAt: number;
    nativeMetadata?: Record<string, unknown> | null;
  }> = [];
  let replaceCalls = 0;

  const service = createKernelChatAgentCatalogService({
    async getInstanceDetail() {
      return createDetail('hermes');
    },
    async resolveAdapterResolution() {
      return createAdapterResolution({
        adapterId: 'hermes',
        authorityKind: 'http',
        supportsAgentProfiles: true,
        async listAgentProfiles(instanceId) {
          return [
            {
              kernelId: 'hermes',
              instanceId,
              agentId: 'planner',
              label: 'Planner',
              description: 'Hermes planner agent.',
              source: 'kernelCatalog',
              systemPrompt: 'plan first',
              avatar: 'P',
              creator: 'Hermes',
            },
            {
              kernelId: 'hermes',
              instanceId,
              agentId: 'main',
              label: 'Main',
              description: 'Primary agent.',
              source: 'kernelCatalog',
              systemPrompt: 'main',
              avatar: 'M',
              creator: 'Hermes',
            },
          ];
        },
      });
    },
    async getOpenClawCatalog() {
      throw new Error('should not call openclaw catalog for hermes kernel adapters');
    },
    async listPersistedKernelChatAgents() {
      return persistedRecords;
    },
    async replacePersistedKernelChatAgents(instanceId, records) {
      replaceCalls++;
      assert.equal(instanceId, 'instance-a');
      assert.equal(records.length, 2);
      assert.equal(records[0]?.instanceId, 'instance-a');
      assert.equal(records[0]?.kernelId, 'hermes');
      assert.equal(records[0]?.agentId, 'main');
      assert.equal(records[0]?.sortOrder, 0);
      assert.equal(records[1]?.sortOrder, 1);
      assert.equal(typeof records[0]?.syncedAt, 'number');
      assert.equal(records[0]?.isDefault, true);
      persistedRecords = records;
      return persistedRecords;
    },
  });

  const catalog = await service.getCatalog('instance-a');

  assert.equal(replaceCalls, 1);
  assert.deepEqual(catalog, {
    source: 'kernelCatalog',
    defaultAgentId: 'main',
    profiles: [
      {
        kernelId: 'hermes',
        instanceId: 'instance-a',
        agentId: 'main',
        label: 'Main',
        description: 'Primary agent.',
        source: 'kernelCatalog',
        systemPrompt: 'main',
        avatar: 'M',
        creator: 'Hermes',
      },
      {
        kernelId: 'hermes',
        instanceId: 'instance-a',
        agentId: 'planner',
        label: 'Planner',
        description: 'Hermes planner agent.',
        source: 'kernelCatalog',
        systemPrompt: 'plan first',
        avatar: 'P',
        creator: 'Hermes',
      },
    ],
    agents: [
      {
        id: 'main',
        name: 'Main',
        description: 'Primary agent.',
        avatar: 'M',
        systemPrompt: 'main',
        creator: 'Hermes',
      },
      {
        id: 'planner',
        name: 'Planner',
        description: 'Hermes planner agent.',
        avatar: 'P',
        systemPrompt: 'plan first',
        creator: 'Hermes',
      },
    ],
  });
});

await runTest('kernelChatAgentCatalogService canonicalizes duplicate runtime agent profiles and promotes the semantic main agent as the default selection', async () => {
  const service = createKernelChatAgentCatalogService({
    async getInstanceDetail() {
      return createDetail('hermes');
    },
    async resolveAdapterResolution() {
      return createAdapterResolution({
        adapterId: 'hermes',
        authorityKind: 'http',
        supportsAgentProfiles: true,
        async listAgentProfiles(instanceId) {
          return [
            {
              kernelId: 'hermes',
              instanceId,
              agentId: ' planner ',
              label: ' ',
              description: null,
              source: 'workbenchProjection',
              systemPrompt: null,
              avatar: null,
              creator: null,
            },
            {
              kernelId: 'hermes',
              instanceId,
              agentId: 'planner',
              label: 'Planner',
              description: 'Hermes planner agent.',
              source: 'kernelCatalog',
              systemPrompt: 'plan first',
              avatar: 'P',
              creator: 'Hermes',
            },
            {
              kernelId: 'hermes',
              instanceId,
              agentId: 'main',
              label: ' ',
              description: 'Primary agent.',
              source: 'kernelCatalog',
              systemPrompt: 'main',
              avatar: 'M',
              creator: 'Hermes',
            },
          ];
        },
      });
    },
    async getOpenClawCatalog() {
      throw new Error('should not call openclaw catalog for hermes kernel adapters');
    },
  });

  const catalog = await service.getCatalog('instance-a');

  assert.deepEqual(catalog, {
    source: 'kernelCatalog',
    defaultAgentId: 'main',
    profiles: [
      {
        kernelId: 'hermes',
        instanceId: 'instance-a',
        agentId: 'main',
        label: 'Main',
        description: 'Primary agent.',
        source: 'kernelCatalog',
        systemPrompt: 'main',
        avatar: 'M',
        creator: 'Hermes',
      },
      {
        kernelId: 'hermes',
        instanceId: 'instance-a',
        agentId: 'planner',
        label: 'Planner',
        description: 'Hermes planner agent.',
        source: 'kernelCatalog',
        systemPrompt: 'plan first',
        avatar: 'P',
        creator: 'Hermes',
      },
    ],
    agents: [
      {
        id: 'main',
        name: 'Main',
        description: 'Primary agent.',
        avatar: 'M',
        systemPrompt: 'main',
        creator: 'Hermes',
      },
      {
        id: 'planner',
        name: 'Planner',
        description: 'Hermes planner agent.',
        avatar: 'P',
        systemPrompt: 'plan first',
        creator: 'Hermes',
      },
    ],
  });
});

await runTest('kernelChatAgentCatalogService falls back to persisted local agent records when runtime synchronization fails', async () => {
  const persistedRecords = [
    {
      id: 'instance-a:hermes:planner',
      instanceId: 'instance-a',
      kernelId: 'hermes',
      agentId: 'planner',
      label: 'Planner',
      description: 'Persisted planner agent.',
      source: 'kernelCatalog' as const,
      systemPrompt: 'plan first',
      avatar: 'P',
      creator: 'Hermes',
      isDefault: true,
      sortOrder: 0,
      syncedAt: 1_717_171_717,
      nativeMetadata: {
        persisted: true,
      },
    },
  ];

  const service = createKernelChatAgentCatalogService({
    async getInstanceDetail() {
      return createDetail('hermes');
    },
    async resolveAdapterResolution() {
      throw new Error('runtime agent catalog unavailable');
    },
    async getOpenClawCatalog() {
      throw new Error('should not request openclaw catalog');
    },
    async listPersistedKernelChatAgents() {
      return persistedRecords;
    },
    async replacePersistedKernelChatAgents() {
      throw new Error('should not rewrite persisted agents when runtime synchronization fails');
    },
  });

  const catalog = await service.getCatalog('instance-a');

  assert.deepEqual(catalog, {
    source: 'kernelCatalog',
    defaultAgentId: 'planner',
    profiles: [
      {
        kernelId: 'hermes',
        instanceId: 'instance-a',
        agentId: 'planner',
        label: 'Planner',
        description: 'Persisted planner agent.',
        source: 'kernelCatalog',
        systemPrompt: 'plan first',
        avatar: 'P',
        creator: 'Hermes',
      },
    ],
    agents: [
      {
        id: 'planner',
        name: 'Planner',
        description: 'Persisted planner agent.',
        avatar: 'P',
        systemPrompt: 'plan first',
        creator: 'Hermes',
      },
    ],
  });
});

await runTest('kernelChatAgentCatalogService canonicalizes persisted local agent records when runtime synchronization fails', async () => {
  const service = createKernelChatAgentCatalogService({
    async getInstanceDetail() {
      return createDetail('hermes');
    },
    async resolveAdapterResolution() {
      throw new Error('runtime agent catalog unavailable');
    },
    async getOpenClawCatalog() {
      throw new Error('should not request openclaw catalog');
    },
    async listPersistedKernelChatAgents() {
      return [
        {
          id: 'instance-a:hermes:Planner',
          instanceId: 'instance-a',
          kernelId: 'hermes',
          agentId: 'Planner',
          label: 'Planner Draft',
          description: null,
          source: 'sessionBinding',
          systemPrompt: null,
          avatar: null,
          creator: null,
          isDefault: false,
          sortOrder: 4,
          syncedAt: 1_000,
          nativeMetadata: null,
        },
        {
          id: 'instance-a:hermes:planner',
          instanceId: 'instance-a',
          kernelId: 'hermes',
          agentId: 'planner',
          label: 'Planner',
          description: 'Persisted planner agent.',
          source: 'kernelCatalog',
          systemPrompt: 'plan first',
          avatar: 'P',
          creator: 'Hermes',
          isDefault: false,
          sortOrder: 1,
          syncedAt: 2_000,
          nativeMetadata: null,
        },
        {
          id: 'instance-a:hermes:main',
          instanceId: 'instance-a',
          kernelId: 'hermes',
          agentId: 'main',
          label: ' ',
          description: 'Persisted primary agent.',
          source: 'kernelCatalog',
          systemPrompt: 'main',
          avatar: 'M',
          creator: 'Hermes',
          isDefault: false,
          sortOrder: 2,
          syncedAt: 3_000,
          nativeMetadata: null,
        },
      ];
    },
    async replacePersistedKernelChatAgents() {
      throw new Error('should not rewrite persisted agents when runtime synchronization fails');
    },
  });

  const catalog = await service.getCatalog('instance-a');

  assert.deepEqual(catalog, {
    source: 'kernelCatalog',
    defaultAgentId: 'main',
    profiles: [
      {
        kernelId: 'hermes',
        instanceId: 'instance-a',
        agentId: 'main',
        label: 'Main',
        description: 'Persisted primary agent.',
        source: 'kernelCatalog',
        systemPrompt: 'main',
        avatar: 'M',
        creator: 'Hermes',
      },
      {
        kernelId: 'hermes',
        instanceId: 'instance-a',
        agentId: 'planner',
        label: 'Planner',
        description: 'Persisted planner agent.',
        source: 'kernelCatalog',
        systemPrompt: 'plan first',
        avatar: 'P',
        creator: 'Hermes',
      },
    ],
    agents: [
      {
        id: 'main',
        name: 'Main',
        description: 'Persisted primary agent.',
        avatar: 'M',
        systemPrompt: 'main',
        creator: 'Hermes',
      },
      {
        id: 'planner',
        name: 'Planner',
        description: 'Persisted planner agent.',
        avatar: 'P',
        systemPrompt: 'plan first',
        creator: 'Hermes',
      },
    ],
  });
});

await runTest('kernelChatAgentCatalogService canonicalizes legacy persisted binding agent sources from persisted local agent records', async () => {
  const service = createKernelChatAgentCatalogService({
    async getInstanceDetail() {
      return createDetail('hermes');
    },
    async resolveAdapterResolution() {
      throw new Error('runtime agent catalog unavailable');
    },
    async getOpenClawCatalog() {
      throw new Error('should not request openclaw catalog');
    },
    async listPersistedKernelChatAgents() {
      return [
        {
          id: 'instance-a:hermes:planner',
          instanceId: 'instance-a',
          kernelId: 'hermes',
          agentId: 'planner',
          label: 'Planner',
          description: 'Legacy persisted binding agent.',
          source: 'persistedBinding' as unknown as
            | 'kernelCatalog'
            | 'workbenchProjection'
            | 'sessionBinding',
          systemPrompt: 'plan first',
          avatar: 'P',
          creator: 'Hermes',
          isDefault: true,
          sortOrder: 0,
          syncedAt: 1_717_171_717,
          nativeMetadata: {
            persisted: true,
          },
        },
      ];
    },
    async replacePersistedKernelChatAgents() {
      throw new Error('should not rewrite persisted agents when runtime synchronization fails');
    },
  });

  const catalog = await service.getCatalog('instance-a');

  assert.deepEqual(catalog, {
    source: 'workbenchProjection',
    defaultAgentId: 'planner',
    profiles: [
      {
        kernelId: 'hermes',
        instanceId: 'instance-a',
        agentId: 'planner',
        label: 'Planner',
        description: 'Legacy persisted binding agent.',
        source: 'sessionBinding',
        systemPrompt: 'plan first',
        avatar: 'P',
        creator: 'Hermes',
      },
    ],
    agents: [
      {
        id: 'planner',
        name: 'Planner',
        description: 'Legacy persisted binding agent.',
        avatar: 'P',
        systemPrompt: 'plan first',
        creator: 'Hermes',
      },
    ],
  });
});
