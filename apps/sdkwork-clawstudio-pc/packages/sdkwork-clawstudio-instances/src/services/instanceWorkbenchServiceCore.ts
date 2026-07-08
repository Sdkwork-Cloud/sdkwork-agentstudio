import type {
  OpenClawAgentFileResult,
  OpenClawAgentFilesListResult,
  OpenClawAgentsListResult,
  OpenClawChannelStatusResult,
  OpenClawConfigSnapshot as GatewayOpenClawConfigSnapshot,
  OpenClawMemorySearchResult,
  OpenClawModelRecord,
  OpenClawSkillsStatusResult,
  OpenClawToolsCatalogResult,
} from '@sdkwork/clawstudio-infrastructure';
import {
  openClawConfigService,
  resolveAttachedKernelConfigFile,
  type OpenClawChannelDefinition,
  type OpenClawConfigSnapshot,
} from '@sdkwork/clawstudio-core';
import type {
  Skill,
  StudioInstanceDetailRecord,
} from '@sdkwork/clawstudio-types';
import type {
  Instance,
  InstanceConfig,
  InstanceWorkbenchAgent,
  InstanceWorkbenchChannel,
  InstanceWorkbenchFile,
  InstanceWorkbenchMemoryEntry,
  InstanceWorkbenchSnapshot,
  InstanceWorkbenchTask,
  InstanceWorkbenchTaskExecution,
} from '../types/index.ts';
import {
  getArrayValue,
  getNumberValue,
  getStringValue,
  isRecord,
  normalizeOpenClawAgentId,
  titleCaseIdentifier,
  toIsoStringFromMs,
} from './openClawSupport.ts';
import {
  hasReadyOpenClawGateway,
  shouldProbeOpenClawGateway,
} from './openClawManagementCapabilities.ts';
import {
  buildOpenClawMemories,
  mapOpenClawFileEntryToWorkbenchFile,
  mergeOpenClawFileCollections,
} from './openClawFileWorkbenchSupport.ts';
import {
  cloneWorkbenchAgent,
  mapAgent,
} from './openClawAgentWorkbenchSupport.ts';
import {
  buildOpenClawChannels,
} from './openClawChannelWorkbenchSupport.ts';
import {
  normalizeWorkbenchTask,
  normalizeWorkbenchTaskCollection,
} from './openClawTaskNormalization.ts';
import { buildOpenClawRuntimeMemories as buildOpenClawRuntimeMemoryEntries } from './openClawRuntimeMemorySupport.ts';
import {
  createEmptyOpenClawConfigSnapshot,
} from './openClawConfigWorkbenchSupport.ts';
import {
  buildOpenClawLlmProviders,
} from './openClawProviderWorkbenchSupport.ts';
import {
  buildOpenClawSkills,
} from './openClawSkillWorkbenchSupport.ts';
import {
  buildOpenClawScopedTools,
} from './openClawToolWorkbenchSupport.ts';
import {
  buildRegistryBackedDetail,
} from './instanceRegistryWorkbenchSupport.ts';
import { resolveKernelConfigPathWithFallback } from './kernelConfigPathFallback.ts';
import {
  buildDetailOnlyWorkbenchSnapshot,
  buildOpenClawChannelCatalog,
  buildOpenClawSnapshotFromSections,
  finalizeOpenClawSnapshot,
  mapBackendWorkbench,
  mergeOpenClawSnapshots,
} from './instanceWorkbenchSnapshotSupport.ts';

function cloneTaskExecution(
  execution: InstanceWorkbenchTaskExecution,
): InstanceWorkbenchTaskExecution {
  return { ...execution };
}

function safelyBuildOpenClawSection<TResult>(
  build: () => TResult,
  fallback: TResult,
): TResult {
  try {
    return build();
  } catch {
    return fallback;
  }
}

