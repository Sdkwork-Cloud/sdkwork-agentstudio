import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  resolveChatRunningRunBinding,
  resolveChatRunningSessionId,
  resolveOpenClawDraftSessionId,
  resolveNewChatSessionModel,
  resolveChatSendSessionId,
  resolveChatSessionViewState,
  resolveGatewayVisibleSessionSyncTarget,
} from './chatSessionViewPolicy.ts';

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
  'resolveChatSessionViewState keeps the selected openclaw agent main session visible alongside its user-facing sessions',
  () => {
    const sessions = [
      { id: 'agent:research:main' },
      { id: 'agent:research:main:thread:agent-studio:session-1' },
      { id: 'agent:ops:main:thread:agent-studio:session-2' },
      { id: 'thread:agent-studio:legacy-session' },
    ];

    assert.deepEqual(
      resolveChatSessionViewState({
        sessions,
        activeSessionId: 'agent:research:main:thread:agent-studio:session-1',
        sessionScopeMode: 'agentBound',
        sessionScopeAgentId: 'research',
      }),
      {
        visibleSessions: [
          { id: 'agent:research:main' },
          { id: 'agent:research:main:thread:agent-studio:session-1' },
          { id: 'thread:agent-studio:legacy-session' },
        ],
        selectableSessions: [
          { id: 'agent:research:main' },
          { id: 'agent:research:main:thread:agent-studio:session-1' },
          { id: 'thread:agent-studio:legacy-session' },
        ],
        effectiveActiveSessionId: 'agent:research:main:thread:agent-studio:session-1',
      },
    );
  },
);

await runTest(
  'resolveChatSessionViewState keeps legacy and unscoped gateway sessions visible alongside the selected agent main session',
  () => {
    const sessions = [
      { id: 'agent:research:main' },
      { id: 'agent:research:main:thread:agent-studio:session-1' },
      { id: 'thread:agent-studio:legacy-session' },
      { id: 'agent-studio:instance-a:session-2' },
      { id: 'agent:ops:main:thread:agent-studio:session-3' },
    ];

    assert.deepEqual(
      resolveChatSessionViewState({
        sessions,
        activeSessionId: 'thread:agent-studio:legacy-session',
        sessionScopeMode: 'agentBound',
        sessionScopeAgentId: 'research',
      }),
      {
        visibleSessions: [
          { id: 'agent:research:main' },
          { id: 'agent:research:main:thread:agent-studio:session-1' },
          { id: 'thread:agent-studio:legacy-session' },
          { id: 'agent-studio:instance-a:session-2' },
        ],
        selectableSessions: [
          { id: 'agent:research:main' },
          { id: 'agent:research:main:thread:agent-studio:session-1' },
          { id: 'thread:agent-studio:legacy-session' },
          { id: 'agent-studio:instance-a:session-2' },
        ],
        effectiveActiveSessionId: 'thread:agent-studio:legacy-session',
      },
    );
  },
);

await runTest(
  'resolveChatSessionViewState hides non-current global unknown and cron gateway sessions to match the openclaw control ui session picker',
  () => {
    const sessions = [
      { id: 'agent:research:main' },
      { id: 'agent:research:main:thread:agent-studio:session-1' },
      { id: 'thread:agent-studio:legacy-session', sessionKind: 'direct' },
      {
        id: 'global:shared-session',
        sessionKind: 'direct',
        kernelSession: {
          sessionKind: 'global',
        },
      },
      { id: 'unknown:shared-session', sessionKind: 'unknown' },
      { id: 'cron:nightly-roundup', sessionKind: 'direct' },
      { id: 'agent:research:cron:job-1', sessionKind: 'direct' },
    ];

    assert.deepEqual(
      resolveChatSessionViewState({
        sessions,
        activeSessionId: 'agent:research:main',
        sessionScopeMode: 'agentBound',
        sessionScopeAgentId: 'research',
      }),
      {
        visibleSessions: [
          { id: 'agent:research:main' },
          { id: 'agent:research:main:thread:agent-studio:session-1' },
          { id: 'thread:agent-studio:legacy-session', sessionKind: 'direct' },
        ],
        selectableSessions: [
          { id: 'agent:research:main' },
          { id: 'agent:research:main:thread:agent-studio:session-1' },
          { id: 'thread:agent-studio:legacy-session', sessionKind: 'direct' },
        ],
        effectiveActiveSessionId: 'agent:research:main',
      },
    );
  },
);

