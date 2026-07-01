import {
  normalizeOpenClawProviderApiKeySource,
  normalizeOpenClawProviderEndpoint,
  normalizeOpenClawProviderRuntimeConfig,
  resolveOpenClawProjectionModelCatalogState,
  serializeOpenClawProviderApiKeySource,
  type OpenClawProviderInput,
} from '@sdkwork/claw-core';
import {
  normalizeLocalApiProxyLegacyProviderId as normalizeLegacyProviderId,
  normalizeLocalApiProxyLegacyProviderModelRef as normalizeLegacyProviderModelRef,
} from '@sdkwork/local-api-proxy';
import type { InstanceLLMProviderUpdate, InstanceWorkbenchLLMProvider } from '../types';
import {
  formatOpenClawProviderRequestOverridesDraft,
  parseOpenClawProviderRequestOverridesDraft,
} from './openClawProviderRequestDraft.ts';

export interface OpenClawProviderDialogDraftValue {
  id: string;
  name: string;
  endpoint: string;
  apiKeySource: string;
  defaultModelId: string;
  reasoningModelId: string;
  embeddingModelId: string;
  requestOverridesText: string;
}

export interface OpenClawProviderDialogModelValue {
  id: string;
  name: string;
}

export interface OpenClawProviderFormState extends OpenClawProviderDialogDraftValue {
  modelsText: string;
}

export interface OpenClawProviderModelDialogDraftValue {
  originalId?: string;
  id: string;
  name: string;
}

export interface OpenClawProviderModelFormState extends OpenClawProviderModelDialogDraftValue {}

type DraftBuildResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      errorKey?: string;
      errorMessage?: string;
    };

export interface OpenClawProviderDialogSaveValue {
  providerId: string;
  providerInput: OpenClawProviderInput;
  selection: {
    defaultModelId: string;
    reasoningModelId?: string;
    embeddingModelId?: string;
  };
}

export type OpenClawProviderModelDialogSaveValue =
  | {
      mode: 'create';
      modelId: string;
      model: {
        id: string;
        name: string;
      };
    }
  | {
      mode: 'update';
      originalId: string;
      modelId: string;
      model: {
        id: string;
        name: string;
      };
    };

export interface OpenClawProviderConfigSaveValue {
  providerId: string;
  providerUpdate: InstanceLLMProviderUpdate;
}

export interface OpenClawProviderConfigMutationPlan {
  kind: 'providerConfigUpdate';
  instanceId: string;
  providerId: string;
  providerUpdate: InstanceLLMProviderUpdate;
  selectedProviderId: string;
  successKey: 'instances.detail.instanceWorkbench.llmProviders.saved';
  failureKey: 'instances.detail.instanceWorkbench.llmProviders.saveFailed';
}

export interface OpenClawProviderDialogMutationPlan {
  kind: 'providerCreate';
  instanceId: string;
  providerInput: OpenClawProviderInput;
  selection: OpenClawProviderDialogSaveValue['selection'];
  selectedProviderId: string;
  successKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.providerSaved';
  failureKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.providerSaveFailed';
}

export type OpenClawProviderModelMutationPlan =
  | {
      kind: 'providerModelCreate';
      instanceId: string;
      providerId: string;
      model: {
        id: string;
        name: string;
      };
      selectedProviderId: string;
      successKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.modelAdded';
      failureKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.modelSaveFailed';
    }
  | {
      kind: 'providerModelUpdate';
      instanceId: string;
      providerId: string;
      originalId: string;
      model: {
        id: string;
        name: string;
      };
      selectedProviderId: string;
      successKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.modelUpdated';
      failureKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.modelSaveFailed';
    };

export interface OpenClawProviderModelDeleteMutationPlan {
  kind: 'providerModelDelete';
  instanceId: string;
  providerId: string;
  modelId: string;
  selectedProviderId: string;
  successKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.modelRemoved';
  failureKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.modelDeleteFailed';
}

export interface OpenClawProviderDeleteMutationPlan {
  kind: 'providerDelete';
  instanceId: string;
  providerId: string;
  selectedProviderId: null;
  successKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.providerRemoved';
  failureKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.providerDeleteFailed';
}

export type OpenClawProviderCatalogMutationPlan =
  | OpenClawProviderConfigMutationPlan
  | OpenClawProviderDialogMutationPlan
  | OpenClawProviderModelMutationPlan
  | OpenClawProviderModelDeleteMutationPlan
  | OpenClawProviderDeleteMutationPlan;

