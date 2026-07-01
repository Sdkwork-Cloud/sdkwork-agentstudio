import type {
  SaveOpenClawAuthCooldownsConfigurationInput,
  SaveOpenClawWebFetchConfigurationInput,
  SaveOpenClawWebSearchConfigurationInput,
  SaveOpenClawWebSearchNativeCodexConfigurationInput,
  SaveOpenClawXSearchConfigurationInput,
} from '@sdkwork/claw-core';
import { normalizeOpenClawSecretSource } from '@sdkwork/claw-core';
import {
  createOpenClawDreamingFormState,
  type OpenClawDreamingFormState,
} from './instanceMemoryWorkbenchPresentation.ts';
import type { InstanceWorkbenchSnapshot } from '../types';

type OpenClawWebSearchProviderRecord =
  NonNullable<InstanceWorkbenchSnapshot['configWebSearch']>['providers'][number];

export interface OpenClawWebSearchSharedDraftValue {
  enabled: boolean;
  provider: string;
  maxResults: string;
  timeoutSeconds: string;
  cacheTtlMinutes: string;
}

export interface OpenClawWebSearchProviderDraftValue {
  apiKeySource: string;
  baseUrl: string;
  model: string;
  advancedConfig: string;
}

export interface OpenClawWebSearchDraftState {
  selectedProviderId: string | null;
  sharedDraft: OpenClawWebSearchSharedDraftValue | null;
  providerDrafts: Record<string, OpenClawWebSearchProviderDraftValue>;
}

export interface OpenClawWebSearchProviderSelectionState {
  selectedProvider: OpenClawWebSearchProviderRecord | null;
  selectedProviderDraft: OpenClawWebSearchProviderDraftValue | null;
}

export interface OpenClawXSearchDraftValue {
  enabled: boolean;
  apiKeySource: string;
  model: string;
  inlineCitations: boolean;
  maxTurns: string;
  timeoutSeconds: string;
  cacheTtlMinutes: string;
  advancedConfig: string;
}

export interface OpenClawWebSearchNativeCodexDraftValue {
  enabled: boolean;
  mode: string;
  allowedDomains: string;
  contextSize: string;
  userLocationCountry: string;
  userLocationCity: string;
  userLocationTimezone: string;
  advancedConfig: string;
}

export interface OpenClawWebFetchSharedDraftValue {
  enabled: boolean;
  maxChars: string;
  maxCharsCap: string;
  maxResponseBytes: string;
  timeoutSeconds: string;
  cacheTtlMinutes: string;
  maxRedirects: string;
  readability: boolean;
  userAgent: string;
}

export interface OpenClawWebFetchFallbackDraftValue {
  apiKeySource: string;
  baseUrl: string;
  advancedConfig: string;
}

export interface OpenClawWebFetchDraftState {
  sharedDraft: OpenClawWebFetchSharedDraftValue | null;
  fallbackDraft: OpenClawWebFetchFallbackDraftValue;
}

export interface OpenClawAuthCooldownsDraftValue {
  rateLimitedProfileRotations: string;
  overloadedProfileRotations: string;
  overloadedBackoffMs: string;
  billingBackoffHours: string;
  billingMaxHours: string;
  failureWindowHours: string;
}

export interface OpenClawConfigResetState {
  webSearch: {
    selectedProviderId: string | null;
    sharedDraft: OpenClawWebSearchSharedDraftValue | null;
    providerDrafts: Record<string, OpenClawWebSearchProviderDraftValue>;
    error: string | null;
    isSaving: boolean;
  };
  xSearch: {
    draft: OpenClawXSearchDraftValue | null;
    error: string | null;
    isSaving: boolean;
  };
  webSearchNativeCodex: {
    draft: OpenClawWebSearchNativeCodexDraftValue | null;
    error: string | null;
    isSaving: boolean;
  };
  webFetch: {
    sharedDraft: OpenClawWebFetchSharedDraftValue | null;
    fallbackDraft: OpenClawWebFetchFallbackDraftValue;
    error: string | null;
    isSaving: boolean;
  };
  authCooldowns: {
    draft: OpenClawAuthCooldownsDraftValue | null;
    error: string | null;
    isSaving: boolean;
  };
  dreaming: {
    draft: OpenClawDreamingFormState | null;
    error: string | null;
    isSaving: boolean;
  };
}

type DraftBuildResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      errorKey: string;
    };

function formatOptionalWholeNumber(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}

export function applyOpenClawNullableDraftFieldChange<
  T extends object,
  K extends keyof T,
>(draft: T | null, key: K, value: T[K]): T | null {
  if (!draft) {
    return draft;
  }

  return {
    ...draft,
    [key]: value,
  };
}

