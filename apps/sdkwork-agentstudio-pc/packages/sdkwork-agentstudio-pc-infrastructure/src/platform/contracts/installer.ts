import type { RuntimeEventUnsubscribe } from './runtime.ts';

export type InstallScope = 'user' | 'system';
export type InstallPlatform =
  | 'windows'
  | 'macos'
  | 'ubuntu'
  | 'android'
  | 'ios'
  | 'wsl';
export type InstallRecordStatus = 'installed' | 'uninstalled';
export type InstallControlLevel = 'managed' | 'partial' | 'opaque';
export type InstallContainerRuntimePreference = 'auto' | 'host' | 'wsl';
export type InstallProgressStream = 'stdout' | 'stderr';
export type InstallProgressOperationKind =
  | 'install'
  | 'dependencyInstall'
  | 'uninstall';
export type InstallCatalogHostPlatform = Extract<
  InstallPlatform,
  'windows' | 'macos' | 'ubuntu'
>;
export type InstallCatalogRuntimePlatform = 'host' | 'wsl';

export interface InstallRequest {
  softwareName: string;
  requestId?: string;
  registrySource?: string;
  installScope?: InstallScope;
  effectiveRuntimePlatform?: InstallPlatform;
  containerRuntimePreference?: InstallContainerRuntimePreference;
  wslDistribution?: string;
  dockerContext?: string;
  dockerHost?: string;
  dryRun?: boolean;
  verbose?: boolean;
  sudo?: boolean;
  timeoutMs?: number;
  installerHome?: string;
  installRoot?: string;
  workRoot?: string;
  binDir?: string;
  dataRoot?: string;
  variables?: Record<string, string>;
}

export interface InstallCatalogQuery {
  hostPlatform?: InstallCatalogHostPlatform;
}

export interface InstallCatalogVariant {
  id: string;
  label: string;
  summary: string;
  softwareName: string;
  hostPlatforms: InstallCatalogHostPlatform[];
  runtimePlatform: InstallCatalogRuntimePlatform;
  manifestName?: string | null;
  manifestDescription?: string | null;
  manifestHomepage?: string | null;
  installationMethod?: InstallAssessmentInstallationMethod | null;
  request: InstallRequest;
}

export interface InstallCatalogEntry {
  appId: string;
  title: string;
  developer: string;
  category: string;
  summary: string;
  description?: string | null;
  homepage?: string | null;
  tags: string[];
  defaultVariantId: string;
  defaultSoftwareName: string;
  supportedHostPlatforms: InstallCatalogHostPlatform[];
  variants: InstallCatalogVariant[];
}

export interface InstallStageReport {
  stage: string;
  success: boolean;
  durationMs: number;
  totalSteps: number;
  failedSteps: number;
}

export interface InstallArtifactReport {
  artifactId: string;
  artifactType: string;
  success: boolean;
  durationMs: number;
  detail: string;
}

export interface InstallResult {
  registryName: string;
  registrySource: string;
  softwareName: string;
  manifestSource: string;
  manifestName: string;
  success: boolean;
  durationMs: number;
  platform: InstallPlatform;
  effectiveRuntimePlatform: InstallPlatform;
  resolvedInstallScope: InstallScope;
  resolvedInstallRoot: string;
  resolvedWorkRoot: string;
  resolvedBinDir: string;
  resolvedDataRoot: string;
  installControlLevel: InstallControlLevel;
  stageReports: InstallStageReport[];
  artifactReports: InstallArtifactReport[];
}

export interface InstallDependencyRequest extends InstallRequest {
  dependencyIds?: string[];
  continueOnError?: boolean;
}

export interface InstallDependencyReport {
  dependencyId: string;
  description?: string | null;
  target: string;
  required: boolean;
  statusBefore: InstallAssessmentDependencyStatus;
  statusAfter: InstallAssessmentDependencyStatus;
  attemptedAutoRemediation: boolean;
  success: boolean;
  skipped: boolean;
  durationMs: number;
  stepCount: number;
  error?: string | null;
}