function buildDefaultOpenClawProviderRuntimeConfig(): OpenClawProviderInput['config'] {
  return {
    temperature: 0.2,
    topP: 1,
    maxTokens: 8192,
    timeoutMs: 60000,
    streaming: true,
  };
}

function normalizeOpenClawProviderId(value: string | undefined | null) {
  return normalizeLegacyProviderId(value);
}

function normalizeOpenClawProviderModelId(value: string | undefined | null) {
  return normalizeLegacyProviderModelRef(value);
}

function normalizeOpenClawProviderDialogModels(
  models: readonly OpenClawProviderDialogModelValue[],
): OpenClawProviderInput['models'] {
  const normalizedModels = new Map<string, OpenClawProviderInput['models'][number]>();

  for (const model of models) {
    const id = normalizeOpenClawProviderModelId(model.id);
    if (!id || normalizedModels.has(id)) {
      continue;
    }

    normalizedModels.set(id, {
      id,
      name: model.name.trim() || id,
    });
  }

  return [...normalizedModels.values()];
}

export function createEmptyOpenClawProviderForm(): OpenClawProviderFormState {
  return {
    id: '',
    name: '',
    endpoint: '',
    apiKeySource: '',
    defaultModelId: '',
    reasoningModelId: '',
    embeddingModelId: '',
    modelsText: '',
    requestOverridesText: '',
  };
}

export function createEmptyOpenClawProviderModelForm(): OpenClawProviderModelFormState {
  return {
    id: '',
    name: '',
  };
}

export function createOpenClawProviderModelForm(
  model?: OpenClawProviderDialogModelValue | null,
): OpenClawProviderModelFormState {
  if (!model) {
    return createEmptyOpenClawProviderModelForm();
  }

  return {
    originalId: model.id,
    id: model.id,
    name: model.name,
  };
}

export function createOpenClawProviderConfigDraft(
  provider: Pick<
    InstanceWorkbenchLLMProvider,
    | 'endpoint'
    | 'apiKeySource'
    | 'defaultModelId'
    | 'reasoningModelId'
    | 'embeddingModelId'
    | 'config'
  >,
): InstanceLLMProviderUpdate {
  return {
    endpoint: provider.endpoint,
    apiKeySource: provider.apiKeySource,
    defaultModelId: provider.defaultModelId,
    reasoningModelId: provider.reasoningModelId,
    embeddingModelId: provider.embeddingModelId,
    config: { ...provider.config },
  };
}

export function createOpenClawProviderRequestDraft(
  provider: Pick<InstanceWorkbenchLLMProvider, 'config'>,
) {
  return formatOpenClawProviderRequestOverridesDraft(provider.config.request);
}

export function hasPendingOpenClawProviderConfigChanges(args: {
  provider: Pick<
    InstanceWorkbenchLLMProvider,
    | 'endpoint'
    | 'apiKeySource'
    | 'defaultModelId'
    | 'reasoningModelId'
    | 'embeddingModelId'
    | 'config'
  >;
  draft: InstanceLLMProviderUpdate;
  requestDraft: string;
}) {
  return (
    JSON.stringify(args.draft) !== JSON.stringify(createOpenClawProviderConfigDraft(args.provider)) ||
    args.requestDraft !== createOpenClawProviderRequestDraft(args.provider)
  );
}

export function applyOpenClawProviderFieldDraftChange(args: {
  drafts: Record<string, InstanceLLMProviderUpdate>;
  providerId: string;
  draft: InstanceLLMProviderUpdate;
  field: 'endpoint' | 'apiKeySource' | 'defaultModelId' | 'reasoningModelId' | 'embeddingModelId';
  value: string;
}): Record<string, InstanceLLMProviderUpdate> {
  const nextValue =
    (args.field === 'reasoningModelId' || args.field === 'embeddingModelId') && !args.value
      ? undefined
      : args.value;

  return {
    ...args.drafts,
    [args.providerId]: {
      ...args.draft,
      [args.field]: nextValue,
    } as InstanceLLMProviderUpdate,
  };
}

