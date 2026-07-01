import type {
  CreateKernelAgentRequest,
  KernelAgentCreationKernelOption,
} from '@sdkwork/claw-core';
import {
  normalizeChatAgentFallbackModels,
  type ChatAgentDraft,
} from './chatAgentDraft.ts';

export interface ResolvedKernelAgentCreationFieldSupport {
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

const UNAVAILABLE_FIELD_SUPPORT: ResolvedKernelAgentCreationFieldSupport = {
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

export function resolveKernelAgentCreationFieldSupport(
  option: KernelAgentCreationKernelOption | null | undefined,
): ResolvedKernelAgentCreationFieldSupport {
  if (!option) {
    return UNAVAILABLE_FIELD_SUPPORT;
  }

  const fieldSupport = option?.fieldSupport;
  if (!fieldSupport) {
    throw new Error(
      `Kernel "${option.kernelId}" must declare explicit field support for agent creation.`,
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

export function buildChatAgentCreateRequest(input: {
  instanceId: string;
  kernelId: string;
  draft: ChatAgentDraft;
  fieldSupport: ResolvedKernelAgentCreationFieldSupport;
  temperature: number | null;
  topP: number | null;
  maxTokens: number | null;
  timeoutMs: number | null;
}): CreateKernelAgentRequest {
  const primaryModel =
    input.fieldSupport.primaryModel && input.draft.primaryModel.trim()
      ? input.draft.primaryModel.trim()
      : null;

  return {
    instanceId: input.instanceId,
    kernelId: input.kernelId,
    agentId: input.draft.agentId.trim(),
    displayName: input.draft.displayName.trim(),
    avatar: input.fieldSupport.avatar ? input.draft.avatar : null,
    isDefault: input.fieldSupport.isDefault ? input.draft.isDefault : false,
    primaryModel,
    fallbackModels: input.fieldSupport.fallbackModels
      ? normalizeChatAgentFallbackModels({
          value: input.draft.fallbackModelsText,
          primaryModel,
        })
      : [],
    workspace: input.fieldSupport.workspace ? input.draft.workspace : null,
    agentDir: input.fieldSupport.agentDir ? input.draft.agentDir : null,
    temperature: input.fieldSupport.temperature ? input.temperature : null,
    topP: input.fieldSupport.topP ? input.topP : null,
    maxTokens: input.fieldSupport.maxTokens ? input.maxTokens : null,
    timeoutMs: input.fieldSupport.timeoutMs ? input.timeoutMs : null,
    streaming: input.fieldSupport.streaming
      ? input.draft.streamingMode === 'inherit'
        ? null
        : input.draft.streamingMode === 'enabled'
      : null,
  };
}
