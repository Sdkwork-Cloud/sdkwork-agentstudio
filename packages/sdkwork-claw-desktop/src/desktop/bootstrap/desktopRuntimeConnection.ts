import type {
  DesktopAppInfo,
  DesktopAppPaths,
  DesktopHostedRuntimeReadinessSnapshot,
  DesktopKernelInfo,
} from '../tauriBridge';

type StartupLogLevel = 'info' | 'warn' | 'error';

export interface DesktopRuntimeConnectionBaseContext {
  appInfo: DesktopAppInfo | null;
  appPaths: DesktopAppPaths | null;
}

export interface DesktopRuntimeConnectionReadyContext
  extends DesktopRuntimeConnectionBaseContext {
  readinessSnapshot: DesktopHostedRuntimeReadinessSnapshot;
  localAiProxy: DesktopKernelInfo['localAiProxy'] | null;
}

export interface DesktopRuntimeConnectionFailureContext
  extends DesktopRuntimeConnectionBaseContext {
  error: unknown;
  localAiProxy: DesktopKernelInfo['localAiProxy'] | null;
}

export interface DesktopRuntimeConnectionOptions {
  isTauriRuntime: () => boolean;
  getAppInfo: () => Promise<DesktopAppInfo | null>;
  getAppPaths: () => Promise<DesktopAppPaths | null>;
  probeHostedRuntimeReadiness: () => Promise<DesktopHostedRuntimeReadinessSnapshot>;
  blockOnReadiness?: boolean;
  captureLocalAiProxyEvidence: () => Promise<DesktopKernelInfo['localAiProxy'] | null>;
  onBaseContext: (
    context: DesktopRuntimeConnectionBaseContext,
  ) => Promise<void> | void;
  onReadinessReady: (
    context: DesktopRuntimeConnectionReadyContext,
  ) => Promise<void> | void;
  onReadinessFailed: (
    context: DesktopRuntimeConnectionFailureContext,
  ) => Promise<void> | void;
  log?: (level: StartupLogLevel, message: string, details?: unknown) => void;
}

async function notifyHostedRuntimeReadiness(
  options: DesktopRuntimeConnectionOptions,
  baseContext: DesktopRuntimeConnectionBaseContext,
): Promise<void> {
  try {
    const readinessSnapshot = await options.probeHostedRuntimeReadiness();
    const localAiProxy = await captureLocalAiProxyEvidence(options);

    await options.onReadinessReady({
      ...baseContext,
      readinessSnapshot,
      localAiProxy,
    });
  } catch (error) {
    const localAiProxy = await captureLocalAiProxyEvidence(options);

    await options.onReadinessFailed({
      ...baseContext,
      error,
      localAiProxy,
    });
    throw error;
  }
}

async function captureLocalAiProxyEvidence(
  options: DesktopRuntimeConnectionOptions,
): Promise<DesktopKernelInfo['localAiProxy'] | null> {
  try {
    return await options.captureLocalAiProxyEvidence();
  } catch (error) {
    options.log?.(
      'warn',
      'Local AI proxy evidence capture failed during desktop runtime startup; continuing with null evidence.',
      { error },
    );
    return null;
  }
}

export async function connectDesktopRuntimeDuringStartup(
  options: DesktopRuntimeConnectionOptions,
): Promise<void> {
  const [appInfo, appPaths] = await Promise.all([
    options.getAppInfo(),
    options.getAppPaths(),
  ]);
  const baseContext = {
    appInfo,
    appPaths,
  };

  await options.onBaseContext(baseContext);

  if (options.isTauriRuntime() && !appInfo) {
    throw new Error('The desktop runtime did not respond during startup.');
  }

  if (!options.isTauriRuntime()) {
    return;
  }

  options.log?.(
    'info',
    options.blockOnReadiness === false
      ? 'Desktop runtime metadata connected. Continuing shell launch while hosted runtime readiness is checked in the background.'
      : 'Desktop runtime metadata connected. Waiting for hosted runtime readiness before launching the shell.',
  );

  if (options.blockOnReadiness === false) {
    void notifyHostedRuntimeReadiness(options, baseContext).catch((error) => {
      options.log?.('warn', 'Hosted runtime readiness finished with a background failure.', {
        error,
      });
    });
    return;
  }

  await notifyHostedRuntimeReadiness(options, baseContext);
}
