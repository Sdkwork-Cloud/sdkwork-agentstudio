import {
  assertValidStudioCreateInstanceKernelPolicy,
} from '@sdkwork/claw-infrastructure';
import type {
  StudioCreateInstanceInput,
  StudioUpdateInstanceInput,
  OpenClawAgentFileResult,
} from '@sdkwork/claw-infrastructure';
import type {
  OpenClawAgentSnapshot,
  OpenClawAuthCooldownsConfigSnapshot,
  OpenClawChannelSnapshot,
  OpenClawWebFetchConfigSnapshot,
  OpenClawWebSearchNativeCodexConfigSnapshot,
  OpenClawXSearchConfigSnapshot,
  SaveOpenClawAuthCooldownsConfigurationInput,
  SaveOpenClawDreamingConfigurationInput,
  OpenClawAgentInput,
  OpenClawModelSelection,
  OpenClawProviderInput,
  OpenClawProviderModelInput,
  OpenClawDreamingConfigSnapshot,
  SaveOpenClawWebFetchConfigurationInput,
  SaveOpenClawWebSearchNativeCodexConfigurationInput,
  OpenClawWebSearchConfigSnapshot,
  SaveOpenClawXSearchConfigurationInput,
  SaveOpenClawWebSearchConfigurationInput,
} from '@sdkwork/claw-core';
import {
  deleteOpenClawAgentFromConfigDocument,
  openClawConfigService,
  resolveAttachedKernelConfigFile,
  saveOpenClawAgentInConfigDocument,
  saveOpenClawAuthCooldownsConfigInDocument,
  saveOpenClawChannelConfigInDocument,
  saveOpenClawDreamingConfigInDocument,
  saveOpenClawWebFetchConfigInDocument,
  saveOpenClawWebSearchNativeCodexConfigInDocument,
  saveOpenClawWebSearchConfigInDocument,
  saveOpenClawXSearchConfigInDocument,
  serializeOpenClawConfigDocument,
  setOpenClawChannelEnabledInDocument,
} from '@sdkwork/claw-core';
import type {
  ListParams,
  PaginatedResult,
  StudioInstanceDetailRecord,
  StudioInstanceDeploymentMode,
  StudioInstanceRecord,
  StudioInstanceTransportKind,
  StudioRuntimeKind,
} from '@sdkwork/claw-types';
import type { Instance, InstanceConfig, InstanceLLMProviderUpdate } from '../types/index.ts';
import type { ConfigUiHints } from './openClawConfigSchemaSupport.ts';
import {
  buildOpenClawAgentFileId,
  normalizeOpenClawAgentFileId,
  parseOpenClawAgentFileId,
} from './openClawSupport.ts';
import {
  hasReadyOpenClawGateway,
  isProviderCenterControlledOpenClawDetail,
  shouldProbeOpenClawGateway,
} from './openClawManagementCapabilities.ts';
import { resolveKernelConfigPathWithFallback } from './kernelConfigPathFallback.ts';
import { buildRemoteOpenClawProviderConfigPatch } from './openClawProviderConfigPatch.ts';

export interface CreateInstanceDTO {
  name: string;
  type?: string;
  iconType?: 'apple' | 'box' | 'server';
  description?: string;
  runtimeKind?: StudioRuntimeKind;
  deploymentMode?: StudioInstanceDeploymentMode;
  transportKind?: StudioInstanceTransportKind;
  host?: string;
  port?: number | null;
  baseUrl?: string | null;
  websocketUrl?: string | null;
}

export interface UpdateInstanceDTO extends Partial<CreateInstanceDTO> {
  status?: 'online' | 'offline' | 'starting' | 'error';
}

export interface OpenClawConfigSchemaSnapshot {
  schema: unknown;
  uiHints: ConfigUiHints;
  version: string | null;
  generatedAt: string | null;
}

