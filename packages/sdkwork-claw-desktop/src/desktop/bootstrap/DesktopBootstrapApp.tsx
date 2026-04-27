import {
  Component,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import {
  AppProviders,
  MainLayout,
  ROUTE_PATHS,
  bootstrapShellRuntime,
  listSidebarRoutePrefetchPaths,
  prefetchSidebarRoute,
  prefetchSidebarRoutes,
  resolveSidebarStartupRoute,
} from '@sdkwork/claw-shell';
import type { DistributionId } from '@sdkwork/claw-distribution';
import { getDistributionManifest } from '@sdkwork/claw-distribution';
import type { RuntimeLanguagePreference } from '@sdkwork/claw-infrastructure';
import { toast } from 'sonner';
import { getDesktopWindow, isTauriRuntime } from '../runtime';
import {
  getAppInfo,
  getAppPaths,
  getDesktopKernelInfo,
  ensureDesktopKernelRunning,
  isDesktopHostedRuntimeReadinessError,
  probeDesktopHostedRuntimeReadiness,
  setAppLanguage,
  studioRestartInstance,
  writeTextFile,
  type DesktopAppInfo,
  type DesktopAppPaths,
  type DesktopHostedRuntimeReadinessSnapshot,
  type DesktopKernelInfo,
} from '../tauriBridge';
import { DesktopProviders } from '../providers/DesktopProviders';
import { resolveBuiltInOpenClawInstance } from '../builtInOpenClawInstanceSelection.ts';
import { DesktopStartupScreen } from './DesktopStartupScreen';
import { DesktopTrayRouteBridge } from './DesktopTrayRouteBridge';
import { connectDesktopRuntimeDuringStartup } from './desktopRuntimeConnection';
import {
  buildDesktopStartupEvidenceDocument,
  DESKTOP_STARTUP_EVIDENCE_RELATIVE_PATH,
  resolvePassingDesktopStartupEvidencePhase,
  serializeDesktopStartupEvidence,
  shouldPersistShellMountedDesktopStartupEvidence,
  type DesktopStartupEvidencePhase,
  type DesktopStartupEvidenceStatus,
} from './desktopStartupEvidence';
import {
  getStartupMinimumWaitMs,
  getStartupProgressModel,
  readStartupAppearanceSnapshot,
  resolveStartupBootstrapStage,
  type StartupAppearanceSnapshot,
  type StartupMilestoneSnapshot,
} from './startupPresentation';
import {
  INITIAL_DESKTOP_STARTUP_MILESTONES,
  runDesktopBootstrapSequence,
  type DesktopBootstrapStateActions,
} from './desktopBootstrapRuntime';
import {
  planBackgroundRuntimeReadinessAutoRecovery,
  planStartupRuntimeReadinessRetryRecovery,
  resolveBackgroundRuntimeReadinessRecoveryMode,
  resolveBackgroundRuntimeReadinessRecoveryToastCopy,
  runStartupRuntimeReadinessRetryRecovery,
  retryBackgroundRuntimeReadinessRecovery,
  type BackgroundRuntimeReadinessRecoveryMode,
  type StartupRuntimeReadinessRetryRecoveryRequest,
} from './desktopBackgroundRuntimeReadinessRecovery';
import {
  BACKGROUND_RUNTIME_READINESS_TOAST_ID,
  resolveBackgroundRuntimeReadinessToastPlan,
  resolveBackgroundRuntimeReadinessToastResetPlan,
  type BackgroundRuntimeReadinessNotification,
} from './desktopBackgroundRuntimeReadinessToast';

const APP_STORAGE_KEY = 'claw-studio-app-storage';
const SPLASH_MINIMUM_VISIBLE_MS = 180;
const SPLASH_EXIT_DURATION_MS = 120;
const STARTUP_LOG_PREFIX = '[desktop-startup]';

interface DesktopBootstrapAppProps {
  appName: string;
  initialAppearance: StartupAppearanceSnapshot;
}

type StartupLogLevel = 'info' | 'warn' | 'error';

interface DesktopStartupEvidenceContext {
  appInfo: DesktopAppInfo | null;
  appPaths: DesktopAppPaths | null;
  bundledComponents: DesktopKernelInfo['bundledComponents'] | null;
  readinessSnapshot: DesktopHostedRuntimeReadinessSnapshot | null;
  localAiProxy: DesktopKernelInfo['localAiProxy'] | null;
}

function resolveBuiltInOpenClawInstanceFromSnapshot(
  readinessSnapshot: DesktopHostedRuntimeReadinessSnapshot | null | undefined,
) {
  return resolveBuiltInOpenClawInstance(readinessSnapshot?.instances, {
    preferredInstanceId: readinessSnapshot?.evidence?.builtInInstanceId ?? null,
    gatewayBaseUrl: readinessSnapshot?.openClawGateway?.baseUrl ?? null,
    gatewayWebsocketUrl: readinessSnapshot?.openClawGateway?.websocketUrl ?? null,
  });
}

function resolveBuiltInOpenClawInstanceIdFromSnapshot(
  readinessSnapshot: DesktopHostedRuntimeReadinessSnapshot | null | undefined,
) {
  return resolveBuiltInOpenClawInstanceFromSnapshot(readinessSnapshot)?.id ?? null;
}

function resolveErrorMessage(error: unknown, language: StartupAppearanceSnapshot['language']) {
  const fallback =
    language === 'zh'
      ? '\u65e0\u6cd5\u5b8c\u6210\u684c\u9762\u5de5\u4f5c\u53f0\u521d\u59cb\u5316\uff0c\u8bf7\u68c0\u67e5\u8fd0\u884c\u73af\u5883\u540e\u91cd\u8bd5\u3002'
      : 'The desktop workspace could not be initialized. Review the runtime and try again.';

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return fallback;
}

function waitForNextPaint() {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        resolve();
      });
      return;
    }

    window.setTimeout(resolve, 16);
  });
}

