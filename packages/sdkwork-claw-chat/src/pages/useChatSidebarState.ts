import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { type CreateKernelAgentResult, kernelAgentSidebarActionService } from '@sdkwork/claw-core';
import { useNavigate } from 'react-router-dom';
import {
  CHAT_AGENT_CREATION_FOLLOW_UP_COMPLETED,
  CHAT_SIDEBAR_SELECTION_COMPLETED,
  type ChatSidebarAgentActionRequest,
  type ChatSidebarAgentSelection,
  type ChatAgentCreationFollowUpResult,
  type ChatSidebarSelectionPlan,
  type ChatSidebarSessionSelection,
  createChatAgentCreationFollowUpFailure,
  createChatSidebarSelectionFailure,
  type ChatSidebarSelectionActionResult,
  resolveChatAgentLinkedInstanceId,
  resolveChatSidebarAgentCreatedSelectionPlan,
  resolveChatSidebarAgentSelectionPlan,
  resolveChatSidebarSessionSelectionPlan,
  type ChatSidebarAgentOption,
} from '../services';
import type { ChatSession, ChatState } from '../store/useChatStore';
import type {
  ChatPageSourceState,
  ChatPageSessionScopeMode,
  ChatPageUiState,
  ChatPageTranslate,
  ChatPageWorkspaceState,
} from './chatPageContracts';

interface ChatSidebarSharedProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onDeleteSession: ChatState['deleteSession'];
  activeInstanceId: string | null;
  isChatSupported: boolean;
  sessionScopeMode: ChatPageSessionScopeMode;
  sessionScopeAgentId: string | null;
  selectedAgentId: string | null | undefined;
  primaryAgentId: string | null;
  agentOptions: ChatSidebarAgentOption[];
  selectionTransition: ChatPageUiState['selection']['selectionTransition'];
  selectionErrorMessage?: string | null;
  onDismissSelectionError?: () => void;
  hiddenAgentIds?: string[];
  onSelectAgent: (
    selection: ChatSidebarAgentSelection,
  ) =>
    | Promise<ChatSidebarSelectionActionResult | void>
    | ChatSidebarSelectionActionResult
    | void;
  onAgentCreated?: (
    result: CreateKernelAgentResult,
  ) =>
    | Promise<ChatAgentCreationFollowUpResult | void>
    | ChatAgentCreationFollowUpResult
    | void;
  onSessionSelect?: (
    selection?: ChatSidebarSessionSelection,
  ) =>
    | Promise<ChatSidebarSelectionActionResult | void>
    | ChatSidebarSelectionActionResult
    | void;
  onAgentAction?: (request: ChatSidebarAgentActionRequest) => Promise<void> | void;
}

export interface UseChatSidebarStateInput {
  t: ChatPageTranslate;
  sourceState: Pick<ChatPageSourceState, 'instance' | 'runtime'>;
  pageUiState: Pick<ChatPageUiState, 'selection'>;
  workspaceState: Pick<ChatPageWorkspaceState, 'runtime' | 'presentation'>;
}

export interface UseChatSidebarStateResult {
  isSidebarOpen: boolean;
  closeSidebar: () => void;
  openSidebar: () => void;
  sidebarBackdropLabel: string;
  desktopSidebarProps: ChatSidebarSharedProps;
  mobileSidebarProps: ChatSidebarSharedProps & {
    onClose: () => void;
  };
}

