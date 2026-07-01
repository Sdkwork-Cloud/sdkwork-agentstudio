import assert from 'node:assert/strict';
import type { StudioInstanceDetailRecord } from '@sdkwork/claw-types';
import { configurePlatformBridge, getPlatformBridge } from '@sdkwork/claw-infrastructure';
import { agentService } from './agentService.ts';

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

function createDetail(instanceId: string): StudioInstanceDetailRecord {
  return {
    instance: {
      id: instanceId,
      name: 'Custom Runtime',
      description: 'Agent service fixture.',
      runtimeKind: 'custom',
      deploymentMode: 'remote',
      transportKind: 'customHttp',
      status: 'online',
      isBuiltIn: false,
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
      primaryTransport: 'customHttp',
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
      agents: [
        {
          agent: {
            id: 'ops',
            name: 'Ops',
            description: 'Operations agent.',
            avatar: 'O',
            systemPrompt: 'Handle incidents.',
            creator: 'Runtime',
          },
          focusAreas: ['Operations'],
          automationFitScore: 86,
        },
      ],
      skills: [],
      files: [],
      memory: [],
      tools: [],
    },
  };
}

await runTest('agentService reads agents through the kernel chat catalog projection instead of a mock registry', async () => {
  const originalBridge = getPlatformBridge();

  configurePlatformBridge({
    studio: {
      ...originalBridge.studio,
      async getInstanceDetail(instanceId) {
        return createDetail(instanceId);
      },
    },
  });

  try {
    const agents = await agentService.getAgents('custom-runtime');

    assert.deepEqual(agents, [
      {
        id: 'ops',
        name: 'Ops',
        description: 'Operations agent.',
        avatar: 'O',
        systemPrompt: 'Handle incidents.',
        creator: 'Runtime',
      },
    ]);
  } finally {
    configurePlatformBridge(originalBridge);
  }
});

await runTest('agentService returns an empty list when no instance context is provided', async () => {
  assert.deepEqual(await agentService.getAgents(), []);
});
