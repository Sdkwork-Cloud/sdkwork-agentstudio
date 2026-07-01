import { hostPlatformService, kernelPlatformService } from '@sdkwork/claw-core';
import { studio } from '@sdkwork/claw-infrastructure';
import {
  createNodeInventoryService as createNodeInventoryServiceCore,
  type NodeInventoryServiceOverrides,
} from './nodeInventoryServiceCore.ts';

export type {
  NodeInventoryHealth,
  NodeInventoryKind,
  NodeInventoryManagement,
  NodeInventoryRecord,
  NodeInventoryServiceDependencies,
  NodeInventoryServiceOverrides,
  NodeInventorySnapshot,
} from './nodeInventoryServiceCore.ts';

function createRuntimeDependencyOverrides(): NodeInventoryServiceOverrides {
  return {
    kernelPlatformService: {
      getStatus: () => kernelPlatformService.getStatus(),
      ensureRunning: () => kernelPlatformService.ensureRunning(),
      restart: () => kernelPlatformService.restart(),
    },
    hostPlatformService: {
      getStatus: () => hostPlatformService.getStatus(),
      listNodeSessions: () => hostPlatformService.listNodeSessions(),
    },
    studioApi: {
      getInstances: () => studio.listInstances(),
    },
  };
}

export function createNodeInventoryService(
  overrides: NodeInventoryServiceOverrides = {},
) {
  const runtimeOverrides = createRuntimeDependencyOverrides();

  return createNodeInventoryServiceCore({
    kernelPlatformService: {
      ...runtimeOverrides.kernelPlatformService,
      ...(overrides.kernelPlatformService || {}),
    },
    hostPlatformService: {
      ...runtimeOverrides.hostPlatformService,
      ...(overrides.hostPlatformService || {}),
    },
    studioApi: {
      ...runtimeOverrides.studioApi,
      ...(overrides.studioApi || {}),
    },
  });
}

export const nodeInventoryService = createNodeInventoryService();