function normalizeOptionalString(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return value ?? null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function buildAgentActionNavigationHref(request: ChatSidebarAgentActionRequest) {
  const encodedInstanceId = encodeURIComponent(request.instanceId);
  const encodedAgentId = encodeURIComponent(request.agentId);

  return {
    publish: `/community/new?source=agent&instanceId=${encodedInstanceId}&agentId=${encodedAgentId}`,
    settings: `/instances/${encodedInstanceId}?section=agents&agentId=${encodedAgentId}`,
  } as const;
}

export function useChatSidebarState({
  t,
  sourceState,
  pageUiState,
  workspaceState,
}: UseChatSidebarStateInput): UseChatSidebarStateResult {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    instance: instanceSource,
    runtime: runtimeSource,
  } = sourceState;
  const {
    activeInstanceId,
    setActiveInstanceId,
    instances,
  } = instanceSource;
  const {
    sessions,
    hydrateInstance,
    setActiveSession,
    deleteSession,
  } = runtimeSource;
  const {
    selectedAgentId,
    setSelectedAgentId,
    selectionTransition,
    setSelectionTransition,
  } = pageUiState.selection;
  const { runtime, presentation } = workspaceState;
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectionErrorMessage, setSelectionErrorMessage] = useState<string | null>(null);
  const [hiddenAgentIdsByInstance, setHiddenAgentIdsByInstance] = useState<Record<string, string[]>>(
    {},
  );
  const selectionRequestRef = useRef(0);
  const latestActiveInstanceIdRef = useRef<string | null>(activeInstanceId ?? null);
  latestActiveInstanceIdRef.current = activeInstanceId ?? null;

  const resolveCurrentInstanceId = () => latestActiveInstanceIdRef.current;
  const rememberHiddenAgentId = (instanceId: string, agentId: string) => {
    const normalizedInstanceId = normalizeOptionalString(instanceId);
    const normalizedAgentId = normalizeOptionalString(agentId)?.toLowerCase() ?? null;
    if (!normalizedInstanceId || !normalizedAgentId) {
      return;
    }

    setHiddenAgentIdsByInstance((current) => {
      const existingAgentIds = current[normalizedInstanceId] ?? [];
      if (existingAgentIds.includes(normalizedAgentId)) {
        return current;
      }

      return {
        ...current,
        [normalizedInstanceId]: [...existingAgentIds, normalizedAgentId],
      };
    });
  };
  const revealHiddenAgentId = (instanceId: string, agentId: string) => {
    const normalizedInstanceId = normalizeOptionalString(instanceId);
    const normalizedAgentId = normalizeOptionalString(agentId)?.toLowerCase() ?? null;
    if (!normalizedInstanceId || !normalizedAgentId) {
      return;
    }

    setHiddenAgentIdsByInstance((current) => {
      const existingAgentIds = current[normalizedInstanceId] ?? [];
      if (existingAgentIds.length === 0 || !existingAgentIds.includes(normalizedAgentId)) {
        return current;
      }

      const nextAgentIds = existingAgentIds.filter((entry) => entry !== normalizedAgentId);
      if (nextAgentIds.length === 0) {
        const { [normalizedInstanceId]: _removed, ...rest } = current;
        return rest;
      }

      return {
        ...current,
        [normalizedInstanceId]: nextAgentIds,
      };
    });
  };
  const activeHiddenAgentIds = (() => {
    const normalizedActiveInstanceId = normalizeOptionalString(activeInstanceId);
    if (!normalizedActiveInstanceId) {
      return [];
    }

    return hiddenAgentIdsByInstance[normalizedActiveInstanceId] ?? [];
  })();
  const beginSelectionRequest = (
    transition: NonNullable<ChatPageUiState['selection']['selectionTransition']>,
  ) => {
    const requestId = selectionRequestRef.current + 1;
    selectionRequestRef.current = requestId;
    setSelectionErrorMessage(null);
    setSelectionTransition({
      ...transition,
      requestId,
    });
    return requestId;
  };
  const isSelectionRequestCurrent = (requestId: number) =>
    selectionRequestRef.current === requestId;

  const commitSelectionPlan = async (
    requestId: number,
    plan: ChatSidebarSelectionPlan,
  ) => {
    if (plan.shouldHydrateTargetInstance) {
      await hydrateInstance(plan.nextInstanceId ?? undefined);
      if (!isSelectionRequestCurrent(requestId)) {
        return;
      }
    }

    if (plan.shouldSetActiveInstance) {
      setActiveInstanceId(plan.nextInstanceId);
    }

    setSelectedAgentId(plan.nextSelectedAgentId);

    if (plan.shouldSetActiveSession) {
      await setActiveSession(plan.nextSessionId, plan.nextInstanceId ?? undefined);
    }
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  const openSidebar = () => {
    setIsSidebarOpen(true);
  };
  const handleAgentSelection = async (
    selection: ChatSidebarAgentSelection,
  ): Promise<ChatSidebarSelectionActionResult> => {
    const requestId = beginSelectionRequest({
      requestId: 0,
      kind: 'agent',
      agentId: selection.agentId,
      sessionId: null,
    });

    try {
      const currentActiveInstanceId = resolveCurrentInstanceId();
      const linkedInstanceId = await resolveChatAgentLinkedInstanceId({
        agentId: selection.agentId,
        preferredInstanceId: currentActiveInstanceId,
      }).catch(() => null);
      const plan = resolveChatSidebarAgentSelectionPlan({
        selection,
        currentActiveInstanceId,
        instances,
        linkedInstanceId,
      });

      if (!isSelectionRequestCurrent(requestId)) {
        return CHAT_SIDEBAR_SELECTION_COMPLETED;
      }

      await commitSelectionPlan(requestId, plan);
      return CHAT_SIDEBAR_SELECTION_COMPLETED;
    } catch (error: any) {
      const failure = createChatSidebarSelectionFailure(
        error,
        t('chat.sidebar.selectAgentFailed')
      );
      setSelectionErrorMessage(failure.errorMessage);
      return failure;
    } finally {
      if (isSelectionRequestCurrent(requestId)) {
        setSelectionTransition(null);
      }
    }
  };
  const handleSessionSelection = async (
    selection?: ChatSidebarSessionSelection,
  ): Promise<ChatSidebarSelectionActionResult> => {
    const requestId = beginSelectionRequest({
      requestId: 0,
      kind: 'session',
      agentId: selection?.agentId ?? null,
      sessionId: selection?.sessionId ?? null,
    });

    try {
      const currentActiveInstanceId = resolveCurrentInstanceId();
      const plan = resolveChatSidebarSessionSelectionPlan({
        selection,
        currentActiveInstanceId,
      });
      await commitSelectionPlan(requestId, plan);
      return CHAT_SIDEBAR_SELECTION_COMPLETED;
    } catch (error: any) {
      const failure = createChatSidebarSelectionFailure(
        error,
        t('chat.sidebar.selectSessionFailed')
      );
      setSelectionErrorMessage(failure.errorMessage);
      return failure;
    } finally {
      if (isSelectionRequestCurrent(requestId)) {
        setSelectionTransition(null);
      }
    }
  };
  const handleAgentCreated = async (
    result: CreateKernelAgentResult,
  ): Promise<ChatAgentCreationFollowUpResult> => {
    const requestId = beginSelectionRequest({
      requestId: 0,
      kind: 'agentCreated',
      agentId: result.agentId,
      sessionId: null,
    });

    try {
      revealHiddenAgentId(result.instanceId, result.agentId);
      await queryClient.invalidateQueries({
        queryKey: ['chat', 'kernel-agent-catalog', result.instanceId],
      });
      await queryClient.invalidateQueries({
        queryKey: ['chat', 'owned-kernel-agent-library', result.instanceId],
      });
      const currentActiveInstanceId = resolveCurrentInstanceId();
      const plan = resolveChatSidebarAgentCreatedSelectionPlan({
        result,
        currentActiveInstanceId,
      });
      await commitSelectionPlan(requestId, plan);
      return CHAT_AGENT_CREATION_FOLLOW_UP_COMPLETED;
    } catch (error: any) {
      return createChatAgentCreationFollowUpFailure(error);
    } finally {
      if (isSelectionRequestCurrent(requestId)) {
        setSelectionTransition(null);
      }
    }
  };
  const handleAgentAction = async (
    request: ChatSidebarAgentActionRequest,
  ): Promise<void> => {
    setSelectionErrorMessage(null);

    if (request.actionId === 'publish') {
      navigate(buildAgentActionNavigationHref(request).publish);
      return;
    }

    if (request.actionId === 'settings') {
      navigate(buildAgentActionNavigationHref(request).settings);
      return;
    }

    try {
      await kernelAgentSidebarActionService.removeAgent({
        instanceId: request.instanceId,
        agentId: request.agentId,
      });
      rememberHiddenAgentId(request.instanceId, request.agentId);

      if (
        normalizeOptionalString(selectedAgentId)?.toLowerCase() ===
        normalizeOptionalString(request.agentId)?.toLowerCase()
      ) {
        setSelectedAgentId(null);
      }

      await queryClient.invalidateQueries({
        queryKey: ['chat', 'kernel-agent-catalog', request.instanceId],
      });
    } catch (error: any) {
      const failure = createChatSidebarSelectionFailure(
        error,
        t('chat.sidebar.removeAgentFailed'),
      );
      setSelectionErrorMessage(failure.errorMessage);
    }
  };

  const sharedSidebarProps = {
    sessions,
    activeSessionId: runtime.activeSessionId,
    onDeleteSession: deleteSession,
    activeInstanceId: activeInstanceId ?? null,
    isChatSupported: runtime.isChatSupportedRoute,
    sessionScopeMode: runtime.sessionScopeMode,
    sessionScopeAgentId: runtime.effectiveGatewayAgentId,
    selectedAgentId,
    primaryAgentId: presentation.primaryAgentId,
    agentOptions: presentation.sidebarAgentOptions,
    hiddenAgentIds: activeHiddenAgentIds,
    selectionTransition,
    selectionErrorMessage,
    onDismissSelectionError: () => setSelectionErrorMessage(null),
    onSelectAgent: handleAgentSelection,
    onAgentCreated: handleAgentCreated,
    onAgentAction: handleAgentAction,
    onSessionSelect: handleSessionSelection,
  };

  return {
    isSidebarOpen,
    closeSidebar,
    openSidebar,
    sidebarBackdropLabel: t('common.close'),
    desktopSidebarProps: sharedSidebarProps,
    mobileSidebarProps: {
      ...sharedSidebarProps,
      async onSelectAgent(selection) {
        const result = await handleAgentSelection(selection);
        if (result.status === 'completed') {
          closeSidebar();
        }
        return result;
      },
      async onSessionSelect(selection) {
        const result = await handleSessionSelection(selection);
        if (result.status === 'completed') {
          closeSidebar();
        }
        return result;
      },
      onClose: closeSidebar,
    },
  };
}