export interface InstallDependencyResult {
  manifestName: string;
  manifestSource: string;
  manifestSourceInput: string;
  manifestSourceKind: string;
  registryName: string;
  registrySource: string;
  softwareName: string;
  success: boolean;
  durationMs: number;
  platform: InstallPlatform;
  effectiveRuntimePlatform: InstallPlatform;
  resolvedInstallScope: InstallScope;
  resolvedInstallRoot: string;
  resolvedWorkRoot: string;
  resolvedBinDir: string;
  resolvedDataRoot: string;
  installControlLevel: InstallControlLevel;
  dependencyReports: InstallDependencyReport[];
}

export type InstallAssessmentSeverity = 'error' | 'warning' | 'info';
export type InstallAssessmentDependencyStatus =
  | 'available'
  | 'missing'
  | 'remediable'
  | 'unsupported';
export type InstallAssessmentCheckType = 'command' | 'file' | 'env' | 'platform';
export type InstallAssessmentShellKind = 'bash' | 'powershell' | 'cmd';
export type InstallResolvedContainerRuntime = 'host' | 'wsl';
export type InstallAssessmentMethodType =
  | 'binary'
  | 'command'
  | 'container'
  | 'git'
  | 'package'
  | 'script'
  | 'source'
  | 'wsl'
  | string;
export type InstallAssessmentDataItemKind =
  | 'database'
  | 'directory'
  | 'file'
  | 'log'
  | string;
export type InstallAssessmentDataUninstallPolicy = 'manual' | 'preserve' | 'remove' | string;
export type InstallAssessmentMigrationMode = 'command' | 'manual' | string;

export interface InstallAssessmentCommand {
  description: string;
  commandLine: string;
  shellKind?: InstallAssessmentShellKind | null;
  workingDirectory?: string | null;
  requiresElevation: boolean;
  autoRun: boolean;
}

export interface InstallAssessmentDependency {
  id: string;
  description?: string | null;
  required: boolean;
  checkType: InstallAssessmentCheckType;
  target: string;
  status: InstallAssessmentDependencyStatus;
  supportsAutoRemediation: boolean;
  remediationCommands: InstallAssessmentCommand[];
}

export interface InstallAssessmentInstallationMethod {
  id: string;
  label: string;
  type: InstallAssessmentMethodType;
  summary: string;
  supported?: boolean | null;
  documentationUrl?: string | null;
  notes: string[];
}

export interface InstallAssessmentInstallationDirectory {
  id?: string | null;
  path: string;
  customizable?: boolean | null;
  purpose?: string | null;
}

export interface InstallAssessmentInstallationDirectories {
  installRoot?: InstallAssessmentInstallationDirectory | null;
  workRoot?: InstallAssessmentInstallationDirectory | null;
  binDir?: InstallAssessmentInstallationDirectory | null;
  dataRoot?: InstallAssessmentInstallationDirectory | null;
  additional: InstallAssessmentInstallationDirectory[];
}

export interface InstallAssessmentInstallation {
  method: InstallAssessmentInstallationMethod;
  alternatives: InstallAssessmentInstallationMethod[];
  directories?: InstallAssessmentInstallationDirectories | null;
}

export interface InstallAssessmentDataItem {
  id: string;
  title: string;
  kind: InstallAssessmentDataItemKind;
  path?: string | null;
  description?: string | null;
  includes: string[];
  sensitive?: boolean | null;
  backupByDefault?: boolean | null;
  uninstallByDefault: InstallAssessmentDataUninstallPolicy;
}

export interface InstallAssessmentMigrationStrategy {
  id: string;
  source: string;
  title: string;
  mode: InstallAssessmentMigrationMode;
  summary: string;
  supported?: boolean | null;
  documentationUrl?: string | null;
  previewCommands: InstallAssessmentCommand[];
  applyCommands: InstallAssessmentCommand[];
  dataItemIds: string[];
  warnings: string[];
}

export interface InstallAssessmentIssue {
  severity: InstallAssessmentSeverity;
  code: string;
  message: string;
  dependencyId?: string | null;
}

export interface InstallAssessmentRuntime {
  hostPlatform: InstallPlatform;
  requestedRuntimePlatform: InstallPlatform;
  effectiveRuntimePlatform: InstallPlatform;
  containerRuntimePreference?: InstallContainerRuntimePreference | null;
  resolvedContainerRuntime?: InstallResolvedContainerRuntime | null;
  wslDistribution?: string | null;
  availableWslDistributions: string[];
  wslAvailable: boolean;
  hostDockerAvailable: boolean;
  wslDockerAvailable: boolean;
  runtimeHomeDir?: string | null;
  commandAvailability: Record<string, boolean>;
}

