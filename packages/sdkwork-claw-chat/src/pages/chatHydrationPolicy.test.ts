import assert from 'node:assert/strict';
import {
  shouldLoadChatDirectAgents,
  shouldLoadChatSkills,
} from './chatHydrationPolicy.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('shouldLoadChatSkills only hydrates the skill catalog when the selector is in play', () => {
  assert.equal(
    shouldLoadChatSkills({
      isRouteSupported: true,
      isSessionContextDrawerOpen: false,
      selectedSkillId: null,
    }),
    false,
  );

  assert.equal(
    shouldLoadChatSkills({
      isRouteSupported: true,
      isSessionContextDrawerOpen: true,
      selectedSkillId: null,
    }),
    true,
  );

  assert.equal(
    shouldLoadChatSkills({
      isRouteSupported: true,
      isSessionContextDrawerOpen: false,
      selectedSkillId: 'skill-1',
    }),
    true,
  );
});

await runTest('shouldLoadChatSkills skips the skill catalog for unsupported chat routes', () => {
  assert.equal(
    shouldLoadChatSkills({
      isRouteSupported: false,
      isSessionContextDrawerOpen: true,
      selectedSkillId: 'skill-1',
    }),
    false,
  );
});

await runTest('shouldLoadChatDirectAgents skips the direct-agent catalog for openclaw gateway sessions', () => {
  assert.equal(
    shouldLoadChatDirectAgents({
      activeInstanceId: 'instance-1',
      isRouteSupported: true,
      agentCatalogMode: 'kernelCatalog',
      isSessionContextDrawerOpen: true,
      selectedAgentId: 'agent-1',
    }),
    false,
  );
});

await runTest('shouldLoadChatDirectAgents always hydrates direct agents for active shared-catalog chats so the agent rail can render immediately', () => {
  assert.equal(
    shouldLoadChatDirectAgents({
      activeInstanceId: null,
      isRouteSupported: true,
      agentCatalogMode: 'sharedCatalog',
      isSessionContextDrawerOpen: true,
      selectedAgentId: null,
    }),
      false,
  );

  assert.equal(
    shouldLoadChatDirectAgents({
      activeInstanceId: 'instance-1',
      isRouteSupported: true,
      agentCatalogMode: 'sharedCatalog',
      isSessionContextDrawerOpen: false,
      selectedAgentId: null,
    }),
    true,
  );

  assert.equal(
    shouldLoadChatDirectAgents({
      activeInstanceId: 'instance-1',
      isRouteSupported: true,
      agentCatalogMode: 'sharedCatalog',
      isSessionContextDrawerOpen: true,
      selectedAgentId: null,
    }),
    true,
  );

  assert.equal(
    shouldLoadChatDirectAgents({
      activeInstanceId: 'instance-1',
      isRouteSupported: true,
      agentCatalogMode: 'sharedCatalog',
      isSessionContextDrawerOpen: false,
      selectedAgentId: 'agent-1',
    }),
    true,
  );
});

await runTest('shouldLoadChatDirectAgents skips direct agents for unsupported chat routes', () => {
  assert.equal(
    shouldLoadChatDirectAgents({
      activeInstanceId: 'instance-1',
      isRouteSupported: false,
      agentCatalogMode: 'sharedCatalog',
      isSessionContextDrawerOpen: true,
      selectedAgentId: 'agent-1',
    }),
    false,
  );
});
