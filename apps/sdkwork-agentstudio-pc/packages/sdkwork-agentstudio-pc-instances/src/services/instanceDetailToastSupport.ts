export interface InstanceDetailToastSurface {
  success: (message: string) => unknown;
  error: (message: string) => unknown;
  info: (message: string) => unknown;
}

export interface CreateInstanceDetailToastReportersArgs {
  toast: InstanceDetailToastSurface;
}

export function createInstanceDetailToastReporters(args: CreateInstanceDetailToastReportersArgs) {
  return {
    reportSuccess: (message: string) => args.toast.success(message),
    reportError: (message: string) => args.toast.error(message),
    reportInfo: (message: string) => args.toast.info(message),
  };
}
