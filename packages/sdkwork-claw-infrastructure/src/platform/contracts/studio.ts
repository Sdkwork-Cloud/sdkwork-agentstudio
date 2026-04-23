import type {
  KernelChatAgentProfile,
  KernelChatMessage,
  PersistedKernelChatAgentRecord,
  KernelChatRun,
  KernelChatSession,
  StudioConversationRecord,
  StudioInstanceDetailRecord,
  StudioInstanceConfig,
  StudioInstanceDeploymentMode,
  StudioInstanceRecord,
  StudioInstanceStatus,
  StudioInstanceTransportKind,
  StudioRuntimeKind,
  StudioStorageBinding,
  StudioWorkbenchLLMProviderConfigRecord,
  StudioWorkbenchTaskExecutionRecord,
} from '@sdkwork/claw-types';

export interface StudioCreateInstanceInput {
  name: string;
  description?: string;
  runtimeKind: StudioRuntimeKind;
  deploymentMode: StudioInstanceDeploymentMode;
  transportKind: StudioInstanceTransportKind;
  iconType?: 'apple' | 'box' | 'server';
  version?: string;
  typeLabel?: string;
  host?: string;
  port?: number | null;
  baseUrl?: string | null;
  websocketUrl?: string | null;
  storage?: Partial<StudioStorageBinding>;
  config?: Partial<StudioInstanceConfig>;
}

export interface StudioUpdateInstanceInput
  extends Partial<
    Omit<
      StudioCreateInstanceInput,
      'runtimeKind' | 'deploymentMode' | 'transportKind'
    >
  > {
  status?: StudioInstanceStatus;
  isDefault?: boolean;
}

export type StudioInstanceTaskMutationPayload = Record<string, unknown>;
export interface StudioUpdateInstanceLlmProviderConfigInput {
  endpoint: string;
  apiKeySource: string;
  defaultModelId: string;
  reasoningModelId?: string;
  embeddingModelId?: string;
  config: StudioWorkbenchLLMProviderConfigRecord;
}

export interface StudioCreateKernelChatSessionInput {
  instanceId: string;
  model?: string | null;
  agentId?: string | null;
  title?: string | null;
}

export interface StudioPatchKernelChatSessionInput {
  instanceId: string;
  sessionId: string;
  title?: string | null;
  model?: string | null;
  thinkingLevel?: string | null;
  fastMode?: boolean | null;
  verboseLevel?: string | null;
  reasoningLevel?: string | null;
}

export interface StudioStartKernelChatRunInput {
  instanceId: string;
  sessionId: string;
  content: string;
  model?: string | null;
}

export interface StudioOpenClawGatewayInvokeRequest {
  tool: string;
  action?: string;
  args?: Record<string, unknown>;
  sessionKey?: string;
  dryRun?: boolean;
}

export interface StudioOpenClawGatewayInvokeOptions {
  messageChannel?: string;
  accountId?: string;
  headers?: Record<string, string>;
}

export type StudioKernelAgentCreationReasonCode =
  | 'unsupportedKernel'
  | 'configUnavailable'
  | 'configNotWritable';

export interface StudioKernelAgentCreationFieldSupport {
  avatar: boolean;
  isDefault: boolean;
  primaryModel: boolean;
  fallbackModels: boolean;
  workspace: boolean;
  agentDir: boolean;
  temperature: boolean;
  topP: boolean;
  maxTokens: boolean;
  timeoutMs: boolean;
  streaming: boolean;
}

export interface StudioKernelAgentCreationKernelOption {
  kernelId: string;
  label: string;
  supported: boolean;
  reasonCode: StudioKernelAgentCreationReasonCode | null;
  reason: string | null;
  modelOptions: StudioKernelAgentCreationModelOption[];
  fieldSupport: StudioKernelAgentCreationFieldSupport;
}

export interface StudioKernelAgentCreationModelOption {
  value: string;
  label: string;
  providerId: string;
  providerLabel: string;
}

export interface StudioKernelAgentCreationCapability {
  instanceId: string;
  instanceName: string;
  kernelOptions: StudioKernelAgentCreationKernelOption[];
  defaultKernelId: string | null;
}

export interface StudioCreateKernelAgentInput {
  instanceId: string;
  kernelId?: string | null;
  agentId: string;
  displayName: string;
  avatar?: string | null;
  isDefault?: boolean;
  primaryModel?: string | null;
  fallbackModels?: string[];
  workspace?: string | null;
  agentDir?: string | null;
  temperature?: number | null;
  topP?: number | null;
  maxTokens?: number | null;
  timeoutMs?: number | null;
  streaming?: boolean | null;
}

export interface StudioCreatedKernelAgentRecord {
  instanceId: string;
  kernelId: string;
  agentId: string;
  displayName: string;
}

