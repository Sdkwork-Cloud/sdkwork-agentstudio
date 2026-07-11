import type { StartupMilestoneSnapshot } from './startupPresentation';

export const INITIAL_DESKTOP_STARTUP_MILESTONES: StartupMilestoneSnapshot = {
  hasWindowPresented: false,
  hasRuntimeConnected: false,
  hasShellBootstrapped: false,
  hasShellMounted: false,
};

export interface DesktopBootstrapState {
  milestones: StartupMilestoneSnapshot;
  status: 'booting' | 'launching' | 'error';
  errorMessage: string | null;
  shouldRenderShell: boolean;
  isSplashVisible: boolean;
}

export interface DesktopBootstrapStateActions {
  updateMilestones: (
    updater: (current: StartupMilestoneSnapshot) => StartupMilestoneSnapshot,
  ) => void;
  setStatus: (nextStatus: DesktopBootstrapState['status']) => void;
  setErrorMessage: (nextMessage: string | null) => void;
  setShouldRenderShell: (nextValue: boolean) => void;
  setIsSplashVisible: (nextValue: boolean) => void;
}

export type DesktopBootstrapResult = 'launched' | 'failed' | 'cancelled';

type StartupLogLevel = 'info' | 'warn' | 'error';

interface RunDesktopBootstrapSequenceOptions {
  pathname: string;
  runId: number;
  isRunCurrent: () => boolean;
  revealStartupWindow: () => Promise<void>;
  connectDesktopRuntime: () => Promise<void>;
  bootstrapShellRuntime: () => Promise<void>;
  resolveSidebarStartupRoute: (pathname: string) => string;
  listSidebarRoutePrefetchPaths: () => string[];
  prefetchSidebarRoute: (pathname: string) => void;
  prefetchSidebarRoutes: (paths: string[]) => void;
  scheduleTask: (callback: () => void) => number;
  clearScheduledTask: (handle: number) => void;
  resolveErrorMessage: (error: unknown) => string;
  onBootstrapFailed?: (error: unknown) => void | Promise<void>;
  log: (level: StartupLogLevel, message: string, details?: unknown) => void;
  actions: DesktopBootstrapStateActions;
}

export async function runDesktopBootstrapSequence(
  options: RunDesktopBootstrapSequenceOptions,
): Promise<DesktopBootstrapResult> {
  let warmSidebarRoutesHandle: number | null = null;

  const clearWarmSidebarRoutesTask = () => {
    if (warmSidebarRoutesHandle === null) {
      return;
    }

    options.clearScheduledTask(warmSidebarRoutesHandle);
    warmSidebarRoutesHandle = null;
  };

  const cancelIfRunIsStale = () => {
    if (options.isRunCurrent()) {
      return false;
    }

    clearWarmSidebarRoutesTask();
    return true;
  };

  try {
    await options.revealStartupWindow();
    if (cancelIfRunIsStale()) {
      return 'cancelled';
    }

    options.actions.updateMilestones((current) => ({ ...current, hasWindowPresented: true }));

    await options.connectDesktopRuntime();
    if (cancelIfRunIsStale()) {
      return 'cancelled';
    }

    options.actions.updateMilestones((current) => ({ ...current, hasRuntimeConnected: true }));

    const startupRoute = options.resolveSidebarStartupRoute(options.pathname);
    warmSidebarRoutesHandle = options.scheduleTask(() => {
      if (!options.isRunCurrent()) {
        return;
      }

      const warmRoutes = options
        .listSidebarRoutePrefetchPaths()
        .filter((path) => path !== startupRoute);

      if (warmRoutes.length > 0) {
        options.prefetchSidebarRoutes(warmRoutes);
      }
    });

    options.prefetchSidebarRoute(startupRoute);

    await options.bootstrapShellRuntime();
    if (cancelIfRunIsStale()) {
      return 'cancelled';
    }

    options.actions.updateMilestones((current) => ({ ...current, hasShellBootstrapped: true }));
    options.actions.setShouldRenderShell(true);
    options.actions.setStatus('launching');

    return 'launched';
  } catch (error) {
    clearWarmSidebarRoutesTask();

    if (!options.isRunCurrent()) {
      return 'cancelled';
    }

    await options.onBootstrapFailed?.(error);
    options.log('error', 'Bootstrap failed.', {
      error,
      runId: options.runId,
    });
    options.actions.setStatus('error');
    options.actions.setErrorMessage(options.resolveErrorMessage(error));
    options.actions.setShouldRenderShell(false);
    options.actions.setIsSplashVisible(true);
    return 'failed';
  }
}
