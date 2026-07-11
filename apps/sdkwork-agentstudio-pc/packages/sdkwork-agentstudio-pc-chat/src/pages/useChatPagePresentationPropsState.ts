import type { ChatConversationPaneProps } from '../components/ChatConversationPane';
import type { ChatSessionContextDrawerProps } from '../components/ChatSessionContextDrawer';
import { useChatAutoScroll } from './useChatAutoScroll';
import type {
  ChatPageSourceState,
  ChatPageUiState,
  ChatPageTranslate,
  ChatPageWorkspaceState,
} from './chatPageContracts';
import { useChatConversationPaneMessagesState } from './useChatConversationPaneMessagesState';
import { useChatConversationPaneSurfaceState } from './useChatConversationPaneSurfaceState';
import { useChatHeaderState } from './useChatHeaderState';
import { useChatPresentationState } from './useChatPresentationState';

export interface UseChatPagePresentationPropsStateInput {
  t: ChatPageTranslate;
  language: string;
  sourceState: Pick<ChatPageSourceState, 'instance'>;
  workspaceState: ChatPageWorkspaceState;
  pageUiState: Pick<ChatPageUiState, 'drawer' | 'selection'>;
  sidebarPresentation: {
    openSidebar: () => void;
    onSelectAgent: (agentId: string | null | undefined) => void;
  };
}

export interface UseChatPagePresentationPropsStateResult {
  conversationPaneProps: ChatConversationPaneProps;
  sessionContextDrawerProps: ChatSessionContextDrawerProps;
}

export function useChatPagePresentationPropsState({
  t,
  language,
  sourceState,
  workspaceState,
  pageUiState,
  sidebarPresentation,
}: UseChatPagePresentationPropsStateInput): UseChatPagePresentationPropsStateResult {
  const { runtime, catalog, session, interaction, presentation } = workspaceState;
  const { drawer, selection } = pageUiState;
  const { headerPresentation, effectiveLastError, headerStatusLabel, sessionRouteLabel, groupTimeFormatter } =
    useChatHeaderState({
      t,
      language,
      isChatSupportedRoute: runtime.isChatSupportedRoute,
      displaySession: session.displaySession,
      activeRunBinding: session.activeRunBinding,
      sendMode: runtime.sendMode,
      gatewayConnectionStatus: runtime.gatewayConnectionStatus,
      syncState: runtime.syncState,
      workspaceTitle: presentation.workspaceTitle,
      activeAgentName: catalog.activeAgent?.name ?? null,
      activeModelName: interaction.activeModel?.name ?? null,
      isActiveSessionGenerating: interaction.isActiveSessionGenerating,
      isUnsupportedRoute: session.isUnsupportedRoute,
      lastError: runtime.lastError,
      modelCatalogError: catalog.modelCatalogError,
      routeLabelKey: session.chatRuntimeState.routeLabelKey,
    });
  const { messageGroups } = useChatConversationPaneMessagesState({
    t,
    effectiveActiveSessionId: session.displaySessionId,
    activeMessageGroups: session.activeMessageGroups,
    messageCount: session.activeMessages.length,
    isActiveSessionGenerating: interaction.isActiveSessionGenerating,
    activeRunId: session.activeRunBinding.runId,
    groupTimeFormatter,
  });
  const { surfaceState, inlineNoticeMessage, showComposer } = useChatConversationPaneSurfaceState({
    t,
    activeInstanceId: sourceState.instance.activeInstanceId,
    hasResolvedInstances: sourceState.instance.hasResolvedInstances,
    hasAvailableInstances: sourceState.instance.instances.length > 0,
    selectedAgentName: presentation.selectedWorkspaceAgentName,
    isUnsupportedRoute: session.isUnsupportedRoute,
    isChatSupportedRoute: runtime.isChatSupportedRoute,
    effectiveLastError,
    conversationBodyMode: session.conversationBodyState.mode,
  });
  const {
    messagesScrollContainerRef,
    showJumpToLatest,
    handleMessageListScroll,
    jumpToLatest,
  } = useChatAutoScroll({
    sessionId: session.displaySessionId,
    messages: session.activeMessages,
    isBusy: interaction.isBusy,
  });
  const {
    topControlsProps,
    emptyStateProps,
    composerPanelProps,
    sessionContextDrawerProps,
    onManageInstances,
  } = useChatPresentationState({
    conversationPanePresentation: {
      t,
      activeModel: interaction.activeModel,
      activeAgent: catalog.activeAgent,
      activeSkill: catalog.activeSkill,
      workspaceTitle: presentation.workspaceTitle,
      handleSend: interaction.handleSend,
      handleStop: interaction.handleStop,
      canStop: interaction.canStop,
      showJumpToLatest,
      jumpToLatest,
      activeMessagesCount: session.activeMessages.length,
      isBusy: interaction.isBusy,
      channels: interaction.channels,
      activeChannel: interaction.activeChannel,
      handleChannelChange: interaction.handleChannelChange,
      handleModelChange: interaction.handleModelChange,
      openSidebar: sidebarPresentation.openSidebar,
    },
    sessionContextPresentation: {
      isSessionContextDrawerOpen: drawer.isSessionContextDrawerOpen,
      setIsSessionContextDrawerOpen: drawer.setIsSessionContextDrawerOpen,
      headerPresentation,
      headerStatusLabel,
      sessionRouteLabel,
      effectiveLastError,
      currentChannelName: interaction.activeChannel?.name ?? null,
      activeModelName: interaction.activeModel?.name ?? null,
      sessionSelectedModelId: session.sessionSelectedModelId,
      activeThinkingLevel: interaction.activeThinkingLevel,
      thinkingLevelDefaultLabel: interaction.thinkingLevelDefaultLabel,
      thinkingLevelOptions: interaction.thinkingLevelOptions,
      activeFastMode: interaction.activeFastMode,
      fastModeDefaultLabel: interaction.fastModeDefaultLabel,
      fastModeOptions: interaction.fastModeOptions,
      activeVerboseLevel: interaction.activeVerboseLevel,
      verboseLevelDefaultLabel: interaction.verboseLevelDefaultLabel,
      verboseLevelOptions: interaction.verboseLevelOptions,
      activeReasoningLevel: interaction.activeReasoningLevel,
      reasoningLevelDefaultLabel: interaction.reasoningLevelDefaultLabel,
      reasoningLevelOptions: interaction.reasoningLevelOptions,
      sessionControlActions: interaction.sessionControlActions,
      agentOptions: catalog.agentOptions,
      selectedAgentId: runtime.effectiveGatewayAgentId,
      isAgentSelectorLoading: catalog.isAgentSelectorLoading,
      isChatSupportedRoute: runtime.isChatSupportedRoute,
      onSelectAgent: sidebarPresentation.onSelectAgent,
      skillOptions: catalog.skillOptions,
      selectedSkillId: selection.selectedSkillId,
      isSkillSelectorLoading: catalog.isSkillSelectorLoading,
      setSelectedSkillId: selection.setSelectedSkillId,
    },
  });

  return {
    conversationPaneProps: {
      surfaceState,
      inlineNoticeMessage,
      showComposer,
      messagesScrollContainerRef,
      onMessageListScroll: handleMessageListScroll,
      messageGroups,
      topControlsProps,
      emptyStateProps,
      composerPanelProps,
      onManageInstances,
    },
    sessionContextDrawerProps,
  };
}
