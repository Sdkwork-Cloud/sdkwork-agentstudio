import type { StartupAppearanceSnapshot } from './startupPresentation.ts';

export type BackgroundRuntimeReadinessRecoveryMode =
  | 'managed-openclaw'
  | 'generic-hosted-runtime';

export const BACKGROUND_RUNTIME_READINESS_AUTO_RECOVERY_DELAY_MS = 1200;
export const BACKGROUND_RUNTIME_READINESS_AUTO_RECOVERY_MAX_ATTEMPTS = 2;

export interface BackgroundRuntimeReadinessRecoveryToastCopy {
  retryActionLabel: string;
  detailsActionLabel: string;
  loadingTitle: string;
  loadingDescription: string;
  startedTitle: string;
  startedDescription: string;
  failedTitle: string;
  readyTitle: string;
  readyDescription: string;
}

export interface StartupRuntimeReadinessRetryRecoveryRequest {
  recoveryMode: BackgroundRuntimeReadinessRecoveryMode;
  instanceId: string | null;
}

export interface BackgroundRuntimeReadinessAutoRecoveryPlan {
  signature: string;
  nextAttemptCount: number;
  delayMs: number;
}

interface RetryBackgroundRuntimeReadinessRecoveryArgs {
  recoveryMode?: BackgroundRuntimeReadinessRecoveryMode;
  instanceId?: string | null;
  clearFailureState: () => void;
  restartInstance: (instanceId: string) => Promise<unknown>;
  ensureDesktopKernelRunning: () => Promise<unknown>;
  reconnectHostedRuntimeReadiness: () => Promise<void>;
}

interface PlanStartupRuntimeReadinessRetryRecoveryArgs {
  runtimeReadinessFailed: boolean;
  recoveryMode?: BackgroundRuntimeReadinessRecoveryMode;
  instanceId?: string | null;
}

interface PlanBackgroundRuntimeReadinessAutoRecoveryArgs {
  currentRunId: number;
  status: 'booting' | 'launching' | 'error';
  shouldRenderShell: boolean;
  notification: {
    runId: number;
    message: string;
    recoveryMode?: BackgroundRuntimeReadinessRecoveryMode;
  } | null;
  recoveryInFlight: boolean;
  attemptCount: number;
  pendingSignature: string;
  maxAttempts?: number;
  delayMs?: number;
}

interface RunStartupRuntimeReadinessRetryRecoveryArgs {
  request: StartupRuntimeReadinessRetryRecoveryRequest | null;
  clearFailureState: () => void;
  restartInstance: (instanceId: string) => Promise<unknown>;
  ensureDesktopKernelRunning: () => Promise<unknown>;
}

interface ResolveBackgroundRuntimeReadinessRecoveryToastCopyOptions {
  recoveryMode?: BackgroundRuntimeReadinessRecoveryMode;
}

