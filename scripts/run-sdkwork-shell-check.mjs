import { runNodeTypeScriptChecks } from './run-node-typescript-check.mjs';

runNodeTypeScriptChecks([
  'packages/sdkwork-agentstudio-pc-shell/src/components/chatCronActivityNotificationRuntime.test.ts',
  'packages/sdkwork-agentstudio-pc-shell/src/application/layouts/chatRuntimeWarmersPolicy.test.ts',
  'packages/sdkwork-agentstudio-pc-shell/src/application/bootstrap/bootstrapShellRuntime.test.ts',
]);
