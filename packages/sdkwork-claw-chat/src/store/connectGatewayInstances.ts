import { isGatewayAuthoritativeRouteMode } from '../services/index.ts';
import type { InstanceChatRouteMode } from '../services/store/index.ts';

export interface ConnectGatewayInstancesBestEffortOptions {
  instanceIds: string[];
  resolveRouteMode: (instanceId: string) => Promise<InstanceChatRouteMode>;
  hydrateGatewayInstance: (instanceId: string) => Promise<void>;
  releaseGatewayInstance?: (instanceId: string) => void | Promise<void>;
  setRouteMode: (instanceId: string, mode: InstanceChatRouteMode) => void;
  onError?: (instanceId: string, error: unknown) => void;
}

export async function connectGatewayInstancesBestEffort(
  options: ConnectGatewayInstancesBestEffortOptions,
) {
  const uniqueIds = Array.from(new Set(options.instanceIds.filter(Boolean)));

  await Promise.all(
    uniqueIds.map(async (instanceId) => {
      try {
        const mode = await options.resolveRouteMode(instanceId);
        options.setRouteMode(instanceId, mode);

        if (isGatewayAuthoritativeRouteMode(mode)) {
          await options.hydrateGatewayInstance(instanceId);
        } else {
          await options.releaseGatewayInstance?.(instanceId);
        }
      } catch (error) {
        options.onError?.(instanceId, error);
      }
    }),
  );
}
