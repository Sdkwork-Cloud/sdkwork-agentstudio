import { runNodeTypeScriptChecks } from './run-node-typescript-check.mjs';

runNodeTypeScriptChecks([
  'packages/sdkwork-clawstudio-agent/src/pages/AgentMarket.test.ts',
  'packages/sdkwork-clawstudio-agent/src/services/agentCatalog.test.ts',
  'packages/sdkwork-clawstudio-agent/src/services/agentInstallService.test.ts',
  'scripts/sdkwork-agent-contract.test.ts',
]);
