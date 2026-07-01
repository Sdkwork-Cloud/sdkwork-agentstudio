import type {
  StudioWorkbenchLLMProviderRequestAuthMode,
  StudioWorkbenchLLMProviderRequestAuthRecord,
  StudioWorkbenchLLMProviderRequestOverridesRecord,
  StudioWorkbenchLLMProviderRequestProxyMode,
  StudioWorkbenchLLMProviderRequestProxyRecord,
  StudioWorkbenchLLMProviderRequestTlsRecord,
} from '@sdkwork/claw-types';
import {
  createDefaultLocalApiProxyProviderRuntimeConfig,
  normalizeLocalApiProxyLegacyProviderId as normalizeLegacyProviderId,
  normalizeLocalApiProxyLegacyProviderModelRef as normalizeLegacyProviderModelRef,
  normalizeLocalApiProxyProviderRequestOverrides,
  normalizeLocalApiProxyProviderRuntimeConfig,
  type LocalApiProxyProviderRuntimeConfig,
} from '@sdkwork/local-api-proxy';
import type { JsonObject, JsonValue } from './openClawConfigDocumentService.ts';

export type OpenClawProviderRuntimeConfig = LocalApiProxyProviderRuntimeConfig;

const OPENCLAW_PROVIDER_REQUEST_AUTH_MODES: readonly StudioWorkbenchLLMProviderRequestAuthMode[] = [
  'provider-default',
  'authorization-bearer',
  'header',
];

const OPENCLAW_PROVIDER_REQUEST_PROXY_MODES: readonly StudioWorkbenchLLMProviderRequestProxyMode[] = [
  'env-proxy',
  'explicit-proxy',
];

function isJsonObject(value: JsonValue | null | undefined): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readObject(value: JsonValue | null | undefined) {
  return isJsonObject(value) ? value : null;
}

function ensureObject(parent: JsonObject, key: string): JsonObject {
  const value = readObject(parent[key]);
  if (value) {
    return value;
  }

  const nextValue: JsonObject = {};
  parent[key] = nextValue;
  return nextValue;
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function readNumber(value: unknown, fallback: number) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function readBoolean(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    if (value === 'true') {
      return true;
    }
    if (value === 'false') {
      return false;
    }
  }

  return fallback;
}

function setOptionalScalar(target: JsonObject, key: string, value: string | undefined) {
  const normalized = value?.trim() || '';
  if (!normalized) {
    delete target[key];
    return;
  }

  target[key] = normalized;
}

function setOptionalBoolean(target: JsonObject, key: string, value: boolean | undefined) {
  if (typeof value !== 'boolean') {
    delete target[key];
    return;
  }

  target[key] = value;
}

function buildModelRef(providerKey: string, modelId: string) {
  const normalizedProviderKey = normalizeLegacyProviderId(providerKey).trim();
  const normalizedModelRef = normalizeLegacyProviderModelRef(modelId).trim();

  if (!normalizedProviderKey || !normalizedModelRef) {
    return '';
  }

  return normalizedModelRef.includes('/')
    ? normalizedModelRef
    : `${normalizedProviderKey}/${normalizedModelRef}`;
}

function readStringRecord(root: JsonObject | null | undefined) {
  if (!root) {
    return undefined;
  }

  const nextRecord = Object.fromEntries(
    Object.entries(root).flatMap(([key, value]) => {
      const normalizedKey = key.trim();
      const normalizedValue = readString(value);
      return normalizedKey && normalizedValue ? [[normalizedKey, normalizedValue]] : [];
    }),
  );

  return Object.keys(nextRecord).length > 0 ? nextRecord : undefined;
}

function writeStringRecord(
  target: JsonObject,
  key: string,
  value: Record<string, string> | undefined,
) {
  if (!value) {
    delete target[key];
    return;
  }

  const nextRecord = Object.fromEntries(
    Object.entries(value).flatMap(([entryKey, entryValue]) => {
      const normalizedKey = entryKey.trim();
      const normalizedValue = entryValue.trim();
      return normalizedKey && normalizedValue ? [[normalizedKey, normalizedValue]] : [];
    }),
  );

  if (Object.keys(nextRecord).length === 0) {
    delete target[key];
    return;
  }

  target[key] = nextRecord;
}

function readProviderRequestTls(
  value: JsonValue | null | undefined,
): StudioWorkbenchLLMProviderRequestTlsRecord | undefined {
  const root = readObject(value);
  if (!root) {
    return undefined;
  }

  const nextTls: StudioWorkbenchLLMProviderRequestTlsRecord = {};
  const ca = readString(root.ca);
  const cert = readString(root.cert);
  const key = readString(root.key);
  const passphrase = readString(root.passphrase);
  const serverName = readString(root.serverName);

  if (ca) {
    nextTls.ca = ca;
  }
  if (cert) {
    nextTls.cert = cert;
  }
  if (key) {
    nextTls.key = key;
  }
  if (passphrase) {
    nextTls.passphrase = passphrase;
  }
  if (serverName) {
    nextTls.serverName = serverName;
  }
  if (typeof root.insecureSkipVerify === 'boolean') {
    nextTls.insecureSkipVerify = root.insecureSkipVerify;
  }

  return Object.keys(nextTls).length > 0 ? nextTls : undefined;
}

