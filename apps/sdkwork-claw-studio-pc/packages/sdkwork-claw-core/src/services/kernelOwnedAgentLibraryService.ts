import { studio } from '@sdkwork/claw-infrastructure';
import type {
  PersistedKernelChatAgentRecord,
  StudioInstanceRecord,
} from '@sdkwork/claw-types';
import {
  createKernelAgentLibraryService,
  mergeKernelAgentLibraryItems,
  type KernelAgentLibraryItem,
} from './kernelAgentLibraryService.ts';

export interface KernelOwnedAgentLibraryServiceDependencies {
  getInstance: (instanceId: string) => Promise<StudioInstanceRecord | null>;
  listPersistedKernelChatAgents: (
    instanceId: string,
  ) => Promise<PersistedKernelChatAgentRecord[]>;
  listConfigBackedAgents: () => Promise<KernelAgentLibraryItem[]>;
}

export interface KernelOwnedAgentLibraryServiceDependencyOverrides {
  getInstance?: KernelOwnedAgentLibraryServiceDependencies['getInstance'];
  listPersistedKernelChatAgents?: KernelOwnedAgentLibraryServiceDependencies['listPersistedKernelChatAgents'];
  listConfigBackedAgents?: KernelOwnedAgentLibraryServiceDependencies['listConfigBackedAgents'];
}

function normalizeOptionalString(value: string | null | undefined) {
  const normalized = value?.trim() || '';
  return normalized || null;
}

function compareLibraryAgents(left: KernelAgentLibraryItem, right: KernelAgentLibraryItem) {
  if (left.isDefault !== right.isDefault) {
    return left.isDefault ? -1 : 1;
  }

  const displayNameOrder = left.displayName.localeCompare(right.displayName);
  if (displayNameOrder !== 0) {
    return displayNameOrder;
  }

  return left.agentId.localeCompare(right.agentId);
}

class DefaultKernelOwnedAgentLibraryService {
  private readonly dependencies: KernelOwnedAgentLibraryServiceDependencies;

  constructor(dependencies: KernelOwnedAgentLibraryServiceDependencies) {
    this.dependencies = dependencies;
  }

  async listAgents(instanceId: string | null | undefined): Promise<KernelAgentLibraryItem[]> {
    const normalizedInstanceId = normalizeOptionalString(instanceId);
    if (!normalizedInstanceId) {
      return [];
    }

    const [instance, configBackedAgents, persistedAgents] = await Promise.all([
      this.dependencies.getInstance(normalizedInstanceId).catch(() => null),
      this.dependencies
        .listConfigBackedAgents()
        .then((agents) =>
          agents.filter((agent) => agent.sourceInstanceId === normalizedInstanceId),
        )
        .catch(() => []),
      this.dependencies
        .listPersistedKernelChatAgents(normalizedInstanceId)
        .catch(() => []),
    ]);

    if (persistedAgents.length === 0) {
      return [...configBackedAgents].sort(compareLibraryAgents);
    }

    const sortedConfigBackedAgents = [...configBackedAgents].sort(compareLibraryAgents);
    return mergeKernelAgentLibraryItems({
      instance,
      configBackedAgents: sortedConfigBackedAgents,
      persistedAgents,
    });
  }
}

export function createKernelOwnedAgentLibraryService(
  overrides: KernelOwnedAgentLibraryServiceDependencyOverrides = {},
) {
  const kernelAgentLibraryService = createKernelAgentLibraryService();
  const listPersistedKernelChatAgents =
    overrides.listPersistedKernelChatAgents
    ?? ((instanceId: string) => studio.listPersistedKernelChatAgents?.(instanceId) ?? Promise.resolve([]));

  return new DefaultKernelOwnedAgentLibraryService({
    getInstance: overrides.getInstance ?? ((instanceId) => studio.getInstance(instanceId)),
    listPersistedKernelChatAgents,
    listConfigBackedAgents:
      overrides.listConfigBackedAgents
      ?? (() => kernelAgentLibraryService.listConfigBackedAgents()),
  });
}

export const kernelOwnedAgentLibraryService = createKernelOwnedAgentLibraryService();
