import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { resolveChatSidebarAgentRailPresentation } from './chatSidebarAgentRailPresentation.ts';

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

await runTest(
  'resolveChatSidebarAgentRailPresentation builds rail items with stable session counts and selection state',
  () => {
    const presentation = resolveChatSidebarAgentRailPresentation({
      agentOptions: [
        {
          id: null,
          name: 'Main Agent',
          avatarLabel: null,
        },
        {
          id: 'research',
          name: 'Research Agent',
          avatarLabel: 'RE',
        },
        {
          id: 'ops',
          name: 'Ops Agent',
          avatarLabel: 'OP',
        },
      ],
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
      primaryAgentId: null,
    });

    assert.equal(presentation.selectedAgentId, 'research');
    assert.deepEqual(
      presentation.items.map((item) => ({
        id: item.id,
        name: item.name,
        avatarLabel: item.avatarLabel,
        isSelected: item.isSelected,
        isPrimary: item.isPrimary,
        sessionCount: item.sessionCount,
      })),
      [
        {
          id: 'research',
          name: 'Research Agent',
          avatarLabel: 'RE',
          isSelected: true,
          isPrimary: false,
          sessionCount: 2,
        },
        {
          id: 'ops',
          name: 'Ops Agent',
          avatarLabel: 'OP',
          isSelected: false,
          isPrimary: false,
          sessionCount: 1,
        },
        {
          id: null,
          name: 'Main Agent',
          avatarLabel: null,
          isSelected: false,
          isPrimary: true,
          sessionCount: 1,
        },
      ],
    );
  },
);

await runTest(
  'resolveChatSidebarAgentRailPresentation keeps agent rail items identity-only without chat preview metadata',
  () => {
    const presentation = resolveChatSidebarAgentRailPresentation({
      agentOptions: [
        {
          id: 'research',
          name: 'Research Agent',
          avatarLabel: 'RE',
        },
        {
          id: 'ops',
          name: 'Ops Agent',
          avatarLabel: 'OP',
        },
        {
          id: 'planner',
          name: 'Planner Agent',
          avatarLabel: 'PL',
        },
      ],
      sessions: [
        {
          id: 'session-research-thread',
          title: 'Research rollout',
          updatedAt: Date.UTC(2026, 3, 3, 10, 58, 0),
          lastMessagePreview: 'Drafting the final parity report',
          agentId: 'research',
          messages: [
            {
              role: 'assistant',
              content: 'Drafting the final parity report',
              timestamp: Date.UTC(2026, 3, 3, 10, 58, 0),
            },
          ],
        },
        {
          id: 'session-ops-thread',
          title: 'Ops incident review',
          updatedAt: Date.UTC(2026, 3, 2, 10, 0, 0),
          lastMessagePreview: 'Ops incident review',
          agentId: 'ops',
          messages: [
            {
              role: 'assistant',
              content: 'Ops incident review',
              timestamp: Date.UTC(2026, 3, 2, 10, 0, 0),
            },
          ],
        },
      ],
      activeSessionId: 'session-research-thread',
      isChatSupported: true,
      sessionScopeMode: 'all',
      selectedAgentId: 'research',
      primaryAgentId: null,
    });

    assert.deepEqual(
      presentation.items.map((item) => ({
        id: item.id,
        name: item.name,
        sessionCount: item.sessionCount,
        hasPreview: Object.prototype.hasOwnProperty.call(item, 'preview'),
        hasRelativeTimeLabel: Object.prototype.hasOwnProperty.call(item, 'relativeTimeLabel'),
      })),
      [
        {
          id: 'research',
          name: 'Research Agent',
          sessionCount: 1,
          hasPreview: false,
          hasRelativeTimeLabel: false,
        },
        {
          id: 'ops',
          name: 'Ops Agent',
          sessionCount: 1,
          hasPreview: false,
          hasRelativeTimeLabel: false,
        },
        {
          id: 'planner',
          name: 'Planner Agent',
          sessionCount: 0,
          hasPreview: false,
          hasRelativeTimeLabel: false,
        },
      ],
    );
  },
);

await runTest(
  'resolveChatSidebarAgentRailPresentation never exposes opaque agent names or date labels in agent items',
  () => {
    const presentation = resolveChatSidebarAgentRailPresentation({
      agentOptions: [
        {
          id: 'agent:20260426105830:main',
          name: '2026-04-26 10:58',
          avatarLabel: '20',
          kernelId: 'openclaw',
          kernelLabel: 'OpenClaw',
        },
        {
          id: 'thread:claw-studio:20260426105830',
          name: 'thread:claw-studio:20260426105830',
          avatarLabel: 'TH',
        },
      ],
      sessions: [
        {
          id: 'agent:20260426105830:main',
          updatedAt: 200,
          kernelSession: {
            ref: {
              agentId: 'agent:20260426105830:main',
              kernelId: 'openclaw',
            },
          },
        },
        {
          id: 'thread:claw-studio:20260426105830',
          updatedAt: 100,
          agentId: 'thread:claw-studio:20260426105830',
        },
      ],
      activeSessionId: null,
      isChatSupported: true,
      sessionScopeMode: 'all',
      selectedAgentId: null,
      primaryAgentId: null,
    });

    assert.deepEqual(
      presentation.items.map((item) => ({
        id: item.id,
        name: item.name,
        avatarLabel: item.avatarLabel,
      })),
      [
        {
          id: 'agent:20260426105830:main',
          name: 'OpenClaw Agent',
          avatarLabel: 'OP',
        },
        {
          id: 'thread:claw-studio:20260426105830',
          name: 'Agent',
          avatarLabel: 'AG',
        },
      ],
    );
  },
);

