import assert from 'node:assert/strict';
import {
  buildOpenClawMainSessionKey,
  buildOpenClawThreadSessionKey,
  filterOpenClawSessionsByAgent,
  filterUserFacingOpenClawSessionsByAgent,
  isOpenClawMainSession,
  isOpenClawSessionInAgentScope,
  resolveOpenClawVisibleActiveSessionId,
  resolveChatBootstrapAction,
} from './chatSessionBootstrap.ts';

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

await runTest('chat bootstrap waits for instance route resolution before auto-creating a session', () => {
  assert.deepEqual(
    resolveChatBootstrapAction({
      activeInstanceId: 'instance-openclaw',
      routeMode: undefined,
      syncState: 'idle',
      hasActiveModel: true,
      activeSessionId: null,
      sessionIds: [],
    }),
    { type: 'wait' },
  );
});

await runTest('chat bootstrap auto-creates only for ready non-gateway instance routes', () => {
  assert.deepEqual(
    resolveChatBootstrapAction({
      activeInstanceId: 'instance-http',
      routeMode: 'instanceOpenAiHttp',
      sendMode: 'local',
      syncState: 'idle',
      hasActiveModel: true,
      activeSessionId: null,
      sessionIds: [],
    }),
    { type: 'create' },
  );

  assert.deepEqual(
    resolveChatBootstrapAction({
      activeInstanceId: 'instance-openclaw',
      routeMode: 'instanceOpenClawGatewayWs',
      sendMode: 'gateway',
      syncState: 'idle',
      hasActiveModel: true,
      activeSessionId: null,
      sessionIds: [],
    }),
    { type: 'idle' },
  );
});

await runTest('chat bootstrap selects the first session when the active session is missing', () => {
  assert.deepEqual(
    resolveChatBootstrapAction({
      activeInstanceId: 'instance-http',
      routeMode: 'instanceOpenAiHttp',
      sendMode: 'local',
      syncState: 'idle',
      hasActiveModel: true,
      activeSessionId: 'missing-session',
      sessionIds: ['session-a', 'session-b'],
    }),
    { type: 'select', sessionId: 'session-a' },
  );

  assert.deepEqual(
    resolveChatBootstrapAction({
      activeInstanceId: 'instance-openclaw',
      routeMode: 'instanceOpenClawGatewayWs',
      sendMode: 'gateway',
      syncState: 'idle',
      hasActiveModel: true,
      activeSessionId: 'missing-session',
      sessionIds: ['session-a', 'session-b'],
    }),
    { type: 'idle' },
  );

  assert.deepEqual(
    resolveChatBootstrapAction({
      activeInstanceId: 'instance-openclaw',
      routeMode: 'instanceOpenClawGatewayWs',
      sendMode: 'gateway',
      syncState: 'idle',
      hasActiveModel: true,
      activeSessionId: null,
      sessionIds: ['session-a', 'session-b'],
    }),
    { type: 'idle' },
  );
});

await runTest('chat bootstrap stays idle for unsupported instance routes even when stale models or sessions exist', () => {
  assert.deepEqual(
    resolveChatBootstrapAction({
      activeInstanceId: 'instance-unsupported',
      routeMode: 'unsupported',
      sendMode: 'local',
      syncState: 'idle',
      hasActiveModel: true,
      activeSessionId: null,
      sessionIds: [],
    }),
    { type: 'idle' },
  );

  assert.deepEqual(
    resolveChatBootstrapAction({
      activeInstanceId: 'instance-unsupported',
      routeMode: 'unsupported',
      sendMode: 'local',
      syncState: 'idle',
      hasActiveModel: true,
      activeSessionId: 'missing-session',
      sessionIds: ['session-a'],
    }),
    { type: 'idle' },
  );
});

await runTest(
  'chat bootstrap stays idle when local conversation hydration failed instead of auto-creating a replacement session',
  () => {
    assert.deepEqual(
      resolveChatBootstrapAction({
        activeInstanceId: 'instance-http',
        routeMode: 'instanceOpenAiHttp',
        sendMode: 'local',
        syncState: 'error',
        hasActiveModel: true,
        activeSessionId: null,
        sessionIds: [],
      }),
      { type: 'idle' },
    );

    assert.deepEqual(
      resolveChatBootstrapAction({
        activeInstanceId: 'instance-http',
        routeMode: 'instanceOpenAiHttp',
        sendMode: 'local',
        syncState: 'error',
        hasActiveModel: true,
        activeSessionId: 'missing-session',
        sessionIds: [],
      }),
      { type: 'idle' },
    );
  },
);

