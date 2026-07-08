import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildChatSessionPreferencesKey } from '../store/chatSessionPreferencesStore.ts';
import {
  resolveChatSidebarHistoryPresentation,
  type ChatSidebarHistorySectionId,
} from './chatSidebarHistoryPresentation.ts';

const NOW = Date.UTC(2026, 3, 21, 12, 0, 0);
const ZH_RELATIVE_TIME_LABELS = {
  yesterday: '昨天',
  daysAgo: (count: number) => `${count}天前`,
};

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
  'resolveChatSidebarHistoryPresentation keeps pinned sessions inside natural time buckets and sorts them ahead of unpinned sessions by recency',
  () => {
    const presentation = resolveChatSidebarHistoryPresentation({
      sessions: [
        {
          id: 'session-regular',
          updatedAt: NOW - 5 * 60_000,
          lastSeenAt: NOW - 5 * 60_000,
          agentId: 'research',
          messages: [
            {
              role: 'assistant',
              content: 'Regular recent thread',
              timestamp: NOW - 5 * 60_000,
            },
          ],
        },
        {
          id: 'session-favorite',
          updatedAt: NOW - 20 * 60_000,
          lastSeenAt: NOW - 20 * 60_000,
          agentId: 'research',
          messages: [
            {
              role: 'assistant',
              content: 'Favorite thread',
              timestamp: NOW - 20 * 60_000,
            },
          ],
        },
        {
          id: 'session-user-pinned',
          updatedAt: NOW - 40 * 60_000,
          lastSeenAt: NOW - 40 * 60_000,
          agentId: 'ops',
          messages: [
            {
              role: 'assistant',
              content: 'Pinned thread',
              timestamp: NOW - 40 * 60_000,
            },
          ],
        },
        {
          id: 'agent:research:main',
          updatedAt: NOW - 2 * 60_000,
          lastSeenAt: NOW - 2 * 60_000,
          kernelSession: {
            ref: {
              agentId: 'research',
              sessionId: 'agent:research:main',
            },
            lifecycle: 'ready',
          },
          messages: [
            {
              role: 'assistant',
              content: 'Main session thread',
              timestamp: NOW - 2 * 60_000,
            },
          ],
        },
      ],
      selectedSessionId: 'session-user-pinned',
      sessionScopeMode: 'agentBound',
      sessionScopeAgentId: 'research',
      agentOptions: [
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
          kernelLabel: 'Hermes',
        },
      ],
      sessionPreferencesBySessionKey: {
        [buildChatSessionPreferencesKey({
          instanceId: null,
          sessionId: 'session-favorite',
        })]: {
          favoriteAt: NOW - 10 * 60_000,
          pinnedAt: null,
        },
        [buildChatSessionPreferencesKey({
          instanceId: null,
          sessionId: 'session-user-pinned',
        })]: {
          favoriteAt: null,
          pinnedAt: NOW - 30 * 60_000,
        },
      },
      fallbackMainAgentName: 'Main Agent',
      locale: 'zh-CN',
      timeZone: 'UTC',
      relativeTimeLabels: ZH_RELATIVE_TIME_LABELS,
      now: NOW,
    });

    assert.deepEqual(
      presentation.sections.map((section) => ({
        id: section.id,
        sessionIds: section.items.map((item) => item.sessionId),
      })),
      [
        {
          id: 'today' satisfies ChatSidebarHistorySectionId,
          sessionIds: [
            'agent:research:main',
            'session-user-pinned',
            'session-regular',
            'session-favorite',
          ],
        },
      ],
    );
    assert.equal(presentation.sections[0]?.items[0]?.pinOrigin, 'system');
    assert.equal(presentation.sections[0]?.items[1]?.pinOrigin, 'user');
    assert.equal(presentation.sections[0]?.items[3]?.isFavorited, true);
  },
);

