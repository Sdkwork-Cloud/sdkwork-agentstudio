import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  createUserCenterStandardCommandPlan,
  resolveAuthStandardRunner,
  resolveSdkworkAppbaseContractsRunner,
  resolveServerUserCenterEntrypointContractTestFile,
} from './run-user-center-standard.mjs';

const workspaceRoot = path.resolve(import.meta.dirname, '..');
const packageJson = JSON.parse(
  fs.readFileSync(path.join(workspaceRoot, 'package.json'), 'utf8'),
) as {
  scripts?: Record<string, string>;
};

assert.equal(
  packageJson.scripts?.['test:user-center-standard'],
  'sdkwork-run-node scripts/run-user-center-standard.mjs',
);

const commandPlan = createUserCenterStandardCommandPlan({
  nodeExecutable: '/usr/bin/node',
  platform: 'linux',
  workspaceRoot,
});
assert.equal(commandPlan.length, 3);
assert.deepEqual(commandPlan[0].args, [
  resolveSdkworkAppbaseContractsRunner({
    sdkworkAppbaseRoot: undefined,
    workspaceRoot,
  }),
]);
assert.deepEqual(commandPlan[1].args, [
  resolveAuthStandardRunner({ workspaceRoot }),
]);
assert.deepEqual(commandPlan[2].args, [
  resolveServerUserCenterEntrypointContractTestFile({ workspaceRoot }),
]);

console.log('claw-studio run-user-center-standard contract passed.');
