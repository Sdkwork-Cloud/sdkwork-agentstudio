import type {
  HostPlatformSnapshot,
  HostPortSettingsSummary,
  HostRuntimeModeSummary,
  KernelPlatformSnapshot,
  RolloutPhaseCounts,
} from '@sdkwork/claw-core';
import { mapKernelPlatformSnapshot } from '@sdkwork/claw-core';
import type {
  ManageRolloutListResult,
  ManageRolloutRecord,
  RuntimeDesktopKernelInfo,
  RuntimeInfo,
} from '@sdkwork/claw-infrastructure';
import type {
  LocalAiProxyRouteRuntimeMetrics,
  LocalAiProxyRouteTestRecord,
} from '@sdkwork/claw-types';
import { runtime } from '@sdkwork/claw-infrastructure';

export type KernelCenterStatusTone = 'healthy' | 'degraded' | 'warning';

export interface KernelCenterDashboard {
  snapshot: KernelPlatformSnapshot | null;
  info: RuntimeDesktopKernelInfo | null;
  statusTone: KernelCenterStatusTone;
  statusTitle: string;
  statusSummary: string;
  hostPlatform: {
    status: HostPlatformSnapshot | null;
    modeLabel: string;
    lifecycleLabel: string;
    hostId: string | null;
    displayName: string | null;
    version: string | null;
    desiredStateProjectionVersion: string | null;
    rolloutEngineVersion: string | null;
    manageBasePath: string | null;
    internalBasePath: string | null;
    capabilityKeys: string[];
    capabilityCount: number;
  };
  hostRuntime: HostRuntimeModeSummary;
  hostRuntimeContract: {
    hostMode: string | null;
    distributionFamily: string | null;
    deploymentFamily: string | null;
    acceleratorProfile: string | null;
    browserBaseUrl: string | null;
    hostEndpointId: string | null;
    hostRequestedPort: number | null;
    hostActivePort: number | null;
    hostLoopbackOnly: boolean | null;
    hostDynamicPort: boolean | null;
    stateStoreDriver: string | null;
    stateStoreProfileId: string | null;
    runtimeDataDir: string | null;
    webDistDir: string | null;
  };
  hostEndpoints: HostPortSettingsSummary;
  rollouts: {
    items: ManageRolloutRecord[];
    total: number;
    phaseCounts: RolloutPhaseCounts;
    latestUpdatedAt: number | null;
  };
  host: {
    serviceManagerLabel: string;
    ownershipLabel: string;
    startupModeLabel: string;
    controlSocketLabel: string | null;
    controlSocketAvailable: boolean;
    serviceConfigPath: string | null;
  };
  endpoint: {
    preferredPort: number | null;
    activePort: number | null;
    baseUrl: string | null;
    websocketUrl: string | null;
    usesDynamicPort: boolean;
  };
  localAiProxy: {
    lifecycle: string;
    baseUrl: string | null;
    rootBaseUrl: string | null;
    openaiCompatibleBaseUrl: string | null;
    anthropicBaseUrl: string | null;
    geminiBaseUrl: string | null;
    activePort: number | null;
    loopbackOnly: boolean;
    defaultRouteName: string | null;
    defaultRoutes: Array<{
      clientProtocol: string;
      id: string;
      name: string;
      managedBy: string;
      upstreamProtocol: string;
      upstreamBaseUrl: string;
      modelCount: number;
    }>;
    upstreamBaseUrl: string | null;
    modelCount: number;
    routeMetrics: LocalAiProxyRouteRuntimeMetrics[];
    routeTests: LocalAiProxyRouteTestRecord[];
    messageCaptureEnabled: boolean;
    observabilityDbPath: string | null;
    configFile: string | null;
    snapshotPath: string | null;
    logPath: string | null;
    lastError: string | null;
  };
  storage: {
    activeProfileId: string | null;
    activeProfileLabel: string | null;
    activeProfilePath: string | null;
    rootDir: string | null;
    profileCount: number;
  };
  runtimeAuthority: {
    configFile: string | null;
    ownedRuntimeRoots: string[];
    supportsLoopbackHealthProbe: boolean | null;
    healthProbeTimeoutMs: number | null;
  };
  capabilities: {
    readyKeys: string[];
    plannedKeys: string[];
  };
  startupEvidence: {
    status: string | null;
    phase: string | null;
    runId: number | null;
    recordedAt: string | null;
    durationMs: number | null;
    path: string | null;
    descriptorMode: string | null;
    descriptorLifecycle: string | null;
    descriptorEndpointId: string | null;
    descriptorRequestedPort: number | null;
    descriptorActivePort: number | null;
    descriptorLoopbackOnly: boolean | null;
    descriptorDynamicPort: boolean | null;
    descriptorStateStoreDriver: string | null;
    descriptorStateStoreProfileId: string | null;
    descriptorBrowserBaseUrl: string | null;
    manageBaseUrl: string | null;
    builtInInstanceId: string | null;
    builtInInstanceName: string | null;
    builtInInstanceVersion: string | null;
    builtInInstanceRuntimeKind: string | null;
    builtInInstanceDeploymentMode: string | null;
    builtInInstanceTransportKind: string | null;
    builtInInstanceBaseUrl: string | null;
    builtInInstanceWebsocketUrl: string | null;
    builtInInstanceIsBuiltIn: boolean | null;
    builtInInstanceIsDefault: boolean | null;
    builtInInstanceStatus: string | null;
    runtimeLifecycle: string | null;
    gatewayLifecycle: string | null;
    ready: boolean | null;
    errorMessage: string | null;
    errorCause: string | null;
  };
  provenance: {
    installSource: string | null;
    platformLabel: string;
    runtimeVersion: string | null;
    nodeVersion: string | null;
    configFile: string | null;
    runtimeHomeDir: string | null;
    runtimeInstallDir: string | null;
  };
}

