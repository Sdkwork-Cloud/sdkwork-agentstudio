import { resolveChatSessionBinding, type ChatSessionBindingSource } from './chatSessionBinding.ts';
import { isOpaqueChatSessionTitle } from './chatSessionTitlePresentation.ts';

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
    .split(/[-_.\s]+/)
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

function isReadableChatAgentLabel(value: string | null | undefined) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return false;
  }

  const semanticLabel = normalizeSemanticLabel(normalized);
  if (semanticLabel && MAIN_AGENT_SEMANTIC_LABELS.has(semanticLabel)) {
    return true;
  }

  return !isOpaqueChatSessionTitle(normalized) && !isMachineLikeChatAgentId(normalized);
}

function isMachineLikeChatAgentId(value: string) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return true;
  }

  const segments = normalized.split(/[-_.:/\s]+/).filter(Boolean);
  if (segments.some((segment) => /^[0-9a-f]{8,}$/i.test(segment))) {
    return true;
  }

  const digitCount = (normalized.match(/\d/g) ?? []).length;
  if (digitCount >= 6) {
    return true;
  }

  const compact = normalized.replace(/[^a-z0-9]+/gi, '');
  return /^[a-z]*[0-9a-f]{12,}$/i.test(compact);
}

function resolveReadablePersistedAgentLabel(value: string | null | undefined) {
  const normalized = normalizeOptionalString(value);
  return isReadableChatAgentLabel(normalized) ? normalized : null;
}

function resolveReadableAgentIdLabel(value: string | null | undefined) {
  const normalized = normalizeOptionalString(value);
  return normalized &&
    isReadableChatAgentLabel(normalized) &&
    !isMachineLikeChatAgentId(normalized)
    ? titleizeIdentifier(normalized)
    : null;
}

export function resolveChatSidebarFallbackAgentName(params: {
  agentId: string | null | undefined;
  agentLabel?: string | null;
  kernelLabel?: string | null;
}) {
  const normalizedKernelLabel = normalizeOptionalString(params.kernelLabel);

  return (
    resolveReadablePersistedAgentLabel(params.agentLabel) ??
    resolveReadableAgentIdLabel(params.agentId) ??
    (normalizedKernelLabel ? `${normalizedKernelLabel} Agent` : null) ??
    'Agent'
  );
}

export function resolveChatAgentDisplayIdentity(params: {
  agentId: string | null | undefined;
  agentLabel?: string | null;
  avatarLabel?: string | null;
  kernelLabel?: string | null;
  fallbackAvatarWhenMissing?: boolean;
}) {
  const name = resolveChatSidebarFallbackAgentName({
    agentId: params.agentId,
    agentLabel: params.agentLabel,
    kernelLabel: params.kernelLabel,
  });
  const normalizedAgentLabel = normalizeOptionalString(params.agentLabel);
  const normalizedAvatarLabel = normalizeOptionalString(params.avatarLabel);

  return {
    name,
    avatarLabel:
      normalizedAgentLabel === name
        ? normalizedAvatarLabel ??
          (params.fallbackAvatarWhenMissing === false
            ? null
            : resolveFallbackAvatarLabel(name))
        : resolveFallbackAvatarLabel(name),
  };
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
    const identity = resolveChatAgentDisplayIdentity({
      agentId: agent.id,
      agentLabel: agent.name,
      avatarLabel: agent.avatar,
      kernelLabel,
    });

    return {
      id: agent.id,
      name: identity.name,
      avatarLabel: identity.avatarLabel,
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
    const kernelLabel = normalizeOptionalString(matchingAgent.kernelLabel) ?? bindingKernelLabel;
    const identity = resolveChatAgentDisplayIdentity({
      agentId: matchingAgent.id ?? binding.agentId,
      agentLabel: matchingAgent.name,
      avatarLabel: matchingAgent.avatarLabel,
      kernelLabel,
      fallbackAvatarWhenMissing: false,
    });

    return {
      id: matchingAgent.id,
      name: identity.name,
      avatarLabel: identity.avatarLabel,
      kernelLabel,
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
  const readablePersistedAgentLabel = resolveReadablePersistedAgentLabel(persistedAgentLabel);
  if (readablePersistedAgentLabel) {
    return {
      id: binding.agentId,
      name: readablePersistedAgentLabel,
      avatarLabel: resolveOwnerAvatarLabel(readablePersistedAgentLabel),
      kernelLabel: bindingKernelLabel,
    };
  }

  const fallbackAgentName = resolveChatSidebarFallbackAgentName({
    agentId: binding.agentId,
    agentLabel: persistedAgentLabel,
    kernelLabel: bindingKernelLabel,
  });

  return {
    id: binding.agentId,
    name: fallbackAgentName,
    avatarLabel: resolveOwnerAvatarLabel(fallbackAgentName),
    kernelLabel: bindingKernelLabel,
  };
}
