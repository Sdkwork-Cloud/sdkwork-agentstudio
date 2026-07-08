import type { CreateOpenClawConfigChannelMutationRunnerArgs } from './openClawConfigChannelMutationSupport.ts';

type ConfigChannelMutationExecutors = Pick<
  CreateOpenClawConfigChannelMutationRunnerArgs,
  'executeSaveConfig' | 'executeToggleEnabled'
>;

export interface InstanceDetailConfigChannelMutationService {
  saveOpenClawChannelConfig: ConfigChannelMutationExecutors['executeSaveConfig'];
  setOpenClawChannelEnabled: ConfigChannelMutationExecutors['executeToggleEnabled'];
}

export function createInstanceDetailConfigChannelMutationExecutors(args: {
  instanceService: InstanceDetailConfigChannelMutationService;
}): ConfigChannelMutationExecutors {
  return {
    executeSaveConfig: (instanceId, channelId, values) =>
      args.instanceService.saveOpenClawChannelConfig(instanceId, channelId, values),
    executeToggleEnabled: (instanceId, channelId, enabled) =>
      args.instanceService.setOpenClawChannelEnabled(instanceId, channelId, enabled),
  };
}
