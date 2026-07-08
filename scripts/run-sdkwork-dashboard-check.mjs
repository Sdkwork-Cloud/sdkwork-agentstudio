import { runNodeTypeScriptChecks } from './run-node-typescript-check.mjs';

runNodeTypeScriptChecks([
  'packages/sdkwork-clawstudio-dashboard/src/pages/dashboardSectionHydration.test.ts',
  'packages/sdkwork-clawstudio-dashboard/src/pages/usageWorkspacePageComposition.test.ts',
  'packages/sdkwork-clawstudio-dashboard/src/services/dashboardService.test.ts',
  'packages/sdkwork-clawstudio-dashboard/src/services/usageWorkspaceFilters.test.ts',
  'packages/sdkwork-clawstudio-dashboard/src/services/usageWorkspaceService.test.ts',
]);
