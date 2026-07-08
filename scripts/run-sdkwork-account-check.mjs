import { runNodeTypeScriptChecks } from './run-node-typescript-check.mjs';

runNodeTypeScriptChecks([
  'packages/sdkwork-clawstudio-account/src/services/accountService.test.ts',
  'scripts/sdkwork-account-contract.test.ts',
]);