type ClawCoreModule = typeof import('@sdkwork/claw-core');

interface KernelCenterPlatformService {
  getInfo(): Promise<RuntimeDesktopKernelInfo | null>;
  getStatus(): Promise<KernelPlatformSnapshot | null>;
  ensureRunning(): Promise<KernelPlatformSnapshot | null>;
  restart(): Promise<KernelPlatformSnapshot | null>;
}

interface KernelCenterHostPlatformService {
  getStatus(): Promise<HostPlatformSnapshot>;
}

interface KernelCenterHostRuntimeModeService {
  getSummary(): Promise<HostRuntimeModeSummary>;
}

interface KernelCenterHostPortSettingsService {
  getSummary(): Promise<HostPortSettingsSummary>;
}

interface KernelCenterRuntimeApi {
  getRuntimeInfo(): Promise<RuntimeInfo>;
}

interface KernelCenterRolloutService {
  list(): Promise<ManageRolloutListResult>;
  summarizePhases(result: ManageRolloutListResult): RolloutPhaseCounts;
}

export interface KernelCenterServiceOverrides {
  kernelPlatformService?: Partial<KernelCenterPlatformService>;
  hostPlatformService?: Partial<KernelCenterHostPlatformService>;
  hostRuntimeModeService?: Partial<KernelCenterHostRuntimeModeService>;
  hostPortSettingsService?: Partial<KernelCenterHostPortSettingsService>;
  runtimeApi?: Partial<KernelCenterRuntimeApi>;
  rolloutService?: Partial<KernelCenterRolloutService>;
}

interface KernelCenterServiceDependencies {
  kernelPlatformService: KernelCenterPlatformService;
  hostPlatformService: KernelCenterHostPlatformService;
  hostRuntimeModeService: KernelCenterHostRuntimeModeService;
  hostPortSettingsService: KernelCenterHostPortSettingsService;
  runtimeApi: KernelCenterRuntimeApi;
  rolloutService: KernelCenterRolloutService;
}

const EMPTY_HOST_PORT_SETTINGS_SUMMARY: HostPortSettingsSummary = {
  totalEndpoints: 0,
  readyEndpoints: 0,
  conflictedEndpoints: 0,
  dynamicPortEndpoints: 0,
  browserBaseUrl: null,
  rows: [],
};
const EMPTY_ROLLOUT_LIST_RESULT: ManageRolloutListResult = {
  items: [],
  total: 0,
};
const EMPTY_ROLLOUT_PHASE_COUNTS: RolloutPhaseCounts = {
  active: 0,
  failed: 0,
  completed: 0,
  paused: 0,
  drafts: 0,
};

let clawCoreModulePromise: Promise<ClawCoreModule> | null = null;

function loadClawCoreModule(): Promise<ClawCoreModule> {
  clawCoreModulePromise ??= import('@sdkwork/claw-core');
  return clawCoreModulePromise;
}

function formatRuntimeState(state?: string | null) {
  switch (state) {
    case 'inactive':
      return 'Inactive';
    case 'ready':
      return 'Ready';
    case 'running':
      return 'Running';
    case 'starting':
      return 'Starting';
    case 'stopping':
      return 'Stopping';
    case 'recovering':
      return 'Recovering';
    case 'degraded':
      return 'Degraded';
    case 'crashLoop':
      return 'Crash Loop';
    case 'failedSafe':
      return 'Failed Safe';
    case 'stopped':
      return 'Stopped';
    default:
      return 'Unavailable';
  }
}

