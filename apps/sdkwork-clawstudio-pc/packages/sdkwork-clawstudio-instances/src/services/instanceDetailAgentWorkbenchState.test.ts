import assert from 'node:assert/strict';
import type { AgentWorkbenchSnapshot } from './agentWorkbenchServiceCore.ts';
import {
  applyInstanceDetailAgentWorkbenchSyncState,
  startLoadInstanceDetailAgentWorkbench,
} from './instanceDetailAgentWorkbenchState.ts';

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

function createAgents(ids: string[]) {
  return ids.map((id) => ({
    agent: {
      id,
      name: id,
      description: `${id} description`,
      avatar: id.slice(0, 1).toUpperCase(),
      systemPrompt: `prompt:${id}`,
      creator: 'OpenClaw',
    },
    focusAreas: [],
    automationFitScore: 80,
    workspace: `/workspace/${id}`,
    configSource: 'runtime' as const,
  }));
}

function createAgentWorkbenchSnapshot(id: string): AgentWorkbenchSnapshot {
  return {
    agent: {
      agent: {
        id,
        name: id,
        description: `${id} description`,
        avatar: id.slice(0, 1).toUpperCase(),
        systemPrompt: `prompt:${id}`,
        creator: 'OpenClaw',
      },
      focusAreas: [],
      automationFitScore: 80,
      workspace: `/workspace/${id}`,
      configSource: 'runtime',
    },
    model: {
      primary: 'gpt-5.4',
      fallbacks: [],
      source: 'runtime',
    },
    paths: {
      workspacePath: `/workspace/${id}`,
      skillsDirectoryPath: `/workspace/${id}/skills`,
      agentDirPath: `/workspace/${id}`,
      authProfilesPath: `/workspace/${id}/auth.json`,
      modelsRegistryPath: `/workspace/${id}/models.json`,
      sessionsPath: `/workspace/${id}/sessions`,
    },
    tasks: [],
    files: [],
    skills: [],
    tools: [],
    modelProviders: [],
    channels: [],
  };
}

runTest(
  'applyInstanceDetailAgentWorkbenchSyncState clears agent workbench state when no agents remain',
  () => {
    const captured = {
      selectedAgentId: 'stale-agent' as string | null,
      selectedAgentWorkbench: createAgentWorkbenchSnapshot('stale'),
      agentWorkbenchError: 'stale-error' as string | null,
      isAgentWorkbenchLoading: true,
    };

    applyInstanceDetailAgentWorkbenchSyncState({
      agents: [],
      setSelectedAgentId: (value) => {
        captured.selectedAgentId =
          typeof value === 'function' ? value(captured.selectedAgentId) : value;
      },
      setSelectedAgentWorkbench: (value) => {
        captured.selectedAgentWorkbench = value;
      },
      setAgentWorkbenchError: (value) => {
        captured.agentWorkbenchError = value;
      },
      setIsAgentWorkbenchLoading: (value) => {
        captured.isAgentWorkbenchLoading = value;
      },
    });

    assert.deepEqual(captured, {
      selectedAgentId: null,
      selectedAgentWorkbench: null,
      agentWorkbenchError: null,
      isAgentWorkbenchLoading: false,
    });
  },
);

runTest(
  'applyInstanceDetailAgentWorkbenchSyncState preserves a valid selected agent and otherwise falls back to the first available agent',
  () => {
    const agents = createAgents(['alpha', 'beta']);
    let selectedAgentId: string | null = 'beta';

    applyInstanceDetailAgentWorkbenchSyncState({
      agents,
      setSelectedAgentId: (value) => {
        selectedAgentId = typeof value === 'function' ? value(selectedAgentId) : value;
      },
      setSelectedAgentWorkbench: () => {
        throw new Error('unexpected workbench reset');
      },
      setAgentWorkbenchError: () => {
        throw new Error('unexpected error reset');
      },
      setIsAgentWorkbenchLoading: () => {
        throw new Error('unexpected loading reset');
      },
    });

    assert.equal(selectedAgentId, 'beta');

    applyInstanceDetailAgentWorkbenchSyncState({
      agents,
      setSelectedAgentId: (value) => {
        selectedAgentId = typeof value === 'function' ? value('missing') : value;
      },
      setSelectedAgentWorkbench: () => {
        throw new Error('unexpected workbench reset');
      },
      setAgentWorkbenchError: () => {
        throw new Error('unexpected error reset');
      },
      setIsAgentWorkbenchLoading: () => {
        throw new Error('unexpected loading reset');
      },
    });

    assert.equal(selectedAgentId, 'alpha');
  },
);

