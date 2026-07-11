import { runNodeTypeScriptChecks } from './run-node-typescript-check.mjs';

runNodeTypeScriptChecks([
  'packages/sdkwork-agentstudio-pc-settings/src/apiSettingsShell.test.ts',
  'packages/sdkwork-agentstudio-pc-settings/src/ProviderConfigCenter.actionOrder.test.ts',
  'packages/sdkwork-agentstudio-pc-settings/src/kernelCenter.test.ts',
  'packages/sdkwork-agentstudio-pc-settings/src/kernelCenterView.test.ts',
  'packages/sdkwork-agentstudio-pc-settings/src/hostRuntimeSettings.test.ts',
  'packages/sdkwork-agentstudio-pc-settings/src/services/kernelCenterService.test.ts',
  'packages/sdkwork-agentstudio-pc-settings/src/services/localAiProxyLogsService.test.ts',
  'packages/sdkwork-agentstudio-pc-settings/src/services/settingsService.test.ts',
  'packages/sdkwork-agentstudio-pc-settings/src/services/providerConfigCenterService.test.ts',
  'packages/sdkwork-agentstudio-pc-settings/src/services/providerConfigEditorPolicy.test.ts',
  'scripts/sdkwork-settings-contract.test.ts',
]);
