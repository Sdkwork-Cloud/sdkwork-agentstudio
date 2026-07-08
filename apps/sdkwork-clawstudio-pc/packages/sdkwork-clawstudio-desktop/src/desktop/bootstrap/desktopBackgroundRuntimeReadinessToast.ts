import type { StartupAppearanceSnapshot } from './startupPresentation.ts';
import type { BackgroundRuntimeReadinessRecoveryMode } from './desktopBackgroundRuntimeReadinessRecovery.ts';

export const BACKGROUND_RUNTIME_READINESS_TOAST_ID = 'desktop-background-runtime-readiness';

export interface BackgroundRuntimeReadinessNotification {
  runId: number;
  message: string;
  recoveryMode?: BackgroundRuntimeReadinessRecoveryMode;
}

export interface BackgroundRuntimeReadinessToastPlan {
  signature: string;
  toastId: string;
  title: string;
  description: string;
  retryActionLabel: string;
  detailsActionLabel: string;
}

export interface BackgroundRuntimeReadinessToastResetPlan {
  nextSignature: '';
  dismissToastId: string | null;
}

interface ResolveBackgroundRuntimeReadinessToastResetPlanOptions {
  dismissToast?: boolean;
}

interface ResolveBackgroundRuntimeReadinessToastPlanArgs {
  language: StartupAppearanceSnapshot['language'];
  status: 'booting' | 'launching' | 'error';
  shouldRenderShell: boolean;
  currentRunId: number;
  lastShownSignature: string;
  notification: BackgroundRuntimeReadinessNotification | null;
}

export function resolveBackgroundRuntimeReadinessToastCopy(
  message: string,
  language: StartupAppearanceSnapshot['language'],
  recoveryMode: BackgroundRuntimeReadinessRecoveryMode = 'generic-hosted-runtime',
) {
  const normalizedMessage = message.trim();
  if (recoveryMode === 'generic-hosted-runtime') {
    if (language === 'zh') {
      return {
        title: '\u684c\u9762\u8fd0\u884c\u65f6\u5c1a\u672a\u5c31\u7eea',
        description: normalizedMessage
          ? `Claw Studio \u5df2\u6253\u5f00\uff0c\u4f46\u684c\u9762\u8fd0\u884c\u65f6\u7684\u540e\u53f0\u5c31\u7eea\u68c0\u67e5\u672a\u80fd\u5b8c\u6210\u3002\u53ef\u4ee5\u7acb\u5373\u91cd\u8bd5\u68c0\u67e5\uff0c\u6216\u6253\u5f00\u5b9e\u4f8b\u5217\u8868\u68c0\u67e5\u5f53\u524d\u72b6\u6001\u3002\n\n${normalizedMessage}`
          : 'Claw Studio \u5df2\u6253\u5f00\uff0c\u4f46\u684c\u9762\u8fd0\u884c\u65f6\u7684\u540e\u53f0\u5c31\u7eea\u68c0\u67e5\u672a\u80fd\u5b8c\u6210\u3002\u53ef\u4ee5\u7acb\u5373\u91cd\u8bd5\u68c0\u67e5\uff0c\u6216\u6253\u5f00\u5b9e\u4f8b\u5217\u8868\u68c0\u67e5\u5f53\u524d\u72b6\u6001\u3002',
        retryActionLabel: '\u91cd\u8bd5\u68c0\u67e5',
        detailsActionLabel: '\u67e5\u770b\u5b9e\u4f8b',
      };
    }

    return {
      title: 'Desktop runtime is not ready yet',
      description: normalizedMessage
        ? `Claw Studio opened, but desktop runtime readiness did not converge in the background. Retry the check now or open the instances list to inspect the current state.\n\n${normalizedMessage}`
        : 'Claw Studio opened, but desktop runtime readiness did not converge in the background. Retry the check now or open the instances list to inspect the current state.',
      retryActionLabel: 'Retry check',
      detailsActionLabel: 'View instances',
    };
  }

  if (language === 'zh') {
    return {
      title: '\u5185\u7f6e OpenClaw \u5c1a\u672a\u5c31\u7eea',
      description: normalizedMessage
        ? `Claw Studio \u5df2\u6253\u5f00\uff0c\u4f46\u5185\u7f6e OpenClaw \u672a\u80fd\u5728\u540e\u53f0\u5b8c\u6210\u5c31\u7eea\u3002\u53ef\u4ee5\u7acb\u5373\u91cd\u8bd5\uff0c\u6216\u6253\u5f00\u5b9e\u4f8b\u8be6\u60c5\u68c0\u67e5\u65e5\u5fd7\u3002\n\n${normalizedMessage}`
        : 'Claw Studio \u5df2\u6253\u5f00\uff0c\u4f46\u5185\u7f6e OpenClaw \u672a\u80fd\u5728\u540e\u53f0\u5b8c\u6210\u5c31\u7eea\u3002\u53ef\u4ee5\u7acb\u5373\u91cd\u8bd5\uff0c\u6216\u6253\u5f00\u5b9e\u4f8b\u8be6\u60c5\u68c0\u67e5\u65e5\u5fd7\u3002',
      retryActionLabel: '\u7acb\u5373\u91cd\u8bd5',
      detailsActionLabel: '\u67e5\u770b\u8be6\u60c5',
    };
  }

  return {
    title: 'Built-in OpenClaw is not ready yet',
    description: normalizedMessage
      ? `Claw Studio opened, but the built-in OpenClaw runtime did not become ready in the background. Retry it now or open the instance details to inspect logs.\n\n${normalizedMessage}`
      : 'Claw Studio opened, but the built-in OpenClaw runtime did not become ready in the background. Retry it now or open the instance details to inspect logs.',
    retryActionLabel: 'Retry now',
    detailsActionLabel: 'View details',
  };
}

export function resolveBackgroundRuntimeReadinessToastPlan({
  language,
  status,
  shouldRenderShell,
  currentRunId,
  lastShownSignature,
  notification,
}: ResolveBackgroundRuntimeReadinessToastPlanArgs): BackgroundRuntimeReadinessToastPlan | null {
  if (
    !shouldRenderShell ||
    status === 'error' ||
    !notification ||
    notification.runId !== currentRunId
  ) {
    return null;
  }

  const recoveryMode = notification.recoveryMode ?? 'generic-hosted-runtime';
  const signature = `${notification.runId}:${recoveryMode}:${notification.message}`;
  if (lastShownSignature === signature) {
    return null;
  }

  return {
    signature,
    toastId: BACKGROUND_RUNTIME_READINESS_TOAST_ID,
    ...resolveBackgroundRuntimeReadinessToastCopy(
      notification.message,
      language,
      recoveryMode,
    ),
  };
}

export function resolveBackgroundRuntimeReadinessToastResetPlan(
  lastShownSignature: string,
  options?: ResolveBackgroundRuntimeReadinessToastResetPlanOptions,
): BackgroundRuntimeReadinessToastResetPlan | null {
  if (!lastShownSignature) {
    return null;
  }

  return {
    nextSignature: '',
    dismissToastId:
      options?.dismissToast ?? true ? BACKGROUND_RUNTIME_READINESS_TOAST_ID : null,
  };
}
