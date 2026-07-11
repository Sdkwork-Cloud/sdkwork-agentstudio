import type { HostPlatformMode } from './internal.ts';
import type { RuntimeDesktopKernelHostInfo } from './kernel.ts';
import type {
  LocalAiProxyRouteTestRecord,
  LocalAiProxyRouteRuntimeMetrics,
  StudioInstanceStatus,
} from '@sdkwork/agentstudio-pc-types';

export interface RuntimeAppInfo {
  name: string;
  version: string;
  target: string;
}

export interface RuntimePathsInfo {
  installRoot: string;
  foundationDir: string;
  foundationComponentsDir: string;
  modulesDir: string;
  runtimesDir: string;
  toolsDir: string;
  trustDir: string;
  packsDir: string;
  extensionsDir: string;
  machineRoot: string;
  machineStateDir: string;
  machineStoreDir: string;
  machineStagingDir: string;
  machineReceiptsDir: string;
  machineRuntimeDir: string;
  machineRecoveryDir: string;
  machineLogsDir: string;
  userRoot: string;
  userDir: string;
  userAuthDir: string;
  userStorageDir: string;
  userIntegrationsDir: string;
  studioDir: string;
  workspacesDir: string;
  studioBackupsDir: string;
  userLogsDir: string;
  configDir: string;
  dataDir: string;
  cacheDir: string;
  logsDir: string;
  stateDir: string;
  storageDir: string;
  pluginsDir: string;
  integrationsDir: string;
  backupsDir: string;
  configFile: string;
  layoutFile: string;
  activeFile: string;
  inventoryFile: string;
  retentionFile: string;
  pinnedFile: string;
  channelsFile: string;
  policiesFile: string;
  sourcesFile: string;
  serviceFile: string;
  componentsFile: string;
  upgradesFile: string;
  componentRegistryFile: string;
  serviceDefaultsFile: string;
  upgradePolicyFile: string;
  deviceIdFile: string;
  mainLogFile: string;
}

export interface RuntimeConfigStorageProfile {
  id: string;
  label: string;
  provider: 'memory' | 'localFile' | 'sqlite' | 'postgres' | 'remoteApi';
  namespace: string;
  path?: string | null;
  connectionConfigured: boolean;
  databaseConfigured: boolean;
  endpointConfigured: boolean;
  readOnly: boolean;
}

export interface RuntimeConfigStorageInfo {
  activeProfileId: string;
  profiles: RuntimeConfigStorageProfile[];
}

export interface RuntimeConfigSecurityInfo {
  strictPathPolicy: boolean;
  allowExternalHttp: boolean;
  allowCustomProcessCwd: boolean;
}

export interface RuntimeConfigNotificationsInfo {
  enabled: boolean;
  provider: string;
  requireUserConsent: boolean;
}

export interface RuntimeConfigPaymentsInfo {
  provider: string;
  sandbox: boolean;
}

export interface RuntimeConfigIntegrationsInfo {
  pluginsEnabled: boolean;
  remoteApiEnabled: boolean;
  allowUnsignedPlugins: boolean;
}

export interface RuntimeConfigProcessInfo {
  defaultTimeoutMs: number;
  maxConcurrentJobs: number;
}

export type RuntimeLanguagePreference =
  | 'system'
  | 'en'
  | 'zh'
  | 'zh-TW'
  | 'fr'
  | 'de'
  | 'pt-BR'
  | 'ja'
  | 'ko'
  | 'es'
  | 'tr'
  | 'uk'
  | 'pl'
  | 'id';

export interface RuntimeConfigInfo {
  version: number;
  distribution: string;
  logLevel: string;
  theme: string;
  language: RuntimeLanguagePreference;
  telemetryEnabled: boolean;
  security: RuntimeConfigSecurityInfo;
  storage: RuntimeConfigStorageInfo;
  notifications: RuntimeConfigNotificationsInfo;
  payments: RuntimeConfigPaymentsInfo;
  integrations: RuntimeConfigIntegrationsInfo;
  process: RuntimeConfigProcessInfo;
}

