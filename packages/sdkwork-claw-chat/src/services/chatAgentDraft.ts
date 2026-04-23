import type { KernelAgentLibraryItem } from '@sdkwork/claw-core';

export type ChatAgentStreamingMode = 'inherit' | 'enabled' | 'disabled';

export interface ChatAgentDraft {
  agentId: string;
  displayName: string;
  avatar: string;
  primaryModel: string;
  fallbackModelsText: string;
  workspace: string;
  agentDir: string;
  temperature: string;
  topP: string;
  maxTokens: string;
  timeoutMs: string;
  isDefault: boolean;
  streamingMode: ChatAgentStreamingMode;
}

export function createChatAgentDraft(): ChatAgentDraft {
  return {
    agentId: '',
    displayName: '',
    avatar: '',
    primaryModel: '',
    fallbackModelsText: '',
    workspace: '',
    agentDir: '',
    temperature: '',
    topP: '',
    maxTokens: '',
    timeoutMs: '',
    isDefault: false,
    streamingMode: 'inherit',
  };
}

export function slugifyChatAgentId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function parseChatAgentFallbackModels(value: string) {
  return Array.from(
    new Set(
      value
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

export function parseChatAgentOptionalNumber(value: string, fieldName: string) {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(fieldName);
  }

  return parsed;
}

function resolveStreamingMode(value: boolean | null): ChatAgentStreamingMode {
  if (value === true) {
    return 'enabled';
  }

  if (value === false) {
    return 'disabled';
  }

  return 'inherit';
}

export function createChatAgentDraftFromLibraryAgent(
  agent: KernelAgentLibraryItem,
): ChatAgentDraft {
  return {
    agentId: `${slugifyChatAgentId(agent.agentId) || 'agent'}-copy`,
    displayName: `${agent.displayName} Copy`,
    avatar: agent.avatar,
    primaryModel: agent.model.primary ?? '',
    fallbackModelsText: agent.model.fallbacks.join('\n'),
    workspace: '',
    agentDir: '',
    temperature:
      typeof agent.params.temperature === 'number' ? String(agent.params.temperature) : '',
    topP: typeof agent.params.topP === 'number' ? String(agent.params.topP) : '',
    maxTokens:
      typeof agent.params.maxTokens === 'number' ? String(agent.params.maxTokens) : '',
    timeoutMs:
      typeof agent.params.timeoutMs === 'number' ? String(agent.params.timeoutMs) : '',
    isDefault: false,
    streamingMode: resolveStreamingMode(agent.params.streaming),
  };
}