await runTest(
  'resolveChatSidebarAgentRailPresentation pushes idle agents behind more recently active agents while keeping primary metadata',
  () => {
    const presentation = resolveChatSidebarAgentRailPresentation({
      agentOptions: [
        {
          id: 'research',
          name: 'Research Agent',
          avatarLabel: 'RE',
        },
        {
          id: 'ops',
          name: 'Ops Agent',
          avatarLabel: 'OP',
        },
        {
          id: 'planner',
          name: 'Planner Agent',
          avatarLabel: 'PL',
        },
      ],
      sessions: [
        { id: 'session-ops-thread', updatedAt: 320, agentId: 'ops' },
        { id: 'session-research-thread', updatedAt: 180, agentId: 'research' },
      ],
      activeSessionId: 'session-ops-thread',
      isChatSupported: true,
      sessionScopeMode: 'all',
      selectedAgentId: 'ops',
      primaryAgentId: 'research',
    });

    assert.deepEqual(
      presentation.items.map((item) => ({
        id: item.id,
        isPrimary: item.isPrimary,
        sessionCount: item.sessionCount,
      })),
      [
        {
          id: 'ops',
          isPrimary: false,
          sessionCount: 1,
        },
        {
          id: 'research',
          isPrimary: true,
          sessionCount: 1,
        },
        {
          id: 'planner',
          isPrimary: false,
          sessionCount: 0,
        },
      ],
    );
  },
);

await runTest(
  'resolveChatSidebarAgentRailPresentation keeps gateway agent-bound session counts on the current agent rail item',
  () => {
    const presentation = resolveChatSidebarAgentRailPresentation({
      agentOptions: [
        {
          id: 'research',
          name: 'Research Agent',
          avatarLabel: 'RE',
        },
        {
          id: 'ops',
          name: 'Ops Agent',
          avatarLabel: 'OP',
        },
      ],
      sessions: [
        { id: 'agent:research:main', updatedAt: 200 },
        { id: 'agent:research:main:thread:claw-studio:1', updatedAt: 190 },
        { id: 'agent:ops:main', updatedAt: 180 },
      ],
      activeSessionId: 'agent:ops:main',
      isChatSupported: true,
      sessionScopeMode: 'agentBound',
      selectedAgentId: 'research',
      primaryAgentId: 'research',
    });

    assert.equal(
      presentation.items.find((item) => item.id === 'research')?.sessionCount,
      2,
    );
    assert.equal(
      presentation.items.find((item) => item.id === 'research')?.isPrimary,
      true,
    );
  },
);

await runTest(
  'resolveChatSidebarAgentRailPresentation exposes kernel labels and merges semantic main activity into one rail item',
  () => {
    const presentation = resolveChatSidebarAgentRailPresentation({
      agentOptions: [
        {
          id: null,
          name: 'Main Agent',
          avatarLabel: 'MA',
          kernelId: 'openclaw',
          kernelLabel: 'OpenClaw',
          matchAgentIds: ['main'],
        },
        {
          id: 'research',
          name: 'Research Agent',
          avatarLabel: 'RE',
          kernelId: 'hermes',
          kernelLabel: 'Hermes',
        },
      ],
      sessions: [
        { id: 'session-main', updatedAt: 100, agentId: null },
        {
          id: 'agent:main:main',
          updatedAt: 240,
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

    assert.deepEqual(
      presentation.items.map((item) => ({
        id: item.id,
        name: item.name,
        avatarLabel: item.avatarLabel,
        kernelId: item.kernelId,
        kernelLabel: item.kernelLabel,
        isSelected: item.isSelected,
        isPrimary: item.isPrimary,
        sessionCount: item.sessionCount,
      })),
      [
        {
          id: null,
          name: 'Main Agent',
          avatarLabel: 'MA',
          kernelId: 'openclaw',
          kernelLabel: 'OpenClaw',
          isSelected: true,
          isPrimary: true,
          sessionCount: 2,
        },
        {
          id: 'research',
          name: 'Research Agent',
          avatarLabel: 'RE',
          kernelId: 'hermes',
          kernelLabel: 'Hermes',
          isSelected: false,
          isPrimary: false,
          sessionCount: 1,
        },
      ],
    );
  },
);

await runTest(
  'chatSidebarAgentRailPresentation composes agent session scope helpers instead of duplicating agent-scoping logic',
  () => {
    const source = readFileSync(
      new URL('./chatSidebarAgentRailPresentation.ts', import.meta.url),
      'utf8',
    );

    assert.match(
      source,
      /import \{[\s\S]*sortChatSidebarAgentOptionsByActivity,[\s\S]*resolveChatSessionsForAgent,[\s\S]*type ChatAgentSessionLike,[\s\S]*\} from '\.\/chatAgentSessionWorkspace\.ts';/s,
    );
    assert.doesNotMatch(source, /resolveChatSessionViewState/);
    assert.doesNotMatch(source, /function listSessionsForAgent/);
    assert.doesNotMatch(source, /function resolveAgentTargetSessionId/);
  },
);
