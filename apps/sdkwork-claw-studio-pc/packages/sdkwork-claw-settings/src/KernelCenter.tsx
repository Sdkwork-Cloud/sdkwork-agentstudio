import { useEffect, useState } from 'react';
import {
  Activity,
  Box,
  Database,
  HardDrive,
  Layers3,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Waypoints,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@sdkwork/claw-ui';
import { useRolloutStore } from '@sdkwork/claw-core';
import { HostRuntimeSettings } from './HostRuntimeSettings';
import { Section } from './Shared';
import {
  kernelCenterService,
  type KernelCenterDashboard,
} from './services/index.ts';
import {
  formatLocalAiProxyRouteMetricSummary,
  formatLocalAiProxyRouteTestSummary,
  resolveEndpointPortValue,
  resolveLocalAiProxyPortValue,
} from './kernelCenterView.ts';

type Translate = (key: string, options?: Record<string, unknown>) => string;

function toneClasses(tone: KernelCenterDashboard['statusTone']) {
  switch (tone) {
    case 'healthy':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300';
    case 'degraded':
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300';
    default:
      return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300';
  }
}

function renderList(values: string[], emptyLabel: string) {
  if (values.length === 0) {
    return emptyLabel;
  }

  return values.join(', ');
}

function translateRuntimeState(t: Translate, state?: string | null) {
  switch (state) {
    case 'inactive':
      return t('settings.kernelCenter.runtimeStates.inactive');
    case 'ready':
      return t('settings.kernelCenter.runtimeStates.ready');
    case 'running':
      return t('settings.kernelCenter.runtimeStates.running');
    case 'starting':
      return t('settings.kernelCenter.runtimeStates.starting');
    case 'stopping':
      return t('settings.kernelCenter.runtimeStates.stopping');
    case 'recovering':
      return t('settings.kernelCenter.runtimeStates.recovering');
    case 'degraded':
      return t('settings.kernelCenter.runtimeStates.degraded');
    case 'crashLoop':
      return t('settings.kernelCenter.runtimeStates.crashLoop');
    case 'failedSafe':
      return t('settings.kernelCenter.runtimeStates.failedSafe');
    case 'stopped':
      return t('settings.kernelCenter.runtimeStates.stopped');
    default:
      return t('settings.kernelCenter.runtimeStates.unavailable');
  }
}

function translateTopologyKind(t: Translate, kind?: string | null) {
  switch (kind) {
    case 'localManagedNative':
      return t('settings.kernelCenter.topologies.localManagedNative');
    case 'localManagedWsl':
      return t('settings.kernelCenter.topologies.localManagedWsl');
    case 'localManagedContainer':
      return t('settings.kernelCenter.topologies.localManagedContainer');
    case 'localExternal':
      return t('settings.kernelCenter.topologies.localExternal');
    case 'remoteManagedNode':
      return t('settings.kernelCenter.topologies.remoteManagedNode');
    case 'remoteAttachedNode':
      return t('settings.kernelCenter.topologies.remoteAttachedNode');
    default:
      return t('settings.kernelCenter.topologies.unknown');
  }
}

function translateServiceManager(t: Translate, serviceManager?: string | null) {
  switch (serviceManager) {
    case 'windowsService':
      return t('settings.kernelCenter.serviceManagers.windowsService');
    case 'launchdLaunchAgent':
      return t('settings.kernelCenter.serviceManagers.launchdLaunchAgent');
    case 'systemdUser':
      return t('settings.kernelCenter.serviceManagers.systemdUser');
    case 'systemdSystem':
      return t('settings.kernelCenter.serviceManagers.systemdSystem');
    case 'tauriSupervisor':
      return t('settings.kernelCenter.serviceManagers.tauriSupervisor');
    default:
      return t('settings.kernelCenter.serviceManagers.unknown');
  }
}

function translateOwnership(t: Translate, ownership?: string | null) {
  switch (ownership) {
    case 'nativeService':
      return t('settings.kernelCenter.ownership.nativeService');
    case 'appSupervisor':
      return t('settings.kernelCenter.ownership.appSupervisor');
    case 'attached':
      return t('settings.kernelCenter.ownership.attached');
    default:
      return t('settings.kernelCenter.ownership.unknown');
  }
}

function translateStartupMode(t: Translate, startupMode?: string | null) {
  switch (startupMode) {
    case 'auto':
      return t('settings.kernelCenter.startupModes.auto');
    case 'manual':
      return t('settings.kernelCenter.startupModes.manual');
    default:
      return t('settings.kernelCenter.values.unknown');
  }
}

function translateInstallSource(t: Translate, installSource?: string | null) {
  switch (installSource) {
    case 'bundled':
      return t('settings.kernelCenter.installSources.bundled');
    case 'external':
      return t('settings.kernelCenter.installSources.external');
    case 'remote':
      return t('settings.kernelCenter.installSources.remote');
    default:
      return t('settings.kernelCenter.installSources.unknown');
  }
}

function translateSupervisorLifecycle(t: Translate, lifecycle?: string | null) {
  switch (lifecycle) {
    case 'active':
      return t('settings.kernelCenter.supervisorLifecycle.active');
    case 'inactive':
      return t('settings.kernelCenter.supervisorLifecycle.inactive');
    case 'stopping':
      return t('settings.kernelCenter.supervisorLifecycle.stopping');
    default:
      return t('settings.kernelCenter.supervisorLifecycle.unknown');
  }
}

function translateLocalAiProxyLifecycle(t: Translate, lifecycle?: string | null) {
  switch (lifecycle?.trim().toLowerCase()) {
    case 'ready':
      return t('settings.kernelCenter.localAiProxyLifecycle.ready');
    case 'running':
      return t('settings.kernelCenter.localAiProxyLifecycle.running');
    case 'failed':
      return t('settings.kernelCenter.localAiProxyLifecycle.failed');
    case 'stopped':
      return t('settings.kernelCenter.localAiProxyLifecycle.stopped');
    default:
      return t('settings.kernelCenter.localAiProxyLifecycle.unavailable');
  }
}

function translateLocalAiProxyRouteHealth(t: Translate, health: string) {
  switch (health) {
    case 'healthy':
      return t('settings.kernelCenter.localAiProxy.observability.health.healthy');
    case 'degraded':
      return t('settings.kernelCenter.localAiProxy.observability.health.degraded');
    case 'failed':
      return t('settings.kernelCenter.localAiProxy.observability.health.failed');
    default:
      return t('settings.kernelCenter.localAiProxy.observability.health.disabled');
  }
}

function translateLocalAiProxyRouteTestStatus(t: Translate, status: string) {
  return status === 'passed'
    ? t('settings.kernelCenter.localAiProxy.observability.testStatus.passed')
    : t('settings.kernelCenter.localAiProxy.observability.testStatus.failed');
}

function translateLocalAiProxyRouteTestCapability(t: Translate, capability: string) {
  switch (capability) {
    case 'chat':
      return t('settings.kernelCenter.localAiProxy.observability.capabilities.chat');
    case 'responses':
      return t('settings.kernelCenter.localAiProxy.observability.capabilities.responses');
    case 'embeddings':
      return t('settings.kernelCenter.localAiProxy.observability.capabilities.embeddings');
    case 'messages':
      return t('settings.kernelCenter.localAiProxy.observability.capabilities.messages');
    default:
      return t('settings.kernelCenter.localAiProxy.observability.capabilities.generateContent');
  }
}

function translateBoolean(t: Translate, value: boolean) {
  return value
    ? t('settings.kernelCenter.values.yes')
    : t('settings.kernelCenter.values.no');
}

function formatLocalAiProxyClientProtocolLabel(t: Translate, clientProtocol: string) {
  switch (clientProtocol) {
    case 'openai-compatible':
      return t('settings.kernelCenter.localAiProxy.protocols.openaiCompatible');
    case 'anthropic':
      return t('settings.kernelCenter.localAiProxy.protocols.anthropic');
    case 'gemini':
      return t('settings.kernelCenter.localAiProxy.protocols.gemini');
    default:
      return clientProtocol || t('settings.kernelCenter.values.unknown');
  }
}

function formatLocalAiProxyDefaultRouteValue(t: Translate, route: {
  name: string;
  managedBy: string;
  upstreamProtocol: string;
  modelCount: number;
}) {
  const managementLabel =
    route.managedBy === 'system-default'
      ? t('settings.kernelCenter.localAiProxy.systemDefault')
      : route.managedBy;
  const modelLabel = t('settings.kernelCenter.localAiProxy.modelCount', {
    count: route.modelCount,
  });
  return [route.name, managementLabel, route.upstreamProtocol, modelLabel].join(' | ');
}

function formatRolloutPhase(
  t: Translate,
  phase: KernelCenterDashboard['rollouts']['items'][number]['phase'],
) {
  switch (phase) {
    case 'draft':
      return t('settings.kernelCenter.rollouts.phases.draft');
    case 'previewing':
      return t('settings.kernelCenter.rollouts.phases.previewing');
    case 'awaitingApproval':
      return t('settings.kernelCenter.rollouts.phases.awaitingApproval');
    case 'ready':
      return t('settings.kernelCenter.rollouts.phases.ready');
    case 'promoting':
      return t('settings.kernelCenter.rollouts.phases.promoting');
    case 'paused':
      return t('settings.kernelCenter.rollouts.phases.paused');
    case 'completed':
      return t('settings.kernelCenter.rollouts.phases.completed');
    case 'failed':
      return t('settings.kernelCenter.rollouts.phases.failed');
    default:
      return t('settings.kernelCenter.rollouts.phases.cancelled');
  }
}

function canStartRollout(
  phase: KernelCenterDashboard['rollouts']['items'][number]['phase'],
) {
  return phase === 'ready' || phase === 'awaitingApproval';
}

function formatTimestampValue(timestamp: number | null, emptyLabel: string) {
  return timestamp ? new Date(timestamp).toLocaleString() : emptyLabel;
}

function formatDurationMsValue(durationMs: number | null) {
  return durationMs === null ? null : `${durationMs} ms`;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            {label}
          </div>
          <div className="mt-2 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {value}
          </div>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{detail}</div>
    </div>
  );
}