export interface InstanceServiceDependencies {
  studioApi: {
    listInstances(): Promise<StudioInstanceRecord[]>;
    getInstance(id: string): Promise<StudioInstanceRecord | null>;
    getInstanceDetail(id: string): Promise<StudioInstanceDetailRecord | null>;
    createInstance(input: StudioCreateInstanceInput): Promise<StudioInstanceRecord>;
    updateInstance(id: string, input: StudioUpdateInstanceInput): Promise<StudioInstanceRecord>;
    deleteInstance(id: string): Promise<boolean>;
    startInstance(id: string): Promise<StudioInstanceRecord | null>;
    stopInstance(id: string): Promise<StudioInstanceRecord | null>;
    restartInstance(id: string): Promise<StudioInstanceRecord | null>;
    getInstanceConfig(id: string): Promise<{
      port: string;
      sandbox: boolean;
      autoUpdate: boolean;
      logLevel: string;
      corsOrigins: string;
      authToken?: string | null;
    } | null>;
    updateInstanceConfig(
      id: string,
      config: {
        port: string;
        sandbox: boolean;
        autoUpdate: boolean;
        logLevel: string;
        corsOrigins: string;
        authToken?: string | null;
      },
    ): Promise<{
      port: string;
      sandbox: boolean;
      autoUpdate: boolean;
      logLevel: string;
      corsOrigins: string;
      authToken?: string | null;
    } | null>;
    getInstanceLogs(id: string): Promise<string>;
    updateInstanceFileContent(instanceId: string, fileId: string, content: string): Promise<boolean>;
    updateInstanceLlmProviderConfig(
      instanceId: string,
      providerId: string,
      update: InstanceLLMProviderUpdate,
    ): Promise<boolean>;
  };
  openClawGatewayClient: {
    getAgentFile(
      instanceId: string,
      args: { agentId: string; name: string },
    ): Promise<OpenClawAgentFileResult>;
    setAgentFile(
      instanceId: string,
      args: { agentId: string; name: string; content: string },
    ): Promise<unknown>;
    getConfig(instanceId: string): Promise<{
      baseHash?: string;
      config?: Record<string, unknown>;
    }>;
    getConfigSchema(instanceId: string): Promise<{
      schema?: unknown;
      uiHints?: ConfigUiHints;
      version?: string | null;
      generatedAt?: string | null;
    }>;
    openConfigFile(instanceId: string): Promise<{
      ok?: boolean;
      path?: string;
      error?: string;
    }>;
    setConfig(
      instanceId: string,
      args: { raw: string; baseHash?: string },
    ): Promise<{ ok?: boolean; error?: string }>;
    patchConfig(
      instanceId: string,
      args: { raw: string; baseHash?: string },
    ): Promise<{ ok?: boolean }>;
    applyConfig(
      instanceId: string,
      args: { raw: string; baseHash?: string },
    ): Promise<{ ok?: boolean; error?: string }>;
    runUpdate(instanceId: string): Promise<{ ok?: boolean; error?: string }>;
  };
  kernelConfigAttachmentApi: {
    resolveInstanceConfigPath?(
      detail: StudioInstanceDetailRecord,
    ): string | null | undefined;
    resolveAttachedKernelConfigFile(
      detail: StudioInstanceDetailRecord,
    ): string | null | undefined;
  };
  openClawConfigDocumentApi: {
    getConfigDocumentPathInfo?(
      configFile: string,
    ): Promise<{ exists: boolean; kind: 'file' | 'directory' | 'missing' }>;
    readConfigDocument(configFile: string): Promise<string>;
    writeConfigDocument(configFile: string, raw: string): Promise<void>;
    saveAgent(args: {
      configFile: string;
      agent: OpenClawAgentInput;
    }): Promise<OpenClawAgentSnapshot | null>;
    deleteAgent(args: {
      configFile: string;
      agentId: string;
    }): Promise<OpenClawAgentSnapshot[]>;
    saveChannelConfiguration(args: {
      configFile: string;
      channelId: string;
      values: Record<string, string>;
      enabled: boolean;
    }): Promise<OpenClawChannelSnapshot | null>;
    saveWebSearchConfiguration(
      input: SaveOpenClawWebSearchConfigurationInput,
    ): Promise<OpenClawWebSearchConfigSnapshot>;
    saveXSearchConfiguration(
      input: SaveOpenClawXSearchConfigurationInput,
    ): Promise<OpenClawXSearchConfigSnapshot>;
    saveWebSearchNativeCodexConfiguration(
      input: SaveOpenClawWebSearchNativeCodexConfigurationInput,
    ): Promise<OpenClawWebSearchNativeCodexConfigSnapshot>;
    saveWebFetchConfiguration(
      input: SaveOpenClawWebFetchConfigurationInput,
    ): Promise<OpenClawWebFetchConfigSnapshot>;
    saveAuthCooldownsConfiguration(
      input: SaveOpenClawAuthCooldownsConfigurationInput,
    ): Promise<OpenClawAuthCooldownsConfigSnapshot>;
    saveDreamingConfiguration(
      input: SaveOpenClawDreamingConfigurationInput,
    ): Promise<OpenClawDreamingConfigSnapshot>;
    setChannelEnabled(args: {
      configFile: string;
      channelId: string;
      enabled: boolean;
    }): Promise<OpenClawChannelSnapshot | null>;
  };
}

export interface InstanceServiceDependencyOverrides {
  studioApi?: Partial<InstanceServiceDependencies['studioApi']>;
  openClawGatewayClient?: Partial<InstanceServiceDependencies['openClawGatewayClient']>;
  kernelConfigAttachmentApi?: Partial<InstanceServiceDependencies['kernelConfigAttachmentApi']>;
  openClawConfigDocumentApi?: Partial<InstanceServiceDependencies['openClawConfigDocumentApi']>;
}

function mapStudioInstance(instance: StudioInstanceRecord): Instance {
  const status: Instance['status'] =
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
  };
}

function mapCreateInput(data: CreateInstanceDTO): StudioCreateInstanceInput {
  const input: StudioCreateInstanceInput = {
    name: data.name,
    description: data.description,
    runtimeKind: data.runtimeKind || 'custom',
    deploymentMode: data.deploymentMode || 'remote',
    transportKind: data.transportKind || 'customHttp',
    iconType: data.iconType || 'server',
    typeLabel: data.type,
    host: data.host,
    port: data.port ?? null,
    baseUrl: data.baseUrl ?? null,
    websocketUrl: data.websocketUrl ?? null,
  };

  assertValidStudioCreateInstanceKernelPolicy(input);
  return input;
}

function mapUpdateInput(data: UpdateInstanceDTO): StudioUpdateInstanceInput {
  return {
    name: data.name,
    description: data.description,
    iconType: data.iconType,
    typeLabel: data.type,
    host: data.host,
    port: data.port ?? null,
    baseUrl: data.baseUrl ?? null,
    websocketUrl: data.websocketUrl ?? null,
    status:
      data.status === 'starting'
        ? 'starting'
        : data.status === 'error'
          ? 'error'
          : data.status,
  };
}

function isOpenClawDetail(detail: StudioInstanceDetailRecord | null | undefined) {
  return detail?.instance.runtimeKind === 'openclaw';
}

function isBuiltInOpenClawDetail(detail: StudioInstanceDetailRecord | null | undefined) {
  return (
    detail?.instance.runtimeKind === 'openclaw' &&
    detail.instance.isBuiltIn &&
    detail.lifecycle.owner === 'appManaged' &&
    detail.lifecycle.workbenchManaged === true
  );
}

function shouldUseStudioBridgeForFileContent(
  detail: StudioInstanceDetailRecord | null | undefined,
  fileId: string,
) {
  const normalizedFileId = normalizeOpenClawAgentFileId(fileId);

  if (isBuiltInOpenClawDetail(detail)) {
    return true;
  }

  return Boolean(
    detail?.workbench?.files.some(
      (file) => normalizeOpenClawAgentFileId(file.id) === normalizedFileId,
    ) &&
      !isOpenClawDetail(detail),
  );
}

function findWorkbenchFileById(
  detail: StudioInstanceDetailRecord | null | undefined,
  fileId: string,
) {
  const normalizedFileId = normalizeOpenClawAgentFileId(fileId);
  return detail?.workbench?.files.find(
    (file) => normalizeOpenClawAgentFileId(file.id) === normalizedFileId,
  );
}

function shouldUseStudioBridgeForProviderConfig(
  detail: StudioInstanceDetailRecord | null | undefined,
  providerId: string,
) {
  return Boolean(
    detail?.workbench?.llmProviders.some((provider) => provider.id === providerId) &&
      !isOpenClawDetail(detail),
  );
}

function createProviderCenterControlledOpenClawProviderError() {
  return new Error(
    'Config-backed OpenClaw provider routes are managed through Provider Center.',
  );
}

function createBuiltInInstanceDeleteError() {
  return new Error('Built-in instances are managed by Claw Studio and cannot be uninstalled.');
}

