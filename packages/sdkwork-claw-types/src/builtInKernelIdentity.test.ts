import assert from 'node:assert/strict';
import {
  STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID,
  buildBuiltInKernelPrimaryInstanceId,
  canonicalizeBuiltInOpenClawInstanceId,
  isBuiltInOpenClawInstanceId,
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
