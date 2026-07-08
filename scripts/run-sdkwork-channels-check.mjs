import { runNodeTypeScriptChecks } from './run-node-typescript-check.mjs';

runNodeTypeScriptChecks([
  'packages/sdkwork-clawstudio-channels/src/pages/channels/channelInstanceResolver.test.ts',
  'packages/sdkwork-clawstudio-channels/src/services/channelService.test.ts',
]);