export interface InstanceWorkbenchServiceDependencies {
  studioApi: {
    getInstanceDetail(id: string): Promise<StudioInstanceDetailRecord | null>;
    createInstanceTask(instanceId: string, payload: Record<string, unknown>): Promise<void>;
    updateInstanceTask(
      instanceId: string,
      taskId: string,
      payload: Record<string, unknown>,
    ): Promise<void>;
    cloneInstanceTask(instanceId: string, taskId: string, name?: string): Promise<void>;
    runInstanceTaskNow(
      instanceId: string,
      taskId: string,
    ): Promise<InstanceWorkbenchTaskExecution>;
    listInstanceTaskExecutions(
      instanceId: string,
      taskId: string,
    ): Promise<InstanceWorkbenchTaskExecution[]>;
    updateInstanceTaskStatus(
      instanceId: string,
      taskId: string,
      status: 'active' | 'paused',
    ): Promise<void>;
    deleteInstanceTask(instanceId: string, taskId: string): Promise<boolean>;
  };
  instanceService: {
    getInstanceById(id: string): Promise<Instance | undefined>;
    getInstanceConfig(id: string): Promise<InstanceConfig | undefined>;
    getInstanceToken(id: string): Promise<string | undefined>;
    getInstanceLogs(id: string): Promise<string>;
  };
  kernelConfigAttachmentApi: {
    resolveInstanceConfigPath?(
      detail: StudioInstanceDetailRecord | null | undefined,
    ): string | null | undefined;
    resolveAttachedKernelConfigFile(
      detail: StudioInstanceDetailRecord | null | undefined,
    ): string | null | undefined;
  };
  openClawConfigDocumentApi: {
    getConfigDocumentPathInfo?(
      configFile: string,
    ): Promise<{ exists: boolean; kind: 'file' | 'directory' | 'missing' }>;
    readConfigSnapshot(configFile: string): Promise<OpenClawConfigSnapshot>;
    getChannelDefinitions(): OpenClawChannelDefinition[];
  };
  openClawGatewayClient: {
    getConfig(instanceId: string): Promise<GatewayOpenClawConfigSnapshot>;
    listModels(instanceId: string): Promise<OpenClawModelRecord[]>;
    getChannelStatus(
      instanceId: string,
      args?: Record<string, unknown>,
    ): Promise<OpenClawChannelStatusResult>;
    getSkillsStatus(
      instanceId: string,
      args?: Record<string, unknown>,
    ): Promise<OpenClawSkillsStatusResult>;
    getToolsCatalog(
      instanceId: string,
      args?: Record<string, unknown>,
    ): Promise<OpenClawToolsCatalogResult>;
    listAgents(instanceId: string): Promise<OpenClawAgentsListResult>;
    listAgentFiles(
      instanceId: string,
      args: { agentId: string },
    ): Promise<OpenClawAgentFilesListResult>;
    getAgentFile(
      instanceId: string,
      args: { agentId: string; name: string },
    ): Promise<OpenClawAgentFileResult>;
    searchMemory(
      instanceId: string,
      args: { query: string; maxResults?: number; minScore?: number },
    ): Promise<OpenClawMemorySearchResult>;
    getDoctorMemoryStatus(
      instanceId: string,
      args?: Record<string, unknown>,
    ): Promise<Record<string, unknown>>;
    getDoctorMemoryDreamDiary(
      instanceId: string,
      args?: Record<string, unknown>,
    ): Promise<Record<string, unknown>>;
    listWorkbenchCronJobs(instanceId: string): Promise<InstanceWorkbenchTask[]>;
    listWorkbenchCronRuns(
      instanceId: string,
      taskId: string,
    ): Promise<InstanceWorkbenchTaskExecution[]>;
    addCronJob(instanceId: string, payload: Record<string, unknown>): Promise<{ id?: string }>;
    updateCronJob(
      instanceId: string,
      taskId: string,
      patch: Record<string, unknown>,
    ): Promise<{ id?: string }>;
    removeCronJob(instanceId: string, taskId: string): Promise<boolean>;
    runCronJob(
      instanceId: string,
      taskId: string,
    ): Promise<{ ok?: boolean; enqueued?: boolean; runId?: string }>;
  };
  buildCronTaskPayload(
    task: Omit<InstanceWorkbenchTask, 'id'>,
    rawDefinition?: Record<string, unknown>,
  ): Record<string, unknown>;
}

function toCreateTaskInput(
  task: InstanceWorkbenchTask,
  overrides: Partial<InstanceWorkbenchTask> = {},
): Omit<InstanceWorkbenchTask, 'id'> {
  return {
    name: overrides.name ?? task.name,
    description: overrides.description ?? task.description,
    prompt: overrides.prompt ?? task.prompt,
    schedule: overrides.schedule ?? task.schedule,
    scheduleMode: overrides.scheduleMode ?? task.scheduleMode,
    scheduleConfig: overrides.scheduleConfig ?? task.scheduleConfig,
    cronExpression: overrides.cronExpression ?? task.cronExpression,
    actionType: overrides.actionType ?? task.actionType,
    status: overrides.status ?? task.status,
    sessionMode: overrides.sessionMode ?? task.sessionMode,
    customSessionId: overrides.customSessionId ?? task.customSessionId,
    wakeUpMode: overrides.wakeUpMode ?? task.wakeUpMode,
    executionContent: overrides.executionContent ?? task.executionContent,
    timeoutSeconds: overrides.timeoutSeconds ?? task.timeoutSeconds,
    deleteAfterRun: overrides.deleteAfterRun ?? task.deleteAfterRun,
    agentId: overrides.agentId ?? task.agentId,
    model: overrides.model ?? task.model,
    thinking: overrides.thinking ?? task.thinking,
    lightContext: overrides.lightContext ?? task.lightContext,
    deliveryMode: overrides.deliveryMode ?? task.deliveryMode,
    deliveryBestEffort: overrides.deliveryBestEffort ?? task.deliveryBestEffort,
    deliveryChannel: overrides.deliveryChannel ?? task.deliveryChannel,
    recipient: overrides.recipient ?? task.recipient,
    lastRun: overrides.lastRun ?? task.lastRun,
    nextRun: overrides.nextRun ?? task.nextRun,
  };
}

export interface InstanceWorkbenchServiceDependencyOverrides {
  studioApi?: Partial<InstanceWorkbenchServiceDependencies['studioApi']>;
  instanceService?: Partial<InstanceWorkbenchServiceDependencies['instanceService']>;
  kernelConfigAttachmentApi?: Partial<
    InstanceWorkbenchServiceDependencies['kernelConfigAttachmentApi']
  >;
  openClawConfigDocumentApi?: Partial<
    InstanceWorkbenchServiceDependencies['openClawConfigDocumentApi']
  >;
  openClawGatewayClient?: Partial<InstanceWorkbenchServiceDependencies['openClawGatewayClient']>;
  buildCronTaskPayload?: InstanceWorkbenchServiceDependencies['buildCronTaskPayload'];
}

function createMissingDependencyError(name: string) {
  return new Error(`Instance workbench dependency "${name}" is not configured.`);
}

