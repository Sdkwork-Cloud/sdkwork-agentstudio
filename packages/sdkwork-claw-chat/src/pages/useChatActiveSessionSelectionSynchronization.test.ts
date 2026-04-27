import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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

const pageSynchronizationSource = readFileSync(
  new URL('./useChatPageSynchronizationState.ts', import.meta.url),
  'utf8',
);
const synchronizationHookSource = readFileSync(
  new URL('./useChatActiveSessionSelectionSynchronization.ts', import.meta.url),
  'utf8',
);

await runTest(
  'chat page synchronizes selected agent state from the effective active session through a dedicated hook',
  () => {
    assert.match(
      pageSynchronizationSource,
      /import \{[\s\S]*useChatActiveSessionSelectionSynchronization,[\s\S]*\} from '\.\/useChatActiveSessionSelectionSynchronization';/s,
    );
    assert.match(
      pageSynchronizationSource,
      /const activeSessionSelectionSynchronization: UseChatActiveSessionSelectionSynchronizationInput = \{/,
    );
    assert.match(
      pageSynchronizationSource,
      /const activeSessionSelectionSynchronization: UseChatActiveSessionSelectionSynchronizationInput = \{[\s\S]*isChatSupportedRoute: workspaceState\.runtime\.isChatSupportedRoute,[\s\S]*activeSession: workspaceState\.session\.displaySession,[\s\S]*selectedAgentId: selection\.selectedAgentId,[\s\S]*agentOptionIds: workspaceState\.presentation\.sidebarAgentOptions\.map\(\(agent\) => agent\.id\),[\s\S]*setSelectedAgentId: selection\.setSelectedAgentId,[\s\S]*\};/s,
    );
    assert.match(
      pageSynchronizationSource,
      /useChatActiveSessionSelectionSynchronization\(activeSessionSelectionSynchronization\);/,
    );
    assert.match(
      synchronizationHookSource,
      /import \{[\s\S]*resolveChatActiveSessionSelectionSyncMutation,[\s\S]*resolveChatSessionBinding,[\s\S]*\} from '\.\.\/services';/s,
    );
    assert.match(
      synchronizationHookSource,
      /import type \{ ChatSessionBindingSource \} from '\.\.\/services';/,
    );
    assert.doesNotMatch(synchronizationHookSource, /interface ActiveSessionLike \{/);
    assert.match(
      synchronizationHookSource,
      /const activeSessionBinding = resolveChatSessionBinding\(activeSession\);/,
    );
    assert.match(
      synchronizationHookSource,
      /const activeSessionSelectionSyncMutation =\s*resolveChatActiveSessionSelectionSyncMutation\(\{\s*isChatSupported: isChatSupportedRoute,\s*selectedAgentId,\s*activeSessionBinding,\s*agentOptionIds,\s*\}\);/s,
    );
    assert.match(
      synchronizationHookSource,
      /if \(\s*activeSessionSelectionSyncMutation &&\s*activeSessionSelectionSyncMutation\.nextSelectedAgentId !== selectedAgentId\s*\) \{\s*setSelectedAgentId\(activeSessionSelectionSyncMutation\.nextSelectedAgentId\);\s*\}/s,
    );
  },
);