export function applyOpenClawProviderConfigDraftChange(args: {
  drafts: Record<string, InstanceLLMProviderUpdate>;
  providerId: string;
  draft: InstanceLLMProviderUpdate;
  field: keyof InstanceLLMProviderUpdate['config'];
  value: number | boolean;
}): Record<string, InstanceLLMProviderUpdate> {
  return {
    ...args.drafts,
    [args.providerId]: {
      ...args.draft,
      config: {
        ...args.draft.config,
        [args.field]: args.value,
      },
    },
  };
}

export function applyOpenClawProviderRequestDraftChange(args: {
  requestDrafts: Record<string, string>;
  providerId: string;
  value: string;
}): Record<string, string> {
  return {
    ...args.requestDrafts,
    [args.providerId]: args.value,
  };
}

export function parseOpenClawProviderModelsText(modelsText: string) {
  const models = modelsText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separatorIndex = line.indexOf('=');
      if (separatorIndex <= 0) {
        return {
          id: line,
          name: line,
        };
      }

      const id = line.slice(0, separatorIndex).trim();
      const name = line.slice(separatorIndex + 1).trim();
      return {
        id,
        name: name || id,
      };
    })
    .filter((model) => model.id);

  return Array.from(new Map(models.map((model) => [model.id, model] as const)).values());
}

export function buildOpenClawProviderDialogSaveInput(args: {
  draft: OpenClawProviderDialogDraftValue;
  models: OpenClawProviderDialogModelValue[];
}): DraftBuildResult<OpenClawProviderDialogSaveValue> {
  const providerId = normalizeOpenClawProviderId(args.draft.id);
  if (!providerId) {
    return {
      ok: false,
      errorKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.providerIdRequired',
    };
  }

  const normalizedModels = normalizeOpenClawProviderDialogModels(args.models);
  if (normalizedModels.length === 0) {
    return {
      ok: false,
      errorKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.modelsRequired',
    };
  }

  const defaultModelId =
    normalizeOpenClawProviderModelId(args.draft.defaultModelId) || normalizedModels[0]?.id || '';
  const reasoningModelId = normalizeOpenClawProviderModelId(args.draft.reasoningModelId) || undefined;
  const embeddingModelId = normalizeOpenClawProviderModelId(args.draft.embeddingModelId) || undefined;
  const validModelIds = new Set(normalizedModels.map((model) => model.id));

  if (!validModelIds.has(defaultModelId)) {
    return {
      ok: false,
      errorKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.defaultModelMissing',
    };
  }

  if (reasoningModelId && !validModelIds.has(reasoningModelId)) {
    return {
      ok: false,
      errorKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.reasoningModelMissing',
    };
  }

  if (embeddingModelId && !validModelIds.has(embeddingModelId)) {
    return {
      ok: false,
      errorKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.embeddingModelMissing',
    };
  }

  try {
    const requestOverrides = parseOpenClawProviderRequestOverridesDraft(
      args.draft.requestOverridesText,
    );
    const normalizedModelCatalogState = resolveOpenClawProjectionModelCatalogState({
      models: normalizedModels,
      selection: {
        defaultModelId,
        reasoningModelId,
        embeddingModelId,
      },
    });

    return {
      ok: true,
      value: {
        providerId,
        providerInput: {
          id: providerId,
          channelId: providerId,
          name: args.draft.name.trim() || providerId,
          apiKey: serializeOpenClawProviderApiKeySource(args.draft.apiKeySource),
          baseUrl: normalizeOpenClawProviderEndpoint(args.draft.endpoint),
          models: normalizedModelCatalogState.models,
          config: normalizeOpenClawProviderRuntimeConfig({
            ...buildDefaultOpenClawProviderRuntimeConfig(),
            request: requestOverrides,
          }),
        },
        selection: normalizedModelCatalogState.selection,
      },
    };
  } catch (error: any) {
    return {
      ok: false,
      errorMessage: error?.message || 'request overrides are invalid.',
    };
  }
}

export function buildOpenClawProviderModelDialogSaveInput(
  draft: OpenClawProviderModelDialogDraftValue,
): DraftBuildResult<OpenClawProviderModelDialogSaveValue> {
  const modelId = draft.id.trim();
  if (!modelId) {
    return {
      ok: false,
      errorKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.modelIdRequired',
    };
  }

  const model = {
    id: modelId,
    name: draft.name.trim() || modelId,
  };

  if (draft.originalId) {
    return {
      ok: true,
      value: {
        mode: 'update',
        originalId: draft.originalId,
        modelId,
        model,
      },
    };
  }

  return {
    ok: true,
    value: {
      mode: 'create',
      modelId,
      model,
    },
  };
}

