import type { RuntimeKernelPreflightOutcome } from './kernel.ts';

export type ManageRolloutPhase =
  | 'draft'
  | 'previewing'
  | 'awaitingApproval'
  | 'ready'
  | 'promoting'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface PreviewRolloutRequest {
  rolloutId: string;
  forceRecompute?: boolean;
  includeTargets?: boolean;
}

export interface ManageRolloutRecord {
  id: string;
  phase: ManageRolloutPhase;
  attempt: number;
  targetCount: number;
  updatedAt: number;
}

export interface ManageRolloutListResult {
  items: ManageRolloutRecord[];
  total: number;
}

export interface ManageRolloutTargetPreviewRecord {
  nodeId: string;
  preflightOutcome: RuntimeKernelPreflightOutcome;
  blockedReason?: string | null;
  desiredStateRevision?: number | null;
  desiredStateHash?: string | null;
  waveId?: string | null;
}

export interface ManageRolloutPreviewSummary {
  totalTargets: number;
  admissibleTargets: number;
  degradedTargets: number;
  blockedTargets: number;
  predictedWaveCount: number;
}

export interface ManageRolloutCandidateRevisionSummary {
  totalTargets: number;
  minDesiredStateRevision?: number | null;
  maxDesiredStateRevision?: number | null;
}

export interface ManageRolloutPreview {
  rolloutId: string;
  phase: Extract<ManageRolloutPhase, 'previewing' | 'awaitingApproval' | 'ready' | 'failed'>;
  attempt: number;
  summary: ManageRolloutPreviewSummary;
  targets: ManageRolloutTargetPreviewRecord[];
  candidateRevisionSummary?: ManageRolloutCandidateRevisionSummary | null;
  generatedAt: number;
}

export interface ManageHostEndpointRecord {
  endpointId: string;
  bindHost: string;
  requestedPort: number;
  activePort: number | null;
  scheme: string;
  baseUrl?: string | null;
  websocketUrl?: string | null;
  loopbackOnly: boolean;
  dynamicPort: boolean;
  lastConflictAt?: number | null;
  lastConflictReason?: string | null;
}

export type ManageOpenClawLifecycle =
  | 'inactive'
  | 'starting'
  | 'ready'
  | 'degraded'
  | 'stopping'
  | 'stopped';

export interface ManageOpenClawRuntimeRecord {
  runtimeKind: 'openclaw';
  lifecycle: ManageOpenClawLifecycle;
  endpointId?: string | null;
  requestedPort?: number | null;
  activePort?: number | null;
  baseUrl?: string | null;
  websocketUrl?: string | null;
  managedBy: string;
  updatedAt: number;
}

export interface ManageOpenClawGatewayRecord {
  gatewayKind: 'openclawGateway';
  lifecycle: ManageOpenClawLifecycle;
  endpointId?: string | null;
  requestedPort?: number | null;
  activePort?: number | null;
  baseUrl?: string | null;
  websocketUrl?: string | null;
  managedBy: string;
  updatedAt: number;
}

export interface ManageOpenClawGatewayInvokeRequest {
  tool: string;
  action?: string;
  args?: Record<string, unknown>;
  sessionKey?: string;
  dryRun?: boolean;
  messageChannel?: string;
  accountId?: string;
  headers?: Record<string, string>;
}

export interface ManagePlatformAPI {
  listRollouts(): Promise<ManageRolloutListResult>;
  previewRollout(input: PreviewRolloutRequest): Promise<ManageRolloutPreview>;
  startRollout(rolloutId: string): Promise<ManageRolloutRecord>;
  getHostEndpoints(): Promise<ManageHostEndpointRecord[]>;
  getOpenClawRuntime(): Promise<ManageOpenClawRuntimeRecord>;
  getOpenClawGateway(): Promise<ManageOpenClawGatewayRecord>;
  invokeOpenClawGateway(request: ManageOpenClawGatewayInvokeRequest): Promise<unknown>;
}