function createMissingAsyncDependency<TArgs extends unknown[], TResult>(name: string) {
  return async (..._args: TArgs): Promise<TResult> => {
    throw createMissingDependencyError(name);
  };
}

function buildFallbackCronTaskPayload(
  task: InstanceWorkbenchTask,
): Record<string, unknown> {
  const scheduleMode = task.scheduleMode || 'cron';
  const cronExpression =
    task.cronExpression || getStringValue(task.scheduleConfig, ['cronExpression']) || task.schedule;
  const schedule =
    scheduleMode === 'interval'
      ? {
          kind: 'interval',
          ms:
            getNumberValue(task.scheduleConfig, ['intervalMs']) ||
            getNumberValue(task.scheduleConfig, ['interval']) ||
            0,
        }
      : scheduleMode === 'datetime'
        ? {
            kind: 'datetime',
            at:
              getStringValue(task.scheduleConfig, ['datetime']) ||
              getStringValue(task.scheduleConfig, ['at']) ||
              task.schedule ||
              '',
          }
        : {
            kind: 'cron',
            expr: cronExpression || '',
          };
  const sessionTarget =
    task.sessionMode === 'main'
      ? 'main'
      : task.sessionMode === 'current'
        ? 'current'
        : task.sessionMode === 'custom' && task.customSessionId
          ? task.customSessionId
          : 'isolated';
  const wakeMode = task.wakeUpMode === 'nextCycle' ? 'nextCycle' : 'now';
  const payload =
    task.executionContent === 'sendPromptMessage'
      ? {
          kind: 'systemEvent',
          message: task.prompt || '',
        }
      : {
          kind: 'agentTurn',
          message: task.prompt || '',
        };
  const delivery =
    task.deliveryMode === 'publishSummary'
      ? {
          mode: 'announce',
          ...(task.deliveryChannel ? { channel: task.deliveryChannel } : {}),
          ...(task.recipient ? { to: task.recipient } : {}),
        }
      : task.deliveryMode === 'webhook'
        ? {
            mode: 'webhook',
            ...(task.recipient ? { url: task.recipient } : {}),
          }
        : {
            mode: 'none',
          };

  return {
    name: task.name,
    ...(task.description ? { description: task.description } : {}),
    enabled: task.status !== 'paused',
    schedule,
    sessionTarget,
    wakeMode,
    payload,
    delivery,
  };
}

function createDefaultDependencies(): InstanceWorkbenchServiceDependencies {
  return {
    studioApi: {
      getInstanceDetail: createMissingAsyncDependency('studioApi.getInstanceDetail'),
      createInstanceTask: createMissingAsyncDependency('studioApi.createInstanceTask'),
      updateInstanceTask: createMissingAsyncDependency('studioApi.updateInstanceTask'),
      cloneInstanceTask: createMissingAsyncDependency('studioApi.cloneInstanceTask'),
      runInstanceTaskNow: createMissingAsyncDependency('studioApi.runInstanceTaskNow'),
      listInstanceTaskExecutions:
        createMissingAsyncDependency('studioApi.listInstanceTaskExecutions'),
      updateInstanceTaskStatus: createMissingAsyncDependency('studioApi.updateInstanceTaskStatus'),
      deleteInstanceTask: createMissingAsyncDependency('studioApi.deleteInstanceTask'),
    },
    instanceService: {
      getInstanceById: createMissingAsyncDependency('instanceService.getInstanceById'),
      getInstanceConfig: createMissingAsyncDependency('instanceService.getInstanceConfig'),
      getInstanceToken: createMissingAsyncDependency('instanceService.getInstanceToken'),
      getInstanceLogs: createMissingAsyncDependency('instanceService.getInstanceLogs'),
    },
    kernelConfigAttachmentApi: {
      resolveInstanceConfigPath: (detail) => openClawConfigService.resolveInstanceConfigPath(detail),
      resolveAttachedKernelConfigFile: resolveAttachedKernelConfigFile,
    },
    openClawConfigDocumentApi: {
      readConfigSnapshot: async (configFile) => createEmptyOpenClawConfigSnapshot(configFile),
      getChannelDefinitions: () => openClawConfigService.getChannelDefinitions(),
    },
    openClawGatewayClient: {
      getConfig: createMissingAsyncDependency('openClawGatewayClient.getConfig'),
      listModels: createMissingAsyncDependency('openClawGatewayClient.listModels'),
      getChannelStatus: createMissingAsyncDependency('openClawGatewayClient.getChannelStatus'),
      getSkillsStatus: createMissingAsyncDependency('openClawGatewayClient.getSkillsStatus'),
      getToolsCatalog: createMissingAsyncDependency('openClawGatewayClient.getToolsCatalog'),
      listAgents: createMissingAsyncDependency('openClawGatewayClient.listAgents'),
      listAgentFiles: createMissingAsyncDependency('openClawGatewayClient.listAgentFiles'),
      getAgentFile: createMissingAsyncDependency('openClawGatewayClient.getAgentFile'),
      searchMemory: createMissingAsyncDependency('openClawGatewayClient.searchMemory'),
      getDoctorMemoryStatus:
        createMissingAsyncDependency('openClawGatewayClient.getDoctorMemoryStatus'),
      getDoctorMemoryDreamDiary:
        createMissingAsyncDependency('openClawGatewayClient.getDoctorMemoryDreamDiary'),
      listWorkbenchCronJobs:
        createMissingAsyncDependency('openClawGatewayClient.listWorkbenchCronJobs'),
      listWorkbenchCronRuns:
        createMissingAsyncDependency('openClawGatewayClient.listWorkbenchCronRuns'),
      addCronJob: createMissingAsyncDependency('openClawGatewayClient.addCronJob'),
      updateCronJob: createMissingAsyncDependency('openClawGatewayClient.updateCronJob'),
      removeCronJob: createMissingAsyncDependency('openClawGatewayClient.removeCronJob'),
      runCronJob: createMissingAsyncDependency('openClawGatewayClient.runCronJob'),
    },
    buildCronTaskPayload: buildFallbackCronTaskPayload,
  };
}

