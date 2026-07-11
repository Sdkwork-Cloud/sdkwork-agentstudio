import { studio } from '@sdkwork/agentstudio-pc-infrastructure';
import type {
  PersistedKernelChatAgentRecord,
  StudioInstanceDetailRecord,
  StudioInstanceRecord,
  StudioInstanceStatus,
} from '@sdkwork/agentstudio-pc-types';
import {
  openClawConfigService,
  type OpenClawConfigSnapshot,
  type OpenClawAgentParamValue,
} from './openClawConfigService.ts';
import type { KernelConfigBackedDetail } from './kernelConfigAttachmentService.ts';

export interface KernelAgentLibraryItem {
  sourceInstanceId: string;
  sourceInstanceName: string;
  sourceKernelId: string;
  sourceInstanceHost: string;
  sourceInstanceBuiltIn: boolean;
  sourceInstanceStatus: StudioInstanceStatus;
  sourceConfigFile: string;
  agentId: string;
  displayName: string;
  avatar: string;
  description: string;
  isDefault: boolean;
  workspace: string;
  agentDir: string;
  model: {
    primary: string | null;
    fallbacks: string[];
  };
  params: {
    temperature: number | null;
    topP: number | null;
    maxTokens: number | null;
    timeoutMs: number | null;
    streaming: boolean | null;
  };
}

export interface KernelAgentLibraryServiceDependencies {
  listInstances: () => Promise<StudioInstanceRecord[]>;
  getInstanceDetail: (instanceId: string) => Promise<StudioInstanceDetailRecord | null>;
  listPersistedKernelChatAgents?: (
    instanceId: string,
  ) => Promise<PersistedKernelChatAgentRecord[]>;
  resolveInstanceConfigPath: (
    detail: KernelConfigBackedDetail | null | undefined,
  ) => string | null;
  readConfigSnapshot: (configFile: string) => Promise<OpenClawConfigSnapshot>;
}

export interface KernelAgentLibraryServiceDependencyOverrides {
  listInstances?: KernelAgentLibraryServiceDependencies['listInstances'];
  getInstanceDetail?: KernelAgentLibraryServiceDependencies['getInstanceDetail'];
  listPersistedKernelChatAgents?: KernelAgentLibraryServiceDependencies['listPersistedKernelChatAgents'];
  resolveInstanceConfigPath?: KernelAgentLibraryServiceDependencies['resolveInstanceConfigPath'];
  readConfigSnapshot?: KernelAgentLibraryServiceDependencies['readConfigSnapshot'];
}

function normalizeOptionalString(value: string | null | undefined) {
  const normalized = value?.trim() || '';
  return normalized || null;
}

function readNumberParam(
  params: Record<string, OpenClawAgentParamValue>,
  key: 'temperature' | 'topP' | 'maxTokens' | 'timeoutMs',
) {
  return typeof params[key] === 'number' && Number.isFinite(params[key]) ? params[key] : null;
}

function readBooleanParam(
  params: Record<string, OpenClawAgentParamValue>,
  key: 'streaming',
) {
  return typeof params[key] === 'boolean' ? params[key] : null;
}

function compareLibraryAgents(left: KernelAgentLibraryItem, right: KernelAgentLibraryItem) {
  if (left.sourceInstanceBuiltIn !== right.sourceInstanceBuiltIn) {
    return left.sourceInstanceBuiltIn ? -1 : 1;
  }

  const instanceNameOrder = left.sourceInstanceName.localeCompare(right.sourceInstanceName);
  if (instanceNameOrder !== 0) {
    return instanceNameOrder;
  }

  if (left.isDefault !== right.isDefault) {
    return left.isDefault ? -1 : 1;
  }

  const displayNameOrder = left.displayName.localeCompare(right.displayName);
  if (displayNameOrder !== 0) {
    return displayNameOrder;
  }

  return left.agentId.localeCompare(right.agentId);
}

