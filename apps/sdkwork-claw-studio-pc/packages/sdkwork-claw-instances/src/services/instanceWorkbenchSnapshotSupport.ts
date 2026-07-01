import type {
  OpenClawChannelDefinition,
  OpenClawConfigSnapshot,
} from '@sdkwork/claw-core';
import type {
  Skill,
  StudioInstanceCapabilitySnapshot,
  StudioInstanceDetailRecord,
  StudioInstanceRecord,
} from '@sdkwork/claw-types';
import type {
  InstanceWorkbenchAgent,
  InstanceWorkbenchSectionAvailability,
  InstanceWorkbenchSectionId,
  InstanceWorkbenchChannel,
  InstanceWorkbenchFile,
  InstanceWorkbenchLLMProvider,
  InstanceWorkbenchMemoryEntry,
  InstanceWorkbenchSnapshot,
  InstanceWorkbenchTask,
  InstanceWorkbenchTool,
} from '../types/index.ts';
import { isProviderCenterControlledOpenClawDetail } from './openClawManagementCapabilities.ts';
import {
  buildConfigWorkbenchState,
} from './openClawConfigWorkbenchSupport.ts';
import {
  mapConfigChannel,
  mapOpenClawChannelDefinition,
  mergeOpenClawChannelCollections,
} from './openClawChannelWorkbenchSupport.ts';
import {
  buildOpenClawWorkbenchAgents,
  cloneWorkbenchAgent,
  mergeOpenClawAgentCollections,
} from './openClawAgentWorkbenchSupport.ts';
import {
  cloneWorkbenchTask,
  mergeWorkbenchTasks,
  normalizeWorkbenchTaskCollection,
} from './openClawTaskNormalization.ts';
import {
  mapLlmProvider,
  mapConfigBackedProvider,
} from './openClawProviderWorkbenchSupport.ts';
import {
  normalizeOpenClawAgentFileId,
  normalizeOpenClawAgentId,
} from './openClawSupport.ts';
import { buildKernelAuthorityProjection } from './kernelAuthorityProjection.ts';
import { buildKernelConfigProjection } from './kernelConfigProjection.ts';

type OpenClawChannelCatalogSource = {
  getChannelDefinitions(): OpenClawChannelDefinition[];
};

function buildSnapshotKernelConfig(
  detail: StudioInstanceDetailRecord,
  configFile: string | null | undefined,
) {
  return buildKernelConfigProjection({
    runtimeKind: detail.instance.runtimeKind,
    deploymentMode: detail.instance.deploymentMode,
    isBuiltIn: detail.instance.isBuiltIn,
    configFile,
    workspacePath: detail.config.workspacePath || detail.instance.config.workspacePath || null,
    configWritable: detail.lifecycle.configWritable,
    schemaVersion: null,
  });
}

function getKernelConfigSectionCount(config: ReturnType<typeof buildSnapshotKernelConfig>) {
  return config?.resolved ? 1 : 0;
}

function buildSnapshotKernelAuthority(detail: StudioInstanceDetailRecord) {
  return buildKernelAuthorityProjection(detail);
}

export interface OpenClawGatewaySections {
  channels: InstanceWorkbenchChannel[];
  tasks: InstanceWorkbenchTask[];
  agents: InstanceWorkbenchAgent[];
  skills: Skill[];
  files: InstanceWorkbenchFile[];
  llmProviders: InstanceWorkbenchLLMProvider[];
  memories: InstanceWorkbenchMemoryEntry[];
  tools: InstanceWorkbenchTool[];
}

export function buildOpenClawChannelCatalog(
  openClawConfigService: OpenClawChannelCatalogSource,
  configSnapshot?: OpenClawConfigSnapshot | null,
): InstanceWorkbenchChannel[] {
  if (configSnapshot?.channelSnapshots.length) {
    return configSnapshot.channelSnapshots.map(mapConfigChannel);
  }

  return openClawConfigService.getChannelDefinitions().map(mapOpenClawChannelDefinition);
}

