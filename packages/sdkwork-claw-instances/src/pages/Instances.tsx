import { useEffect, useEffectEvent, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Apple,
  Box,
  CheckCircle2,
  ChevronRight,
  Cpu,
  DollarSign,
  FileText,
  MemoryStick,
  MoreVertical,
  Play,
  RefreshCw,
  Server,
  Sparkles,
  Square,
  Terminal,
  Trash2,
  Waypoints,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  instanceDirectoryService,
  resolvePreferredActiveInstanceId,
  useInstanceStore,
} from '@sdkwork/claw-core';
import { openDiagnosticPath, runtime } from '@sdkwork/claw-infrastructure';
import { listKernelReleaseConfigs, type KernelReleaseConfig } from '@sdkwork/claw-types';
import { Button } from '@sdkwork/claw-ui';
import {
  buildBundledOpenClawStartupAlert,
  buildBundledStartupRecoveryHandler,
  buildInstanceActionCapabilities,
  BUILT_IN_OPENCLAW_STARTUP_REFRESH_INTERVAL_MS,
  hasPendingBuiltInOpenClawStartup,
  instanceService,
  loadInstanceActionCapabilities,
  shouldRefreshInstancesForBuiltInOpenClawStatusChange,
  type BundledOpenClawStartupAlert,
  type InstanceActionCapabilities,
} from '../services';
import { BuiltInOpenClawStartupBanner } from '../components/BuiltInOpenClawStartupBanner';
import { Instance } from '../types';

interface BuiltInOpenClawStartupAlertRecord {
  instanceId: string;
  instanceName: string;
  alert: BundledOpenClawStartupAlert;
  canRetry: boolean;
  preferRestart: boolean;
}

type InstancesTopTab = 'activeInstances' | 'supportedKernels';

const KERNEL_RELEASE_ORDER = ['openclaw', 'hermes'] as const;

function formatMemoryLabel(memory: number) {
  return `${memory} MB`;
}

function formatVersionLabel(version: string) {
  return `v${version}`;
}

function formatKernelVersionLabel(version: string) {
  return /^\d/.test(version) ? `v${version}` : version;
}

function formatKernelName(kernelId: string) {
  switch (kernelId) {
    case 'openclaw':
      return 'OpenClaw';
    case 'hermes':
      return 'Hermes';
    default:
      return kernelId;
  }
}

function formatKernelRequirements(config: KernelReleaseConfig) {
  const versions = config.runtimeRequirements?.requiredExternalRuntimeVersions ?? {};
  const requirements = config.runtimeRequirements?.requiredExternalRuntimes ?? [];

  if (requirements.length === 0) {
    return 'None';
  }

  return requirements
    .map((runtimeId) => {
      switch (runtimeId) {
        case 'nodejs':
          return versions.nodejs ? `Node.js ${versions.nodejs}` : 'Node.js';
        case 'python':
          return versions.python ? `Python ${versions.python}` : 'Python';
        case 'uv':
          return versions.uv ? `uv ${versions.uv}` : 'uv';
        default:
          return versions[runtimeId] ? `${runtimeId} ${versions[runtimeId]}` : runtimeId;
      }
    })
    .join(' / ');
}

function resolveKernelPlatformLabel(
  config: KernelReleaseConfig,
  t: (key: string) => string,
) {
  const windowsCompatibility = String(config.compatibility?.windows ?? '').trim();
  return windowsCompatibility === 'wsl2OrRemoteOnly'
    ? t('instances.list.supportedKernels.platforms.wsl2OrRemoteOnly')
    : t('instances.list.supportedKernels.platforms.native');
}

