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

function normalizeOptionalString(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return value ?? null;
  }

  const normalized = value.trim();
  return normalized || null;
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

export function normalizeChatAgentFallbackModels(input: {
  value: string;
  primaryModel?: string | null;
  allowedModelValues?: string[] | null;
}) {
  const primaryModel = normalizeOptionalString(input.primaryModel);
  const allowedModelValues =
    input.allowedModelValues && input.allowedModelValues.length > 0
      ? new Set(
          input.allowedModelValues
            .map((value) => normalizeOptionalString(value))
            .filter((value): value is string => Boolean(value)),
        )
      : null;

  return parseChatAgentFallbackModels(input.value).filter((model) => {
    if (primaryModel && model === primaryModel) {
      return false;
    }

    if (allowedModelValues && !allowedModelValues.has(model)) {
      return false;
    }

    return true;
  });
}

export function formatChatAgentFallbackModels(models: string[]) {
  return Array.from(
    new Set(
      models
        .map((model) => normalizeOptionalString(model))
        .filter((model): model is string => Boolean(model)),
    ),
  ).join('\n');
}

export function toggleChatAgentFallbackModel(input: {
  value: string;
  currentValue: string;
  primaryModel?: string | null;
  allowedModelValues?: string[] | null;
}) {
  const nextValue = normalizeOptionalString(input.value);
  const currentModels = normalizeChatAgentFallbackModels({
    value: input.currentValue,
    primaryModel: input.primaryModel,
    allowedModelValues: input.allowedModelValues,
  });

  if (!nextValue) {
    return formatChatAgentFallbackModels(currentModels);
  }

  const nextModels = currentModels.includes(nextValue)
    ? currentModels.filter((model) => model !== nextValue)
    : [...currentModels, nextValue];

  return formatChatAgentFallbackModels(
    normalizeChatAgentFallbackModels({
      value: formatChatAgentFallbackModels(nextModels),
      primaryModel: input.primaryModel,
      allowedModelValues: input.allowedModelValues,
    }),
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
