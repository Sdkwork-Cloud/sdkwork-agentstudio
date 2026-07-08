import type { ChatConversationPaneProps } from '../components/ChatConversationPane';
import type { ChatSessionContextDrawerProps } from '../components/ChatSessionContextDrawer';
import { useChatCompactModelPreference } from './useChatCompactModelPreference';
import {
  type UseChatConversationPanePresentationStateInput,
  useChatConversationPanePresentationState,
} from './useChatConversationPanePresentationState';
import { useChatPresentationNavigation } from './useChatPresentationNavigation';
import {
  type UseChatSessionContextDrawerPresentationStateInput,
  useChatSessionContextDrawerPresentationState,
} from './useChatSessionContextDrawerPresentationState';

export interface UseChatPresentationStateInput {
  conversationPanePresentation: Omit<
    UseChatConversationPanePresentationStateInput,
    'openSessionContext' | 'compactModelSelector' | 'handleOpenModelConfig'
  >;
  sessionContextPresentation: Omit<
    UseChatSessionContextDrawerPresentationStateInput,
    'handleOpenSettings'
  >;
}

export interface UseChatPresentationStateResult {
  topControlsProps: ChatConversationPaneProps['topControlsProps'];
  emptyStateProps: ChatConversationPaneProps['emptyStateProps'];
  composerPanelProps: ChatConversationPaneProps['composerPanelProps'];
  sessionContextDrawerProps: ChatSessionContextDrawerProps;
  onManageInstances: () => void;
}

export function useChatPresentationState({
  conversationPanePresentation,
  sessionContextPresentation,
}: UseChatPresentationStateInput): UseChatPresentationStateResult {
  const { handleOpenModelConfig, handleOpenSessionSettings, onManageInstances } = useChatPresentationNavigation({
    setIsSessionContextDrawerOpen: sessionContextPresentation.setIsSessionContextDrawerOpen,
  });
  const compactModelSelector = useChatCompactModelPreference();
  const { topControlsProps, emptyStateProps, composerPanelProps } =
    useChatConversationPanePresentationState({
      ...conversationPanePresentation,
      openSessionContext: () => sessionContextPresentation.setIsSessionContextDrawerOpen(true),
      compactModelSelector,
      handleOpenModelConfig,
    });
  const sessionContextDrawerProps = useChatSessionContextDrawerPresentationState({
    ...sessionContextPresentation,
    handleOpenSettings: handleOpenSessionSettings,
  });

  return {
    topControlsProps,
    emptyStateProps,
    composerPanelProps,
    sessionContextDrawerProps,
    onManageInstances,
  };
}