await runTest(
  'resolveChatSidebarHistoryPresentation groups visible sessions into recency sections and preserves owner metadata',
  () => {
    const presentation = resolveChatSidebarHistoryPresentation({
      sessions: [
        {
          id: 'session-today',
          updatedAt: NOW - 30 * 60_000,
          lastSeenAt: NOW - 30 * 60_000,
          agentId: 'research',
          messages: [
            {
              role: 'user',
              content: 'Today preview',
              timestamp: NOW - 31 * 60_000,
            },
          ],
        },
        {
          id: 'session-week',
          updatedAt: NOW - 3 * 86_400_000,
          lastSeenAt: NOW - 3 * 86_400_000,
          agentId: null,
          messages: [
            {
              role: 'user',
              content: 'Weekly planning thread',
              timestamp: NOW - 3 * 86_400_000,
            },
          ],
        },
        {
          id: 'session-older',
          updatedAt: NOW - 14 * 86_400_000,
          lastSeenAt: NOW - 14 * 86_400_000,
          kernelSession: {
            ref: {
              agentId: 'ops',
            },
          },
          messages: [
            {
              role: 'assistant',
              content: 'Older preview',
              timestamp: NOW - 14 * 86_400_000,
            },
          ],
        },
      ],
      selectedSessionId: 'session-week',
      sessionScopeMode: 'all',
      sessionScopeAgentId: null,
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
          kernelLabel: 'OpenClaw',
        },
        {
          id: 'ops',
          name: 'Ops Agent',
          avatarLabel: 'OP',
        },
      ],
      sessionPreferencesBySessionKey: {},
      fallbackMainAgentName: 'Main Agent',
      locale: 'zh-CN',
      timeZone: 'UTC',
      relativeTimeLabels: ZH_RELATIVE_TIME_LABELS,
      now: NOW,
    });

    assert.deepEqual(
      presentation.sections.map((section) => ({
        id: section.id,
        sessionIds: section.items.map((item) => item.sessionId),
      })),
      [
        {
          id: 'today' satisfies ChatSidebarHistorySectionId,
          sessionIds: ['session-today'],
        },
        {
          id: 'previous7Days' satisfies ChatSidebarHistorySectionId,
          sessionIds: ['session-week'],
        },
        {
          id: 'older' satisfies ChatSidebarHistorySectionId,
          sessionIds: ['session-older'],
        },
      ],
    );

    assert.deepEqual(presentation.sections[0]?.items[0], {
      sessionId: 'session-today',
      sessionAgentId: 'research',
      displayTitle: 'Today preview',
      preview: null,
      relativeTimeLabel: '11:30',
      ownerName: 'Research Agent',
      ownerAvatarLabel: 'RE',
      ownerKernelLabel: 'OpenClaw',
      isRunning: false,
      isPinned: false,
      pinOrigin: 'none',
      isFavorited: false,
      hasUnread: false,
      showStatusDot: false,
      showDeleteAction: true,
      isSelected: false,
    });

    assert.deepEqual(presentation.sections[1]?.items[0], {
      sessionId: 'session-week',
      sessionAgentId: null,
      displayTitle: 'Weekly planning thread',
      preview: null,
      relativeTimeLabel: '3天前',
      ownerName: 'Main Agent',
      ownerAvatarLabel: null,
      ownerKernelLabel: null,
      isRunning: false,
      isPinned: false,
      pinOrigin: 'none',
      isFavorited: false,
      hasUnread: false,
      showStatusDot: false,
      showDeleteAction: true,
      isSelected: true,
    });
  },
);