function formatServiceManager(serviceManager?: string | null) {
  switch (serviceManager) {
    case 'windowsService':
      return 'Windows Service';
    case 'launchdLaunchAgent':
      return 'launchd LaunchAgent';
    case 'systemdUser':
      return 'systemd User Service';
    case 'systemdSystem':
      return 'systemd System Service';
    case 'tauriSupervisor':
      return 'Tauri Supervisor';
    default:
      return 'Unknown Host';
  }
}

function formatOwnership(ownership?: string | null) {
  switch (ownership) {
    case 'nativeService':
      return 'Native Service Host';
    case 'appSupervisor':
      return 'App Supervisor Fallback';
    case 'attached':
      return 'Attached Runtime';
    default:
      return 'Unknown Ownership';
  }
}

function formatStartupMode(mode?: string | null) {
  return mode === 'auto' ? 'Auto Start' : 'Manual Start';
}

function formatLocalAiProxyLifecycle(lifecycle?: string | null) {
  switch (lifecycle) {
    case 'ready':
      return 'Ready';
    case 'running':
      return 'Running';
    case 'failed':
      return 'Failed';
    case 'stopped':
      return 'Stopped';
    default:
      return 'Unavailable';
  }
}

function formatPlatformLabel(platform?: string | null, arch?: string | null) {
  const normalizedPlatform = platform?.trim() || 'unknown';
  const normalizedArch = arch?.trim() || 'unknown';
  return `${normalizedPlatform}/${normalizedArch}`;
}

function formatHostPlatformMode(mode?: string | null) {
  switch (mode) {
    case 'desktopCombined':
      return 'Desktop Combined';
    case 'server':
      return 'Server';
    case 'web':
      return 'Web Preview';
    default:
      return 'Unknown';
  }
}

function formatHostPlatformLifecycle(lifecycle?: string | null) {
  switch (lifecycle) {
    case 'ready':
      return 'Ready';
    case 'starting':
      return 'Starting';
    case 'degraded':
      return 'Degraded';
    case 'stopping':
      return 'Stopping';
    case 'stopped':
      return 'Stopped';
    case 'inactive':
      return 'Inactive';
    default:
      return 'Unavailable';
  }
}

function resolveStatusTone(
  snapshot: KernelPlatformSnapshot | null,
  hostPlatformStatus: HostPlatformSnapshot | null,
): KernelCenterStatusTone {
  if (hostPlatformStatus?.lifecycle === 'degraded') {
    return 'degraded';
  }

  if (!snapshot) {
    return 'warning';
  }

  if (snapshot.runtimeHealth === 'healthy') {
    return 'healthy';
  }

  if (snapshot.runtimeHealth === 'degraded') {
    return 'degraded';
  }

  return 'warning';
}

