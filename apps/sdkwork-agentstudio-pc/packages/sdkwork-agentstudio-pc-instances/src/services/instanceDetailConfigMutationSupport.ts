import type { BuildOpenClawConfigMutationHandlersArgs } from './openClawConfigMutationSupport.ts';

type ConfigMutationExecutors = {
  webSearch: Pick<BuildOpenClawConfigMutationHandlersArgs['webSearch'], 'executeSave'>;
  xSearch: Pick<BuildOpenClawConfigMutationHandlersArgs['xSearch'], 'executeSave'>;
  webSearchNativeCodex: Pick<
    BuildOpenClawConfigMutationHandlersArgs['webSearchNativeCodex'],
    'executeSave'
  >;
  webFetch: Pick<BuildOpenClawConfigMutationHandlersArgs['webFetch'], 'executeSave'>;
  authCooldowns: Pick<
    BuildOpenClawConfigMutationHandlersArgs['authCooldowns'],
    'executeSave'
  >;
  dreaming: Pick<BuildOpenClawConfigMutationHandlersArgs['dreaming'], 'executeSave'>;
};

export interface InstanceDetailConfigMutationService {
  saveOpenClawWebSearchConfig: ConfigMutationExecutors['webSearch']['executeSave'];
  saveOpenClawXSearchConfig: ConfigMutationExecutors['xSearch']['executeSave'];
  saveOpenClawWebSearchNativeCodexConfig: ConfigMutationExecutors['webSearchNativeCodex']['executeSave'];
  saveOpenClawWebFetchConfig: ConfigMutationExecutors['webFetch']['executeSave'];
  saveOpenClawAuthCooldownsConfig: ConfigMutationExecutors['authCooldowns']['executeSave'];
  saveOpenClawDreamingConfig: ConfigMutationExecutors['dreaming']['executeSave'];
}

export function createInstanceDetailConfigMutationExecutors(args: {
  instanceService: InstanceDetailConfigMutationService;
}): ConfigMutationExecutors {
  return {
    webSearch: {
      executeSave: (instanceId, input) => args.instanceService.saveOpenClawWebSearchConfig(instanceId, input),
    },
    xSearch: {
      executeSave: (instanceId, input) => args.instanceService.saveOpenClawXSearchConfig(instanceId, input),
    },
    webSearchNativeCodex: {
      executeSave: (instanceId, input) =>
        args.instanceService.saveOpenClawWebSearchNativeCodexConfig(instanceId, input),
    },
    webFetch: {
      executeSave: (instanceId, input) => args.instanceService.saveOpenClawWebFetchConfig(instanceId, input),
    },
    authCooldowns: {
      executeSave: (instanceId, input) =>
        args.instanceService.saveOpenClawAuthCooldownsConfig(instanceId, input),
    },
    dreaming: {
      executeSave: (instanceId, input) => args.instanceService.saveOpenClawDreamingConfig(instanceId, input),
    },
  };
}