function createMissingDependencyError(name: string) {
  return new Error(`Instance service dependency "${name}" is not configured.`);
}

function createMissingAsyncDependency<TArgs extends unknown[], TResult>(name: string) {
  return async (..._args: TArgs): Promise<TResult> => {
    throw createMissingDependencyError(name);
  };
}

function createDefaultDependencies(): InstanceServiceDependencies {
  return {
    studioApi: {
      listInstances: createMissingAsyncDependency('studioApi.listInstances'),
      getInstance: createMissingAsyncDependency('studioApi.getInstance'),
      getInstanceDetail: createMissingAsyncDependency('studioApi.getInstanceDetail'),
      createInstance: createMissingAsyncDependency('studioApi.createInstance'),
      updateInstance: createMissingAsyncDependency('studioApi.updateInstance'),
      deleteInstance: createMissingAsyncDependency('studioApi.deleteInstance'),
      startInstance: createMissingAsyncDependency('studioApi.startInstance'),
      stopInstance: createMissingAsyncDependency('studioApi.stopInstance'),
      restartInstance: createMissingAsyncDependency('studioApi.restartInstance'),
      getInstanceConfig: createMissingAsyncDependency('studioApi.getInstanceConfig'),
      updateInstanceConfig: createMissingAsyncDependency('studioApi.updateInstanceConfig'),
      getInstanceLogs: createMissingAsyncDependency('studioApi.getInstanceLogs'),
      updateInstanceFileContent: createMissingAsyncDependency('studioApi.updateInstanceFileContent'),
      updateInstanceLlmProviderConfig:
        createMissingAsyncDependency('studioApi.updateInstanceLlmProviderConfig'),
    },
    openClawGatewayClient: {
      getAgentFile: createMissingAsyncDependency('openClawGatewayClient.getAgentFile'),
      setAgentFile: createMissingAsyncDependency('openClawGatewayClient.setAgentFile'),
      getConfig: createMissingAsyncDependency('openClawGatewayClient.getConfig'),
      getConfigSchema: createMissingAsyncDependency('openClawGatewayClient.getConfigSchema'),
      openConfigFile: createMissingAsyncDependency('openClawGatewayClient.openConfigFile'),
      setConfig: createMissingAsyncDependency('openClawGatewayClient.setConfig'),
      patchConfig: createMissingAsyncDependency('openClawGatewayClient.patchConfig'),
      applyConfig: createMissingAsyncDependency('openClawGatewayClient.applyConfig'),
      runUpdate: createMissingAsyncDependency('openClawGatewayClient.runUpdate'),
    },
    kernelConfigAttachmentApi: {
      resolveInstanceConfigPath: (detail) => openClawConfigService.resolveInstanceConfigPath(detail),
      resolveAttachedKernelConfigFile: resolveAttachedKernelConfigFile,
    },
    openClawConfigDocumentApi: {
      readConfigDocument: createMissingAsyncDependency('openClawConfigDocumentApi.readConfigDocument'),
      writeConfigDocument: createMissingAsyncDependency(
        'openClawConfigDocumentApi.writeConfigDocument',
      ),
      saveAgent: createMissingAsyncDependency('openClawConfigDocumentApi.saveAgent'),
      deleteAgent: createMissingAsyncDependency('openClawConfigDocumentApi.deleteAgent'),
      saveChannelConfiguration:
        createMissingAsyncDependency('openClawConfigDocumentApi.saveChannelConfiguration'),
      saveWebSearchConfiguration:
        createMissingAsyncDependency('openClawConfigDocumentApi.saveWebSearchConfiguration'),
      saveXSearchConfiguration:
        createMissingAsyncDependency('openClawConfigDocumentApi.saveXSearchConfiguration'),
      saveWebSearchNativeCodexConfiguration: createMissingAsyncDependency(
        'openClawConfigDocumentApi.saveWebSearchNativeCodexConfiguration',
      ),
      saveWebFetchConfiguration:
        createMissingAsyncDependency('openClawConfigDocumentApi.saveWebFetchConfiguration'),
      saveAuthCooldownsConfiguration:
        createMissingAsyncDependency('openClawConfigDocumentApi.saveAuthCooldownsConfiguration'),
      saveDreamingConfiguration:
        createMissingAsyncDependency('openClawConfigDocumentApi.saveDreamingConfiguration'),
      setChannelEnabled: createMissingAsyncDependency(
        'openClawConfigDocumentApi.setChannelEnabled',
      ),
    },
  };
}