function ValueRow({
  label,
  value,
  emptyLabel,
  mono = false,
}: {
  label: string;
  value: string | null;
  emptyLabel: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div
        className={`mt-2 break-all text-sm text-zinc-800 dark:text-zinc-200 ${mono ? 'font-mono' : ''}`}
      >
        {value || emptyLabel}
      </div>
    </div>
  );
}

export function KernelCenter() {
  const { t } = useTranslation();
  const [dashboard, setDashboard] = useState<KernelCenterDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeAction, setActiveAction] = useState<'ensure' | 'restart' | null>(null);
  const [activeRolloutAction, setActiveRolloutAction] = useState<'preview' | 'start' | null>(null);
  const {
    status: rolloutStatus,
    items: rolloutItems,
    total: rolloutTotal,
    phaseCounts,
    preview: rolloutPreview,
    previewFailures,
    selectedRolloutId,
    error: rolloutError,
    load: loadRollouts,
    previewRollout,
    startRollout,
    reset: resetRollouts,
  } = useRolloutStore();

  const notAvailableLabel = t('settings.kernelCenter.values.notAvailable');
  const noneLabel = t('settings.kernelCenter.values.none');
  const runtimeLabel = translateRuntimeState(
    t,
    dashboard?.snapshot?.runtimeState
      ?? dashboard?.info?.host?.runtime.state,
  );
  const topologyLabel = translateTopologyKind(
    t,
    dashboard?.snapshot?.topologyKind ?? dashboard?.info?.host?.topology.kind,
  );
  const serviceManagerLabel = translateServiceManager(
    t,
    dashboard?.snapshot?.raw.host.serviceManager ?? dashboard?.info?.host?.host.serviceManager,
  );
  const ownershipLabel = translateOwnership(
    t,
    dashboard?.snapshot?.raw.host.ownership ?? dashboard?.info?.host?.host.ownership,
  );
  const startupModeLabel = translateStartupMode(
    t,
    dashboard?.snapshot?.raw.host.startupMode ?? dashboard?.info?.host?.host.startupMode,
  );
  const host = dashboard?.host ?? {
    serviceManagerLabel: null,
    ownershipLabel: null,
    startupModeLabel: null,
    controlSocketLabel: null,
    controlSocketAvailable: false,
    serviceConfigPath: null,
  };
  const endpoint = dashboard?.endpoint ?? {
    preferredPort: null,
    activePort: null,
    baseUrl: null,
    websocketUrl: null,
    usesDynamicPort: false,
  };
  const storage = dashboard?.storage ?? {
    activeProfileId: null,
    activeProfileLabel: null,
    activeProfilePath: null,
    rootDir: null,
    profileCount: 0,
  };
  const startupEvidence = dashboard?.startupEvidence ?? {
    status: null,
    phase: null,
    runId: null,
    recordedAt: null,
    durationMs: null,
    path: null,
    descriptorMode: null,
    descriptorLifecycle: null,
    descriptorEndpointId: null,
    descriptorRequestedPort: null,
    descriptorActivePort: null,
    descriptorLoopbackOnly: null,
    descriptorDynamicPort: null,
    descriptorStateStoreDriver: null,
    descriptorStateStoreProfileId: null,
    descriptorBrowserBaseUrl: null,
    manageBaseUrl: null,
    builtInInstanceId: null,
    builtInInstanceName: null,
    builtInInstanceVersion: null,
    builtInInstanceRuntimeKind: null,
    builtInInstanceDeploymentMode: null,
    builtInInstanceTransportKind: null,
    builtInInstanceBaseUrl: null,
    builtInInstanceWebsocketUrl: null,
    builtInInstanceIsBuiltIn: null,
    builtInInstanceIsDefault: null,
    builtInInstanceStatus: null,
    runtimeLifecycle: null,
    gatewayLifecycle: null,
    ready: null,
    errorMessage: null,
    errorCause: null,
  };
  const provenance = dashboard?.provenance ?? {
    installSource: null,
    platformLabel: null,
    runtimeVersion: null,
    nodeVersion: null,
    configFile: null,
    runtimeHomeDir: null,
    runtimeInstallDir: null,
  };
  const installSourceLabel = translateInstallSource(t, provenance.installSource);
  const runtimeAuthority = dashboard?.runtimeAuthority ?? {
    configFile: null,
    ownedRuntimeRoots: [],
    supportsLoopbackHealthProbe: null,
    healthProbeTimeoutMs: null,
  };
  const localAiProxy = dashboard?.localAiProxy ?? {
    lifecycle: 'Unavailable',
    baseUrl: null,
    rootBaseUrl: null,
    openaiCompatibleBaseUrl: null,
    anthropicBaseUrl: null,
    geminiBaseUrl: null,
    activePort: null,
    loopbackOnly: true,
    defaultRouteName: null,
    defaultRoutes: [],
    upstreamBaseUrl: null,
    modelCount: 0,
    routeMetrics: [],
    routeTests: [],
    messageCaptureEnabled: false,
    observabilityDbPath: null,
    configFile: null,
    snapshotPath: null,
    logPath: null,
    lastError: null,
  };
  const capabilities = dashboard?.capabilities ?? {
    readyKeys: [],
    plannedKeys: [],
  };
  const resolvedRolloutItems =
    rolloutStatus === 'ready' || rolloutItems.length > 0
      ? rolloutItems
      : dashboard?.rollouts.items ?? [];
  const resolvedRolloutTotal =
    rolloutStatus === 'ready' || rolloutItems.length > 0
      ? rolloutTotal
      : dashboard?.rollouts.total ?? 0;
  const resolvedRolloutCounts =
    rolloutStatus === 'ready' || rolloutItems.length > 0
      ? phaseCounts
      : dashboard?.rollouts.phaseCounts ?? {
          active: 0,
          failed: 0,
          completed: 0,
          paused: 0,
          drafts: 0,
        };
  const localAiProxyLifecycleLabel = translateLocalAiProxyLifecycle(
    t,
    localAiProxy.lifecycle,
  );
  const kernelControlAvailable = Boolean(dashboard?.snapshot || dashboard?.info?.host);

  const loadDashboard = async () => {
    setIsLoading(true);
    try {
      setDashboard(await kernelCenterService.getDashboard());
    } catch (error: any) {
      toast.error(error?.message || t('settings.kernelCenter.toasts.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
    void loadRollouts();
    return () => {
      resetRollouts();
    };
  }, []);

  const handleRefresh = async () => {
    await Promise.all([loadDashboard(), loadRollouts()]);
  };

  const handleEnsureRunning = async () => {
    setActiveAction('ensure');
    try {
      setDashboard(await kernelCenterService.ensureRunning());
      await loadRollouts();
      toast.success(t('settings.kernelCenter.toasts.ensureSuccess'));
    } catch (error: any) {
      toast.error(error?.message || t('settings.kernelCenter.toasts.ensureFailed'));
    } finally {
      setActiveAction(null);
    }
  };

  const handleRestart = async () => {
    setActiveAction('restart');
    try {
      setDashboard(await kernelCenterService.restart());
      await loadRollouts();
      toast.success(t('settings.kernelCenter.toasts.restartSuccess'));
    } catch (error: any) {
      toast.error(error?.message || t('settings.kernelCenter.toasts.restartFailed'));
    } finally {
      setActiveAction(null);
    }
  };

  const handlePreviewRollout = async (rolloutId: string) => {
    setActiveRolloutAction('preview');
    try {
      await previewRollout(rolloutId);
      toast.success(t('settings.kernelCenter.toasts.rolloutPreviewLoaded'));
    } catch (error: any) {
      toast.error(error?.message || t('settings.kernelCenter.toasts.rolloutPreviewFailed'));
    } finally {
      setActiveRolloutAction(null);
    }
  };

  const handleStartRollout = async (rolloutId: string) => {
    setActiveRolloutAction('start');
    try {
      await startRollout(rolloutId);
      await loadDashboard();
      toast.success(t('settings.kernelCenter.toasts.rolloutStartRequested'));
    } catch (error: any) {
      toast.error(error?.message || t('settings.kernelCenter.toasts.rolloutStartFailed'));
    } finally {
      setActiveRolloutAction(null);
    }
  };

  if (isLoading && !dashboard) {
    return (
      <div className="mx-auto flex h-72 max-w-7xl items-center justify-center p-6 md:p-10">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div
      data-slot="kernel-center-page"
      className="scrollbar-hide mx-auto h-full max-w-7xl overflow-y-auto p-6 md:p-10"
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[2rem] border border-zinc-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(244,114,182,0.12),_transparent_42%),linear-gradient(135deg,_rgba(255,255,255,0.98),_rgba(244,244,245,0.92))] p-7 shadow-sm dark:border-zinc-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(244,114,182,0.12),_transparent_40%),linear-gradient(135deg,_rgba(24,24,27,0.96),_rgba(9,9,11,0.98))]"
      >
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-500/10 text-primary-600 dark:text-primary-300">
                <Waypoints className="h-5 w-5" />
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${toneClasses(
                  dashboard?.statusTone || 'warning',
                )}`}
              >
                {runtimeLabel}
              </span>
            </div>
            <h1 className="mt-5 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              {t('sidebar.kernelCenter')}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              {t('settings.kernelCenter.description')}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => void handleRefresh()}
              disabled={isLoading}
              className="rounded-xl"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              {t('settings.kernelCenter.actions.refresh')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void handleEnsureRunning()}
              disabled={activeAction !== null || !kernelControlAvailable}
              className="rounded-xl"
            >
              <ShieldCheck className="h-4 w-4" />
              {activeAction === 'ensure'
                ? t('settings.kernelCenter.actions.ensuring')
                : t('settings.kernelCenter.actions.ensureRunning')}
            </Button>
            <Button
              onClick={() => void handleRestart()}
              disabled={activeAction !== null || !kernelControlAvailable}
              className="rounded-xl"
            >
              <RotateCcw className="h-4 w-4" />
              {activeAction === 'restart'
                ? t('settings.kernelCenter.actions.restarting')
                : t('settings.kernelCenter.actions.restart')}
            </Button>
          </div>
        </div>
      </motion.div>

      <div className="mt-8 grid grid-cols-1 gap-4 xl:grid-cols-4">
        <MetricCard
          icon={Activity}
          label={t('settings.kernelCenter.metrics.runtime')}
          value={runtimeLabel}
          detail={dashboard?.statusSummary || t('settings.kernelCenter.values.noRuntimeSummary')}
        />
        <MetricCard
          icon={Layers3}
          label={t('settings.kernelCenter.metrics.topology')}
          value={topologyLabel}
          detail={
            dashboard?.snapshot?.raw.topology.label
            || t('settings.kernelCenter.values.noTopologyReported')
          }
        />
        <MetricCard
          icon={ShieldCheck}
          label={t('settings.kernelCenter.metrics.host')}
          value={serviceManagerLabel}
          detail={ownershipLabel || t('settings.kernelCenter.values.hostOwnershipUnavailable')}
        />
        <MetricCard
          icon={Waypoints}
          label={t('settings.kernelCenter.metrics.endpoint')}
          value={endpoint.baseUrl || notAvailableLabel}
          detail={
            endpoint.usesDynamicPort
              ? t('settings.kernelCenter.endpoint.dynamicPort')
              : t('settings.kernelCenter.endpoint.preferredActive')
          }
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <HostRuntimeSettings dashboard={dashboard} />

        <Section title={t('settings.kernelCenter.rollouts.title')}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {[
                {
                  id: 'total',
                  label: t('settings.kernelCenter.rollouts.metrics.total'),
                  value: String(resolvedRolloutTotal),
                },
                {
                  id: 'active',
                  label: t('settings.kernelCenter.rollouts.metrics.active'),
                  value: String(resolvedRolloutCounts.active),
                },
                {
                  id: 'failed',
                  label: t('settings.kernelCenter.rollouts.metrics.failed'),
                  value: String(resolvedRolloutCounts.failed),
                },
                {
                  id: 'completed',
                  label: t('settings.kernelCenter.rollouts.metrics.completed'),
                  value: String(resolvedRolloutCounts.completed),
                },
              ].map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                    {item.label}
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            {rolloutError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
                {rolloutError}
              </div>
            ) : null}

            <div className="space-y-3">
              {resolvedRolloutItems.length === 0 ? (
                <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 px-4 py-3 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                  {t('settings.kernelCenter.rollouts.empty')}
                </div>
              ) : (
                resolvedRolloutItems.slice(0, 4).map((item) => {
                  const isBusy = selectedRolloutId === item.id && activeRolloutAction !== null;

                  return (
                    <div
                      key={item.id}
                      className="rounded-[1.5rem] border border-zinc-100 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                              {item.id}
                            </div>
                            <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                              {formatRolloutPhase(t, item.phase)}
                            </span>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-zinc-500 dark:text-zinc-400">
                            <div>{t('settings.kernelCenter.rollouts.values.attempt', { count: item.attempt })}</div>
                            <div>{t('settings.kernelCenter.rollouts.values.targets', { count: item.targetCount })}</div>
                            <div className="col-span-2">
                              {t('settings.kernelCenter.rollouts.values.updatedAt', {
                                value: formatTimestampValue(item.updatedAt, noneLabel),
                              })}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            onClick={() => void handlePreviewRollout(item.id)}
                            disabled={isBusy}
                            className="rounded-xl"
                          >
                            {isBusy && activeRolloutAction === 'preview'
                              ? t('settings.kernelCenter.rollouts.actions.previewing')
                              : t('settings.kernelCenter.rollouts.actions.preview')}
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => void handleStartRollout(item.id)}
                            disabled={isBusy || !canStartRollout(item.phase)}
                            className="rounded-xl"
                          >
                            {isBusy && activeRolloutAction === 'start'
                              ? t('settings.kernelCenter.rollouts.actions.starting')
                              : t('settings.kernelCenter.rollouts.actions.start')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {rolloutPreview ? (
              <div className="rounded-[1.5rem] border border-zinc-100 bg-zinc-50/70 p-5 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {t('settings.kernelCenter.rollouts.previewTitle', {
                      rolloutId: rolloutPreview.rolloutId,
                    })}
                  </div>
                  <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {formatRolloutPhase(t, rolloutPreview.phase)}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-zinc-600 dark:text-zinc-400">
                  <div className="rounded-2xl border border-zinc-100 bg-white/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                    {t('settings.kernelCenter.rollouts.previewSummary.admissible', {
                      count: rolloutPreview.summary.admissibleTargets,
                    })}
                  </div>
                  <div className="rounded-2xl border border-zinc-100 bg-white/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                    {t('settings.kernelCenter.rollouts.previewSummary.degraded', {
                      count: rolloutPreview.summary.degradedTargets,
                    })}
                  </div>
                  <div className="rounded-2xl border border-zinc-100 bg-white/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                    {t('settings.kernelCenter.rollouts.previewSummary.blocked', {
                      count: rolloutPreview.summary.blockedTargets,
                    })}
                  </div>
                  <div className="rounded-2xl border border-zinc-100 bg-white/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                    {t('settings.kernelCenter.rollouts.previewSummary.predictedWaves', {
                      count: rolloutPreview.summary.predictedWaveCount,
                    })}
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-zinc-100 bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                    {t('settings.kernelCenter.rollouts.blockedTargets.title')}
                  </div>
                  {previewFailures.length === 0 ? (
                    <div className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                      {t('settings.kernelCenter.rollouts.blockedTargets.empty')}
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                      {previewFailures.map((target) => (
                        <div
                          key={target.nodeId}
                          className="rounded-xl border border-zinc-100 bg-zinc-50/80 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900"
                        >
                          <div className="font-medium text-zinc-800 dark:text-zinc-200">
                            {target.nodeId}
                          </div>
                          <div className="mt-1">{target.blockedReason || target.preflightOutcome}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </Section>

      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Section title={t('settings.kernelCenter.sections.hostOwnership')}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ValueRow
              label={t('settings.kernelCenter.fields.serviceManager')}
              value={serviceManagerLabel}
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.ownership')}
              value={ownershipLabel}
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.startupMode')}
              value={startupModeLabel}
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.controlSocket')}
              value={
                host.controlSocketLabel
                || t('settings.kernelCenter.values.notExposedYet')
              }
              emptyLabel={notAvailableLabel}
              mono
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.controlSocketAvailable')}
              value={translateBoolean(t, Boolean(host.controlSocketAvailable))}
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.serviceConfigPath')}
              value={host.serviceConfigPath || null}
              emptyLabel={notAvailableLabel}
              mono
            />
          </div>
        </Section>

        <Section title={t('settings.kernelCenter.sections.endpointRuntime')}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ValueRow
              label={t('settings.kernelCenter.fields.baseUrl')}
              value={endpoint.baseUrl || null}
              emptyLabel={notAvailableLabel}
              mono
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.websocketUrl')}
              value={endpoint.websocketUrl || null}
              emptyLabel={notAvailableLabel}
              mono
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.preferredPort')}
              value={resolveEndpointPortValue(dashboard, 'preferredPort')}
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.activePort')}
              value={resolveEndpointPortValue(dashboard, 'activePort')}
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.runtimeVersion')}
              value={provenance.runtimeVersion || null}
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.nodeVersion')}
              value={provenance.nodeVersion || null}
              emptyLabel={notAvailableLabel}
            />
          </div>
        </Section>

        <Section title={t('settings.kernelCenter.sections.startupEvidence')}>
          <div
            data-slot="kernel-center-startup-evidence"
            className="grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            <ValueRow
              label={t('settings.kernelCenter.fields.startupEvidenceStatus')}
              value={startupEvidence.status || null}
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.startupEvidencePhase')}
              value={startupEvidence.phase || null}
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.startupEvidenceRunId')}
              value={
                startupEvidence.runId === null
                  ? null
                  : String(startupEvidence.runId)
              }
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.startupEvidenceRecordedAt')}
              value={startupEvidence.recordedAt || null}
              emptyLabel={notAvailableLabel}
              mono
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.startupEvidenceDuration')}
              value={formatDurationMsValue(startupEvidence.durationMs)}
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.startupEvidenceReady')}
              value={
                startupEvidence.ready === null
                  ? null
                  : translateBoolean(t, startupEvidence.ready)
              }
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.startupEvidencePath')}
              value={startupEvidence.path || null}
              emptyLabel={notAvailableLabel}
              mono
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.startupEvidenceDescriptorMode')}
              value={startupEvidence.descriptorMode || null}
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.startupEvidenceDescriptorLifecycle')}
              value={startupEvidence.descriptorLifecycle || null}
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.startupEvidenceDescriptorEndpointId')}
              value={startupEvidence.descriptorEndpointId || null}
              emptyLabel={notAvailableLabel}
              mono
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.startupEvidenceDescriptorRequestedPort')}
              value={
                startupEvidence.descriptorRequestedPort === null
                  ? null
                  : String(startupEvidence.descriptorRequestedPort)
              }
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.startupEvidenceDescriptorActivePort')}
              value={
                startupEvidence.descriptorActivePort === null
                  ? null
                  : String(startupEvidence.descriptorActivePort)
              }
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.startupEvidenceDescriptorLoopbackOnly')}
              value={
                startupEvidence.descriptorLoopbackOnly === null
                  ? null
                  : translateBoolean(t, startupEvidence.descriptorLoopbackOnly)
              }
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.startupEvidenceDescriptorDynamicPort')}
              value={
                startupEvidence.descriptorDynamicPort === null
                  ? null
                  : translateBoolean(t, startupEvidence.descriptorDynamicPort)
              }
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.startupEvidenceDescriptorStateStoreDriver')}
              value={startupEvidence.descriptorStateStoreDriver || null}
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.startupEvidenceDescriptorStateStoreProfileId')}
              value={startupEvidence.descriptorStateStoreProfileId || null}
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.startupEvidenceDescriptorBrowserBaseUrl')}
              value={startupEvidence.descriptorBrowserBaseUrl || null}
              emptyLabel={notAvailableLabel}
              mono
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.startupEvidenceManageBaseUrl')}
              value={startupEvidence.manageBaseUrl || null}
              emptyLabel={notAvailableLabel}
              mono
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.startupEvidenceBuiltInInstanceId')}
              value={startupEvidence.builtInInstanceId || null}
              emptyLabel={notAvailableLabel}
              mono
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.startupEvidenceBuiltInInstanceName')}
              value={startupEvidence.builtInInstanceName || null}
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.startupEvidenceBuiltInInstanceVersion')}
              value={startupEvidence.builtInInstanceVersion || null}
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.startupEvidenceBuiltInInstanceRuntimeKind')}
              value={startupEvidence.builtInInstanceRuntimeKind || null}
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.startupEvidenceBuiltInInstanceDeploymentMode')}
              value={startupEvidence.builtInInstanceDeploymentMode || null}
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.startupEvidenceBuiltInInstanceTransportKind')}
              value={startupEvidence.builtInInstanceTransportKind || null}
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.startupEvidenceBuiltInInstanceBaseUrl')}
              value={startupEvidence.builtInInstanceBaseUrl || null}
              emptyLabel={notAvailableLabel}
              mono
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.startupEvidenceBuiltInInstanceWebsocketUrl')}
              value={startupEvidence.builtInInstanceWebsocketUrl || null}
              emptyLabel={notAvailableLabel}
              mono
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.startupEvidenceBuiltInInstanceIsBuiltIn')}
              value={
                startupEvidence.builtInInstanceIsBuiltIn === null
                  ? null
                  : translateBoolean(t, startupEvidence.builtInInstanceIsBuiltIn)
              }
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.startupEvidenceBuiltInInstanceIsDefault')}
              value={
                startupEvidence.builtInInstanceIsDefault === null
                  ? null
                  : translateBoolean(t, startupEvidence.builtInInstanceIsDefault)
              }
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.startupEvidenceBuiltInInstanceStatus')}
              value={startupEvidence.builtInInstanceStatus || null}
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.startupEvidenceRuntimeLifecycle')}
              value={startupEvidence.runtimeLifecycle || null}
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.startupEvidenceGatewayLifecycle')}
              value={startupEvidence.gatewayLifecycle || null}
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.startupEvidenceErrorCause')}
              value={startupEvidence.errorCause || null}
              emptyLabel={noneLabel}
              mono
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.startupEvidenceErrorMessage')}
              value={startupEvidence.errorMessage || null}
              emptyLabel={noneLabel}
              mono
            />
          </div>
        </Section>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Section title={t('settings.kernelCenter.sections.storage')}>
          <div className="space-y-4">
            <ValueRow
              label={t('settings.kernelCenter.fields.activeProfile')}
              value={storage.activeProfileLabel || storage.activeProfileId || null}
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.profilePath')}
              value={storage.activeProfilePath || null}
              emptyLabel={notAvailableLabel}
              mono
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.storageRoot')}
              value={storage.rootDir || null}
              emptyLabel={notAvailableLabel}
              mono
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.profileCount')}
              value={String(storage.profileCount || 0)}
              emptyLabel={notAvailableLabel}
            />
          </div>
        </Section>

        <Section title={t('settings.kernelCenter.sections.provenance')}>
          <div className="space-y-4">
            <ValueRow
              label={t('settings.kernelCenter.fields.installSource')}
              value={installSourceLabel}
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.platform')}
              value={provenance.platformLabel || null}
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.configFilePath')}
              value={provenance.configFile || null}
              emptyLabel={notAvailableLabel}
              mono
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.runtimeHome')}
              value={provenance.runtimeHomeDir || null}
              emptyLabel={notAvailableLabel}
              mono
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.runtimeInstallDir')}
              value={provenance.runtimeInstallDir || null}
              emptyLabel={notAvailableLabel}
              mono
            />
          </div>
        </Section>

        <div data-slot="kernel-center-runtime-authority">
          <Section title={t('settings.kernelCenter.sections.runtimeAuthority')}>
            <div className="space-y-4">
              <ValueRow
                label={t('settings.kernelCenter.fields.configFilePath')}
                value={runtimeAuthority.configFile || null}
                emptyLabel={notAvailableLabel}
                mono
              />
              {runtimeAuthority.ownedRuntimeRoots.map((root, index) => (
                <ValueRow
                  key={`${root}-${index}`}
                  label={t('settings.kernelCenter.fields.ownedRuntimeRoot', {
                    index: index + 1,
                  })}
                  value={root}
                  emptyLabel={notAvailableLabel}
                  mono
                />
              ))}
              <ValueRow
                label={t('settings.kernelCenter.fields.supportsLoopbackHealthProbe')}
                value={
                  runtimeAuthority.supportsLoopbackHealthProbe === null
                    ? null
                    : translateBoolean(t, runtimeAuthority.supportsLoopbackHealthProbe)
                }
                emptyLabel={notAvailableLabel}
              />
              <ValueRow
                label={t('settings.kernelCenter.fields.healthProbeTimeoutMs')}
                value={
                  runtimeAuthority.healthProbeTimeoutMs === null
                    ? null
                    : `${runtimeAuthority.healthProbeTimeoutMs} ms`
                }
                emptyLabel={notAvailableLabel}
              />
            </div>
          </Section>
        </div>

        <Section title={t('settings.kernelCenter.sections.capabilityRollup')}>
          <div className="space-y-4 text-sm text-zinc-600 dark:text-zinc-400">
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                {t('settings.kernelCenter.capabilityRollup.ready')}
              </div>
              <div className="mt-2 text-zinc-800 dark:text-zinc-200">
                {renderList(capabilities.readyKeys, noneLabel)}
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                {t('settings.kernelCenter.capabilityRollup.planned')}
              </div>
              <div className="mt-2 text-zinc-800 dark:text-zinc-200">
                {renderList(capabilities.plannedKeys, noneLabel)}
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                {t('settings.kernelCenter.capabilityRollup.bundledComponents')}
              </div>
              <div className="mt-2 text-zinc-800 dark:text-zinc-200">
                {t('settings.kernelCenter.capabilityRollup.bundledComponentsSummary', {
                  count: dashboard?.info?.bundledComponents.componentCount ?? 0,
                  autoStartCount:
                    dashboard?.info?.bundledComponents.defaultStartupComponentIds.length ?? 0,
                })}
              </div>
            </div>
          </div>
        </Section>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Section title={t('settings.kernelCenter.sections.localAiProxy')}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ValueRow
              label={t('settings.kernelCenter.fields.localAiProxyLifecycle')}
              value={localAiProxyLifecycleLabel}
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.localAiProxyRootBaseUrl')}
              value={localAiProxy.rootBaseUrl || null}
              emptyLabel={notAvailableLabel}
              mono
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.baseUrl')}
              value={localAiProxy.baseUrl || null}
              emptyLabel={notAvailableLabel}
              mono
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.openaiCompatibleBaseUrl')}
              value={localAiProxy.openaiCompatibleBaseUrl || null}
              emptyLabel={notAvailableLabel}
              mono
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.anthropicBaseUrl')}
              value={localAiProxy.anthropicBaseUrl || null}
              emptyLabel={notAvailableLabel}
              mono
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.geminiBaseUrl')}
              value={localAiProxy.geminiBaseUrl || null}
              emptyLabel={notAvailableLabel}
              mono
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.activePort')}
              value={resolveLocalAiProxyPortValue(dashboard)}
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.modelCount')}
              value={String(localAiProxy.modelCount)}
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.messageCaptureEnabled')}
              value={translateBoolean(t, Boolean(localAiProxy.messageCaptureEnabled))}
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.observabilityDbPath')}
              value={localAiProxy.observabilityDbPath || null}
              emptyLabel={notAvailableLabel}
              mono
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.defaultRoute')}
              value={localAiProxy.defaultRouteName || null}
              emptyLabel={noneLabel}
            />
            {localAiProxy.defaultRoutes.map((route) => (
              <ValueRow
                key={route.clientProtocol}
                label={t('settings.kernelCenter.localAiProxy.defaultRouteLabel', {
                  protocol: formatLocalAiProxyClientProtocolLabel(t, route.clientProtocol),
                })}
                value={formatLocalAiProxyDefaultRouteValue(t, route)}
                emptyLabel={noneLabel}
              />
            ))}
            <ValueRow
              label={t('settings.kernelCenter.fields.upstreamBaseUrl')}
              value={localAiProxy.upstreamBaseUrl || null}
              emptyLabel={notAvailableLabel}
              mono
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.routeMetrics')}
              value={String(localAiProxy.routeMetrics.length)}
              emptyLabel={notAvailableLabel}
            />
            {localAiProxy.routeMetrics.map((metric) => (
              <ValueRow
                key={`metric-${metric.routeId}`}
                label={t('settings.kernelCenter.localAiProxy.routeMetricLabel', {
                  routeId: metric.routeId,
                })}
                value={formatLocalAiProxyRouteMetricSummary(metric, {
                  health: translateLocalAiProxyRouteHealth(t, metric.health),
                  requests: t('settings.kernelCenter.localAiProxy.observability.requests'),
                  successes: t('settings.kernelCenter.localAiProxy.observability.successes'),
                  failures: t('settings.kernelCenter.localAiProxy.observability.failures'),
                  rpm: t('settings.kernelCenter.localAiProxy.observability.rpm'),
                  totalTokens: t('settings.kernelCenter.localAiProxy.observability.totalTokens'),
                  averageLatency: t(
                    'settings.kernelCenter.localAiProxy.observability.averageLatency',
                  ),
                  lastLatency: t('settings.kernelCenter.localAiProxy.observability.lastLatency'),
                  lastUsedAt: t('settings.kernelCenter.localAiProxy.observability.lastUsedAt'),
                  lastError: t('settings.kernelCenter.localAiProxy.observability.lastError'),
                })}
                emptyLabel={noneLabel}
              />
            ))}
            <ValueRow
              label={t('settings.kernelCenter.fields.routeTests')}
              value={String(localAiProxy.routeTests.length)}
              emptyLabel={notAvailableLabel}
            />
            {localAiProxy.routeTests.map((test) => (
              <ValueRow
                key={`test-${test.routeId}`}
                label={t('settings.kernelCenter.localAiProxy.routeTestLabel', {
                  routeId: test.routeId,
                })}
                value={formatLocalAiProxyRouteTestSummary(
                  {
                    ...test,
                    checkedCapability: translateLocalAiProxyRouteTestCapability(
                      t,
                      test.checkedCapability,
                    ),
                  },
                  {
                    status: translateLocalAiProxyRouteTestStatus(t, test.status),
                    capability: t('settings.kernelCenter.localAiProxy.observability.capability'),
                    testedAt: t('settings.kernelCenter.localAiProxy.observability.testedAt'),
                    latency: t('settings.kernelCenter.localAiProxy.observability.latency'),
                    model: t('settings.kernelCenter.localAiProxy.observability.model'),
                    error: t('settings.kernelCenter.localAiProxy.observability.lastError'),
                  },
                )}
                emptyLabel={noneLabel}
              />
            ))}
            <ValueRow
              label={t('settings.kernelCenter.fields.loopbackOnly')}
              value={translateBoolean(t, Boolean(localAiProxy.loopbackOnly))}
              emptyLabel={notAvailableLabel}
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.lastError')}
              value={localAiProxy.lastError || null}
              emptyLabel={noneLabel}
              mono
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.configFilePath')}
              value={localAiProxy.configFile || null}
              emptyLabel={notAvailableLabel}
              mono
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.snapshotPath')}
              value={localAiProxy.snapshotPath || null}
              emptyLabel={notAvailableLabel}
              mono
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.logPath')}
              value={localAiProxy.logPath || null}
              emptyLabel={notAvailableLabel}
              mono
            />
          </div>
        </Section>

        <Section title={t('settings.kernelCenter.sections.managedDirectories')}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ValueRow
              label={t('settings.kernelCenter.fields.machineState')}
              value={dashboard?.info?.directories.machineStateDir || null}
              emptyLabel={notAvailableLabel}
              mono
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.machineStaging')}
              value={dashboard?.info?.directories.machineStagingDir || null}
              emptyLabel={notAvailableLabel}
              mono
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.userRoot')}
              value={dashboard?.info?.directories.userRoot || null}
              emptyLabel={notAvailableLabel}
              mono
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.studioDir')}
              value={dashboard?.info?.directories.studioDir || null}
              emptyLabel={notAvailableLabel}
              mono
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.storageDir')}
              value={dashboard?.info?.directories.storageDir || null}
              emptyLabel={notAvailableLabel}
              mono
            />
            <ValueRow
              label={t('settings.kernelCenter.fields.backupsDir')}
              value={dashboard?.info?.directories.backupsDir || null}
              emptyLabel={notAvailableLabel}
              mono
            />
          </div>
        </Section>

        <Section title={t('settings.kernelCenter.sections.supervisorAndBundles')}>
          <div className="space-y-4">
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                <Box className="h-4 w-4" />
                {t('settings.kernelCenter.bundles.supervisor')}
              </div>
              <div className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {t('settings.kernelCenter.bundles.supervisorSummary', {
                  lifecycle: translateSupervisorLifecycle(t, dashboard?.info?.supervisor.lifecycle),
                  count: dashboard?.info?.supervisor.serviceCount ?? 0,
                })}
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                <Database className="h-4 w-4" />
                {t('settings.kernelCenter.bundles.bundledStartupSet')}
              </div>
              <div className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {renderList(
                  dashboard?.info?.bundledComponents.defaultStartupComponentIds || [],
                  noneLabel,
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                <HardDrive className="h-4 w-4" />
                {t('settings.kernelCenter.bundles.silentHostTarget')}
              </div>
              <div className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {t('settings.kernelCenter.bundles.silentHostTargetDescription', {
                  serviceManager: serviceManagerLabel,
                })}
              </div>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