export interface InstallAssessmentResult {
  registryName: string;
  registrySource: string;
  softwareName: string;
  manifestSource: string;
  manifestName: string;
  manifestDescription?: string | null;
  manifestHomepage?: string | null;
  ready: boolean;
  requiresElevatedSetup: boolean;
  platform: InstallPlatform;
  effectiveRuntimePlatform: InstallPlatform;
  resolvedInstallScope: InstallScope;
  resolvedInstallRoot: string;
  resolvedWorkRoot: string;
  resolvedBinDir: string;
  resolvedDataRoot: string;
  installControlLevel: InstallControlLevel;
  installStatus?: InstallRecordStatus | null;
  dependencies: InstallAssessmentDependency[];
  issues: InstallAssessmentIssue[];
  recommendations: string[];
  installation?: InstallAssessmentInstallation | null;
  dataItems: InstallAssessmentDataItem[];
  migrationStrategies: InstallAssessmentMigrationStrategy[];
  runtime: InstallAssessmentRuntime;
}

export interface UninstallRequest extends InstallRequest {
  purgeData?: boolean;
  backupBeforeUninstall?: boolean;
}

export type UninstallTarget = 'data' | 'install' | 'work';
export type UninstallTargetStatus = 'removed' | 'missing' | 'preserved';

export interface UninstallTargetReport {
  target: UninstallTarget;
  status: UninstallTargetStatus;
}

export interface UninstallResult {
  registryName: string;
  registrySource: string;
  softwareName: string;
  manifestSource: string;
  manifestName: string;
  success: boolean;
  durationMs: number;
  platform: InstallPlatform;
  effectiveRuntimePlatform: InstallPlatform;
  resolvedInstallScope: InstallScope;
  resolvedInstallRoot: string;
  resolvedWorkRoot: string;
  resolvedBinDir: string;
  resolvedDataRoot: string;
  installControlLevel: InstallControlLevel;
  purgeData: boolean;
  stageReports: InstallStageReport[];
  targetReports: UninstallTargetReport[];
}

export type InstallProgressEvent = {
  requestId?: string | null;
  softwareName: string;
  operationKind: InstallProgressOperationKind;
} & (
  | {
      type: 'stageStarted';
      stage: string;
      totalSteps: number;
    }
  | {
      type: 'stageCompleted';
      stage: string;
      success: boolean;
      totalSteps: number;
      failedSteps: number;
    }
  | {
      type: 'artifactStarted';
      artifactId: string;
      artifactType: string;
    }
  | {
      type: 'artifactCompleted';
      artifactId: string;
      artifactType: string;
      success: boolean;
    }
  | {
      type: 'dependencyStarted';
      dependencyId: string;
      target: string;
      description?: string | null;
    }
  | {
      type: 'dependencyCompleted';
      dependencyId: string;
      target: string;
      success: boolean;
      skipped: boolean;
      statusAfter: InstallAssessmentDependencyStatus;
    }
  | {
      type: 'stepStarted';
      stepId: string;
      description: string;
    }
  | {
      type: 'stepCommandStarted';
      stepId: string;
      commandLine: string;
      workingDirectory?: string | null;
    }
  | {
      type: 'stepLogChunk';
      stepId: string;
      stream: InstallProgressStream;
      chunk: string;
    }
  | {
      type: 'stepCompleted';
      stepId: string;
      success: boolean;
      skipped: boolean;
      durationMs: number;
      exitCode?: number | null;
    }
);

export interface InstallerPlatformAPI {
  listInstallCatalog(
    query?: InstallCatalogQuery,
  ): Promise<InstallCatalogEntry[]>;
  inspectInstall(request: InstallRequest): Promise<InstallAssessmentResult>;
  runInstallDependencies(request: InstallDependencyRequest): Promise<InstallDependencyResult>;
  runInstall(request: InstallRequest): Promise<InstallResult>;
  runUninstall(request: UninstallRequest): Promise<UninstallResult>;
  subscribeInstallProgress(
    listener: (event: InstallProgressEvent) => void,
  ): Promise<RuntimeEventUnsubscribe>;
}
