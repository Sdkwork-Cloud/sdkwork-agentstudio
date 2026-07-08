import type { RuntimeDesktopKernelInfo } from '@sdkwork/clawstudio-infrastructure';
import type {
  LocalAiProxyClientProtocol,
  LocalAiProxyRouteRecord,
  StudioWorkbenchLLMProviderRequestOverridesRecord,
} from '@sdkwork/clawstudio-types';
import {
  resolveLocalApiProxyProjectedModelCatalogState,
  resolveLocalApiProxyRuntimeBaseUrl,
  resolveProviderLocalApiProxyRouteModelState as resolveLegacyLocalAiProxyRouteModelState,
  selectLocalApiProxyProjectedProviderRoute,
} from '@sdkwork/local-api-proxy';
import { normalizeOpenClawProviderEndpoint } from './openClawProviderFormatService.ts';
import { normalizeOpenClawProviderRequestOverrides } from './openClawProviderRuntimeConfigService.ts';

export const OPENCLAW_LOCAL_PROXY_PROVIDER_ID = 'sdkwork-local-proxy';
export const OPENCLAW_LOCAL_PROXY_TOKEN_ENV_VAR = 'SDKWORK_LOCAL_PROXY_TOKEN';
export const OPENCLAW_LOCAL_PROXY_API_KEY_PLACEHOLDER = '${SDKWORK_LOCAL_PROXY_TOKEN}';
export const OPENCLAW_LOCAL_PROXY_DEFAULT_API_KEY = OPENCLAW_LOCAL_PROXY_API_KEY_PLACEHOLDER;
export const OPENCLAW_LOCAL_PROXY_EXPOSURE_TARGET = 'sdkwork';

export interface OpenClawLocalProxyProjectionProviderModel {
  id: string;
  name: string;
}

export interface OpenClawLocalProxyProjectionProvider {
  id: string;
  channelId: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  models: OpenClawLocalProxyProjectionProviderModel[];
  notes?: string;
  config?: {
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    timeoutMs?: number;
    streaming: boolean;
    request?: StudioWorkbenchLLMProviderRequestOverridesRecord;
  };
}

export interface OpenClawLocalProxyProjectionSelection {
  defaultModelId: string;
  reasoningModelId?: string;
  embeddingModelId?: string;
}

export interface OpenClawLocalProxyProjection {
  sourceRoute: LocalAiProxyRouteRecord;
  provider: OpenClawLocalProxyProjectionProvider;
  selection: OpenClawLocalProxyProjectionSelection;
}

export interface OpenClawProjectionModelCatalogState {
  models: OpenClawLocalProxyProjectionProviderModel[];
  selection: OpenClawLocalProxyProjectionSelection;
}

export function resolveOpenClawProjectionModelCatalogState(input: {
  models: readonly OpenClawLocalProxyProjectionProviderModel[];
  selection: OpenClawLocalProxyProjectionSelection;
  selectionOverride?: Partial<OpenClawLocalProxyProjectionSelection>;
}): OpenClawProjectionModelCatalogState {
  const normalizedState = resolveLocalApiProxyProjectedModelCatalogState(input);

  return {
    models: normalizedState.models.map((model) => ({
      id: model.id,
      name: model.name,
    })),
    selection: {
      defaultModelId: normalizedState.selection.defaultModelId,
      reasoningModelId: normalizedState.selection.reasoningModelId,
      embeddingModelId: normalizedState.selection.embeddingModelId,
    },
  };
}

function selectProjectedLocalAiProxyRoute(
  routes: readonly LocalAiProxyRouteRecord[],
  preferredClientProtocol?: LocalAiProxyClientProtocol,
) {
  return selectLocalApiProxyProjectedProviderRoute({
    routes,
    exposureTarget: OPENCLAW_LOCAL_PROXY_EXPOSURE_TARGET,
    preferredClientProtocol,
    fallbackClientProtocol: 'openai-compatible',
  });
}

function normalizeRuntimeProxyBaseUrl(baseUrl?: string | null) {
  const normalized = baseUrl?.trim();
  return normalized ? normalizeOpenClawProviderEndpoint(normalized) : null;
}

export function resolveOpenClawLocalProxyBaseUrl(
  info: RuntimeDesktopKernelInfo | null,
  clientProtocol: LocalAiProxyClientProtocol = 'openai-compatible',
) {
  return resolveLocalApiProxyRuntimeBaseUrl(
    info?.localAiProxy,
    clientProtocol,
    normalizeRuntimeProxyBaseUrl,
  );
}

export function createOpenClawLocalProxyProjection(input: {
  routes: readonly LocalAiProxyRouteRecord[];
  proxyBaseUrl: string;
  proxyApiKey: string;
  preferredClientProtocol?: LocalAiProxyClientProtocol;
  providerName?: string;
  selectionOverride?: Partial<OpenClawLocalProxyProjectionSelection>;
  runtimeConfig?: {
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    timeoutMs?: number;
    streaming?: boolean;
    request?: StudioWorkbenchLLMProviderRequestOverridesRecord;
  };
}): OpenClawLocalProxyProjection {
  const sourceRoute = selectProjectedLocalAiProxyRoute(
    input.routes,
    input.preferredClientProtocol,
  );
  if (!sourceRoute) {
    throw new Error('No active local AI proxy route is available for OpenClaw local proxy projection.');
  }

  const routeModelState = resolveLegacyLocalAiProxyRouteModelState(sourceRoute);
  const projectionModelCatalogState = resolveOpenClawProjectionModelCatalogState({
    models: routeModelState.models,
    selection: {
      defaultModelId: routeModelState.defaultModelId,
      reasoningModelId: routeModelState.reasoningModelId,
      embeddingModelId: routeModelState.embeddingModelId,
    },
    selectionOverride: input.selectionOverride,
  });

  const proxyBaseUrl = normalizeOpenClawProviderEndpoint(input.proxyBaseUrl);
  if (!proxyBaseUrl) {
    throw new Error('A local proxy base URL is required for OpenClaw projection.');
  }
  const request = normalizeOpenClawProviderRequestOverrides(input.runtimeConfig?.request);

  return {
    sourceRoute,
    provider: {
      id: OPENCLAW_LOCAL_PROXY_PROVIDER_ID,
      channelId: sourceRoute.clientProtocol,
      name: input.providerName?.trim() || 'SDKWork Local Proxy',
      apiKey: input.proxyApiKey.trim(),
      baseUrl: proxyBaseUrl,
      models: projectionModelCatalogState.models.map((model) => ({
        id: model.id,
        name: model.name,
      })),
      notes: `Managed local proxy projection for route "${sourceRoute.name}".`,
      config: {
        temperature: input.runtimeConfig?.temperature,
        topP: input.runtimeConfig?.topP,
        maxTokens: input.runtimeConfig?.maxTokens,
        timeoutMs: input.runtimeConfig?.timeoutMs,
        streaming:
          typeof input.runtimeConfig?.streaming === 'boolean'
            ? input.runtimeConfig.streaming
            : true,
        ...(request ? { request } : {}),
      },
    },
    selection: projectionModelCatalogState.selection,
  };
}