export function applyOpenClawDraftFieldChange<
  T extends object,
  K extends keyof T,
>(draft: T, key: K, value: T[K]): T {
  return {
    ...draft,
    [key]: value,
  };
}

export function createOpenClawConfigResetState(): OpenClawConfigResetState {
  const webSearchDraftState = createOpenClawWebSearchDraftState({
    config: null,
  });
  const webFetchDraftState = createOpenClawWebFetchDraftState(null);

  return {
    webSearch: {
      selectedProviderId: webSearchDraftState.selectedProviderId,
      sharedDraft: webSearchDraftState.sharedDraft,
      providerDrafts: webSearchDraftState.providerDrafts,
      error: null,
      isSaving: false,
    },
    xSearch: {
      draft: createOpenClawXSearchDraft(null),
      error: null,
      isSaving: false,
    },
    webSearchNativeCodex: {
      draft: createOpenClawWebSearchNativeCodexDraft(null),
      error: null,
      isSaving: false,
    },
    webFetch: {
      sharedDraft: webFetchDraftState.sharedDraft,
      fallbackDraft: webFetchDraftState.fallbackDraft,
      error: null,
      isSaving: false,
    },
    authCooldowns: {
      draft: createOpenClawAuthCooldownsDraft(null),
      error: null,
      isSaving: false,
    },
    dreaming: {
      draft: createOpenClawDreamingFormState(null),
      error: null,
      isSaving: false,
    },
  };
}

export function createOpenClawWebSearchSharedDraft(
  config: InstanceWorkbenchSnapshot['configWebSearch'] | null | undefined,
): OpenClawWebSearchSharedDraftValue | null {
  if (!config) {
    return null;
  }

  return {
    enabled: config.enabled,
    provider: config.provider,
    maxResults: String(config.maxResults),
    timeoutSeconds: String(config.timeoutSeconds),
    cacheTtlMinutes: String(config.cacheTtlMinutes),
  };
}

export function createOpenClawWebSearchProviderDraft(
  provider?: OpenClawWebSearchProviderRecord | null,
): OpenClawWebSearchProviderDraftValue {
  return {
    apiKeySource: normalizeOpenClawSecretSource(provider?.apiKeySource),
    baseUrl: provider?.baseUrl || '',
    model: provider?.model || '',
    advancedConfig: provider?.advancedConfig || '',
  };
}

export function createOpenClawWebSearchDraftState(args: {
  config: InstanceWorkbenchSnapshot['configWebSearch'] | null | undefined;
  currentProviderId?: string | null;
}): OpenClawWebSearchDraftState {
  const config = args.config;
  const providers = config?.providers || [];

  if (!config || providers.length === 0) {
    return {
      selectedProviderId: null,
      sharedDraft: null,
      providerDrafts: {},
    };
  }

  const selectedProviderId =
    (args.currentProviderId &&
      providers.some((provider) => provider.id === args.currentProviderId) &&
      args.currentProviderId) ||
    (config.provider &&
      providers.some((provider) => provider.id === config.provider) &&
      config.provider) ||
    providers[0]?.id ||
    null;

  return {
    selectedProviderId,
    sharedDraft: createOpenClawWebSearchSharedDraft(config),
    providerDrafts: {},
  };
}

export function buildOpenClawWebSearchProviderSelectionState(args: {
  config: InstanceWorkbenchSnapshot['configWebSearch'] | null | undefined;
  selectedProviderId: string | null;
  providerDrafts: Record<string, OpenClawWebSearchProviderDraftValue>;
}): OpenClawWebSearchProviderSelectionState {
  const selectedProvider =
    args.config?.providers.find((provider) => provider.id === args.selectedProviderId) || null;

  if (!selectedProvider) {
    return {
      selectedProvider: null,
      selectedProviderDraft: null,
    };
  }

  return {
    selectedProvider,
    selectedProviderDraft:
      args.providerDrafts[selectedProvider.id] || createOpenClawWebSearchProviderDraft(selectedProvider),
  };
}

export function applyOpenClawWebSearchProviderDraftChange(args: {
  currentDrafts: Record<string, OpenClawWebSearchProviderDraftValue>;
  selectedProvider: OpenClawWebSearchProviderRecord | null;
  key: keyof OpenClawWebSearchProviderDraftValue;
  value: string;
}): Record<string, OpenClawWebSearchProviderDraftValue> {
  if (!args.selectedProvider) {
    return args.currentDrafts;
  }

  return {
    ...args.currentDrafts,
    [args.selectedProvider.id]: {
      ...(args.currentDrafts[args.selectedProvider.id] ||
        createOpenClawWebSearchProviderDraft(args.selectedProvider)),
      [args.key]: args.value,
    },
  };
}