type OpenClawInstanceDetailRecord = StudioInstanceDetailRecord & {
  instance: StudioInstanceDetailRecord['instance'] & {
    runtimeKind: 'openclaw';
  };
};

function isOpenClawDetail(
  detail: StudioInstanceDetailRecord | null | undefined,
): detail is OpenClawInstanceDetailRecord {
  return detail?.instance.runtimeKind === 'openclaw';
}

function hasWorkbench(detail: StudioInstanceDetailRecord | null | undefined) {
  return Boolean(detail?.workbench);
}

function buildRegistryWorkbenchSnapshot(
  instance: Instance,
  config: InstanceConfig,
  token: string | undefined,
  logs: string,
): InstanceWorkbenchSnapshot {
  return buildDetailOnlyWorkbenchSnapshot(buildRegistryBackedDetail(instance, config, token, logs));
}

function buildOpenClawAgents(
  agentsResult: OpenClawAgentsListResult | null,
  configSnapshot: GatewayOpenClawConfigSnapshot | null,
  tasks: InstanceWorkbenchTask[],
  skills: Skill[],
): InstanceWorkbenchAgent[] {
  const configuredAgents =
    (getArrayValue(configSnapshot?.config, ['agents', 'list']) || []).filter(isRecord);
  const configuredById = new Map(
    configuredAgents
      .map((entry) => {
        const id = getStringValue(entry, ['id']);
        return id ? [normalizeOpenClawAgentId(id), entry] as const : null;
      })
      .filter(Boolean) as Array<readonly [string, Record<string, unknown>]>,
  );
  const sourceAgents =
    (Array.isArray(agentsResult?.agents) ? agentsResult?.agents : configuredAgents).filter(isRecord);

  return sourceAgents.map((entry) => {
    const agentId = normalizeOpenClawAgentId(getStringValue(entry, ['id']));
    const configured = configuredById.get(agentId);
    const name =
      getStringValue(entry, ['name']) ||
      getStringValue(configured, ['name']) ||
      titleCaseIdentifier(agentId);
    const description =
      getStringValue(entry, ['description']) ||
      `${name} agent exposed by the OpenClaw gateway.`;
    const avatar =
      getStringValue(entry, ['avatar']) ||
      getStringValue(entry, ['identity', 'emoji']) ||
      getStringValue(configured, ['identity', 'emoji']) ||
      name.charAt(0).toUpperCase() ||
      'O';
    const systemPrompt =
      getStringValue(entry, ['systemPrompt']) ||
      getStringValue(entry, ['prompt']) ||
      description;

    return mapAgent(
      {
        id: agentId,
        name,
        description,
        avatar,
        systemPrompt,
        creator: getStringValue(entry, ['creator']) || 'OpenClaw',
      },
      tasks,
      skills,
    );
  });
}

async function buildOpenClawFilesCatalog(
  instanceId: string,
  agents: InstanceWorkbenchAgent[],
  dependencies: InstanceWorkbenchServiceDependencies,
): Promise<InstanceWorkbenchFile[]> {
  const files = await Promise.all(
    agents.map(async (agent) => {
      const listed = await dependencies.openClawGatewayClient
        .listAgentFiles(instanceId, {
          agentId: agent.agent.id,
        })
        .catch(() => ({ files: [] }) as OpenClawAgentFilesListResult);
      const workspace = listed.workspace || '';

      return listed.files
        .filter(isRecord)
        .map((entry) =>
          mapOpenClawFileEntryToWorkbenchFile({
            agent,
            entry,
            workspace,
            content: '',
          }),
        )
        .filter(Boolean) as InstanceWorkbenchFile[];
    }),
  );

  return files.flat().sort((left, right) => left.path.localeCompare(right.path));
}

async function buildOpenClawMemoryFiles(
  instanceId: string,
  agents: InstanceWorkbenchAgent[],
  dependencies: InstanceWorkbenchServiceDependencies,
): Promise<InstanceWorkbenchFile[]> {
  const files = await Promise.all(
    agents.map(async (agent) => {
      const fetched = await dependencies.openClawGatewayClient
        .getAgentFile(instanceId, {
          agentId: agent.agent.id,
          name: 'MEMORY.md',
        })
        .catch(() => null);

      if (!isRecord(fetched?.file) || fetched.file.missing === true) {
        return null;
      }

      const file = mapOpenClawFileEntryToWorkbenchFile({
        agent,
        entry: fetched.file,
        workspace:
          typeof fetched.workspace === 'string' && fetched.workspace.trim()
            ? fetched.workspace
            : agent.workspace,
        content: typeof fetched.file.content === 'string' ? fetched.file.content : '',
      });

      if (!file || file.category !== 'memory' || !file.content.trim()) {
        return null;
      }

      return file;
    }),
  );

  return files
    .filter(Boolean)
    .sort((left, right) => left!.path.localeCompare(right!.path)) as InstanceWorkbenchFile[];
}

