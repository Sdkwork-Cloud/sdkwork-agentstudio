import { runNodeTypeScriptChecks } from './run-node-typescript-check.mjs';

runNodeTypeScriptChecks([
  'packages/sdkwork-agentstudio-pc-dashboard/src/pages/dashboardSectionHydration.test.ts',
  'packages/sdkwork-agentstudio-pc-dashboard/src/pages/usageWorkspacePageComposition.test.ts',
  'packages/sdkwork-agentstudio-pc-dashboard/src/services/dashboardService.test.ts',
  'packages/sdkwork-agentstudio-pc-dashboard/src/services/usageWorkspaceFilters.test.ts',
  'packages/sdkwork-agentstudio-pc-dashboard/src/services/usageWorkspaceService.test.ts',
]);
