import assert from 'node:assert/strict';
import {
  OPENCLAW_GATEWAY_DEFAULT_BASE_URL,
  OPENCLAW_GATEWAY_DEFAULT_HOST,
  OPENCLAW_GATEWAY_DEFAULT_PORT,
  OPENCLAW_GATEWAY_DEFAULT_WEBSOCKET_URL,
  STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID,
  buildBuiltInKernelPrimaryInstanceId,
  canonicalizeBuiltInOpenClawInstanceId,
  isBuiltInOpenClawInstanceId,
  isOpenClawRuntimeKind,
  matchesBuiltInOpenClawInstanceId,
} from './builtInKernelIdentity.ts';

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('built-in kernel identity builds canonical primary ids from runtime ids', () => {
  assert.equal(buildBuiltInKernelPrimaryInstanceId(' OpenClaw '), STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID);
  assert.equal(buildBuiltInKernelPrimaryInstanceId('phoenixclaw'), 'managed-phoenixclaw-primary');
  assert.equal(buildBuiltInKernelPrimaryInstanceId(''), null);
});

runTest('built-in OpenClaw identity recognizes only the canonical stable id', () => {
  assert.equal(isBuiltInOpenClawInstanceId(STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID), true);
  assert.equal(isBuiltInOpenClawInstanceId('local-built-in'), false);
  assert.equal(
    canonicalizeBuiltInOpenClawInstanceId(` ${STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID} `),
    STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID,
  );
  assert.equal(canonicalizeBuiltInOpenClawInstanceId(' local-built-in '), 'local-built-in');
  assert.equal(
    matchesBuiltInOpenClawInstanceId(STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID, 'local-built-in'),
    false,
  );
});

runTest('OpenClaw runtime identity is explicit and whitespace tolerant', () => {
  assert.equal(isOpenClawRuntimeKind('openclaw'), true);
  assert.equal(isOpenClawRuntimeKind(' OpenClaw '), true);
  assert.equal(isOpenClawRuntimeKind('phoenixclaw'), false);
  assert.equal(isOpenClawRuntimeKind(''), false);
  assert.equal(isOpenClawRuntimeKind(null), false);
});

runTest('built-in OpenClaw gateway authority exposes the canonical default endpoint', () => {
  assert.equal(OPENCLAW_GATEWAY_DEFAULT_HOST, '127.0.0.1');
  assert.equal(OPENCLAW_GATEWAY_DEFAULT_PORT, 21280);
  assert.equal(OPENCLAW_GATEWAY_DEFAULT_BASE_URL, 'http://127.0.0.1:21280');
  assert.equal(OPENCLAW_GATEWAY_DEFAULT_WEBSOCKET_URL, 'ws://127.0.0.1:21280');
});
