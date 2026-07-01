import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Agent, KernelChatAgentProfile } from '@sdkwork/claw-types';
import {
  kernelChatAgentCatalogService,
  resolveChatAgentCatalogState,
  shouldLoadKernelChatAgentCatalog,
} from '../services';
import { openClawGatewaySessions } from '../store/chatStore';
import type { ChatPageAgentCatalogMode } from './chatPageContracts';
import { shouldLoadChatDirectAgents } from './chatHydrationPolicy';

const EMPTY_AGENTS: Agent[] = [];
const EMPTY_AGENT_PROFILES: KernelChatAgentProfile[] = [];

export interface UseChatAgentCatalogStateInput {
  activeInstanceId: string | null | undefined;
  isChatSupportedRoute: boolean;
  agentCatalogMode: ChatPageAgentCatalogMode;
  isSessionContextDrawerOpen: boolean;
  selectedAgentId: string | null | undefined;
  activeSessionAgentId?: string | null;
}

export interface UseChatAgentCatalogStateResult {
  defaultAgentId: string | null;
  effectiveGatewayAgentId: string | null;
  hasResolvedVisibleAgents: boolean;
  visibleAgentIds: string[];
  isAgentSelectorLoading: boolean;
  agentDefaultDescriptionKey: string;
  agentProfiles: KernelChatAgentProfile[];
  visibleAgents: Agent[];
}

export function useChatAgentCatalogState({
  activeInstanceId,
  isChatSupportedRoute,
  agentCatalogMode,
  isSessionContextDrawerOpen,
  selectedAgentId,
  activeSessionAgentId,
}: UseChatAgentCatalogStateInput): UseChatAgentCatalogStateResult {
  const queryClient = useQueryClient();
  const shouldLoadDirectAgentCatalog = shouldLoadChatDirectAgents({
    activeInstanceId,
    isRouteSupported: isChatSupportedRoute,
    agentCatalogMode,
    isSessionContextDrawerOpen,
    selectedAgentId,
  });
  const shouldLoadKernelAgentCatalog = shouldLoadKernelChatAgentCatalog({
    activeInstanceId,
    isChatSupported: isChatSupportedRoute,
    agentCatalogMode,
  });
  const shouldLoadAnyAgentCatalog = shouldLoadDirectAgentCatalog || shouldLoadKernelAgentCatalog;

  useEffect(() => {
    if (!activeInstanceId || !shouldLoadKernelAgentCatalog) {
      return undefined;
    }

    return openClawGatewaySessions.subscribeAgentCatalogChanged((event) => {
      if (event.instanceId !== activeInstanceId) {
        return;
      }

      void queryClient.invalidateQueries({
        queryKey: ['chat', 'kernel-agent-catalog', event.instanceId],
      });
    });
  }, [activeInstanceId, queryClient, shouldLoadKernelAgentCatalog]);

  const {
    data: instanceAgentCatalog,
    isFetched: isAgentCatalogFetched,
    isFetching: isAgentCatalogFetching,
  } = useQuery({
    queryKey: ['chat', 'kernel-agent-catalog', activeInstanceId, agentCatalogMode],
    enabled: Boolean(activeInstanceId && shouldLoadAnyAgentCatalog),
    staleTime: 10_000,
    queryFn: () => kernelChatAgentCatalogService.getCatalog(activeInstanceId ?? undefined),
  });
  const {
    visibleAgents,
    defaultAgentId,
    effectiveAgentId: effectiveGatewayAgentId,
    hasResolvedVisibleAgents,
    isAgentSelectorLoading,
    defaultDescriptionKey: agentDefaultDescriptionKey,
  } = resolveChatAgentCatalogState({
    activeInstanceId,
    isChatSupported: isChatSupportedRoute,
    agentCatalogMode,
    selectedAgentId,
    activeSessionAgentId,
    catalogAgents: instanceAgentCatalog?.agents ?? EMPTY_AGENTS,
    catalogDefaultAgentId: instanceAgentCatalog?.defaultAgentId ?? null,
    isSessionContextDrawerOpen,
    shouldLoadAgentCatalog: shouldLoadAnyAgentCatalog,
    isAgentCatalogFetched,
    isAgentCatalogFetching,
  });
  const visibleAgentIds = useMemo(
    () => visibleAgents.map((agent) => agent.id),
    [visibleAgents],
  );

  return {
    defaultAgentId,
    effectiveGatewayAgentId,
    hasResolvedVisibleAgents,
    visibleAgentIds,
    isAgentSelectorLoading,
    agentDefaultDescriptionKey,
    agentProfiles: instanceAgentCatalog?.profiles ?? EMPTY_AGENT_PROFILES,
    visibleAgents,
  };
}
