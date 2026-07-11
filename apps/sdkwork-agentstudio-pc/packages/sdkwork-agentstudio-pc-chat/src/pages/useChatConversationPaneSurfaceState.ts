import type { ChatConversationPaneProps } from '../components/ChatConversationPane';
import type { ChatPageTranslate } from './chatPageContracts';

export interface UseChatConversationPaneSurfaceStateInput {
  t: ChatPageTranslate;
  activeInstanceId: string | null | undefined;
  hasResolvedInstances: boolean;
  hasAvailableInstances: boolean;
  selectedAgentName: string;
  isUnsupportedRoute: boolean;
  isChatSupportedRoute: boolean;
  effectiveLastError?: string;
  conversationBodyMode: 'loading' | 'empty' | 'messages';
}

export function useChatConversationPaneSurfaceState({
  t,
  activeInstanceId,
  hasResolvedInstances,
  hasAvailableInstances,
  selectedAgentName,
  isUnsupportedRoute,
  isChatSupportedRoute,
  effectiveLastError,
  conversationBodyMode,
}: UseChatConversationPaneSurfaceStateInput): Pick<
  ChatConversationPaneProps,
  'surfaceState' | 'inlineNoticeMessage' | 'showComposer'
> {
  const isResolvingInstanceSelection =
    !activeInstanceId && (!hasResolvedInstances || hasAvailableInstances);

  if (isResolvingInstanceSelection) {
    return {
      surfaceState: {
        mode: 'loading',
        title: t('common.loading'),
        description: t('chat.page.loadingConversationHistory'),
      },
      inlineNoticeMessage: null,
      showComposer: false,
    };
  }

  if (!activeInstanceId) {
    return {
      surfaceState: {
        mode: 'missingInstance',
        title: t('chat.page.noInstanceAgentTitle', {
          agent: selectedAgentName,
        }),
        description: t('chat.page.noInstanceAgentDescription', {
          agent: selectedAgentName,
        }),
        actionLabel: t('chat.page.manageInstances'),
      },
      inlineNoticeMessage: null,
      showComposer: false,
    };
  }

  if (isUnsupportedRoute) {
    return {
      surfaceState: {
        mode: 'unsupported',
        title: t('chat.page.unsupportedRouteTitle'),
        description: effectiveLastError ?? '',
        actionLabel: t('chat.page.manageInstances'),
      },
      inlineNoticeMessage: null,
      showComposer: false,
    };
  }

  if (conversationBodyMode === 'loading') {
    return {
      surfaceState: {
        mode: 'loading',
        title: t('common.loading'),
        description: t('chat.page.loadingConversationHistory'),
      },
      inlineNoticeMessage: effectiveLastError ?? null,
      showComposer: isChatSupportedRoute,
    };
  }

  if (conversationBodyMode === 'empty') {
    return {
      surfaceState: {
        mode: 'empty',
      },
      inlineNoticeMessage: effectiveLastError ?? null,
      showComposer: isChatSupportedRoute,
    };
  }

  return {
    surfaceState: {
      mode: 'messages',
    },
    inlineNoticeMessage: effectiveLastError ?? null,
    showComposer: isChatSupportedRoute,
  };
}
