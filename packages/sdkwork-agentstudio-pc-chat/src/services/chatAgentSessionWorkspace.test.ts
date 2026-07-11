import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import type { ChatContextOption } from '../pages/chatContextOptions.ts';
import { resolveChatAgentSessionWorkspace } from './chatAgentSessionWorkspace.ts';

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

const AGENT_OPTIONS: ChatContextOption[] = [
  {
    id: null,
    name: 'Main Agent',
    description: 'Default direct conversation',
    avatarLabel: null,
  },
  {
    id: 'research',
    name: 'Research Agent',
    description: 'Research specialist',
    avatarLabel: 'RE',
  },
  {
    id: 'ops',
    name: 'Ops Agent',
    description: 'Operations specialist',
    avatarLabel: 'OP',
  },
];

await runTest(
  'resolveChatAgentSessionWorkspace groups direct sessions under their bound agent and falls back to the agent main session when the active session is outside the selected agent',
  () => {
    const result = resolveChatAgentSessionWorkspace({
      agentOptions: AGENT_OPTIONS,
      sessions: [
        { id: 'session-main', updatedAt: 100, agentId: null },
        {
          id: 'session-research-main',
          updatedAt: 220,
          agentId: 'research',
          kernelSession: {
            ref: {
              agentId: 'research',
            },
          },
        },
        { id: 'session-research-thread', updatedAt: 200, agentId: 'research' },
        { id: 'session-ops-thread', updatedAt: 180, agentId: 'ops' },
      ],
      activeSessionId: 'session-ops-thread',
      isChatSupported: true,
      sessionScopeMode: 'all',
      selectedAgentId: 'research',
    });

    assert.equal(result.selectedAgentId, 'research');
    assert.equal(result.effectiveActiveSessionId, 'session-research-main');
    assert.deepEqual(
      result.visibleSessions.map((session) => session.id),
      ['session-research-main', 'session-research-thread'],
    );
    assert.equal('agentItems' in result, false);
  },
);

await runTest(
  'resolveChatAgentSessionWorkspace keeps gateway agent-bound visibility aligned with the selected agent and prefers the current agent main session',
  () => {
    const result = resolveChatAgentSessionWorkspace({
      agentOptions: AGENT_OPTIONS,
      sessions: [
        { id: 'agent:research:main', updatedAt: 200 },
        { id: 'agent:research:main:thread:agent-studio:1', updatedAt: 190 },
        { id: 'agent:ops:main', updatedAt: 180 },
      ],
      activeSessionId: 'agent:ops:main',
      isChatSupported: true,
      sessionScopeMode: 'agentBound',
      selectedAgentId: 'research',
    });

    assert.equal(result.selectedAgentId, 'research');
    assert.equal(result.effectiveActiveSessionId, 'agent:research:main');
    assert.deepEqual(
      result.visibleSessions.map((session) => session.id),
      ['agent:research:main', 'agent:research:main:thread:agent-studio:1'],
    );
    assert.equal('agentItems' in result, false);
  },
);

await runTest(
  'resolveChatAgentSessionWorkspace defaults to the main agent draft workspace when no explicit agent selection or active session binding exists',
  () => {
    const result = resolveChatAgentSessionWorkspace({
      agentOptions: AGENT_OPTIONS,
      sessions: [
        { id: 'session-main', updatedAt: 100, agentId: null },
        { id: 'session-research-thread', updatedAt: 320, agentId: 'research' },
        { id: 'session-ops-thread', updatedAt: 180, agentId: 'ops' },
      ],
      activeSessionId: null,
      isChatSupported: true,
      sessionScopeMode: 'all',
      selectedAgentId: undefined,
      primaryAgentId: null,
    });

    assert.equal(result.selectedAgentId, null);
    assert.equal(result.effectiveActiveSessionId, null);
    assert.deepEqual(
      result.visibleSessions.map((session) => session.id),
      ['session-main'],
    );
  },
);

await runTest(
  'resolveChatAgentSessionWorkspace keeps the selected direct agent in draft mode when no session is active',
  () => {
    const result = resolveChatAgentSessionWorkspace({
      agentOptions: AGENT_OPTIONS,
      sessions: [
        { id: 'session-main', updatedAt: 100, agentId: null },
        {
          id: 'session-research-main',
          updatedAt: 320,
          agentId: 'research',
          kernelSession: {
            ref: {
              agentId: 'research',
            },
          },
        },
        { id: 'session-research-thread', updatedAt: 280, agentId: 'research' },
        { id: 'session-ops-thread', updatedAt: 180, agentId: 'ops' },
      ],
      activeSessionId: null,
      isChatSupported: true,
      sessionScopeMode: 'all',
      selectedAgentId: 'research',
      primaryAgentId: null,
    });

    assert.equal(result.selectedAgentId, 'research');
    assert.equal(result.effectiveActiveSessionId, null);
    assert.deepEqual(
      result.visibleSessions.map((session) => session.id),
      ['session-research-main', 'session-research-thread'],
    );
  },
);

