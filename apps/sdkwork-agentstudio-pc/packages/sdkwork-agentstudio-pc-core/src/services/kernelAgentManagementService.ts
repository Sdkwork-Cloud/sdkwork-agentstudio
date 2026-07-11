import {
  getStudioPlatform,
  invalidateStudioPlatformCaches,
  openClawGatewayClient,
  type OpenClawConfigSnapshot,
  type StudioCreatedKernelAgentRecord,
  type StudioCreateKernelAgentInput,
  type StudioKernelAgentCreationCapability,
  type StudioKernelAgentCreationFieldSupport,
  type StudioKernelAgentCreationKernelOption,
  type StudioKernelAgentCreationModelOption,
  type StudioKernelAgentCreationReasonCode,
} from '@sdkwork/agentstudio-pc-infrastructure';
import type {
  StudioInstanceDetailRecord,
  StudioWorkbenchLLMProviderRecord,
} from '@sdkwork/agentstudio-pc-types';
import {
  normalizeLocalApiProxyLegacyProviderId,
  normalizeLocalApiProxyLegacyProviderModelRef,
} from '@sdkwork/local-api-proxy';
import {
  openClawConfigService,
  saveOpenClawAgentInConfigDocument,
  serializeOpenClawConfigDocument,
  type OpenClawAgentInput,
} from './openClawConfigService.ts';
import { normalizeOpenClawAgentId } from './openClawAgentDocumentService.ts';
import {
  resolveAttachedKernelConfig,
  resolveAttachedKernelConfigFile,
} from './kernelConfigAttachmentService.ts';
import {
  resolveOpenClawAgentPathsFromConfigRoot,
  type OpenClawResolvedAgentPaths,
} from './openClawAgentSnapshotService.ts';

export type KernelAgentCreationReasonCode = StudioKernelAgentCreationReasonCode;
export type KernelAgentCreationFieldSupport = StudioKernelAgentCreationFieldSupport;
export type KernelAgentCreationKernelOption = StudioKernelAgentCreationKernelOption;
export type KernelAgentCreationModelOption = StudioKernelAgentCreationModelOption;
export type KernelAgentCreationCapability = StudioKernelAgentCreationCapability;
export type CreateKernelAgentRequest = StudioCreateKernelAgentInput;
export type CreateKernelAgentResult = StudioCreatedKernelAgentRecord;

const OPENCLAW_KERNEL_AGENT_CREATION_FIELD_SUPPORT: KernelAgentCreationFieldSupport = {
  avatar: true,
  isDefault: true,
  primaryModel: true,
  fallbackModels: true,
  workspace: false,
  agentDir: false,
  temperature: true,
  topP: true,
  maxTokens: true,
  timeoutMs: true,
  streaming: true,
};

const UNSUPPORTED_KERNEL_AGENT_CREATION_FIELD_SUPPORT: KernelAgentCreationFieldSupport = {
  avatar: false,
  isDefault: false,
  primaryModel: false,
  fallbackModels: false,
  workspace: false,
  agentDir: false,
  temperature: false,
  topP: false,
  maxTokens: false,
  timeoutMs: false,
  streaming: false,
};

class KernelAgentCapabilityContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KernelAgentCapabilityContractError';
  }
}

function isKernelAgentCapabilityContractError(error: unknown) {
  return error instanceof KernelAgentCapabilityContractError;
}

interface KernelAgentCreationProvider {
  kernelId: string;
  listKernelOptions(
    detail: StudioInstanceDetailRecord,
  ): Promise<KernelAgentCreationKernelOption[]>;
  createAgent(
    detail: StudioInstanceDetailRecord,
    request: CreateKernelAgentRequest,
  ): Promise<CreateKernelAgentResult>;
}

function normalizeOptionalString(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return value ?? null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function normalizeKernelId(value: string | null | undefined) {
  return normalizeOptionalString(value)?.toLowerCase() ?? null;
}

function normalizeRequiredString(value: string | null | undefined, fieldName: string) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    throw new Error(`Kernel agent field "${fieldName}" must not be empty.`);
  }
  return normalized;
}

function resolveErrorMessage(error: unknown, fallbackMessage: string) {
  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.trim()
  ) {
    return error.message.trim();
  }

  return fallbackMessage;
}

