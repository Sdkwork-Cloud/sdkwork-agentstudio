import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowRight,
  RefreshCw,
  RotateCcw,
  Server,
  ShieldCheck,
  Waypoints,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@sdkwork/claw-ui';
import {
  nodeInventoryService,
  type NodeInventoryHealth,
  type NodeInventoryRecord,
  type NodeInventorySnapshot,
} from '../services/index.ts';

type Translate = (key: string, options?: Record<string, unknown>) => string;

function healthToneClasses(health: NodeInventoryHealth) {
  switch (health) {
    case 'ok':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300';
    case 'degraded':
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300';
    default:
      return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300';
  }
}

function translateNodeKind(t: Translate, kind: NodeInventoryRecord['kind']) {
  switch (kind) {
    case 'localPrimary':
      return t('instances.nodes.kinds.localPrimary');
    case 'managedRemote':
      return t('instances.nodes.kinds.managedRemote');
    case 'attachedRemote':
      return t('instances.nodes.kinds.attachedRemote');
    default:
      return t('instances.nodes.kinds.localExternal');
  }
}

function translateHealth(t: Translate, health: NodeInventoryHealth) {
  switch (health) {
    case 'ok':
      return t('instances.nodes.health.ok');
    case 'degraded':
      return t('instances.nodes.health.degraded');
    default:
      return t('instances.nodes.health.quarantined');
  }
}

function translateManagementDescription(
  t: Translate,
  management: NodeInventoryRecord['management'],
) {
  return management === 'managed'
    ? t('instances.nodes.management.managedDescription')
    : t('instances.nodes.management.attachedDescription');
}

function translateTopologyKind(t: Translate, topologyKind: string) {
  switch (topologyKind) {
    case 'localManagedNative':
      return t('instances.nodes.topologies.localManagedNative');
    case 'localManagedWsl':
      return t('instances.nodes.topologies.localManagedWsl');
    case 'localManagedContainer':
      return t('instances.nodes.topologies.localManagedContainer');
    case 'localExternal':
      return t('instances.nodes.topologies.localExternal');
    case 'remoteManagedNode':
      return t('instances.nodes.topologies.remoteManagedNode');
    case 'remoteAttachedNode':
      return t('instances.nodes.topologies.remoteAttachedNode');
    default:
      return t('instances.nodes.topologies.unknown');
  }
}

function translateRuntimeState(t: Translate, runtimeState: string) {
  switch (runtimeState) {
    case 'running':
      return t('instances.nodes.runtimeStates.running');
    case 'starting':
      return t('instances.nodes.runtimeStates.starting');
    case 'recovering':
      return t('instances.nodes.runtimeStates.recovering');
    case 'degraded':
      return t('instances.nodes.runtimeStates.degraded');
    case 'crashLoop':
      return t('instances.nodes.runtimeStates.crashLoop');
    case 'failedSafe':
      return t('instances.nodes.runtimeStates.failedSafe');
    case 'stopped':
      return t('instances.nodes.runtimeStates.stopped');
    case 'online':
      return t('instances.nodes.runtimeStates.online');
    case 'syncing':
      return t('instances.nodes.runtimeStates.syncing');
    case 'offline':
      return t('instances.nodes.runtimeStates.offline');
    case 'error':
      return t('instances.nodes.runtimeStates.error');
    default:
      return t('instances.nodes.runtimeStates.unknown');
  }
}

function formatHostVersion(
  t: Translate,
  host: string | null,
  version: string | null,
) {
  if (!host && !version) {
    return t('instances.nodes.values.notAvailable');
  }

  if (!version) {
    return host || t('instances.nodes.values.notAvailable');
  }

  return t('instances.nodes.values.hostVersionWithVersion', {
    host: host || t('instances.nodes.values.notAvailable'),
    version,
  });
}

function formatControlPlaneMode(t: Translate, mode?: string | null) {
  switch (mode) {
    case 'desktopCombined':
      return t('instances.nodes.controlPlane.modes.desktopCombined');
    case 'server':
      return t('instances.nodes.controlPlane.modes.server');
    case 'web':
      return t('instances.nodes.controlPlane.modes.web');
    default:
      return t('instances.nodes.controlPlane.modes.unknown');
  }
}

function formatControlPlaneLifecycle(t: Translate, lifecycle?: string | null) {
  switch (lifecycle) {
    case 'ready':
      return t('instances.nodes.controlPlane.lifecycle.ready');
    case 'starting':
      return t('instances.nodes.controlPlane.lifecycle.starting');
    case 'degraded':
      return t('instances.nodes.controlPlane.lifecycle.degraded');
    case 'stopping':
      return t('instances.nodes.controlPlane.lifecycle.stopping');
    case 'stopped':
      return t('instances.nodes.controlPlane.lifecycle.stopped');
    case 'inactive':
      return t('instances.nodes.controlPlane.lifecycle.inactive');
    default:
      return t('instances.nodes.controlPlane.lifecycle.unavailable');
  }
}

