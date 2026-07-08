import assert from 'node:assert/strict';

import type { CreateKernelAgentResult } from '@sdkwork/clawstudio-core';
import type { Agent } from '@sdkwork/clawstudio-types';
import type { KernelChatAgentCatalog } from './kernelChatAgentCatalogService.ts';
import {
  mergeCreatedKernelAgentIntoCatalog,
  resolveChatAgentCatalogState,
  resolveChatContextSelectionSyncMutation,
  shouldLoadKernelChatAgentCatalog,
} from './chatAgentCatalogPolicy.ts';

function runTest(name: string, callback: () => void | Promise<void>) {
  return Promise.resolve()
    .then(callback)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

const DIRECT_AGENTS: Agent[] = [
  {
    id: 'direct-agent',
    name: 'Direct Agent',
    description: 'Direct catalog entry',
    avatar: 'direct-agent.png',
    systemPrompt: 'You are direct.',
    creator: 'sdkwork',
  },
];

const KERNEL_AGENTS: Agent[] = [
  {
    id: 'kernel-agent',
    name: 'Kernel Agent',
    description: 'Kernel catalog entry',
    avatar: 'kernel-agent.png',
    systemPrompt: 'You are kernel.',
    creator: 'sdkwork',
  },
];

const EXISTING_KERNEL_CATALOG: KernelChatAgentCatalog = {
  source: 'kernelCatalog',
  defaultAgentId: 'main',
  agents: [
    {
      id: 'main',
      name: 'Main',
      description: 'Default OpenClaw agent',
      avatar: 'M',
      systemPrompt: 'You are main.',
      creator: 'OpenClaw',
    },
  ],
  profiles: [
    {
      instanceId: 'openclaw-prod',
      kernelId: 'openclaw',
      agentId: 'main',
      label: 'Main',
      description: 'Default OpenClaw agent',
      source: 'kernelCatalog',
      systemPrompt: 'You are main.',
      avatar: 'M',
      creator: 'OpenClaw',
    },
  ],
};

const CREATED_AGENT_RESULT: CreateKernelAgentResult = {
  instanceId: 'openclaw-prod',
  kernelId: 'openclaw',
  agentId: 'ops-responder',
  displayName: 'Ops Responder',
};

await runTest(
  'shouldLoadKernelChatAgentCatalog only hydrates kernel catalogs for supported kernel-catalog routes',
  () => {
    assert.equal(
      shouldLoadKernelChatAgentCatalog({
        activeInstanceId: null,
        isChatSupported: true,
        agentCatalogMode: 'kernelCatalog',
      }),
      false,
    );

    assert.equal(
      shouldLoadKernelChatAgentCatalog({
        activeInstanceId: 'instance-openclaw',
        isChatSupported: false,
        agentCatalogMode: 'kernelCatalog',
      }),
      false,
    );

    assert.equal(
      shouldLoadKernelChatAgentCatalog({
        activeInstanceId: 'instance-openclaw',
        isChatSupported: true,
        agentCatalogMode: 'sharedCatalog',
      }),
      false,
    );

    assert.equal(
      shouldLoadKernelChatAgentCatalog({
        activeInstanceId: 'instance-openclaw',
        isChatSupported: true,
        agentCatalogMode: 'kernelCatalog',
      }),
      true,
    );
  },
);

await runTest(
  'mergeCreatedKernelAgentIntoCatalog makes a newly created agent visible without waiting for the next runtime catalog refresh',
  () => {
    const patchedCatalog = mergeCreatedKernelAgentIntoCatalog(
      EXISTING_KERNEL_CATALOG,
      CREATED_AGENT_RESULT,
    );

    assert.notEqual(patchedCatalog, EXISTING_KERNEL_CATALOG);
    assert.deepEqual(
      patchedCatalog.agents.map((agent) => agent.id),
      ['main', 'ops-responder'],
    );
    assert.deepEqual(
      patchedCatalog.profiles.map((profile) => profile.agentId),
      ['main', 'ops-responder'],
    );
    assert.equal(patchedCatalog.defaultAgentId, 'main');
    assert.equal(patchedCatalog.source, 'kernelCatalog');
    assert.deepEqual(patchedCatalog.agents[1], {
      id: 'ops-responder',
      name: 'Ops Responder',
      description: '',
      avatar: 'AI',
      systemPrompt: '',
      creator: 'OpenClaw',
    });
    assert.deepEqual(patchedCatalog.profiles[1], {
      instanceId: 'openclaw-prod',
      kernelId: 'openclaw',
      agentId: 'ops-responder',
      label: 'Ops Responder',
      description: null,
      source: 'kernelCatalog',
      systemPrompt: null,
      avatar: null,
      creator: null,
    });
  },
);

await runTest(
  'mergeCreatedKernelAgentIntoCatalog preserves existing agent metadata when a refresh repeats the created id',
  () => {
    const patchedCatalog = mergeCreatedKernelAgentIntoCatalog(
      {
        ...EXISTING_KERNEL_CATALOG,
        agents: [
          ...EXISTING_KERNEL_CATALOG.agents,
          {
            id: 'ops-responder',
            name: 'Runtime Ops',
            description: 'Runtime metadata already arrived',
            avatar: 'O',
            systemPrompt: 'Use runtime instructions.',
            creator: 'Runtime',
          },
        ],
        profiles: [
          ...EXISTING_KERNEL_CATALOG.profiles,
          {
            instanceId: 'openclaw-prod',
            kernelId: 'openclaw',
            agentId: 'ops-responder',
            label: 'Runtime Ops',
            description: 'Runtime metadata already arrived',
            source: 'kernelCatalog',
            systemPrompt: 'Use runtime instructions.',
            avatar: 'O',
            creator: 'Runtime',
          },
        ],
      },
      CREATED_AGENT_RESULT,
    );

    assert.deepEqual(
      patchedCatalog.agents.map((agent) => agent.id),
      ['main', 'ops-responder'],
    );
    assert.deepEqual(patchedCatalog.agents[1], {
      id: 'ops-responder',
      name: 'Runtime Ops',
      description: 'Runtime metadata already arrived',
      avatar: 'O',
      systemPrompt: 'Use runtime instructions.',
      creator: 'Runtime',
    });
    assert.deepEqual(patchedCatalog.profiles[1], {
      instanceId: 'openclaw-prod',
      kernelId: 'openclaw',
      agentId: 'ops-responder',
      label: 'Runtime Ops',
      description: 'Runtime metadata already arrived',
      source: 'kernelCatalog',
      systemPrompt: 'Use runtime instructions.',
      avatar: 'O',
      creator: 'Runtime',
    });
  },
);

await runTest(
  'resolveChatContextSelectionSyncMutation clears unsupported route selections and prunes stale agent ids once visible agents resolve',
  () => {
    assert.deepEqual(
      resolveChatContextSelectionSyncMutation({
        isChatSupported: false,
        selectedAgentId: 'kernel-agent',
        selectedSkillId: 'skill-a',
        hasResolvedVisibleAgents: true,
        visibleAgentIds: ['kernel-agent'],
      }),
      {
        nextSelectedAgentId: undefined,
        nextSelectedSkillId: null,
      },
    );

    assert.deepEqual(
      resolveChatContextSelectionSyncMutation({
        isChatSupported: true,
        selectedAgentId: 'missing-agent',
        selectedSkillId: 'skill-a',
        hasResolvedVisibleAgents: true,
        visibleAgentIds: ['kernel-agent'],
      }),
      {
        nextSelectedAgentId: undefined,
        nextSelectedSkillId: 'skill-a',
      },
    );

    assert.equal(
      resolveChatContextSelectionSyncMutation({
        isChatSupported: true,
        selectedAgentId: 'kernel-agent',
        selectedSkillId: 'skill-a',
        hasResolvedVisibleAgents: true,
        visibleAgentIds: ['kernel-agent'],
      }),
      null,
    );
  },
);

await runTest(
  'resolveChatContextSelectionSyncMutation keeps the active session agent selected when the catalog is temporarily missing it',
  () => {
    assert.equal(
      resolveChatContextSelectionSyncMutation({
        isChatSupported: true,
        selectedAgentId: 'research',
        selectedSkillId: 'skill-a',
        hasResolvedVisibleAgents: true,
        visibleAgentIds: ['ops'],
        activeSessionAgentId: 'research',
      }),
      null,
    );
  },
);

await runTest(
  'resolveChatAgentCatalogState prefers kernel agents and default kernel agent identity in kernel-catalog mode',
  () => {
    assert.deepEqual(
      resolveChatAgentCatalogState({
        activeInstanceId: 'instance-openclaw',
        isChatSupported: true,
        agentCatalogMode: 'kernelCatalog',
        selectedAgentId: null,
        catalogAgents: KERNEL_AGENTS,
        catalogDefaultAgentId: 'kernel-agent',
        isSessionContextDrawerOpen: true,
        shouldLoadAgentCatalog: true,
        isAgentCatalogFetched: true,
        isAgentCatalogFetching: false,
      }),
      {
        visibleAgents: KERNEL_AGENTS,
        defaultAgentId: 'kernel-agent',
        effectiveAgentId: 'kernel-agent',
        hasResolvedVisibleAgents: true,
        isAgentSelectorLoading: false,
        defaultDescriptionKey: 'chat.page.defaultAgentKernelDescription',
      },
    );
  },
);

await runTest(
  'resolveChatAgentCatalogState keeps shared-catalog agents and loading semantics isolated from kernel catalogs',
  () => {
    assert.deepEqual(
      resolveChatAgentCatalogState({
        activeInstanceId: 'instance-hermes',
        isChatSupported: true,
        agentCatalogMode: 'sharedCatalog',
        selectedAgentId: 'direct-agent',
        catalogAgents: DIRECT_AGENTS,
        catalogDefaultAgentId: null,
        isSessionContextDrawerOpen: true,
        shouldLoadAgentCatalog: true,
        isAgentCatalogFetched: false,
        isAgentCatalogFetching: true,
      }),
      {
        visibleAgents: DIRECT_AGENTS,
        defaultAgentId: null,
        effectiveAgentId: 'direct-agent',
        hasResolvedVisibleAgents: false,
        isAgentSelectorLoading: false,
        defaultDescriptionKey: 'chat.page.defaultAgentDirectDescription',
      },
    );
  },
);

await runTest(
  'resolveChatAgentCatalogState stops exposing agent choices for unsupported chat routes',
  () => {
    assert.deepEqual(
      resolveChatAgentCatalogState({
        activeInstanceId: 'instance-blocked',
        isChatSupported: false,
        agentCatalogMode: 'kernelCatalog',
        selectedAgentId: 'kernel-agent',
        catalogAgents: KERNEL_AGENTS,
        catalogDefaultAgentId: 'kernel-agent',
        isSessionContextDrawerOpen: true,
        shouldLoadAgentCatalog: false,
        isAgentCatalogFetched: false,
        isAgentCatalogFetching: false,
      }),
      {
        visibleAgents: [],
        defaultAgentId: null,
        effectiveAgentId: null,
        hasResolvedVisibleAgents: true,
        isAgentSelectorLoading: false,
        defaultDescriptionKey: 'chat.page.defaultAgentDirectDescription',
      },
    );
  },
);
