import {
  getStudioPlatform,
  invalidateStudioPlatformCaches,
  openClawGatewayClient,
  type StudioCreatedKernelAgentRecord,
  type StudioCreateKernelAgentInput,
  type StudioKernelAgentCreationCapability,
  type StudioKernelAgentCreationKernelOption,
  type StudioKernelAgentCreationModelOption,
  type StudioKernelAgentCreationReasonCode,
} from '@sdkwork/claw-infrastructure';
import type {
  StudioInstanceDetailRecord,
  StudioWorkbenchLLMProviderRecord,
} from '@sdkwork/claw-types';
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
import {
  resolveAttachedKernelConfig,
  resolveAttachedKernelConfigFile,
} from './kernelConfigAttachmentService.ts';

export type KernelAgentCreationReasonCode = StudioKernelAgentCreationReasonCode;
export type KernelAgentCreationKernelOption = StudioKernelAgentCreationKernelOption;
export type KernelAgentCreationModelOption = StudioKernelAgentCreationModelOption;
export type KernelAgentCreationCapability = StudioKernelAgentCreationCapability;
export type CreateKernelAgentRequest = StudioCreateKernelAgentInput;
export type CreateKernelAgentResult = StudioCreatedKernelAgentRecord;

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

function normalizeKernelAgentCreationKernelOption(
  option: KernelAgentCreationKernelOption,
): KernelAgentCreationKernelOption | null {
  const kernelId = normalizeKernelId(option.kernelId);
  if (!kernelId) {
    return null;
  }

  return {
    kernelId,
    label: normalizeOptionalString(option.label) ?? resolveKernelLabel(kernelId),
    supported: option.supported === true,
    reasonCode: option.reasonCode ?? null,
    reason: normalizeOptionalString(option.reason),
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
    modelOptions: capability.modelOptions
      .map((option) => normalizeKernelAgentCreationModelOption(option))
      .filter((option): option is KernelAgentCreationModelOption => Boolean(option)),
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
    const normalizedKernelId = normalizeKernelId(option.kernelId);
    if (!normalizedKernelId) {
      return;
    }

    const normalizedOption = {
      ...option,
      kernelId: normalizedKernelId,
      label: normalizeOptionalString(option.label) ?? resolveKernelLabel(normalizedKernelId),
      supported: option.supported === true,
      reasonCode: option.reasonCode ?? null,
      reason: normalizeOptionalString(option.reason),
    };

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

  const mergedModelOptions = new Map<string, KernelAgentCreationModelOption>();
  const pushModelOption = (option: KernelAgentCreationModelOption) => {
    const normalizedOption = normalizeKernelAgentCreationModelOption(option);
    if (!normalizedOption) {
      return;
    }

    mergedModelOptions.set(normalizedOption.value, normalizedOption);
  };

  for (const option of inferredCapability.modelOptions) {
    pushModelOption(option);
  }
  for (const option of platformCapability.modelOptions) {
    pushModelOption(option);
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
    modelOptions: [...mergedModelOptions.values()],
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
    id: normalizeRequiredString(request.agentId, 'agentId'),
    name: normalizeRequiredString(request.displayName, 'displayName'),
    avatar: normalizeOptionalString(request.avatar) ?? '',
    workspace: normalizeOptionalString(request.workspace) ?? '',
    agentDir: normalizeOptionalString(request.agentDir) ?? '',
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
    };
  }

  if (detail.lifecycle.configWritable !== true) {
    return {
      kernelId: 'openclaw',
      label: 'OpenClaw',
      supported: false,
      reasonCode: 'configNotWritable',
      reason: 'The selected OpenClaw config file is not writable.',
    };
  }

  return {
    kernelId: 'openclaw',
    label: 'OpenClaw',
    supported: true,
    reasonCode: null,
    reason: null,
  };
}

function resolveWritableOpenClawConfigFile(detail: StudioInstanceDetailRecord) {
  if (detail.lifecycle.configWritable !== true) {
    return null;
  }

  return resolveAttachedKernelConfigFile(detail);
}

async function trySaveOpenClawAgentWithGateway(
  instanceId: string,
  agent: OpenClawAgentInput,
) {
  try {
    const snapshot = await openClawGatewayClient.getConfig(instanceId);
    const nextRaw = saveOpenClawAgentInConfigDocument(
      serializeOpenClawConfigDocument(snapshot?.config ?? {}),
      agent,
    );
    const result = await openClawGatewayClient.setConfig(instanceId, {
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
    const savedWithGateway = exposesOpenClawGatewayTransport(detail)
      ? await trySaveOpenClawAgentWithGateway(detail.instance.id, agent)
      : {
          ok: false,
          errorMessage: null,
        };

    if (!savedWithGateway.ok) {
      const configFile = resolveWritableOpenClawConfigFile(detail);
      if (!configFile) {
        throw new Error(
          savedWithGateway.errorMessage
          || 'Writable OpenClaw config file is not available for this instance.',
        );
      }

      await openClawConfigService.saveAgent({
        configFile,
        agent,
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
      modelOptions: buildKernelAgentModelOptions(detail.workbench?.llmProviders),
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
    const platformKernelOption =
      platformCapability?.kernelOptions.find((option) => option.kernelId === kernelId) ?? null;
    if (platformKernelOption?.supported) {
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