function formatNodeSessionState(t: Translate, state?: string | null) {
  switch (state) {
    case 'pending':
      return t('instances.nodes.sessionStates.pending');
    case 'admitted':
      return t('instances.nodes.sessionStates.admitted');
    case 'degraded':
      return t('instances.nodes.sessionStates.degraded');
    case 'blocked':
      return t('instances.nodes.sessionStates.blocked');
    case 'closing':
      return t('instances.nodes.sessionStates.closing');
    case 'closed':
      return t('instances.nodes.sessionStates.closed');
    default:
      return t('instances.nodes.sessionStates.none');
  }
}

function formatCompatibilityState(t: Translate, state?: string | null) {
  switch (state) {
    case 'compatible':
      return t('instances.nodes.compatibilityStates.compatible');
    case 'degraded':
      return t('instances.nodes.compatibilityStates.degraded');
    case 'blocked':
      return t('instances.nodes.compatibilityStates.blocked');
    default:
      return t('instances.nodes.compatibilityStates.unknown');
  }
}

export function Nodes() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [inventory, setInventory] = useState<NodeInventorySnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeAction, setActiveAction] = useState<'ensure' | 'restart' | null>(null);
  const nodes = inventory?.nodes ?? [];
  const controlPlane = inventory?.hostPlatform ?? null;

  const loadNodes = async () => {
    setIsLoading(true);
    try {
      setInventory(await nodeInventoryService.getInventory());
    } catch (error: any) {
      toast.error(error?.message || t('instances.nodes.toasts.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadNodes();
  }, []);

  const handleEnsureRunning = async () => {
    setActiveAction('ensure');
    try {
      await nodeInventoryService.ensureLocalNodeRunning();
      await loadNodes();
      toast.success(t('instances.nodes.toasts.ensureSuccess'));
    } catch (error: any) {
      toast.error(error?.message || t('instances.nodes.toasts.ensureFailed'));
    } finally {
      setActiveAction(null);
    }
  };

  const handleRestart = async () => {
    setActiveAction('restart');
    try {
      await nodeInventoryService.restartLocalNode();
      await loadNodes();
      toast.success(t('instances.nodes.toasts.restartSuccess'));
    } catch (error: any) {
      toast.error(error?.message || t('instances.nodes.toasts.restartFailed'));
    } finally {
      setActiveAction(null);
    }
  };

  const managedCount = nodes.filter((node) => node.management === 'managed').length;
  const attachedCount = nodes.filter((node) => node.management === 'attached').length;
  const degradedCount = nodes.filter((node) => node.health !== 'ok').length;
  const sessionCount = inventory?.sessionCount ?? 0;

  if (isLoading && nodes.length === 0) {
    return (
      <div className="mx-auto flex h-72 max-w-7xl items-center justify-center p-6 md:p-10">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div
      data-slot="nodes-page"
      className="scrollbar-hide mx-auto h-full max-w-7xl overflow-y-auto p-6 md:p-10"
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[2rem] border border-zinc-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.14),_transparent_42%),linear-gradient(135deg,_rgba(255,255,255,0.98),_rgba(244,244,245,0.92))] p-7 shadow-sm dark:border-zinc-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),_transparent_40%),linear-gradient(135deg,_rgba(24,24,27,0.96),_rgba(9,9,11,0.98))]"
      >
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-300">
              <Server className="h-5 w-5" />
            </div>
            <h1 className="mt-5 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              {t('sidebar.nodes')}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              {t('instances.nodes.description')}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => void loadNodes()}
              disabled={isLoading}
              className="rounded-xl"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              {t('instances.nodes.actions.refresh')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void handleEnsureRunning()}
              disabled={activeAction !== null}
              className="rounded-xl"
            >
              <ShieldCheck className="h-4 w-4" />
              {activeAction === 'ensure'
                ? t('instances.nodes.actions.ensuring')
                : t('instances.nodes.actions.ensureLocalNode')}
            </Button>
            <Button
              onClick={() => void handleRestart()}
              disabled={activeAction !== null}
              className="rounded-xl"
            >
              <RotateCcw className="h-4 w-4" />
              {activeAction === 'restart'
                ? t('instances.nodes.actions.restarting')
                : t('instances.nodes.actions.restartLocalNode')}
            </Button>
          </div>
        </div>
      </motion.div>

      <div className="mt-8 grid grid-cols-1 gap-4 xl:grid-cols-4">
        {[
          {
            id: 'total',
            label: t('instances.nodes.metrics.totalNodes'),
            value: String(nodes.length),
            detail: t('instances.nodes.metrics.totalNodesDetail'),
            icon: Server,
          },
          {
            id: 'managed',
            label: t('instances.nodes.metrics.managed'),
            value: String(managedCount),
            detail: t('instances.nodes.metrics.managedDetail'),
            icon: ShieldCheck,
          },
          {
            id: 'attached',
            label: t('instances.nodes.metrics.attached'),
            value: String(attachedCount),
            detail: t('instances.nodes.metrics.attachedDetail'),
            icon: Waypoints,
          },
          {
            id: 'attention',
            label: t('instances.nodes.metrics.needsAttention'),
            value: String(degradedCount),
            detail: t('instances.nodes.metrics.needsAttentionDetail'),
            icon: Activity,
          },
        ].map((metric) => (
          <div
            key={metric.id}
            className="rounded-[1.5rem] border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  {metric.label}
                </div>
                <div className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                  {metric.value}
                </div>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                <metric.icon className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              {metric.detail}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        {[
          {
            id: 'mode',
            label: t('instances.nodes.controlPlane.fields.mode'),
            value: formatControlPlaneMode(t, controlPlane?.mode),
            detail:
              controlPlane?.displayName || t('instances.nodes.controlPlane.values.activeHostPlatform'),
          },
          {
            id: 'lifecycle',
            label: t('instances.nodes.controlPlane.fields.lifecycle'),
            value: formatControlPlaneLifecycle(t, controlPlane?.lifecycle),
            detail:
              controlPlane?.hostId || t('instances.nodes.controlPlane.values.noHostPlatformId'),
          },
          {
            id: 'sessions',
            label: t('instances.nodes.controlPlane.fields.activeSessions'),
            value: String(sessionCount),
            detail: t('instances.nodes.controlPlane.values.internalSessionsReported'),
          },
        ].map((metric) => (
          <div
            key={metric.id}
            className="rounded-[1.5rem] border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              {metric.label}
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              {metric.value}
            </div>
            <div className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              {metric.detail}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-5 xl:grid-cols-2">
        {nodes.map((node) => (
          <motion.div
            key={node.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[1.75rem] border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                    {node.name}
                  </h2>
                  <span
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${healthToneClasses(
                      node.health,
                    )}`}
                  >
                    {translateHealth(t, node.health)}
                  </span>
                  <span className="rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {translateNodeKind(t, node.kind)}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  {translateManagementDescription(t, node.management)}
                </p>

                <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                      {t('instances.nodes.fields.topology')}
                    </div>
                    <div className="mt-2 text-sm text-zinc-800 dark:text-zinc-200">
                      {translateTopologyKind(t, node.topologyKind)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                      {t('instances.nodes.fields.runtimeState')}
                    </div>
                    <div className="mt-2 text-sm text-zinc-800 dark:text-zinc-200">
                      {translateRuntimeState(t, node.runtimeState)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                      {t('instances.nodes.fields.endpoint')}
                    </div>
                    <div className="mt-2 break-all font-mono text-xs text-zinc-700 dark:text-zinc-300">
                      {node.endpoint || t('instances.nodes.values.notAvailable')}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                      {t('instances.nodes.fields.hostVersion')}
                    </div>
                    <div className="mt-2 text-sm text-zinc-800 dark:text-zinc-200">
                      {formatHostVersion(t, node.host || null, node.version || null)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                      {t('instances.nodes.fields.sessionState')}
                    </div>
                    <div className="mt-2 text-sm text-zinc-800 dark:text-zinc-200">
                      {formatNodeSessionState(t, node.sessionState)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                      {t('instances.nodes.fields.compatibility')}
                    </div>
                    <div className="mt-2 text-sm text-zinc-800 dark:text-zinc-200">
                      {formatCompatibilityState(t, node.compatibilityState)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                      {t('instances.nodes.fields.desiredRevision')}
                    </div>
                    <div className="mt-2 text-sm text-zinc-800 dark:text-zinc-200">
                      {node.desiredStateRevision === null
                        ? t('instances.nodes.values.notAvailable')
                        : String(node.desiredStateRevision)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                      {t('instances.nodes.fields.desiredHash')}
                    </div>
                    <div className="mt-2 break-all font-mono text-xs text-zinc-700 dark:text-zinc-300">
                      {node.desiredStateHash || t('instances.nodes.values.notAvailable')}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 flex-col gap-3 xl:w-52">
                {node.source === 'kernel' ? (
                  <>
                    <Button
                      variant="secondary"
                      onClick={() => void handleEnsureRunning()}
                      disabled={activeAction !== null}
                      className="rounded-xl"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      {t('instances.nodes.actions.ensureLocalNode')}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => void handleRestart()}
                      disabled={activeAction !== null}
                      className="rounded-xl"
                    >
                      <RotateCcw className="h-4 w-4" />
                      {t('instances.nodes.actions.restart')}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => navigate(node.detailPath)}
                      className="rounded-xl"
                    >
                      <Waypoints className="h-4 w-4" />
                      {node.detailPath === '/kernel'
                        ? t('instances.nodes.actions.openKernelCenter')
                        : t('instances.nodes.actions.openDetails')}
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => navigate(node.detailPath)}
                    className="rounded-xl"
                  >
                    <ArrowRight className="h-4 w-4" />
                    {t('instances.nodes.actions.openDetails')}
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
