import { runNodeTypeScriptChecks } from './run-node-typescript-check.mjs';

runNodeTypeScriptChecks([
  'packages/sdkwork-claw-agent/src/pages/AgentMarket.test.ts',
  'packages/sdkwork-claw-agent/src/services/agentCatalog.test.ts',
  'packages/sdkwork-claw-agent/src/services/agentInstallService.test.ts',
  'scripts/sdkwork-agent-contract.test.ts',
]);