export interface IInstanceService {
  getList(params?: ListParams): Promise<PaginatedResult<Instance>>;
  getById(id: string): Promise<Instance | null>;
  create(data: CreateInstanceDTO): Promise<Instance>;
  update(id: string, data: UpdateInstanceDTO): Promise<Instance>;
  delete(id: string): Promise<boolean>;
  getInstances(): Promise<Instance[]>;
  getInstanceById(id: string): Promise<Instance | undefined>;
  getInstanceDetail(id: string): Promise<StudioInstanceDetailRecord | null>;
  startInstance(id: string): Promise<void>;
  stopInstance(id: string): Promise<void>;
  restartInstance(id: string): Promise<void>;
  getInstanceConfig(id: string): Promise<InstanceConfig | undefined>;
  updateInstanceConfig(id: string, config: InstanceConfig): Promise<void>;
  getInstanceToken(id: string): Promise<string | undefined>;
  deleteInstance(id: string): Promise<void>;
  getInstanceLogs(id: string): Promise<string>;
  getOpenClawConfigDocument(id: string): Promise<string>;
  updateOpenClawConfigDocument(id: string, raw: string): Promise<void>;
  getOpenClawConfigSchema(id: string): Promise<OpenClawConfigSchemaSnapshot>;
  openClawConfigFile(id: string): Promise<string | null>;
  applyOpenClawConfigDocument(id: string, raw: string): Promise<void>;
  runOpenClawUpdate(id: string): Promise<void>;
  getInstanceFileContent(id: string, fileId: string): Promise<string>;
  updateInstanceFileContent(id: string, fileId: string, content: string): Promise<void>;
  updateInstanceLlmProviderConfig(
    id: string,
    providerId: string,
    update: InstanceLLMProviderUpdate,
  ): Promise<void>;
  createInstanceLlmProvider(
    id: string,
    provider: OpenClawProviderInput,
    selection: OpenClawModelSelection,
  ): Promise<void>;
  deleteInstanceLlmProvider(id: string, providerId: string): Promise<void>;
  createInstanceLlmProviderModel(
    id: string,
    providerId: string,
    model: OpenClawProviderModelInput,
  ): Promise<void>;
  updateInstanceLlmProviderModel(
    id: string,
    providerId: string,
    modelId: string,
    model: OpenClawProviderModelInput,
  ): Promise<void>;
  deleteInstanceLlmProviderModel(
    id: string,
    providerId: string,
    modelId: string,
  ): Promise<void>;
  createOpenClawAgent(id: string, agent: OpenClawAgentInput): Promise<void>;
  updateOpenClawAgent(id: string, agent: OpenClawAgentInput): Promise<void>;
  deleteOpenClawAgent(id: string, agentId: string): Promise<void>;
  saveOpenClawChannelConfig(
    id: string,
    channelId: string,
    values: Record<string, string>,
  ): Promise<void>;
  saveOpenClawWebSearchConfig(
    id: string,
    input: Omit<SaveOpenClawWebSearchConfigurationInput, 'configFile'>,
  ): Promise<void>;
  saveOpenClawXSearchConfig(
    id: string,
    input: Omit<SaveOpenClawXSearchConfigurationInput, 'configFile'>,
  ): Promise<void>;
  saveOpenClawWebSearchNativeCodexConfig(
    id: string,
    input: Omit<SaveOpenClawWebSearchNativeCodexConfigurationInput, 'configFile'>,
  ): Promise<void>;
  saveOpenClawWebFetchConfig(
    id: string,
    input: Omit<SaveOpenClawWebFetchConfigurationInput, 'configFile'>,
  ): Promise<void>;
  saveOpenClawAuthCooldownsConfig(
    id: string,
    input: Omit<SaveOpenClawAuthCooldownsConfigurationInput, 'configFile'>,
  ): Promise<void>;
  saveOpenClawDreamingConfig(
    id: string,
    input: Omit<SaveOpenClawDreamingConfigurationInput, 'configFile'>,
  ): Promise<void>;
  setOpenClawChannelEnabled(id: string, channelId: string, enabled: boolean): Promise<void>;
}

class InstanceService implements IInstanceService {
  private readonly dependencies: InstanceServiceDependencies;

  constructor(dependencies: InstanceServiceDependencies) {
    this.dependencies = dependencies;
  }

  private async assertOpenClawConfigDocumentAvailable(configPath: string) {
    const getConfigDocumentPathInfo =
      this.dependencies.openClawConfigDocumentApi.getConfigDocumentPathInfo;
    if (!getConfigDocumentPathInfo) {
      return;
    }

    const pathInfo = await getConfigDocumentPathInfo(configPath).catch(() => null);
    if (!pathInfo) {
      return;
    }

    if (!pathInfo.exists || pathInfo.kind !== 'file') {
      throw new Error(
        'The attached OpenClaw config file is no longer available on disk. Re-scan or reattach the instance configuration.',
      );
    }
  }

  private async resolveOpenClawConfigBinding(
    id: string,
    detail?: StudioInstanceDetailRecord | null,
    options: {
      requireWritable?: boolean;
    } = {},
  ) {
    const requireWritable = options.requireWritable ?? true;
    const resolvedDetail =
      detail === undefined
        ? await this.dependencies.studioApi.getInstanceDetail(id).catch(() => null)
        : detail;
    if (
      !resolvedDetail ||
      resolvedDetail.instance.runtimeKind !== 'openclaw' ||
      (requireWritable && !resolvedDetail.lifecycle.configWritable)
    ) {
      return null;
    }

    const configPath = resolveKernelConfigPathWithFallback(
      this.dependencies.kernelConfigAttachmentApi,
      resolvedDetail,
    );
    if (!configPath) {
      return null;
    }

    return {
      detail: resolvedDetail,
      configPath,
      configFile: configPath,
    };
  }

  private async assertLifecycleControlSupported(id: string) {
    const detail = await this.dependencies.studioApi.getInstanceDetail(id).catch(() => null);
    if (detail && detail.lifecycle.startStopSupported === false) {
      throw new Error('This instance does not support lifecycle control.');
    }

    return detail;
  }

  private async assertDeleteSupported(id: string) {
    const detail = await this.dependencies.studioApi.getInstanceDetail(id).catch(() => null);
    if (detail?.instance.isBuiltIn === true) {
      throw createBuiltInInstanceDeleteError();
    }

    if (detail) {
      return detail;
    }

    const instance = await this.dependencies.studioApi.getInstance(id).catch(() => null);
    if (instance?.isBuiltIn === true) {
      throw createBuiltInInstanceDeleteError();
    }

    return null;
  }

  private async saveOpenClawConfigWithGateway(
    id: string,
    configBinding: {
      detail: StudioInstanceDetailRecord;
      configPath: string;
      configFile: string;
    },
    buildNextRaw: (currentRaw: string) => string,
  ) {
    return this.withOpenClawGatewayProbe(
      configBinding.detail,
      async () => {
        const snapshot = await this.dependencies.openClawGatewayClient.getConfig(id);
        const currentRoot =
          snapshot.config && typeof snapshot.config === 'object' && !Array.isArray(snapshot.config)
            ? snapshot.config
            : {};
        const result = await this.dependencies.openClawGatewayClient.setConfig(id, {
          raw: buildNextRaw(serializeOpenClawConfigDocument(currentRoot)),
          baseHash: snapshot.baseHash,
        });
        if (result.ok === false) {
          throw new Error(result.error?.trim() || 'Failed to save openclaw.json.');
        }

        return true;
      },
      () => false,
    );
  }

  private async withOpenClawGatewayProbe<TResult>(
    detail: StudioInstanceDetailRecord,
    run: () => Promise<TResult>,
    fallback: () => TResult,
  ): Promise<TResult> {
    if (!shouldProbeOpenClawGateway(detail)) {
      return fallback();
    }

    const optimisticProbe = !hasReadyOpenClawGateway(detail);
    try {
      return await run();
    } catch (error) {
      if (optimisticProbe) {
        return fallback();
      }

      throw error;
    }
  }