function createDependencies(
  overrides: KernelCenterServiceOverrides = {},
): KernelCenterServiceDependencies {
  const defaultKernelPlatformService: KernelCenterPlatformService = {
    async getInfo() {
      return (await loadClawCoreModule()).kernelPlatformService.getInfo();
    },
    async getStatus() {
      return (await loadClawCoreModule()).kernelPlatformService.getStatus();
    },
    async ensureRunning() {
      return (await loadClawCoreModule()).kernelPlatformService.ensureRunning();
    },
    async restart() {
      return (await loadClawCoreModule()).kernelPlatformService.restart();
    },
  };
  const defaultHostPlatformService: KernelCenterHostPlatformService = {
    async getStatus() {
      return (await loadClawCoreModule()).hostPlatformService.getStatus();
    },
  };
  const defaultHostPortSettingsService: KernelCenterHostPortSettingsService = {
    async getSummary() {
      return (await loadClawCoreModule()).hostPortSettingsService.getSummary();
    },
  };
  const defaultRuntimeApi: KernelCenterRuntimeApi = {
    async getRuntimeInfo() {
      return runtime.getRuntimeInfo();
    },
  };
  const defaultRolloutService: KernelCenterRolloutService = {
    async list() {
      return (await loadClawCoreModule()).rolloutService.list();
    },
    summarizePhases(result) {
      return result.items.reduce<RolloutPhaseCounts>((counts, item) => {
        switch (item.phase) {
          case 'draft':
            counts.drafts += 1;
            break;
          case 'completed':
            counts.completed += 1;
            break;
          case 'failed':
            counts.failed += 1;
            break;
          case 'paused':
            counts.paused += 1;
            break;
          case 'previewing':
          case 'awaitingApproval':
          case 'ready':
          case 'promoting':
            counts.active += 1;
            break;
          default:
            break;
        }
        return counts;
      }, {
        active: 0,
        failed: 0,
        completed: 0,
        paused: 0,
        drafts: 0,
      });
    },
  };
  const resolvedHostPlatformService: KernelCenterHostPlatformService = {
    getStatus: overrides.hostPlatformService?.getStatus ?? defaultHostPlatformService.getStatus,
  };
  const resolvedHostRuntimeModeService: KernelCenterHostRuntimeModeService = {
    async getSummary() {
      return createFallbackHostRuntimeSummary(await resolvedHostPlatformService.getStatus());
    },
  };

  return {
    kernelPlatformService: {
      getInfo: overrides.kernelPlatformService?.getInfo ?? defaultKernelPlatformService.getInfo,
      getStatus: overrides.kernelPlatformService?.getStatus ?? defaultKernelPlatformService.getStatus,
      ensureRunning:
        overrides.kernelPlatformService?.ensureRunning ?? defaultKernelPlatformService.ensureRunning,
      restart: overrides.kernelPlatformService?.restart ?? defaultKernelPlatformService.restart,
    },
    hostPlatformService: resolvedHostPlatformService,
    hostRuntimeModeService: {
      getSummary:
        overrides.hostRuntimeModeService?.getSummary ?? resolvedHostRuntimeModeService.getSummary,
    },
    hostPortSettingsService: {
      getSummary:
        overrides.hostPortSettingsService?.getSummary ?? defaultHostPortSettingsService.getSummary,
    },
    runtimeApi: {
      getRuntimeInfo: overrides.runtimeApi?.getRuntimeInfo ?? defaultRuntimeApi.getRuntimeInfo,
    },
    rolloutService: {
      list: overrides.rolloutService?.list ?? defaultRolloutService.list,
      summarizePhases:
        overrides.rolloutService?.summarizePhases ?? defaultRolloutService.summarizePhases,
    },
  };
}

function createFallbackHostRuntimeSummary(
  hostPlatformStatus: HostPlatformSnapshot | null,
): HostRuntimeModeSummary {
  const mode = hostPlatformStatus?.mode ?? 'web';
  const lifecycle = hostPlatformStatus?.lifecycle ?? 'inactive';
  const browserManagementSupported = mode === 'desktopCombined' || mode === 'server';
  const browserManagementAvailable =
    browserManagementSupported
    && lifecycle === 'ready'
    && Boolean(hostPlatformStatus?.manageBasePath && hostPlatformStatus?.internalBasePath);

  return {
    mode,
    modeLabel: formatHostPlatformMode(mode),
    lifecycle,
    lifecycleLabel: formatHostPlatformLifecycle(lifecycle),
    browserManagementSupported,
    browserManagementAvailable,
    browserManagementLabel: browserManagementAvailable
      ? mode === 'desktopCombined'
        ? 'Embedded Browser Management'
        : 'Hosted Browser Management'
      : browserManagementSupported
      ? 'Host Runtime Available'
      : 'Browser Management Unavailable',
    manageBasePath: hostPlatformStatus?.manageBasePath ?? null,
    internalBasePath: hostPlatformStatus?.internalBasePath ?? null,
  };
}

function unwrapSettledResult<T>(
  result: PromiseSettledResult<T>,
  label: string,
): T {
  if (result.status === 'fulfilled') {
    return result.value;
  }

  throw new Error(`${label}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
}

function resolvePreferredOpenClawRuntime(
  snapshot: KernelPlatformSnapshot | null,
  info: RuntimeDesktopKernelInfo | null,
) {
  const openClawRuntime = info?.openClawRuntime ?? null;
  if (openClawRuntime?.runtimeId !== 'openclaw') {
    return null;
  }

  const activeRuntimeId = snapshot?.runtimeId ?? info?.host?.provenance.runtimeId ?? null;
  if (activeRuntimeId) {
    return activeRuntimeId === 'openclaw' ? openClawRuntime : null;
  }

  return openClawRuntime;
}

function resolveActiveRuntimeContract(info: RuntimeDesktopKernelInfo | null) {
  return info?.activeRuntime ?? null;
}

function resolvePreferredRuntimeAuthority(
  snapshot: KernelPlatformSnapshot | null,
  info: RuntimeDesktopKernelInfo | null,
) {
  const runtimeAuthorities = info?.runtimeAuthorities ?? [];
  if (runtimeAuthorities.length === 0) {
    return null;
  }

  const activeRuntimeId = snapshot?.runtimeId ?? info?.host?.provenance.runtimeId ?? null;
  if (activeRuntimeId) {
    const matchedAuthority = runtimeAuthorities.find(
      (authority) => authority.runtimeId === activeRuntimeId,
    );
    if (matchedAuthority) {
      return matchedAuthority;
    }
  }

  return runtimeAuthorities[0] ?? null;
}

function resolveSnapshotResult(
  result: PromiseSettledResult<KernelPlatformSnapshot | null>,
  info: RuntimeDesktopKernelInfo | null,
  mode: 'required' | 'allowRejectedFallback',
): KernelPlatformSnapshot | null {
  if (result.status === 'fulfilled') {
    if (result.value === null && mode === 'required') {
      throw new Error('Failed to load kernel status: kernel action did not return a runtime snapshot');
    }
    return result.value;
  }

  if (mode === 'allowRejectedFallback' && info?.host) {
    return mapKernelPlatformSnapshot(info.host);
  }

  throw new Error(
    `Failed to load kernel status: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
  );
}