function writeProviderRequestTls(
  value: StudioWorkbenchLLMProviderRequestTlsRecord | undefined,
): JsonObject | undefined {
  if (!value) {
    return undefined;
  }

  const nextRoot: JsonObject = {};
  setOptionalScalar(nextRoot, 'ca', value.ca);
  setOptionalScalar(nextRoot, 'cert', value.cert);
  setOptionalScalar(nextRoot, 'key', value.key);
  setOptionalScalar(nextRoot, 'passphrase', value.passphrase);
  setOptionalScalar(nextRoot, 'serverName', value.serverName);
  setOptionalBoolean(nextRoot, 'insecureSkipVerify', value.insecureSkipVerify);

  return Object.keys(nextRoot).length > 0 ? nextRoot : undefined;
}

function readProviderRequestAuth(
  value: JsonValue | null | undefined,
): StudioWorkbenchLLMProviderRequestAuthRecord | undefined {
  const root = readObject(value);
  if (!root) {
    return undefined;
  }

  const mode = readString(root.mode) as StudioWorkbenchLLMProviderRequestAuthMode;
  if (!OPENCLAW_PROVIDER_REQUEST_AUTH_MODES.includes(mode)) {
    return undefined;
  }

  const nextAuth: StudioWorkbenchLLMProviderRequestAuthRecord = {
    mode,
  };
  if (mode === 'authorization-bearer') {
    const token = readString(root.token);
    if (token) {
      nextAuth.token = token;
    }
  }
  if (mode === 'header') {
    const headerName = readString(root.headerName);
    const headerValue = readString(root.value);
    const prefix = readString(root.prefix);
    if (headerName) {
      nextAuth.headerName = headerName;
    }
    if (headerValue) {
      nextAuth.value = headerValue;
    }
    if (prefix) {
      nextAuth.prefix = prefix;
    }
  }

  return nextAuth;
}

function writeProviderRequestAuth(
  value: StudioWorkbenchLLMProviderRequestAuthRecord | undefined,
): JsonObject | undefined {
  if (!value || !OPENCLAW_PROVIDER_REQUEST_AUTH_MODES.includes(value.mode)) {
    return undefined;
  }

  const nextRoot: JsonObject = {
    mode: value.mode,
  };
  if (value.mode === 'authorization-bearer') {
    setOptionalScalar(nextRoot, 'token', value.token);
  }
  if (value.mode === 'header') {
    setOptionalScalar(nextRoot, 'headerName', value.headerName);
    setOptionalScalar(nextRoot, 'value', value.value);
    setOptionalScalar(nextRoot, 'prefix', value.prefix);
  }

  return nextRoot;
}

function readProviderRequestProxy(
  value: JsonValue | null | undefined,
): StudioWorkbenchLLMProviderRequestProxyRecord | undefined {
  const root = readObject(value);
  if (!root) {
    return undefined;
  }

  const mode = readString(root.mode) as StudioWorkbenchLLMProviderRequestProxyMode;
  if (!OPENCLAW_PROVIDER_REQUEST_PROXY_MODES.includes(mode)) {
    return undefined;
  }

  const nextProxy: StudioWorkbenchLLMProviderRequestProxyRecord = {
    mode,
  };
  if (mode === 'explicit-proxy') {
    const url = readString(root.url);
    if (url) {
      nextProxy.url = url;
    }
  }

  const tls = readProviderRequestTls(root.tls);
  if (tls) {
    nextProxy.tls = tls;
  }

  return nextProxy;
}

function writeProviderRequestProxy(
  value: StudioWorkbenchLLMProviderRequestProxyRecord | undefined,
): JsonObject | undefined {
  if (!value || !OPENCLAW_PROVIDER_REQUEST_PROXY_MODES.includes(value.mode)) {
    return undefined;
  }

  const nextRoot: JsonObject = {
    mode: value.mode,
  };
  if (value.mode === 'explicit-proxy') {
    setOptionalScalar(nextRoot, 'url', value.url);
  }

  const tls = writeProviderRequestTls(value.tls);
  if (tls) {
    nextRoot.tls = tls;
  }

  return nextRoot;
}

function readProviderRequestConfig(
  providerRoot: JsonObject | null | undefined,
): StudioWorkbenchLLMProviderRequestOverridesRecord | undefined {
  const requestRoot = readObject(providerRoot?.request as JsonValue | undefined);
  if (!requestRoot) {
    return undefined;
  }

  return normalizeOpenClawProviderRequestOverrides({
    headers: readStringRecord(readObject(requestRoot.headers)),
    auth: readProviderRequestAuth(requestRoot.auth),
    proxy: readProviderRequestProxy(requestRoot.proxy),
    tls: readProviderRequestTls(requestRoot.tls),
  });
}

