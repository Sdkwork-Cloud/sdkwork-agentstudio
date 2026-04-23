import { runNodeTypeScriptChecks } from './run-node-typescript-check.mjs';

runNodeTypeScriptChecks([
  'scripts/sdkwork-core-contract.test.ts',
  'packages/sdkwork-claw-core/src/node.test.ts',
  'packages/sdkwork-claw-core/src/lib/llmService.test.ts',
  'packages/sdkwork-claw-core/src/services/kernelDetailModuleRegistry.test.ts',
  'packages/sdkwork-claw-core/src/services/kernelAgentManagementService.test.ts',
  'packages/sdkwork-claw-core/src/services/kernelAgentLibraryService.test.ts',
  'packages/sdkwork-claw-core/src/services/kernelOwnedAgentLibraryService.test.ts',
  'packages/sdkwork-claw-core/src/services/accountService.test.ts',
  'packages/sdkwork-claw-core/src/services/communityService.test.ts',
  'packages/sdkwork-claw-core/src/services/updateService.test.ts',
  'packages/sdkwork-claw-core/src/services/openClawProviderRequestDraftService.test.ts',
  'packages/sdkwork-claw-core/src/services/openClawAgentCatalogService.test.ts',
  'packages/sdkwork-claw-core/src/services/openClawConfigService.test.ts',
  'packages/sdkwork-claw-core/src/services/providerRoutingCatalogService.test.ts',
  'packages/sdkwork-claw-core/src/services/taskRuntimeService.test.ts',
  'packages/sdkwork-claw-core/src/services/taskService.test.ts',
  'packages/sdkwork-claw-core/src/services/settingsService.test.ts',
]);
