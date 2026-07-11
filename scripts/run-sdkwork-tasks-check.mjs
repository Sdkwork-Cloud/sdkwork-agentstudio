import { runNodeTypeScriptChecks } from './run-node-typescript-check.mjs';

runNodeTypeScriptChecks([
  'packages/sdkwork-agentstudio-pc-commons/src/components/cronTasksManagerData.test.ts',
  'packages/sdkwork-agentstudio-pc-commons/src/components/taskRuntimeFlowMeta.test.ts',
]);
