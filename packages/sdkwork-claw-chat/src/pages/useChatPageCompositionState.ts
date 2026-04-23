import type { ChatConversationPaneProps } from '../components/ChatConversationPane';
import type { ChatSidebarChromeProps } from '../components/ChatSidebarChrome';
import type { ChatSessionContextDrawerProps } from '../components/ChatSessionContextDrawer';
import type { ChatPageTranslate } from './chatPageContracts';
import { useChatPagePresentationPropsState } from './useChatPagePresentationPropsState';
import { useChatPageSourceState } from './useChatPageSourceState';
import { useChatPageSynchronizationState } from './useChatPageSynchronizationState';
import { useChatPageUiState } from './useChatPageUiState';
import { useChatPageWorkspaceState } from './useChatPageWorkspaceState';
import { useChatSidebarState } from './useChatSidebarState';

export interface UseChatPageCompositionStateInput {
  t: ChatPageTranslate;
  language: string;
}

export interface UseChatPageCompositionStateResult {
  sidebarChromeProps: ChatSidebarChromeProps;
  conversationPaneProps: ChatConversationPaneProps;
  sessionContextDrawerProps: ChatSessionContextDrawerProps;
}

export function useChatPageCompositionState({
  t,
  language,
}: UseChatPageCompositionStateInput): UseChatPageCompositionStateResult {
  const sourceState = useChatPageSourceState();
  const pageUiState = useChatPageUiState();
  const workspaceState = useChatPageWorkspaceState({
    t,
    sourceState,
    pageUiState,
  });
  const {
    isSidebarOpen,
    closeSidebar,
    openSidebar,
    sidebarBackdropLabel,
    desktopSidebarProps,
    mobileSidebarProps,
  } = useChatSidebarState({
    t,
    sourceState,
    pageUiState,
    workspaceState,
  });

  useChatPageSynchronizationState({
    sourceState,
    pageUiState,
    workspaceState,
  });

  const {
    conversationPaneProps,
    sessionContextDrawerProps,
  } = useChatPagePresentationPropsState({
    t,
    language,
    sourceState,
    workspaceState,
    pageUiState,
    sidebarPresentation: {
      openSidebar,
      onSelectAgent: (agentId) => desktopSidebarProps.onSelectAgent({ agentId: agentId ?? null }),
    },
  });

  return {
    sidebarChromeProps: {
      isSidebarOpen,
      closeSidebar,
      sidebarBackdropLabel,
      desktopSidebarProps,
      mobileSidebarProps,
    },
    conversationPaneProps,
    sessionContextDrawerProps,
  };
}