export interface RuntimeSystemInfo {
  os: string;
  arch: string;
  family: string;
  target: string;
}

export type RuntimeJobState = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface RuntimeJobRecord {
  id: string;
  kind: string;
  state: RuntimeJobState;
  stage: string;
  profileId?: string;
  processId?: string;
}

export interface RuntimeJobUpdateEvent {
  record: RuntimeJobRecord;
}

export type RuntimeProcessOutputStream = 'stdout' | 'stderr';

export interface RuntimeProcessOutputEvent {
  jobId?: string;
  processId: string;
  command: string;
  stream: RuntimeProcessOutputStream;
  chunk: string;
}

export interface RuntimeBuiltInOpenClawStatusChangedEvent {
  instanceId: string;
  status: StudioInstanceStatus;
}

export type RuntimeStorageAvailability = 'ready' | 'configurationRequired' | 'planned';

export interface RuntimeStorageCapabilities {
  durable: boolean;
  structured: boolean;
  queryable: boolean;
  transactional: boolean;
  remote: boolean;
}

export interface RuntimeStorageProviderInfo {
  id: string;
  kind: 'memory' | 'localFile' | 'sqlite' | 'postgres' | 'remoteApi';
  label: string;
  availability: RuntimeStorageAvailability;
  requiresConfiguration: boolean;
  capabilities: RuntimeStorageCapabilities;
}

export interface RuntimeStorageProfileInfo {
  id: string;
  label: string;
  provider: 'memory' | 'localFile' | 'sqlite' | 'postgres' | 'remoteApi';
  active: boolean;
  availability: RuntimeStorageAvailability;
  namespace: string;
  readOnly: boolean;
  path?: string | null;
  connectionConfigured: boolean;
  databaseConfigured: boolean;
  endpointConfigured: boolean;
}

export interface RuntimeStorageInfo {
  activeProfileId: string;
  rootDir: string;
  providers: RuntimeStorageProviderInfo[];
  profiles: RuntimeStorageProfileInfo[];
}

export type RuntimeDesktopKernelCapabilityStatus = 'ready' | 'planned';
export type RuntimeDesktopProviderAvailability = 'ready' | 'configurationRequired' | 'planned';

export interface RuntimeDesktopKernelCapability {
  key: string;
  status: RuntimeDesktopKernelCapabilityStatus;
  detail: string;
}

export interface RuntimeDesktopKernelDirectories {
  installRoot: string;
  modulesDir: string;
  runtimesDir: string;
  machineRoot: string;
  machineStateDir: string;
  machineStoreDir: string;
  machineStagingDir: string;
  userRoot: string;
  studioDir: string;
  storageDir: string;
  pluginsDir: string;
  integrationsDir: string;
  backupsDir: string;
}

export interface RuntimeDesktopFilesystemInfo {
  defaultWorkingDirectory: string;
  managedRoots: string[];
  supportsBinaryIo: boolean;
}

export interface RuntimeDesktopSecurityInfo {
  strictPathPolicy: boolean;
  allowExternalHttp: boolean;
  allowCustomProcessCwd: boolean;
  allowedSpawnCommands: string[];
}

export interface RuntimeDesktopProcessProfileInfo {
  id: string;
  jobKind: string;
  command: string;
  args: string[];
  defaultTimeoutMs: number;
  allowCancellation: boolean;
}

export interface RuntimeDesktopProcessInfo {
  defaultTimeoutMs: number;
  maxConcurrentJobs: number;
  activeJobCount: number;
  activeProcessJobCount: number;
  availableProfiles: RuntimeDesktopProcessProfileInfo[];
}

export type RuntimeDesktopPermissionStatus = 'granted' | 'managed' | 'planned';

export interface RuntimeDesktopPermissionInfo {
  key: string;
  status: RuntimeDesktopPermissionStatus;
  required: boolean;
  detail: string;
}

export interface RuntimeDesktopPermissionsInfo {
  entries: RuntimeDesktopPermissionInfo[];
}

