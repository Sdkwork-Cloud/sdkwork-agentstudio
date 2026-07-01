import type { BuildInstanceLifecycleActionHandlersArgs } from './instanceLifecycleActionSupport.ts';

type LifecycleMutationExecutors = Pick<
  BuildInstanceLifecycleActionHandlersArgs,
  'executeRestart' | 'executeStop' | 'executeStart'
>;

export interface InstanceDetailLifecycleMutationService {
  restartInstance: LifecycleMutationExecutors['executeRestart'];
  stopInstance: LifecycleMutationExecutors['executeStop'];
  startInstance: LifecycleMutationExecutors['executeStart'];
}

export function createInstanceDetailLifecycleMutationExecutors(args: {
  instanceService: InstanceDetailLifecycleMutationService;
}): LifecycleMutationExecutors {
  return {
    executeRestart: (instanceId) => args.instanceService.restartInstance(instanceId),
    executeStop: (instanceId) => args.instanceService.stopInstance(instanceId),
    executeStart: (instanceId) => args.instanceService.startInstance(instanceId),
  };
}