  async getList(params: ListParams = {}): Promise<PaginatedResult<Instance>> {
    const instances = await this.getInstances();

    let filtered = instances;
    if (params.keyword) {
      const lowerKeyword = params.keyword.toLowerCase();
      filtered = filtered.filter(
        (instance) =>
          instance.name.toLowerCase().includes(lowerKeyword) ||
          instance.type.toLowerCase().includes(lowerKeyword),
      );
    }

    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return {
      items,
      total,
      page,
      pageSize,
      hasMore: start + pageSize < total,
    };
  }

  async getById(id: string): Promise<Instance | null> {
    const instance = await this.getInstanceById(id);
    return instance || null;
  }

  async create(data: CreateInstanceDTO): Promise<Instance> {
    const created = await this.dependencies.studioApi.createInstance(mapCreateInput(data));
    return mapStudioInstance(created);
  }

  async update(id: string, data: UpdateInstanceDTO): Promise<Instance> {
    const updated = await this.dependencies.studioApi.updateInstance(id, mapUpdateInput(data));
    return mapStudioInstance(updated);
  }

  async delete(id: string): Promise<boolean> {
    await this.deleteInstance(id);
    return true;
  }

  async getInstances(): Promise<Instance[]> {
    const instances = await this.dependencies.studioApi.listInstances();
    return instances.map((instance) => mapStudioInstance(instance));
  }

  async getInstanceById(id: string): Promise<Instance | undefined> {
    const instance = await this.dependencies.studioApi.getInstance(id);
    return instance ? mapStudioInstance(instance) : undefined;
  }

  async getInstanceDetail(id: string): Promise<StudioInstanceDetailRecord | null> {
    return this.dependencies.studioApi.getInstanceDetail(id).catch(() => null);
  }

  async startInstance(id: string): Promise<void> {
    await this.assertLifecycleControlSupported(id);
    const updated = await this.dependencies.studioApi.startInstance(id);
    if (!updated) {
      throw new Error('Failed to start instance');
    }
  }

  async stopInstance(id: string): Promise<void> {
    await this.assertLifecycleControlSupported(id);
    const updated = await this.dependencies.studioApi.stopInstance(id);
    if (!updated) {
      throw new Error('Failed to stop instance');
    }
  }

  async restartInstance(id: string): Promise<void> {
    await this.assertLifecycleControlSupported(id);
    const updated = await this.dependencies.studioApi.restartInstance(id);
    if (!updated) {
      throw new Error('Failed to restart instance');
    }
  }

  async getInstanceConfig(id: string): Promise<InstanceConfig | undefined> {
    const config = await this.dependencies.studioApi.getInstanceConfig(id);
    if (!config) {
      return undefined;
    }

    return {
      port: config.port,
      sandbox: config.sandbox,
      autoUpdate: config.autoUpdate,
      logLevel: config.logLevel,
      corsOrigins: config.corsOrigins,
    };
  }

  async updateInstanceConfig(id: string, config: InstanceConfig): Promise<void> {
    const current = await this.dependencies.studioApi.getInstanceConfig(id);
    const updated = await this.dependencies.studioApi.updateInstanceConfig(id, {
      ...(current || {
        port: config.port,
        sandbox: config.sandbox,
        autoUpdate: config.autoUpdate,
        logLevel: config.logLevel,
        corsOrigins: config.corsOrigins,
      }),
      port: config.port,
      sandbox: config.sandbox,
      autoUpdate: config.autoUpdate,
      logLevel: config.logLevel,
      corsOrigins: config.corsOrigins,
    });
    if (!updated) {
      throw new Error('Failed to update instance config');
    }
  }

  async getInstanceToken(id: string): Promise<string | undefined> {
    const config = await this.dependencies.studioApi.getInstanceConfig(id);
    return config?.authToken || undefined;
  }

  async deleteInstance(id: string): Promise<void> {
    await this.assertDeleteSupported(id);
    const deleted = await this.dependencies.studioApi.deleteInstance(id);
    if (!deleted) {
      throw new Error('Failed to delete instance');
    }
  }

  async getInstanceLogs(id: string): Promise<string> {
    return this.dependencies.studioApi.getInstanceLogs(id);
  }

  async getOpenClawConfigDocument(id: string): Promise<string> {
    const configBinding = await this.resolveOpenClawConfigBinding(id, undefined, {
      requireWritable: false,
    });

    if (!configBinding) {
      throw new Error('The selected instance does not expose an attached OpenClaw config file.');
    }

    const snapshot = await this.withOpenClawGatewayProbe(
      configBinding.detail,
      () => this.dependencies.openClawGatewayClient.getConfig(id),
      () => null,
    );

    if (snapshot) {
      const root =
        snapshot.config && typeof snapshot.config === 'object' && !Array.isArray(snapshot.config)
          ? snapshot.config
          : {};
      return serializeOpenClawConfigDocument(root);
    }

    await this.assertOpenClawConfigDocumentAvailable(configBinding.configPath);
    return this.dependencies.openClawConfigDocumentApi.readConfigDocument(
      configBinding.configFile,
    );
  }

  async updateOpenClawConfigDocument(id: string, raw: string): Promise<void> {
    const configBinding = await this.resolveOpenClawConfigBinding(id, undefined, {
      requireWritable: true,
    });

    if (!configBinding) {
      throw new Error('The selected instance does not expose a writable OpenClaw config file.');
    }

    const updatedThroughGateway = await this.withOpenClawGatewayProbe(
      configBinding.detail,
      async () => {
        const snapshot = await this.dependencies.openClawGatewayClient.getConfig(id);
        const result = await this.dependencies.openClawGatewayClient.setConfig(id, {
          raw,
          baseHash: snapshot.baseHash,
        });
        if (result.ok === false) {
          throw new Error(result.error?.trim() || 'Failed to save openclaw.json.');
        }

        return true;
      },
      () => false,
    );

    if (updatedThroughGateway) {
      return;
    }

    await this.assertOpenClawConfigDocumentAvailable(configBinding.configPath);
    await this.dependencies.openClawConfigDocumentApi.writeConfigDocument(
      configBinding.configFile,
      raw,
    );
  }

