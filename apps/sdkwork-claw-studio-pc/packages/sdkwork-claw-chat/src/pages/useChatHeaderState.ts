import { useMemo } from 'react';
import type { ChatSession, GatewayConnectionStatus, SyncState } from '../store/useChatStore';
import { presentChatHeader, type ChatRunStateBinding } from '../services';
import type {
  ChatPageSendMode,
  ChatPageTranslate,
} from './chatPageContracts';

export interface UseChatHeaderStateInput {
  t: ChatPageTranslate;
  language: string;
  isChatSupportedRoute: boolean;
  displaySession: ChatSession | null;
  activeRunBinding: ChatRunStateBinding;
  sendMode: ChatPageSendMode;
  gatewayConnectionStatus: GatewayConnectionStatus | null;
  syncState: SyncState;
  workspaceTitle: string | null;
  activeAgentName: string | null;
  activeModelName: string | null;
  isActiveSessionGenerating: boolean;
  isUnsupportedRoute: boolean;
  lastError: string | undefined;
  modelCatalogError: unknown;
  routeLabelKey: string;
}

export function useChatHeaderState({
  t,
  language,
  isChatSupportedRoute,
  displaySession,
  activeRunBinding,
  sendMode,
  gatewayConnectionStatus,
  syncState,
  workspaceTitle,
  activeAgentName,
  activeModelName,
  isActiveSessionGenerating,
  isUnsupportedRoute,
  lastError,
  modelCatalogError,
  routeLabelKey,
}: UseChatHeaderStateInput) {
  const headerPresentation = useMemo(
    () =>
      presentChatHeader({
        isChatSupported: isChatSupportedRoute,
        activeSession: displaySession,
        activeRunBinding,
        sendMode,
        gatewayConnectionStatus,
        syncState,
        workspaceTitle,
        activeAgentName,
        activeModelName,
        isActiveSessionGenerating,
      }),
    [
      activeAgentName,
      activeModelName,
      displaySession,
      activeRunBinding,
      gatewayConnectionStatus,
      isActiveSessionGenerating,
      isChatSupportedRoute,
      workspaceTitle,
      sendMode,
      syncState,
    ],
  );

  const unsupportedRouteMessage = isUnsupportedRoute
    ? t('chat.page.unsupportedRouteDescription')
    : undefined;
  const effectiveLastError =
    lastError ||
    unsupportedRouteMessage ||
    (modelCatalogError instanceof Error ? modelCatalogError.message : undefined);
  const headerStatusLabel = t(`chat.page.headerStatus.${headerPresentation.status}`);
  const sessionRouteLabel = t(routeLabelKey);
  const groupTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(language, {
        hour: 'numeric',
        minute: '2-digit',
      }),
    [language],
  );

  return {
    headerPresentation,
    effectiveLastError,
    headerStatusLabel,
    sessionRouteLabel,
    groupTimeFormatter,
  };
}
