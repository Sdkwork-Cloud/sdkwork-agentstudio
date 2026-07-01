import type { OpenClawConfigSnapshot } from '@sdkwork/claw-core';
import type {
  InstanceKernelConfigInsights,
  InstanceWorkbenchSnapshot,
} from '../types/index.ts';
import { getArrayValue, getBooleanValue, getStringValue, isNonEmptyString } from './openClawSupport.ts';
import { cloneConfigChannel } from './openClawChannelWorkbenchSupport.ts';

type OpenClawWebSearchConfig = OpenClawConfigSnapshot['webSearchConfig'];
type OpenClawXSearchConfig = OpenClawConfigSnapshot['xSearchConfig'];
type OpenClawWebSearchNativeCodexConfig =
  OpenClawConfigSnapshot['webSearchNativeCodexConfig'];
type OpenClawWebFetchConfig = OpenClawConfigSnapshot['webFetchConfig'];
type OpenClawAuthCooldownsConfig = OpenClawConfigSnapshot['authCooldownsConfig'];
type OpenClawDreamingConfig = OpenClawConfigSnapshot['dreamingConfig'];

export type ConfigWorkbenchState = Pick<
  InstanceWorkbenchSnapshot,
  | 'configChannels'
  | 'kernelConfigInsights'
  | 'configWebSearch'
  | 'configXSearch'
  | 'configWebSearchNativeCodex'
  | 'configWebFetch'
  | 'configAuthCooldowns'
  | 'configDreaming'
> & {
  configSectionCount: number;
};

function cloneConfigWebSearchConfig(
  config: OpenClawWebSearchConfig | null | undefined,
) {
  if (!config) {
    return null;
  }

  return {
    ...config,
    providers: config.providers.map((provider) => ({ ...provider })),
  };
}

function cloneConfigXSearchConfig(
  config: OpenClawXSearchConfig | null | undefined,
) {
  return config ? { ...config } : null;
}

function cloneConfigWebSearchNativeCodexConfig(
  config: OpenClawWebSearchNativeCodexConfig | null | undefined,
) {
  if (!config) {
    return null;
  }

  return {
    ...config,
    allowedDomains: [...config.allowedDomains],
    userLocation: {
      ...config.userLocation,
    },
  };
}

function cloneConfigWebFetchConfig(
  config: OpenClawWebFetchConfig | null | undefined,
) {
  if (!config) {
    return null;
  }

  return {
    ...config,
    fallbackProvider: {
      ...config.fallbackProvider,
    },
  };
}

function cloneConfigAuthCooldownsConfig(
  config: OpenClawAuthCooldownsConfig | null | undefined,
) {
  return config ? { ...config } : null;
}

function cloneConfigDreamingConfig(
  config: OpenClawDreamingConfig | null | undefined,
) {
  return config ? { ...config } : null;
}

function buildConfigSectionCount(configFile: string | null | undefined) {
  return configFile ? 1 : 0;
}

export function buildKernelConfigInsights(
  configSnapshot: OpenClawConfigSnapshot | null | undefined,
): InstanceKernelConfigInsights | null {
  if (!configSnapshot) {
    return null;
  }

  const root = configSnapshot.root;
  const sessionsVisibility = getStringValue(root, ['tools', 'sessions', 'visibility']);

  return {
    defaultAgentId:
      configSnapshot.agentSnapshots.find((agent) => agent.isDefault)?.id || null,
    defaultModelRef: getStringValue(root, ['agents', 'defaults', 'model', 'primary']) || null,
    sessionsVisibility:
      sessionsVisibility === 'self' ||
      sessionsVisibility === 'tree' ||
      sessionsVisibility === 'agent' ||
      sessionsVisibility === 'all'
        ? sessionsVisibility
        : null,
    agentToAgentEnabled: Boolean(getBooleanValue(root, ['tools', 'agentToAgent', 'enabled'])),
    agentToAgentAllow: (getArrayValue(root, ['tools', 'agentToAgent', 'allow']) || [])
      .filter(isNonEmptyString)
      .map((value) => value.trim()),
  };
}

export function buildConfigWorkbenchState(
  configFile: string | null | undefined,
  configSnapshot: OpenClawConfigSnapshot | null | undefined,
): ConfigWorkbenchState {
  const normalizedConfigFile = configFile || null;

  return {
    configChannels: configSnapshot?.channelSnapshots.map(cloneConfigChannel),
    kernelConfigInsights: buildKernelConfigInsights(configSnapshot),
    configWebSearch: cloneConfigWebSearchConfig(configSnapshot?.webSearchConfig),
    configXSearch: cloneConfigXSearchConfig(configSnapshot?.xSearchConfig),
    configWebSearchNativeCodex: cloneConfigWebSearchNativeCodexConfig(
      configSnapshot?.webSearchNativeCodexConfig,
    ),
    configWebFetch: cloneConfigWebFetchConfig(configSnapshot?.webFetchConfig),
    configAuthCooldowns: cloneConfigAuthCooldownsConfig(
      configSnapshot?.authCooldownsConfig,
    ),
    configDreaming: cloneConfigDreamingConfig(
      configSnapshot?.dreamingConfig,
    ),
    configSectionCount: buildConfigSectionCount(normalizedConfigFile),
  };
}

export function createEmptyOpenClawConfigSnapshot(
  configFile = '',
): OpenClawConfigSnapshot {
  return {
    configFile,
    providerSnapshots: [],
    agentSnapshots: [],
    channelSnapshots: [],
    webSearchConfig: {
      enabled: true,
      provider: '',
      maxResults: 0,
      timeoutSeconds: 0,
      cacheTtlMinutes: 0,
      providers: [],
    },
    xSearchConfig: {
      enabled: false,
      apiKeySource: '',
      model: '',
      inlineCitations: false,
      maxTurns: 2,
      timeoutSeconds: 30,
      cacheTtlMinutes: 15,
      advancedConfig: '',
    },
    webFetchConfig: {
      enabled: true,
      maxChars: 50000,
      maxCharsCap: 50000,
      maxResponseBytes: 2000000,
      timeoutSeconds: 30,
      cacheTtlMinutes: 15,
      maxRedirects: 3,
      readability: true,
      userAgent: '',
      fallbackProvider: {
        providerId: 'firecrawl',
        name: 'Firecrawl Fetch',
        description: 'Use Firecrawl as the OpenClaw web_fetch fallback provider.',
        apiKeySource: '',
        baseUrl: '',
        advancedConfig: '',
        supportsApiKey: true,
        supportsBaseUrl: true,
      },
    },
    webSearchNativeCodexConfig: {
      enabled: false,
      mode: 'cached',
      allowedDomains: [],
      contextSize: '',
      userLocation: {
        country: '',
        city: '',
        timezone: '',
      },
      advancedConfig: '',
    },
    authCooldownsConfig: {
      rateLimitedProfileRotations: null,
      overloadedProfileRotations: null,
      overloadedBackoffMs: null,
      billingBackoffHours: null,
      billingMaxHours: null,
      failureWindowHours: null,
    },
    dreamingConfig: {
      enabled: false,
      frequency: '',
    },
    root: {},
  };
}
