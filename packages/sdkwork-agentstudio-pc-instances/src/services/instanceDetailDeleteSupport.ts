import type { BuildInstanceDeleteHandlerArgs } from './instanceLifecycleActionSupport.ts';

type DeleteHandlerBindings = Pick<
  BuildInstanceDeleteHandlerArgs,
  'confirmDelete' | 'executeDelete' | 'navigateToInstances'
>;

export interface InstanceDetailDeleteService {
  deleteInstance: DeleteHandlerBindings['executeDelete'];
}

export function createInstanceDetailDeleteHandlerBindings(args: {
  confirmDelete: DeleteHandlerBindings['confirmDelete'];
  navigate: (path: string) => void;
  instanceService: InstanceDetailDeleteService;
}): DeleteHandlerBindings {
  return {
    confirmDelete: args.confirmDelete,
    executeDelete: (instanceId) => args.instanceService.deleteInstance(instanceId),
    navigateToInstances: () => args.navigate('/instances'),
  };
}
