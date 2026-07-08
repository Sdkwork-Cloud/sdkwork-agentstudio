import { runNodeTypeScriptChecks } from './run-node-typescript-check.mjs';

runNodeTypeScriptChecks([
  'packages/sdkwork-clawstudio-commons/src/components/cronTasksManagerData.test.ts',
  'packages/sdkwork-clawstudio-commons/src/components/taskRuntimeFlowMeta.test.ts',
]);