  async getOpenClawConfigSchema(id: string): Promise<OpenClawConfigSchemaSnapshot> {
    const detail = await this.dependencies.studioApi.getInstanceDetail(id).catch(() => null);
    const configBinding = await this.resolveOpenClawConfigBinding(id, detail, {
      requireWritable: false,
    });

    if (!configBinding) {
      throw new Error('The selected instance does not expose an attached OpenClaw config file.');
    }

    const snapshot = await this.withOpenClawGatewayProbe(
      configBinding.detail,
      () => this.dependencies.openClawGatewayClient.getConfigSchema(id),
      () => null,
    );

    if (!snapshot) {
      return {
        schema: null,
        uiHints: {},
        version: null,
        generatedAt: null,
      };
    }

    return {
      schema: snapshot?.schema ?? null,
      uiHints: snapshot?.uiHints ?? {},
      version: snapshot?.version ?? null,
      generatedAt: snapshot?.generatedAt ?? null,
    };
  }

  async openClawConfigFile(id: string): Promise<string | null> {
    const detail = await this.dependencies.studioApi.getInstanceDetail(id).catch(() => null);
    const configBinding = await this.resolveOpenClawConfigBinding(id, detail, {
      requireWritable: false,
    });

    if (!configBinding) {
      throw new Error('The selected instance does not expose an attached OpenClaw config file.');
    }

    const openedPath = await this.withOpenClawGatewayProbe(
      configBinding.detail,
      async () => {
        const result = await this.dependencies.openClawGatewayClient.openConfigFile(id);
        if (result?.ok === false) {
          throw new Error(result.error || 'Failed to open the attached OpenClaw config file.');
        }

        return result?.path || configBinding.configPath;
      },
      () => null,
    );

    if (!openedPath) {
      await this.assertOpenClawConfigDocumentAvailable(configBinding.configPath);
    }

    return openedPath || configBinding.configPath;
  }

  async applyOpenClawConfigDocument(id: string, raw: string): Promise<void> {
    const detail = await this.dependencies.studioApi.getInstanceDetail(id).catch(() => null);
    const configBinding = await this.resolveOpenClawConfigBinding(id, detail, {
      requireWritable: true,
    });

    if (!configBinding) {
      throw new Error('The selected instance does not expose a writable OpenClaw config file.');
    }

    if (!shouldProbeOpenClawGateway(configBinding.detail)) {
      throw new Error('The selected OpenClaw gateway is offline. Start the instance before applying config changes.');
    }

    const applied = await this.withOpenClawGatewayProbe(
      configBinding.detail,
      async () => {
        const snapshot = await this.dependencies.openClawGatewayClient.getConfig(id);
        const result = await this.dependencies.openClawGatewayClient.applyConfig(id, {
          raw,
          baseHash: snapshot?.baseHash,
        });

        if (result?.ok === false) {
          throw new Error(result.error || 'Failed to apply the OpenClaw config document.');
        }

        return true;
      },
      () => false,
    );

    if (!applied) {
      throw new Error('The selected OpenClaw gateway is offline. Start the instance before applying config changes.');
    }
  }

  async runOpenClawUpdate(id: string): Promise<void> {
    const detail = await this.dependencies.studioApi.getInstanceDetail(id).catch(() => null);
    const configBinding = await this.resolveOpenClawConfigBinding(id, detail, {
      requireWritable: false,
    });

    if (!configBinding) {
      throw new Error('The selected instance does not expose an attached OpenClaw config file.');
    }

    if (!shouldProbeOpenClawGateway(configBinding.detail)) {
      throw new Error('The selected OpenClaw gateway is offline. Start the instance before running updates.');
    }

    const started = await this.withOpenClawGatewayProbe(
      configBinding.detail,
      async () => {
        const result = await this.dependencies.openClawGatewayClient.runUpdate(id);
        if (result?.ok === false) {
          throw new Error(result.error || 'Failed to start the OpenClaw update.');
        }

        return true;
      },
      () => false,
    );

    if (!started) {
      throw new Error('The selected OpenClaw gateway is offline. Start the instance before running updates.');
    }
  }

  async getInstanceFileContent(id: string, fileId: string): Promise<string> {
    const detail = await this.dependencies.studioApi.getInstanceDetail(id).catch(() => null);
    const normalizedFileId = normalizeOpenClawAgentFileId(fileId);
    const workbenchFile = findWorkbenchFileById(detail, normalizedFileId);
    if (workbenchFile && (!isOpenClawDetail(detail) || isBuiltInOpenClawDetail(detail))) {
      return workbenchFile.content;
    }

    if (isOpenClawDetail(detail)) {
      const target = parseOpenClawAgentFileId(normalizedFileId);
      if (!target) {
        return workbenchFile?.content || '';
      }

      const fetched = await this.dependencies.openClawGatewayClient.getAgentFile(id, {
        agentId: target.agentId,
        name: target.name,
      });
      return typeof fetched.file?.content === 'string' ? fetched.file.content : '';
    }

    if (detail) {
      return workbenchFile?.content || '';
    }

    throw new Error('The selected file is not available because instance detail is unavailable.');
  }

  async updateInstanceFileContent(id: string, fileId: string, content: string): Promise<void> {
    const detail = await this.dependencies.studioApi.getInstanceDetail(id).catch(() => null);
    const normalizedFileId = normalizeOpenClawAgentFileId(fileId);

    if (shouldUseStudioBridgeForFileContent(detail, normalizedFileId)) {
      const updated = await this.dependencies.studioApi.updateInstanceFileContent(
        id,
        normalizedFileId,
        content,
      );
      if (!updated) {
        throw new Error('Failed to update instance file');
      }
      return;
    }

    if (isOpenClawDetail(detail)) {
      const target = parseOpenClawAgentFileId(normalizedFileId);
      if (!target) {
        throw new Error('The selected OpenClaw file is not writable through the gateway.');
      }

      await this.dependencies.openClawGatewayClient.setAgentFile(id, {
        agentId: target.agentId,
        name: target.name,
        content,
      });
      return;
    }

    if (detail) {
      throw new Error('The selected file is not writable through the studio backend.');
    }

    throw new Error('The selected file is not writable because instance detail is unavailable.');
  }