await runTest(
  'resolveChatSessionViewState keeps the current global or cron session visible even when those sessions are normally hidden from the gateway list',
  () => {
    const sessions = [
      { id: 'agent:research:main' },
      { id: 'agent:research:main:thread:agent-studio:session-1' },
      { id: 'thread:agent-studio:legacy-session', sessionKind: 'direct' },
      {
        id: 'global:shared-session',
        sessionKind: 'direct',
        kernelSession: {
          sessionKind: 'global',
        },
      },
      { id: 'cron:nightly-roundup', sessionKind: 'direct' },
    ];

    assert.deepEqual(
      resolveChatSessionViewState({
        sessions,
        activeSessionId: 'global:shared-session',
        sessionScopeMode: 'agentBound',
        sessionScopeAgentId: 'research',
      }),
      {
        visibleSessions: [
          { id: 'agent:research:main' },
          { id: 'agent:research:main:thread:agent-studio:session-1' },
          { id: 'thread:agent-studio:legacy-session', sessionKind: 'direct' },
          {
            id: 'global:shared-session',
            sessionKind: 'direct',
            kernelSession: {
              sessionKind: 'global',
            },
          },
        ],
        selectableSessions: [
          { id: 'agent:research:main' },
          { id: 'agent:research:main:thread:agent-studio:session-1' },
          { id: 'thread:agent-studio:legacy-session', sessionKind: 'direct' },
          {
            id: 'global:shared-session',
            sessionKind: 'direct',
            kernelSession: {
              sessionKind: 'global',
            },
          },
        ],
        effectiveActiveSessionId: 'global:shared-session',
      },
    );

    assert.deepEqual(
      resolveChatSessionViewState({
        sessions,
        activeSessionId: 'cron:nightly-roundup',
        sessionScopeMode: 'agentBound',
        sessionScopeAgentId: 'research',
      }),
      {
        visibleSessions: [
          { id: 'agent:research:main' },
          { id: 'agent:research:main:thread:agent-studio:session-1' },
          { id: 'thread:agent-studio:legacy-session', sessionKind: 'direct' },
          { id: 'cron:nightly-roundup', sessionKind: 'direct' },
        ],
        selectableSessions: [
          { id: 'agent:research:main' },
          { id: 'agent:research:main:thread:agent-studio:session-1' },
          { id: 'thread:agent-studio:legacy-session', sessionKind: 'direct' },
          { id: 'cron:nightly-roundup', sessionKind: 'direct' },
        ],
        effectiveActiveSessionId: 'cron:nightly-roundup',
      },
    );
  },
);

await runTest(
  'resolveChatSessionViewState falls back to the selected agent main session when the raw active session is hidden or outside the selected agent scope',
  () => {
    const sessions = [
      { id: 'agent:research:main' },
      { id: 'agent:research:main:thread:agent-studio:session-1' },
      { id: 'agent:research:main:thread:agent-studio:session-2' },
    ];

    assert.deepEqual(
      resolveChatSessionViewState({
        sessions,
        activeSessionId: 'agent:research:main',
        sessionScopeMode: 'agentBound',
        sessionScopeAgentId: 'research',
      }),
      {
        visibleSessions: [
          { id: 'agent:research:main' },
          { id: 'agent:research:main:thread:agent-studio:session-1' },
          { id: 'agent:research:main:thread:agent-studio:session-2' },
        ],
        selectableSessions: [
          { id: 'agent:research:main' },
          { id: 'agent:research:main:thread:agent-studio:session-1' },
          { id: 'agent:research:main:thread:agent-studio:session-2' },
        ],
        effectiveActiveSessionId: 'agent:research:main',
      },
    );
  },
);

await runTest(
  'resolveChatSessionViewState keeps gateway agent selection in draft mode when no concrete session is active',
  () => {
    const sessions = [
      { id: 'agent:research:main' },
      { id: 'agent:research:main:thread:agent-studio:session-1' },
      { id: 'thread:agent-studio:legacy-session' },
    ];

    assert.deepEqual(
      resolveChatSessionViewState({
        sessions,
        activeSessionId: null,
        sessionScopeMode: 'agentBound',
        sessionScopeAgentId: 'research',
      }),
      {
        visibleSessions: [
          { id: 'agent:research:main' },
          { id: 'agent:research:main:thread:agent-studio:session-1' },
          { id: 'thread:agent-studio:legacy-session' },
        ],
        selectableSessions: [
          { id: 'agent:research:main' },
          { id: 'agent:research:main:thread:agent-studio:session-1' },
          { id: 'thread:agent-studio:legacy-session' },
        ],
        effectiveActiveSessionId: null,
      },
    );
  },
);

await runTest(
  'resolveChatSessionViewState leaves direct chat sessions unchanged',
  () => {
    const sessions = [{ id: 'session-a' }, { id: 'session-b' }];

    assert.deepEqual(
      resolveChatSessionViewState({
        sessions,
        activeSessionId: 'session-b',
        sessionScopeMode: 'all',
        sessionScopeAgentId: 'research',
      }),
      {
        visibleSessions: sessions,
        selectableSessions: sessions,
        effectiveActiveSessionId: 'session-b',
      },
    );
  },
);