function sortPersistedAgents(
  records: PersistedKernelChatAgentRecord[],
): PersistedKernelChatAgentRecord[] {
  return [...records].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    if (left.isDefault !== right.isDefault) {
      return left.isDefault ? -1 : 1;
    }

    return left.label.localeCompare(right.label);
  });
}

export function buildKernelAgentLibraryConfigBackedKey(
  agent: Pick<KernelAgentLibraryItem, 'sourceInstanceId' | 'sourceKernelId' | 'agentId'>,
) {
  return `${agent.sourceInstanceId}:${agent.sourceKernelId}:${agent.agentId}`;
}

export function buildKernelAgentLibraryPersistedKey(
  record: Pick<PersistedKernelChatAgentRecord, 'instanceId' | 'kernelId' | 'agentId'>,
) {
  return `${record.instanceId}:${record.kernelId}:${record.agentId}`;
}

export function toFallbackKernelAgentLibraryItem(input: {
  instance: StudioInstanceRecord | null;
  record: PersistedKernelChatAgentRecord;
}): KernelAgentLibraryItem {
  const displayName = normalizeOptionalString(input.record.label) ?? input.record.agentId;

  return {
    sourceInstanceId: input.record.instanceId,
    sourceInstanceName: input.instance?.name ?? input.record.instanceId,
    sourceKernelId: input.record.kernelId,
    sourceInstanceHost: input.instance?.host ?? '',
    sourceInstanceBuiltIn: input.instance?.isBuiltIn ?? false,
    sourceInstanceStatus: input.instance?.status ?? 'offline',
    sourceConfigFile: '',
    agentId: input.record.agentId,
    displayName,
    avatar: normalizeOptionalString(input.record.avatar) ?? 'AI',
    description:
      normalizeOptionalString(input.record.description) ?? `${displayName} agent`,
    isDefault: input.record.isDefault,
    workspace: '',
    agentDir: '',
    model: {
      primary: null,
      fallbacks: [],
    },
    params: {
      temperature: null,
      topP: null,
      maxTokens: null,
      timeoutMs: null,
      streaming: null,
    },
  };
}

export function mergeKernelAgentLibraryItems(input: {
  instance: StudioInstanceRecord | null;
  configBackedAgents: KernelAgentLibraryItem[];
  persistedAgents: PersistedKernelChatAgentRecord[];
}) {
  if (input.persistedAgents.length === 0) {
    return [...input.configBackedAgents];
  }

  const configBackedAgentsByKey = new Map(
    input.configBackedAgents.map((agent) => [
      buildKernelAgentLibraryConfigBackedKey(agent),
      agent,
    ]),
  );
  const consumedKeys = new Set<string>();
  const mergedAgents = sortPersistedAgents(input.persistedAgents).map((record) => {
    const key = buildKernelAgentLibraryPersistedKey(record);
    consumedKeys.add(key);

    const configBackedAgent = configBackedAgentsByKey.get(key);
    if (configBackedAgent) {
      return {
        ...configBackedAgent,
        isDefault: record.isDefault,
        avatar: normalizeOptionalString(record.avatar) ?? configBackedAgent.avatar,
        description:
          normalizeOptionalString(record.description) ?? configBackedAgent.description,
      };
    }

    return toFallbackKernelAgentLibraryItem({
      instance: input.instance,
      record,
    });
  });

  const remainingConfigBackedAgents = input.configBackedAgents.filter(
    (agent) => !consumedKeys.has(buildKernelAgentLibraryConfigBackedKey(agent)),
  );

  return [...mergedAgents, ...remainingConfigBackedAgents];
}