function mergeOpenClawTaskCollections(
  baseTasks: InstanceWorkbenchTask[],
  overrideTasks: InstanceWorkbenchTask[],
): InstanceWorkbenchTask[] {
  const normalizedBaseTasks = normalizeWorkbenchTaskCollection(baseTasks);
  const normalizedOverrideTasks = normalizeWorkbenchTaskCollection(overrideTasks);
  const orderedIds: string[] = [];
  const mergedTasks = new Map<string, InstanceWorkbenchTask>();

  normalizedOverrideTasks.forEach((task) => {
    const baseTask = normalizedBaseTasks.find((entry) => entry.id === task.id);
    orderedIds.push(task.id);
    mergedTasks.set(
      task.id,
      baseTask ? mergeWorkbenchTasks(baseTask, task) : cloneWorkbenchTask(task),
    );
  });

  normalizedBaseTasks.forEach((task) => {
    if (!mergedTasks.has(task.id)) {
      orderedIds.push(task.id);
      mergedTasks.set(task.id, cloneWorkbenchTask(task));
    }
  });

  return orderedIds
    .map((taskId) => mergedTasks.get(taskId))
    .filter(Boolean) as InstanceWorkbenchTask[];
}

function mapStudioInstance(instance: StudioInstanceRecord) {
  const status =
    instance.status === 'syncing' ? 'starting' : instance.status;

  return {
    id: instance.id,
    name: instance.name,
    type: instance.typeLabel,
    iconType: instance.iconType,
    status,
    version: instance.version,
    uptime: instance.uptime,
    ip: instance.host,
    cpu: instance.cpu,
    memory: instance.memory,
    totalMemory: instance.totalMemory,
    isBuiltIn: instance.isBuiltIn,
    runtimeKind: instance.runtimeKind,
    deploymentMode: instance.deploymentMode,
    transportKind: instance.transportKind,
    baseUrl: instance.baseUrl ?? null,
    websocketUrl: instance.websocketUrl ?? null,
    storage: instance.storage
      ? {
          ...instance.storage,
        }
      : undefined,
  } as const;
}

function mapStudioConfig(detail: StudioInstanceDetailRecord) {
  return {
    port: detail.config.port,
    sandbox: detail.config.sandbox,
    autoUpdate: detail.config.autoUpdate,
    logLevel: detail.config.logLevel,
    corsOrigins: detail.config.corsOrigins,
  };
}

function getCapabilityMap(detail: StudioInstanceDetailRecord) {
  return new Map(detail.capabilities.map((capability) => [capability.id, capability]));
}

function resolveCapabilityAvailability(
  capability: StudioInstanceCapabilitySnapshot | undefined,
): InstanceWorkbenchSectionAvailability {
  if (!capability) {
    return {
      status: 'planned',
      detail: 'This section is planned for a future runtime adapter.',
    };
  }

  return {
    status: capability.status,
    detail: capability.detail,
  };
}

function buildSectionAvailability(
  detail: StudioInstanceDetailRecord,
  counts: Record<Exclude<InstanceWorkbenchSectionId, 'overview'>, number>,
): Record<InstanceWorkbenchSectionId, InstanceWorkbenchSectionAvailability> {
  const capabilityMap = getCapabilityMap(detail);
  const templateReady = (count: number, detailText: string): InstanceWorkbenchSectionAvailability =>
    count > 0
      ? {
          status: 'ready',
          detail: detailText,
        }
      : {
          status: 'planned',
          detail: 'This section is not yet backed by a runtime-specific adapter for this instance.',
        };

  return {
    overview: {
      status: 'ready',
      detail: 'Overview is authored by the studio backend and reflects runtime identity, connectivity, storage, and diagnostics.',
    },
    channels: templateReady(
      counts.channels,
      'Channel data is available for this instance workbench.',
    ),
    cronTasks: resolveCapabilityAvailability(capabilityMap.get('tasks')),
    llmProviders: resolveCapabilityAvailability(capabilityMap.get('models')),
    agents: templateReady(
      counts.agents,
      'Agent catalog data is available for this instance workbench.',
    ),
    skills: templateReady(
      counts.skills,
      'Installed skill data is available for this instance workbench.',
    ),
    files: resolveCapabilityAvailability(capabilityMap.get('files')),
    memory: resolveCapabilityAvailability(capabilityMap.get('memory')),
    tools: resolveCapabilityAvailability(capabilityMap.get('tools')),
    config:
      counts.config > 0
        ? {
            status: 'ready',
            detail:
              'The authoritative OpenClaw config file is attached and can be inspected from this workbench.',
          }
        : {
            status: 'planned',
            detail:
              'This instance does not currently expose an attached OpenClaw config file for structured configuration inspection.',
          },
  };
}