export interface RuntimeDesktopNotificationProviderInfo {
  id: string;
  label: string;
  availability: RuntimeDesktopProviderAvailability;
  transport: string;
  requiresUserConsent: boolean;
}

export interface RuntimeDesktopNotificationInfo {
  enabled: boolean;
  provider: string;
  requireUserConsent: boolean;
  status: RuntimeDesktopKernelCapabilityStatus;
  availableProviders: RuntimeDesktopNotificationProviderInfo[];
}

export interface RuntimeDesktopPaymentProviderInfo {
  id: string;
  label: string;
  availability: RuntimeDesktopProviderAvailability;
  supportsSandbox: boolean;
  remote: boolean;
}

export interface RuntimeDesktopPaymentInfo {
  provider: string;
  sandbox: boolean;
  status: RuntimeDesktopKernelCapabilityStatus;
  availableProviders: RuntimeDesktopPaymentProviderInfo[];
}

export interface RuntimeDesktopIntegrationAdapterInfo {
  id: string;
  label: string;
  kind: string;
  availability: RuntimeDesktopProviderAvailability;
  enabled: boolean;
  requiresSignedPlugins: boolean;
}

export interface RuntimeDesktopIntegrationInfo {
  pluginsEnabled: boolean;
  remoteApiEnabled: boolean;
  allowUnsignedPlugins: boolean;
  pluginsDir: string;
  integrationsDir: string;
  installedPluginCount: number;
  status: RuntimeDesktopKernelCapabilityStatus;
  availableAdapters: RuntimeDesktopIntegrationAdapterInfo[];
}

export interface RuntimeDesktopSupervisorServiceInfo {
  id: string;
  displayName: string;
  lifecycle: string;
  pid?: number;
  lastExitCode?: number;
  restartCount: number;
  lastError?: string;
}

export interface RuntimeDesktopSupervisorInfo {
  lifecycle: string;
  shutdownRequested: boolean;
  serviceCount: number;
  managedServiceIds: string[];
  services: RuntimeDesktopSupervisorServiceInfo[];
}

export interface RuntimeDesktopBundledComponentInfo {
  id: string;
  displayName: string;
  kind: string;
  bundledVersion: string;
  startupMode: string;
  installSubdir: string;
}

export interface RuntimeDesktopBundledComponentsInfo {
  packageProfileId: string;
  includedKernelIds: string[];
  defaultEnabledKernelIds: string[];
  componentCount: number;
  defaultStartupComponentIds: string[];
  autoUpgradeEnabled: boolean;
  approvalMode: string;
  components: RuntimeDesktopBundledComponentInfo[];
}

export interface RuntimeDesktopOpenClawRuntimeStageInfo {
  id: string;
  status: string;
  detail: string;
}

export interface RuntimeDesktopOpenClawProviderProjectionInfo {
  providerId: string;
  available: boolean;
  status: string;
  baseUrl?: string | null;
  api?: string | null;
  auth?: string | null;
  defaultModel?: string | null;
}

export interface RuntimeDesktopOpenClawRuntimeAuthorityProbeInfo {
  supportsLoopbackHealthProbe: boolean;
  healthProbeTimeoutMs: number;
}

export interface RuntimeDesktopOpenClawRuntimeAuthorityInfo {
  configFile: string;
  ownedRuntimeRoots: string[];
  readinessProbe: RuntimeDesktopOpenClawRuntimeAuthorityProbeInfo;
}

