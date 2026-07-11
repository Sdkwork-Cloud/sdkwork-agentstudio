export type HostPlatformMode = 'web' | 'desktopCombined' | 'server';

export type HostPlatformLifecycle =
  | 'inactive'
  | 'starting'
  | 'ready'
  | 'degraded'
  | 'stopping'
  | 'stopped';

export type HostPlatformStateStoreAvailability =
  | 'ready'
  | 'planned'
  | 'configurationRequired';

export type HostPlatformStateStoreProjectionMode = 'runtime' | 'metadataOnly';

export interface HostPlatformStateStoreProviderRecord {
  id: string;
  label: string;
  availability: HostPlatformStateStoreAvailability;
  requiresConfiguration: boolean;
  configurationKeys: string[];
  projectionMode: HostPlatformStateStoreProjectionMode;
}

export interface HostPlatformStateStoreProfileRecord {
  id: string;
  label: string;
  driver: string;
  active: boolean;
  availability: HostPlatformStateStoreAvailability;
  path?: string;
  connectionConfigured: boolean;
  configuredKeys: string[];
  projectionMode: HostPlatformStateStoreProjectionMode;
}

export interface HostPlatformStateStoreRecord {
  activeProfileId: string;
  providers: HostPlatformStateStoreProviderRecord[];
  profiles: HostPlatformStateStoreProfileRecord[];
}

export interface HostPlatformStatusRecord {
  mode: HostPlatformMode;
  lifecycle: HostPlatformLifecycle;
  distributionFamily: 'web' | 'desktop' | 'server';
  deploymentFamily: 'bareMetal' | 'container' | 'kubernetes';
  acceleratorProfile?: 'cpu' | 'nvidia-cuda' | 'amd-rocm' | null;
  hostId: string;
  displayName: string;
  version: string;
  desiredStateProjectionVersion: string;
  rolloutEngineVersion: string;
  manageBasePath: string;
  internalBasePath: string;
  stateStoreDriver?: string;
  stateStore: HostPlatformStateStoreRecord;
  capabilityKeys: string[];
  supportedCapabilityKeys?: string[];
  availableCapabilityKeys?: string[];
  updatedAt: number;
}

export type InternalNodeSessionState =
  | 'pending'
  | 'admitted'
  | 'degraded'
  | 'blocked'
  | 'closing'
  | 'closed';

export type InternalNodeCompatibilityState = 'compatible' | 'degraded' | 'blocked';

export interface InternalNodeSessionRecord {
  sessionId: string;
  nodeId: string;
  state: InternalNodeSessionState;
  compatibilityState: InternalNodeCompatibilityState;
  desiredStateRevision?: number | null;
  desiredStateHash?: string | null;
  lastSeenAt: number;
}

export interface InternalErrorEnvelope {
  error: {
    code: string;
    category: string;
    retryable: boolean;
    resolution: string;
  };
}

export interface InternalPlatformAPI {
  getHostPlatformStatus(): Promise<HostPlatformStatusRecord>;
  listNodeSessions(): Promise<InternalNodeSessionRecord[]>;
}
