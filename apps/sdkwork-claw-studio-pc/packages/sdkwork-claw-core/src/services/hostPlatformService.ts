import {
  internal,
  type HostPlatformStatusRecord,
  type InternalNodeSessionRecord,
  type InternalPlatformAPI,
} from '@sdkwork/claw-infrastructure';

export interface HostPlatformSnapshot extends HostPlatformStatusRecord {
  capabilityCount: number;
  isReady: boolean;
}

export interface CreateHostPlatformServiceOptions {
  getInternalPlatform?: () => InternalPlatformAPI;
}

function mapHostPlatformSnapshot(status: HostPlatformStatusRecord): HostPlatformSnapshot {
  return {
    ...status,
    capabilityCount: status.capabilityKeys.length,
    isReady: status.lifecycle === 'ready',
  };
}

export function createHostPlatformService(
  options: CreateHostPlatformServiceOptions = {},
) {
  const resolveInternalPlatform = options.getInternalPlatform ?? (() => internal);

  return {
    async getStatus(): Promise<HostPlatformSnapshot> {
      const status = await resolveInternalPlatform().getHostPlatformStatus();
      return mapHostPlatformSnapshot(status);
    },

    async listNodeSessions(): Promise<InternalNodeSessionRecord[]> {
      return resolveInternalPlatform().listNodeSessions();
    },
  };
}

export const hostPlatformService = createHostPlatformService();
