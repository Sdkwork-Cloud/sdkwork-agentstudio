import { runNodeTypeScriptChecks } from './run-node-typescript-check.mjs';

runNodeTypeScriptChecks([
  'packages/sdkwork-agentstudio-pc-channels/src/pages/channels/channelInstanceResolver.test.ts',
  'packages/sdkwork-agentstudio-pc-channels/src/services/channelService.test.ts',
]);
