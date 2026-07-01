import type {
  HostPlatformStatusRecord,
  ManageHostEndpointRecord,
  ManageOpenClawGatewayRecord,
  ManageOpenClawRuntimeRecord,
  RuntimeAppInfo,
  RuntimeDesktopBundledComponentInfo,
  RuntimeDesktopBundledComponentsInfo,
  RuntimeDesktopLocalAiProxyInfo,
  RuntimeDesktopOpenClawRuntimeInfo,
  RuntimePathsInfo,
  StudioInstanceRecord,
} from '@sdkwork/claw-infrastructure';
import type {
  DesktopHostedRuntimeDescriptor,
  DesktopHostedRuntimeReadinessEvidence,
  DesktopHostedRuntimeReadinessSnapshot,
} from '../desktopHostedBridge';
import { resolveBuiltInOpenClawInstance } from '../builtInOpenClawInstanceSelection.ts';

export const DESKTOP_STARTUP_EVIDENCE_RELATIVE_PATH =
  'diagnostics/desktop-startup-evidence.json';

export type DesktopStartupEvidenceStatus = 'running' | 'passed' | 'failed';
export type DesktopStartupEvidencePhase =
  | 'bootstrap-started'
  | 'bootstrap-failed'
  | 'runtime-ready'
  | 'shell-mounted'
  | 'runtime-readiness-failed'
  | 'shell-render-failed';

export interface DesktopStartupEvidenceDescriptor {
  mode: DesktopHostedRuntimeDescriptor['mode'];
  lifecycle: DesktopHostedRuntimeDescriptor['lifecycle'];
  apiBasePath: string;
  manageBasePath: string;
  internalBasePath: string;
  browserBaseUrl: string;
  lastError: string | null;
  endpointId: string | null;
  requestedPort: number | null;
  activePort: number | null;
  loopbackOnly: boolean | null;
  dynamicPort: boolean | null;
  stateStoreDriver: string | null;
  stateStoreProfileId: string | null;
  runtimeDataDir: string | null;
  webDistDir: string | null;
}

export interface DesktopStartupEvidencePaths {
  dataDir: string;
  logsDir: string;
  machineLogsDir: string;
  mainLogFile: string;
}

export interface DesktopStartupEvidenceBuiltInInstance {
  id: string;
  name: string;
  version: string;
  runtimeKind: StudioInstanceRecord['runtimeKind'];
  deploymentMode: StudioInstanceRecord['deploymentMode'];
  transportKind: StudioInstanceRecord['transportKind'];
  status: StudioInstanceRecord['status'];
  baseUrl: string | null;
  websocketUrl: string | null;
  isBuiltIn: boolean;
  isDefault: boolean;
}

export interface DesktopStartupEvidenceErrorSummary {
  message: string;
  cause: string | null;
}

export interface DesktopStartupEvidenceLocalAiProxy {
  lifecycle: RuntimeDesktopLocalAiProxyInfo['lifecycle'];
  messageCaptureEnabled: boolean;
  observabilityDbPath: string | null;
  snapshotPath: string | null;
  logPath: string | null;
}

export interface DesktopStartupEvidenceBundledComponents {
  packageProfileId: string;
  includedKernelIds: string[];
  defaultEnabledKernelIds: string[];
  componentCount: number;
  defaultStartupComponentIds: string[];
  autoUpgradeEnabled: boolean;
  approvalMode: string;
  components: RuntimeDesktopBundledComponentsInfo['components'];
}

export interface DesktopStartupEvidenceOpenClawConfigHealth {
  status: string;
  valid: boolean;
  runtimeMetadataAvailable: boolean;
  configReadable: boolean;
  supportedChannelIds: string[];
  configuredChannelIds: string[];
  unknownChannelIds: string[];
  malformedChannelIds: string[];
  modelByChannelIds: string[];
  unknownModelByChannelIds: string[];
  invalidModelByChannelIds: string[];
}

export interface DesktopStartupEvidenceDocument {
  version: 1;
  status: DesktopStartupEvidenceStatus;
  phase: DesktopStartupEvidencePhase;
  runId: number;
  durationMs: number;
  recordedAt: string;
  app: RuntimeAppInfo | null;
  bundledComponents: DesktopStartupEvidenceBundledComponents | null;
  paths: DesktopStartupEvidencePaths | null;
  descriptor: DesktopStartupEvidenceDescriptor | null;
  hostPlatformStatus: HostPlatformStatusRecord | null;
  hostEndpoints: ManageHostEndpointRecord[];
  openClawRuntime: ManageOpenClawRuntimeRecord | null;
  openClawGateway: ManageOpenClawGatewayRecord | null;
  builtInInstance: DesktopStartupEvidenceBuiltInInstance | null;
  openClawConfigHealth: DesktopStartupEvidenceOpenClawConfigHealth | null;
  readinessEvidence: DesktopHostedRuntimeReadinessEvidence | null;
  localAiProxy: DesktopStartupEvidenceLocalAiProxy | null;
  error: DesktopStartupEvidenceErrorSummary | null;
}