await runTest(
  'resolveChatSessionViewState hides sessions entirely when the active route is unsupported',
  () => {
    const sessions = [{ id: 'session-a' }, { id: 'session-b' }];

    assert.deepEqual(
      resolveChatSessionViewState({
        sessions,
        activeSessionId: 'session-b',
        isChatSupported: false,
        sessionScopeMode: 'all',
        sessionScopeAgentId: 'research',
      }),
      {
        visibleSessions: [],
        selectableSessions: [],
        effectiveActiveSessionId: null,
      },
    );
  },
);

await runTest('resolveChatSendSessionId uses the visible session for gateway sends when the raw active session is out of scope', () => {
  assert.equal(
    resolveChatSendSessionId({
      selectedSessionId: null,
      displaySessionId: null,
      sendMode: 'gateway',
    }),
    null,
  );

  assert.equal(
    resolveChatSendSessionId({
      selectedSessionId: 'agent:ops:main',
      displaySessionId: 'agent:research:main',
      sendMode: 'gateway',
    }),
    'agent:research:main',
  );
});

await runTest('resolveChatSendSessionId keeps the raw active session for direct chat sends', () => {
  assert.equal(
    resolveChatSendSessionId({
      selectedSessionId: 'session-a',
      displaySessionId: null,
      sendMode: 'local',
    }),
    'session-a',
  );
});

await runTest(
  'resolveChatRunningRunBinding only exposes gateway runs from the current selectable session scope',
  () => {
    assert.equal(
      resolveChatRunningRunBinding({
        sendMode: 'gateway',
        selectableSessions: [
          { id: 'agent:research:main', runId: null },
          { id: 'agent:research:main:thread:visible', runId: null },
        ],
      }),
      null,
    );
  },
);

await runTest(
  'resolveChatRunningRunBinding keeps direct chat idle and returns the visible gateway run binding when present',
  () => {
    assert.equal(
      resolveChatRunningRunBinding({
        sendMode: 'local',
        selectableSessions: [{ id: 'session-a', runId: 'run-local' }],
      }),
      null,
    );

    assert.deepEqual(
      resolveChatRunningRunBinding({
        sendMode: 'gateway',
        selectableSessions: [
          { id: 'agent:research:main', runId: null },
          { id: 'agent:research:main:thread:visible', runId: 'run-visible' },
        ],
      }),
      {
        scopeInstanceId: null,
        sessionId: 'agent:research:main:thread:visible',
        kernelOwnedSessionId: 'agent:research:main:thread:visible',
        kernelId: null,
        kernelInstanceId: null,
        nativeSessionId: null,
        routingKey: null,
        agentId: 'research',
        lineageParentSessionId: null,
        authorityKind: null,
        lifecycle: null,
        runId: 'run-visible',
        isActive: true,
        isKernelAuthoritative: false,
      },
    );
  },
);

await runTest(
  'resolveChatRunningRunBinding prefers kernel activeRunId when the legacy gateway runId is absent',
  () => {
    assert.deepEqual(
      resolveChatRunningRunBinding({
        sendMode: 'gateway',
        selectableSessions: [
          {
            id: 'agent:research:main',
            runId: null,
            kernelSession: {
              activeRunId: null,
            },
          },
          {
            id: 'agent:research:main:thread:visible',
            runId: null,
            kernelSession: {
              activeRunId: 'kernel-run-visible',
              ref: {
                kernelId: 'openclaw',
                instanceId: 'instance-openclaw',
                sessionId: 'agent:research:main:thread:visible',
                nativeSessionId: 'native-visible',
              },
              authority: {
                kind: 'gateway',
              },
            },
          },
        ],
      }),
      {
        scopeInstanceId: null,
        sessionId: 'agent:research:main:thread:visible',
        kernelOwnedSessionId: 'native-visible',
        kernelId: 'openclaw',
        kernelInstanceId: 'instance-openclaw',
        nativeSessionId: 'native-visible',
        routingKey: null,
        agentId: 'research',
        lineageParentSessionId: null,
        authorityKind: 'gateway',
        lifecycle: null,
        runId: 'kernel-run-visible',
        isActive: true,
        isKernelAuthoritative: true,
      },
    );
  },
);

await runTest(
  'resolveChatRunningSessionId only exposes gateway runs from the current selectable session scope',
  () => {
    assert.equal(
      resolveChatRunningSessionId({
        sendMode: 'gateway',
        selectableSessions: [
          { id: 'agent:research:main', runId: null },
          { id: 'agent:research:main:thread:visible', runId: null },
        ],
      }),
      null,
    );
  },
);