await runTest(
  'resolveChatSidebarHistoryPresentation marks gateway main sessions as pinned and keeps assistant preview text',
  () => {
    const presentation = resolveChatSidebarHistoryPresentation({
      sessions: [
        {
          id: 'agent:research:main',
          updatedAt: NOW - 2 * 60_000,
          lastSeenAt: NOW - 2 * 60_000,
          kernelSession: {
            ref: {
              agentId: 'research',
              sessionId: 'agent:research:main',
            },
            lifecycle: 'running',
            activeRunId: 'run-1',
          },
          messages: [
            {
              role: 'user',
              content: 'Research sync',
              timestamp: NOW - 4 * 60_000,
            },
            {
              role: 'assistant',
              content: 'Streaming kernel reply',
              timestamp: NOW - 2 * 60_000,
            },
          ],
        },
      ],
      selectedSessionId: 'agent:research:main',
      sessionScopeMode: 'agentBound',
      sessionScopeAgentId: 'research',
      agentOptions: [
        {
          id: 'research',
          name: 'Research Agent',
          avatarLabel: 'RE',
          kernelLabel: 'OpenClaw',
        },
      ],
      sessionPreferencesBySessionKey: {},
      fallbackMainAgentName: 'Main Agent',
      locale: 'zh-CN',
      timeZone: 'UTC',
      relativeTimeLabels: ZH_RELATIVE_TIME_LABELS,
      now: NOW,
    });

    assert.deepEqual(presentation.sections[0]?.items[0], {
      sessionId: 'agent:research:main',
      sessionAgentId: 'research',
      displayTitle: 'Research sync',
      preview: 'Streaming kernel reply',
      relativeTimeLabel: '11:58',
      ownerName: 'Research Agent',
      ownerAvatarLabel: 'RE',
      ownerKernelLabel: 'OpenClaw',
      isRunning: true,
      isPinned: true,
      pinOrigin: 'system',
      isFavorited: false,
      hasUnread: false,
      showStatusDot: true,
      showDeleteAction: false,
      isSelected: true,
    });
  },
);

await runTest(
  'resolveChatSidebarHistoryPresentation derives unread state from session activity timestamps',
  () => {
    const presentation = resolveChatSidebarHistoryPresentation({
      sessions: [
        {
          id: 'session-unread',
          updatedAt: NOW - 5 * 60_000,
          lastSeenAt: NOW - 60 * 60_000,
          agentId: 'research',
          messages: [
            {
              role: 'assistant',
              content: 'Unread update',
              timestamp: NOW - 5 * 60_000,
            },
          ],
        },
        {
          id: 'session-seen',
          updatedAt: NOW - 8 * 60_000,
          lastSeenAt: NOW - 8 * 60_000,
          agentId: 'ops',
          messages: [
            {
              role: 'assistant',
              content: 'Seen update',
              timestamp: NOW - 8 * 60_000,
            },
          ],
        },
      ],
      selectedSessionId: null,
      sessionScopeMode: 'all',
      sessionScopeAgentId: null,
      agentOptions: [
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
          kernelLabel: 'Hermes',
        },
      ],
      sessionPreferencesBySessionKey: {},
      fallbackMainAgentName: 'Main Agent',
      locale: 'zh-CN',
      timeZone: 'UTC',
      relativeTimeLabels: ZH_RELATIVE_TIME_LABELS,
      now: NOW,
    });

    assert.equal(presentation.sections[0]?.items[0]?.sessionId, 'session-unread');
    assert.equal(presentation.sections[0]?.items[0]?.hasUnread, true);
    assert.equal(presentation.sections[0]?.items[1]?.sessionId, 'session-seen');
    assert.equal(presentation.sections[0]?.items[1]?.hasUnread, false);
  },
);

await runTest(
  'resolveChatSidebarHistoryPresentation only marks the current session as selected even when multiple sessions belong to the same agent',
  () => {
    const presentation = resolveChatSidebarHistoryPresentation({
      sessions: [
        {
          id: 'session-research-active',
          updatedAt: NOW - 2 * 60_000,
          lastSeenAt: NOW - 2 * 60_000,
          agentId: 'research',
          messages: [
            {
              role: 'assistant',
              content: 'Active thread',
              timestamp: NOW - 2 * 60_000,
            },
          ],
        },
        {
          id: 'session-research-older',
          updatedAt: NOW - 15 * 60_000,
          lastSeenAt: NOW - 15 * 60_000,
          agentId: 'research',
          messages: [
            {
              role: 'user',
              content: 'Older thread',
              timestamp: NOW - 15 * 60_000,
            },
          ],
        },
      ],
      selectedSessionId: 'session-research-active',
      sessionScopeMode: 'agentBound',
      sessionScopeAgentId: 'research',
      agentOptions: [
        {
          id: 'research',
          name: 'Research Agent',
          avatarLabel: 'RE',
          kernelLabel: 'OpenClaw',
        },
      ],
      sessionPreferencesBySessionKey: {},
      fallbackMainAgentName: 'Main Agent',
      locale: 'zh-CN',
      timeZone: 'UTC',
      relativeTimeLabels: ZH_RELATIVE_TIME_LABELS,
      now: NOW,
    });

    assert.deepEqual(
      presentation.sections[0]?.items.map((item) => ({
        sessionId: item.sessionId,
        isSelected: item.isSelected,
      })),
      [
        {
          sessionId: 'session-research-active',
          isSelected: true,
        },
        {
          sessionId: 'session-research-older',
          isSelected: false,
        },
      ],
    );
  },
);