function writeProviderRequestConfig(
  providerRoot: JsonObject,
  request: StudioWorkbenchLLMProviderRequestOverridesRecord | undefined,
) {
  const normalizedRequest = normalizeOpenClawProviderRequestOverrides(request);
  if (!normalizedRequest) {
    delete providerRoot.request;
    return;
  }

  const requestRoot: JsonObject = {};
  writeStringRecord(requestRoot, 'headers', normalizedRequest.headers);
  const auth = writeProviderRequestAuth(normalizedRequest.auth);
  if (auth) {
    requestRoot.auth = auth;
  }
  const proxy = writeProviderRequestProxy(normalizedRequest.proxy);
  if (proxy) {
    requestRoot.proxy = proxy;
  }
  const tls = writeProviderRequestTls(normalizedRequest.tls);
  if (tls) {
    requestRoot.tls = tls;
  }

  if (Object.keys(requestRoot).length === 0) {
    delete providerRoot.request;
    return;
  }

  providerRoot.request = requestRoot;
}

export function normalizeOpenClawProviderRequestOverrides(
  value: StudioWorkbenchLLMProviderRequestOverridesRecord | null | undefined,
): StudioWorkbenchLLMProviderRequestOverridesRecord | undefined {
  return normalizeLocalApiProxyProviderRequestOverrides(value);
}

export function createDefaultOpenClawProviderRuntimeConfig(): OpenClawProviderRuntimeConfig {
  return createDefaultLocalApiProxyProviderRuntimeConfig();
}

export function normalizeOpenClawProviderRuntimeConfig(
  input?: Partial<OpenClawProviderRuntimeConfig> | null,
): OpenClawProviderRuntimeConfig {
  return normalizeLocalApiProxyProviderRuntimeConfig(input);
}

export function readOpenClawProviderRuntimeConfigFromConfigRoot(input: {
  root: JsonObject;
  providerKey: string;
  modelId?: string | null;
  providerRoot?: JsonObject | null;
}): OpenClawProviderRuntimeConfig {
  const defaults = createDefaultOpenClawProviderRuntimeConfig();
  const normalizedModelId = input.modelId?.trim() || '';
  const defaultsModelsRoot = readObject(readObject(readObject(input.root.agents)?.defaults)?.models);
  const modelRoot =
    normalizedModelId && defaultsModelsRoot
      ? readObject(defaultsModelsRoot[buildModelRef(input.providerKey, normalizedModelId)])
      : null;
  const paramsRoot = readObject(modelRoot?.params as JsonValue | undefined);
  const request = readProviderRequestConfig(input.providerRoot);

  return normalizeOpenClawProviderRuntimeConfig({
    temperature: readNumber(paramsRoot?.temperature, defaults.temperature),
    topP: readNumber(paramsRoot?.topP, defaults.topP),
    maxTokens: readNumber(paramsRoot?.maxTokens, defaults.maxTokens),
    timeoutMs: readNumber(paramsRoot?.timeoutMs, defaults.timeoutMs),
    streaming: readBoolean(paramsRoot?.streaming, defaults.streaming),
    ...(request ? { request } : {}),
  });
}

export function writeOpenClawProviderRuntimeConfigToConfigRoot(input: {
  root: JsonObject;
  providerKey: string;
  modelId?: string | null;
  providerRoot?: JsonObject | null;
  config?: Partial<OpenClawProviderRuntimeConfig> | null;
}) {
  if (input.providerRoot) {
    writeProviderRequestConfig(input.providerRoot, input.config?.request);
  }

  const normalizedModelId = input.modelId?.trim() || '';
  if (!normalizedModelId) {
    return;
  }

  const defaultsRoot = ensureObject(ensureObject(input.root, 'agents'), 'defaults');
  const catalogRoot = ensureObject(defaultsRoot, 'models');
  const modelRoot = ensureObject(catalogRoot, buildModelRef(input.providerKey, normalizedModelId));
  const nextParamEntries: Array<[string, number | boolean]> = [];
  for (const [key, value] of [
    ['temperature', input.config?.temperature],
    ['topP', input.config?.topP],
    ['maxTokens', input.config?.maxTokens],
    ['timeoutMs', input.config?.timeoutMs],
    ['streaming', input.config?.streaming],
  ] as const) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      nextParamEntries.push([key, value]);
      continue;
    }

    if (typeof value === 'boolean') {
      nextParamEntries.push([key, value]);
    }
  }
  const nextParams = Object.fromEntries(nextParamEntries);

  if (Object.keys(nextParams).length === 0) {
    delete modelRoot.params;
    return;
  }

  modelRoot.params = nextParams;
}