await runTest(
  'resolveChatRunningSessionId keeps direct chat idle and returns the visible gateway run when present',
  () => {
    assert.equal(
      resolveChatRunningSessionId({
        sendMode: 'local',
        selectableSessions: [{ id: 'session-a', runId: 'run-local' }],
      }),
      null,
    );

    assert.equal(
      resolveChatRunningSessionId({
        sendMode: 'gateway',
        selectableSessions: [
          { id: 'agent:research:main', runId: null },
          { id: 'agent:research:main:thread:visible', runId: 'run-visible' },
        ],
      }),
      'agent:research:main:thread:visible',
    );
  },
);

await runTest(
  'resolveChatRunningSessionId prefers kernel activeRunId when the legacy gateway runId is absent',
  () => {
    assert.equal(
      resolveChatRunningSessionId({
        sendMode: 'gateway',
        selectableSessions: [
          {
            id: 'agent:research:main',
            runId: null,
            kernelSession: {
              activeRunId: null,
            },
          },
          {
            id: 'agent:research:main:thread:visible',
            runId: null,
            kernelSession: {
              activeRunId: 'kernel-run-visible',
            },
          },
        ],
      }),
      'agent:research:main:thread:visible',
    );
  },
);

await runTest('resolveNewChatSessionModel keeps the active gateway model id for new openclaw threads', () => {
  assert.equal(
    resolveNewChatSessionModel({
      newSessionModelMode: 'modelId',
      activeModelId: 'anthropic/claude-3-7-sonnet',
      activeModelName: 'Claude 3.7 Sonnet',
    }),
    'anthropic/claude-3-7-sonnet',
  );
});

await runTest('resolveNewChatSessionModel keeps the active local model name for direct chats', () => {
  assert.equal(
    resolveNewChatSessionModel({
      newSessionModelMode: 'modelName',
      activeModelId: 'google/gemini-2.5-pro',
      activeModelName: 'Gemini 2.5 Pro',
    }),
    'Gemini 2.5 Pro',
  );
});

await runTest('resolveNewChatSessionModel returns undefined when no active model is available', () => {
  assert.equal(
    resolveNewChatSessionModel({
      newSessionModelMode: 'modelId',
      activeModelId: '',
      activeModelName: '',
    }),
    undefined,
  );
});

await runTest(
  'resolveOpenClawDraftSessionId targets the selected agent main session for new gateway sends',
  () => {
    assert.equal(
      resolveOpenClawDraftSessionId({
        sessionScopeMode: 'agentBound',
        sessionScopeAgentId: 'research',
      }),
      'agent:research:main',
    );

    assert.equal(
      resolveOpenClawDraftSessionId({
        sessionScopeMode: 'agentBound',
        sessionScopeAgentId: null,
      }),
      'agent:main:main',
    );

    assert.equal(
      resolveOpenClawDraftSessionId({
        sessionScopeMode: 'all',
        sessionScopeAgentId: 'research',
      }),
      undefined,
    );
  },
);

await runTest(
  'resolveGatewayVisibleSessionSyncTarget syncs to the visible fallback when the raw gateway session is hidden by agent scope',
  () => {
    assert.deepEqual(
      resolveGatewayVisibleSessionSyncTarget({
        supportsVisibleSessionSync: true,
        activeSessionId: 'agent:research:main:thread:agent-studio:session-1',
        effectiveActiveSessionId: 'agent:ops:main',
      }),
      'agent:ops:main',
    );
  },
);

await runTest(
  'resolveGatewayVisibleSessionSyncTarget stays idle when the active gateway session already matches the visible session or when the route is not gateway-backed',
  () => {
    assert.equal(
      resolveGatewayVisibleSessionSyncTarget({
        supportsVisibleSessionSync: true,
        activeSessionId: 'agent:ops:main',
        effectiveActiveSessionId: 'agent:ops:main',
      }),
      null,
    );

    assert.equal(
      resolveGatewayVisibleSessionSyncTarget({
        supportsVisibleSessionSync: false,
        activeSessionId: 'session-a',
        effectiveActiveSessionId: 'session-b',
      }),
      null,
    );

    assert.equal(
      resolveGatewayVisibleSessionSyncTarget({
        supportsVisibleSessionSync: true,
        activeSessionId: null,
        effectiveActiveSessionId: null,
      }),
      null,
    );
  },
);

await runTest(
  'chatSessionViewPolicy reuses the shared run binding source instead of deriving a local run-session contract',
  () => {
    const source = readFileSync(new URL('./chatSessionViewPolicy.ts', import.meta.url), 'utf8');
    assert.match(
      source,
      /import\s*\{\s*resolveChatRunBinding,\s*type ChatRunBindingSource\s*\}\s*from '\.\/chatRunBinding\.ts';/,
    );
    assert.doesNotMatch(source, /Parameters<typeof resolveChatRunBinding>/);
  },
);