function titleizeIdentifier(value: string) {
  return value
    .split(/[-_.]/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function resolveKernelLabel(kernelId: string) {
  const normalizedKernelId = normalizeKernelId(kernelId);
  if (!normalizedKernelId) {
    throw new Error('Kernel agent field "kernelId" must not be empty.');
  }

  const knownLabels: Record<string, string> = {
    openclaw: 'OpenClaw',
    hermes: 'Hermes',
    zeroclaw: 'ZeroClaw',
    ironclaw: 'IronClaw',
  };

  return knownLabels[normalizedKernelId] ?? titleizeIdentifier(normalizedKernelId);
}

function exposesOpenClawGatewayTransport(
  detail: StudioInstanceDetailRecord | null | undefined,
) {
  const transports = [
    detail?.connectivity?.primaryTransport,
    detail?.instance.transportKind,
  ];

  return transports.some(
    (transport) => normalizeOptionalString(transport)?.toLowerCase() === 'openclawgatewayws',
  );
}

function isGenericKernelId(kernelId: string | null) {
  return kernelId === 'custom' || kernelId === 'unknown';
}

function collectDeclaredKernelIds(detail: StudioInstanceDetailRecord) {
  const orderedKernelIds: string[] = [];
  const pushKernelId = (value: string | null | undefined, allowGeneric = false) => {
    const normalizedKernelId = normalizeKernelId(value);
    if (!normalizedKernelId) {
      return;
    }

    if (!allowGeneric && isGenericKernelId(normalizedKernelId)) {
      return;
    }

    if (!orderedKernelIds.includes(normalizedKernelId)) {
      orderedKernelIds.push(normalizedKernelId);
    }
  };

  const attachedKernelConfig = resolveAttachedKernelConfig(detail);

  pushKernelId(detail.instance.runtimeKind);
  pushKernelId(attachedKernelConfig?.kernelId);
  pushKernelId(attachedKernelConfig?.runtimeKind);

  if (exposesOpenClawGatewayTransport(detail)) {
    pushKernelId('openclaw');
  }

  if (orderedKernelIds.length === 0) {
    pushKernelId(detail.instance.runtimeKind, true);
  }

  return orderedKernelIds;
}

function buildKernelAgentModelOptions(
  llmProviders: StudioWorkbenchLLMProviderRecord[] | null | undefined,
): KernelAgentCreationModelOption[] {
  const options = new Map<string, KernelAgentCreationModelOption>();

  for (const provider of llmProviders ?? []) {
    const providerId = normalizeLocalApiProxyLegacyProviderId(provider.id);
    const providerLabel = normalizeOptionalString(provider.name) ?? providerId;
    if (!providerId || !providerLabel) {
      continue;
    }

    for (const model of provider.models) {
      const modelId = normalizeOptionalString(model.id);
      if (!modelId) {
        continue;
      }

      const normalizedModelRef = normalizeLocalApiProxyLegacyProviderModelRef(modelId);
      const value = normalizedModelRef.includes('/')
        ? normalizedModelRef
        : `${providerId}/${normalizedModelRef}`;

      if (options.has(value)) {
        continue;
      }

      options.set(value, {
        value,
        label: `${providerLabel} / ${normalizeOptionalString(model.name) ?? modelId}`,
        providerId,
        providerLabel,
      });
    }
  }

  return [...options.values()];
}

function normalizeKernelAgentCreationModelOption(
  option: KernelAgentCreationModelOption,
): KernelAgentCreationModelOption | null {
  const value = normalizeOptionalString(option.value);
  const providerId = normalizeOptionalString(option.providerId);
  if (!value || !providerId) {
    return null;
  }

  return {
    value,
    label: normalizeOptionalString(option.label) ?? value,
    providerId,
    providerLabel: normalizeOptionalString(option.providerLabel) ?? providerId,
  };
}

function mergeKernelAgentCreationModelOptions(
  ...collections: Array<KernelAgentCreationModelOption[] | null | undefined>
) {
  const mergedOptions = new Map<string, KernelAgentCreationModelOption>();

  for (const collection of collections) {
    for (const option of collection ?? []) {
      const normalizedOption = normalizeKernelAgentCreationModelOption(option);
      if (!normalizedOption) {
        continue;
      }

      mergedOptions.set(normalizedOption.value, normalizedOption);
    }
  }

  return [...mergedOptions.values()];
}

function normalizeKernelAgentCreationKernelOption(
  option: KernelAgentCreationKernelOption,
): KernelAgentCreationKernelOption | null {
  const kernelId = normalizeKernelId(option.kernelId);
  if (!kernelId) {
    return null;
  }

  const fieldSupport = normalizeKernelAgentCreationFieldSupportForKernel(
    kernelId,
    option.fieldSupport,
  );

  return {
    kernelId,
    label: normalizeOptionalString(option.label) ?? resolveKernelLabel(kernelId),
    supported: option.supported === true,
    reasonCode: option.reasonCode ?? null,
    reason: normalizeOptionalString(option.reason),
    modelOptions: mergeKernelAgentCreationModelOptions(option.modelOptions),
    fieldSupport,
  };
}

function normalizeKernelAgentCreationFieldSupport(
  fieldSupport: KernelAgentCreationFieldSupport | null | undefined,
): KernelAgentCreationFieldSupport {
  if (!fieldSupport) {
    throw new KernelAgentCapabilityContractError(
      'Kernel agent creation capability must declare field support for every kernel option.',
    );
  }

  return {
    avatar: fieldSupport.avatar === true,
    isDefault: fieldSupport.isDefault === true,
    primaryModel: fieldSupport.primaryModel === true,
    fallbackModels: fieldSupport.fallbackModels === true,
    workspace: fieldSupport.workspace === true,
    agentDir: fieldSupport.agentDir === true,
    temperature: fieldSupport.temperature === true,
    topP: fieldSupport.topP === true,
    maxTokens: fieldSupport.maxTokens === true,
    timeoutMs: fieldSupport.timeoutMs === true,
    streaming: fieldSupport.streaming === true,
  };
}

function normalizeKernelAgentCreationFieldSupportForKernel(
  kernelId: string,
  fieldSupport: KernelAgentCreationFieldSupport | null | undefined,
): KernelAgentCreationFieldSupport {
  const normalizedFieldSupport = normalizeKernelAgentCreationFieldSupport(fieldSupport);
  if (kernelId !== 'openclaw') {
    return normalizedFieldSupport;
  }

  return {
    ...normalizedFieldSupport,
    workspace: false,
    agentDir: false,
  };
}

function normalizeKernelAgentCreationCapability(
  capability: KernelAgentCreationCapability,
): KernelAgentCreationCapability {
  const kernelOptions = capability.kernelOptions
    .map((option) => normalizeKernelAgentCreationKernelOption(option))
    .filter((option): option is KernelAgentCreationKernelOption => Boolean(option));
  const defaultKernelId = normalizeKernelId(capability.defaultKernelId);
  const resolvedDefaultKernelId =
    (defaultKernelId &&
      kernelOptions.some((option) => option.kernelId === defaultKernelId) &&
      defaultKernelId) ||
    kernelOptions.find((option) => option.supported)?.kernelId ||
    kernelOptions[0]?.kernelId ||
    null;

  return {
    instanceId: normalizeRequiredString(capability.instanceId, 'instanceId'),
    instanceName: normalizeRequiredString(capability.instanceName, 'instanceName'),
    kernelOptions,
    defaultKernelId: resolvedDefaultKernelId,
  };
}

function mergeKernelAgentCreationKernelOption(
  current: KernelAgentCreationKernelOption,
  incoming: KernelAgentCreationKernelOption,
) {
  if (current.supported !== incoming.supported) {
    return incoming.supported ? incoming : current;
  }

  return incoming;
}

function mergeKernelAgentCreationCapabilities(
  inferredCapability: KernelAgentCreationCapability | null,
  platformCapability: KernelAgentCreationCapability | null,
): KernelAgentCreationCapability | null {
  if (!inferredCapability && !platformCapability) {
    return null;
  }

  if (!inferredCapability) {
    return platformCapability;
  }

  if (!platformCapability) {
    return inferredCapability;
  }

  const mergedKernelOptions = new Map<string, KernelAgentCreationKernelOption>();
  const orderedKernelIds: string[] = [];
  const pushKernelOption = (option: KernelAgentCreationKernelOption) => {
    const normalizedOption = normalizeKernelAgentCreationKernelOption(option);
    if (!normalizedOption) {
      return;
    }

    const normalizedKernelId = normalizedOption.kernelId;

    if (!orderedKernelIds.includes(normalizedKernelId)) {
      orderedKernelIds.push(normalizedKernelId);
      mergedKernelOptions.set(normalizedKernelId, normalizedOption);
      return;
    }

    const currentOption = mergedKernelOptions.get(normalizedKernelId);
    if (!currentOption) {
      mergedKernelOptions.set(normalizedKernelId, normalizedOption);
      return;
    }

    mergedKernelOptions.set(
      normalizedKernelId,
      mergeKernelAgentCreationKernelOption(currentOption, normalizedOption),
    );
  };

  for (const option of inferredCapability.kernelOptions) {
    pushKernelOption(option);
  }
  for (const option of platformCapability.kernelOptions) {
    pushKernelOption(option);
  }

  const mergedKernelOptionList = orderedKernelIds
    .map((kernelId) => mergedKernelOptions.get(kernelId))
    .filter((option): option is KernelAgentCreationKernelOption => Boolean(option));
  const platformDefaultKernelId = normalizeKernelId(platformCapability.defaultKernelId);
  const inferredDefaultKernelId = normalizeKernelId(inferredCapability.defaultKernelId);
  const resolveSupportedDefaultKernelId = (kernelId: string | null) =>
    kernelId &&
    mergedKernelOptionList.some(
      (option) => option.kernelId === kernelId && option.supported,
    )
      ? kernelId
      : null;
  const resolveExistingDefaultKernelId = (kernelId: string | null) =>
    kernelId && mergedKernelOptionList.some((option) => option.kernelId === kernelId)
      ? kernelId
      : null;
  const defaultKernelId =
    resolveSupportedDefaultKernelId(platformDefaultKernelId) ||
    resolveSupportedDefaultKernelId(inferredDefaultKernelId) ||
    mergedKernelOptionList.find((option) => option.supported)?.kernelId ||
    resolveExistingDefaultKernelId(platformDefaultKernelId) ||
    resolveExistingDefaultKernelId(inferredDefaultKernelId) ||
    mergedKernelOptionList[0]?.kernelId ||
    null;

  return normalizeKernelAgentCreationCapability({
    instanceId:
      normalizeOptionalString(platformCapability.instanceId) ||
      inferredCapability.instanceId,
    instanceName:
      normalizeOptionalString(platformCapability.instanceName) ||
      inferredCapability.instanceName,
    kernelOptions: mergedKernelOptionList,
    defaultKernelId,
  });
}

function normalizeCreateKernelAgentResult(
  result: CreateKernelAgentResult,
): CreateKernelAgentResult {
  const kernelId = normalizeKernelId(result.kernelId);
  if (!kernelId) {
    throw new Error('Kernel agent field "kernelId" must not be empty.');
  }

  return {
    instanceId: normalizeRequiredString(result.instanceId, 'instanceId'),
    kernelId,
    agentId: normalizeRequiredString(result.agentId, 'agentId'),
    displayName: normalizeRequiredString(result.displayName, 'displayName'),
  };
}

function normalizeFallbackModels(fallbackModels: string[] | null | undefined) {
  return Array.from(
    new Set(
      (fallbackModels ?? [])
        .map((entry) => normalizeOptionalString(entry))
        .filter((entry): entry is string => Boolean(entry)),
    ),
  );
}

function createUnsupportedKernelFieldError(kernelId: string, fieldName: string) {
  return new Error(`Kernel "${kernelId}" does not support create field "${fieldName}".`);
}

function ensureKernelFieldSupport(
  kernelId: string,
  fieldName: string,
  supported: boolean,
  hasExplicitValue: boolean,
) {
  if (!supported && hasExplicitValue) {
    throw createUnsupportedKernelFieldError(kernelId, fieldName);
  }
}

function ensureKernelModelRefIsSupported(
  kernelId: string,
  fieldName: string,
  supportedModelRefs: Set<string>,
  modelRef: string | null,
) {
  if (!modelRef || supportedModelRefs.size === 0) {
    return;
  }

  if (!supportedModelRefs.has(modelRef)) {
    throw new Error(
      `Kernel "${kernelId}" does not expose "${modelRef}" as a supported ${fieldName} option.`,
    );
  }
}

function validateCreateKernelAgentRequest(
  kernelOption: KernelAgentCreationKernelOption,
  request: CreateKernelAgentRequest,
) {
  const kernelId = kernelOption.kernelId;
  const fieldSupport = kernelOption.fieldSupport;
  const avatar = normalizeOptionalString(request.avatar);
  const primaryModel = normalizeOptionalString(request.primaryModel);
  const workspace = normalizeOptionalString(request.workspace);
  const agentDir = normalizeOptionalString(request.agentDir);
  const fallbackModels = normalizeFallbackModels(request.fallbackModels);

  ensureKernelFieldSupport(kernelId, 'avatar', fieldSupport.avatar, Boolean(avatar));
  ensureKernelFieldSupport(
    kernelId,
    'isDefault',
    fieldSupport.isDefault,
    request.isDefault === true,
  );
  ensureKernelFieldSupport(
    kernelId,
    'primaryModel',
    fieldSupport.primaryModel,
    Boolean(primaryModel),
  );
  ensureKernelFieldSupport(
    kernelId,
    'fallbackModels',
    fieldSupport.fallbackModels,
    fallbackModels.length > 0,
  );
  ensureKernelFieldSupport(
    kernelId,
    'workspace',
    fieldSupport.workspace,
    Boolean(workspace),
  );
  ensureKernelFieldSupport(
    kernelId,
    'agentDir',
    fieldSupport.agentDir,
    Boolean(agentDir),
  );
  ensureKernelFieldSupport(
    kernelId,
    'temperature',
    fieldSupport.temperature,
    typeof request.temperature === 'number' && Number.isFinite(request.temperature),
  );
  ensureKernelFieldSupport(
    kernelId,
    'topP',
    fieldSupport.topP,
    typeof request.topP === 'number' && Number.isFinite(request.topP),
  );
  ensureKernelFieldSupport(
    kernelId,
    'maxTokens',
    fieldSupport.maxTokens,
    typeof request.maxTokens === 'number' && Number.isFinite(request.maxTokens),
  );
  ensureKernelFieldSupport(
    kernelId,
    'timeoutMs',
    fieldSupport.timeoutMs,
    typeof request.timeoutMs === 'number' && Number.isFinite(request.timeoutMs),
  );
  ensureKernelFieldSupport(
    kernelId,
    'streaming',
    fieldSupport.streaming,
    typeof request.streaming === 'boolean',
  );

  const supportedModelRefs = new Set(
    kernelOption.modelOptions.map((option) => option.value),
  );
  ensureKernelModelRefIsSupported(
    kernelId,
    'primaryModel',
    supportedModelRefs,
    primaryModel,
  );
  for (const fallbackModel of fallbackModels) {
    ensureKernelModelRefIsSupported(
      kernelId,
      'fallbackModels',
      supportedModelRefs,
      fallbackModel,
    );
  }
}

function buildOpenClawAgentInput(request: CreateKernelAgentRequest): OpenClawAgentInput {
  const primaryModel = normalizeOptionalString(request.primaryModel);
  const fallbackModels = normalizeFallbackModels(request.fallbackModels);
  const params: Record<string, string | number | boolean | null | undefined> = {};

  if (typeof request.temperature === 'number' && Number.isFinite(request.temperature)) {
    params.temperature = request.temperature;
  }
  if (typeof request.topP === 'number' && Number.isFinite(request.topP)) {
    params.topP = request.topP;
  }
  if (typeof request.maxTokens === 'number' && Number.isFinite(request.maxTokens)) {
    params.maxTokens = request.maxTokens;
  }
  if (typeof request.timeoutMs === 'number' && Number.isFinite(request.timeoutMs)) {
    params.timeoutMs = request.timeoutMs;
  }
  if (typeof request.streaming === 'boolean') {
    params.streaming = request.streaming;
  }

  return {
    id: normalizeOpenClawAgentId(normalizeRequiredString(request.agentId, 'agentId')),
    name: normalizeRequiredString(request.displayName, 'displayName'),
    avatar: normalizeOptionalString(request.avatar) ?? '',
    workspace: '',
    agentDir: '',
    isDefault: request.isDefault === true,
    model:
      primaryModel || fallbackModels.length > 0
        ? {
            primary: primaryModel ?? undefined,
            fallbacks: fallbackModels,
          }
        : null,
    params,
  };
}

function isOpenClawKernelCreationCandidate(detail: StudioInstanceDetailRecord) {
  const attachedKernelConfig = resolveAttachedKernelConfig(detail);
  const declaredKernelIds = [
    normalizeKernelId(detail.instance.runtimeKind),
    normalizeKernelId(attachedKernelConfig?.kernelId),
    normalizeKernelId(attachedKernelConfig?.runtimeKind),
  ];

  return (
    declaredKernelIds.includes('openclaw') || exposesOpenClawGatewayTransport(detail)
  );
}

function resolveOpenClawCapability(
  detail: StudioInstanceDetailRecord,
): KernelAgentCreationKernelOption {
  if (exposesOpenClawGatewayTransport(detail)) {
    return {
      kernelId: 'openclaw',
      label: 'OpenClaw',
      supported: true,
      reasonCode: null,
      reason: null,
      modelOptions: buildKernelAgentModelOptions(detail.workbench?.llmProviders),
      fieldSupport: OPENCLAW_KERNEL_AGENT_CREATION_FIELD_SUPPORT,
    };
  }

  const configFile = resolveAttachedKernelConfigFile(detail);
  if (!configFile) {
    return {
      kernelId: 'openclaw',
      label: 'OpenClaw',
      supported: false,
      reasonCode: 'configUnavailable',
      reason: 'Writable OpenClaw config file is not available for this instance.',
      modelOptions: [],
      fieldSupport: OPENCLAW_KERNEL_AGENT_CREATION_FIELD_SUPPORT,
    };
  }

  if (detail.lifecycle.configWritable !== true) {
    return {
      kernelId: 'openclaw',
      label: 'OpenClaw',
      supported: false,
      reasonCode: 'configNotWritable',
      reason: 'The selected OpenClaw config file is not writable.',
      modelOptions: [],
      fieldSupport: OPENCLAW_KERNEL_AGENT_CREATION_FIELD_SUPPORT,
    };
  }

  return {
    kernelId: 'openclaw',
    label: 'OpenClaw',
    supported: true,
    reasonCode: null,
    reason: null,
    modelOptions: buildKernelAgentModelOptions(detail.workbench?.llmProviders),
    fieldSupport: OPENCLAW_KERNEL_AGENT_CREATION_FIELD_SUPPORT,
  };
}

function resolveReportedOpenClawConfigFile(detail: StudioInstanceDetailRecord) {
  const configRoute = detail.dataAccess?.routes?.find((route) => route.scope === 'config');
  if (configRoute?.mode === 'managedFile') {
    const target = normalizeOptionalString(configRoute.target);
    if (target) {
      return target.replace(/\\/g, '/');
    }
  }

  const configArtifact = detail.artifacts?.find((artifact) => artifact.kind === 'configFile');
  const location = normalizeOptionalString(configArtifact?.location);
  return location ? location.replace(/\\/g, '/') : null;
}

function resolveWritableOpenClawConfigFile(detail: StudioInstanceDetailRecord) {
  if (detail.lifecycle.configWritable !== true) {
    return null;
  }

  return resolveAttachedKernelConfigFile(detail) ?? resolveReportedOpenClawConfigFile(detail);
}

function applyResolvedOpenClawAgentPaths(
  agent: OpenClawAgentInput,
  paths: OpenClawResolvedAgentPaths,
): OpenClawAgentInput {
  return {
    ...agent,
    id: paths.id,
    workspace: paths.workspace,
    agentDir: paths.agentDir,
  };
}

function resolveOpenClawGatewayConfigFile(
  detail: StudioInstanceDetailRecord,
  snapshot: OpenClawConfigSnapshot | null | undefined,
) {
  return normalizeOptionalString(snapshot?.path) ?? resolveAttachedKernelConfigFile(detail);
}

function resolveOpenClawAgentFromConfigRoot(input: {
  configFile: string;
  root: Record<string, unknown>;
  agent: OpenClawAgentInput;
}) {
  const paths = resolveOpenClawAgentPathsFromConfigRoot({
    root: input.root,
    configFile: input.configFile,
    agentId: input.agent.id,
    workspace: normalizeOptionalString(input.agent.workspace),
    agentDir: normalizeOptionalString(input.agent.agentDir),
  });

  return applyResolvedOpenClawAgentPaths(input.agent, paths);
}

function readOpenClawConfigAgentEntries(root: Record<string, unknown>) {
  const agentsRoot = root.agents;
  if (!agentsRoot || typeof agentsRoot !== 'object' || Array.isArray(agentsRoot)) {
    return [];
  }

  const agentList = (agentsRoot as Record<string, unknown>).list;
  return Array.isArray(agentList)
    ? agentList.filter(
        (entry): entry is Record<string, unknown> =>
          Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry),
      )
    : [];
}

function hasOpenClawConfigAgent(root: Record<string, unknown>, agentId: string) {
  const normalizedAgentId = normalizeOpenClawAgentId(agentId);
  return readOpenClawConfigAgentEntries(root).some(
    (entry) => normalizeOpenClawAgentId(String(entry.id ?? '')) === normalizedAgentId,
  );
}

function hasOpenClawConfigDefaultAgent(root: Record<string, unknown>) {
  return readOpenClawConfigAgentEntries(root).some((entry) => entry.default === true);
}

function ensureStandardOpenClawMainAgentInConfigDocument(input: {
  raw: string;
  configFile: string;
  root: Record<string, unknown>;
  nextAgent: OpenClawAgentInput;
}) {
  if (
    input.nextAgent.id === 'main'
    || hasOpenClawConfigAgent(input.root, 'main')
  ) {
    return input.raw;
  }

  const mainPaths = resolveOpenClawAgentPathsFromConfigRoot({
    root: input.root,
    configFile: input.configFile,
    agentId: 'main',
  });

  return saveOpenClawAgentInConfigDocument(input.raw, {
    id: 'main',
    name: 'Main',
    workspace: mainPaths.workspace,
    agentDir: mainPaths.agentDir,
    isDefault:
      input.nextAgent.isDefault === true
        ? false
        : !hasOpenClawConfigDefaultAgent(input.root),
  });
}

async function resolveOpenClawAgentForWritableConfig(
  detail: StudioInstanceDetailRecord,
  agent: OpenClawAgentInput,
) {
  const configFile = resolveWritableOpenClawConfigFile(detail);
  if (!configFile) {
    return null;
  }

  const paths = await openClawConfigService.resolveAgentPaths({
    configFile,
    agentId: agent.id,
    workspace: normalizeOptionalString(agent.workspace),
    agentDir: normalizeOptionalString(agent.agentDir),
  });

  return {
    configFile,
    agent: applyResolvedOpenClawAgentPaths(agent, paths),
  };
}

async function trySaveOpenClawAgentWithGateway(
  detail: StudioInstanceDetailRecord,
  agent: OpenClawAgentInput,
) {
  try {
    const snapshot = await openClawGatewayClient.getConfig(detail.instance.id);
    const configFile = resolveOpenClawGatewayConfigFile(detail, snapshot);
    if (!configFile) {
      throw new Error(
        'OpenClaw gateway config path is required before agent paths can be resolved.',
      );
    }

    const agentForConfig = resolveOpenClawAgentFromConfigRoot({
      configFile,
      root: snapshot?.config ?? {},
      agent,
    });
    const root = snapshot?.config ?? {};
    const rawWithStandardMain = ensureStandardOpenClawMainAgentInConfigDocument({
      raw: serializeOpenClawConfigDocument(root),
      configFile,
      root,
      nextAgent: agentForConfig,
    });
    const nextRaw = saveOpenClawAgentInConfigDocument(rawWithStandardMain, agentForConfig);
    const result = await openClawGatewayClient.setConfig(detail.instance.id, {
      raw: nextRaw,
      baseHash: snapshot?.baseHash,
    });

    if (result?.ok === false) {
      throw new Error(
        resolveErrorMessage(result.error, 'Failed to update the OpenClaw config document.'),
      );
    }

    return {
      ok: true,
      errorMessage: null,
    };
  } catch (error) {
    return {
      ok: false,
      errorMessage: resolveErrorMessage(
        error,
        'Failed to update the OpenClaw config document.',
      ),
    };
  }
}

const openClawKernelAgentCreationProvider: KernelAgentCreationProvider = {
  kernelId: 'openclaw',
  async listKernelOptions(detail) {
    if (!isOpenClawKernelCreationCandidate(detail)) {
      return [];
    }

    return [resolveOpenClawCapability(detail)];
  },
  async createAgent(detail, request) {
    const capability = resolveOpenClawCapability(detail);
    if (!capability.supported) {
      throw new Error(capability.reason || 'OpenClaw agent creation is not available.');
    }

    const agent = buildOpenClawAgentInput(request);
    const displayName = normalizeRequiredString(agent.name, 'displayName');
    const savedWithGateway =
      exposesOpenClawGatewayTransport(detail)
        ? await trySaveOpenClawAgentWithGateway(detail, agent)
        : {
            ok: false,
            errorMessage: null,
          };

    if (!savedWithGateway.ok) {
      const writableConfigAgent = await resolveOpenClawAgentForWritableConfig(detail, agent);
      if (!writableConfigAgent) {
        throw new Error(
          savedWithGateway.errorMessage
            || 'Writable OpenClaw config file is not available for this instance.',
        );
      }

      await openClawConfigService.saveAgent({
        configFile: writableConfigAgent.configFile,
        agent: writableConfigAgent.agent,
      });
    }

    invalidateStudioPlatformCaches(detail.instance.id);

    return {
      instanceId: detail.instance.id,
      kernelId: 'openclaw',
      agentId: agent.id,
      displayName,
    };
  },
};

const KERNEL_AGENT_CREATION_PROVIDERS: KernelAgentCreationProvider[] = [
  openClawKernelAgentCreationProvider,
];

function resolveKernelAgentCreationProvider(kernelId: string) {
  const normalizedKernelId = normalizeKernelId(kernelId);
  if (!normalizedKernelId) {
    throw new Error('Kernel agent field "kernelId" must not be empty.');
  }

  return (
    KERNEL_AGENT_CREATION_PROVIDERS.find(
      (provider) => provider.kernelId === normalizedKernelId,
    ) ?? null
  );
}

function createUnsupportedKernelOption(kernelId: string): KernelAgentCreationKernelOption {
  return {
    kernelId,
    label: resolveKernelLabel(kernelId),
    supported: false,
    reasonCode: 'unsupportedKernel',
    reason: 'Agent creation is not implemented for this kernel yet.',
    modelOptions: [],
    fieldSupport: UNSUPPORTED_KERNEL_AGENT_CREATION_FIELD_SUPPORT,
  };
}

async function listKernelCreationOptions(
  detail: StudioInstanceDetailRecord,
): Promise<KernelAgentCreationKernelOption[]> {
  const options = new Map<string, KernelAgentCreationKernelOption>();

  for (const kernelId of collectDeclaredKernelIds(detail)) {
    options.set(kernelId, createUnsupportedKernelOption(kernelId));
  }

  for (const provider of KERNEL_AGENT_CREATION_PROVIDERS) {
    const providerOptions = await provider.listKernelOptions(detail);

    for (const option of providerOptions) {
      const normalizedKernelId = normalizeKernelId(option.kernelId);
      if (!normalizedKernelId) {
        continue;
      }

      options.set(normalizedKernelId, {
        kernelId: normalizedKernelId,
        label: normalizeOptionalString(option.label) ?? resolveKernelLabel(normalizedKernelId),
        supported: option.supported === true,
        reasonCode: option.reasonCode ?? null,
        reason: normalizeOptionalString(option.reason),
        modelOptions: mergeKernelAgentCreationModelOptions(option.modelOptions),
        fieldSupport: normalizeKernelAgentCreationFieldSupport(option.fieldSupport),
      });
    }
  }

  return [...options.values()];
}

function resolveRequestedKernelId(
  capability: KernelAgentCreationCapability,
  requestedKernelId: string | null | undefined,
) {
  const kernelId =
    normalizeKernelId(requestedKernelId) ??
    normalizeKernelId(capability.defaultKernelId);
  if (!kernelId) {
    throw new Error('Agent creation is not available for the selected instance.');
  }

  const kernelOption =
    capability.kernelOptions.find((option) => option.kernelId === kernelId) ?? null;
  if (!kernelOption) {
    throw new Error('Agent creation is not available for the selected kernel.');
  }

  if (!kernelOption.supported) {
    throw new Error(
      kernelOption.reason || 'Agent creation is not implemented for this kernel yet.',
    );
  }

  return {
    kernelId,
    kernelOption,
  };
}

class DefaultKernelAgentManagementService {
  private rethrowCapabilityResolutionError(
    errors: Array<unknown | null | undefined>,
    fallbackMessage: string,
  ): never {
    for (const error of errors) {
      if (error !== null && error !== undefined) {
        throw error;
      }
    }

    throw new Error(fallbackMessage);
  }

  private async resolveCreationCapabilityForDetail(
    detail: StudioInstanceDetailRecord,
  ): Promise<KernelAgentCreationCapability> {
    const kernelOptions = await listKernelCreationOptions(detail);
    const defaultKernelOption =
      kernelOptions.find((option) => option.supported) ?? kernelOptions[0] ?? null;

    return normalizeKernelAgentCreationCapability({
      instanceId: detail.instance.id,
      instanceName: detail.instance.name,
      kernelOptions,
      defaultKernelId: defaultKernelOption?.kernelId ?? null,
    });
  }

  private async resolvePlatformCreationCapability(
    instanceId: string,
  ): Promise<KernelAgentCreationCapability | null> {
    const studioPlatform = getStudioPlatform();
    const capabilityLoader = studioPlatform.getKernelAgentCreationCapability;
    if (!capabilityLoader) {
      return null;
    }

    const capability = await capabilityLoader.call(studioPlatform, instanceId);
    return normalizeKernelAgentCreationCapability(capability);
  }

  private async resolveInstanceDetail(instanceId: string) {
    return getStudioPlatform().getInstanceDetail(instanceId);
  }

  private async resolveCreationCapabilityContext(instanceId: string) {
    const [platformCapabilityResult, detailResult] = await Promise.allSettled([
      this.resolvePlatformCreationCapability(instanceId),
      this.resolveInstanceDetail(instanceId),
    ]);

    const platformCapability =
      platformCapabilityResult.status === 'fulfilled'
        ? platformCapabilityResult.value
        : null;
    const platformCapabilityError =
      platformCapabilityResult.status === 'rejected'
        ? platformCapabilityResult.reason
        : null;
    const detail = detailResult.status === 'fulfilled' ? detailResult.value : null;
    const detailError = detailResult.status === 'rejected' ? detailResult.reason : null;

    let inferredCapability: KernelAgentCreationCapability | null = null;
    let inferredCapabilityError: unknown = null;
    if (detail) {
      try {
        inferredCapability = await this.resolveCreationCapabilityForDetail(detail);
      } catch (error) {
        inferredCapabilityError = error;
      }
    }

    if (isKernelAgentCapabilityContractError(platformCapabilityError)) {
      throw platformCapabilityError;
    }
    if (isKernelAgentCapabilityContractError(inferredCapabilityError)) {
      throw inferredCapabilityError;
    }

    const capability = mergeKernelAgentCreationCapabilities(
      inferredCapability,
      platformCapability,
    );

    if (!capability) {
      this.rethrowCapabilityResolutionError(
        [detailError, inferredCapabilityError, platformCapabilityError],
        'Instance detail is not available for the selected instance.',
      );
    }

    return {
      capability,
      platformCapability,
      platformCapabilityError,
      detail,
      detailError,
      inferredCapability,
      inferredCapabilityError,
    };
  }

  async getCreationCapability(instanceId: string): Promise<KernelAgentCreationCapability> {
    const normalizedInstanceId = normalizeRequiredString(instanceId, 'instanceId');
    const { capability } = await this.resolveCreationCapabilityContext(normalizedInstanceId);
    return capability;
  }

  async createAgent(request: CreateKernelAgentRequest): Promise<CreateKernelAgentResult> {
    const normalizedInstanceId = normalizeRequiredString(request.instanceId, 'instanceId');
    const studioPlatform = getStudioPlatform();
    const {
      capability,
      detail,
      detailError,
      inferredCapabilityError,
      platformCapability,
    } = await this.resolveCreationCapabilityContext(normalizedInstanceId);

    const { kernelId } = resolveRequestedKernelId(capability, request.kernelId);
    const selectedKernelOption =
      capability.kernelOptions.find((option) => option.kernelId === kernelId) ?? null;
    if (!selectedKernelOption) {
      throw new Error('Agent creation is not available for the selected kernel.');
    }
    validateCreateKernelAgentRequest(selectedKernelOption, request);

    const platformKernelOption =
      platformCapability?.kernelOptions.find((option) => option.kernelId === kernelId) ?? null;
    const shouldPreferOpenClawGatewayProvider =
      kernelId === 'openclaw' && Boolean(detail && exposesOpenClawGatewayTransport(detail));
    if (platformKernelOption?.supported && !shouldPreferOpenClawGatewayProvider) {
      const createKernelAgent = studioPlatform.createKernelAgent;
      if (!createKernelAgent) {
        throw new Error(
          'Studio kernel agent creation is not available for the active platform bridge.',
        );
      }

      return normalizeCreateKernelAgentResult(
        await createKernelAgent.call(studioPlatform, {
          ...request,
          instanceId: normalizedInstanceId,
          kernelId,
        }),
      );
    }

    if (!detail) {
      this.rethrowCapabilityResolutionError(
        [detailError, inferredCapabilityError],
        'Instance detail is not available for the selected instance.',
      );
    }

    const provider = resolveKernelAgentCreationProvider(kernelId);
    if (!provider) {
      throw new Error('Agent creation is not implemented for this kernel yet.');
    }

    return normalizeCreateKernelAgentResult(
      await provider.createAgent(detail, {
        ...request,
        instanceId: normalizedInstanceId,
        kernelId,
      }),
    );
  }
}

export function createKernelAgentManagementService() {
  return new DefaultKernelAgentManagementService();
}

export const kernelAgentManagementService = createKernelAgentManagementService();
