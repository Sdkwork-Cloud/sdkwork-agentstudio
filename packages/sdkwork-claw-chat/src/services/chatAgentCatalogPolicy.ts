import type { Agent } from '@sdkwork/claw-types';

export interface ShouldLoadKernelChatAgentCatalogInput {
  activeInstanceId: string | null | undefined;
  isChatSupported: boolean;
  agentCatalogMode: 'sharedCatalog' | 'kernelCatalog';
}

export interface ResolveChatAgentCatalogStateInput {
  activeInstanceId: string | null | undefined;
  isChatSupported: boolean;
  agentCatalogMode: 'sharedCatalog' | 'kernelCatalog';
  selectedAgentId: string | null | undefined;
  activeSessionAgentId?: string | null;
  catalogAgents: Agent[];
  catalogDefaultAgentId: string | null;
  isSessionContextDrawerOpen: boolean;
  shouldLoadAgentCatalog: boolean;
  isAgentCatalogFetched: boolean;
  isAgentCatalogFetching: boolean;
}

export interface ResolveChatAgentCatalogStateResult {
  visibleAgents: Agent[];
  defaultAgentId: string | null;
  effectiveAgentId: string | null;
  hasResolvedVisibleAgents: boolean;
  isAgentSelectorLoading: boolean;
  defaultDescriptionKey:
    | 'chat.page.defaultAgentKernelDescription'
    | 'chat.page.defaultAgentDirectDescription';
}

export interface ResolveChatContextSelectionSyncMutationInput {
  isChatSupported: boolean;
  selectedAgentId: string | null | undefined;
  selectedSkillId: string | null;
  hasResolvedVisibleAgents: boolean;
  visibleAgentIds: string[];
  activeSessionAgentId?: string | null;
}

export interface ChatContextSelectionSyncMutation {
  nextSelectedAgentId: string | null | undefined;
  nextSelectedSkillId?: string | null;
}

export function shouldLoadKernelChatAgentCatalog(
  params: ShouldLoadKernelChatAgentCatalogInput,
) {
  return Boolean(
    params.activeInstanceId &&
    params.isChatSupported &&
    params.agentCatalogMode === 'kernelCatalog',
  );
}

export function resolveChatAgentCatalogState(
  params: ResolveChatAgentCatalogStateInput,
): ResolveChatAgentCatalogStateResult {
  if (!params.isChatSupported) {
    return {
      visibleAgents: [],
      defaultAgentId: null,
      effectiveAgentId: null,
      hasResolvedVisibleAgents: true,
      isAgentSelectorLoading: false,
      defaultDescriptionKey: 'chat.page.defaultAgentDirectDescription',
    };
  }

  if (params.agentCatalogMode === 'kernelCatalog') {
    const visibleAgents = params.catalogAgents;
    return {
      visibleAgents,
      defaultAgentId: params.catalogDefaultAgentId,
      effectiveAgentId:
        typeof params.selectedAgentId === 'string'
          ? params.selectedAgentId
          : params.activeSessionAgentId ?? params.catalogDefaultAgentId,
      hasResolvedVisibleAgents:
        !params.activeInstanceId || params.isAgentCatalogFetched,
      isAgentSelectorLoading:
        params.isSessionContextDrawerOpen &&
        Boolean(params.activeInstanceId) &&
        !params.isAgentCatalogFetched &&
        visibleAgents.length === 0,
      defaultDescriptionKey: 'chat.page.defaultAgentKernelDescription',
    };
  }

  const visibleAgents = params.catalogAgents;
  return {
    visibleAgents,
    defaultAgentId: null,
    effectiveAgentId: params.selectedAgentId ?? params.activeSessionAgentId ?? null,
    hasResolvedVisibleAgents:
      !params.shouldLoadAgentCatalog || params.isAgentCatalogFetched,
    isAgentSelectorLoading:
      params.isSessionContextDrawerOpen &&
      params.shouldLoadAgentCatalog &&
      params.isAgentCatalogFetching &&
      visibleAgents.length === 0,
    defaultDescriptionKey: 'chat.page.defaultAgentDirectDescription',
  };
}

export function resolveChatContextSelectionSyncMutation(
  params: ResolveChatContextSelectionSyncMutationInput,
): ChatContextSelectionSyncMutation | null {
  if (!params.isChatSupported) {
    const shouldResetSelectedAgentId = params.selectedAgentId !== undefined;
    const nextSelectedSkillId =
      params.selectedSkillId !== null ? null : undefined;

    if (
      !shouldResetSelectedAgentId &&
      nextSelectedSkillId === undefined
    ) {
      return null;
    }

    return {
      nextSelectedAgentId: undefined,
      nextSelectedSkillId,
    };
  }

  if (
    typeof params.selectedAgentId === 'string' &&
    params.hasResolvedVisibleAgents &&
    params.selectedAgentId !== params.activeSessionAgentId &&
    !params.visibleAgentIds.includes(params.selectedAgentId)
  ) {
    return {
      nextSelectedAgentId: undefined,
      nextSelectedSkillId: params.selectedSkillId,
    };
  }

  return null;
}
