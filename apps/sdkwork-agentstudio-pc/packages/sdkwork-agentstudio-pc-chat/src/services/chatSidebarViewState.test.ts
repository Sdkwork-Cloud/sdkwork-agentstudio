import assert from 'node:assert/strict';
import { resolveChatSidebarViewState } from './chatSidebarViewState.ts';

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

const NOW = Date.UTC(2026, 3, 26, 12, 0, 0);
const agentOptions = [
  {
    id: 'research',
    name: 'Research Agent',
    avatarLabel: 'RE',
    kernelLabel: 'OpenClaw',
  },
  {
    id: 'ops',
    name: 'Ops Agent',
    avatarLabel: 'OP',
    kernelLabel: 'OpenClaw',
  },
];
const sessions = [
  {
    id: 'agent:research:main',
    updatedAt: NOW - 30 * 60_000,
    lastSeenAt: NOW - 30 * 60_000,
    kernelSession: {
      ref: {
        agentId: 'research',
        sessionId: 'agent:research:main',
      },
      lifecycle: 'ready',
    },
    messages: [
      {
        role: 'user',
        content: 'Research main thread',
        timestamp: NOW - 30 * 60_000,
      },
    ],
  },
  {
    id: 'agent:ops:main',
    updatedAt: NOW - 40 * 60_000,
    lastSeenAt: NOW - 40 * 60_000,
    kernelSession: {
      ref: {
        agentId: 'ops',
        sessionId: 'agent:ops:main',
      },
      lifecycle: 'ready',
    },
    messages: [
      {
        role: 'user',
        content: 'Ops main thread',
        timestamp: NOW - 40 * 60_000,
      },
    ],
  },
  {
    id: 'thread:ops:latest',
    updatedAt: NOW - 5 * 60_000,
    lastSeenAt: NOW - 5 * 60_000,
    agentId: 'ops',
    messages: [
      {
        role: 'user',
        content: 'Latest ops thread',
        timestamp: NOW - 5 * 60_000,
      },
    ],
  },
] as const;

function resolveAllSessionIds(params: {
  activeSessionId: string;
  selectedAgentId: string;
  sessionScopeAgentId: string;
}) {
  const presentation = resolveChatSidebarViewState({
    sessions: [...sessions],
    activeSessionId: params.activeSessionId,
    activeInstanceId: null,
    isChatSupported: true,
    sessionScopeMode: 'agentBound',
    sessionScopeAgentId: params.sessionScopeAgentId,
    selectedAgentId: params.selectedAgentId,
    primaryAgentId: null,
    agentOptions,
    historyViewMode: 'allSessions',
    fallbackMainAgentName: 'Main Agent',
    previewLabels: {
      you: 'You',
      system: 'System',
      tool: 'Tool',
      attachment: 'Attachment',
      attachments: 'Attachments',
    },
    relativeTimeLabels: {
      yesterday: 'Yesterday',
      daysAgo: (count) => `${count} days ago`,
    },
    locale: 'en-US',
    timeZone: 'UTC',
  });

  return presentation.activeSidebarHistory.sections.flatMap((section) =>
    section.items.map((item) => ({
      sessionId: item.sessionId,
      pinOrigin: item.pinOrigin,
      isSelected: item.isSelected,
    })),
  );
}

await runTest(
  'resolveChatSidebarViewState keeps the all-sessions tab order stable when selecting sessions from different agents',
  () => {
    const beforeSelection = resolveAllSessionIds({
      activeSessionId: 'agent:research:main',
      selectedAgentId: 'research',
      sessionScopeAgentId: 'research',
    });
    const afterSelectingOpsSession = resolveAllSessionIds({
      activeSessionId: 'thread:ops:latest',
      selectedAgentId: 'ops',
      sessionScopeAgentId: 'ops',
    });

    assert.deepEqual(
      beforeSelection.map((item) => item.sessionId),
      [
        'thread:ops:latest',
        'agent:research:main',
        'agent:ops:main',
      ],
    );
    assert.deepEqual(
      afterSelectingOpsSession.map((item) => item.sessionId),
      [
        'thread:ops:latest',
        'agent:research:main',
        'agent:ops:main',
      ],
    );
    assert.deepEqual(
      beforeSelection.map((item) => item.pinOrigin),
      ['none', 'none', 'none'],
    );
    assert.deepEqual(
      afterSelectingOpsSession.map((item) => item.pinOrigin),
      ['none', 'none', 'none'],
    );
    assert.deepEqual(
      afterSelectingOpsSession.map((item) => item.isSelected),
      [true, false, false],
    );
  },
);