function countOverviewEntries(detail: StudioInstanceDetailRecord) {
  return (
    detail.connectivity.endpoints.length +
    detail.capabilities.length +
    detail.dataAccess.routes.length +
    detail.artifacts.length
  );
}

function buildOpenClawSectionCounts(
  detail: StudioInstanceDetailRecord,
  sections: OpenClawGatewaySections,
): Record<InstanceWorkbenchSectionId, number> {
  return {
    overview: countOverviewEntries(detail),
    channels: sections.channels.length,
    cronTasks: sections.tasks.length,
    llmProviders: sections.llmProviders.length,
    agents: sections.agents.length,
    skills: sections.skills.length,
    files: sections.files.length,
    memory: sections.memories.length,
    tools: sections.tools.length,
    config: 0,
  };
}

export function mapBackendWorkbench(
  detail: StudioInstanceDetailRecord,
  configFilePath: string | null | undefined = null,
  configSnapshot?: OpenClawConfigSnapshot | null,
): InstanceWorkbenchSnapshot {
  if (!detail.workbench) {
    throw new Error('Backend workbench payload is required.');
  }

  const workbench = detail.workbench;
  const mappedChannels: InstanceWorkbenchChannel[] = detail.workbench.channels.map((channel) => ({
    ...channel,
    setupSteps: [...channel.setupSteps],
  }));
  const mappedTasks = normalizeWorkbenchTaskCollection(workbench.cronTasks.tasks);
  const mappedSkills = workbench.skills.map((skill) => ({ ...skill }));
  const runtimeAgents: InstanceWorkbenchAgent[] = workbench.agents.map(
    ({ agent, focusAreas, automationFitScore }) => ({
      agent: {
        ...agent,
        id: normalizeOpenClawAgentId(agent.id),
      },
      focusAreas: [...focusAreas],
      automationFitScore,
      configSource: 'runtime' as const,
    }),
  );
  const mappedAgents: InstanceWorkbenchAgent[] =
    (configSnapshot?.agentSnapshots.length || 0) > 0
      ? buildOpenClawWorkbenchAgents(
          configSnapshot!.agentSnapshots,
          runtimeAgents,
          mappedTasks,
          mappedSkills,
        )
      : runtimeAgents.map(cloneWorkbenchAgent);
  const mappedFiles = workbench.files.map((file) => ({
    ...file,
    id: normalizeOpenClawAgentFileId(file.id),
  }));
  const mappedLlmProviders = workbench.llmProviders.map(mapLlmProvider);
  const mappedMemories = workbench.memory.map((entry) => ({ ...entry }));
  const mappedTools = workbench.tools.map((tool) => ({ ...tool }));
  const configWorkbenchState = buildConfigWorkbenchState(
    configFilePath,
    configSnapshot,
  );
  const kernelConfig = buildSnapshotKernelConfig(detail, configFilePath);
  const kernelAuthority = buildSnapshotKernelAuthority(detail);
  const configSectionCount = getKernelConfigSectionCount(kernelConfig);
  const connectedChannelCount = mappedChannels.filter(
    (channel) => channel.status === 'connected' && channel.enabled,
  ).length;
  const activeTaskCount = mappedTasks.filter((task) => task.status === 'active').length;
  const readyToolCount = mappedTools.filter((tool) => tool.status === 'ready').length;
  const sectionCounts = {
    overview:
      detail.connectivity.endpoints.length +
      detail.capabilities.length +
      detail.dataAccess.routes.length +
      detail.artifacts.length,
    channels: mappedChannels.length,
    cronTasks: mappedTasks.length,
    llmProviders: mappedLlmProviders.length,
    agents: mappedAgents.length,
    skills: mappedSkills.length,
    files: mappedFiles.length,
    memory: mappedMemories.length,
    tools: mappedTools.length,
    config: configSectionCount,
  } as const;

  return {
    instance: mapStudioInstance(detail.instance),
    config: mapStudioConfig(detail),
    token: detail.config.authToken || '',
    logs: detail.logs,
    detail,
    kernelConfig,
    kernelAuthority,
    configChannels: configWorkbenchState.configChannels,
    kernelConfigInsights: configWorkbenchState.kernelConfigInsights,
    healthScore: detail.health.score,
    runtimeStatus: detail.health.status,
    connectedChannelCount,
    activeTaskCount,
    installedSkillCount: mappedSkills.length,
    readyToolCount,
    sectionCounts,
    sectionAvailability: buildSectionAvailability(detail, sectionCounts),
    channels: mappedChannels,
    tasks: mappedTasks,
    agents: mappedAgents.map(cloneWorkbenchAgent),
    skills: mappedSkills,
    files: mappedFiles,
    llmProviders: mappedLlmProviders,
    memories: mappedMemories,
    tools: mappedTools,
  };
}