function resolveRolloutResult(
  result: PromiseSettledResult<ManageRolloutListResult>,
): ManageRolloutListResult {
  return result.status === 'fulfilled' ? result.value : EMPTY_ROLLOUT_LIST_RESULT;
}

function summarizeRolloutPhasesSafely(
  result: ManageRolloutListResult,
  summarizePhases: (result: ManageRolloutListResult) => RolloutPhaseCounts,
): RolloutPhaseCounts {
  try {
    return summarizePhases(result);
  } catch {
    return EMPTY_ROLLOUT_PHASE_COUNTS;
  }
}

function mapHostRuntimeContract(runtimeInfo: RuntimeInfo | null) {
  const startup = runtimeInfo?.startup ?? null;

  return {
    hostMode: startup?.hostMode ?? null,
    distributionFamily: startup?.distributionFamily ?? null,
    deploymentFamily: startup?.deploymentFamily ?? null,
    acceleratorProfile: startup?.acceleratorProfile ?? null,
    browserBaseUrl: startup?.browserBaseUrl ?? null,
    hostEndpointId: startup?.hostEndpointId ?? null,
    hostRequestedPort: startup?.hostRequestedPort ?? null,
    hostActivePort: startup?.hostActivePort ?? null,
    hostLoopbackOnly: startup?.hostLoopbackOnly ?? null,
    hostDynamicPort: startup?.hostDynamicPort ?? null,
    stateStoreDriver: startup?.stateStoreDriver ?? null,
    stateStoreProfileId: startup?.stateStoreProfileId ?? null,
    runtimeDataDir: startup?.runtimeDataDir ?? null,
    webDistDir: startup?.webDistDir ?? null,
  };
}