await runAsyncTest(
  'startLoadInstanceDetailAgentWorkbench loads the selected agent workbench through the injected loader',
  async () => {
    const snapshot = createAgentWorkbenchSnapshot('alpha');
    const loadingStates: boolean[] = [];
    const captured = {
      selectedAgentWorkbench: createAgentWorkbenchSnapshot('stale') as AgentWorkbenchSnapshot | null,
      agentWorkbenchError: 'stale-error' as string | null,
      isAgentWorkbenchLoading: false,
    };

    const cleanup = startLoadInstanceDetailAgentWorkbench({
      activeSection: 'agents',
      instanceId: 'instance-1',
      workbench: {
        instance: {
          id: 'instance-1',
        },
      } as any,
      selectedAgentId: 'alpha',
      setSelectedAgentWorkbench: (value) => {
        captured.selectedAgentWorkbench =
          typeof value === 'function' ? value(captured.selectedAgentWorkbench) : value;
      },
      setAgentWorkbenchError: (value) => {
        captured.agentWorkbenchError = value;
      },
      setIsAgentWorkbenchLoading: (value) => {
        captured.isAgentWorkbenchLoading =
          typeof value === 'function' ? value(captured.isAgentWorkbenchLoading) : value;
        loadingStates.push(captured.isAgentWorkbenchLoading);
      },
      loadAgentWorkbench: async (input) => {
        assert.equal(input.instanceId, 'instance-1');
        assert.equal(input.agentId, 'alpha');

        return snapshot;
      },
      reportError: (error) => {
        throw error;
      },
      fallbackErrorMessage: 'Failed to load agent detail.',
    });

    assert.equal(typeof cleanup, 'function');

    await flushMicrotasks();

    assert.deepEqual(loadingStates, [true, false]);
    assert.equal(captured.selectedAgentWorkbench, snapshot);
    assert.equal(captured.agentWorkbenchError, null);
    assert.equal(captured.isAgentWorkbenchLoading, false);
  },
);

await runAsyncTest(
  'startLoadInstanceDetailAgentWorkbench reports loader failures and applies the fallback error message',
  async () => {
    const failure = new Error('');
    const loadingStates: boolean[] = [];
    const captured = {
      selectedAgentWorkbench: createAgentWorkbenchSnapshot('stale') as AgentWorkbenchSnapshot | null,
      agentWorkbenchError: 'stale-error' as string | null,
      isAgentWorkbenchLoading: false,
    };
    let reportedError: unknown = null;

    const cleanup = startLoadInstanceDetailAgentWorkbench({
      activeSection: 'agents',
      instanceId: 'instance-1',
      workbench: {
        instance: {
          id: 'instance-1',
        },
      } as any,
      selectedAgentId: 'alpha',
      setSelectedAgentWorkbench: (value) => {
        captured.selectedAgentWorkbench =
          typeof value === 'function' ? value(captured.selectedAgentWorkbench) : value;
      },
      setAgentWorkbenchError: (value) => {
        captured.agentWorkbenchError = value;
      },
      setIsAgentWorkbenchLoading: (value) => {
        captured.isAgentWorkbenchLoading =
          typeof value === 'function' ? value(captured.isAgentWorkbenchLoading) : value;
        loadingStates.push(captured.isAgentWorkbenchLoading);
      },
      loadAgentWorkbench: async () => {
        throw failure;
      },
      reportError: (error) => {
        reportedError = error;
      },
      fallbackErrorMessage: 'Failed to load agent detail.',
    });

    assert.equal(typeof cleanup, 'function');

    await flushMicrotasks();

    assert.deepEqual(loadingStates, [true, false]);
    assert.equal(captured.selectedAgentWorkbench, null);
    assert.equal(captured.agentWorkbenchError, 'Failed to load agent detail.');
    assert.equal(reportedError, failure);
  },
);

await runAsyncTest(
  'startLoadInstanceDetailAgentWorkbench suppresses post-resolution updates after cancellation',
  async () => {
    const deferred = createDeferred<AgentWorkbenchSnapshot>();
    const loadingStates: boolean[] = [];
    const captured = {
      selectedAgentWorkbench: null as AgentWorkbenchSnapshot | null,
      agentWorkbenchError: null as string | null,
      isAgentWorkbenchLoading: false,
    };

    const cleanup = startLoadInstanceDetailAgentWorkbench({
      activeSection: 'agents',
      instanceId: 'instance-1',
      workbench: {
        instance: {
          id: 'instance-1',
        },
      } as any,
      selectedAgentId: 'alpha',
      setSelectedAgentWorkbench: (value) => {
        captured.selectedAgentWorkbench =
          typeof value === 'function' ? value(captured.selectedAgentWorkbench) : value;
      },
      setAgentWorkbenchError: (value) => {
        captured.agentWorkbenchError = value;
      },
      setIsAgentWorkbenchLoading: (value) => {
        captured.isAgentWorkbenchLoading =
          typeof value === 'function' ? value(captured.isAgentWorkbenchLoading) : value;
        loadingStates.push(captured.isAgentWorkbenchLoading);
      },
      loadAgentWorkbench: async () => deferred.promise,
      reportError: (error) => {
        throw error;
      },
      fallbackErrorMessage: 'Failed to load agent detail.',
    });

    assert.equal(typeof cleanup, 'function');
    cleanup?.();
    deferred.resolve(createAgentWorkbenchSnapshot('alpha'));

    await flushMicrotasks();

    assert.deepEqual(loadingStates, [true]);
    assert.equal(captured.selectedAgentWorkbench, null);
    assert.equal(captured.agentWorkbenchError, null);
  },
);