function waitFor(ms: number) {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function writeStartupLog(
  level: StartupLogLevel,
  runId: number,
  elapsedMs: number,
  message: string,
  details?: unknown,
) {
  const logger =
    level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
  const prefix = `${STARTUP_LOG_PREFIX}[run:${runId}][${elapsedMs}ms] ${message}`;

  if (typeof details === 'undefined') {
    logger(prefix);
    return;
  }

  logger(prefix, details);
}

interface DesktopShellErrorBoundaryProps {
  resetKey: number;
  onError: (error: Error) => void;
  children: ReactNode;
}

interface DesktopShellErrorBoundaryState {
  hasError: boolean;
}

class DesktopShellErrorBoundary extends Component<
  DesktopShellErrorBoundaryProps,
  DesktopShellErrorBoundaryState
> {
  state: DesktopShellErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): DesktopShellErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, _errorInfo: ErrorInfo) {
    this.props.onError(error);
  }

  componentDidUpdate(prevProps: DesktopShellErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return null;
    }

    return this.props.children;
  }
}

export function readInitialStartupAppearance() {
  if (typeof window === 'undefined') {
    return readStartupAppearanceSnapshot({
      storageValue: null,
      browserLanguage: 'en',
      prefersDark: false,
    });
  }

  let storageValue: string | null = null;

  try {
    storageValue = window.localStorage.getItem(APP_STORAGE_KEY);
  } catch {
    storageValue = null;
  }

  return readStartupAppearanceSnapshot({
    storageValue,
    browserLanguage: window.navigator.language,
    prefersDark: window.matchMedia('(prefers-color-scheme: dark)').matches,
  });
}

export function applyStartupAppearanceHints(appearance: StartupAppearanceSnapshot) {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  root.setAttribute('lang', appearance.language);
  document.body.style.backgroundColor = '#12090a';
  document.body.style.color = '#fff1f2';
}