export function createOpenClawXSearchDraft(
  config: InstanceWorkbenchSnapshot['configXSearch'] | null | undefined,
): OpenClawXSearchDraftValue | null {
  if (!config) {
    return null;
  }

  return {
    enabled: config.enabled,
    apiKeySource: normalizeOpenClawSecretSource(config.apiKeySource),
    model: config.model,
    inlineCitations: config.inlineCitations,
    maxTurns: String(config.maxTurns),
    timeoutSeconds: String(config.timeoutSeconds),
    cacheTtlMinutes: String(config.cacheTtlMinutes),
    advancedConfig: config.advancedConfig,
  };
}

export function createOpenClawWebSearchNativeCodexDraft(
  config: InstanceWorkbenchSnapshot['configWebSearchNativeCodex'] | null | undefined,
): OpenClawWebSearchNativeCodexDraftValue | null {
  if (!config) {
    return null;
  }

  return {
    enabled: config.enabled,
    mode: config.mode,
    allowedDomains: config.allowedDomains.join('\n'),
    contextSize: config.contextSize,
    userLocationCountry: config.userLocation.country,
    userLocationCity: config.userLocation.city,
    userLocationTimezone: config.userLocation.timezone,
    advancedConfig: config.advancedConfig,
  };
}

export function createOpenClawWebFetchSharedDraft(
  config: InstanceWorkbenchSnapshot['configWebFetch'] | null | undefined,
): OpenClawWebFetchSharedDraftValue | null {
  if (!config) {
    return null;
  }

  return {
    enabled: config.enabled,
    maxChars: String(config.maxChars),
    maxCharsCap: String(config.maxCharsCap),
    maxResponseBytes: String(config.maxResponseBytes),
    timeoutSeconds: String(config.timeoutSeconds),
    cacheTtlMinutes: String(config.cacheTtlMinutes),
    maxRedirects: String(config.maxRedirects),
    readability: config.readability,
    userAgent: config.userAgent,
  };
}

export function createOpenClawWebFetchFallbackDraft(
  config: InstanceWorkbenchSnapshot['configWebFetch'] | null | undefined,
): OpenClawWebFetchFallbackDraftValue {
  return {
    apiKeySource: normalizeOpenClawSecretSource(config?.fallbackProvider.apiKeySource),
    baseUrl: config?.fallbackProvider.baseUrl || '',
    advancedConfig: config?.fallbackProvider.advancedConfig || '',
  };
}

export function createOpenClawWebFetchDraftState(
  config: InstanceWorkbenchSnapshot['configWebFetch'] | null | undefined,
): OpenClawWebFetchDraftState {
  return {
    sharedDraft: createOpenClawWebFetchSharedDraft(config),
    fallbackDraft: createOpenClawWebFetchFallbackDraft(config),
  };
}

export function createOpenClawAuthCooldownsDraft(
  config: InstanceWorkbenchSnapshot['configAuthCooldowns'] | null | undefined,
): OpenClawAuthCooldownsDraftValue | null {
  if (!config) {
    return null;
  }

  return {
    rateLimitedProfileRotations: formatOptionalWholeNumber(config.rateLimitedProfileRotations),
    overloadedProfileRotations: formatOptionalWholeNumber(config.overloadedProfileRotations),
    overloadedBackoffMs: formatOptionalWholeNumber(config.overloadedBackoffMs),
    billingBackoffHours: formatOptionalWholeNumber(config.billingBackoffHours),
    billingMaxHours: formatOptionalWholeNumber(config.billingMaxHours),
    failureWindowHours: formatOptionalWholeNumber(config.failureWindowHours),
  };
}

function buildPositiveInteger(
  value: string,
  errorKey: string,
): DraftBuildResult<number> {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return {
      ok: false,
      errorKey,
    };
  }

  return {
    ok: true,
    value: parsed,
  };
}

function buildOptionalWholeNumber(
  value: string,
  errorKey: string,
): DraftBuildResult<number | undefined> {
  const normalized = value.trim();
  if (!normalized) {
    return {
      ok: true,
      value: undefined,
    };
  }

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return {
      ok: false,
      errorKey,
    };
  }

  return {
    ok: true,
    value: parsed,
  };
}

