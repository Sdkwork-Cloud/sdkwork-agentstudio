import assert from 'node:assert/strict';

import type { Agent } from '@sdkwork/claw-types';
import {
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