function normalizeOptionalInstanceId(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeKernelId(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

export function resolveBackgroundRuntimeReadinessRecoveryMode(
  includedKernelIds: readonly string[] | null | undefined,
): BackgroundRuntimeReadinessRecoveryMode {
  if (!includedKernelIds?.length) {
    return 'generic-hosted-runtime';
  }

  return includedKernelIds.some((kernelId) => normalizeKernelId(kernelId) === 'openclaw')
    ? 'managed-openclaw'
    : 'generic-hosted-runtime';
}

export function planBackgroundRuntimeReadinessAutoRecovery({
  currentRunId,
  status,
  shouldRenderShell,
  notification,
  recoveryInFlight,
  attemptCount,
  pendingSignature,
  maxAttempts = BACKGROUND_RUNTIME_READINESS_AUTO_RECOVERY_MAX_ATTEMPTS,
  delayMs = BACKGROUND_RUNTIME_READINESS_AUTO_RECOVERY_DELAY_MS,
}: PlanBackgroundRuntimeReadinessAutoRecoveryArgs): BackgroundRuntimeReadinessAutoRecoveryPlan | null {
  if (
    !shouldRenderShell
    || status === 'error'
    || recoveryInFlight
    || !notification
    || notification.runId !== currentRunId
  ) {
    return null;
  }

  if (attemptCount >= Math.max(0, maxAttempts)) {
    return null;
  }

  const recoveryMode = notification.recoveryMode ?? 'generic-hosted-runtime';
  const normalizedMessage = notification.message.trim();
  const signature = `${notification.runId}:${recoveryMode}:${normalizedMessage}`;
  if (signature === pendingSignature) {
    return null;
  }

  return {
    signature,
    nextAttemptCount: attemptCount + 1,
    delayMs: Math.max(0, delayMs),
  };
}

export function planStartupRuntimeReadinessRetryRecovery({
  runtimeReadinessFailed,
  recoveryMode = 'generic-hosted-runtime',
  instanceId,
}: PlanStartupRuntimeReadinessRetryRecoveryArgs): StartupRuntimeReadinessRetryRecoveryRequest | null {
  if (!runtimeReadinessFailed) {
    return null;
  }

  return {
    recoveryMode,
    instanceId: normalizeOptionalInstanceId(instanceId),
  };
}

export async function retryBackgroundRuntimeReadinessRecovery({
  recoveryMode = 'generic-hosted-runtime',
  instanceId,
  clearFailureState,
  restartInstance,
  ensureDesktopKernelRunning,
  reconnectHostedRuntimeReadiness,
}: RetryBackgroundRuntimeReadinessRecoveryArgs): Promise<void> {
  clearFailureState();

  if (recoveryMode === 'managed-openclaw') {
    if (instanceId) {
      const restartedInstance = await restartInstance(instanceId);
      if (restartedInstance) {
        await reconnectHostedRuntimeReadiness();
        return;
      }
    }

    await ensureDesktopKernelRunning();
  }

  if (recoveryMode === 'generic-hosted-runtime') {
    await ensureDesktopKernelRunning();
  }

  await reconnectHostedRuntimeReadiness();
}

export async function runStartupRuntimeReadinessRetryRecovery({
  request,
  clearFailureState,
  restartInstance,
  ensureDesktopKernelRunning,
}: RunStartupRuntimeReadinessRetryRecoveryArgs): Promise<boolean> {
  if (!request) {
    return false;
  }

  await retryBackgroundRuntimeReadinessRecovery({
    recoveryMode: request.recoveryMode,
    instanceId: request.instanceId,
    clearFailureState,
    restartInstance,
    ensureDesktopKernelRunning,
    reconnectHostedRuntimeReadiness: async () => {},
  });

  return true;
}

export function resolveBackgroundRuntimeReadinessRecoveryToastCopy(
  language: StartupAppearanceSnapshot['language'],
  options?: ResolveBackgroundRuntimeReadinessRecoveryToastCopyOptions,
): BackgroundRuntimeReadinessRecoveryToastCopy {
  if (options?.recoveryMode !== 'managed-openclaw') {
    if (language === 'zh') {
      return {
        retryActionLabel: '\u91cd\u8bd5\u68c0\u67e5',
        detailsActionLabel: '\u67e5\u770b\u5b9e\u4f8b',
        loadingTitle: '\u6b63\u5728\u91cd\u8bd5\u684c\u9762\u8fd0\u884c\u65f6\u68c0\u67e5',
        loadingDescription:
          'Claw Studio \u6b63\u5728\u91cd\u65b0\u68c0\u67e5\u684c\u9762\u8fd0\u884c\u65f6\u7684\u540e\u53f0\u5c31\u7eea\u72b6\u6001\u3002',
        startedTitle: '\u5df2\u91cd\u65b0\u53d1\u8d77\u684c\u9762\u8fd0\u884c\u65f6\u68c0\u67e5',
        startedDescription:
          'Claw Studio \u5df2\u91cd\u65b0\u53d1\u8d77\u684c\u9762\u8fd0\u884c\u65f6\u5c31\u7eea\u68c0\u67e5\uff0c\u540e\u53f0\u91cd\u8bd5\u4ecd\u5728\u8fdb\u884c\u3002',
        failedTitle: '\u684c\u9762\u8fd0\u884c\u65f6\u91cd\u8bd5\u5931\u8d25',
        readyTitle: '\u684c\u9762\u8fd0\u884c\u65f6\u5df2\u5c31\u7eea',
        readyDescription:
          'Claw Studio \u5df2\u786e\u8ba4\u684c\u9762\u8fd0\u884c\u65f6\u540e\u53f0\u5c31\u7eea\u72b6\u6001\u5df2\u6062\u590d\u3002',
      };
    }

    return {
      retryActionLabel: 'Retry check',
      detailsActionLabel: 'View instances',
      loadingTitle: 'Retrying desktop runtime checks',
      loadingDescription:
        'Claw Studio is re-checking desktop runtime readiness in the background.',
      startedTitle: 'Desktop runtime retry requested',
      startedDescription:
        'Claw Studio started another desktop runtime readiness check in the background.',
      failedTitle: 'Desktop runtime retry failed',
      readyTitle: 'Desktop runtime is ready',
      readyDescription:
        'Claw Studio confirmed the desktop runtime readiness checks recovered successfully.',
    };
  }

  if (language === 'zh') {
    return {
      retryActionLabel: '\u7acb\u5373\u91cd\u8bd5',
      detailsActionLabel: '\u67e5\u770b\u8be6\u60c5',
      loadingTitle: '\u6b63\u5728\u91cd\u8bd5\u5185\u7f6e OpenClaw',
      loadingDescription:
        'Claw Studio \u6b63\u5728\u91cd\u542f\u5185\u7f6e OpenClaw \u5e76\u91cd\u65b0\u68c0\u67e5\u540e\u53f0\u5c31\u7eea\u72b6\u6001\u3002',
      startedTitle: '\u5df2\u8bf7\u6c42\u91cd\u8bd5\u5185\u7f6e OpenClaw',
      startedDescription:
        'Claw Studio \u5df2\u53d1\u8d77\u5185\u7f6e OpenClaw \u91cd\u542f\uff0c\u540e\u53f0\u5c31\u7eea\u68c0\u67e5\u4ecd\u5728\u7ee7\u7eed\u3002',
      failedTitle: '\u5185\u7f6e OpenClaw \u91cd\u8bd5\u5931\u8d25',
      readyTitle: '\u5185\u7f6e OpenClaw \u5df2\u7ecf\u5c31\u7eea',
      readyDescription:
        'Claw Studio \u5df2\u786e\u8ba4\u5185\u7f6e OpenClaw \u7f51\u5173\u6062\u590d\u53ef\u7528\uff0c\u73b0\u5728\u53ef\u4ee5\u76f4\u63a5\u4f7f\u7528\u3002',
    };
  }

  return {
    retryActionLabel: 'Retry now',
    detailsActionLabel: 'View details',
    loadingTitle: 'Retrying built-in OpenClaw',
    loadingDescription:
      'Claw Studio is restarting the built-in OpenClaw runtime and re-checking background readiness.',
    startedTitle: 'Built-in OpenClaw retry requested',
    startedDescription:
      'Claw Studio restarted the built-in OpenClaw runtime. Background readiness checks are running again.',
    failedTitle: 'Built-in OpenClaw retry failed',
    readyTitle: 'Built-in OpenClaw is ready',
    readyDescription:
      'Claw Studio confirmed the built-in OpenClaw gateway is available again and ready to use.',
  };
}
