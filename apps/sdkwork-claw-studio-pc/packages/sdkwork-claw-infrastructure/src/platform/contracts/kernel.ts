import type {
  LocalAiProxyMessageCaptureSettings,
  LocalAiProxyMessageLogRecord,
  LocalAiProxyMessageLogsQuery,
  OpenClawMirrorExportPreview,
  OpenClawMirrorExportRequest,
  OpenClawMirrorExportResult,
  OpenClawMirrorImportPreview,
  OpenClawMirrorImportRequest,
  OpenClawMirrorImportResult,
  LocalAiProxyRequestLogRecord,
  LocalAiProxyRequestLogsQuery,
  LocalAiProxyRouteTestRecord,
  PaginatedResult,
} from '@sdkwork/claw-types';
import type {
  RuntimeDesktopKernelInfo,
  RuntimeStorageInfo,
} from './runtime.ts';

export type RuntimeDesktopKernelTopologyKind =
  | 'localManagedNative'
  | 'localManagedWsl'
  | 'localManagedContainer'
  | 'localExternal'
  | 'remoteManagedNode'
  | 'remoteAttachedNode';

export type RuntimeDesktopKernelTopologyState =
  | 'unprovisioned'
  | 'provisioning'
  | 'installed'
  | 'attached'
  | 'drifted'
  | 'blocked'
  | 'upgrading'
  | 'rollbackReady';

export type RuntimeDesktopKernelRuntimeState =
  | 'stopped'
  | 'starting'
  | 'running'
  | 'degraded'
  | 'recovering'
  | 'crashLoop'
  | 'failedSafe';

export type RuntimeDesktopKernelHealthStatus =
  | 'healthy'
  | 'degraded'
  | 'failedSafe';

export type RuntimeDesktopKernelServiceManagerKind =
  | 'windowsService'
  | 'launchdLaunchAgent'
  | 'systemdUser'
  | 'systemdSystem'
  | 'tauriSupervisor';

export type RuntimeDesktopKernelOwnershipMode =
  | 'nativeService'
  | 'appSupervisor'
  | 'attached';

export type RuntimeDesktopKernelControlSocketKind =
  | 'namedPipe'
  | 'unixDomainSocket';

export type RuntimeDesktopKernelEndpointSource =
  | 'configured'
  | 'allocated'
  | 'attached';

export type RuntimeDesktopKernelInstallSource =
  | 'bundled'
  | 'external'
  | 'remote';

export type RuntimeKernelPreflightOutcome =
  | 'admissible'
  | 'admissibleDegraded'
  | 'blockedByVersion'
  | 'blockedByCapability'
  | 'blockedByTrust'
  | 'blockedByPolicy';

export interface RuntimeDesktopKernelTopologyInfo {
  kind: RuntimeDesktopKernelTopologyKind;
  state: RuntimeDesktopKernelTopologyState;
  label: string;
  recommended: boolean;
}

export interface RuntimeDesktopKernelRuntimeStatusInfo {
  state: RuntimeDesktopKernelRuntimeState;
  health: RuntimeDesktopKernelHealthStatus;
  reason: string;
  startedBy: RuntimeDesktopKernelOwnershipMode;
  lastTransitionAt: number;
}

export interface RuntimeDesktopKernelEndpointInfo {
  preferredPort: number;
  activePort: number;
  baseUrl: string;
  websocketUrl: string;
  loopbackOnly: boolean;
  dynamicPort: boolean;
  endpointSource: RuntimeDesktopKernelEndpointSource;
}

export interface RuntimeDesktopKernelControlSocketInfo {
  socketKind: RuntimeDesktopKernelControlSocketKind;
  location: string;
  available: boolean;
}

export interface RuntimeDesktopKernelHostServiceInfo {
  serviceManager: RuntimeDesktopKernelServiceManagerKind;
  ownership: RuntimeDesktopKernelOwnershipMode;
  serviceName: string;
  serviceConfigPath: string;
  startupMode: 'auto' | 'manual';
  attachSupported: boolean;
  repairSupported: boolean;
  controlSocket?: RuntimeDesktopKernelControlSocketInfo | null;
}

export interface RuntimeDesktopKernelProvenanceInfo {
  runtimeId: string;
  installKey?: string | null;
  runtimeVersion?: string | null;
  nodeVersion?: string | null;
  platform: string;
  arch: string;
  installSource: RuntimeDesktopKernelInstallSource;
  configFile: string;
  runtimeHomeDir: string;
  runtimeInstallDir?: string | null;
}

export interface RuntimeDesktopKernelHostInfo {
  topology: RuntimeDesktopKernelTopologyInfo;
  runtime: RuntimeDesktopKernelRuntimeStatusInfo;
  endpoint: RuntimeDesktopKernelEndpointInfo;
  host: RuntimeDesktopKernelHostServiceInfo;
  provenance: RuntimeDesktopKernelProvenanceInfo;
}

export interface KernelPlatformAPI {
  getInfo(): Promise<RuntimeDesktopKernelInfo | null>;
  getStorageInfo(): Promise<RuntimeStorageInfo | null>;
  getStatus(): Promise<RuntimeDesktopKernelHostInfo | null>;
  ensureRunning(): Promise<RuntimeDesktopKernelHostInfo | null>;
  restart(): Promise<RuntimeDesktopKernelHostInfo | null>;
  testLocalAiProxyRoute(routeId: string): Promise<LocalAiProxyRouteTestRecord | null>;
  listLocalAiProxyRequestLogs(
    query: LocalAiProxyRequestLogsQuery,
  ): Promise<PaginatedResult<LocalAiProxyRequestLogRecord>>;
  listLocalAiProxyMessageLogs(
    query: LocalAiProxyMessageLogsQuery,
  ): Promise<PaginatedResult<LocalAiProxyMessageLogRecord>>;
  updateLocalAiProxyMessageCapture(
    enabled: boolean,
  ): Promise<LocalAiProxyMessageCaptureSettings>;
  inspectOpenClawMirrorExport(): Promise<OpenClawMirrorExportPreview | null>;
  exportOpenClawMirror(request: OpenClawMirrorExportRequest): Promise<OpenClawMirrorExportResult>;
  inspectOpenClawMirrorImport(sourcePath: string): Promise<OpenClawMirrorImportPreview | null>;
  importOpenClawMirror(request: OpenClawMirrorImportRequest): Promise<OpenClawMirrorImportResult>;
}