export interface RuntimeDesktopOpenClawChannelConfigHealthInfo {
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

export interface RuntimeDesktopKernelRuntimeAuthorityProbeInfo {
  supportsLoopbackHealthProbe: boolean;
  healthProbeTimeoutMs: number;
}

export interface RuntimeDesktopKernelRuntimeAuthorityInfo {
  runtimeId: string;
  configFile: string;
  ownedRuntimeRoots: string[];
  readinessProbe: RuntimeDesktopKernelRuntimeAuthorityProbeInfo;
  runtimeVersion?: string | null;
  nodeVersion?: string | null;
  platform?: string | null;
  arch?: string | null;
  installSource?: RuntimeDesktopKernelHostInfo['provenance']['installSource'] | null;
  runtimeHomeDir?: string | null;
  runtimeInstallDir?: string | null;
}

export interface RuntimeDesktopActiveKernelRuntimeInfo {
  runtimeId: string;
  state: string;
  health: string;
  reason: string;
  installKey?: string | null;
  installSource: RuntimeDesktopKernelHostInfo['provenance']['installSource'];
  runtimeVersion?: string | null;
  nodeVersion?: string | null;
  platform: string;
  arch: string;
  configFile: string;
  runtimeHomeDir: string;
  runtimeInstallDir?: string | null;
  authority?: RuntimeDesktopKernelRuntimeAuthorityInfo | null;
}

export interface RuntimeDesktopOpenClawRuntimeInfo {
  runtimeId: string;
  lifecycle: string;
  configured: boolean;
  installKey?: string | null;
  openclawVersion?: string | null;
  nodeVersion?: string | null;
  platform: string;
  arch: string;
  installDir?: string | null;
  runtimeDir?: string | null;
  homeDir: string;
  stateDir: string;
  workspaceDir: string;
  configFile: string;
  gatewayPort?: number | null;
  gatewayBaseUrl?: string | null;
  localAiProxyBaseUrl?: string | null;
  localAiProxySnapshotPath: string;
  authority: RuntimeDesktopOpenClawRuntimeAuthorityInfo;
  channelConfigHealth?: RuntimeDesktopOpenClawChannelConfigHealthInfo | null;
  providerProjection: RuntimeDesktopOpenClawProviderProjectionInfo;
  startupChain: RuntimeDesktopOpenClawRuntimeStageInfo[];
}

export interface RuntimeDesktopLocalAiProxyInfo {
  lifecycle: string;
  baseUrl?: string | null;
  rootBaseUrl?: string | null;
  openaiCompatibleBaseUrl?: string | null;
  anthropicBaseUrl?: string | null;
  geminiBaseUrl?: string | null;
  activePort?: number | null;
  loopbackOnly: boolean;
  defaultRouteId?: string | null;
  defaultRouteName?: string | null;
  defaultRoutes: RuntimeDesktopLocalAiProxyDefaultRouteInfo[];
  upstreamBaseUrl?: string | null;
  modelCount: number;
  routeMetrics: LocalAiProxyRouteRuntimeMetrics[];
  routeTests: LocalAiProxyRouteTestRecord[];
  messageCaptureEnabled: boolean;
  observabilityDbPath?: string | null;
  configFile: string;
  snapshotPath: string;
  logPath: string;
  lastError?: string | null;
}

export interface RuntimeDesktopLocalAiProxyDefaultRouteInfo {
  clientProtocol: string;
  id: string;
  name: string;
  managedBy: string;
  upstreamProtocol: string;
  upstreamBaseUrl: string;
  modelCount: number;
}

export interface RuntimeDesktopStartupEvidenceInfo {
  status?: string | null;
  phase?: string | null;
  runId?: number | null;
  recordedAt?: string | null;
  durationMs?: number | null;
  evidencePath: string;
  descriptorMode?: string | null;
  descriptorLifecycle?: string | null;
  descriptorEndpointId?: string | null;
  descriptorRequestedPort?: number | null;
  descriptorActivePort?: number | null;
  descriptorLoopbackOnly?: boolean | null;
  descriptorDynamicPort?: boolean | null;
  descriptorStateStoreDriver?: string | null;
  descriptorStateStoreProfileId?: string | null;
  descriptorBrowserBaseUrl?: string | null;
  manageBaseUrl?: string | null;
  builtInInstanceId?: string | null;
  builtInInstanceName?: string | null;
  builtInInstanceVersion?: string | null;
  builtInInstanceRuntimeKind?: string | null;
  builtInInstanceDeploymentMode?: string | null;
  builtInInstanceTransportKind?: string | null;
  builtInInstanceBaseUrl?: string | null;
  builtInInstanceWebsocketUrl?: string | null;
  builtInInstanceIsBuiltIn?: boolean | null;
  builtInInstanceIsDefault?: boolean | null;
  builtInInstanceStatus?: string | null;
  openClawRuntimeLifecycle?: string | null;
  openClawGatewayLifecycle?: string | null;
  ready?: boolean | null;
  errorMessage?: string | null;
  errorCause?: string | null;
}

export interface RuntimeDesktopKernelInfo {
  directories: RuntimeDesktopKernelDirectories;
  capabilities: RuntimeDesktopKernelCapability[];
  filesystem: RuntimeDesktopFilesystemInfo;
  security: RuntimeDesktopSecurityInfo;
  process: RuntimeDesktopProcessInfo;
  permissions: RuntimeDesktopPermissionsInfo;
  notifications: RuntimeDesktopNotificationInfo;
  payments: RuntimeDesktopPaymentInfo;
  integrations: RuntimeDesktopIntegrationInfo;
  supervisor: RuntimeDesktopSupervisorInfo;
  activeRuntime: RuntimeDesktopActiveKernelRuntimeInfo;
  openClawRuntime?: RuntimeDesktopOpenClawRuntimeInfo | null;
  runtimeAuthorities?: RuntimeDesktopKernelRuntimeAuthorityInfo[] | null;
  localAiProxy: RuntimeDesktopLocalAiProxyInfo;
  desktopStartupEvidence?: RuntimeDesktopStartupEvidenceInfo | null;
  bundledComponents: RuntimeDesktopBundledComponentsInfo;
  storage: RuntimeStorageInfo;
  host: RuntimeDesktopKernelHostInfo;
}

export type RuntimeEventUnsubscribe = () => void | Promise<void>;

export type RuntimePlatformKind = 'web' | 'desktop' | 'server';
export type RuntimeDistributionFamily = 'web' | 'desktop' | 'server';
export type RuntimeDeploymentFamily = 'bareMetal' | 'container' | 'kubernetes';
export type RuntimeAcceleratorProfile = 'cpu' | 'nvidia-cuda' | 'amd-rocm';

export interface RuntimeStartupContext {
  hostMode: HostPlatformMode;
  distributionFamily: RuntimeDistributionFamily;
  deploymentFamily: RuntimeDeploymentFamily;
  acceleratorProfile?: RuntimeAcceleratorProfile | null;
  hostedBrowser: boolean;
  apiBasePath?: string | null;
  manageBasePath?: string | null;
  internalBasePath?: string | null;
  browserBaseUrl?: string | null;
  hostEndpointId?: string | null;
  hostRequestedPort?: number | null;
  hostActivePort?: number | null;
  hostLoopbackOnly?: boolean | null;
  hostDynamicPort?: boolean | null;
  stateStoreDriver?: string | null;
  stateStoreProfileId?: string | null;
  runtimeDataDir?: string | null;
  webDistDir?: string | null;
}

export interface RuntimeInfo {
  platform: RuntimePlatformKind;
  startup?: RuntimeStartupContext | null;
  app?: RuntimeAppInfo | null;
  paths?: RuntimePathsInfo | null;
  config?: RuntimeConfigInfo | null;
  system?: RuntimeSystemInfo | null;
}

export interface RuntimePlatformAPI {
  getRuntimeInfo(): Promise<RuntimeInfo>;
  setAppLanguage(language: RuntimeLanguagePreference): Promise<void>;
  submitProcessJob(profileId: string): Promise<string>;
  getJob(id: string): Promise<RuntimeJobRecord>;
  listJobs(): Promise<RuntimeJobRecord[]>;
  cancelJob(id: string): Promise<RuntimeJobRecord>;
  subscribeJobUpdates(listener: (event: RuntimeJobUpdateEvent) => void): Promise<RuntimeEventUnsubscribe>;
  subscribeProcessOutput(listener: (event: RuntimeProcessOutputEvent) => void): Promise<RuntimeEventUnsubscribe>;
  subscribeBuiltInOpenClawStatusChanged(
    listener: (event: RuntimeBuiltInOpenClawStatusChangedEvent) => void,
  ): Promise<RuntimeEventUnsubscribe>;
}