function mapDashboard(
  snapshot: KernelPlatformSnapshot | null,
  info: RuntimeDesktopKernelInfo | null,
  runtimeInfo: RuntimeInfo | null,
  hostPlatformStatus: HostPlatformSnapshot | null,
  hostRuntime: HostRuntimeModeSummary,
  hostEndpoints: HostPortSettingsSummary,
  rolloutResult: ManageRolloutListResult,
  rolloutPhaseCounts: RolloutPhaseCounts,
): KernelCenterDashboard {
  const activeProfile = info?.storage.profiles.find((profile) => profile.active) ?? null;
  const kernelHost = snapshot?.raw ?? info?.host ?? null;
  const controlSocket = kernelHost?.host.controlSocket ?? null;
  const activeRuntime = resolveActiveRuntimeContract(info);
  const openClawRuntime = resolvePreferredOpenClawRuntime(snapshot, info);
  const runtimeAuthority =
    activeRuntime?.authority
    ?? resolvePreferredRuntimeAuthority(snapshot, info);
  const startupEvidence = info?.desktopStartupEvidence ?? null;
  const readyKeys =
    info?.capabilities
      .filter((capability) => capability.status === 'ready')
      .map((capability) => capability.key) ?? [];
  const plannedKeys =
    info?.capabilities
      .filter((capability) => capability.status === 'planned')
      .map((capability) => capability.key) ?? [];

  return {
    snapshot,
    info,
    statusTone: resolveStatusTone(
      snapshot ?? (kernelHost ? mapKernelPlatformSnapshot(kernelHost) : null),
      hostPlatformStatus,
    ),
    statusTitle: formatRuntimeState(
      snapshot?.runtimeState
      ?? activeRuntime?.state
      ?? kernelHost?.runtime.state
      ?? openClawRuntime?.lifecycle
      ?? null,
    ),
    statusSummary:
      normalizeOptionalText(
        snapshot?.raw.runtime.reason
        ?? activeRuntime?.reason
        ?? kernelHost?.runtime.reason,
      )
      ?? (startupEvidence?.errorMessage
        ? startupEvidence.errorMessage
        : startupEvidence?.phase && startupEvidence?.recordedAt
        ? `Desktop startup evidence last reached ${startupEvidence.phase} at ${startupEvidence.recordedAt}.`
        : null)
      ?? openClawRuntime?.startupChain.find((stage) => stage.status !== 'ready')?.detail
      ?? openClawRuntime?.startupChain[openClawRuntime.startupChain.length - 1]?.detail
      ?? 'Kernel host status is currently unavailable.',
    hostPlatform: {
      status: hostPlatformStatus,
      modeLabel: formatHostPlatformMode(hostPlatformStatus?.mode),
      lifecycleLabel: formatHostPlatformLifecycle(hostPlatformStatus?.lifecycle),
      hostId: hostPlatformStatus?.hostId ?? null,
      displayName: hostPlatformStatus?.displayName ?? null,
      version: hostPlatformStatus?.version ?? null,
      desiredStateProjectionVersion:
        hostPlatformStatus?.desiredStateProjectionVersion ?? null,
      rolloutEngineVersion: hostPlatformStatus?.rolloutEngineVersion ?? null,
      manageBasePath: hostPlatformStatus?.manageBasePath ?? null,
      internalBasePath: hostPlatformStatus?.internalBasePath ?? null,
      capabilityKeys: hostPlatformStatus?.capabilityKeys ?? [],
      capabilityCount: hostPlatformStatus?.capabilityCount ?? 0,
    },
    hostRuntime,
    hostRuntimeContract: mapHostRuntimeContract(runtimeInfo),
    hostEndpoints,
    rollouts: {
      items: rolloutResult.items,
      total: rolloutResult.total,
      phaseCounts: rolloutPhaseCounts,
      latestUpdatedAt: rolloutResult.items.reduce<number | null>((latest, item) => (
        latest === null || item.updatedAt > latest ? item.updatedAt : latest
      ), null),
    },
    host: {
      serviceManagerLabel: formatServiceManager(
        snapshot?.hostManager ?? kernelHost?.host.serviceManager,
      ),
      ownershipLabel: formatOwnership(kernelHost?.host.ownership),
      startupModeLabel: formatStartupMode(kernelHost?.host.startupMode),
      controlSocketLabel: controlSocket
        ? `${controlSocket.socketKind} ${controlSocket.location}`
        : null,
      controlSocketAvailable: Boolean(controlSocket?.available),
      serviceConfigPath: snapshot?.serviceConfigPath ?? kernelHost?.host.serviceConfigPath ?? null,
    },
    endpoint: {
      preferredPort: snapshot?.preferredPort ?? kernelHost?.endpoint.preferredPort ?? null,
      activePort: snapshot?.activePort ?? kernelHost?.endpoint.activePort ?? null,
      baseUrl: snapshot?.baseUrl ?? kernelHost?.endpoint.baseUrl ?? null,
      websocketUrl: snapshot?.websocketUrl ?? kernelHost?.endpoint.websocketUrl ?? null,
      usesDynamicPort: snapshot?.usesDynamicPort ?? Boolean(kernelHost?.endpoint.dynamicPort),
    },
    localAiProxy: {
      lifecycle: formatLocalAiProxyLifecycle(info?.localAiProxy?.lifecycle),
      baseUrl: info?.localAiProxy?.baseUrl ?? null,
      rootBaseUrl: info?.localAiProxy?.rootBaseUrl ?? null,
      openaiCompatibleBaseUrl: info?.localAiProxy?.openaiCompatibleBaseUrl ?? null,
      anthropicBaseUrl: info?.localAiProxy?.anthropicBaseUrl ?? null,
      geminiBaseUrl: info?.localAiProxy?.geminiBaseUrl ?? null,
      activePort: info?.localAiProxy?.activePort ?? null,
      loopbackOnly: info?.localAiProxy?.loopbackOnly ?? true,
      defaultRouteName: info?.localAiProxy?.defaultRouteName ?? null,
      defaultRoutes: info?.localAiProxy?.defaultRoutes ?? [],
      upstreamBaseUrl: info?.localAiProxy?.upstreamBaseUrl ?? null,
      modelCount: info?.localAiProxy?.modelCount ?? 0,
      routeMetrics: info?.localAiProxy?.routeMetrics ?? [],
      routeTests: info?.localAiProxy?.routeTests ?? [],
      messageCaptureEnabled: info?.localAiProxy?.messageCaptureEnabled ?? false,
      observabilityDbPath: info?.localAiProxy?.observabilityDbPath ?? null,
      configFile: info?.localAiProxy?.configFile ?? null,
      snapshotPath: info?.localAiProxy?.snapshotPath ?? null,
      logPath: info?.localAiProxy?.logPath ?? null,
      lastError: info?.localAiProxy?.lastError ?? null,
    },
    storage: {
      activeProfileId: activeProfile?.id ?? info?.storage.activeProfileId ?? null,
      activeProfileLabel: activeProfile?.label ?? null,
      activeProfilePath: activeProfile?.path ?? null,
      rootDir: info?.storage.rootDir ?? null,
      profileCount: info?.storage.profiles.length ?? 0,
    },
    runtimeAuthority: {
      configFile:
        runtimeAuthority?.configFile
        ?? openClawRuntime?.authority?.configFile
        ?? null,
      ownedRuntimeRoots:
        runtimeAuthority?.ownedRuntimeRoots
        ?? openClawRuntime?.authority?.ownedRuntimeRoots
        ?? [],
      supportsLoopbackHealthProbe:
        runtimeAuthority?.readinessProbe?.supportsLoopbackHealthProbe
        ?? openClawRuntime?.authority?.readinessProbe?.supportsLoopbackHealthProbe
        ?? null,
      healthProbeTimeoutMs:
        runtimeAuthority?.readinessProbe?.healthProbeTimeoutMs
        ?? openClawRuntime?.authority?.readinessProbe?.healthProbeTimeoutMs
        ?? null,
    },
    capabilities: {
      readyKeys,
      plannedKeys,
    },
    startupEvidence: {
      status: startupEvidence?.status ?? null,
      phase: startupEvidence?.phase ?? null,
      runId: startupEvidence?.runId ?? null,
      recordedAt: startupEvidence?.recordedAt ?? null,
      durationMs: startupEvidence?.durationMs ?? null,
      path: startupEvidence?.evidencePath ?? null,
      descriptorMode: startupEvidence?.descriptorMode ?? null,
      descriptorLifecycle: startupEvidence?.descriptorLifecycle ?? null,
      descriptorEndpointId: startupEvidence?.descriptorEndpointId ?? null,
      descriptorRequestedPort: startupEvidence?.descriptorRequestedPort ?? null,
      descriptorActivePort: startupEvidence?.descriptorActivePort ?? null,
      descriptorLoopbackOnly: startupEvidence?.descriptorLoopbackOnly ?? null,
      descriptorDynamicPort: startupEvidence?.descriptorDynamicPort ?? null,
      descriptorStateStoreDriver: startupEvidence?.descriptorStateStoreDriver ?? null,
      descriptorStateStoreProfileId: startupEvidence?.descriptorStateStoreProfileId ?? null,
      descriptorBrowserBaseUrl: startupEvidence?.descriptorBrowserBaseUrl ?? null,
      manageBaseUrl: startupEvidence?.manageBaseUrl ?? null,
      builtInInstanceId: startupEvidence?.builtInInstanceId ?? null,
      builtInInstanceName: startupEvidence?.builtInInstanceName ?? null,
      builtInInstanceVersion: startupEvidence?.builtInInstanceVersion ?? null,
      builtInInstanceRuntimeKind: startupEvidence?.builtInInstanceRuntimeKind ?? null,
      builtInInstanceDeploymentMode: startupEvidence?.builtInInstanceDeploymentMode ?? null,
      builtInInstanceTransportKind: startupEvidence?.builtInInstanceTransportKind ?? null,
      builtInInstanceBaseUrl: startupEvidence?.builtInInstanceBaseUrl ?? null,
      builtInInstanceWebsocketUrl: startupEvidence?.builtInInstanceWebsocketUrl ?? null,
      builtInInstanceIsBuiltIn: startupEvidence?.builtInInstanceIsBuiltIn ?? null,
      builtInInstanceIsDefault: startupEvidence?.builtInInstanceIsDefault ?? null,
      builtInInstanceStatus: startupEvidence?.builtInInstanceStatus ?? null,
      runtimeLifecycle: startupEvidence?.openClawRuntimeLifecycle ?? null,
      gatewayLifecycle: startupEvidence?.openClawGatewayLifecycle ?? null,
      ready: startupEvidence?.ready ?? null,
      errorMessage: startupEvidence?.errorMessage ?? null,
      errorCause: startupEvidence?.errorCause ?? null,
    },
    provenance: {
      installSource: kernelHost?.provenance.installSource ?? null,
      platformLabel: formatPlatformLabel(
        activeRuntime?.platform
        ?? runtimeAuthority?.platform
        ?? openClawRuntime?.platform
        ?? kernelHost?.provenance.platform,
        activeRuntime?.arch
        ?? runtimeAuthority?.arch
        ?? openClawRuntime?.arch
        ?? kernelHost?.provenance.arch,
      ),
      runtimeVersion:
        activeRuntime?.runtimeVersion
        ?? runtimeAuthority?.runtimeVersion
        ?? openClawRuntime?.openclawVersion
        ?? snapshot?.runtimeVersion
        ?? kernelHost?.provenance.runtimeVersion
        ?? null,
      nodeVersion:
        activeRuntime?.nodeVersion
        ?? runtimeAuthority?.nodeVersion
        ?? openClawRuntime?.nodeVersion
        ?? snapshot?.nodeVersion
        ?? kernelHost?.provenance.nodeVersion
        ?? null,
      configFile:
        activeRuntime?.configFile
        ?? openClawRuntime?.configFile
        ?? kernelHost?.provenance.configFile
        ?? null,
      runtimeHomeDir:
        activeRuntime?.runtimeHomeDir
        ?? (runtimeAuthority
          ? runtimeAuthority.runtimeHomeDir ?? null
          : openClawRuntime?.homeDir ?? kernelHost?.provenance.runtimeHomeDir ?? null),
      runtimeInstallDir:
        activeRuntime?.runtimeInstallDir
        ?? runtimeAuthority?.runtimeInstallDir
        ?? openClawRuntime?.installDir
        ?? kernelHost?.provenance.runtimeInstallDir
        ?? null,
    },
  };
}