await runTest('chat bootstrap follows standardized sendMode when route literals are not the source of truth', () => {
  assert.deepEqual(
    resolveChatBootstrapAction({
      activeInstanceId: 'instance-hermes-http',
      routeMode: 'instanceOpenClawGatewayWs',
      sendMode: 'local',
      syncState: 'idle',
      hasActiveModel: true,
      activeSessionId: null,
      sessionIds: [],
    }),
    { type: 'create' },
  );

  assert.deepEqual(
    resolveChatBootstrapAction({
      activeInstanceId: 'instance-gateway-authority',
      routeMode: 'instanceOpenAiHttp',
      sendMode: 'gateway',
      syncState: 'idle',
      hasActiveModel: true,
      activeSessionId: null,
      sessionIds: ['session-a'],
    }),
    { type: 'idle' },
  );
});

await runTest('chat bootstrap does not infer gateway or local send semantics from route literals when sendMode is missing', () => {
  assert.deepEqual(
    resolveChatBootstrapAction({
      activeInstanceId: 'instance-route-only-gateway',
      routeMode: 'instanceOpenClawGatewayWs',
      syncState: 'idle',
      hasActiveModel: true,
      activeSessionId: null,
      sessionIds: [],
    }),
    { type: 'idle' },
  );

  assert.deepEqual(
    resolveChatBootstrapAction({
      activeInstanceId: 'instance-route-only-http',
      routeMode: 'instanceOpenAiHttp',
      syncState: 'idle',
      hasActiveModel: true,
      activeSessionId: 'missing-session',
      sessionIds: ['session-a'],
    }),
    { type: 'idle' },
  );
});

await runTest('openclaw chat bootstrap resolves upstream agent main session keys', () => {
  assert.equal(buildOpenClawMainSessionKey('research'), 'agent:research:main');
  assert.equal(buildOpenClawMainSessionKey(), 'agent:main:main');
});

await runTest('openclaw thread session keys anchor user threads beneath the agent main session', () => {
  assert.equal(
    buildOpenClawThreadSessionKey('research', 'agent-studio:session-123'),
    'agent:research:main:thread:agent-studio:session-123',
  );
  assert.equal(
    buildOpenClawThreadSessionKey(null, 'agent-studio:session-456'),
    'agent:main:main:thread:agent-studio:session-456',
  );
});

await runTest('openclaw agent scope matching only keeps sessions for the selected agent', () => {
  const sessions = [
    { id: 'agent:research:main' },
    { id: 'agent:research:main:thread:agent-studio:session-1' },
    { id: 'agent:ops:main' },
    { id: 'thread:agent-studio:legacy-session' },
  ];

  assert.equal(
    isOpenClawSessionInAgentScope('agent:research:main:thread:agent-studio:session-1', 'research'),
    true,
  );
  assert.equal(isOpenClawSessionInAgentScope('agent:ops:main', 'research'), false);
  assert.equal(isOpenClawSessionInAgentScope('thread:agent-studio:legacy-session', 'research'), false);
  assert.deepEqual(
    filterOpenClawSessionsByAgent(sessions, 'research').map((session) => session.id),
    ['agent:research:main', 'agent:research:main:thread:agent-studio:session-1'],
  );
  assert.equal(isOpenClawMainSession('agent:research:main', 'research'), true);
  assert.equal(
    isOpenClawMainSession('agent:research:main:thread:agent-studio:session-1', 'research'),
    false,
  );
  assert.deepEqual(
    filterUserFacingOpenClawSessionsByAgent(sessions, 'research').map((session) => session.id),
    [
      'agent:research:main',
      'agent:research:main:thread:agent-studio:session-1',
      'thread:agent-studio:legacy-session',
    ],
  );
  assert.equal(
    resolveOpenClawVisibleActiveSessionId('agent:research:main', [
      'agent:research:main',
      'agent:research:main:thread:agent-studio:session-1',
    ]),
    'agent:research:main',
  );
  assert.equal(
    resolveOpenClawVisibleActiveSessionId('agent:ops:main', [
      'agent:research:main',
      'agent:research:main:thread:agent-studio:session-1',
    ]),
    'agent:research:main',
  );
  assert.equal(
    resolveOpenClawVisibleActiveSessionId('agent:research:main', [
      'agent:research:main:thread:agent-studio:session-1',
    ]),
    'agent:research:main:thread:agent-studio:session-1',
  );
  assert.equal(
    resolveOpenClawVisibleActiveSessionId('agent:research:main:thread:agent-studio:session-1', [
      'agent:research:main',
      'agent:research:main:thread:agent-studio:session-1',
    ]),
    'agent:research:main:thread:agent-studio:session-1',
  );
});