type OpenClawTaskRouteMode = 'backend' | 'gateway';

type OpenClawTaskRoute = {
  instanceId: string;
  mode: OpenClawTaskRouteMode;
};

type OpenClawLazySectionContext = {
  detail: OpenClawInstanceDetailRecord | null;
  backendWorkbench: InstanceWorkbenchSnapshot | null;
};

class InstanceWorkbenchService {
  private readonly backendTaskExecutionsById = new Map<string, InstanceWorkbenchTaskExecution[]>();

  private readonly openClawTaskRouteById = new Map<string, OpenClawTaskRoute>();

  private readonly dependencies: InstanceWorkbenchServiceDependencies;

  constructor(dependencies: InstanceWorkbenchServiceDependencies) {
    this.dependencies = dependencies;
  }

  private async resolveAttachedConfigFilePath(
    detail: StudioInstanceDetailRecord | null | undefined,
  ): Promise<string | null> {
    if (!isOpenClawDetail(detail)) {
      return null;
    }

    const configFile = resolveKernelConfigPathWithFallback(
      this.dependencies.kernelConfigAttachmentApi,
      detail,
    );
    if (!configFile) {
      return null;
    }

    if (shouldProbeOpenClawGateway(detail)) {
      return configFile;
    }

    const getConfigDocumentPathInfo =
      this.dependencies.openClawConfigDocumentApi.getConfigDocumentPathInfo;
    if (!getConfigDocumentPathInfo) {
      return configFile;
    }

    const pathInfo = await getConfigDocumentPathInfo(configFile).catch(() => null);
    if (!pathInfo) {
      return configFile;
    }

    return pathInfo.exists && pathInfo.kind === 'file' ? configFile : null;
  }

  private clearOpenClawTasksForInstance(instanceId: string) {
    for (const [taskId, route] of [...this.openClawTaskRouteById.entries()]) {
      if (route.instanceId === instanceId) {
        this.openClawTaskRouteById.delete(taskId);
        this.backendTaskExecutionsById.delete(taskId);
      }
    }
  }

  private rememberBackendTaskExecutions(detail: StudioInstanceDetailRecord) {
    const workbench = detail.workbench;
    if (!workbench) {
      return;
    }

    for (const [taskId, route] of [...this.openClawTaskRouteById.entries()]) {
      if (route.instanceId === detail.instance.id) {
        this.openClawTaskRouteById.delete(taskId);
        this.backendTaskExecutionsById.delete(taskId);
      }
    }

    workbench.cronTasks.tasks.forEach((task) => {
      const normalizedTask = normalizeWorkbenchTask(task);
      if (!normalizedTask) {
        return;
      }

      const rawTaskId = getStringValue(task, ['id']) || normalizedTask.id;
      const executions =
        workbench.cronTasks.taskExecutionsById[normalizedTask.id] ||
        workbench.cronTasks.taskExecutionsById[rawTaskId] ||
        [];

      this.openClawTaskRouteById.set(normalizedTask.id, {
        instanceId: detail.instance.id,
        mode: 'backend',
      });
      this.backendTaskExecutionsById.set(
        normalizedTask.id,
        executions.map(cloneTaskExecution),
      );
    });
  }

  private rememberOpenClawTasks(
    instanceId: string,
    tasks: InstanceWorkbenchTask[],
    gatewayTaskIds: ReadonlySet<string>,
    fallbackExecutionsById: Record<string, InstanceWorkbenchTaskExecution[]> = {},
  ) {
    this.clearOpenClawTasksForInstance(instanceId);

    tasks.forEach((task) => {
      this.openClawTaskRouteById.set(task.id, {
        instanceId,
        mode: gatewayTaskIds.has(task.id) ? 'gateway' : 'backend',
      });

      const executions =
        fallbackExecutionsById[task.id] ||
        (task.latestExecution ? [cloneTaskExecution(task.latestExecution)] : []);
      if (executions.length > 0) {
        this.backendTaskExecutionsById.set(
          task.id,
          executions.map(cloneTaskExecution),
        );
      }
    });
  }

  private getOpenClawTaskRoute(taskId: string): OpenClawTaskRoute | null {
    return this.openClawTaskRouteById.get(taskId) || null;
  }

  private async getOpenClawLazySectionContext(
    instanceId: string,
  ): Promise<OpenClawLazySectionContext> {
    const detail = await this.dependencies.studioApi.getInstanceDetail(instanceId).catch(() => null);

    if (!isOpenClawDetail(detail) || !detail.workbench) {
      return {
        detail: isOpenClawDetail(detail) ? detail : null,
        backendWorkbench: null,
      };
    }

    const attachedConfigFilePath = await this.resolveAttachedConfigFilePath(detail);
    const configSnapshot = attachedConfigFilePath
      ? await this.dependencies.openClawConfigDocumentApi
          .readConfigSnapshot(attachedConfigFilePath)
          .catch(() => null)
      : null;

    return {
      detail,
      backendWorkbench: mapBackendWorkbench(
        detail,
        attachedConfigFilePath,
        configSnapshot,
      ),
    };
  }

