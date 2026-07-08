export interface CreateInstanceDetailWorkbenchReloadHandlersArgs<T> {
  loadWorkbench: (instanceId: string, options?: { withSpinner?: boolean }) => T;
}

export function createInstanceDetailWorkbenchReloadHandlers<T>(
  args: CreateInstanceDetailWorkbenchReloadHandlersArgs<T>,
) {
  return {
    reloadWorkbench: (instanceId: string, options?: { withSpinner?: boolean }) =>
      args.loadWorkbench(instanceId, options),
    reloadWorkbenchImmediately: (instanceId: string) => args.loadWorkbench(instanceId),
  };
}

export interface CreateInstanceDetailSilentWorkbenchReloadHandlerArgs<T> {
  instanceId: string | null | undefined;
  reloadWorkbench: (instanceId: string, options: { withSpinner?: boolean }) => T;
}

export function createInstanceDetailSilentWorkbenchReloadHandler<T>(
  args: CreateInstanceDetailSilentWorkbenchReloadHandlerArgs<T>,
) {
  return () => {
    if (!args.instanceId) {
      return undefined;
    }

    return args.reloadWorkbench(args.instanceId, { withSpinner: false });
  };
}
