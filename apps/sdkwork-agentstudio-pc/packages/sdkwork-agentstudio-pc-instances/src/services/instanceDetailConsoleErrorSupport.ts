export interface InstanceDetailConsoleSurface {
  error: (...args: unknown[]) => unknown;
}

export interface CreateInstanceDetailConsoleErrorReportersArgs {
  console: InstanceDetailConsoleSurface;
}

export function createInstanceDetailConsoleErrorReporters(
  args: CreateInstanceDetailConsoleErrorReportersArgs,
) {
  return {
    reportWorkbenchLoadError: (error: unknown) =>
      args.console.error('Failed to fetch instance workbench:', error),
    reportAgentWorkbenchLoadError: (error: unknown) =>
      args.console.error('Failed to load agent workbench:', error),
    reportInstanceFilesLoadError: (error: unknown) =>
      args.console.error('Failed to load instance files:', error),
    reportInstanceMemoriesLoadError: (error: unknown) =>
      args.console.error('Failed to load instance memories:', error),
  };
}
