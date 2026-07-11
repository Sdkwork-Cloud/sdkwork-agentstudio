import assert from 'node:assert/strict';
import {
  resolveOpenClawGatewayWarmRefreshKey,
  resolveOpenClawGatewayWarmPlan,
  shouldRefreshOpenClawGatewayWarmConnectionsForBuiltInStatusChange,
  shouldWarmOpenClawGatewayConnections,
} from './openClawGatewayConnectionsPolicy.ts';

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('chat route enables gateway connection warmup', () => {
  assert.equal(shouldWarmOpenClawGatewayConnections('/chat'), true);
  assert.equal(shouldWarmOpenClawGatewayConnections('/chat?instance=openclaw'), true);
  assert.equal(shouldWarmOpenClawGatewayConnections('/chat#session'), true);
});

runTest('chat route warms the directory plus the active instance', () => {
  assert.deepEqual(
    resolveOpenClawGatewayWarmPlan({
      pathname: '/chat?instance=openclaw',
      activeInstanceId: 'instance-b',
      directoryInstanceIds: ['instance-a', 'instance-b'],
    }),
    {
      shouldQueryDirectory: true,
      instanceIds: ['instance-a', 'instance-b'],
    },
  );
});

runTest('non-chat workspace routes keep only the active instance warm', () => {
  assert.equal(shouldWarmOpenClawGatewayConnections('/tasks'), true);
  assert.equal(shouldWarmOpenClawGatewayConnections('/instances/abc'), true);
  assert.equal(shouldWarmOpenClawGatewayConnections('/kernel'), true);
  assert.deepEqual(
    resolveOpenClawGatewayWarmPlan({
      pathname: '/tasks',
      activeInstanceId: 'instance-active',
      directoryInstanceIds: ['instance-a', 'instance-b'],
    }),
    {
      shouldQueryDirectory: false,
      instanceIds: ['instance-active'],
    },
  );
});

runTest('auth routes stay cold even if an active instance exists', () => {
  assert.equal(shouldWarmOpenClawGatewayConnections('/auth'), false);
  assert.equal(shouldWarmOpenClawGatewayConnections('/login/oauth/callback/github'), false);
  assert.deepEqual(
    resolveOpenClawGatewayWarmPlan({
      pathname: '/login/oauth/callback/github',
      activeInstanceId: 'instance-active',
      directoryInstanceIds: ['instance-a'],
    }),
    {
      shouldQueryDirectory: false,
      instanceIds: [],
    },
  );
});

runTest('chat route warm refresh key changes when a warmed directory instance changes status even if the instance ids stay the same', () => {
  const offlineKey = resolveOpenClawGatewayWarmRefreshKey({
    pathname: '/chat',
    activeInstanceId: 'instance-b',
    directoryInstances: [
      { id: 'instance-a', status: 'offline' },
      { id: 'instance-b', status: 'starting' },
    ],
  });

  const onlineKey = resolveOpenClawGatewayWarmRefreshKey({
    pathname: '/chat',
    activeInstanceId: 'instance-b',
    directoryInstances: [
      { id: 'instance-a', status: 'offline' },
      { id: 'instance-b', status: 'online' },
    ],
  });

  assert.equal(offlineKey, 'instance-a:offline|instance-b:starting');
  assert.equal(onlineKey, 'instance-a:offline|instance-b:online');
  assert.notEqual(offlineKey, onlineKey);
});

runTest('non-chat workspace routes refresh warmup when the active warmed instance receives a built-in status event', () => {
  assert.equal(
    shouldRefreshOpenClawGatewayWarmConnectionsForBuiltInStatusChange({
      pathname: '/kernel',
      warmedInstanceIds: ['instance-active'],
      eventInstanceId: 'instance-active',
    }),
    true,
  );
});

runTest('chat route refreshes warmup when a warmed directory instance receives a built-in status event', () => {
  assert.equal(
    shouldRefreshOpenClawGatewayWarmConnectionsForBuiltInStatusChange({
      pathname: '/chat',
      warmedInstanceIds: ['instance-a', 'instance-b'],
      eventInstanceId: 'instance-b',
    }),
    true,
  );
});

runTest('cold routes and unmatched built-in status events do not refresh warmup', () => {
  assert.equal(
    shouldRefreshOpenClawGatewayWarmConnectionsForBuiltInStatusChange({
      pathname: '/auth',
      warmedInstanceIds: ['instance-active'],
      eventInstanceId: 'instance-active',
    }),
    false,
  );
  assert.equal(
    shouldRefreshOpenClawGatewayWarmConnectionsForBuiltInStatusChange({
      pathname: '/tasks',
      warmedInstanceIds: ['instance-active'],
      eventInstanceId: 'instance-other',
    }),
    false,
  );
  assert.equal(
    shouldRefreshOpenClawGatewayWarmConnectionsForBuiltInStatusChange({
      pathname: '/tasks',
      warmedInstanceIds: [],
      eventInstanceId: 'instance-active',
    }),
    false,
  );
});