export function buildOpenClawWebSearchSaveInput(args: {
  sharedDraft: OpenClawWebSearchSharedDraftValue;
  providerId: string;
  providerDraft: OpenClawWebSearchProviderDraftValue;
}): DraftBuildResult<Omit<SaveOpenClawWebSearchConfigurationInput, 'configFile'>> {
  const provider = args.sharedDraft.provider.trim();
  if (!provider) {
    return {
      ok: false,
      errorKey: 'instances.detail.instanceWorkbench.webSearch.errors.providerRequired',
    };
  }

  const maxResults = buildPositiveInteger(
    args.sharedDraft.maxResults,
    'instances.detail.instanceWorkbench.webSearch.errors.maxResultsInvalid',
  );
  if (!maxResults.ok) {
    return maxResults;
  }

  const timeoutSeconds = buildPositiveInteger(
    args.sharedDraft.timeoutSeconds,
    'instances.detail.instanceWorkbench.webSearch.errors.timeoutInvalid',
  );
  if (!timeoutSeconds.ok) {
    return timeoutSeconds;
  }

  const cacheTtlMinutes = buildPositiveInteger(
    args.sharedDraft.cacheTtlMinutes,
    'instances.detail.instanceWorkbench.webSearch.errors.cacheTtlInvalid',
  );
  if (!cacheTtlMinutes.ok) {
    return cacheTtlMinutes;
  }

  return {
    ok: true,
    value: {
      enabled: args.sharedDraft.enabled,
      provider,
      maxResults: maxResults.value,
      timeoutSeconds: timeoutSeconds.value,
      cacheTtlMinutes: cacheTtlMinutes.value,
      providerConfig: {
        providerId: args.providerId,
        apiKeySource: normalizeOpenClawSecretSource(args.providerDraft.apiKeySource),
        baseUrl: args.providerDraft.baseUrl,
        model: args.providerDraft.model,
        advancedConfig: args.providerDraft.advancedConfig,
      },
    },
  };
}

export function buildOpenClawXSearchSaveInput(
  draft: OpenClawXSearchDraftValue,
): DraftBuildResult<Omit<SaveOpenClawXSearchConfigurationInput, 'configFile'>> {
  const maxTurns = buildPositiveInteger(
    draft.maxTurns,
    'instances.detail.instanceWorkbench.xSearch.errors.maxTurnsInvalid',
  );
  if (!maxTurns.ok) {
    return maxTurns;
  }

  const timeoutSeconds = buildPositiveInteger(
    draft.timeoutSeconds,
    'instances.detail.instanceWorkbench.xSearch.errors.timeoutInvalid',
  );
  if (!timeoutSeconds.ok) {
    return timeoutSeconds;
  }

  const cacheTtlMinutes = buildPositiveInteger(
    draft.cacheTtlMinutes,
    'instances.detail.instanceWorkbench.xSearch.errors.cacheTtlInvalid',
  );
  if (!cacheTtlMinutes.ok) {
    return cacheTtlMinutes;
  }

  return {
    ok: true,
    value: {
      enabled: draft.enabled,
      apiKeySource: normalizeOpenClawSecretSource(draft.apiKeySource),
      model: draft.model,
      inlineCitations: draft.inlineCitations,
      maxTurns: maxTurns.value,
      timeoutSeconds: timeoutSeconds.value,
      cacheTtlMinutes: cacheTtlMinutes.value,
      advancedConfig: draft.advancedConfig,
    },
  };
}