function normalizeOptionalText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function createKernelCenterService(
  overrides: KernelCenterServiceOverrides = {},
) {
  const dependencies = createDependencies(overrides);

  const buildDashboard = async (
    snapshotPromise: Promise<KernelPlatformSnapshot | null>,
    snapshotMode: 'required' | 'allowRejectedFallback',
  ): Promise<KernelCenterDashboard> => {
    const [
      snapshotResult,
      infoResult,
      hostPlatformStatusResult,
      hostRuntimeResult,
      hostEndpointsResult,
      runtimeInfoResult,
      rolloutResultResult,
    ] = await Promise.allSettled([
      snapshotPromise,
      dependencies.kernelPlatformService.getInfo(),
      dependencies.hostPlatformService.getStatus(),
      dependencies.hostRuntimeModeService.getSummary(),
      dependencies.hostPortSettingsService.getSummary(),
      dependencies.runtimeApi.getRuntimeInfo(),
      dependencies.rolloutService.list(),
    ]);
    const info =
      infoResult.status === 'fulfilled'
        ? infoResult.value
        : null;
    const snapshot = resolveSnapshotResult(snapshotResult, info, snapshotMode);
    const hostPlatformStatus =
      hostPlatformStatusResult.status === 'fulfilled'
        ? hostPlatformStatusResult.value
        : null;
    const hostRuntime =
      hostRuntimeResult.status === 'fulfilled'
        ? hostRuntimeResult.value
        : createFallbackHostRuntimeSummary(hostPlatformStatus);
    const hostEndpoints =
      hostEndpointsResult.status === 'fulfilled'
        ? hostEndpointsResult.value
        : EMPTY_HOST_PORT_SETTINGS_SUMMARY;
    const runtimeInfo =
      runtimeInfoResult.status === 'fulfilled'
        ? runtimeInfoResult.value
        : null;
    const rolloutResult = resolveRolloutResult(rolloutResultResult);
    const rolloutPhaseCounts =
      rolloutResultResult.status === 'fulfilled'
        ? summarizeRolloutPhasesSafely(
          rolloutResult,
          dependencies.rolloutService.summarizePhases,
        )
        : EMPTY_ROLLOUT_PHASE_COUNTS;

    return mapDashboard(
      snapshot,
      info,
      runtimeInfo,
      hostPlatformStatus,
      hostRuntime,
      hostEndpoints,
      rolloutResult,
      rolloutPhaseCounts,
    );
  };

  return {
    async getDashboard(): Promise<KernelCenterDashboard> {
      return buildDashboard(
        dependencies.kernelPlatformService.getStatus(),
        'allowRejectedFallback',
      );
    },

    async ensureRunning(): Promise<KernelCenterDashboard> {
      return buildDashboard(dependencies.kernelPlatformService.ensureRunning(), 'required');
    },

    async restart(): Promise<KernelCenterDashboard> {
      return buildDashboard(dependencies.kernelPlatformService.restart(), 'required');
    },
  };
}

export const kernelCenterService = createKernelCenterService();
