import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { resolveChatWorkspaceProjection } from '../services/chatWorkspaceProjection.ts';

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

const workspaceStateHookSource = readFileSync(
  new URL('./useChatPageWorkspaceState.ts', import.meta.url),
  'utf8',
);
const sessionViewHookSource = readFileSync(
  new URL('./useChatSessionViewState.ts', import.meta.url),
  'utf8',
);
const activeSessionProjectionHookSource = readFileSync(
  new URL('./useChatActiveSessionProjectionState.ts', import.meta.url),
  'utf8',
);

await runTest(
  'resolveChatWorkspaceProjection marks a selected-agent blank workspace as explicit when no session is active',
  () => {
    assert.equal(
      resolveChatWorkspaceProjection({
        sessions: [{ id: 'session-research-1', agentId: 'research' }],
        activeSessionId: null,
        isChatSupported: true,
        sessionScopeMode: 'all',
        sessionScopeAgentId: null,
        selectedAgentId: 'research',
      }).isExplicitBlankWorkspace,
      true,
    );
  },
);

await runTest(
  'chat active session projection threads the selected agent into workspace projection so blank-agent workspaces remain explicit',
  () => {
    assert.match(
      workspaceStateHookSource,
      /const\s*\{\s*selectedAgentId,\s*selectedSkillId\s*\}\s*=\s*selection;/,
    );
    assert.match(
      workspaceStateHookSource,
      /useChatSessionViewState\(\{\s*sessions,\s*activeInstanceId,\s*activeSessionId,\s*isChatSupportedRoute,\s*sessionScopeMode,\s*effectiveGatewayAgentId,\s*selectedAgentId,\s*routeMode,\s*activeAdapterCapabilities,\s*sendMode,\s*\}\)/s,
    );
    assert.match(
      sessionViewHookSource,
      /export interface UseChatSessionViewStateInput \{[\s\S]*selectedAgentId: string \| null \| undefined;[\s\S]*\}/s,
    );
    assert.match(
      sessionViewHookSource,
      /useChatActiveSessionProjectionState\(\{\s*sessions,\s*activeInstanceId,\s*activeSessionId,\s*isChatSupportedRoute,\s*sessionScopeMode,\s*effectiveGatewayAgentId,\s*selectedAgentId,\s*routeMode,\s*activeAdapterCapabilities,\s*sendMode,\s*\}\)/s,
    );
    assert.match(
      activeSessionProjectionHookSource,
      /export interface UseChatActiveSessionProjectionStateInput \{[\s\S]*selectedAgentId: string \| null \| undefined;[\s\S]*\}/s,
    );
    assert.match(
      activeSessionProjectionHookSource,
      /resolveChatWorkspaceProjection\(\{\s*sessions: instanceSessions,\s*activeSessionId,\s*isChatSupported: isChatSupportedRoute,\s*sessionScopeMode,\s*sessionScopeAgentId: effectiveGatewayAgentId,\s*selectedAgentId,\s*\}\)/s,
    );
    assert.match(
      activeSessionProjectionHookSource,
      /const displaySessionAgentId = workspaceProjection\.displaySessionAgentId;/,
    );
  },
);
