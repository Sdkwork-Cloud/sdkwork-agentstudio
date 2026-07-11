export type OpenClawMirrorMode =
  | 'full-private'
  | 'portable-private'
  | 'template-share';

export type OpenClawMirrorComponentKind =
  | 'config'
  | 'state'
  | 'workspace'
  | 'credentials'
  | 'extensions'
  | 'skills'
  | 'telemetry';

export interface OpenClawMirrorRuntimeRecord {
  runtimeId: string;
  installKey?: string | null;
  openclawVersion?: string | null;
  nodeVersion?: string | null;
  platform: string;
  arch: string;
  homeDir: string;
  stateDir: string;
  workspaceDir: string;
  configFile: string;
  gatewayPort: number;
}

export interface OpenClawMirrorManifestRuntimeRecord {
  runtimeId: string;
  installKey?: string | null;
  openclawVersion?: string | null;
  nodeVersion?: string | null;
  platform: string;
  arch: string;
}

export interface OpenClawMirrorComponentRecord {
  id: string;
  kind: OpenClawMirrorComponentKind;
  relativePath: string;
  sourcePath: string;
  byteSize?: number | null;
  fileCount?: number | null;
  includesSecrets?: boolean;
}

export interface OpenClawMirrorManifestComponentRecord {
  id: string;
  kind: OpenClawMirrorComponentKind;
  relativePath: string;
  byteSize?: number | null;
  fileCount?: number | null;
  includesSecrets?: boolean;
}

export interface OpenClawMirrorManifestRecord {
  schemaVersion: 1;
  mirrorVersion: string;
  mode: OpenClawMirrorMode;
  createdAt: string;
  runtime: OpenClawMirrorManifestRuntimeRecord;
  components: OpenClawMirrorManifestComponentRecord[];
}

export interface OpenClawMirrorExportPreview {
  mode: OpenClawMirrorMode;
  runtime: OpenClawMirrorRuntimeRecord;
  components: OpenClawMirrorComponentRecord[];
  manifest: OpenClawMirrorManifestRecord;
}

export interface OpenClawMirrorExportRequest {
  mode: OpenClawMirrorMode;
  destinationPath: string;
}

export interface OpenClawMirrorExportResult {
  destinationPath: string;
  fileName: string;
  fileSizeBytes: number;
  manifest: OpenClawMirrorManifestRecord;
  components: OpenClawMirrorComponentRecord[];
  exportedAt: string;
}

export interface OpenClawMirrorImportPreview {
  sourcePath: string;
  mode: OpenClawMirrorMode;
  manifest: OpenClawMirrorManifestRecord;
  components: OpenClawMirrorManifestComponentRecord[];
  detectedRuntime: OpenClawMirrorManifestRuntimeRecord;
  warnings: string[];
}

export interface OpenClawMirrorImportRequest {
  sourcePath: string;
  createSafetySnapshot: boolean;
  restartGateway: boolean;
}

export interface OpenClawMirrorSafetySnapshotRecord {
  destinationPath: string;
  fileName: string;
  fileSizeBytes: number;
  createdAt: string;
}

export type OpenClawMirrorImportVerificationStatus = 'ready' | 'degraded';

export type OpenClawMirrorImportVerificationCheckStatus = 'passed' | 'failed' | 'skipped';

export interface OpenClawMirrorImportVerificationCheck {
  id: string;
  label: string;
  status: OpenClawMirrorImportVerificationCheckStatus;
  detail: string;
}

export interface OpenClawMirrorImportVerification {
  checkedAt: string;
  status: OpenClawMirrorImportVerificationStatus;
  checks: OpenClawMirrorImportVerificationCheck[];
}

export interface OpenClawMirrorImportResult {
  sourcePath: string;
  importedAt: string;
  manifest: OpenClawMirrorManifestRecord;
  restoredComponents: OpenClawMirrorManifestComponentRecord[];
  gatewayWasRunning: boolean;
  gatewayRunningAfterImport: boolean;
  safetySnapshot?: OpenClawMirrorSafetySnapshotRecord | null;
  verification: OpenClawMirrorImportVerification;
}
