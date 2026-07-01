import type {
  StudioInstanceCapabilityStatus,
  StudioInstanceDeploymentMode,
  StudioInstanceDetailRecord,
  StudioInstanceHealthStatus,
  StudioInstanceTransportKind,
  StudioRuntimeKind,
  StudioStorageBinding,
  StudioWorkbenchAgentRecord,
  StudioWorkbenchChannelRecord,
  StudioWorkbenchFileRecord,
  StudioWorkbenchLLMProviderConfigRecord,
  StudioWorkbenchLLMProviderRecord,
  StudioWorkbenchMemoryEntryRecord,
  StudioWorkbenchSkillRecord,
  StudioWorkbenchTaskExecutionRecord,
  StudioWorkbenchTaskRecord,
  StudioWorkbenchToolRecord,
  KernelAuthority,
  KernelConfig,
} from '@sdkwork/claw-types';
import type {
  OpenClawAuthCooldownsConfigSnapshot,
  OpenClawAgentParamSource,
  OpenClawAgentParamValue,
  OpenClawChannelSnapshot,
  OpenClawDreamingConfigSnapshot,
  OpenClawWebFetchConfigSnapshot,
  OpenClawWebSearchNativeCodexConfigSnapshot,
  OpenClawWebSearchConfigSnapshot,
  OpenClawXSearchConfigSnapshot,
} from '@sdkwork/claw-core';

export interface Instance {
  id: string;
  name: string;
  type: string;
  iconType: 'apple' | 'box' | 'server';
  status: 'online' | 'offline' | 'starting' | 'syncing' | 'error';
  version: string;
  uptime: string;
  ip: string;
  cpu: number;
  memory: number;
  totalMemory: string;
  isBuiltIn?: boolean;
  runtimeKind?: StudioRuntimeKind;
  deploymentMode?: StudioInstanceDeploymentMode;
  transportKind?: StudioInstanceTransportKind;
  baseUrl?: string | null;
  websocketUrl?: string | null;
  storage?: StudioStorageBinding;
}

export interface InstanceConfig {
  port: string;
  sandbox: boolean;
  autoUpdate: boolean;
  logLevel: string;
  corsOrigins: string;
}

export type InstanceWorkbenchSectionId =
  | 'overview'
  | 'channels'
  | 'cronTasks'
  | 'llmProviders'
  | 'agents'
  | 'skills'
  | 'files'
  | 'memory'
  | 'tools'
  | 'config';

export interface InstanceKernelConfigInsights {
  defaultAgentId: string | null;
  defaultModelRef: string | null;
  sessionsVisibility: 'self' | 'tree' | 'agent' | 'all' | null;
  agentToAgentEnabled: boolean;
  agentToAgentAllow: string[];
}

export type InstanceWorkbenchChannel = StudioWorkbenchChannelRecord;
export type InstanceWorkbenchTask = StudioWorkbenchTaskRecord;
export type InstanceWorkbenchTaskExecution = StudioWorkbenchTaskExecutionRecord;
export interface InstanceWorkbenchAgent extends StudioWorkbenchAgentRecord {
  workspace?: string;
  agentDir?: string;
  isDefault?: boolean;
  model?: {
    primary?: string;
    fallbacks: string[];
  };
  params?: Record<string, OpenClawAgentParamValue>;
  paramSources?: Record<string, OpenClawAgentParamSource>;
  configSource?: 'configFile' | 'runtime';
}
export type InstanceWorkbenchFile = StudioWorkbenchFileRecord;
export type InstanceWorkbenchLLMProviderConfig = StudioWorkbenchLLMProviderConfigRecord;
export type InstanceWorkbenchLLMProvider = StudioWorkbenchLLMProviderRecord;

export interface InstanceLLMProviderUpdate {
  endpoint: string;
  apiKeySource: string;
  defaultModelId: string;
  reasoningModelId?: string;
  embeddingModelId?: string;
  config: InstanceWorkbenchLLMProviderConfig;
}

export type InstanceWorkbenchMemoryEntry = StudioWorkbenchMemoryEntryRecord;
export type InstanceWorkbenchTool = StudioWorkbenchToolRecord;

export interface InstanceWorkbenchSectionAvailability {
  status: StudioInstanceCapabilityStatus;
  detail: string;
}

export interface InstanceWorkbenchSnapshot {
  instance: Instance;
  config: InstanceConfig;
  token: string;
  logs: string;
  detail: StudioInstanceDetailRecord;
  kernelConfig?: KernelConfig | null;
  kernelAuthority?: KernelAuthority | null;
  configChannels?: OpenClawChannelSnapshot[];
  kernelConfigInsights?: InstanceKernelConfigInsights | null;
  configWebSearch?: OpenClawWebSearchConfigSnapshot | null;
  configXSearch?: OpenClawXSearchConfigSnapshot | null;
  configWebSearchNativeCodex?: OpenClawWebSearchNativeCodexConfigSnapshot | null;
  configWebFetch?: OpenClawWebFetchConfigSnapshot | null;
  configAuthCooldowns?: OpenClawAuthCooldownsConfigSnapshot | null;
  configDreaming?: OpenClawDreamingConfigSnapshot | null;
  healthScore: number;
  runtimeStatus: StudioInstanceHealthStatus;
  connectedChannelCount: number;
  activeTaskCount: number;
  installedSkillCount: number;
  readyToolCount: number;
  sectionCounts: Record<InstanceWorkbenchSectionId, number>;
  sectionAvailability: Record<InstanceWorkbenchSectionId, InstanceWorkbenchSectionAvailability>;
  channels: InstanceWorkbenchChannel[];
  tasks: InstanceWorkbenchTask[];
  agents: InstanceWorkbenchAgent[];
  skills: StudioWorkbenchSkillRecord[];
  files: InstanceWorkbenchFile[];
  llmProviders: InstanceWorkbenchLLMProvider[];
  memories: InstanceWorkbenchMemoryEntry[];
  tools: InstanceWorkbenchTool[];
}