export function buildOpenClawWebSearchNativeCodexSaveInput(
  draft: OpenClawWebSearchNativeCodexDraftValue,
): Omit<SaveOpenClawWebSearchNativeCodexConfigurationInput, 'configFile'> {
  const allowedDomains = [
    ...new Set(
      draft.allowedDomains
        .split(/\r?\n|,/)
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ];

  return {
    enabled: draft.enabled,
    mode: draft.mode,
    allowedDomains,
    contextSize: draft.contextSize,
    userLocation: {
      country: draft.userLocationCountry,
      city: draft.userLocationCity,
      timezone: draft.userLocationTimezone,
    },
    advancedConfig: draft.advancedConfig,
  };
}

export function buildOpenClawWebFetchSaveInput(args: {
  sharedDraft: OpenClawWebFetchSharedDraftValue;
  fallbackDraft: OpenClawWebFetchFallbackDraftValue;
}): DraftBuildResult<Omit<SaveOpenClawWebFetchConfigurationInput, 'configFile'>> {
  const maxChars = buildPositiveInteger(
    args.sharedDraft.maxChars,
    'instances.detail.instanceWorkbench.webFetch.errors.maxCharsInvalid',
  );
  if (!maxChars.ok) {
    return maxChars;
  }

  const maxCharsCap = buildPositiveInteger(
    args.sharedDraft.maxCharsCap,
    'instances.detail.instanceWorkbench.webFetch.errors.maxCharsCapInvalid',
  );
  if (!maxCharsCap.ok) {
    return maxCharsCap;
  }

  const maxResponseBytes = buildPositiveInteger(
    args.sharedDraft.maxResponseBytes,
    'instances.detail.instanceWorkbench.webFetch.errors.maxResponseBytesInvalid',
  );
  if (!maxResponseBytes.ok) {
    return maxResponseBytes;
  }

  const timeoutSeconds = buildPositiveInteger(
    args.sharedDraft.timeoutSeconds,
    'instances.detail.instanceWorkbench.webFetch.errors.timeoutInvalid',
  );
  if (!timeoutSeconds.ok) {
    return timeoutSeconds;
  }

  const cacheTtlMinutes = buildPositiveInteger(
    args.sharedDraft.cacheTtlMinutes,
    'instances.detail.instanceWorkbench.webFetch.errors.cacheTtlInvalid',
  );
  if (!cacheTtlMinutes.ok) {
    return cacheTtlMinutes;
  }

  const maxRedirects = buildPositiveInteger(
    args.sharedDraft.maxRedirects,
    'instances.detail.instanceWorkbench.webFetch.errors.maxRedirectsInvalid',
  );
  if (!maxRedirects.ok) {
    return maxRedirects;
  }

  return {
    ok: true,
    value: {
      enabled: args.sharedDraft.enabled,
      maxChars: maxChars.value,
      maxCharsCap: maxCharsCap.value,
      maxResponseBytes: maxResponseBytes.value,
      timeoutSeconds: timeoutSeconds.value,
      cacheTtlMinutes: cacheTtlMinutes.value,
      maxRedirects: maxRedirects.value,
      readability: args.sharedDraft.readability,
      userAgent: args.sharedDraft.userAgent,
      fallbackProviderConfig: {
        providerId: 'firecrawl',
        apiKeySource: normalizeOpenClawSecretSource(args.fallbackDraft.apiKeySource),
        baseUrl: args.fallbackDraft.baseUrl,
        advancedConfig: args.fallbackDraft.advancedConfig,
      },
    },
  };
}

export function buildOpenClawAuthCooldownsSaveInput(
  draft: OpenClawAuthCooldownsDraftValue,
): DraftBuildResult<Omit<SaveOpenClawAuthCooldownsConfigurationInput, 'configFile'>> {
  const rateLimitedProfileRotations = buildOptionalWholeNumber(
    draft.rateLimitedProfileRotations,
    'instances.detail.instanceWorkbench.authCooldowns.errors.rateLimitedProfileRotationsInvalid',
  );
  if (!rateLimitedProfileRotations.ok) {
    return rateLimitedProfileRotations;
  }

  const overloadedProfileRotations = buildOptionalWholeNumber(
    draft.overloadedProfileRotations,
    'instances.detail.instanceWorkbench.authCooldowns.errors.overloadedProfileRotationsInvalid',
  );
  if (!overloadedProfileRotations.ok) {
    return overloadedProfileRotations;
  }

  const overloadedBackoffMs = buildOptionalWholeNumber(
    draft.overloadedBackoffMs,
    'instances.detail.instanceWorkbench.authCooldowns.errors.overloadedBackoffMsInvalid',
  );
  if (!overloadedBackoffMs.ok) {
    return overloadedBackoffMs;
  }

  const billingBackoffHours = buildOptionalWholeNumber(
    draft.billingBackoffHours,
    'instances.detail.instanceWorkbench.authCooldowns.errors.billingBackoffHoursInvalid',
  );
  if (!billingBackoffHours.ok) {
    return billingBackoffHours;
  }

  const billingMaxHours = buildOptionalWholeNumber(
    draft.billingMaxHours,
    'instances.detail.instanceWorkbench.authCooldowns.errors.billingMaxHoursInvalid',
  );
  if (!billingMaxHours.ok) {
    return billingMaxHours;
  }

  const failureWindowHours = buildOptionalWholeNumber(
    draft.failureWindowHours,
    'instances.detail.instanceWorkbench.authCooldowns.errors.failureWindowHoursInvalid',
  );
  if (!failureWindowHours.ok) {
    return failureWindowHours;
  }

  return {
    ok: true,
    value: {
      rateLimitedProfileRotations: rateLimitedProfileRotations.value,
      overloadedProfileRotations: overloadedProfileRotations.value,
      overloadedBackoffMs: overloadedBackoffMs.value,
      billingBackoffHours: billingBackoffHours.value,
      billingMaxHours: billingMaxHours.value,
      failureWindowHours: failureWindowHours.value,
    },
  };
}
