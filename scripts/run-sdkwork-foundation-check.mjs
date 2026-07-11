import { runNodeTypeScriptChecks } from './run-node-typescript-check.mjs';

runNodeTypeScriptChecks([
  'packages/sdkwork-agentstudio-pc-infrastructure/src/services/openClawGatewayClient.test.ts',
  'packages/sdkwork-agentstudio-pc-infrastructure/src/platform/browserPersistencePolicy.test.ts',
  'packages/sdkwork-agentstudio-pc-infrastructure/src/platform/registry.test.ts',
  'packages/sdkwork-agentstudio-pc-infrastructure/src/platform/serverBrowserBridge.test.ts',
  'packages/sdkwork-agentstudio-pc-infrastructure/src/platform/webStudio.test.ts',
  'packages/sdkwork-agentstudio-pc-i18n/src/index.test.ts',
]);