  async updateInstanceLlmProviderConfig(
    id: string,
    providerId: string,
    update: InstanceLLMProviderUpdate,
  ): Promise<void> {
    const detail = await this.dependencies.studioApi.getInstanceDetail(id).catch(() => null);

    if (isProviderCenterControlledOpenClawDetail(detail)) {
      throw createProviderCenterControlledOpenClawProviderError();
    }

    if (shouldUseStudioBridgeForProviderConfig(detail, providerId)) {
      const updated = await this.dependencies.studioApi.updateInstanceLlmProviderConfig(
        id,
        providerId,
        update,
      );
      if (!updated) {
        throw new Error('Failed to update LLM provider config');
      }
      return;
    }

    const configBinding = await this.resolveOpenClawConfigBinding(id, detail);
    if (configBinding) {
      throw createProviderCenterControlledOpenClawProviderError();
    }

    if (isOpenClawDetail(detail)) {
      const snapshot = await this.dependencies.openClawGatewayClient.getConfig(id);
      const patch = buildRemoteOpenClawProviderConfigPatch(
        snapshot.config,
        providerId,
        update,
      );

      const result = await this.dependencies.openClawGatewayClient.patchConfig(id, {
        raw: JSON.stringify(patch, null, 2),
        baseHash: snapshot.baseHash,
      });
      if (result.ok === false) {
        throw new Error('Failed to update LLM provider config');
      }
      return;
    }

    if (detail) {
      throw new Error('The selected provider is not writable through the studio backend.');
    }

    throw new Error(
      'The selected provider is not writable because instance detail is unavailable.',
    );
  }

  async createInstanceLlmProvider(
    id: string,
    provider: OpenClawProviderInput,
    selection: OpenClawModelSelection,
  ): Promise<void> {
    const detail = await this.dependencies.studioApi.getInstanceDetail(id).catch(() => null);
    if (isProviderCenterControlledOpenClawDetail(detail)) {
      throw createProviderCenterControlledOpenClawProviderError();
    }

    const configBinding = await this.resolveOpenClawConfigBinding(id, detail);
    if (!configBinding) {
      throw new Error('Writable OpenClaw config file is not available for this instance.');
    }

    void provider;
    void selection;
    throw createProviderCenterControlledOpenClawProviderError();
  }

  async deleteInstanceLlmProvider(id: string, providerId: string): Promise<void> {
    const detail = await this.dependencies.studioApi.getInstanceDetail(id).catch(() => null);
    if (isProviderCenterControlledOpenClawDetail(detail)) {
      throw createProviderCenterControlledOpenClawProviderError();
    }

    const configBinding = await this.resolveOpenClawConfigBinding(id, detail);
    if (!configBinding) {
      throw new Error('Writable OpenClaw config file is not available for this instance.');
    }

    void providerId;
    throw createProviderCenterControlledOpenClawProviderError();
  }

  async createInstanceLlmProviderModel(
    id: string,
    providerId: string,
    model: OpenClawProviderModelInput,
  ): Promise<void> {
    const detail = await this.dependencies.studioApi.getInstanceDetail(id).catch(() => null);
    if (isProviderCenterControlledOpenClawDetail(detail)) {
      throw createProviderCenterControlledOpenClawProviderError();
    }

    const configBinding = await this.resolveOpenClawConfigBinding(id, detail);
    if (!configBinding) {
      throw new Error('Writable OpenClaw config file is not available for this instance.');
    }

    void providerId;
    void model;
    throw createProviderCenterControlledOpenClawProviderError();
  }

  async updateInstanceLlmProviderModel(
    id: string,
    providerId: string,
    modelId: string,
    model: OpenClawProviderModelInput,
  ): Promise<void> {
    const detail = await this.dependencies.studioApi.getInstanceDetail(id).catch(() => null);
    if (isProviderCenterControlledOpenClawDetail(detail)) {
      throw createProviderCenterControlledOpenClawProviderError();
    }

    const configBinding = await this.resolveOpenClawConfigBinding(id, detail);
    if (!configBinding) {
      throw new Error('Writable OpenClaw config file is not available for this instance.');
    }

    void providerId;
    void modelId;
    void model;
    throw createProviderCenterControlledOpenClawProviderError();
  }

  async deleteInstanceLlmProviderModel(
    id: string,
    providerId: string,
    modelId: string,
  ): Promise<void> {
    const detail = await this.dependencies.studioApi.getInstanceDetail(id).catch(() => null);
    if (isProviderCenterControlledOpenClawDetail(detail)) {
      throw createProviderCenterControlledOpenClawProviderError();
    }

    const configBinding = await this.resolveOpenClawConfigBinding(id, detail);
    if (!configBinding) {
      throw new Error('Writable OpenClaw config file is not available for this instance.');
    }

    void providerId;
    void modelId;
    throw createProviderCenterControlledOpenClawProviderError();
  }

  async createOpenClawAgent(id: string, agent: OpenClawAgentInput): Promise<void> {
    const configBinding = await this.resolveOpenClawConfigBinding(id);
    if (!configBinding) {
      throw new Error('Writable OpenClaw config file is not available for this instance.');
    }

    if (
      await this.saveOpenClawConfigWithGateway(id, configBinding, (currentRaw) =>
        saveOpenClawAgentInConfigDocument(currentRaw, agent),
      )
    ) {
      return;
    }

    await this.dependencies.openClawConfigDocumentApi.saveAgent({
      configFile: configBinding.configPath,
      agent,
    });
  }

  async updateOpenClawAgent(id: string, agent: OpenClawAgentInput): Promise<void> {
    const configBinding = await this.resolveOpenClawConfigBinding(id);
    if (!configBinding) {
      throw new Error('Writable OpenClaw config file is not available for this instance.');
    }

    if (
      await this.saveOpenClawConfigWithGateway(id, configBinding, (currentRaw) =>
        saveOpenClawAgentInConfigDocument(currentRaw, agent),
      )
    ) {
      return;
    }

    await this.dependencies.openClawConfigDocumentApi.saveAgent({
      configFile: configBinding.configPath,
      agent,
    });
  }

  async deleteOpenClawAgent(id: string, agentId: string): Promise<void> {
    const configBinding = await this.resolveOpenClawConfigBinding(id);
    if (!configBinding) {
      throw new Error('Writable OpenClaw config file is not available for this instance.');
    }

    if (
      await this.saveOpenClawConfigWithGateway(id, configBinding, (currentRaw) =>
        deleteOpenClawAgentFromConfigDocument(currentRaw, agentId),
      )
    ) {
      return;
    }

    await this.dependencies.openClawConfigDocumentApi.deleteAgent({
      configFile: configBinding.configPath,
      agentId,
    });
  }

