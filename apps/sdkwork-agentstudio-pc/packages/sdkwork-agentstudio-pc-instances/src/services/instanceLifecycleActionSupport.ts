type TranslateFunction = (key: string) => string;
type LifecycleActionExecutor = (instanceId: string) => Promise<void>;

interface InstanceConsoleTarget {
  url?: string | null;
  autoLoginUrl?: string | null;
  reason?: string | null;
}

export interface InstanceLifecycleActionRequest {
  instanceId: string;
  execute: (instanceId: string) => Promise<void>;
  successKey: string;
  failureKey: string;
}

export interface BuildInstanceLifecycleActionHandlersArgs {
  instanceId: string | undefined;
  runLifecycleAction: (request: InstanceLifecycleActionRequest) => Promise<boolean | void>;
  executeRestart: LifecycleActionExecutor;
  executeStop: LifecycleActionExecutor;
  executeStart: LifecycleActionExecutor;
}

export interface BuildBundledStartupRecoveryHandlerArgs {
  instanceId: string | undefined;
  canRetryBundledStartup: boolean;
  preferRestart: boolean;
  runLifecycleAction: (request: InstanceLifecycleActionRequest) => Promise<boolean | void>;
  executeRestart: LifecycleActionExecutor;
  executeStart: LifecycleActionExecutor;
}

export interface BuildInstanceConsoleHandlersArgs {
  consoleTarget: InstanceConsoleTarget | null | undefined;
  openExternalLink: (href: string) => Promise<void>;
  reportInfo: (message: string) => void;
  reportError: (message: string) => void;
  t: TranslateFunction;
}

export interface BuildInstanceDeleteHandlerArgs {
  instanceId: string | undefined;
  canDelete: boolean;
  activeInstanceId: string | null;
  confirmDelete: (message: string) => boolean;
  executeDelete: LifecycleActionExecutor;
  setActiveInstanceId: (instanceId: string | null) => void;
  navigateToInstances: () => void;
  reportSuccess: (message: string) => void;
  reportError: (message: string) => void;
  t: TranslateFunction;
}

export interface CreateInstanceLifecycleActionRunnerArgs {
  reloadWorkbench: (instanceId: string) => Promise<void>;
  reportSuccess: (message: string) => void;
  reportError: (message: string) => void;
  t: TranslateFunction;
}

export function createInstanceLifecycleActionRunner(
  args: CreateInstanceLifecycleActionRunnerArgs,
) {
  return async (request: InstanceLifecycleActionRequest) => {
    let didSucceed = false;

    try {
      await request.execute(request.instanceId);
      didSucceed = true;
      args.reportSuccess(args.t(request.successKey));
    } catch (error: any) {
      args.reportError(error?.message || args.t(request.failureKey));
    } finally {
      await args.reloadWorkbench(request.instanceId);
    }

    return didSucceed;
  };
}

function createInstanceLifecycleActionHandler(args: {
  instanceId: string | undefined;
  runLifecycleAction: (request: InstanceLifecycleActionRequest) => Promise<boolean | void>;
  execute: LifecycleActionExecutor;
  successKey: string;
  failureKey: string;
}) {
  return async () => {
    if (!args.instanceId) {
      return;
    }

    await args.runLifecycleAction({
      instanceId: args.instanceId,
      execute: args.execute,
      successKey: args.successKey,
      failureKey: args.failureKey,
    });
  };
}

export function buildInstanceLifecycleActionHandlers(
  args: BuildInstanceLifecycleActionHandlersArgs,
) {
  return {
    onRestart: createInstanceLifecycleActionHandler({
      instanceId: args.instanceId,
      runLifecycleAction: args.runLifecycleAction,
      execute: args.executeRestart,
      successKey: 'instances.detail.toasts.restarted',
      failureKey: 'instances.detail.toasts.failedToRestart',
    }),
    onStop: createInstanceLifecycleActionHandler({
      instanceId: args.instanceId,
      runLifecycleAction: args.runLifecycleAction,
      execute: args.executeStop,
      successKey: 'instances.detail.toasts.stopped',
      failureKey: 'instances.detail.toasts.failedToStop',
    }),
    onStart: createInstanceLifecycleActionHandler({
      instanceId: args.instanceId,
      runLifecycleAction: args.runLifecycleAction,
      execute: args.executeStart,
      successKey: 'instances.detail.toasts.started',
      failureKey: 'instances.detail.toasts.failedToStart',
    }),
  };
}

export function buildBundledStartupRecoveryHandler(
  args: BuildBundledStartupRecoveryHandlerArgs,
) {
  return async () => {
    if (!args.instanceId || !args.canRetryBundledStartup) {
      return;
    }

    await args.runLifecycleAction({
      instanceId: args.instanceId,
      execute: args.preferRestart ? args.executeRestart : args.executeStart,
      successKey: 'instances.detail.toasts.retriedBundledStartup',
      failureKey: 'instances.detail.toasts.failedToRetryBundledStartup',
    });
  };
}

export function buildInstanceConsoleHandlers(args: BuildInstanceConsoleHandlersArgs) {
  return {
    onOpenControlPage: async () => {
      const targetUrl = args.consoleTarget?.autoLoginUrl || args.consoleTarget?.url;
      if (!targetUrl) {
        args.reportError(args.t('instances.detail.toasts.failedToOpenControlPage'));
        return;
      }

      try {
        await args.openExternalLink(targetUrl);
        if (!args.consoleTarget?.autoLoginUrl && args.consoleTarget?.reason) {
          args.reportInfo(args.consoleTarget.reason);
        }
      } catch (error: any) {
        args.reportError(error?.message || args.t('instances.detail.toasts.failedToOpenControlPage'));
      }
    },
    onOpenOfficialLink: async (href: string) => {
      await args.openExternalLink(href);
    },
  };
}

export function buildInstanceDeleteHandler(args: BuildInstanceDeleteHandlerArgs) {
  return async () => {
    if (!args.instanceId || !args.canDelete) {
      return;
    }

    if (!args.confirmDelete(args.t('instances.detail.confirmUninstall'))) {
      return;
    }

    try {
      await args.executeDelete(args.instanceId);
      args.reportSuccess(args.t('instances.detail.toasts.uninstalled'));
      if (args.activeInstanceId === args.instanceId) {
        args.setActiveInstanceId(null);
      }
      args.navigateToInstances();
    } catch (error: any) {
      args.reportError(error?.message || args.t('instances.detail.toasts.failedToUninstall'));
    }
  };
}