export function resolvePassingDesktopStartupEvidencePhase(
  hasShellMounted: boolean,
): DesktopStartupEvidencePhase {
  return hasShellMounted ? 'shell-mounted' : 'runtime-ready';
}

export function shouldPersistShellMountedDesktopStartupEvidence({
  runtimeReadinessFailed,
  readinessSnapshot,
}: {
  runtimeReadinessFailed: boolean;
  readinessSnapshot: DesktopHostedRuntimeReadinessSnapshot | null | undefined;
}): boolean {
  return !runtimeReadinessFailed && readinessSnapshot?.evidence?.ready === true;
}

export function sanitizeDesktopStartupDescriptor(
  descriptor: DesktopHostedRuntimeDescriptor | null | undefined,
): DesktopStartupEvidenceDescriptor | null {
  if (!descriptor) {
    return null;
  }

  return {
    mode: descriptor.mode,
    lifecycle: descriptor.lifecycle,
    apiBasePath: descriptor.apiBasePath,
    manageBasePath: descriptor.manageBasePath,
    internalBasePath: descriptor.internalBasePath,
    browserBaseUrl: descriptor.browserBaseUrl,
    lastError: descriptor.lastError ?? null,
    endpointId: descriptor.endpointId ?? null,
    requestedPort: descriptor.requestedPort ?? null,
    activePort: descriptor.activePort ?? null,
    loopbackOnly: descriptor.loopbackOnly ?? null,
    dynamicPort: descriptor.dynamicPort ?? null,
    stateStoreDriver: descriptor.stateStoreDriver ?? null,
    stateStoreProfileId: descriptor.stateStoreProfileId ?? null,
    runtimeDataDir: descriptor.runtimeDataDir ?? null,
    webDistDir: descriptor.webDistDir ?? null,
  };
}

export function sanitizeDesktopStartupPaths(
  paths: RuntimePathsInfo | null | undefined,
): DesktopStartupEvidencePaths | null {
  if (!paths) {
    return null;
  }

  return {
    dataDir: paths.dataDir,
    logsDir: paths.logsDir,
    machineLogsDir: paths.machineLogsDir,
    mainLogFile: paths.mainLogFile,
  };
}

export function sanitizeDesktopStartupBuiltInInstance(
  instance: StudioInstanceRecord | null | undefined,
): DesktopStartupEvidenceBuiltInInstance | null {
  if (!instance) {
    return null;
  }

  return {
    id: instance.id,
    name: instance.name,
    version: instance.version,
    runtimeKind: instance.runtimeKind,
    deploymentMode: instance.deploymentMode,
    transportKind: instance.transportKind,
    status: instance.status,
    baseUrl: instance.baseUrl ?? null,
    websocketUrl: instance.websocketUrl ?? null,
    isBuiltIn: instance.isBuiltIn,
    isDefault: instance.isDefault,
  };
}