export interface StudioPlatformAPI {
  listInstances(): Promise<StudioInstanceRecord[]>;
  getInstance(id: string): Promise<StudioInstanceRecord | null>;
  getInstanceDetail(id: string): Promise<StudioInstanceDetailRecord | null>;
  getKernelAgentCreationCapability?(
    instanceId: string,
  ): Promise<StudioKernelAgentCreationCapability>;
  createKernelAgent?(
    input: StudioCreateKernelAgentInput,
  ): Promise<StudioCreatedKernelAgentRecord>;
  listKernelChatAgentProfiles?(instanceId: string): Promise<KernelChatAgentProfile[]>;
  listPersistedKernelChatAgents?(instanceId: string): Promise<PersistedKernelChatAgentRecord[]>;
  replacePersistedKernelChatAgents?(
    instanceId: string,
    records: PersistedKernelChatAgentRecord[],
  ): Promise<PersistedKernelChatAgentRecord[]>;
  listKernelChatSessions?(instanceId: string): Promise<KernelChatSession[]>;
  getKernelChatSession?(
    instanceId: string,
    sessionId: string,
  ): Promise<KernelChatSession | null>;
  createKernelChatSession?(
    input: StudioCreateKernelChatSessionInput,
  ): Promise<KernelChatSession>;
  listKernelChatRuns?(
    instanceId: string,
    sessionId: string,
  ): Promise<KernelChatRun[]>;
  getKernelChatRun?(
    instanceId: string,
    sessionId: string,
    runId: string,
  ): Promise<KernelChatRun | null>;
  patchKernelChatSession?(
    input: StudioPatchKernelChatSessionInput,
  ): Promise<KernelChatSession>;
  deleteKernelChatSession?(instanceId: string, sessionId: string): Promise<void>;
  startKernelChatRun?(
    input: StudioStartKernelChatRunInput,
  ): Promise<KernelChatRun>;
  abortKernelChatRun?(
    instanceId: string,
    sessionId: string,
    runId?: string | null,
  ): Promise<boolean>;
  loadKernelChatMessages?(
    instanceId: string,
    sessionId: string,
  ): Promise<KernelChatMessage[]>;
  invokeOpenClawGateway?(
    instanceId: string,
    request: StudioOpenClawGatewayInvokeRequest,
    options?: StudioOpenClawGatewayInvokeOptions,
  ): Promise<unknown>;
  createInstance(input: StudioCreateInstanceInput): Promise<StudioInstanceRecord>;
  updateInstance(id: string, input: StudioUpdateInstanceInput): Promise<StudioInstanceRecord>;
  deleteInstance(id: string): Promise<boolean>;
  startInstance(id: string): Promise<StudioInstanceRecord | null>;
  stopInstance(id: string): Promise<StudioInstanceRecord | null>;
  restartInstance(id: string): Promise<StudioInstanceRecord | null>;
  setInstanceStatus(
    id: string,
    status: StudioInstanceStatus,
  ): Promise<StudioInstanceRecord | null>;
  getInstanceConfig(id: string): Promise<StudioInstanceConfig | null>;
  updateInstanceConfig(
    id: string,
    config: StudioInstanceConfig,
  ): Promise<StudioInstanceConfig | null>;
  getInstanceLogs(id: string): Promise<string>;
  createInstanceTask(
    instanceId: string,
    payload: StudioInstanceTaskMutationPayload,
  ): Promise<void>;
  updateInstanceTask(
    instanceId: string,
    taskId: string,
    payload: StudioInstanceTaskMutationPayload,
  ): Promise<void>;
  updateInstanceFileContent(
    instanceId: string,
    fileId: string,
    content: string,
  ): Promise<boolean>;
  updateInstanceLlmProviderConfig(
    instanceId: string,
    providerId: string,
    update: StudioUpdateInstanceLlmProviderConfigInput,
  ): Promise<boolean>;
  setInstanceChannelEnabled?(
    instanceId: string,
    channelId: string,
    enabled: boolean,
  ): Promise<boolean>;
  saveInstanceChannelConfig?(
    instanceId: string,
    channelId: string,
    values: Record<string, string>,
  ): Promise<boolean>;
  deleteInstanceChannelConfig?(instanceId: string, channelId: string): Promise<boolean>;
  cloneInstanceTask(instanceId: string, taskId: string, name?: string): Promise<void>;
  runInstanceTaskNow(
    instanceId: string,
    taskId: string,
  ): Promise<StudioWorkbenchTaskExecutionRecord>;
  listInstanceTaskExecutions(
    instanceId: string,
    taskId: string,
  ): Promise<StudioWorkbenchTaskExecutionRecord[]>;
  updateInstanceTaskStatus(
    instanceId: string,
    taskId: string,
    status: 'active' | 'paused',
  ): Promise<void>;
  deleteInstanceTask(instanceId: string, taskId: string): Promise<boolean>;
  listConversations(instanceId: string): Promise<StudioConversationRecord[]>;
  putConversation(record: StudioConversationRecord): Promise<StudioConversationRecord>;
  deleteConversation(id: string): Promise<boolean>;
}
