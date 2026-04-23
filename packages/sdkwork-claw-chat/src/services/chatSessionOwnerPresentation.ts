import { resolveChatSessionBinding, type ChatSessionBindingSource } from './chatSessionBinding.ts';

export interface ChatSidebarAgentOption {
  id: string | null;
  name: string;
  avatarLabel: string | null;
  kernelId?: string | null;
  kernelLabel?: string | null;
  matchAgentIds?: string[];
}

export interface ChatSessionOwnerPresentation {
  id: string | null;
  name: string;
  avatarLabel: string | null;
  kernelLabel: string | null;
}

function normalizeOptionalString(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return value ?? null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function sameAgentId(left: string | null, right: string | null) {
  return normalizeOptionalString(left) === normalizeOptionalString(right);
}

function normalizeSemanticLabel(value: string | null | undefined) {
  const normalized = normalizeOptionalString(value);
  return normalized
    ? normalized.toLowerCase().replace(/[\s_-]+/g, '')
    : null;
}

function titleizeIdentifier(value: string) {
  return value
    .split(/[-_.]/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

const KNOWN_KERNEL_LABELS: Record<string, string> = {
  openclaw: 'OpenClaw',
  hermes: 'Hermes',
  zeroclaw: 'ZeroClaw',
  ironclaw: 'IronClaw',
};

const MAIN_AGENT_SEMANTIC_LABELS = new Set([
  'main',
  'mainagent',
]);

function resolveFallbackAvatarLabel(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function resolveOwnerAvatarLabel(value: string | null | undefined) {
  const normalized = normalizeOptionalString(value);
  return normalized ? normalized.slice(0, 2).toUpperCase() : null;
}

function resolvePersistedAgentLabel(
  session: ChatSessionBindingSource | null | undefined,
) {
  return (
    normalizeOptionalString(session?.agentLabel) ??
    normalizeOptionalString(session?.kernelSession?.actorBinding?.label) ??
    null
  );
}

function isSemanticMainAgentCandidate(input: {
  id: string | null;
  name: string;
  mainAgentLabel: string;
}) {
  const normalizedId = normalizeOptionalString(input.id)?.toLowerCase() ?? null;
  if (normalizedId === 'main') {
    return true;
  }

  const normalizedName = normalizeSemanticLabel(input.name);
  if (!normalizedName) {
    return false;
  }

  return (
    MAIN_AGENT_SEMANTIC_LABELS.has(normalizedName) ||
    normalizedName === normalizeSemanticLabel(input.mainAgentLabel)
  );
}

export function resolveChatSessionAgentId(
  session: ChatSessionBindingSource | null | undefined,
): string | null {
  return resolveChatSessionBinding(session).agentId;
}

export function resolveChatSidebarKernelLabel(
  kernelId: string | null | undefined,
) {
  const normalizedKernelId = normalizeOptionalString(kernelId)?.toLowerCase() ?? null;
  if (!normalizedKernelId) {
    return null;
  }

  return KNOWN_KERNEL_LABELS[normalizedKernelId] ?? titleizeIdentifier(normalizedKernelId);
}

export function resolveChatSidebarAgentOptionMatchIds(
  option: Pick<ChatSidebarAgentOption, 'id' | 'matchAgentIds'>,
) {
  const normalizedIds = new Set<string>();

  const normalizedId = normalizeOptionalString(option.id)?.toLowerCase() ?? null;
  if (normalizedId) {
    normalizedIds.add(normalizedId);
  }

  for (const candidate of option.matchAgentIds ?? []) {
    const normalizedCandidate = normalizeOptionalString(candidate)?.toLowerCase() ?? null;
    if (normalizedCandidate) {
      normalizedIds.add(normalizedCandidate);
    }
  }

  return [...normalizedIds];
}

export function matchesChatSidebarAgentOption(
  option: Pick<ChatSidebarAgentOption, 'id' | 'matchAgentIds'>,
  agentId: string | null | undefined,
) {
  const normalizedAgentId = normalizeOptionalString(agentId)?.toLowerCase() ?? null;
  if (normalizedAgentId === null) {
    return option.id === null;
  }

  return resolveChatSidebarAgentOptionMatchIds(option).includes(normalizedAgentId);
}

export function findChatSidebarAgentOption(
  agentOptions: ChatSidebarAgentOption[],
  agentId: string | null | undefined,
) {
  return agentOptions.find((option) => matchesChatSidebarAgentOption(option, agentId));
}

export function buildChatSidebarAgentOptions(input: {
  sessionScopeMode: 'all' | 'agentBound';
  visibleAgents: Array<{
    id: string;
    name: string;
    avatar?: string | null;
    kernelId?: string | null;
    kernelLabel?: string | null;
  }>;
  mainAgentLabel: string;
}): ChatSidebarAgentOption[] {
  const visibleAgents = input.visibleAgents.map((agent) => {
    const kernelId = normalizeOptionalString(agent.kernelId);
    const kernelLabel =
      normalizeOptionalString(agent.kernelLabel) ??
      resolveChatSidebarKernelLabel(agent.kernelId);

    return {
      id: agent.id,
      name: agent.name,
      avatarLabel:
        normalizeOptionalString(agent.avatar) ?? resolveFallbackAvatarLabel(agent.name),
      ...(kernelId ? { kernelId } : {}),
      ...(kernelLabel ? { kernelLabel } : {}),
    } satisfies ChatSidebarAgentOption;
  });

  if (input.sessionScopeMode === 'agentBound') {
    return visibleAgents;
  }

  const semanticMainAgents = visibleAgents.filter((agent) =>
    isSemanticMainAgentCandidate({
      id: agent.id,
      name: agent.name,
      mainAgentLabel: input.mainAgentLabel,
    }),
  );
  const primarySemanticMainAgent = semanticMainAgents[0] ?? null;
  const remainingAgents = visibleAgents.filter((agent) =>
    !semanticMainAgents.some((candidate) => sameAgentId(candidate.id, agent.id)),
  );
  const semanticMainAliases = [...new Set(
    semanticMainAgents
      .map((agent) => normalizeOptionalString(agent.id)?.toLowerCase() ?? null)
      .filter((agentId): agentId is string => Boolean(agentId)),
  )];

  return [
    {
      id: null,
      name: input.mainAgentLabel,
      avatarLabel: primarySemanticMainAgent?.avatarLabel ?? null,
      ...(primarySemanticMainAgent?.kernelId
        ? { kernelId: primarySemanticMainAgent.kernelId }
        : {}),
      ...(primarySemanticMainAgent?.kernelLabel
        ? { kernelLabel: primarySemanticMainAgent.kernelLabel }
        : {}),
      ...(semanticMainAliases.length > 0 ? { matchAgentIds: semanticMainAliases } : {}),
    },
    ...remainingAgents,
  ];
}

export function resolveChatSessionOwnerPresentation(params: {
  session: ChatSessionBindingSource | null | undefined;
  agentOptions: ChatSidebarAgentOption[];
  fallbackName?: string | null;
}): ChatSessionOwnerPresentation {
  const binding = resolveChatSessionBinding(params.session);
  const matchingAgent = findChatSidebarAgentOption(params.agentOptions, binding.agentId);
  const bindingKernelLabel = resolveChatSidebarKernelLabel(binding.kernelId);
  if (matchingAgent) {
    return {
      id: matchingAgent.id,
      name: matchingAgent.name,
      avatarLabel: matchingAgent.avatarLabel,
      kernelLabel: normalizeOptionalString(matchingAgent.kernelLabel) ?? bindingKernelLabel,
    };
  }

  if (binding.agentId === null) {
    return {
      id: null,
      name: normalizeOptionalString(params.fallbackName) ?? 'Main Agent',
      avatarLabel: null,
      kernelLabel: bindingKernelLabel,
    };
  }

  const persistedAgentLabel = resolvePersistedAgentLabel(params.session);
  if (persistedAgentLabel) {
    return {
      id: binding.agentId,
      name: persistedAgentLabel,
      avatarLabel: resolveOwnerAvatarLabel(persistedAgentLabel),
      kernelLabel: bindingKernelLabel,
    };
  }

  return {
    id: binding.agentId,
    name: binding.agentId,
    avatarLabel: resolveOwnerAvatarLabel(binding.agentId),
    kernelLabel: bindingKernelLabel,
  };
}