export function buildOpenClawProviderConfigSaveInput(args: {
  providerId: string;
  draft: InstanceLLMProviderUpdate;
  requestOverridesText: string;
}): DraftBuildResult<OpenClawProviderConfigSaveValue> {
  try {
    const requestOverrides = parseOpenClawProviderRequestOverridesDraft(args.requestOverridesText);

    return {
      ok: true,
      value: {
        providerId: normalizeOpenClawProviderId(args.providerId),
        providerUpdate: {
          ...args.draft,
          endpoint: normalizeOpenClawProviderEndpoint(args.draft.endpoint),
          apiKeySource: normalizeOpenClawProviderApiKeySource(args.draft.apiKeySource),
          defaultModelId: normalizeOpenClawProviderModelId(args.draft.defaultModelId),
          reasoningModelId: normalizeOpenClawProviderModelId(args.draft.reasoningModelId) || undefined,
          embeddingModelId: normalizeOpenClawProviderModelId(args.draft.embeddingModelId) || undefined,
          config: normalizeOpenClawProviderRuntimeConfig({
            ...args.draft.config,
            request: requestOverrides,
          }),
        },
      },
    };
  } catch (error: any) {
    return {
      ok: false,
      errorMessage: error?.message || 'request overrides are invalid.',
    };
  }
}

export function buildOpenClawProviderConfigMutationPlan(args: {
  instanceId: string;
  saveInput: OpenClawProviderConfigSaveValue;
}): OpenClawProviderConfigMutationPlan {
  return {
    kind: 'providerConfigUpdate',
    instanceId: args.instanceId,
    providerId: args.saveInput.providerId,
    providerUpdate: args.saveInput.providerUpdate,
    selectedProviderId: args.saveInput.providerId,
    successKey: 'instances.detail.instanceWorkbench.llmProviders.saved',
    failureKey: 'instances.detail.instanceWorkbench.llmProviders.saveFailed',
  };
}

export function buildOpenClawProviderDialogMutationPlan(args: {
  instanceId: string;
  saveInput: OpenClawProviderDialogSaveValue;
}): OpenClawProviderDialogMutationPlan {
  return {
    kind: 'providerCreate',
    instanceId: args.instanceId,
    providerInput: args.saveInput.providerInput,
    selection: args.saveInput.selection,
    selectedProviderId: args.saveInput.providerId,
    successKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.providerSaved',
    failureKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.providerSaveFailed',
  };
}

export function buildOpenClawProviderModelMutationPlan(args: {
  instanceId: string;
  providerId: string;
  saveInput: OpenClawProviderModelDialogSaveValue;
}): OpenClawProviderModelMutationPlan {
  if (args.saveInput.mode === 'update') {
    return {
      kind: 'providerModelUpdate',
      instanceId: args.instanceId,
      providerId: args.providerId,
      originalId: args.saveInput.originalId,
      model: args.saveInput.model,
      selectedProviderId: args.providerId,
      successKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.modelUpdated',
      failureKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.modelSaveFailed',
    };
  }

  return {
    kind: 'providerModelCreate',
    instanceId: args.instanceId,
    providerId: args.providerId,
    model: args.saveInput.model,
    selectedProviderId: args.providerId,
    successKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.modelAdded',
    failureKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.modelSaveFailed',
  };
}

export function buildOpenClawProviderModelDeleteMutationPlan(args: {
  instanceId: string;
  providerId: string;
  modelId: string;
}): OpenClawProviderModelDeleteMutationPlan {
  return {
    kind: 'providerModelDelete',
    instanceId: args.instanceId,
    providerId: args.providerId,
    modelId: args.modelId,
    selectedProviderId: args.providerId,
    successKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.modelRemoved',
    failureKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.modelDeleteFailed',
  };
}

export function buildOpenClawProviderDeleteMutationPlan(args: {
  instanceId: string;
  providerId: string;
}): OpenClawProviderDeleteMutationPlan {
  return {
    kind: 'providerDelete',
    instanceId: args.instanceId,
    providerId: args.providerId,
    selectedProviderId: null,
    successKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.providerRemoved',
    failureKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.providerDeleteFailed',
  };
}