export function buildOpenClawSnapshotFromSections(
  detail: StudioInstanceDetailRecord,
  sections: OpenClawGatewaySections,
): InstanceWorkbenchSnapshot {
  const normalizedTasks = normalizeWorkbenchTaskCollection(sections.tasks);
  const connectedChannelCount = sections.channels.filter(
    (channel) => channel.status === 'connected' && channel.enabled,
  ).length;
  const activeTaskCount = normalizedTasks.filter((task) => task.status === 'active').length;
  const readyToolCount = sections.tools.filter((tool) => tool.status === 'ready').length;
  const sectionCounts = buildOpenClawSectionCounts(detail, {
    ...sections,
    tasks: normalizedTasks,
  });
  const capabilityMap = getCapabilityMap(detail);
  const kernelAuthority = buildSnapshotKernelAuthority(detail);

  return {
    instance: mapStudioInstance(detail.instance),
    config: mapStudioConfig(detail),
    token: detail.config.authToken || '',
    logs: detail.logs,
    detail,
    kernelAuthority,
    healthScore: detail.health.score,
    runtimeStatus: detail.health.status,
    connectedChannelCount,
    activeTaskCount,
    installedSkillCount: sections.skills.length,
    readyToolCount,
    sectionCounts,
    sectionAvailability: {
      ...buildSectionAvailability(detail, {
        channels: sections.channels.length,
        cronTasks: normalizedTasks.length,
        llmProviders: sections.llmProviders.length,
        agents: sections.agents.length,
        skills: sections.skills.length,
        files: sections.files.length,
        memory: sections.memories.length,
        tools: sections.tools.length,
        config: 0,
      }),
      files:
        sections.files.length > 0
          ? {
              status: 'ready',
              detail: 'Runtime file data is available for this instance workbench.',
            }
          : resolveCapabilityAvailability(capabilityMap.get('files')),
    },
    channels: sections.channels,
    tasks: normalizedTasks.map(cloneWorkbenchTask),
    agents: sections.agents.map((agent) => ({
      ...agent,
      agent: { ...agent.agent },
      focusAreas: [...agent.focusAreas],
    })),
    skills: sections.skills.map((skill) => ({ ...skill })),
    files: sections.files.map((file) => ({ ...file })),
    llmProviders: sections.llmProviders.map(mapLlmProvider),
    memories: sections.memories.map((entry) => ({ ...entry })),
    tools: sections.tools.map((tool) => ({ ...tool })),
  };
}

export function mergeOpenClawSnapshots(
  base: InstanceWorkbenchSnapshot,
  live: InstanceWorkbenchSnapshot,
): InstanceWorkbenchSnapshot {
  return buildOpenClawSnapshotFromSections(base.detail, {
    channels: mergeOpenClawChannelCollections(base.channels, live.channels),
    tasks: mergeOpenClawTaskCollections(base.tasks, live.tasks),
    llmProviders: live.llmProviders.length > 0 ? live.llmProviders : base.llmProviders,
    agents: mergeOpenClawAgentCollections(base.agents, live.agents),
    skills: live.skills.length > 0 ? live.skills : base.skills,
    files: base.files.length > 0 ? base.files : live.files,
    memories: base.memories.length > 0 ? base.memories : live.memories,
    tools: live.tools.length > 0 ? live.tools : base.tools,
  });
}

