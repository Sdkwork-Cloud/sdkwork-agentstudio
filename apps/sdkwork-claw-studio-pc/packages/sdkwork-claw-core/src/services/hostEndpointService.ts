import {
  manage,
  type ManageHostEndpointRecord,
  type ManagePlatformAPI,
} from '@sdkwork/claw-infrastructure';

export type HostEndpointStatus = 'ready' | 'fallback' | 'pending';

export interface HostEndpointSnapshot extends ManageHostEndpointRecord {
  effectivePort: number | null;
  usesRequestedPort: boolean;
  hasConflict: boolean;
  exposureLabel: string;
  conflictSummary: string | null;
  status: HostEndpointStatus;
}

export interface CreateHostEndpointServiceOptions {
  getManagePlatform?: () => Pick<ManagePlatformAPI, 'getHostEndpoints'>;
}

export function mapHostEndpointSnapshot(
  endpoint: ManageHostEndpointRecord,
): HostEndpointSnapshot {
  const activePort = endpoint.activePort ?? null;
  const usesRequestedPort = activePort !== null && activePort === endpoint.requestedPort;
  const hasConflict = activePort !== null && activePort !== endpoint.requestedPort;

  return {
    ...endpoint,
    activePort,
    effectivePort: activePort,
    usesRequestedPort,
    hasConflict,
    exposureLabel: endpoint.loopbackOnly ? 'Loopback Only' : 'Network',
    conflictSummary: hasConflict ? endpoint.lastConflictReason?.trim() ?? null : null,
    status: activePort === null ? 'pending' : hasConflict ? 'fallback' : 'ready',
  };
}

function sortHostEndpoints(
  left: HostEndpointSnapshot,
  right: HostEndpointSnapshot,
): number {
  if (left.endpointId === 'claw-manage-http') {
    return -1;
  }

  if (right.endpointId === 'claw-manage-http') {
    return 1;
  }

  return left.endpointId.localeCompare(right.endpointId);
}

export function createHostEndpointService(
  options: CreateHostEndpointServiceOptions = {},
) {
  const resolveManagePlatform = options.getManagePlatform ?? (() => manage);

  return {
    async list(): Promise<HostEndpointSnapshot[]> {
      const endpoints = await resolveManagePlatform().getHostEndpoints();
      return endpoints.map(mapHostEndpointSnapshot).sort(sortHostEndpoints);
    },
  };
}

export const hostEndpointService = createHostEndpointService();
