import { runNodeTypeScriptChecks } from './run-node-typescript-check.mjs';

runNodeTypeScriptChecks([
  'packages/sdkwork-clawstudio-shell/src/components/chatCronActivityNotificationRuntime.test.ts',
  'packages/sdkwork-clawstudio-shell/src/application/layouts/chatRuntimeWarmersPolicy.test.ts',
  'packages/sdkwork-clawstudio-shell/src/application/bootstrap/bootstrapShellRuntime.test.ts',
]);