await runTest(
  'resolveChatAgentSessionWorkspace keeps the main agent selected in draft mode when the user explicitly selects it without an active session binding',
  () => {
    const result = resolveChatAgentSessionWorkspace({
      agentOptions: AGENT_OPTIONS,
      sessions: [
        { id: 'session-main', updatedAt: 100, agentId: null },
        { id: 'session-research-thread', updatedAt: 320, agentId: 'research' },
        { id: 'session-ops-thread', updatedAt: 180, agentId: 'ops' },
      ],
      activeSessionId: null,
      isChatSupported: true,
      sessionScopeMode: 'all',
      selectedAgentId: null,
      primaryAgentId: null,
    });

    assert.equal(result.selectedAgentId, null);
    assert.equal(result.effectiveActiveSessionId, null);
    assert.deepEqual(
      result.visibleSessions.map((session) => session.id),
      ['session-main'],
    );
  },
);

await runTest(
  'resolveChatAgentSessionWorkspace merges null-bound and explicit main-agent sessions under the semantic main selection',
  () => {
    const result = resolveChatAgentSessionWorkspace({
      agentOptions: [
        {
          id: null,
          name: '主 Agent',
          description: 'Localized main agent',
          avatarLabel: 'MA',
          matchAgentIds: ['main'],
        },
        {
          id: 'research',
          name: 'Research Agent',
          description: 'Research specialist',
          avatarLabel: 'RE',
        },
      ],
      sessions: [
        { id: 'session-main', updatedAt: 100, agentId: null },
        {
          id: 'agent:main:main',
          updatedAt: 220,
          kernelSession: {
            ref: {
              agentId: 'main',
            },
          },
        },
        { id: 'session-research-thread', updatedAt: 180, agentId: 'research' },
      ],
      activeSessionId: null,
      isChatSupported: true,
      sessionScopeMode: 'all',
      selectedAgentId: null,
      primaryAgentId: null,
    });

    assert.equal(result.selectedAgentId, null);
    assert.equal(result.effectiveActiveSessionId, null);
    assert.deepEqual(
      result.visibleSessions.map((session) => session.id),
      ['session-main', 'agent:main:main'],
    );
  },
);

await runTest(
  'resolveChatAgentSessionWorkspace keeps a selected gateway agent in draft mode until the user chooses a concrete session',
  () => {
    const result = resolveChatAgentSessionWorkspace({
      agentOptions: AGENT_OPTIONS,
      sessions: [
        { id: 'agent:research:main', updatedAt: 200 },
        { id: 'agent:research:main:thread:agent-studio:1', updatedAt: 190 },
        { id: 'agent:ops:main', updatedAt: 180 },
      ],
      activeSessionId: null,
      isChatSupported: true,
      sessionScopeMode: 'agentBound',
      selectedAgentId: 'research',
      primaryAgentId: null,
    });

    assert.equal(result.selectedAgentId, 'research');
    assert.equal(result.effectiveActiveSessionId, null);
    assert.deepEqual(
      result.visibleSessions.map((session) => session.id),
      ['agent:research:main', 'agent:research:main:thread:agent-studio:1'],
    );
  },
);

await runTest(
  'chatAgentSessionWorkspace focuses on session scope selection while exposing reusable agent scoping helpers',
  () => {
    const source = readFileSync(new URL('./chatAgentSessionWorkspace.ts', import.meta.url), 'utf8');
    assert.match(
      source,
      /import \{ resolveChatSessionBinding, type ChatSessionBindingSource \} from '\.\/chatSessionBinding\.ts';/,
    );
    assert.match(
      source,
      /import \{[\s\S]*resolveChatSessionAgentId,[\s\S]*type ChatSidebarAgentOption,[\s\S]*\} from '\.\/chatSessionOwnerPresentation\.ts';/s,
    );
    assert.match(source, /export type ChatAgentSessionLike = ChatSessionBindingSource & \{/);
    assert.match(source, /export function resolveChatSessionsForAgent</);
    assert.match(source, /export function resolveChatAgentTargetSessionId</);
    assert.doesNotMatch(source, /export interface ChatAgentSessionWorkspaceItem \{/);
    assert.doesNotMatch(source, /agentItems:/);
    assert.doesNotMatch(source, /agentId\?: string \| null;/);
    assert.doesNotMatch(source, /actorBinding\?: \{/);
    assert.doesNotMatch(source, /ref\?: \{/);
  },
);
