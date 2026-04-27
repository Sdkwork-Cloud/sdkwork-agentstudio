import type { Agent } from '@sdkwork/claw-types';
import { resolveChatSessionBinding, type ChatSessionBindingSource } from './chatSessionBinding.ts';
import {
  resolveChatSidebarFallbackAgentName,
  resolveChatSidebarKernelLabel,
} from './chatSessionOwnerPresentation.ts';

export type ChatAgentCatalogFallbackSession = ChatSessionBindingSource & {
  id?: string | null;
  updatedAt: number;
  agentLabel?: string | null;
};

function normalizeOptionalString(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return value ?? null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function resolveFallbackAvatar(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function resolveFallbackAgentLabel(session: ChatAgentCatalogFallbackSession, agentId: string) {
  const binding = resolveChatSessionBinding(session);
  const kernelLabel = resolveChatSidebarKernelLabel(binding.kernelId);

  return resolveChatSidebarFallbackAgentName({
    agentId,
    agentLabel:
      normalizeOptionalString(session.agentLabel) ??
      normalizeOptionalString(session.kernelSession?.actorBinding?.label),
    kernelLabel,
  });
}

export function mergeChatCatalogAgentsWithSessionFallback(params: {
  catalogAgents: Agent[];
  sessions: ChatAgentCatalogFallbackSession[];
}) {
  const catalogAgents = params.catalogAgents.map((agent) => ({ ...agent }));
  const knownAgentIds = new Set(
    catalogAgents
      .map((agent) => normalizeOptionalString(agent.id)?.toLowerCase() ?? null)
      .filter((agentId): agentId is string => Boolean(agentId)),
  );
  const fallbackSessions = [...params.sessions]
    .map((session) => ({
      session,
      binding: resolveChatSessionBinding(session),
    }))
    .filter((entry) => Boolean(entry.binding.agentId))
    .sort((left, right) => right.session.updatedAt - left.session.updatedAt);

  const fallbackAgents: Agent[] = [];
  for (const entry of fallbackSessions) {
    const agentId = entry.binding.agentId;
    const normalizedAgentId = normalizeOptionalString(agentId)?.toLowerCase() ?? null;
    if (!agentId || !normalizedAgentId || knownAgentIds.has(normalizedAgentId)) {
      continue;
    }

    knownAgentIds.add(normalizedAgentId);
    const name = resolveFallbackAgentLabel(entry.session, agentId);
    fallbackAgents.push({
      id: agentId,
      name,
      description: '',
      avatar: resolveFallbackAvatar(name),
      systemPrompt: '',
      creator: 'Session',
    });
  }

  return [...catalogAgents, ...fallbackAgents];
}