function sortKernelReleaseConfigs(left: KernelReleaseConfig, right: KernelReleaseConfig) {
  const leftIndex = KERNEL_RELEASE_ORDER.indexOf(left.kernelId as (typeof KERNEL_RELEASE_ORDER)[number]);
  const rightIndex = KERNEL_RELEASE_ORDER.indexOf(
    right.kernelId as (typeof KERNEL_RELEASE_ORDER)[number],
  );

  if (leftIndex === -1 && rightIndex === -1) {
    return left.kernelId.localeCompare(right.kernelId);
  }
  if (leftIndex === -1) {
    return 1;
  }
  if (rightIndex === -1) {
    return -1;
  }

  return leftIndex - rightIndex;
}

function getIcon(type: string) {
  switch (type) {
    case 'apple':
      return <Apple className="h-5 w-5 text-zinc-700 dark:text-zinc-300" />;
    case 'box':
      return <Box className="h-5 w-5 text-primary-500" />;
    case 'server':
      return <Server className="h-5 w-5 text-primary-500" />;
    default:
      return <Server className="h-5 w-5 text-zinc-500" />;
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'online':
      return 'bg-emerald-500 shadow-emerald-500/50';
    case 'offline':
      return 'bg-zinc-400';
    case 'starting':
    case 'syncing':
      return 'bg-amber-500 animate-pulse shadow-amber-500/50';
    case 'error':
      return 'bg-red-500 shadow-red-500/50';
    default:
      return 'bg-zinc-400';
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'online':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400';
    case 'offline':
      return 'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400';
    case 'starting':
    case 'syncing':
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400';
    case 'error':
      return 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400';
    default:
      return 'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400';
  }
}

