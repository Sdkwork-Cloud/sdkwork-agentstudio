import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { resolveChatActiveSessionSelectionSyncMutation } from './chatActiveSessionSelectionPolicy.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest(
  'resolveChatActiveSessionSelectionSyncMutation aligns the selected agent with the effective active session binding',
  () => {
    assert.deepEqual(
      resolveChatActiveSessionSelectionSyncMutation({
        isChatSupported: true,
        selectedAgentId: 'research',
        activeSessionBinding: {
          agentId: 'ops',
        },
        agentOptionIds: [null, 'research', 'ops'],
      }),
      {
        nextSelectedAgentId: 'ops',
      },
    );
  },
);

await runTest(
  'resolveChatActiveSessionSelectionSyncMutation returns to the main agent selection when the active session is unbound',
  () => {
    assert.deepEqual(
      resolveChatActiveSessionSelectionSyncMutation({
        isChatSupported: true,
        selectedAgentId: 'research',
        activeSessionBinding: {
          agentId: null,
        },
        agentOptionIds: [null, 'research', 'ops'],
      }),
      {
        nextSelectedAgentId: null,
      },
    );
  },
);

await runTest(
  'resolveChatActiveSessionSelectionSyncMutation promotes an unset selection to the explicit main agent when the active session is unbound',
  () => {
    assert.deepEqual(
      resolveChatActiveSessionSelectionSyncMutation({
        isChatSupported: true,
        selectedAgentId: undefined,
        activeSessionBinding: {
          agentId: null,
        },
        agentOptionIds: [null, 'research', 'ops'],
      }),
      {
        nextSelectedAgentId: null,
      },
    );
  },
);

await runTest(
  'resolveChatActiveSessionSelectionSyncMutation stays idle when the active session has no visible agent binding',
  () => {
    assert.equal(
      resolveChatActiveSessionSelectionSyncMutation({
        isChatSupported: true,
        selectedAgentId: 'research',
        activeSessionBinding: {
          agentId: 'hidden-agent',
        },
        agentOptionIds: [null, 'research', 'ops'],
      }),
      null,
    );
    assert.equal(
      resolveChatActiveSessionSelectionSyncMutation({
        isChatSupported: true,
        selectedAgentId: null,
        activeSessionBinding: null,
        agentOptionIds: [null, 'research', 'ops'],
      }),
      null,
    );
  },
);

await runTest(
  'resolveChatActiveSessionSelectionSyncMutation keeps a selected active-session agent when the catalog is temporarily incomplete',
  () => {
    assert.equal(
      resolveChatActiveSessionSelectionSyncMutation({
        isChatSupported: true,
        selectedAgentId: 'research',
        activeSessionBinding: {
          sessionId: 'agent:research:main',
          agentId: 'research',
        },
        agentOptionIds: [null, 'ops'],
      }),
      null,
    );
  },
);

await runTest(
  'chatActiveSessionSelectionPolicy reuses the shared session selection binding instead of redefining session identity',
  () => {
    const source = readFileSync(new URL('./chatActiveSessionSelectionPolicy.ts', import.meta.url), 'utf8');
    assert.match(
      source,
      /import type \{ ChatSessionSelectionBinding \} from '\.\/chatSessionBinding\.ts';/,
    );
    assert.doesNotMatch(source, /sessionId\?: string \| null;/);
    assert.doesNotMatch(source, /agentId: string \| null;/);
  },
);
