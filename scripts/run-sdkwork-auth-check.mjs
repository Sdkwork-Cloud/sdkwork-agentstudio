import { runNodeTypeScriptChecks } from './run-node-typescript-check.mjs';

runNodeTypeScriptChecks([
  'packages/sdkwork-clawstudio-auth/src/components/auth/authConfig.test.ts',
  'packages/sdkwork-clawstudio-auth/src/pages/authRouteUtils.test.ts',
  'scripts/app-sdk-user-center-storage-contract.test.ts',
  'packages/sdkwork-clawstudio-core/src/services/appAuthService.test.ts',
  'packages/sdkwork-clawstudio-core/src/stores/useAuthStore.test.ts',
  'scripts/user-center-standard-bridge.test.ts',
  'scripts/run-user-center-standard-contract.test.ts',
  'scripts/sdkwork-auth-contract.test.ts',
]);