  async saveOpenClawChannelConfig(
    id: string,
    channelId: string,
    values: Record<string, string>,
  ): Promise<void> {
    const configBinding = await this.resolveOpenClawConfigBinding(id);
    if (!configBinding) {
      throw new Error('Writable OpenClaw config file is not available for this instance.');
    }

    if (
      await this.saveOpenClawConfigWithGateway(id, configBinding, (currentRaw) =>
        saveOpenClawChannelConfigInDocument(currentRaw, {
          channelId,
          values,
          enabled: true,
        }),
      )
    ) {
      return;
    }

    await this.dependencies.openClawConfigDocumentApi.saveChannelConfiguration({
      configFile: configBinding.configPath,
      channelId,
      values,
      enabled: true,
    });
  }

  async saveOpenClawWebSearchConfig(
    id: string,
    input: Omit<SaveOpenClawWebSearchConfigurationInput, 'configFile'>,
  ): Promise<void> {
    const configBinding = await this.resolveOpenClawConfigBinding(id);
    if (!configBinding) {
      throw new Error('Writable OpenClaw config file is not available for this instance.');
    }

    if (
      await this.saveOpenClawConfigWithGateway(id, configBinding, (currentRaw) =>
        saveOpenClawWebSearchConfigInDocument(currentRaw, input),
      )
    ) {
      return;
    }

    await this.dependencies.openClawConfigDocumentApi.saveWebSearchConfiguration({
      configFile: configBinding.configPath,
      ...input,
    });
  }

  async saveOpenClawXSearchConfig(
    id: string,
    input: Omit<SaveOpenClawXSearchConfigurationInput, 'configFile'>,
  ): Promise<void> {
    const configBinding = await this.resolveOpenClawConfigBinding(id);
    if (!configBinding) {
      throw new Error('Writable OpenClaw config file is not available for this instance.');
    }

    if (
      await this.saveOpenClawConfigWithGateway(id, configBinding, (currentRaw) =>
        saveOpenClawXSearchConfigInDocument(currentRaw, input),
      )
    ) {
      return;
    }

    await this.dependencies.openClawConfigDocumentApi.saveXSearchConfiguration({
      configFile: configBinding.configPath,
      ...input,
    });
  }

  async saveOpenClawWebSearchNativeCodexConfig(
    id: string,
    input: Omit<SaveOpenClawWebSearchNativeCodexConfigurationInput, 'configFile'>,
  ): Promise<void> {
    const configBinding = await this.resolveOpenClawConfigBinding(id);
    if (!configBinding) {
      throw new Error('Writable OpenClaw config file is not available for this instance.');
    }

    if (
      await this.saveOpenClawConfigWithGateway(id, configBinding, (currentRaw) =>
        saveOpenClawWebSearchNativeCodexConfigInDocument(currentRaw, input),
      )
    ) {
      return;
    }

    await this.dependencies.openClawConfigDocumentApi.saveWebSearchNativeCodexConfiguration({
      configFile: configBinding.configPath,
      ...input,
    });
  }

  async saveOpenClawWebFetchConfig(
    id: string,
    input: Omit<SaveOpenClawWebFetchConfigurationInput, 'configFile'>,
  ): Promise<void> {
    const configBinding = await this.resolveOpenClawConfigBinding(id);
    if (!configBinding) {
      throw new Error('Writable OpenClaw config file is not available for this instance.');
    }

    if (
      await this.saveOpenClawConfigWithGateway(id, configBinding, (currentRaw) =>
        saveOpenClawWebFetchConfigInDocument(currentRaw, input),
      )
    ) {
      return;
    }

    await this.dependencies.openClawConfigDocumentApi.saveWebFetchConfiguration({
      configFile: configBinding.configPath,
      ...input,
    });
  }

  async saveOpenClawAuthCooldownsConfig(
    id: string,
    input: Omit<SaveOpenClawAuthCooldownsConfigurationInput, 'configFile'>,
  ): Promise<void> {
    const configBinding = await this.resolveOpenClawConfigBinding(id);
    if (!configBinding) {
      throw new Error('Writable OpenClaw config file is not available for this instance.');
    }

    if (
      await this.saveOpenClawConfigWithGateway(id, configBinding, (currentRaw) =>
        saveOpenClawAuthCooldownsConfigInDocument(currentRaw, input),
      )
    ) {
      return;
    }

    await this.dependencies.openClawConfigDocumentApi.saveAuthCooldownsConfiguration({
      configFile: configBinding.configPath,
      ...input,
    });
  }

  async saveOpenClawDreamingConfig(
    id: string,
    input: Omit<SaveOpenClawDreamingConfigurationInput, 'configFile'>,
  ): Promise<void> {
    const configBinding = await this.resolveOpenClawConfigBinding(id);
    if (!configBinding) {
      throw new Error('Writable OpenClaw config file is not available for this instance.');
    }

    if (
      await this.saveOpenClawConfigWithGateway(id, configBinding, (currentRaw) =>
        saveOpenClawDreamingConfigInDocument(currentRaw, input),
      )
    ) {
      return;
    }

    await this.dependencies.openClawConfigDocumentApi.saveDreamingConfiguration({
      configFile: configBinding.configPath,
      ...input,
    });
  }

  async setOpenClawChannelEnabled(
    id: string,
    channelId: string,
    enabled: boolean,
  ): Promise<void> {
    const configBinding = await this.resolveOpenClawConfigBinding(id);
    if (!configBinding) {
      throw new Error('Writable OpenClaw config file is not available for this instance.');
    }

    if (
      await this.saveOpenClawConfigWithGateway(id, configBinding, (currentRaw) =>
        setOpenClawChannelEnabledInDocument(currentRaw, {
          channelId,
          enabled,
        }),
      )
    ) {
      return;
    }

    await this.dependencies.openClawConfigDocumentApi.setChannelEnabled({
      configFile: configBinding.configPath,
      channelId,
      enabled,
    });
  }
}

export function createInstanceService(
  overrides: InstanceServiceDependencyOverrides = {},
) {
  const defaults = createDefaultDependencies();

  return new InstanceService({
    studioApi: {
      ...defaults.studioApi,
      ...(overrides.studioApi || {}),
    },
    openClawGatewayClient: {
      ...defaults.openClawGatewayClient,
      ...(overrides.openClawGatewayClient || {}),
    },
    kernelConfigAttachmentApi: {
      ...defaults.kernelConfigAttachmentApi,
      ...(overrides.kernelConfigAttachmentApi || {}),
    },
    openClawConfigDocumentApi: {
      ...defaults.openClawConfigDocumentApi,
      ...(overrides.openClawConfigDocumentApi || {}),
    },
  });
}

export { buildOpenClawAgentFileId };