function mapSnapshotAgents(input: {
  instance: StudioInstanceRecord;
  configFile: string;
  snapshot: OpenClawConfigSnapshot;
}): KernelAgentLibraryItem[] {
  return input.snapshot.agentSnapshots.map((agent) => ({
    sourceInstanceId: input.instance.id,
    sourceInstanceName: input.instance.name,
    sourceKernelId: input.instance.runtimeKind,
    sourceInstanceHost: input.instance.host,
    sourceInstanceBuiltIn: input.instance.isBuiltIn,
    sourceInstanceStatus: input.instance.status,
    sourceConfigFile: input.configFile,
    agentId: agent.id,
    displayName: agent.name,
    avatar: normalizeOptionalString(agent.avatar) ?? 'AI',
    description: normalizeOptionalString(agent.description) ?? `${agent.name} agent`,
    isDefault: agent.isDefault === true,
    workspace: normalizeOptionalString(agent.workspace) ?? '',
    agentDir: normalizeOptionalString(agent.agentDir) ?? '',
    model: {
      primary: normalizeOptionalString(agent.model.primary) ?? null,
      fallbacks: [...new Set((agent.model.fallbacks ?? []).filter(Boolean))],
    },
    params: {
      temperature: readNumberParam(agent.params, 'temperature'),
      topP: readNumberParam(agent.params, 'topP'),
      maxTokens: readNumberParam(agent.params, 'maxTokens'),
      timeoutMs: readNumberParam(agent.params, 'timeoutMs'),
      streaming: readBooleanParam(agent.params, 'streaming'),
    },
  }));
}

class DefaultKernelAgentLibraryService {
  private readonly dependencies: KernelAgentLibraryServiceDependencies;

  constructor(dependencies: KernelAgentLibraryServiceDependencies) {
    this.dependencies = dependencies;
  }

  private async listConfigBackedAgentsForInstance(
    instance: StudioInstanceRecord,
  ): Promise<KernelAgentLibraryItem[]> {
    try {
      const detail = await this.dependencies.getInstanceDetail(instance.id);
      const configFile = this.dependencies.resolveInstanceConfigPath(detail);
      if (!configFile) {
        return [];
      }

      const snapshot = await this.dependencies.readConfigSnapshot(configFile);
      return mapSnapshotAgents({
        instance,
        configFile,
        snapshot,
      });
    } catch {
      return [];
    }
  }

  async listConfigBackedAgents(): Promise<KernelAgentLibraryItem[]> {
    const instances = await this.dependencies.listInstances().catch(() => []);
    const collectedAgents = await Promise.all(
      instances.map((instance) => this.listConfigBackedAgentsForInstance(instance)),
    );

    return collectedAgents.flat().sort(compareLibraryAgents);
  }

  async listAgents(): Promise<KernelAgentLibraryItem[]> {
    const instances = await this.dependencies.listInstances().catch(() => []);
    const collectedAgents = await Promise.all(
      instances.map(async (instance) => {
        const [configBackedAgents, persistedAgents] = await Promise.all([
          this.listConfigBackedAgentsForInstance(instance),
          this.dependencies.listPersistedKernelChatAgents
            ? this.dependencies.listPersistedKernelChatAgents(instance.id).catch(() => [])
            : Promise.resolve([]),
        ]);

        return mergeKernelAgentLibraryItems({
          instance,
          configBackedAgents,
          persistedAgents,
        });
      }),
    );

    return collectedAgents.flat().sort(compareLibraryAgents);
  }
}

export function createKernelAgentLibraryService(
  overrides: KernelAgentLibraryServiceDependencyOverrides = {},
) {
  return new DefaultKernelAgentLibraryService({
    listInstances: overrides.listInstances ?? (() => studio.listInstances()),
    getInstanceDetail: overrides.getInstanceDetail ?? ((instanceId) => studio.getInstanceDetail(instanceId)),
    listPersistedKernelChatAgents:
      overrides.listPersistedKernelChatAgents
      ?? ((instanceId: string) => studio.listPersistedKernelChatAgents?.(instanceId) ?? Promise.resolve([])),
    resolveInstanceConfigPath:
      overrides.resolveInstanceConfigPath ??
      ((detail) => openClawConfigService.resolveInstanceConfigPath(detail)),
    readConfigSnapshot:
      overrides.readConfigSnapshot ??
      ((configFile) => openClawConfigService.readConfigSnapshot(configFile)),
  });
}

export const kernelAgentLibraryService = createKernelAgentLibraryService();