export function finalizeOpenClawSnapshot(
  detail: StudioInstanceDetailRecord,
  snapshot: InstanceWorkbenchSnapshot,
  configFilePath: string | null,
  configSnapshot: OpenClawConfigSnapshot | null,
  channelCatalog: InstanceWorkbenchChannel[],
): InstanceWorkbenchSnapshot {
  const configWorkbenchState = buildConfigWorkbenchState(
    configFilePath,
    configSnapshot,
  );
  const kernelConfig = buildSnapshotKernelConfig(detail, configFilePath);
  const kernelAuthority = buildSnapshotKernelAuthority(detail);
  const configSectionCount = getKernelConfigSectionCount(kernelConfig);
    const llmProviders =
      isProviderCenterControlledOpenClawDetail(detail) &&
      (configSnapshot?.providerSnapshots.length || 0) > 0
        ? configSnapshot!.providerSnapshots.map(mapConfigBackedProvider)
        : snapshot.llmProviders;
  const agents =
    (configSnapshot?.agentSnapshots.length || 0) > 0
      ? buildOpenClawWorkbenchAgents(
          configSnapshot!.agentSnapshots,
          snapshot.agents,
          snapshot.tasks,
          snapshot.skills,
        )
      : snapshot.agents.map(cloneWorkbenchAgent);
  const channels = mergeOpenClawChannelCollections(
    channelCatalog,
    snapshot.channels,
  );
  const finalizedSnapshot = buildOpenClawSnapshotFromSections(detail, {
    channels,
    tasks: snapshot.tasks,
    agents,
    skills: snapshot.skills,
    files: snapshot.files,
    llmProviders,
    memories: snapshot.memories,
    tools: snapshot.tools,
  });

  return {
    ...finalizedSnapshot,
    kernelConfig,
    kernelAuthority,
    ...configWorkbenchState,
    sectionCounts: {
      ...finalizedSnapshot.sectionCounts,
      config: configSectionCount,
    },
    sectionAvailability: {
      ...finalizedSnapshot.sectionAvailability,
      config: buildSectionAvailability(detail, {
        channels: finalizedSnapshot.sectionCounts.channels,
        cronTasks: finalizedSnapshot.sectionCounts.cronTasks,
        llmProviders: finalizedSnapshot.sectionCounts.llmProviders,
        agents: finalizedSnapshot.sectionCounts.agents,
        skills: finalizedSnapshot.sectionCounts.skills,
        files: finalizedSnapshot.sectionCounts.files,
        memory: finalizedSnapshot.sectionCounts.memory,
        tools: finalizedSnapshot.sectionCounts.tools,
        config: configSectionCount,
      }).config,
    },
  };
}

export function buildDetailOnlyWorkbenchSnapshot(
  detail: StudioInstanceDetailRecord,
  configFilePath: string | null = null,
  configSnapshot: OpenClawConfigSnapshot | null = null,
): InstanceWorkbenchSnapshot {
  const configWorkbenchState = buildConfigWorkbenchState(
    configFilePath,
    configSnapshot,
  );
  const kernelConfig = buildSnapshotKernelConfig(detail, configFilePath);
  const kernelAuthority = buildSnapshotKernelAuthority(detail);
  const configSectionCount = getKernelConfigSectionCount(kernelConfig);
  const emptySectionCounts = {
    channels: 0,
    cronTasks: 0,
    llmProviders: 0,
    agents: 0,
    skills: 0,
    files: 0,
    memory: 0,
    tools: 0,
    config: configSectionCount,
  } as const;

  return {
    instance: mapStudioInstance(detail.instance),
    config: mapStudioConfig(detail),
    token: detail.config.authToken || '',
    logs: detail.logs,
    detail,
    kernelConfig,
    kernelAuthority,
    ...configWorkbenchState,
    healthScore: detail.health.score,
    runtimeStatus: detail.health.status,
    connectedChannelCount: 0,
    activeTaskCount: 0,
    installedSkillCount: 0,
    readyToolCount: 0,
    sectionCounts: {
      overview: countOverviewEntries(detail),
      ...emptySectionCounts,
    },
    sectionAvailability: buildSectionAvailability(detail, emptySectionCounts),
    channels: [],
    tasks: [],
    agents: [],
    skills: [],
    files: [],
    llmProviders: [],
    memories: [],
    tools: [],
  };
}
