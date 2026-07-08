import {
  resolveLocalApiProxyProjectedProviderModelCatalog,
  type LocalApiProxyProjectedProviderModelRole,
} from '@sdkwork/local-api-proxy';

export type OpenClawProviderSnapshotModelRole =
  | 'primary'
  | 'reasoning'
  | 'embedding'
  | 'fallback';

export interface OpenClawProviderModelSelection {
  defaultModelId: string;
  reasoningModelId?: string;
  embeddingModelId?: string;
}

export interface OpenClawProviderSnapshotModelInput {
  id: string;
  name: string;
  explicitReasoning?: unknown;
  explicitApi?: unknown;
  explicitContextWindow?: unknown;
}

export interface OpenClawProviderSnapshotModelRecord {
  id: string;
  name: string;
  role: OpenClawProviderSnapshotModelRole;
  contextWindow: string;
}

export interface OpenClawProviderSnapshotModelCatalogState {
  selection: OpenClawProviderModelSelection;
  models: OpenClawProviderSnapshotModelRecord[];
}

export interface OpenClawProviderModelCatalogInput {
  id: string;
  name: string;
}

export interface OpenClawProviderDocumentModelRecord {
  id: string;
  name: string;
  role: LocalApiProxyProjectedProviderModelRole;
  reasoning: boolean;
  api?: 'embedding';
  contextWindow: number;
  maxTokens: number;
}

export interface OpenClawProviderDocumentModelCatalogState {
  selection: OpenClawProviderModelSelection;
  models: OpenClawProviderDocumentModelRecord[];
}

function normalizeModelId(value: string | undefined | null) {
  return value?.trim() || '';
}

function normalizeModelName(value: string | undefined | null, fallbackId: string) {
  return value?.trim() || fallbackId;
}

function readScalar(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function isReasoningModel(
  modelId: string,
  modelName: string,
  explicitReasoning?: unknown,
) {
  if (typeof explicitReasoning === 'boolean') {
    return explicitReasoning;
  }

  return /(reason|reasoner|thinking|r1|o1|o3|o4|t1|k1|opus)/i.test(
    `${modelId} ${modelName}`,
  );
}

function isEmbeddingModel(
  modelId: string,
  modelName: string,
  explicitApi?: unknown,
) {
  if (readScalar(explicitApi).toLowerCase() === 'embedding') {
    return true;
  }

  return /(embed|embedding|bge|vector)/i.test(`${modelId} ${modelName}`);
}

export function mapProjectedProviderModelRoleToOpenClawSnapshotRole(
  role: LocalApiProxyProjectedProviderModelRole,
): OpenClawProviderSnapshotModelRole {
  switch (role) {
    case 'default':
      return 'primary';
    case 'reasoning':
      return 'reasoning';
    case 'embedding':
      return 'embedding';
    default:
      return 'fallback';
  }
}

export function inferOpenClawProviderSnapshotContextWindow(
  role: OpenClawProviderSnapshotModelRole,
  explicitContextWindow?: unknown,
) {
  if (typeof explicitContextWindow === 'number') {
    if (explicitContextWindow >= 1000) {
      return `${Math.round(explicitContextWindow / 1000)}K`;
    }

    return String(explicitContextWindow);
  }

  if (role === 'embedding') {
    return '8K';
  }

  if (role === 'reasoning') {
    return '200K';
  }

  return '128K';
}

export function inferOpenClawProviderDocumentContextWindow(
  role: LocalApiProxyProjectedProviderModelRole,
) {
  switch (role) {
    case 'embedding':
      return 8192;
    case 'reasoning':
      return 200000;
    default:
      return 128000;
  }
}

export function inferOpenClawProviderDocumentMaxTokens(
  role: LocalApiProxyProjectedProviderModelRole,
) {
  return role === 'embedding' ? 8192 : 32000;
}

function normalizeSnapshotModelInputs(
  models: readonly OpenClawProviderSnapshotModelInput[],
) {
  const modelById = new Map<string, OpenClawProviderSnapshotModelInput>();

  for (const model of models) {
    const id = normalizeModelId(model.id);
    if (!id || modelById.has(id)) {
      continue;
    }

    modelById.set(id, {
      id,
      name: normalizeModelName(model.name, id),
      explicitReasoning: model.explicitReasoning,
      explicitApi: model.explicitApi,
      explicitContextWindow: model.explicitContextWindow,
    });
  }

  return modelById;
}

export function resolveOpenClawProviderSnapshotModelCatalogState(input: {
  models: readonly OpenClawProviderSnapshotModelInput[];
  selection: OpenClawProviderModelSelection;
}): OpenClawProviderSnapshotModelCatalogState {
  const modelById = normalizeSnapshotModelInputs(input.models);
  const availableModelIds = [...modelById.keys()];
  const explicitDefaultModelId = normalizeModelId(input.selection.defaultModelId);
  const explicitReasoningModelId = normalizeModelId(input.selection.reasoningModelId);
  const explicitEmbeddingModelId = normalizeModelId(input.selection.embeddingModelId);

  const reasoningModelId =
    (explicitReasoningModelId && modelById.has(explicitReasoningModelId)
      ? explicitReasoningModelId
      : undefined) ||
    [...modelById.values()].find((model) =>
      isReasoningModel(model.id, model.name, model.explicitReasoning),
    )?.id;
  const embeddingModelId =
    (explicitEmbeddingModelId && modelById.has(explicitEmbeddingModelId)
      ? explicitEmbeddingModelId
      : undefined) ||
    [...modelById.values()].find((model) =>
      isEmbeddingModel(model.id, model.name, model.explicitApi),
    )?.id;
  const defaultModelId =
    (explicitDefaultModelId && modelById.has(explicitDefaultModelId)
      ? explicitDefaultModelId
      : undefined) ||
    availableModelIds[0] ||
    '';

  const normalizedModelCatalogState =
    resolveLocalApiProxyProjectedProviderModelCatalog({
      existingModels: [...modelById.values()].map((model) => ({
        id: model.id,
        name: model.name,
      })),
      selection: {
        defaultModelId,
        reasoningModelId,
        embeddingModelId,
      },
    });

  return {
    selection: normalizedModelCatalogState.selection,
    models: normalizedModelCatalogState.models.map((model) => {
      const role = mapProjectedProviderModelRoleToOpenClawSnapshotRole(model.role);
      const metadata = modelById.get(model.id);

      return {
        id: model.id,
        name: model.name,
        role,
        contextWindow: inferOpenClawProviderSnapshotContextWindow(
          role,
          metadata?.explicitContextWindow,
        ),
      };
    }),
  };
}

export function resolveOpenClawProviderDocumentModelCatalogState(input: {
  models: readonly OpenClawProviderModelCatalogInput[];
  selection: OpenClawProviderModelSelection;
}): OpenClawProviderDocumentModelCatalogState {
  const normalizedModelCatalogState =
    resolveLocalApiProxyProjectedProviderModelCatalog({
      existingModels: input.models,
      selection: input.selection,
    });

  return {
    selection: normalizedModelCatalogState.selection,
    models: normalizedModelCatalogState.models.map((model) => ({
      id: model.id,
      name: model.name,
      role: model.role,
      reasoning: model.role === 'reasoning',
      api: model.role === 'embedding' ? 'embedding' : undefined,
      contextWindow: inferOpenClawProviderDocumentContextWindow(model.role),
      maxTokens: inferOpenClawProviderDocumentMaxTokens(model.role),
    })),
  };
}