function openDesktopShellRoute(pathname: string) {
  if (typeof window === 'undefined') {
    return;
  }

  if (window.location.pathname !== pathname) {
    window.history.pushState({}, '', pathname);
  }

  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function DesktopBootstrapApp({
  appName,
  initialAppearance,
}: DesktopBootstrapAppProps) {
  const [appearance] = useState(initialAppearance);
  const [retrySeed, setRetrySeed] = useState(0);
  const [milestones, setMilestones] = useState<StartupMilestoneSnapshot>(
    INITIAL_DESKTOP_STARTUP_MILESTONES,
  );
  const [shouldRenderShell, setShouldRenderShell] = useState(false);
  const [isSplashVisible, setIsSplashVisible] = useState(true);
  const [status, setStatus] = useState<'booting' | 'launching' | 'error'>('booting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [backgroundRuntimeReadinessNotification, setBackgroundRuntimeReadinessNotification] =
    useState<BackgroundRuntimeReadinessNotification | null>(null);
  const milestonesRef = useRef(milestones);
  const startedAtRef = useRef(Date.now());
  const bootRunIdRef = useRef(0);
  const splashHandoffRunIdRef = useRef(0);
  const stageLogSignatureRef = useRef('');
  const startupEvidenceContextRef = useRef<DesktopStartupEvidenceContext | null>(null);
  const startupEvidenceSignatureRef = useRef('');
  const backgroundRuntimeReadinessNotificationSignatureRef = useRef('');
  const backgroundRuntimeReadinessAutoRecoveryPendingSignatureRef = useRef('');
  const backgroundRuntimeReadinessAutoRecoveryAttemptCountRef = useRef(0);
  const backgroundRuntimeReadinessAutoRecoveryTimerRef = useRef<number | null>(null);
  const backgroundRuntimeReadinessRecoveryPendingRef = useRef(false);
  const backgroundRuntimeReadinessRecoveryInFlightRef = useRef(false);
  const backgroundRuntimeReadinessRecoveryModeRef =
    useRef<BackgroundRuntimeReadinessRecoveryMode>('generic-hosted-runtime');
  const startupRuntimeReadinessRetryRecoveryRequestRef =
    useRef<StartupRuntimeReadinessRetryRecoveryRequest | null>(null);
  const runtimeReadinessFailureRef = useRef(false);

  const stage = useMemo(
    () => resolveStartupBootstrapStage(milestones),
    [milestones],
  );
  const progress = useMemo(
    () =>
      getStartupProgressModel({
        milestones,
        language: appearance.language,
      }),
    [appearance.language, milestones],
  );

  useEffect(() => {
    milestonesRef.current = milestones;
  }, [milestones]);

  const logStartup = useEffectEvent(
    (level: StartupLogLevel, message: string, details?: unknown, runId = bootRunIdRef.current) => {
      writeStartupLog(level, runId, Math.max(0, Date.now() - startedAtRef.current), message, details);
    },
  );

  const persistStartupEvidence = useEffectEvent(
    async ({
      status,
      phase,
      appInfo,
      appPaths,
      bundledComponents,
      readinessSnapshot,
      localAiProxy,
      error,
      runId = bootRunIdRef.current,
    }: {
      status: DesktopStartupEvidenceStatus;
      phase: DesktopStartupEvidencePhase;
      appInfo?: DesktopAppInfo | null;
      appPaths?: DesktopAppPaths | null;
      bundledComponents?: DesktopKernelInfo['bundledComponents'] | null;
      readinessSnapshot?: DesktopHostedRuntimeReadinessSnapshot | null;
      localAiProxy?: DesktopKernelInfo['localAiProxy'] | null;
      error?: unknown;
      runId?: number;
    }) => {
      if (!isTauriRuntime()) {
        return;
      }

      const context = startupEvidenceContextRef.current;
      const document = buildDesktopStartupEvidenceDocument({
        status,
        phase,
        runId,
        durationMs: Date.now() - startedAtRef.current,
        appInfo: appInfo ?? context?.appInfo ?? null,
        bundledComponents: bundledComponents ?? context?.bundledComponents ?? null,
        appPaths: appPaths ?? context?.appPaths ?? null,
        readinessSnapshot: readinessSnapshot ?? context?.readinessSnapshot ?? null,
        localAiProxy: localAiProxy ?? context?.localAiProxy ?? null,
        error,
      });
      const signature = `${document.runId}:${document.status}:${document.phase}`;

      if (startupEvidenceSignatureRef.current === signature) {
        return;
      }

      try {
        await writeTextFile(
          DESKTOP_STARTUP_EVIDENCE_RELATIVE_PATH,
          serializeDesktopStartupEvidence(document),
        );
        startupEvidenceSignatureRef.current = signature;
        logStartup('info', 'Persisted desktop startup evidence.', {
          evidencePath: DESKTOP_STARTUP_EVIDENCE_RELATIVE_PATH,
          status: document.status,
          phase: document.phase,
          packageProfileId: document.bundledComponents?.packageProfileId ?? null,
          includedKernelIds: document.bundledComponents?.includedKernelIds ?? [],
          descriptorBrowserBaseUrl: document.descriptor?.browserBaseUrl ?? null,
          builtInInstanceStatus: document.builtInInstance?.status ?? null,
          localAiProxyLifecycle: document.localAiProxy?.lifecycle ?? null,
          localAiProxySnapshotPath: document.localAiProxy?.snapshotPath ?? null,
          localAiProxyLogPath: document.localAiProxy?.logPath ?? null,
          readinessReady: document.readinessEvidence?.ready ?? null,
        }, runId);
      } catch (persistenceError) {
        logStartup('warn', 'Persisting desktop startup evidence failed.', {
          evidencePath: DESKTOP_STARTUP_EVIDENCE_RELATIVE_PATH,
          status,
          phase,
          error: persistenceError,
        }, runId);
      }
    },
  );

  useEffect(() => {
    const signature = `${bootRunIdRef.current}:${stage}:${status}:${progress.progress}`;
    if (stageLogSignatureRef.current === signature) {
      return;
    }

    stageLogSignatureRef.current = signature;
    logStartup('info', `Stage changed to "${stage}"`, {
      status,
      progress: progress.progress,
      isSplashVisible,
      shouldRenderShell,
      milestones,
    });
  }, [isSplashVisible, logStartup, milestones, progress.progress, shouldRenderShell, stage, status]);

  useEffect(() => {
    if (
      stage !== 'ready' ||
      status === 'error' ||
      splashHandoffRunIdRef.current === bootRunIdRef.current
    ) {
      return;
    }

    const runId = bootRunIdRef.current;
    splashHandoffRunIdRef.current = runId;
    let cancelled = false;

    void (async () => {
      logStartup('info', 'Startup marked ready. Waiting for splash handoff.', undefined, runId);
      await waitFor(
        getStartupMinimumWaitMs({
          currentTimeMs: Date.now(),
          startedAtMs: startedAtRef.current,
          minimumVisibleMs: SPLASH_MINIMUM_VISIBLE_MS,
        }),
      );
      if (cancelled || bootRunIdRef.current !== runId) {
        return;
      }

      logStartup('info', 'Hiding splash screen.', undefined, runId);
      setIsSplashVisible(false);
      await waitFor(SPLASH_EXIT_DURATION_MS);
      if (cancelled || bootRunIdRef.current !== runId) {
        return;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [stage, status]);

  const handleShellRenderError = useEffectEvent((error: Error) => {
    const runId = bootRunIdRef.current;
    logStartup('error', 'Shell render failed.', error);
    void persistStartupEvidence({
      status: 'failed',
      phase: 'shell-render-failed',
      error,
      runId,
    });
    bootRunIdRef.current += 1;
    setStatus('error');
    setErrorMessage(resolveErrorMessage(error, appearance.language));
    setShouldRenderShell(false);
    setIsSplashVisible(true);
    setMilestones((current) =>
      current.hasShellMounted ? { ...current, hasShellMounted: false } : current,
    );
  });

  const handleLanguagePreferenceChange = useEffectEvent(
    (languagePreference: RuntimeLanguagePreference) => {
      void setAppLanguage(languagePreference);
    },
  );

  const bootstrapStateActions = useMemo<DesktopBootstrapStateActions>(
    () => ({
      updateMilestones(updater) {
        setMilestones((current) => updater(current));
      },
      setStatus,
      setErrorMessage,
      setShouldRenderShell,
      setIsSplashVisible,
    }),
    [],
  );

  useEffect(() => {
    if (!shouldRenderShell || status !== 'launching' || milestones.hasShellMounted) {
      return;
    }

    const runId = bootRunIdRef.current;
    logStartup('info', 'Shell render committed.', undefined, runId);
    if (shouldPersistShellMountedDesktopStartupEvidence({
      runtimeReadinessFailed: runtimeReadinessFailureRef.current,
      readinessSnapshot: startupEvidenceContextRef.current?.readinessSnapshot ?? null,
    })) {
      void persistStartupEvidence({
        status: 'passed',
        phase: 'shell-mounted',
        runId,
      });
    }
    setMilestones((current) =>
      current.hasShellMounted ? current : { ...current, hasShellMounted: true },
    );
  }, [milestones.hasShellMounted, shouldRenderShell, status]);

  const openBackgroundRuntimeDetails = useEffectEvent(() => {
    const builtInInstanceId = resolveBuiltInOpenClawInstanceIdFromSnapshot(
      startupEvidenceContextRef.current?.readinessSnapshot,
    );
    openDesktopShellRoute(
      builtInInstanceId
        ? `${ROUTE_PATHS.INSTANCES}/${builtInInstanceId}`
        : ROUTE_PATHS.INSTANCES,
    );
  });

  const clearBackgroundRuntimeReadinessAutoRecoveryTimer = useEffectEvent(() => {
    if (!backgroundRuntimeReadinessAutoRecoveryTimerRef.current) {
      backgroundRuntimeReadinessAutoRecoveryPendingSignatureRef.current = '';
      return;
    }

    window.clearTimeout(backgroundRuntimeReadinessAutoRecoveryTimerRef.current);
    backgroundRuntimeReadinessAutoRecoveryTimerRef.current = null;
    backgroundRuntimeReadinessAutoRecoveryPendingSignatureRef.current = '';
  });

  const scheduleBackgroundRuntimeReadinessAutoRecovery = useEffectEvent((
    notification: BackgroundRuntimeReadinessNotification | null,
  ) => {
    const recoveryPlan = planBackgroundRuntimeReadinessAutoRecovery({
      currentRunId: bootRunIdRef.current,
      status,
      shouldRenderShell,
      notification,
      recoveryInFlight: backgroundRuntimeReadinessRecoveryInFlightRef.current,
      attemptCount: backgroundRuntimeReadinessAutoRecoveryAttemptCountRef.current,
      pendingSignature: backgroundRuntimeReadinessAutoRecoveryPendingSignatureRef.current,
    });
    if (!recoveryPlan) {
      return;
    }

    clearBackgroundRuntimeReadinessAutoRecoveryTimer();
    backgroundRuntimeReadinessAutoRecoveryPendingSignatureRef.current = recoveryPlan.signature;
    backgroundRuntimeReadinessAutoRecoveryTimerRef.current = window.setTimeout(() => {
      backgroundRuntimeReadinessAutoRecoveryTimerRef.current = null;
      backgroundRuntimeReadinessAutoRecoveryPendingSignatureRef.current = '';
      backgroundRuntimeReadinessAutoRecoveryAttemptCountRef.current =
        recoveryPlan.nextAttemptCount;
      void retryBackgroundRuntimeReadiness();
    }, recoveryPlan.delayMs);
  });

  const clearBackgroundRuntimeReadinessFailureState = useEffectEvent((options?: {
    dismissToast?: boolean;
  }) => {
    clearBackgroundRuntimeReadinessAutoRecoveryTimer();
    const resetPlan = resolveBackgroundRuntimeReadinessToastResetPlan(
      backgroundRuntimeReadinessNotificationSignatureRef.current,
      options,
    );
    backgroundRuntimeReadinessNotificationSignatureRef.current = resetPlan?.nextSignature ?? '';
    if (resetPlan?.dismissToastId) {
      toast.dismiss(resetPlan.dismissToastId);
    }
    setBackgroundRuntimeReadinessNotification(null);
  });

  const retryBackgroundRuntimeReadiness = useEffectEvent(async () => {
    const runId = bootRunIdRef.current;
    if (
      backgroundRuntimeReadinessRecoveryInFlightRef.current ||
      status === 'error' ||
      !shouldRenderShell
    ) {
      return;
    }

    const recoveryMode = backgroundRuntimeReadinessRecoveryModeRef.current;
    const retryCopy = resolveBackgroundRuntimeReadinessRecoveryToastCopy(appearance.language, {
      recoveryMode,
    });
    backgroundRuntimeReadinessRecoveryInFlightRef.current = true;
    backgroundRuntimeReadinessRecoveryPendingRef.current = true;

    const retryToastId = BACKGROUND_RUNTIME_READINESS_TOAST_ID;
    toast.loading(retryCopy.loadingTitle, {
      id: retryToastId,
      description: retryCopy.loadingDescription,
      duration: Infinity,
      cancel: {
        label: retryCopy.detailsActionLabel,
        onClick: () => {
          openBackgroundRuntimeDetails();
        },
      },
    });

    try {
      const builtInInstanceId = resolveBuiltInOpenClawInstanceIdFromSnapshot(
        startupEvidenceContextRef.current?.readinessSnapshot,
      );

      logStartup(
        'info',
        recoveryMode === 'managed-openclaw'
          ? 'Retrying built-in OpenClaw background startup from the desktop shell.'
          : 'Retrying hosted desktop runtime readiness from the desktop shell.',
        undefined,
        runId,
      );
      await retryBackgroundRuntimeReadinessRecovery({
        recoveryMode,
        instanceId: builtInInstanceId,
        clearFailureState: () => {
          clearBackgroundRuntimeReadinessFailureState({ dismissToast: false });
        },
        restartInstance: async (instanceId) => studioRestartInstance(instanceId),
        ensureDesktopKernelRunning: async () => ensureDesktopKernelRunning(),
        reconnectHostedRuntimeReadiness: async () => {
          await connectDesktopRuntime();
        },
      });
      toast.success(retryCopy.startedTitle, {
        id: retryToastId,
        description: retryCopy.startedDescription,
        duration: 6000,
        cancel: {
          label: retryCopy.detailsActionLabel,
          onClick: () => {
            openBackgroundRuntimeDetails();
          },
        },
      });
    } catch (error) {
      backgroundRuntimeReadinessRecoveryPendingRef.current = false;
      logStartup(
        'warn',
        recoveryMode === 'managed-openclaw'
          ? 'Retrying built-in OpenClaw background startup failed before readiness probing resumed.'
          : 'Retrying hosted desktop runtime readiness failed before readiness probing resumed.',
        {
          error,
        },
        runId,
      );
      setBackgroundRuntimeReadinessNotification({
        runId,
        message: resolveErrorMessage(error, appearance.language),
        recoveryMode,
      });
      toast.error(retryCopy.failedTitle, {
        id: retryToastId,
        description: resolveErrorMessage(error, appearance.language),
        duration: 12000,
        cancel: {
          label: retryCopy.detailsActionLabel,
          onClick: () => {
            openBackgroundRuntimeDetails();
          },
        },
      });
    } finally {
      backgroundRuntimeReadinessRecoveryInFlightRef.current = false;
    }
  });

  const handleStartupRetry = useEffectEvent(() => {
    startupRuntimeReadinessRetryRecoveryRequestRef.current =
      planStartupRuntimeReadinessRetryRecovery({
        runtimeReadinessFailed: runtimeReadinessFailureRef.current,
        recoveryMode: backgroundRuntimeReadinessRecoveryModeRef.current,
        instanceId: resolveBuiltInOpenClawInstanceIdFromSnapshot(
          startupEvidenceContextRef.current?.readinessSnapshot,
        ),
      });
    setRetrySeed((value) => value + 1);
  });

  useEffect(() => {
    const toastPlan = resolveBackgroundRuntimeReadinessToastPlan({
      language: appearance.language,
      status,
      shouldRenderShell,
      currentRunId: bootRunIdRef.current,
      lastShownSignature: backgroundRuntimeReadinessNotificationSignatureRef.current,
      notification: backgroundRuntimeReadinessNotification,
    });
    scheduleBackgroundRuntimeReadinessAutoRecovery(backgroundRuntimeReadinessNotification);
    if (!toastPlan) {
      return;
    }

    backgroundRuntimeReadinessNotificationSignatureRef.current = toastPlan.signature;
    toast.error(toastPlan.title, {
      id: toastPlan.toastId,
      description: toastPlan.description,
      duration: 12000,
      action: {
        label: toastPlan.retryActionLabel,
        onClick: () => {
          void retryBackgroundRuntimeReadiness();
        },
      },
      cancel: {
        label: toastPlan.detailsActionLabel,
        onClick: () => {
          openBackgroundRuntimeDetails();
        },
      },
    });
  }, [
    appearance.language,
    backgroundRuntimeReadinessNotification,
    openBackgroundRuntimeDetails,
    retryBackgroundRuntimeReadiness,
    scheduleBackgroundRuntimeReadinessAutoRecovery,
    shouldRenderShell,
    status,
  ]);

  const revealStartupWindow = useEffectEvent(async () => {
    logStartup('info', 'Preparing startup window.');
    await waitForNextPaint();

    if (!isTauriRuntime()) {
      logStartup('warn', 'Skipping native window reveal because Tauri runtime is unavailable.');
      return;
    }

    let desktopWindow = getDesktopWindow();
    let attempts = 0;

    while (!desktopWindow && attempts < 6) {
      attempts += 1;
      await waitFor(80);
      desktopWindow = getDesktopWindow();
    }

    if (!desktopWindow) {
      logStartup('error', 'Desktop window handle was unavailable during startup.');
      throw new Error('The desktop window handle was unavailable during startup.');
    }

    if (attempts > 0) {
      logStartup('info', 'Desktop window handle resolved after retries.', { attempts });
    }

    await desktopWindow.show();
    await desktopWindow.setFocus().catch(() => {
      // Focus is best-effort after reveal.
    });
    logStartup('info', 'Startup window revealed.');
  });

  const connectDesktopRuntime = useEffectEvent(async () => {
    const runId = bootRunIdRef.current;
    const isCurrentRun = () => bootRunIdRef.current === runId;
    let desktopKernelInfoPromise: Promise<DesktopKernelInfo | null> | null = null;
    const captureDesktopKernelInfo = async (captureRunId = runId) => {
      if (!isTauriRuntime()) {
        return null;
      }

      if (!desktopKernelInfoPromise) {
        desktopKernelInfoPromise = (async () => {
          try {
            const kernelInfo = await getDesktopKernelInfo();
            const localAiProxy = kernelInfo?.localAiProxy ?? null;

            if (localAiProxy) {
              logStartup('info', 'Desktop kernel info captured local ai proxy startup evidence.', {
                lifecycle: localAiProxy.lifecycle,
                messageCaptureEnabled: localAiProxy.messageCaptureEnabled,
                observabilityDbPath: localAiProxy.observabilityDbPath ?? null,
                snapshotPath: localAiProxy.snapshotPath ?? null,
                logPath: localAiProxy.logPath ?? null,
              }, captureRunId);
            } else {
              logStartup(
                'warn',
                'Desktop kernel info did not expose local ai proxy startup evidence.',
                undefined,
                captureRunId,
              );
            }

            return kernelInfo;
          } catch (error) {
            logStartup('warn', 'Desktop kernel info probe failed while capturing local ai proxy startup evidence.', {
              error,
            }, captureRunId);
            return null;
          }
        })();
      }

      return desktopKernelInfoPromise;
    };
    const captureLocalAiProxyEvidence = async (captureRunId = runId) => {
      if (!isTauriRuntime()) {
        return null;
      }

      try {
        const kernelInfo = await getDesktopKernelInfo();
        const localAiProxy = kernelInfo?.localAiProxy ?? null;

        if (localAiProxy) {
          logStartup('info', 'Fresh desktop kernel info captured local ai proxy startup evidence.', {
            lifecycle: localAiProxy.lifecycle,
            messageCaptureEnabled: localAiProxy.messageCaptureEnabled,
            observabilityDbPath: localAiProxy.observabilityDbPath ?? null,
            snapshotPath: localAiProxy.snapshotPath ?? null,
            logPath: localAiProxy.logPath ?? null,
          }, captureRunId);
        } else {
          logStartup(
            'warn',
            'Fresh desktop kernel info did not expose local ai proxy startup evidence.',
            undefined,
            captureRunId,
          );
        }

        return localAiProxy;
      } catch (error) {
        logStartup(
          'warn',
          'Fresh desktop kernel info probe failed while capturing local ai proxy startup evidence.',
          {
            error,
          },
          captureRunId,
        );
        return null;
      }
    };
    logStartup(
      'info',
      'Connecting desktop runtime metadata first. Hosted runtime readiness will continue in the background.',
      {
        isTauriRuntime: isTauriRuntime(),
      },
      runId,
    );

    await connectDesktopRuntimeDuringStartup({
      isTauriRuntime,
      getAppInfo,
      getAppPaths,
      blockOnReadiness: false,
      probeHostedRuntimeReadiness: async () => {
        const kernelInfo = await captureDesktopKernelInfo(runId);
        const recoveryMode = resolveBackgroundRuntimeReadinessRecoveryMode(
          kernelInfo?.bundledComponents.includedKernelIds,
        );
        backgroundRuntimeReadinessRecoveryModeRef.current = recoveryMode;
        return probeDesktopHostedRuntimeReadiness({
          requiresBuiltInOpenClawEvidence: recoveryMode === 'managed-openclaw',
          onRetry: ({ attempt, elapsedMs, error }) => {
            if (!isCurrentRun()) {
              return;
            }

            const shouldLogRetry = attempt === 1 || attempt % 10 === 0;
            if (!shouldLogRetry) {
              return;
            }

            if (isDesktopHostedRuntimeReadinessError(error)) {
              const builtInInstance = resolveBuiltInOpenClawInstanceFromSnapshot(error.snapshot);
              logStartup('warn', 'Hosted desktop runtime readiness is still converging.', {
                attempt,
                elapsedMs,
                descriptorBrowserBaseUrl: error.snapshot.descriptor.browserBaseUrl,
                descriptorEndpointId: error.snapshot.descriptor.endpointId ?? null,
                descriptorActivePort: error.snapshot.descriptor.activePort ?? null,
                hostLifecycle: error.snapshot.hostPlatformStatus.lifecycle,
                hostEndpointCount: error.snapshot.hostEndpoints.length,
                openClawRuntimeLifecycle: error.snapshot.openClawRuntime.lifecycle,
                openClawGatewayLifecycle: error.snapshot.openClawGateway.lifecycle,
                builtInInstanceRuntimeKind: builtInInstance?.runtimeKind ?? null,
                builtInInstanceDeploymentMode: builtInInstance?.deploymentMode ?? null,
                builtInInstanceTransportKind: builtInInstance?.transportKind ?? null,
                builtInInstanceStatus: builtInInstance?.status ?? null,
                builtInInstanceBaseUrl: builtInInstance?.baseUrl ?? null,
                builtInInstanceWebsocketUrl: builtInInstance?.websocketUrl ?? null,
                readinessEvidence: error.snapshot.evidence,
                error: error.message,
              }, runId);
              return;
            }

            logStartup(
              'warn',
              'Hosted desktop runtime readiness probe hit a transient startup failure and will retry.',
              {
                attempt,
                elapsedMs,
                error,
              },
              runId,
            );
          },
        });
      },
      captureLocalAiProxyEvidence: () => captureLocalAiProxyEvidence(runId),
      onBaseContext: async ({ appInfo, appPaths }) => {
        if (!isCurrentRun()) {
          logStartup(
            'warn',
            'Ignoring stale desktop runtime metadata context from a previous bootstrap run.',
            undefined,
            runId,
          );
          return;
        }

        const kernelInfo = await captureDesktopKernelInfo(runId);
        startupEvidenceContextRef.current = {
          appInfo,
          appPaths,
          bundledComponents: kernelInfo?.bundledComponents ?? null,
          readinessSnapshot: null,
          localAiProxy: null,
        };
        logStartup('info', 'app.getInfo() resolved.', appInfo, runId);
        logStartup(
          'info',
          'app.getPaths() resolved.',
          appPaths
            ? {
                dataDir: appPaths.dataDir,
                logsDir: appPaths.logsDir,
                mainLogFile: appPaths.mainLogFile,
              }
            : null,
          runId,
        );

        if (isTauriRuntime() && !appInfo) {
          logStartup('error', 'Desktop runtime probe returned an empty payload.', undefined, runId);
        }
      },
      onReadinessReady: async ({ appInfo, appPaths, readinessSnapshot, localAiProxy }) => {
        if (!isCurrentRun()) {
          logStartup(
            'warn',
            'Ignoring stale hosted runtime readiness success from a previous bootstrap run.',
            undefined,
            runId,
          );
          return;
        }

        const builtInInstance = resolveBuiltInOpenClawInstanceFromSnapshot(readinessSnapshot);
        const shouldNotifyRecoveryReady = backgroundRuntimeReadinessRecoveryPendingRef.current;
        backgroundRuntimeReadinessRecoveryPendingRef.current = false;
        clearBackgroundRuntimeReadinessAutoRecoveryTimer();
        backgroundRuntimeReadinessAutoRecoveryAttemptCountRef.current = 0;
        setBackgroundRuntimeReadinessNotification(null);
        runtimeReadinessFailureRef.current = false;
        startupEvidenceContextRef.current = {
          appInfo,
          appPaths,
          bundledComponents:
            startupEvidenceContextRef.current?.bundledComponents ?? null,
          readinessSnapshot,
          localAiProxy,
        };
        logStartup('info', 'Hosted desktop runtime readiness probe resolved.', {
          descriptorBrowserBaseUrl: readinessSnapshot.descriptor.browserBaseUrl,
          descriptorEndpointId: readinessSnapshot.descriptor.endpointId ?? null,
          descriptorActivePort: readinessSnapshot.descriptor.activePort ?? null,
          descriptorStateStoreDriver: readinessSnapshot.descriptor.stateStoreDriver ?? null,
          descriptorStateStoreProfileId: readinessSnapshot.descriptor.stateStoreProfileId ?? null,
          runtimeDataDir: readinessSnapshot.descriptor.runtimeDataDir ?? null,
          webDistDir: readinessSnapshot.descriptor.webDistDir ?? null,
          hostLifecycle: readinessSnapshot.hostPlatformStatus.lifecycle,
          hostMode: readinessSnapshot.hostPlatformStatus.mode,
          hostEndpointCount: readinessSnapshot.hostEndpoints.length,
          hostEndpointId: readinessSnapshot.evidence.manageEndpointId,
          hostEndpointRequestedPort: readinessSnapshot.evidence.manageEndpointRequestedPort,
          hostEndpointActivePort: readinessSnapshot.evidence.manageEndpointActivePort,
          hostEndpointBaseUrl: readinessSnapshot.evidence.manageBaseUrl,
          openClawRuntimeLifecycle: readinessSnapshot.openClawRuntime.lifecycle,
          openClawGatewayLifecycle: readinessSnapshot.openClawGateway.lifecycle,
          instanceCount: readinessSnapshot.instances.length,
          builtInInstanceRuntimeKind: builtInInstance?.runtimeKind ?? null,
          builtInInstanceDeploymentMode: builtInInstance?.deploymentMode ?? null,
          builtInInstanceTransportKind: builtInInstance?.transportKind ?? null,
          builtInInstanceStatus: builtInInstance?.status ?? null,
          builtInInstanceBaseUrl: builtInInstance?.baseUrl ?? null,
          builtInInstanceWebsocketUrl: builtInInstance?.websocketUrl ?? null,
          readinessEvidence: readinessSnapshot.evidence,
        }, runId);
        await persistStartupEvidence({
          status: 'passed',
          phase: resolvePassingDesktopStartupEvidencePhase(
            milestonesRef.current.hasShellMounted,
          ),
          appInfo,
          appPaths,
          bundledComponents:
            startupEvidenceContextRef.current?.bundledComponents ?? null,
          readinessSnapshot,
          localAiProxy,
          runId,
        });
        if (shouldNotifyRecoveryReady) {
          const recoveryCopy = resolveBackgroundRuntimeReadinessRecoveryToastCopy(
            appearance.language,
            {
              recoveryMode: backgroundRuntimeReadinessRecoveryModeRef.current,
            },
          );
          toast.success(recoveryCopy.readyTitle, {
            id: BACKGROUND_RUNTIME_READINESS_TOAST_ID,
            description: recoveryCopy.readyDescription,
            duration: 6000,
            cancel: {
              label: recoveryCopy.detailsActionLabel,
              onClick: () => {
                openBackgroundRuntimeDetails();
              },
            },
          });
        }
      },
      onReadinessFailed: async ({ appInfo, appPaths, error, localAiProxy }) => {
        if (!isCurrentRun()) {
          logStartup(
            'warn',
            'Ignoring stale hosted runtime readiness failure from a previous bootstrap run.',
            {
              error,
            },
            runId,
          );
          return;
        }

        backgroundRuntimeReadinessRecoveryPendingRef.current = false;
        runtimeReadinessFailureRef.current = true;

        if (isDesktopHostedRuntimeReadinessError(error)) {
          const readinessError = error;
          const builtInInstance = resolveBuiltInOpenClawInstanceFromSnapshot(
            readinessError.snapshot,
          );
          setBackgroundRuntimeReadinessNotification({
            runId,
            message: readinessError.message,
            recoveryMode: backgroundRuntimeReadinessRecoveryModeRef.current,
          });
          startupEvidenceContextRef.current = {
            appInfo,
            appPaths,
            bundledComponents:
              startupEvidenceContextRef.current?.bundledComponents ?? null,
            readinessSnapshot: readinessError.snapshot,
            localAiProxy,
          };
          logStartup('error', 'Hosted desktop runtime readiness probe failed in the background.', {
            descriptorBrowserBaseUrl: readinessError.snapshot.descriptor.browserBaseUrl,
            descriptorEndpointId: readinessError.snapshot.descriptor.endpointId ?? null,
            descriptorActivePort: readinessError.snapshot.descriptor.activePort ?? null,
            descriptorStateStoreDriver: readinessError.snapshot.descriptor.stateStoreDriver ?? null,
            descriptorStateStoreProfileId: readinessError.snapshot.descriptor.stateStoreProfileId ?? null,
            runtimeDataDir: readinessError.snapshot.descriptor.runtimeDataDir ?? null,
            webDistDir: readinessError.snapshot.descriptor.webDistDir ?? null,
            hostLifecycle: readinessError.snapshot.hostPlatformStatus.lifecycle,
            hostMode: readinessError.snapshot.hostPlatformStatus.mode,
            hostEndpointCount: readinessError.snapshot.hostEndpoints.length,
            hostEndpointId: readinessError.snapshot.evidence.manageEndpointId,
            hostEndpointRequestedPort: readinessError.snapshot.evidence.manageEndpointRequestedPort,
            hostEndpointActivePort: readinessError.snapshot.evidence.manageEndpointActivePort,
            hostEndpointBaseUrl: readinessError.snapshot.evidence.manageBaseUrl,
            openClawRuntimeLifecycle: readinessError.snapshot.openClawRuntime.lifecycle,
            openClawGatewayLifecycle: readinessError.snapshot.openClawGateway.lifecycle,
            instanceCount: readinessError.snapshot.instances.length,
            builtInInstanceRuntimeKind: builtInInstance?.runtimeKind ?? null,
            builtInInstanceDeploymentMode: builtInInstance?.deploymentMode ?? null,
            builtInInstanceTransportKind: builtInInstance?.transportKind ?? null,
            builtInInstanceStatus: builtInInstance?.status ?? null,
            builtInInstanceBaseUrl: builtInInstance?.baseUrl ?? null,
            builtInInstanceWebsocketUrl: builtInInstance?.websocketUrl ?? null,
            readinessEvidence: readinessError.snapshot.evidence,
            error: readinessError.message,
            cause: readinessError.cause,
          }, runId);
          await persistStartupEvidence({
            status: 'failed',
            phase: 'runtime-readiness-failed',
            appInfo,
            appPaths,
            bundledComponents:
              startupEvidenceContextRef.current?.bundledComponents ?? null,
            readinessSnapshot: readinessError.snapshot,
            localAiProxy,
            error: readinessError,
            runId,
          });
          return;
        }

        setBackgroundRuntimeReadinessNotification({
          runId,
          message: resolveErrorMessage(error, appearance.language),
          recoveryMode: backgroundRuntimeReadinessRecoveryModeRef.current,
        });
        logStartup(
          'warn',
          'Hosted desktop runtime readiness probe failed without a structured snapshot.',
          {
            error,
          },
          runId,
        );
        await persistStartupEvidence({
          status: 'failed',
          phase: 'runtime-readiness-failed',
          appInfo,
          appPaths,
          bundledComponents:
            startupEvidenceContextRef.current?.bundledComponents ?? null,
          localAiProxy,
          error,
          runId,
        });
      },
      log(level, message, details) {
        logStartup(level, message, details);
      },
    });
  });

  const runBootstrap = useEffectEvent(async () => {
    const runId = bootRunIdRef.current + 1;
    const startupRuntimeReadinessRetryRecoveryRequest =
      startupRuntimeReadinessRetryRecoveryRequestRef.current;
    startupRuntimeReadinessRetryRecoveryRequestRef.current = null;
    bootRunIdRef.current = runId;
    splashHandoffRunIdRef.current = 0;
    const desktopWindow = getDesktopWindow();

    startedAtRef.current = Date.now();
    stageLogSignatureRef.current = '';
    startupEvidenceContextRef.current = null;
    startupEvidenceSignatureRef.current = '';
    backgroundRuntimeReadinessNotificationSignatureRef.current = '';
    clearBackgroundRuntimeReadinessAutoRecoveryTimer();
    backgroundRuntimeReadinessAutoRecoveryAttemptCountRef.current = 0;
    backgroundRuntimeReadinessRecoveryPendingRef.current = false;
    backgroundRuntimeReadinessRecoveryInFlightRef.current = false;
    backgroundRuntimeReadinessRecoveryModeRef.current = 'generic-hosted-runtime';
    runtimeReadinessFailureRef.current = false;
    toast.dismiss(BACKGROUND_RUNTIME_READINESS_TOAST_ID);
    setBackgroundRuntimeReadinessNotification(null);
    setMilestones(INITIAL_DESKTOP_STARTUP_MILESTONES);
    setStatus('booting');
    setErrorMessage(null);
    setShouldRenderShell(false);
    setIsSplashVisible(true);
    logStartup(
      'info',
      'Bootstrap started.',
      {
        appName,
        distribution: resolveDesktopDistributionId(),
        isTauriRuntime: isTauriRuntime(),
        hasDesktopWindow: Boolean(desktopWindow),
      },
      runId,
    );
    await persistStartupEvidence({
      status: 'running',
      phase: 'bootstrap-started',
      runId,
    });

    if (desktopWindow) {
      await desktopWindow.setFullscreen(false).catch(() => {
        // Ignore startup fullscreen reset failures and continue booting.
      });
      await desktopWindow
        .isMaximized()
        .then((isMaximizedWindow) => {
          if (!isMaximizedWindow) {
            return;
          }

          logStartup('info', 'Restoring maximized window to default startup size.', undefined, runId);
          return desktopWindow.unmaximize();
        })
        .catch(() => {
          // Ignore startup unmaximize failures and continue booting.
        });
    }

    if (startupRuntimeReadinessRetryRecoveryRequest) {
      try {
        logStartup(
          'info',
          'Recovering hosted runtime readiness before retrying desktop startup.',
          {
            recoveryMode: startupRuntimeReadinessRetryRecoveryRequest.recoveryMode,
            instanceId: startupRuntimeReadinessRetryRecoveryRequest.instanceId,
          },
          runId,
        );
        await runStartupRuntimeReadinessRetryRecovery({
          request: startupRuntimeReadinessRetryRecoveryRequest,
          clearFailureState: () => {
            runtimeReadinessFailureRef.current = false;
            clearBackgroundRuntimeReadinessFailureState();
          },
          restartInstance: async (instanceId) => studioRestartInstance(instanceId),
          ensureDesktopKernelRunning: async () => ensureDesktopKernelRunning(),
        });
      } catch (error) {
        logStartup(
          'warn',
          'Hosted runtime readiness recovery before startup retry failed; continuing with the normal startup probe.',
          {
            error,
          },
          runId,
        );
      }
    }

    await runDesktopBootstrapSequence({
      pathname: window.location.pathname,
      runId,
      isRunCurrent: () => bootRunIdRef.current === runId,
      revealStartupWindow,
      connectDesktopRuntime,
      bootstrapShellRuntime: async () => {
        logStartup('info', 'Bootstrapping shell runtime.', undefined, runId);
        await bootstrapShellRuntime();
      },
      resolveSidebarStartupRoute,
      listSidebarRoutePrefetchPaths,
      prefetchSidebarRoute,
      prefetchSidebarRoutes,
      scheduleTask(callback) {
        return window.setTimeout(callback, 0);
      },
      clearScheduledTask(handle) {
        window.clearTimeout(handle);
      },
      resolveErrorMessage(error) {
        return resolveErrorMessage(error, appearance.language);
      },
      onBootstrapFailed: async (error) => {
        await persistStartupEvidence({
          status: 'failed',
          phase: runtimeReadinessFailureRef.current
            ? 'runtime-readiness-failed'
            : 'bootstrap-failed',
          error,
          runId,
        });
      },
      log(level, message, details) {
        logStartup(level, message, details, runId);
      },
      actions: bootstrapStateActions,
    });
  });

  useEffect(() => {
    void runBootstrap();
  }, [retrySeed]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#12090a]">
      {shouldRenderShell ? (
        <DesktopProviders>
          <DesktopShellErrorBoundary
            resetKey={retrySeed}
            onError={handleShellRenderError}
          >
            <div className="h-full w-full">
              <AppProviders onLanguagePreferenceChange={handleLanguagePreferenceChange}>
                <DesktopTrayRouteBridge />
                <MainLayout />
              </AppProviders>
            </div>
          </DesktopShellErrorBoundary>
        </DesktopProviders>
      ) : null}

      <DesktopStartupScreen
        appName={appName}
        language={appearance.language}
        progress={progress}
        status={status}
        errorMessage={errorMessage}
        isVisible={isSplashVisible || status === 'error'}
        onRetry={handleStartupRetry}
      />
    </div>
  );
}

export function resolveDesktopDistributionId(): DistributionId {
  const distribution = import.meta.env.VITE_DISTRIBUTION_ID;
  return distribution === 'cn' ? 'cn' : 'global';
}

export function resolveDesktopBootstrapContext() {
  const distributionId = resolveDesktopDistributionId();
  const manifest = getDistributionManifest(distributionId);

  return {
    appName: manifest.appName,
    initialAppearance: readInitialStartupAppearance(),
  };
}
