const GENERAL_CHAT_THINKING_LEVEL_OPTIONS = [
  'off',
  'minimal',
  'low',
  'medium',
  'high',
  'adaptive',
] as const;

const ZAI_CHAT_THINKING_LEVEL_OPTIONS = ['off', 'on'] as const;
const REASONING_MODEL_PATTERN =
  /(reason|reasoner|thinking|\bo1\b|\bo3\b|\bo4\b|\br1\b|\bt1\b|\bk1\b|\bqwq\b|claude(?:[-._]?(?:3[-._]?7|4))|glm(?:[-._]?[45])|opus)/i;
const ANTHROPIC_ADAPTIVE_PROVIDER_IDS = new Set([
  'anthropic',
  'amazon-bedrock',
  'aws-bedrock',
  'bedrock',
]);

export type ChatThinkingLevelOption =
  | (typeof GENERAL_CHAT_THINKING_LEVEL_OPTIONS)[number]
  | (typeof ZAI_CHAT_THINKING_LEVEL_OPTIONS)[number];

function normalizeModelProviderId(modelId: string | null | undefined) {
  const normalizedModelId = modelId?.trim().toLowerCase();
  if (!normalizedModelId) {
    return null;
  }

  const separatorIndex = normalizedModelId.indexOf('/');
  if (separatorIndex <= 0) {
    return null;
  }

  return normalizedModelId.slice(0, separatorIndex);
}

function normalizeModelRef(modelId: string | null | undefined) {
  const normalizedModelId = modelId?.trim().toLowerCase();
  return normalizedModelId || null;
}

function isZaiProvider(providerId: string | null) {
  return providerId === 'zai' || providerId === 'z.ai' || providerId === 'z-ai';
}

function isAnthropicAdaptiveDefaultModel(modelRef: string, providerId: string | null) {
  if (!providerId || !ANTHROPIC_ADAPTIVE_PROVIDER_IDS.has(providerId)) {
    return false;
  }

  if (!modelRef.includes('claude')) {
    return false;
  }

  return /\b4(?:[._-]?6)\b/.test(modelRef);
}

function isReasoningCapableModel(modelRef: string) {
  return REASONING_MODEL_PATTERN.test(modelRef);
}

export function resolveChatThinkingLevelDefaultOption(
  modelId: string | null | undefined,
): ChatThinkingLevelOption | null {
  const modelRef = normalizeModelRef(modelId);
  const providerId = normalizeModelProviderId(modelId);
  if (!modelRef || !providerId) {
    return null;
  }

  if (isAnthropicAdaptiveDefaultModel(modelRef, providerId)) {
    return 'adaptive';
  }

  const resolvedDefault = isReasoningCapableModel(modelRef) ? 'low' : 'off';
  if (isZaiProvider(providerId)) {
    return resolvedDefault === 'off' ? 'off' : 'on';
  }

  return resolvedDefault;
}

export function resolveChatThinkingLevelOptions(
  modelId: string | null | undefined,
): ChatThinkingLevelOption[] {
  const providerId = normalizeModelProviderId(modelId);
  if (!providerId) {
    return [];
  }

  if (isZaiProvider(providerId)) {
    return [...ZAI_CHAT_THINKING_LEVEL_OPTIONS];
  }

  return [...GENERAL_CHAT_THINKING_LEVEL_OPTIONS];
}
