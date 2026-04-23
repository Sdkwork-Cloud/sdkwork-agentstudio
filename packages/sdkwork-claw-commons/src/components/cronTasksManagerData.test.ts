import assert from 'node:assert/strict';
import { loadTaskStudioSnapshot } from './cronTasksManagerData.ts';

function createTaskRuntimeOverview() {
  return {
    runtimeTaskSurface: false,
    taskBoard: {
      supported: false,
      message: null,
      items: [],
    },
    taskFlows: {
      supported: false,
      message: null,
      items: [],
    },
  };
}

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

await runTest('initial task snapshot skips execution history prefetch when no history task ids are requested', async () => {
  let executionHistoryCalls = 0;

  const snapshot = await loadTaskStudioSnapshot({
    instanceId: 'instance-a',
    getTasks: async () => [{ id: 'task-1' }, { id: 'task-2' }] as any[],
    getTaskRuntimeOverview: async () => createTaskRuntimeOverview() as any,
    listDeliveryChannels: async () => [],
    getAgentCatalog: async () => ({
      agents: [],
      defaultAgentId: null,
    }),
    listTaskExecutions: async () => {
      executionHistoryCalls += 1;
      return [] as any[];
    },
  });

  assert.equal(executionHistoryCalls, 0);
  assert.deepEqual(snapshot.executionsByTaskId, {});
});

await runTest('task snapshot only fetches execution history for explicitly requested tasks', async () => {
  const requestedTaskIds: string[] = [];

  const snapshot = await loadTaskStudioSnapshot({
    instanceId: 'instance-a',
    historyTaskIds: ['task-2'],
    getTasks: async () => [{ id: 'task-1' }, { id: 'task-2' }] as any[],
    getTaskRuntimeOverview: async () => createTaskRuntimeOverview() as any,
    listDeliveryChannels: async () => [],
    getAgentCatalog: async () => ({
      agents: [],
      defaultAgentId: null,
    }),
    listTaskExecutions: async (_instanceId, taskId) => {
      requestedTaskIds.push(taskId);
      return [{ id: `execution-${taskId}` }] as any[];
    },
  });

  assert.deepEqual(requestedTaskIds, ['task-2']);
  assert.deepEqual(Object.keys(snapshot.executionsByTaskId), ['task-2']);
});

await runTest('task snapshot can skip editor resources during list-first hydration', async () => {
  let deliveryChannelCalls = 0;
  let agentCatalogCalls = 0;

  const snapshot = await loadTaskStudioSnapshot({
    instanceId: 'instance-a',
    includeEditorResources: false,
    getTasks: async () => [{ id: 'task-1' }] as any[],
    getTaskRuntimeOverview: async () => createTaskRuntimeOverview() as any,
    listDeliveryChannels: async () => {
      deliveryChannelCalls += 1;
      return [] as any[];
    },
    getAgentCatalog: async () => {
      agentCatalogCalls += 1;
      return {
        agents: [],
        defaultAgentId: null,
      };
    },
    listTaskExecutions: async () => [] as any[],
  });

  assert.equal(deliveryChannelCalls, 0);
  assert.equal(agentCatalogCalls, 0);
  assert.deepEqual(snapshot.deliveryChannels, []);
  assert.deepEqual(snapshot.agentCatalog, {
    agents: [],
    defaultAgentId: null,
  });
});