  private async buildGatewayOpenClawSnapshot(
    instanceId: string,
    detail: StudioInstanceDetailRecord,
  ): Promise<InstanceWorkbenchSnapshot | null> {
    if (!shouldProbeOpenClawGateway(detail)) {
      return null;
    }

    const [
      configResult,
      modelsResult,
      channelsResult,
      skillsResult,
      agentsResult,
      tasksResult,
    ] = await Promise.allSettled([
      this.dependencies.openClawGatewayClient.getConfig(instanceId),
      this.dependencies.openClawGatewayClient.listModels(instanceId),
      this.dependencies.openClawGatewayClient.getChannelStatus(instanceId, {}),
      this.dependencies.openClawGatewayClient.getSkillsStatus(instanceId, {}),
      this.dependencies.openClawGatewayClient.listAgents(instanceId),
      this.dependencies.openClawGatewayClient.listWorkbenchCronJobs(instanceId),
    ]);

    const tasks = tasksResult.status === 'fulfilled' ? tasksResult.value : [];
    const skills =
      skillsResult.status === 'fulfilled'
        ? safelyBuildOpenClawSection(() => buildOpenClawSkills(skillsResult.value), [])
        : [];
    const llmProviders =
      configResult.status === 'fulfilled'
        ? safelyBuildOpenClawSection(
            () =>
              buildOpenClawLlmProviders(
                configResult.value,
                modelsResult.status === 'fulfilled' ? modelsResult.value : [],
                detail,
              ),
            [],
          )
        : [];
    const channels =
      channelsResult.status === 'fulfilled'
        ? safelyBuildOpenClawSection(() => buildOpenClawChannels(channelsResult.value), [])
        : [];
    const agents = safelyBuildOpenClawSection(
      () =>
        buildOpenClawAgents(
          agentsResult.status === 'fulfilled' ? agentsResult.value : null,
          configResult.status === 'fulfilled' ? configResult.value : null,
          tasks,
          skills,
        ),
      [],
    );
    const toolCatalogResults = await Promise.allSettled(
      (agents.length > 0
        ? agents.map((agent) =>
            this.dependencies.openClawGatewayClient.getToolsCatalog(instanceId, {
              agentId: agent.agent.id,
            }),
          )
        : [this.dependencies.openClawGatewayClient.getToolsCatalog(instanceId, {})]),
    );
    const tools = safelyBuildOpenClawSection(
      () =>
        buildOpenClawScopedTools(
          toolCatalogResults
            .filter(
              (
                result,
              ): result is PromiseFulfilledResult<OpenClawToolsCatalogResult> =>
                result.status === 'fulfilled',
            )
            .map((result) => result.value),
          agents,
        ),
      [],
    );

    const hasGatewayData =
      channels.length > 0 ||
      tasks.length > 0 ||
      llmProviders.length > 0 ||
      agents.length > 0 ||
      skills.length > 0 ||
      tools.length > 0;

    if (!hasGatewayData) {
      return null;
    }

    return buildOpenClawSnapshotFromSections(detail, {
      channels,
      tasks,
      agents,
      skills,
      files: [],
      llmProviders,
      memories: [],
      tools,
    });
  }

  private async getOpenClawWorkbench(
    instanceId: string,
    detail: StudioInstanceDetailRecord,
    configSnapshot: OpenClawConfigSnapshot | null,
  ): Promise<InstanceWorkbenchSnapshot> {
    const attachedConfigFilePath = await this.resolveAttachedConfigFilePath(detail);
    const backendSnapshot = detail.workbench
      ? mapBackendWorkbench(detail, attachedConfigFilePath, configSnapshot)
      : null;
    if (detail.workbench) {
      this.rememberBackendTaskExecutions(detail);
    }

    const liveSnapshot = await this.buildGatewayOpenClawSnapshot(instanceId, detail).catch(
      () => null,
    );

    const snapshot =
      backendSnapshot && liveSnapshot
        ? mergeOpenClawSnapshots(backendSnapshot, liveSnapshot)
        : backendSnapshot || liveSnapshot;
    const finalizedSnapshot = finalizeOpenClawSnapshot(
      detail,
      snapshot ||
        buildOpenClawSnapshotFromSections(detail, {
          channels: [],
          tasks: [],
          agents: [],
          skills: [],
          files: [],
          llmProviders: [],
          memories: [],
          tools: [],
       }),
      attachedConfigFilePath ?? null,
      configSnapshot,
      buildOpenClawChannelCatalog(this.dependencies.openClawConfigDocumentApi, configSnapshot),
    );
    const gatewayTaskIds = new Set(
      normalizeWorkbenchTaskCollection(liveSnapshot?.tasks || []).map((task) => task.id),
    );

    this.rememberOpenClawTasks(
      instanceId,
      finalizedSnapshot.tasks,
      gatewayTaskIds,
      detail.workbench?.cronTasks.taskExecutionsById || {},
    );

    return finalizedSnapshot;
  }

