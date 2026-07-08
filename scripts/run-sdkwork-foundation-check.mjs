import { runNodeTypeScriptChecks } from './run-node-typescript-check.mjs';

runNodeTypeScriptChecks([
  'packages/sdkwork-clawstudio-infrastructure/src/services/openClawGatewayClient.test.ts',
  'packages/sdkwork-clawstudio-infrastructure/src/platform/browserPersistencePolicy.test.ts',
  'packages/sdkwork-clawstudio-infrastructure/src/platform/registry.test.ts',
  'packages/sdkwork-clawstudio-infrastructure/src/platform/serverBrowserBridge.test.ts',
  'packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.test.ts',
  'packages/sdkwork-clawstudio-i18n/src/index.test.ts',
]);
