import { useMemo } from 'react';
import type { Agent, Skill } from '@sdkwork/clawstudio-types';
import type { ChatSession } from '../store/useChatStore';
import { buildChatAgentOptions, buildChatSkillOptions, type ChatContextOption } from './chatContextOptions';
import type {
  ChatPageAgentCatalogMode,
  ChatPageTranslate,
} from './chatPageContracts';
import {
  mergeChatCatalogAgentsWithSessionFallback,
  resolveChatSessionBinding,
  resolveChatSidebarKernelLabel,
} from '../services';
import { useChatAgentCatalogState } from './useChatAgentCatalogState';
import { useChatSkillCatalogState } from './useChatSkillCatalogState';

const EMPTY_CONTEXT_OPTIONS: ChatContextOption[] = [];

export interface UseChatContextCatalogStateInput {
  t: ChatPageTranslate;
  sessions: ChatSession[];
  activeInstanceId: string | null | undefined;
  activeSessionId: string | null;
  isChatSupportedRoute: boolean;
  agentCatalogMode: ChatPageAgentCatalogMode;
  isSessionContextDrawerOpen: boolean;
  selectedAgentId: string | null | undefined;
  selectedSkillId: string | null;
}

export interface UseChatContextCatalogStateResult {
  defaultAgentId: string | null;
  effectiveGatewayAgentId: string | null;
  hasResolvedVisibleAgents: boolean;
  visibleAgentIds: string[];
  isAgentSelectorLoading: boolean;
  isSkillSelectorLoading: boolean;
  agentOptions: ChatContextOption[];
  skillOptions: ChatContextOption[];
  visibleAgents: Agent[];
  activeAgent: Agent | undefined;
  activeSkill: Skill | undefined;
}

export function useChatContextCatalogState({
  t,
  sessions,
  activeInstanceId,
  activeSessionId,
  isChatSupportedRoute,
  agentCatalogMode,
  isSessionContextDrawerOpen,
  selectedAgentId,
  selectedSkillId,
}: UseChatContextCatalogStateInput): UseChatContextCatalogStateResult {
  const scopedSessions = useMemo(
    () =>
      sessions.filter((session) =>
        activeInstanceId
          ? session.instanceId === activeInstanceId
          : !session.instanceId,
      ),
    [activeInstanceId, sessions],
  );
  const activeSessionAgentId = useMemo(() => {
    if (!activeSessionId) {
      return null;
    }

    const activeSession =
      scopedSessions.find((session) => session.id === activeSessionId) ?? null;
    if (!activeSession) {
      return null;
    }

    return resolveChatSessionBinding(activeSession).agentId;
  }, [activeSessionId, scopedSessions]);
  const {
    defaultAgentId,
    effectiveGatewayAgentId,
    hasResolvedVisibleAgents,
    isAgentSelectorLoading,
    agentDefaultDescriptionKey,
    agentProfiles,
    visibleAgents,
  } = useChatAgentCatalogState({
    activeInstanceId,
    isChatSupportedRoute,
    agentCatalogMode,
    isSessionContextDrawerOpen,
    selectedAgentId,
    activeSessionAgentId,
  });
  const {
    visibleSkills,
    isSkillSelectorLoading,
  } = useChatSkillCatalogState({
    activeInstanceId,
    isChatSupportedRoute,
    isSessionContextDrawerOpen,
    selectedSkillId,
  });
  const mergedVisibleAgents = useMemo(
    () =>
      mergeChatCatalogAgentsWithSessionFallback({
        catalogAgents: visibleAgents,
        sessions: scopedSessions,
      }),
    [scopedSessions, visibleAgents],
  );
  const visibleAgentsWithKernel = useMemo(() => {
    const kernelIdByAgentId = new Map<string, string>();

    for (const profile of agentProfiles) {
      if (!profile.agentId || !profile.kernelId || kernelIdByAgentId.has(profile.agentId)) {
        continue;
      }

      kernelIdByAgentId.set(profile.agentId, profile.kernelId);
    }

    for (const session of [...scopedSessions].sort((left, right) => right.updatedAt - left.updatedAt)) {
      const binding = resolveChatSessionBinding(session);
      if (!binding.agentId || !binding.kernelId || kernelIdByAgentId.has(binding.agentId)) {
        continue;
      }

      kernelIdByAgentId.set(binding.agentId, binding.kernelId);
    }

    return mergedVisibleAgents.map((agent) => {
      const kernelId = kernelIdByAgentId.get(agent.id) ?? null;
      const kernelLabel = resolveChatSidebarKernelLabel(kernelId);

      return {
        ...agent,
        ...(kernelId ? { kernelId } : {}),
        ...(kernelLabel ? { kernelLabel } : {}),
      };
    });
  }, [agentProfiles, mergedVisibleAgents, scopedSessions]);
  const agentOptions = useMemo(
    () =>
      isChatSupportedRoute
        ? buildChatAgentOptions({
            agents: visibleAgentsWithKernel,
            defaultLabel: t('chat.page.noneDefault'),
            defaultDescription: t(agentDefaultDescriptionKey),
          })
        : EMPTY_CONTEXT_OPTIONS,
    [agentDefaultDescriptionKey, isChatSupportedRoute, t, visibleAgentsWithKernel],
  );
  const skillOptions = useMemo(
    () =>
      isChatSupportedRoute
        ? buildChatSkillOptions({
            skills: visibleSkills,
            defaultLabel: t('chat.page.noneGeneralChat'),
            defaultDescription: t('chat.page.defaultSkillDescription'),
          })
        : EMPTY_CONTEXT_OPTIONS,
    [isChatSupportedRoute, t, visibleSkills],
  );
  const visibleAgentIds = useMemo(
    () => visibleAgentsWithKernel.map((agent) => agent.id),
    [visibleAgentsWithKernel],
  );
  const activeAgent = visibleAgentsWithKernel.find((agent) => agent.id === effectiveGatewayAgentId);
  const activeSkill = visibleSkills.find((skill) => skill.id === selectedSkillId);

  return {
    defaultAgentId,
    effectiveGatewayAgentId,
    hasResolvedVisibleAgents,
    visibleAgentIds,
    isAgentSelectorLoading:
      isAgentSelectorLoading && visibleAgentsWithKernel.length === 0,
    isSkillSelectorLoading,
    agentOptions,
    skillOptions,
    visibleAgents: visibleAgentsWithKernel,
    activeAgent,
    activeSkill,
  };
}