await runTest(
  'resolveChatSidebarHistoryPresentation sorts sessions inside each recency section by most recent activity first',
  () => {
    const presentation = resolveChatSidebarHistoryPresentation({
      sessions: [
        {
          id: 'session-earlier-today',
          updatedAt: NOW - 40 * 60_000,
          agentId: 'research',
          messages: [
            {
              role: 'user',
              content: 'Earlier today',
              timestamp: NOW - 41 * 60_000,
            },
          ],
        },
        {
          id: 'session-latest-today',
          updatedAt: NOW - 5 * 60_000,
          agentId: 'ops',
          messages: [
            {
              role: 'assistant',
              content: 'Latest today',
              timestamp: NOW - 5 * 60_000,
            },
          ],
        },
        {
          id: 'session-week-earlier',
          updatedAt: NOW - 5 * 86_400_000,
          agentId: null,
          messages: [
            {
              role: 'user',
              content: 'Earlier this week',
              timestamp: NOW - 5 * 86_400_000,
            },
          ],
        },
        {
          id: 'session-week-latest',
          updatedAt: NOW - 2 * 86_400_000,
          agentId: null,
          messages: [
            {
              role: 'user',
              content: 'Latest this week',
              timestamp: NOW - 2 * 86_400_000,
            },
          ],
        },
      ],
      selectedSessionId: null,
      sessionScopeMode: 'all',
      sessionScopeAgentId: null,
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
      sessionPreferencesBySessionKey: {},
      fallbackMainAgentName: 'Main Agent',
      locale: 'zh-CN',
      timeZone: 'UTC',
      relativeTimeLabels: ZH_RELATIVE_TIME_LABELS,
      now: NOW,
    });

    assert.deepEqual(
      presentation.sections.map((section) => ({
        id: section.id,
        sessionIds: section.items.map((item) => item.sessionId),
      })),
      [
        {
          id: 'today' satisfies ChatSidebarHistorySectionId,
          sessionIds: ['session-latest-today', 'session-earlier-today'],
        },
        {
          id: 'previous7Days' satisfies ChatSidebarHistorySectionId,
          sessionIds: ['session-week-latest', 'session-week-earlier'],
        },
      ],
    );
  },
);

await runTest(
  'chatSidebarHistoryPresentation composes existing session list and owner presentation services instead of duplicating their logic',
  () => {
    const source = readFileSync(new URL('./chatSidebarHistoryPresentation.ts', import.meta.url), 'utf8');

    assert.match(
      source,
      /import \{ isOpenClawMainSession \} from '\.\/chatSessionBootstrap\.ts';/,
    );
    assert.match(
      source,
      /import \{ presentChatSessionListItem \} from '\.\/chatSessionListPresentation\.ts';/,
    );
    assert.match(
      source,
      /import \{[\s\S]*resolveChatSessionAgentId,[\s\S]*resolveChatSessionOwnerPresentation,[\s\S]*type ChatSidebarAgentOption,[\s\S]*\} from '\.\/chatSessionOwnerPresentation\.ts';/s,
    );
    assert.doesNotMatch(source, /function formatChatSessionRelativeTime/);
    assert.doesNotMatch(source, /function resolveChatSessionOwnerPresentation/);
  },
);
