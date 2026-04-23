import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  buildChatSidebarAgentOptions,
  resolveChatSessionAgentId,
  resolveChatSessionOwnerPresentation,
} from './chatSessionOwnerPresentation.ts';

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
  'buildChatSidebarAgentOptions includes the main agent in all-session scope and normalizes avatars',
  () => {
    assert.deepEqual(
      buildChatSidebarAgentOptions({
        sessionScopeMode: 'all',
        visibleAgents: [
          {
            id: 'research',
            name: 'Research Agent',
            avatar: 're',
          },
          {
            id: 'ops',
            name: 'Ops Agent',
          },
        ],
        mainAgentLabel: 'Main Agent',
      }),
      [
        {
          id: null,
          name: 'Main Agent',
          avatarLabel: null,
        },
        {
          id: 'research',
          name: 'Research Agent',
          avatarLabel: 're',
        },
        {
          id: 'ops',
          name: 'Ops Agent',
          avatarLabel: 'OP',
        },
      ],
    );
  },
);

await runTest(
  'buildChatSidebarAgentOptions collapses semantic main agents into the localized main entry while preserving kernel metadata',
  () => {
    assert.deepEqual(
      buildChatSidebarAgentOptions({
        sessionScopeMode: 'all',
        visibleAgents: [
          {
            id: 'main',
            name: 'Main',
            avatar: 'MA',
            kernelId: 'openclaw',
          },
          {
            id: 'research',
            name: 'Research Agent',
            avatar: 're',
            kernelId: 'hermes',
          },
        ],
        mainAgentLabel: '主 Agent',
      }),
      [
        {
          id: null,
          name: '主 Agent',
          avatarLabel: 'MA',
          kernelId: 'openclaw',
          kernelLabel: 'OpenClaw',
          matchAgentIds: ['main'],
        },
        {
          id: 'research',
          name: 'Research Agent',
          avatarLabel: 're',
          kernelId: 'hermes',
          kernelLabel: 'Hermes',
        },
      ],
    );
  },
);

await runTest(
  'resolveChatSessionAgentId and resolveChatSessionOwnerPresentation derive identity from the shared session binding',
  () => {
    const session = {
      id: 'agent:research:main:thread:1',
      updatedAt: 200,
      kernelSession: {
        ref: {
          agentId: 'research',
        },
      },
    };

    assert.equal(resolveChatSessionAgentId(session), 'research');
    assert.deepEqual(
      resolveChatSessionOwnerPresentation({
        session,
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
        ],
      }),
      {
        id: 'research',
        name: 'Research Agent',
        avatarLabel: 'RE',
        kernelLabel: null,
      },
    );
  },
);

await runTest(
  'resolveChatSessionOwnerPresentation maps semantic main-agent sessions onto the localized main entry',
  () => {
    assert.deepEqual(
      resolveChatSessionOwnerPresentation({
        session: {
          id: 'agent:main:main',
          updatedAt: 100,
          kernelSession: {
            ref: {
              agentId: 'main',
            },
          },
        },
        agentOptions: [
          {
            id: null,
            name: '主 Agent',
            avatarLabel: 'MA',
            kernelId: 'openclaw',
            kernelLabel: 'OpenClaw',
            matchAgentIds: ['main'],
          },
        ],
      }),
      {
        id: null,
        name: '主 Agent',
        avatarLabel: 'MA',
        kernelLabel: 'OpenClaw',
      },
    );
  },
);

await runTest(
  'resolveChatSessionOwnerPresentation falls back to the main agent label for direct sessions',
  () => {
    assert.deepEqual(
      resolveChatSessionOwnerPresentation({
        session: {
          id: 'session-main',
          updatedAt: 100,
          agentId: null,
        },
        agentOptions: [],
        fallbackName: 'Main Agent',
      }),
      {
        id: null,
        name: 'Main Agent',
        avatarLabel: null,
        kernelLabel: null,
      },
    );
  },
);

await runTest(
  'resolveChatSessionOwnerPresentation prefers persisted actor binding labels when the agent catalog is unavailable',
  () => {
    assert.deepEqual(
      resolveChatSessionOwnerPresentation({
        session: {
          id: 'session-research',
          updatedAt: 100,
          agentId: 'research',
          kernelSession: {
            actorBinding: {
              agentId: 'research',
              label: 'Research Agent',
            },
          },
        },
        agentOptions: [],
        fallbackName: 'Main Agent',
      }),
      {
        id: 'research',
        name: 'Research Agent',
        avatarLabel: 'RE',
        kernelLabel: null,
      },
    );
  },
);

await runTest(
  'resolveChatSessionOwnerPresentation keeps kernel identity available when the catalog does not carry the agent',
  () => {
    assert.deepEqual(
      resolveChatSessionOwnerPresentation({
        session: {
          id: 'session-kernel-owned',
          updatedAt: 100,
          agentId: 'planner',
          kernelSession: {
            ref: {
              agentId: 'planner',
              kernelId: 'hermes',
            },
          },
        },
        agentOptions: [],
      }),
      {
        id: 'planner',
        name: 'planner',
        avatarLabel: 'PL',
        kernelLabel: 'Hermes',
      },
    );
  },
);

await runTest(
  'chatSessionOwnerPresentation reuses the shared session binding contract instead of redefining owner identity locally',
  () => {
    const source = readFileSync(new URL('./chatSessionOwnerPresentation.ts', import.meta.url), 'utf8');

    assert.match(
      source,
      /import \{ resolveChatSessionBinding, type ChatSessionBindingSource \} from '\.\/chatSessionBinding\.ts';/,
    );
    assert.doesNotMatch(source, /agentId\?: string \| null;/);
    assert.doesNotMatch(source, /actorBinding\?: \{/);
    assert.doesNotMatch(source, /ref\?: \{/);
  },
);