  async getInstanceWorkbench(id: string): Promise<InstanceWorkbenchSnapshot | null> {
    const detail = await this.dependencies.studioApi.getInstanceDetail(id);
    const attachedConfigFilePath = await this.resolveAttachedConfigFilePath(detail);
    const configSnapshot = attachedConfigFilePath
      ? await this.dependencies.openClawConfigDocumentApi
          .readConfigSnapshot(attachedConfigFilePath)
          .catch(() => null)
      : null;

    if (isOpenClawDetail(detail)) {
      return this.getOpenClawWorkbench(id, detail, configSnapshot);
    }

    if (detail?.workbench) {
      return mapBackendWorkbench(detail, attachedConfigFilePath, configSnapshot);
    }

    if (detail) {
      return buildDetailOnlyWorkbenchSnapshot(
        detail,
        attachedConfigFilePath,
        configSnapshot,
      );
    }

    const [liveInstance, liveConfig, liveToken, liveLogs] = await Promise.all([
      this.dependencies.instanceService.getInstanceById(id),
      this.dependencies.instanceService.getInstanceConfig(id),
      this.dependencies.instanceService.getInstanceToken(id),
      this.dependencies.instanceService.getInstanceLogs(id),
    ]);

    if (!liveInstance || !liveConfig) {
      return null;
    }

    return buildRegistryWorkbenchSnapshot(liveInstance, liveConfig, liveToken, liveLogs);
  }

  async listInstanceFiles(
    instanceId: string,
    agents: InstanceWorkbenchAgent[] = [],
  ): Promise<InstanceWorkbenchFile[]> {
    const { detail, backendWorkbench } = await this.getOpenClawLazySectionContext(instanceId);

    if (backendWorkbench?.files.length) {
      return backendWorkbench.files.map((file) => ({ ...file }));
    }

    const effectiveAgents =
      agents.length > 0 ? agents : backendWorkbench?.agents.map(cloneWorkbenchAgent) || [];

    if (!detail) {
      return effectiveAgents.length > 0
        ? buildOpenClawFilesCatalog(instanceId, effectiveAgents, this.dependencies)
        : [];
    }

    if (effectiveAgents.length > 0 && shouldProbeOpenClawGateway(detail)) {
      return buildOpenClawFilesCatalog(instanceId, effectiveAgents, this.dependencies);
    }

    return [];
  }

  async listInstanceMemories(
    instanceId: string,
    agents: InstanceWorkbenchAgent[] = [],
  ): Promise<InstanceWorkbenchMemoryEntry[]> {
    const { detail, backendWorkbench } = await this.getOpenClawLazySectionContext(instanceId);

    if (backendWorkbench?.memories.length) {
      return backendWorkbench.memories.map((entry) => ({ ...entry }));
    }

    const effectiveAgents =
      agents.length > 0 ? agents : backendWorkbench?.agents.map(cloneWorkbenchAgent) || [];

    if (!detail) {
      if (effectiveAgents.length === 0) {
        return [];
      }
    } else if (!shouldProbeOpenClawGateway(detail) || effectiveAgents.length === 0) {
      return [];
    }

    const [configSnapshot, memoryFiles, doctorMemoryStatus, runtimeSearchResult, dreamDiaryResult] =
      await Promise.all([
        this.dependencies.openClawGatewayClient.getConfig(instanceId).catch(() => null),
        effectiveAgents.length > 0
          ? buildOpenClawMemoryFiles(instanceId, effectiveAgents, this.dependencies).catch(() => [])
          : Promise.resolve([] as InstanceWorkbenchFile[]),
        effectiveAgents.length > 0
          ? this.dependencies.openClawGatewayClient.getDoctorMemoryStatus(instanceId).catch(() => null)
          : Promise.resolve(null),
        effectiveAgents.length > 0
          ? this.dependencies.openClawGatewayClient
              .searchMemory(instanceId, {
                query: 'recent work decisions runbook',
                maxResults: 6,
              })
              .catch(() => null)
          : Promise.resolve(null),
        effectiveAgents.length > 0
          ? this.dependencies.openClawGatewayClient
              .getDoctorMemoryDreamDiary(instanceId)
              .catch(() => null)
          : Promise.resolve(null),
      ]);
    const runtimeMemories = buildOpenClawRuntimeMemoryEntries(
      doctorMemoryStatus,
      runtimeSearchResult,
      dreamDiaryResult,
      configSnapshot,
    );

    if (runtimeMemories.some((entry) => entry.id.startsWith('memory-runtime-hit-'))) {
      return runtimeMemories;
    }

    if (runtimeMemories.length > 0) {
      return [
        ...runtimeMemories,
        ...buildOpenClawMemories(configSnapshot, memoryFiles, effectiveAgents).filter(
          (entry) => entry.id !== 'memory-backend',
        ),
      ];
    }

    if (effectiveAgents.length > 0 || configSnapshot) {
      return buildOpenClawMemories(configSnapshot, memoryFiles, effectiveAgents);
    }

    return [];
  }

  async createTask(instanceId: string, payload: Record<string, unknown>): Promise<void> {
    const detail = await this.dependencies.studioApi.getInstanceDetail(instanceId);
    if (!hasWorkbench(detail) && isOpenClawDetail(detail)) {
      await this.dependencies.openClawGatewayClient.addCronJob(instanceId, payload);
      return;
    }

    await this.dependencies.studioApi.createInstanceTask(instanceId, payload);
  }

  async updateTask(
    instanceId: string,
    id: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const detail = await this.dependencies.studioApi.getInstanceDetail(instanceId);
    if (!hasWorkbench(detail) && isOpenClawDetail(detail)) {
      await this.dependencies.openClawGatewayClient.updateCronJob(instanceId, id, payload);
      return;
    }

    await this.dependencies.studioApi.updateInstanceTask(instanceId, id, payload);
  }

