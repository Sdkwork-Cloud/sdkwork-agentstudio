import { runNodeTypeScriptChecks } from './run-node-typescript-check.mjs';

runNodeTypeScriptChecks([
  'packages/sdkwork-agentstudio-pc-agent/src/pages/AgentMarket.test.ts',
  'packages/sdkwork-agentstudio-pc-agent/src/services/agentCatalog.test.ts',
  'packages/sdkwork-agentstudio-pc-agent/src/services/agentInstallService.test.ts',
  'scripts/sdkwork-agent-contract.test.ts',
]);