function normalizeOptionalString(
  value: string | null | undefined,
): string | null {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

export function sanitizeDesktopStartupBundledComponents(
  bundledComponents: RuntimeDesktopBundledComponentsInfo | null | undefined,
): DesktopStartupEvidenceBundledComponents | null {
  if (!bundledComponents) {
    return null;
  }

  return {
    packageProfileId: bundledComponents.packageProfileId,
    includedKernelIds: [...bundledComponents.includedKernelIds],
    defaultEnabledKernelIds: [...bundledComponents.defaultEnabledKernelIds],
    componentCount: bundledComponents.componentCount,
    defaultStartupComponentIds: [...bundledComponents.defaultStartupComponentIds],
    autoUpgradeEnabled: bundledComponents.autoUpgradeEnabled,
    approvalMode: bundledComponents.approvalMode,
    components: bundledComponents.components.map((component: RuntimeDesktopBundledComponentInfo) => ({
      ...component,
    })),
  };
}

export function sanitizeDesktopStartupLocalAiProxy(
  localAiProxy: RuntimeDesktopLocalAiProxyInfo | null | undefined,
): DesktopStartupEvidenceLocalAiProxy | null {
  if (!localAiProxy) {
    return null;
  }

  return {
    lifecycle: localAiProxy.lifecycle,
    messageCaptureEnabled: localAiProxy.messageCaptureEnabled,
    observabilityDbPath: normalizeOptionalString(localAiProxy.observabilityDbPath),
    snapshotPath: normalizeOptionalString(localAiProxy.snapshotPath),
    logPath: normalizeOptionalString(localAiProxy.logPath),
  };
}

function cloneStringArray(values: string[] | null | undefined): string[] {
  return Array.isArray(values)
    ? values
      .map((value) => String(value ?? '').trim())
      .filter(Boolean)
    : [];
}

export function sanitizeDesktopStartupOpenClawConfigHealth(
  openClawRuntime: Pick<RuntimeDesktopOpenClawRuntimeInfo, 'channelConfigHealth'> | null | undefined,
): DesktopStartupEvidenceOpenClawConfigHealth | null {
  const health = openClawRuntime?.channelConfigHealth;
  if (!health || typeof health !== 'object') {
    return null;
  }

  return {
    status: String(health.status ?? '').trim() || 'unknown',
    valid: health.valid === true,
    runtimeMetadataAvailable: health.runtimeMetadataAvailable === true,
    configReadable: health.configReadable === true,
    supportedChannelIds: cloneStringArray(health.supportedChannelIds),
    configuredChannelIds: cloneStringArray(health.configuredChannelIds),
    unknownChannelIds: cloneStringArray(health.unknownChannelIds),
    malformedChannelIds: cloneStringArray(health.malformedChannelIds),
    modelByChannelIds: cloneStringArray(health.modelByChannelIds),
    unknownModelByChannelIds: cloneStringArray(health.unknownModelByChannelIds),
    invalidModelByChannelIds: cloneStringArray(health.invalidModelByChannelIds),
  };
}

function summarizeStartupError(
  error: unknown,
): DesktopStartupEvidenceErrorSummary | null {
  if (typeof error === 'undefined' || error === null) {
    return null;
  }

  if (error instanceof Error) {
    const cause =
      typeof error.cause === 'string'
        ? error.cause
        : error.cause instanceof Error
          ? error.cause.message
          : error.cause == null
            ? null
            : String(error.cause);

    return {
      message: error.message || String(error),
      cause,
    };
  }

  return {
    message: String(error),
    cause: null,
  };
}

export function buildDesktopStartupEvidenceDocument({
  status,
  phase,
  runId,
  durationMs,
  appInfo = null,
  bundledComponents = null,
  appPaths = null,
  readinessSnapshot = null,
  openClawRuntime = null,
  localAiProxy = null,
  error = null,
  recordedAt = new Date().toISOString(),
}: {
  status: DesktopStartupEvidenceStatus;
  phase: DesktopStartupEvidencePhase;
  runId: number;
  durationMs: number;
  appInfo?: RuntimeAppInfo | null;
  bundledComponents?: RuntimeDesktopBundledComponentsInfo | null;
  appPaths?: RuntimePathsInfo | null;
  readinessSnapshot?: DesktopHostedRuntimeReadinessSnapshot | null;
  openClawRuntime?: RuntimeDesktopOpenClawRuntimeInfo | null;
  localAiProxy?: RuntimeDesktopLocalAiProxyInfo | null;
  error?: unknown;
  recordedAt?: string;
}): DesktopStartupEvidenceDocument {
  const builtInInstance = resolveBuiltInOpenClawInstance(readinessSnapshot?.instances, {
    preferredInstanceId: readinessSnapshot?.evidence?.builtInInstanceId ?? null,
    gatewayBaseUrl: readinessSnapshot?.openClawGateway?.baseUrl ?? null,
    gatewayWebsocketUrl: readinessSnapshot?.openClawGateway?.websocketUrl ?? null,
  });

  return {
    version: 1,
    status,
    phase,
    runId,
    durationMs: Math.max(0, Math.trunc(durationMs)),
    recordedAt,
    app: appInfo ?? null,
    bundledComponents: sanitizeDesktopStartupBundledComponents(bundledComponents),
    paths: sanitizeDesktopStartupPaths(appPaths),
    descriptor: sanitizeDesktopStartupDescriptor(readinessSnapshot?.descriptor),
    hostPlatformStatus: readinessSnapshot?.hostPlatformStatus ?? null,
    hostEndpoints: readinessSnapshot?.hostEndpoints ?? [],
    openClawRuntime: readinessSnapshot?.openClawRuntime ?? null,
    openClawGateway: readinessSnapshot?.openClawGateway ?? null,
    builtInInstance: sanitizeDesktopStartupBuiltInInstance(builtInInstance),
    openClawConfigHealth: sanitizeDesktopStartupOpenClawConfigHealth(openClawRuntime),
    readinessEvidence: readinessSnapshot?.evidence ?? null,
    localAiProxy: sanitizeDesktopStartupLocalAiProxy(localAiProxy),
    error: summarizeStartupError(error),
  };
}

export function serializeDesktopStartupEvidence(
  document: DesktopStartupEvidenceDocument,
): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}