  async cloneTask(id: string, name?: string): Promise<void> {
    const route = this.getOpenClawTaskRoute(id);
    if (!route) {
      throw new Error('Task is not available from the current runtime snapshot.');
    }
    const { instanceId, mode } = route;

    if (mode === 'backend') {
      await this.dependencies.studioApi.cloneInstanceTask(instanceId, id, name);
      return;
    }

    const tasks = await this.dependencies.openClawGatewayClient.listWorkbenchCronJobs(instanceId);
    const current = tasks.find((task) => task.id === id);
    if (!current) {
      throw new Error('Task is not available from the current runtime snapshot.');
    }

    await this.dependencies.openClawGatewayClient.addCronJob(
      instanceId,
      this.dependencies.buildCronTaskPayload(
        toCreateTaskInput(current, {
          name: name || current.name,
        }),
        current.rawDefinition,
      ),
    );
  }

  async runTaskNow(id: string): Promise<InstanceWorkbenchTaskExecution> {
    const route = this.getOpenClawTaskRoute(id);
    if (!route) {
      throw new Error('Task is not available from the current runtime snapshot.');
    }
    const { instanceId, mode } = route;

    if (mode === 'backend') {
      const execution = await this.dependencies.studioApi.runInstanceTaskNow(instanceId, id);
      const current = this.backendTaskExecutionsById.get(id) || [];
      this.backendTaskExecutionsById.set(id, [cloneTaskExecution(execution), ...current]);
      return cloneTaskExecution(execution);
    }

    await this.dependencies.openClawGatewayClient.runCronJob(instanceId, id);
    const executions = await this.dependencies.openClawGatewayClient.listWorkbenchCronRuns(
      instanceId,
      id,
    );
    if (executions.length > 0) {
      this.backendTaskExecutionsById.set(id, executions.map(cloneTaskExecution));
      return cloneTaskExecution(executions[0]!);
    }

    const execution: InstanceWorkbenchTaskExecution = {
      id: `${id}-${Date.now()}`,
      taskId: id,
      status: 'running',
      trigger: 'manual',
      startedAt: new Date().toISOString(),
      summary: 'Cron job has been queued.',
      details: undefined,
    };
    const current = this.backendTaskExecutionsById.get(id) || [];
    this.backendTaskExecutionsById.set(id, [cloneTaskExecution(execution), ...current]);
    return execution;
  }

  async listTaskExecutions(id: string): Promise<InstanceWorkbenchTaskExecution[]> {
    const route = this.getOpenClawTaskRoute(id);
    if (route) {
      const { instanceId, mode } = route;
      if (mode === 'backend') {
        const executions = await this.dependencies.studioApi.listInstanceTaskExecutions(instanceId, id);
        this.backendTaskExecutionsById.set(
          id,
          executions.map(cloneTaskExecution),
        );
        return executions;
      }

      try {
        const executions = await this.dependencies.openClawGatewayClient.listWorkbenchCronRuns(
          instanceId,
          id,
        );
        this.backendTaskExecutionsById.set(id, executions.map(cloneTaskExecution));
        return executions;
      } catch {
        const executions = await this.dependencies.studioApi.listInstanceTaskExecutions(instanceId, id);
        this.backendTaskExecutionsById.set(
          id,
          executions.map(cloneTaskExecution),
        );
        return executions;
      }
    }

    const executions = this.backendTaskExecutionsById.get(id) || [];
    return executions.map(cloneTaskExecution);
  }

  async updateTaskStatus(id: string, status: 'active' | 'paused'): Promise<void> {
    const route = this.getOpenClawTaskRoute(id);
    if (!route) {
      throw new Error('Task is not available from the current runtime snapshot.');
    }
    const { instanceId, mode } = route;

    if (mode === 'backend') {
      await this.dependencies.studioApi.updateInstanceTaskStatus(instanceId, id, status);
      return;
    }

    await this.dependencies.openClawGatewayClient.updateCronJob(instanceId, id, {
      enabled: status === 'active',
    });
  }

  async deleteTask(id: string): Promise<void> {
    const route = this.getOpenClawTaskRoute(id);
    if (!route) {
      throw new Error('Task is not available from the current runtime snapshot.');
    }
    const { instanceId, mode } = route;

    const deleted =
      mode === 'backend'
        ? await this.dependencies.studioApi.deleteInstanceTask(instanceId, id)
        : await this.dependencies.openClawGatewayClient.removeCronJob(instanceId, id);
    if (!deleted) {
      throw new Error('Failed to delete task');
    }
    this.openClawTaskRouteById.delete(id);
    this.backendTaskExecutionsById.delete(id);
  }
}

export function createInstanceWorkbenchService(
  overrides: InstanceWorkbenchServiceDependencyOverrides = {},
) {
  const defaults = createDefaultDependencies();
  return new InstanceWorkbenchService({
    studioApi: {
      ...defaults.studioApi,
      ...(overrides.studioApi || {}),
    },
    instanceService: {
      ...defaults.instanceService,
      ...(overrides.instanceService || {}),
    },
    kernelConfigAttachmentApi: {
      ...defaults.kernelConfigAttachmentApi,
      ...(overrides.kernelConfigAttachmentApi || {}),
    },
    openClawConfigDocumentApi: {
      ...defaults.openClawConfigDocumentApi,
      ...(overrides.openClawConfigDocumentApi || {}),
    },
    openClawGatewayClient: {
      ...defaults.openClawGatewayClient,
      ...(overrides.openClawGatewayClient || {}),
    },
    buildCronTaskPayload: overrides.buildCronTaskPayload || defaults.buildCronTaskPayload,
  });
}

export const instanceWorkbenchService = createInstanceWorkbenchService();