export function Instances() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTopTab, setActiveTopTab] = useState<InstancesTopTab>('activeInstances');
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [actionCapabilitiesByInstanceId, setActionCapabilitiesByInstanceId] = useState<
    Record<string, InstanceActionCapabilities>
  >({});
  const [builtInStartupAlert, setBuiltInStartupAlert] =
    useState<BuiltInOpenClawStartupAlertRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRetryingBuiltInStartup, setIsRetryingBuiltInStartup] = useState(false);
  const { activeInstanceId, setActiveInstanceId } = useInstanceStore();

  const getStatusLabel = (status: string) => t(`instances.shared.status.${status}`);
  const getActionLabel = (action: string) => t(`instances.list.actionNames.${action}`);
  const topTabs = [
    {
      id: 'activeInstances' as const,
      label: t('instances.list.tabs.activeInstances'),
    },
    {
      id: 'supportedKernels' as const,
      label: t('instances.list.tabs.supportedKernels'),
    },
  ];
  const supportedKernels = listKernelReleaseConfigs().sort(sortKernelReleaseConfigs);
  const getDiagnosticOpenFailureLabel = () => {
    const translated = t('instances.list.toasts.openDiagnosticFailed');
    return translated === 'instances.list.toasts.openDiagnosticFailed'
      ? 'Unable to open the diagnostic location'
      : translated;
  };

  const loadInstances = async (
    options: {
      withSpinner?: boolean;
      silentError?: boolean;
      preferredActiveInstanceId?: string | null;
    } = {},
  ) => {
    if (options.withSpinner !== false) {
      setIsLoading(true);
    }

    try {
      const data = await instanceService.getInstances();
      setInstances(data);
      const nextActiveInstanceId = resolvePreferredActiveInstanceId({
        instances: data,
        activeInstanceId,
        preferredInstanceId: options.preferredActiveInstanceId,
      });
      if (nextActiveInstanceId !== activeInstanceId) {
        setActiveInstanceId(nextActiveInstanceId);
      }
      setActionCapabilitiesByInstanceId(
        Object.fromEntries(
          data.map((instance) => [instance.id, buildInstanceActionCapabilities(instance, null)]),
        ),
      );

      const detailPromises = new Map<
        string,
        Promise<Awaited<ReturnType<typeof instanceService.getInstanceDetail>> | null>
      >();
      const loadDetail = (instanceId: string) => {
        if (!detailPromises.has(instanceId)) {
          detailPromises.set(
            instanceId,
            instanceService.getInstanceDetail(instanceId).catch(() => null),
          );
        }

        return detailPromises.get(instanceId)!;
      };

      const nextActionCapabilities = await loadInstanceActionCapabilities(data, loadDetail);
      setActionCapabilitiesByInstanceId(nextActionCapabilities);

      const builtInDetailRecords = await Promise.all(
        data
          .filter((instance) => instance.isBuiltIn)
          .map(async (instance) => ({
            instance,
            detail: await loadDetail(instance.id),
          })),
      );

      const nextBuiltInStartupAlert =
        builtInDetailRecords.find(({ detail }) => Boolean(buildBundledOpenClawStartupAlert(detail))) ||
        null;

      if (nextBuiltInStartupAlert) {
        const alert = buildBundledOpenClawStartupAlert(nextBuiltInStartupAlert.detail);
        const capabilities =
          nextActionCapabilities[nextBuiltInStartupAlert.instance.id] ||
          buildInstanceActionCapabilities(
            nextBuiltInStartupAlert.instance,
            nextBuiltInStartupAlert.detail,
          );

        setBuiltInStartupAlert(
          alert
            ? {
                instanceId: nextBuiltInStartupAlert.instance.id,
                instanceName: nextBuiltInStartupAlert.instance.name,
                alert,
                canRetry: capabilities.canStart || capabilities.canRestart,
                preferRestart: capabilities.canRestart,
              }
            : null,
        );
      } else {
        setBuiltInStartupAlert(null);
      }
    } catch (error: any) {
      if (options.silentError !== true) {
        console.error('Failed to fetch instances:', error);
        toast.error(t('instances.list.toasts.loadFailed'), {
          description: error?.message,
        });
        setActionCapabilitiesByInstanceId({});
        setBuiltInStartupAlert(null);
      }
    } finally {
      if (options.withSpinner !== false) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadInstances();
  }, []);

  const handleBuiltInOpenClawStatusChanged = useEffectEvent((event: { instanceId: string }) => {
    if (!shouldRefreshInstancesForBuiltInOpenClawStatusChange(instances, event)) {
      return;
    }

    void loadInstances({
      withSpinner: false,
      silentError: true,
    });
  });

  useEffect(() => {
    let disposed = false;
    let unsubscribe = () => {};

    void runtime
      .subscribeBuiltInOpenClawStatusChanged((event) => {
        handleBuiltInOpenClawStatusChanged(event);
      })
      .then((nextUnsubscribe) => {
        if (disposed) {
          void nextUnsubscribe();
          return;
        }

        unsubscribe = nextUnsubscribe;
      })
      .catch((error) => {
        console.warn('Failed to subscribe to built-in OpenClaw status changes:', error);
      });

    return () => {
      disposed = true;
      void unsubscribe();
    };
  }, [handleBuiltInOpenClawStatusChanged]);

  useEffect(() => {
    if (!hasPendingBuiltInOpenClawStartup(instances)) {
      return;
    }

    const timeoutHandle = window.setTimeout(() => {
      void loadInstances({
        withSpinner: false,
        silentError: true,
      });
    }, BUILT_IN_OPENCLAW_STARTUP_REFRESH_INTERVAL_MS);

    return () => {
      window.clearTimeout(timeoutHandle);
    };
  }, [instances]);

  const handleAction = async (event: ReactMouseEvent, action: string, id: string) => {
    event.stopPropagation();
    setActiveDropdown(null);
    const capabilities = actionCapabilitiesByInstanceId[id];

    if (action === 'start' && !capabilities?.canStart) {
      return;
    }
    if (action === 'stop' && !capabilities?.canStop) {
      return;
    }
    if (action === 'restart' && !capabilities?.canRestart) {
      return;
    }
    if (action === 'delete' && capabilities?.canDelete === false) {
      return;
    }

    try {
      if (action === 'start') {
        await instanceService.startInstance(id);
        setActiveInstanceId(id);
        toast.success(t('instances.list.toasts.started'));
      } else if (action === 'stop') {
        await instanceService.stopInstance(id);
        toast.success(t('instances.list.toasts.stopped'));
      } else if (action === 'restart') {
        await instanceService.restartInstance(id);
        setActiveInstanceId(id);
        toast.success(t('instances.list.toasts.restarted'));
      } else if (action === 'delete') {
        if (!window.confirm(t('instances.list.confirmUninstall'))) {
          return;
        }

        await instanceService.deleteInstance(id);
        toast.success(t('instances.list.toasts.uninstalled'));
        if (activeInstanceId === id) {
          setActiveInstanceId(null);
        }
      }

      await instanceDirectoryService.refresh().catch(() => undefined);
      await loadInstances({
        preferredActiveInstanceId:
          action === 'start' || action === 'restart' ? id : null,
      });
    } catch (error: any) {
      console.error(`Failed to ${action} instance:`, error);
      toast.error(t('instances.list.toasts.actionFailed', { action: getActionLabel(action) }), {
        description: error?.message,
      });
    }
  };

  const handleOpenBuiltInStartupDetails = () => {
    if (!builtInStartupAlert) {
      return;
    }

    navigate(`/instances/${builtInStartupAlert.instanceId}`);
  };

  const handleOpenBuiltInInstall = () => {
    navigate('/docs#script');
  };

  const handleOpenBuiltInDiagnosticPath = async (
    diagnostic: BundledOpenClawStartupAlert['diagnostics'][number],
  ) => {
    const mode =
      diagnostic.id === 'desktopMainLogPath'
        ? 'reveal'
        : diagnostic.id === 'gatewayLogPath'
          ? 'open'
          : null;
    if (!mode) {
      return;
    }

    try {
      await openDiagnosticPath(diagnostic.value, { mode });
    } catch (error: any) {
      toast.error(getDiagnosticOpenFailureLabel(), {
        description: error?.message,
      });
    }
  };

  const handleRetryBuiltInStartup = buildBundledStartupRecoveryHandler({
    instanceId: builtInStartupAlert?.instanceId,
    canRetryBundledStartup: Boolean(builtInStartupAlert?.canRetry),
    preferRestart: builtInStartupAlert?.preferRestart ?? false,
    runLifecycleAction: async (request) => {
      setIsRetryingBuiltInStartup(true);
      try {
        await request.execute(request.instanceId);
        setActiveInstanceId(request.instanceId);
        toast.success(t(request.successKey));
      } catch (error: any) {
        toast.error(error?.message || t(request.failureKey));
      } finally {
        setIsRetryingBuiltInStartup(false);
        await instanceDirectoryService.refresh().catch(() => undefined);
        await loadInstances({
          withSpinner: false,
          silentError: true,
          preferredActiveInstanceId: request.instanceId,
        });
      }
    },
    executeRestart: async (instanceId) => {
      await instanceService.restartInstance(instanceId);
    },
    executeStart: async (instanceId) => {
      await instanceService.startInstance(instanceId);
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      <div className="scrollbar-hide flex-1 overflow-y-auto p-4 md:p-6">
        <div className="w-full space-y-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <section className="flex flex-wrap gap-2" data-slot="instances-top-tabs">
              {topTabs.map((tab) => {
                const isActive = activeTopTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTopTab(tab.id)}
                    className={`inline-flex items-center rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
                      isActive
                        ? 'border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-900/60 dark:bg-primary-950/40 dark:text-primary-300'
                        : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </section>

            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => void loadInstances()}
                className="rounded-xl px-4"
              >
                <RefreshCw className="h-4 w-4" />
                {t('instances.list.actions.refresh')}
              </Button>
            </div>
          </div>

          {activeTopTab === 'activeInstances' ? (
            <>
              {builtInStartupAlert ? (
                <BuiltInOpenClawStartupBanner
                  instanceName={builtInStartupAlert.instanceName}
                  alert={builtInStartupAlert.alert}
                  canRetry={builtInStartupAlert.canRetry}
                  isRetrying={isRetryingBuiltInStartup}
                  onRetry={handleRetryBuiltInStartup}
                  onOpenDetails={handleOpenBuiltInStartupDetails}
                  onOpenDiagnosticPath={handleOpenBuiltInDiagnosticPath}
                  t={t}
                />
              ) : null}

              {instances.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/75 px-6 py-12 text-center dark:border-zinc-700 dark:bg-zinc-950/35">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-white text-zinc-700 shadow-sm dark:bg-zinc-800 dark:text-zinc-200">
                    <Waypoints className="h-6 w-6" />
                  </div>
                  <h2 className="mt-5 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                    {t('instances.list.emptyTitle')}
                  </h2>
                  <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                    {t('instances.list.emptyDescription')}
                  </p>
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {instances.map((instance, index) => {
              const isActive = activeInstanceId === instance.id;
              const actionCapabilities =
                actionCapabilitiesByInstanceId[instance.id] ||
                buildInstanceActionCapabilities(instance, null);
              const canSetActive = actionCapabilities.canSetActive;
              const canRestartLifecycle = actionCapabilities.canRestart;
              const canStopLifecycle = actionCapabilities.canStop;
              const canStartLifecycle = actionCapabilities.canStart;
              const canDelete = actionCapabilities.canDelete;

              return (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  key={instance.id}
                  className={`group relative flex flex-col rounded-2xl border bg-white p-6 transition-all duration-300 dark:bg-zinc-900 ${
                    isActive
                      ? 'border-primary-500 shadow-md shadow-primary-500/10 ring-1 ring-primary-500/50'
                      : 'border-zinc-200/80 hover:border-zinc-300 hover:shadow-lg hover:shadow-zinc-200/20 dark:border-zinc-800/80 dark:hover:border-zinc-700 dark:hover:shadow-none'
                  }`}
                >
                  {isActive ? (
                    <div className="absolute -right-3 -top-3 flex items-center gap-1.5 rounded-full bg-primary-500 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {t('instances.list.activeBadge')}
                    </div>
                  ) : null}

                  <div className="mb-6 flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border shadow-sm transition-transform duration-300 group-hover:scale-105 ${
                          isActive
                            ? 'border-primary-200 bg-primary-50 dark:border-primary-500/20 dark:bg-primary-500/10'
                            : 'border-zinc-100 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800'
                        }`}
                      >
                        {getIcon(instance.iconType)}
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <h3
                            onClick={() => navigate(`/instances/${instance.id}`)}
                            className="cursor-pointer text-lg font-bold tracking-tight text-zinc-900 transition-colors hover:text-primary-600 dark:text-zinc-100 dark:hover:text-primary-400"
                          >
                            {instance.name}
                          </h3>
                          <div
                            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${getStatusBadge(
                              instance.status,
                            )}`}
                          >
                            <div
                              className={`h-1.5 w-1.5 rounded-full shadow-sm ${getStatusColor(instance.status)}`}
                            />
                            {getStatusLabel(instance.status)}
                          </div>
                        </div>
                        <div className="mt-1.5 flex items-center gap-3">
                          <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                            {instance.type}
                          </span>
                          <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                          <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-mono text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                            {instance.ip}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="relative flex items-center gap-2">
                      {!isActive && canSetActive ? (
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            setActiveInstanceId(instance.id);
                          }}
                          className="hidden items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-200 hover:text-zinc-900 sm:flex dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                        >
                          {t('instances.list.actions.setActive')}
                        </button>
                      ) : null}
                      <button
                        onClick={() =>
                          setActiveDropdown(activeDropdown === instance.id ? null : instance.id)
                        }
                        className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                      >
                        <MoreVertical className="h-5 w-5" />
                      </button>

                      {activeDropdown === instance.id ? (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setActiveDropdown(null)} />
                          <div className="absolute right-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
                            {!isActive && canSetActive ? (
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setActiveInstanceId(instance.id);
                                  setActiveDropdown(null);
                                }}
                                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 sm:hidden dark:text-zinc-300 dark:hover:bg-zinc-800"
                              >
                                <CheckCircle2 className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                                {t('instances.list.actions.setAsActive')}
                              </button>
                            ) : null}
                            {instance.status === 'online' ? (
                              <>
                                <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800">
                                  <Terminal className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                                  {t('instances.list.actions.openTerminal')}
                                </button>
                                <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800">
                                  <FileText className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                                  {t('instances.list.actions.viewLogs')}
                                </button>
                                {canRestartLifecycle ? (
                                  <button
                                    onClick={(event) => void handleAction(event, 'restart', instance.id)}
                                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                  >
                                    <RefreshCw className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                                    {t('instances.list.actions.restart')}
                                  </button>
                                ) : null}
                                {canStopLifecycle ? (
                                  <>
                                    <div className="my-1 h-px bg-zinc-100 dark:bg-zinc-800" />
                                    <button
                                      onClick={(event) => void handleAction(event, 'stop', instance.id)}
                                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-amber-600 transition-colors hover:bg-amber-50 dark:text-amber-500 dark:hover:bg-amber-500/10"
                                    >
                                      <Square className="h-4 w-4" />
                                      {t('instances.list.actions.stopInstance')}
                                    </button>
                                  </>
                                ) : null}
                                {canDelete ? (
                                  <button
                                    onClick={(event) => void handleAction(event, 'delete', instance.id)}
                                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-500 dark:hover:bg-red-500/10"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    {t('instances.list.actions.uninstall')}
                                  </button>
                                ) : null}
                              </>
                            ) : (
                              <>
                                {canStartLifecycle ? (
                                  <>
                                    <button
                                      onClick={(event) => void handleAction(event, 'start', instance.id)}
                                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-emerald-600 transition-colors hover:bg-emerald-50 dark:text-emerald-500 dark:hover:bg-emerald-500/10"
                                    >
                                      <Play className="h-4 w-4" />
                                      {t('instances.list.actions.startInstance')}
                                    </button>
                                    <div className="my-1 h-px bg-zinc-100 dark:bg-zinc-800" />
                                  </>
                                ) : null}
                                {canDelete ? (
                                  <button
                                    onClick={(event) => void handleAction(event, 'delete', instance.id)}
                                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-500 dark:hover:bg-red-500/10"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    {t('instances.list.actions.uninstall')}
                                  </button>
                                ) : null}
                              </>
                            )}
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="mb-6 grid grid-cols-2 gap-4">
                    <div className="rounded-xl border border-zinc-100 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-800/50">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          <Cpu className="h-3.5 w-3.5" />
                          {t('instances.list.metrics.cpu')}
                        </div>
                        <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                          {instance.cpu}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                        <div
                          className="h-full rounded-full bg-primary-500"
                          style={{ width: `${instance.cpu}%` }}
                        />
                      </div>
                    </div>

                    <div className="rounded-xl border border-zinc-100 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-800/50">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          <MemoryStick className="h-3.5 w-3.5" />
                          {t('instances.list.metrics.memory')}
                        </div>
                        <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                          {formatMemoryLabel(instance.memory)}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${Math.min((instance.memory / 1024) * 100, 100)}%` }}
                        />
                      </div>
                      <div className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                        {t('instances.list.metrics.totalMemory', { value: instance.totalMemory })}
                      </div>
                    </div>

                    <div className="rounded-xl border border-zinc-100 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-800/50">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          <DollarSign className="h-3.5 w-3.5" />
                          {t('instances.list.metrics.estimatedCost')}
                        </div>
                        <span className="text-xs font-mono font-medium text-zinc-900 dark:text-zinc-100">
                          {t('instances.list.metrics.monthlyCost', {
                            value: instance.status === 'online' ? '$14.40' : '$0.00',
                          })}
                        </span>
                      </div>
                      <div className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                        {t('instances.list.metrics.hourlyRate', { value: '$0.02' })}
                      </div>
                    </div>

                    <div className="rounded-xl border border-zinc-100 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-800/50">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          <Sparkles className="h-3.5 w-3.5" />
                          {t('instances.list.metrics.apiTokens')}
                        </div>
                        <span className="text-xs font-mono font-medium text-zinc-900 dark:text-zinc-100">
                          {instance.status === 'online' ? '1.2M' : '0'}
                        </span>
                      </div>
                      <div className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                        {t('instances.list.metrics.billingCycle')}
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto flex items-center justify-between border-t border-zinc-100 pt-4 dark:border-zinc-800">
                    <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="flex items-center gap-1.5">
                        <Activity className="h-3.5 w-3.5" />
                        {t('instances.list.metrics.uptime', {
                          value:
                            instance.status === 'online'
                              ? instance.uptime
                              : t('instances.shared.status.offline'),
                        })}
                      </span>
                      <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                      <span className="font-mono">{formatVersionLabel(instance.version)}</span>
                    </div>

                    <button
                      onClick={() => navigate(`/instances/${instance.id}`)}
                      className="flex items-center gap-1 text-sm font-medium text-zinc-900 transition-colors hover:text-primary-600 dark:text-zinc-100 dark:hover:text-primary-400"
                    >
                      {t('instances.list.actions.details')}
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
              </div>
            </>
          ) : (
            <div
              className="grid grid-cols-1 gap-4 xl:grid-cols-2"
              data-slot="instances-supported-kernels"
            >
              {supportedKernels.map((kernel, index) => {
                const isBuiltInKernel = kernel.kernelId === 'openclaw';

                return (
                  <motion.div
                    key={kernel.kernelId}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: index * 0.06 }}
                    className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-4">
                        <div
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${
                            isBuiltInKernel
                              ? 'border-primary-200 bg-primary-50 text-primary-600 dark:border-primary-900/60 dark:bg-primary-950/40 dark:text-primary-300'
                              : 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300'
                          }`}
                        >
                          {isBuiltInKernel ? (
                            <Box className="h-5 w-5" />
                          ) : (
                            <Cpu className="h-5 w-5" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                              {formatKernelName(kernel.kernelId)}
                            </h3>
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                                isBuiltInKernel
                                  ? 'border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-900/60 dark:bg-primary-950/40 dark:text-primary-300'
                                  : 'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300'
                              }`}
                            >
                              {isBuiltInKernel
                                ? t('instances.list.supportedKernels.deployment.bundled')
                                : t('instances.list.supportedKernels.deployment.external')}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                            {t(`instances.list.supportedKernels.summary.${kernel.kernelId}`)}
                          </p>
                        </div>
                      </div>

                      {isBuiltInKernel ? (
                        <Button onClick={handleOpenBuiltInInstall} className="shrink-0 rounded-xl px-4">
                          {t('instances.list.supportedKernels.actions.installBuiltInInstance')}
                        </Button>
                      ) : null}
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/50">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                          {t('instances.list.supportedKernels.fields.stableVersion')}
                        </div>
                        <div className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {formatKernelVersionLabel(kernel.stableVersion)}
                        </div>
                      </div>

                      <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/50">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                          {t('instances.list.supportedKernels.fields.defaultChannel')}
                        </div>
                        <div className="mt-2 text-sm font-medium capitalize text-zinc-900 dark:text-zinc-100">
                          {kernel.defaultChannel}
                        </div>
                      </div>

                      <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/50">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                          {t('instances.list.supportedKernels.fields.requirements')}
                        </div>
                        <div className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {formatKernelRequirements(kernel)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50/70 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/50">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                        {t('instances.list.supportedKernels.fields.platforms')}
                      </div>
                      <div className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {resolveKernelPlatformLabel(kernel, t)}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
