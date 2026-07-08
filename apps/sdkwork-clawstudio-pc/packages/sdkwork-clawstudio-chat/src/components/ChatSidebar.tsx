import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  ChevronDown,
  MessageSquare,
  Plus,
  Search,
  X,
} from 'lucide-react';
import {
  type CreateKernelAgentResult,
} from '@sdkwork/clawstudio-core';
import { cn, Input } from '@sdkwork/clawstudio-ui';
import {
  type ChatAgentCreationFollowUpResult,
  type ChatSidebarAgentActionRequest,
  type ChatSidebarAgentSelection,
  type ChatSidebarHistoryViewMode,
  type ChatSidebarSelectionActionResult,
  type ChatSidebarSessionSelection,
  resolveChatSidebarAgentActionsPresentation,
  resolveChatSidebarSessionActionsPresentation,
  resolveChatSidebarSessionTitleText,
  resolveChatSidebarViewState,
  type ChatSidebarAgentOption,
  type ChatSidebarAgentRailItemPresentation,
  type ChatSidebarHistorySectionPresentation,
} from '../services';
import { buildChatSessionPreferencesKey } from '../store/chatSessionPreferencesStore.ts';
import { useChatSessionPreferencesStore } from '../store/useChatSessionPreferencesStore.ts';
import type { ChatSession } from '../store/useChatStore';
import type { ChatPageUiState } from '../pages/chatPageContracts';
import { ChatAgentCreationWorkflowDialog } from './ChatAgentCreationWorkflowDialog';
import {
  ChatSidebarCreateAgentMenu,
  type ChatSidebarCreateAgentMenuActionId,
} from './ChatSidebarCreateAgentMenu';
import { ChatSidebarAgentActionMenu } from './ChatSidebarAgentActionMenu';
import { ChatSidebarAgentItem } from './ChatSidebarAgentItem';
import { ChatSidebarSessionItem } from './ChatSidebarSessionItem';
import { ChatSidebarSessionActionMenu } from './ChatSidebarSessionActionMenu';
import type { FloatingAnchorPoint, FloatingAnchorRect } from './floatingMenuPosition.ts';

type SessionMenuState = {
  item: ChatSidebarHistorySectionPresentation['items'][number];
  sessionInstanceId: string | null;
  restoreFocusElement?: HTMLElement | null;
  anchorRect?: FloatingAnchorRect | null;
  anchorPoint?: FloatingAnchorPoint | null;
};

type AgentMenuState = {
  item: ChatSidebarAgentRailItemPresentation;
  restoreFocusElement?: HTMLElement | null;
  anchorRect?: FloatingAnchorRect | null;
  anchorPoint?: FloatingAnchorPoint | null;
};

type CreateAgentMenuState = {
  restoreFocusElement?: HTMLElement | null;
  anchorRect?: FloatingAnchorRect | null;
};

function resolveAnchorRectFromElement(element: HTMLElement): FloatingAnchorRect {
  const rect = element.getBoundingClientRect();

  return {
    top: rect.top,
    left: rect.left,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

function normalizeOptionalString(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return value ?? null;
  }

  const normalized = value.trim();
  return normalized || null;
}

export function ChatSidebar({
  className,
  sessions,
  activeSessionId,
  onDeleteSession,
  onSessionSelect,
  onSelectAgent,
  onAgentCreated,
  onClose,
  activeInstanceId = null,
  isChatSupported = true,
  sessionScopeMode = 'all',
  sessionScopeAgentId = null,
  selectedAgentId,
  primaryAgentId = null,
  agentOptions = [],
  hiddenAgentIds = [],
  selectionTransition = null,
  selectionErrorMessage = null,
  onDismissSelectionError,
  onAgentAction,
}: {
  className?: string;
  sessions: ChatSession[];
  activeSessionId: string | null;
  onDeleteSession?: (sessionId: string, instanceId?: string | null) => Promise<void> | void;
  onSessionSelect?: (
    selection?: ChatSidebarSessionSelection,
  ) =>
    | Promise<ChatSidebarSelectionActionResult | void>
    | ChatSidebarSelectionActionResult
    | void;
  onSelectAgent?: (
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
  onClose?: () => void;
  activeInstanceId?: string | null;
  isChatSupported?: boolean;
  sessionScopeMode?: 'all' | 'agentBound';
  sessionScopeAgentId?: string | null;
  selectedAgentId?: string | null | undefined;
  primaryAgentId?: string | null;
  agentOptions?: ChatSidebarAgentOption[];
  hiddenAgentIds?: string[];
  selectionTransition?: ChatPageUiState['selection']['selectionTransition'];
  selectionErrorMessage?: string | null;
  onDismissSelectionError?: () => void;
  onAgentAction?: (request: ChatSidebarAgentActionRequest) => Promise<void> | void;
}) {
  const { t, i18n } = useTranslation();
  const [agentCreationDialogMode, setAgentCreationDialogMode] = React.useState<ChatSidebarCreateAgentMenuActionId | null>(null);
  const [pendingCreateAgentActionId, setPendingCreateAgentActionId] =
    React.useState<ChatSidebarCreateAgentMenuActionId | null>(null);
  const [agentSearchQuery, setAgentSearchQuery] = React.useState('');
  const [historyViewMode, setHistoryViewMode] = React.useState<ChatSidebarHistoryViewMode>(
    'currentAgent',
  );
  const [createAgentMenuState, setCreateAgentMenuState] = React.useState<CreateAgentMenuState | null>(
    null,
  );
  const [agentMenuState, setAgentMenuState] = React.useState<AgentMenuState | null>(null);
  const [sessionMenuState, setSessionMenuState] = React.useState<SessionMenuState | null>(null);
  const sidebarScrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const sessionPreferencesBySessionKey = useChatSessionPreferencesStore(
    (state) => state.entriesBySessionKey,
  );
  const setSessionFavorited = useChatSessionPreferencesStore(
    (state) => state.setSessionFavorited,
  );
  const setSessionPinned = useChatSessionPreferencesStore((state) => state.setSessionPinned);
  const isAgentCreationDialogOpen = agentCreationDialogMode !== null;
  const isSelectionPending = selectionTransition !== null;
  const pendingAgentId = selectionTransition?.agentId ?? null;
  const pendingSessionId = selectionTransition?.sessionId ?? null;
  const canDeleteSessions = Boolean(onDeleteSession);
  const hiddenAgentIdSet = React.useMemo(
    () =>
      new Set(
        hiddenAgentIds
          .map((agentId) => normalizeOptionalString(agentId)?.toLowerCase() ?? null)
          .filter((agentId): agentId is string => Boolean(agentId)),
      ),
    [hiddenAgentIds],
  );
  const filteredAgentOptions = React.useMemo(() => {
    if (hiddenAgentIdSet.size === 0) {
      return agentOptions;
    }

    return agentOptions.filter((option) => {
      const normalizedAgentId = normalizeOptionalString(option.id)?.toLowerCase() ?? null;
      return !normalizedAgentId || !hiddenAgentIdSet.has(normalizedAgentId);
    });
  }, [agentOptions, hiddenAgentIdSet]);
  const timeZone = React.useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return undefined;
    }
  }, []);
  const fallbackMainAgentName = t('chat.sidebar.mainAgent');
  const previewLabels = React.useMemo(
    () => ({
      you: t('chat.sidebar.previewYou'),
      system: t('chat.sidebar.previewSystem'),
      tool: t('chat.sidebar.previewTool'),
      attachment: t('chat.sidebar.previewAttachment'),
      attachments: t('chat.sidebar.previewAttachments'),
    }),
    [t],
  );
  const relativeTimeLabels = React.useMemo(
    () => ({
      yesterday: t('chat.sidebar.relativeTimeYesterday'),
      daysAgo: (count: number) => t('chat.sidebar.relativeTimeDaysAgo', { count }),
    }),
    [t],
  );
  const sidebarViewState = React.useMemo(
    () =>
      resolveChatSidebarViewState({
        sessions,
        activeSessionId,
        activeInstanceId,
        isChatSupported,
        sessionScopeMode,
        sessionScopeAgentId,
        selectedAgentId,
        primaryAgentId,
        agentOptions: filteredAgentOptions,
        historyViewMode,
        fallbackMainAgentName,
        previewLabels,
        relativeTimeLabels,
        sessionPreferencesBySessionKey,
        locale: i18n.resolvedLanguage,
        timeZone,
      }),
    [
      activeInstanceId,
      activeSessionId,
      fallbackMainAgentName,
      filteredAgentOptions,
      historyViewMode,
      i18n.resolvedLanguage,
      isChatSupported,
      previewLabels,
      primaryAgentId,
      relativeTimeLabels,
      selectedAgentId,
      sessionPreferencesBySessionKey,
      sessions,
      sessionScopeAgentId,
      sessionScopeMode,
      timeZone,
    ],
  );
  const {
    currentAgentName,
    agentRail,
    activeSidebarHistory,
    activeHistorySessions,
    sidebarChrome,
    historyTabState,
  } = sidebarViewState;
  const sessionActionMenu = React.useMemo(() => {
    if (!sessionMenuState) {
      return null;
    }

    return resolveChatSidebarSessionActionsPresentation({
      isFavorited: sessionMenuState.item.isFavorited,
      pinOrigin: sessionMenuState.item.pinOrigin,
      canDelete: sessionMenuState.item.showDeleteAction && canDeleteSessions,
      labels: {
        favorite: t('chat.sidebar.favoriteChat'),
        unfavorite: t('chat.sidebar.unfavoriteChat'),
        pin: t('chat.sidebar.pinChat'),
        unpin: t('chat.sidebar.unpinChat'),
        delete: t('chat.sidebar.deleteChat'),
      },
    });
  }, [canDeleteSessions, sessionMenuState, t]);
  const agentActionMenu = React.useMemo(() => {
    if (!agentMenuState?.item.id || !activeInstanceId) {
      return null;
    }

    return resolveChatSidebarAgentActionsPresentation({
      labels: {
        publish: t('chat.sidebar.publishAgentToMarket'),
        settings: t('chat.sidebar.agentSettings'),
        remove: t('chat.sidebar.removeAgent'),
      },
    });
  }, [activeInstanceId, agentMenuState, t]);
  const createAgentMenuActions = React.useMemo(
    () => [
      {
        id: 'custom' as const,
        label: t('chat.sidebar.createAgentCustom'),
        description: t('chat.sidebar.createAgentCustomDescription'),
        disabled: !activeInstanceId,
      },
      {
        id: 'library' as const,
        label: t('chat.sidebar.createAgentFromLibrary'),
        description: t('chat.sidebar.createAgentFromLibraryDescription'),
      },
      {
        id: 'market' as const,
        label: t('chat.sidebar.createAgentFromMarket'),
        description: t('chat.sidebar.createAgentFromMarketDescription'),
      },
      {
        id: 'copy' as const,
        label: t('chat.sidebar.createAgentFromMyAgents'),
        description: t('chat.sidebar.createAgentFromMyAgentsDescription'),
        disabled: !activeInstanceId,
      },
    ],
    [activeInstanceId, t],
  );
  const historyTabs = [
    {
      id: 'currentAgent',
      label: t('chat.sidebar.currentAgentTab', {
        agentName: currentAgentName,
      }),
      count: historyTabState.currentAgentCount,
    },
    {
      id: 'allSessions',
      label: t('chat.sidebar.allConversations'),
      count: historyTabState.allSessionsCount,
    },
  ] as const;

  const activeHistorySessionById = React.useMemo(() => {
    return new Map(activeHistorySessions.map((session) => [session.id, session]));
  }, [activeHistorySessions]);
  const resolveSessionRecord = (sessionId: string) => {
    return activeHistorySessionById.get(sessionId) ?? null;
  };
  const resolveSessionMenuRestoreFocusElement = (container: HTMLElement | null) =>
    container?.querySelector<HTMLButtonElement>('button[type="button"]') ?? null;
  const visibleAgentRailItems = React.useMemo(() => {
    const normalizedQuery = agentSearchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return agentRail.items;
    }

    return agentRail.items.filter((agent) => {
      return [agent.name, agent.kernelLabel, agent.id]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [agentRail.items, agentSearchQuery]);

  const closeSessionMenu = () => {
    setSessionMenuState(null);
  };
  const closeAgentMenu = () => {
    setAgentMenuState(null);
  };
  const closeCreateAgentMenu = () => {
    setCreateAgentMenuState(null);
  };
  const dismissFloatingMenusForLayoutChange = React.useEffectEvent(() => {
    if (createAgentMenuState) {
      closeCreateAgentMenu();
    }

    if (agentMenuState) {
      closeAgentMenu();
    }

    if (sessionMenuState) {
      closeSessionMenu();
    }
  });

  React.useEffect(() => {
    if (isSelectionPending && sessionMenuState) {
      closeSessionMenu();
    }
  }, [isSelectionPending, sessionMenuState]);

  React.useEffect(() => {
    if (isSelectionPending && agentMenuState) {
      closeAgentMenu();
    }
  }, [agentMenuState, isSelectionPending]);

  React.useEffect(() => {
    if (isSelectionPending && createAgentMenuState) {
      closeCreateAgentMenu();
    }
  }, [createAgentMenuState, isSelectionPending]);

  const openCreateAgentWorkflow = React.useEffectEvent(
    (actionId: ChatSidebarCreateAgentMenuActionId) => {
      if (actionId === 'custom') {
        if (activeInstanceId) {
          setAgentCreationDialogMode('custom');
        }
        return;
      }

      if (actionId === 'library') {
        setAgentCreationDialogMode('library');
        return;
      }

      if (actionId === 'market') {
        setAgentCreationDialogMode('market');
        return;
      }

      if (actionId === 'copy') {
        if (activeInstanceId) {
          setAgentCreationDialogMode('copy');
        }
        return;
      }
    },
  );

  React.useEffect(() => {
    if (createAgentMenuState || !pendingCreateAgentActionId) {
      return;
    }

    openCreateAgentWorkflow(pendingCreateAgentActionId);
    setPendingCreateAgentActionId(null);
  }, [createAgentMenuState, openCreateAgentWorkflow, pendingCreateAgentActionId]);

  React.useEffect(() => {
    if (!sessionMenuState) {
      return;
    }

    const isSessionStillVisible = activeSidebarHistory.sections.some((section) =>
      section.items.some((item) => item.sessionId === sessionMenuState.item.sessionId),
    );
    if (!isSessionStillVisible) {
      closeSessionMenu();
    }
  }, [activeSidebarHistory.sections, sessionMenuState]);

  React.useEffect(() => {
    if (!agentMenuState) {
      return;
    }

    const isAgentStillVisible = visibleAgentRailItems.some((agent) => agent.id === agentMenuState.item.id);
    if (!isAgentStillVisible) {
      closeAgentMenu();
    }
  }, [agentMenuState, visibleAgentRailItems]);

  React.useEffect(() => {
    if (!createAgentMenuState && !sessionMenuState) {
      if (!agentMenuState) {
        return;
      }
    }

    const handleLayoutChange = () => {
      dismissFloatingMenusForLayoutChange();
    };
    const scrollContainer = sidebarScrollContainerRef.current;

    window.addEventListener('resize', handleLayoutChange);
    scrollContainer?.addEventListener('scroll', handleLayoutChange, { passive: true });

    return () => {
      window.removeEventListener('resize', handleLayoutChange);
      scrollContainer?.removeEventListener('scroll', handleLayoutChange);
    };
  }, [agentMenuState, createAgentMenuState, dismissFloatingMenusForLayoutChange, sessionMenuState]);

  const selectSession = (item: ChatSidebarHistorySectionPresentation['items'][number]) => {
    if (isSelectionPending) {
      return;
    }

    const selectedSession = resolveSessionRecord(item.sessionId);
    const selectedInstanceId = selectedSession?.instanceId ?? null;
    void onSessionSelect?.({
      sessionId: item.sessionId,
      instanceId: selectedInstanceId,
      agentId: item.sessionAgentId,
    });
  };

  const openSessionMenuAtPoint = (
    event: React.MouseEvent<HTMLElement>,
    item: ChatSidebarHistorySectionPresentation['items'][number],
    restoreFocusElement: HTMLElement | null,
  ) => {
    if (isSelectionPending) {
      return;
    }

    const sessionRecord = resolveSessionRecord(item.sessionId);
    closeAgentMenu();
    closeCreateAgentMenu();
    setSessionMenuState({
      item,
      sessionInstanceId: sessionRecord?.instanceId ?? null,
      restoreFocusElement,
      anchorRect: null,
      anchorPoint: {
        x: event.clientX,
        y: event.clientY,
      },
    });
  };

  const openSessionMenuAtElement = (
    element: HTMLElement,
    item: ChatSidebarHistorySectionPresentation['items'][number],
    restoreFocusElement: HTMLElement | null = element,
  ) => {
    if (isSelectionPending) {
      return;
    }

    const sessionRecord = resolveSessionRecord(item.sessionId);
    closeAgentMenu();
    closeCreateAgentMenu();
    setSessionMenuState({
      item,
      sessionInstanceId: sessionRecord?.instanceId ?? null,
      restoreFocusElement,
      anchorPoint: null,
      anchorRect: resolveAnchorRectFromElement(element),
    });
  };
  const openAgentMenuAtPoint = (
    event: React.MouseEvent<HTMLElement>,
    item: ChatSidebarAgentRailItemPresentation,
    restoreFocusElement: HTMLElement | null,
  ) => {
    if (isSelectionPending || !activeInstanceId || !item.id) {
      return;
    }

    closeCreateAgentMenu();
    closeSessionMenu();
    setAgentMenuState({
      item,
      restoreFocusElement,
      anchorRect: null,
      anchorPoint: {
        x: event.clientX,
        y: event.clientY,
      },
    });
  };

  const openAgentMenuAtElement = (
    element: HTMLElement,
    item: ChatSidebarAgentRailItemPresentation,
    restoreFocusElement: HTMLElement | null = element,
  ) => {
    if (isSelectionPending || !activeInstanceId || !item.id) {
      return;
    }

    closeCreateAgentMenu();
    closeSessionMenu();
    setAgentMenuState({
      item,
      restoreFocusElement,
      anchorPoint: null,
      anchorRect: resolveAnchorRectFromElement(element),
    });
  };
  const openCreateAgentMenuAtElement = (
    element: HTMLElement,
    restoreFocusElement: HTMLElement | null = element,
  ) => {
    if (isSelectionPending) {
      return;
    }

    closeAgentMenu();
    closeSessionMenu();
    setCreateAgentMenuState({
      restoreFocusElement,
      anchorRect: resolveAnchorRectFromElement(element),
    });
  };

  const handleSessionMenuAction = (
    actionId: 'favorite' | 'pin' | 'delete',
  ) => {
    if (!sessionMenuState) {
      return;
    }

    const sessionKey = buildChatSessionPreferencesKey({
      instanceId: sessionMenuState.sessionInstanceId,
      sessionId: sessionMenuState.item.sessionId,
    });

    if (actionId === 'favorite') {
      setSessionFavorited({
        sessionKey,
        isFavorited: !sessionMenuState.item.isFavorited,
      });
      closeSessionMenu();
      return;
    }

    if (actionId === 'pin') {
      if (sessionMenuState.item.pinOrigin !== 'system') {
        setSessionPinned({
          sessionKey,
          isPinned: sessionMenuState.item.pinOrigin === 'none',
        });
      }
      closeSessionMenu();
      return;
    }

    if (actionId === 'delete' && canDeleteSessions && sessionMenuState.item.showDeleteAction) {
      void onDeleteSession?.(
        sessionMenuState.item.sessionId,
        sessionMenuState.sessionInstanceId,
      );
      closeSessionMenu();
    }
  };
  const handleCreateAgentMenuAction = (actionId: ChatSidebarCreateAgentMenuActionId) => {
    setPendingCreateAgentActionId(actionId);
  };
  const handleAgentMenuAction = (
    actionId: 'publish' | 'settings' | 'remove',
  ) => {
    if (!agentMenuState?.item.id || !activeInstanceId) {
      closeAgentMenu();
      return;
    }

    const request: ChatSidebarAgentActionRequest = {
      actionId,
      instanceId: activeInstanceId,
      agentId: agentMenuState.item.id,
      agentName: agentMenuState.item.name,
      kernelId: agentMenuState.item.kernelId ?? null,
      kernelLabel: agentMenuState.item.kernelLabel ?? null,
    };

    closeAgentMenu();
    void onAgentAction?.(request);
  };

  const isCreateAgentMenuOpen = Boolean(createAgentMenuState);

  return (
    <div
      className={cn(
        'flex h-full min-h-0 w-full flex-col border-r border-zinc-200 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/50',
        className,
      )}
    >
      <div className="border-b border-zinc-200/80 px-3 pb-3 pt-3 dark:border-zinc-800/80">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
            <Input
              type="search"
              value={agentSearchQuery}
              onChange={(event) => setAgentSearchQuery(event.target.value)}
              placeholder={t('chat.sidebar.agentSearchPlaceholder')}
              className="h-10 rounded-lg border-transparent bg-zinc-900/[0.04] pl-9 pr-3 shadow-none focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:ring-offset-0 dark:border-transparent dark:bg-white/[0.05] dark:focus-visible:ring-offset-0"
            />
          </div>
          <button
            type="button"
            disabled={isSelectionPending}
            onClick={(event) => {
              if (isCreateAgentMenuOpen) {
                closeCreateAgentMenu();
                return;
              }
              openCreateAgentMenuAtElement(event.currentTarget, event.currentTarget);
            }}
            className="inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-zinc-900/[0.04] px-3 text-[13px] font-medium text-zinc-900 transition-colors hover:bg-zinc-900/[0.08] disabled:cursor-not-allowed disabled:bg-zinc-900/[0.03] disabled:text-zinc-400 dark:bg-white/[0.05] dark:text-zinc-100 dark:hover:bg-white/[0.09] dark:disabled:bg-white/[0.035] dark:disabled:text-zinc-500"
            title={t('chat.sidebar.newAgentOptions')}
            aria-label={t('chat.sidebar.newAgentOptions')}
            aria-haspopup="menu"
            aria-expanded={isCreateAgentMenuOpen}
            aria-controls={isCreateAgentMenuOpen ? 'chat-sidebar-create-agent-menu' : undefined}
          >
            <Plus className="h-4 w-4" />
            <span>{t('chat.sidebar.createButtonLabel')}</span>
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 text-zinc-400 transition-transform dark:text-zinc-500',
                isCreateAgentMenuOpen && 'rotate-180',
              )}
            />
          </button>
          {onClose ? (
            <button
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-900/[0.04] text-zinc-500 transition-colors hover:bg-zinc-900/[0.08] hover:text-zinc-900 dark:bg-white/[0.05] dark:text-zinc-300 dark:hover:bg-white/[0.09] dark:hover:text-zinc-100 lg:hidden"
              title={t('common.close')}
              aria-label={t('common.close')}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>
      {selectionErrorMessage ? (
        <div className="px-3 pt-3">
          <div
            role="alert"
            className="flex items-start gap-3 rounded-[0.8rem] bg-rose-500/[0.08] px-3.5 py-3 text-rose-950 dark:bg-rose-500/[0.12] dark:text-rose-100"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-300" />
            <p className="min-w-0 flex-1 text-[12px] leading-5 text-rose-800 dark:text-rose-100">
              {selectionErrorMessage}
            </p>
            <button
              type="button"
              aria-label={t('chat.sidebar.dismissSelectionError')}
              onClick={() => {
                onDismissSelectionError?.();
              }}
              className="inline-flex h-7 shrink-0 items-center rounded-md px-2 text-[11px] font-medium text-rose-700 transition-colors hover:bg-rose-500/[0.1] hover:text-rose-900 dark:text-rose-200 dark:hover:bg-rose-500/18 dark:hover:text-rose-50"
            >
              {t('chat.sidebar.dismissSelectionError')}
            </button>
          </div>
        </div>
      ) : null}

      <div ref={sidebarScrollContainerRef} className="flex-1 overflow-y-auto py-4">
        {sidebarChrome.showAgentRail ? (
          <div className="mb-5 px-2 pt-1">
            {visibleAgentRailItems.length === 0 && agentSearchQuery.trim() ? (
              <div className="rounded-[0.78rem] bg-zinc-900/[0.035] px-4 py-5 text-center dark:bg-white/[0.04]">
                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                  {t('chat.sidebar.noMatchingAgents')}
                </p>
                <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                  {t('chat.sidebar.noMatchingAgentsDescription')}
                </p>
              </div>
            ) : (
              <div className="max-h-[18rem] overflow-y-auto pr-0.5">
                <div className="space-y-1">
                  {visibleAgentRailItems.map((agent) => {
                    const isAgentPending =
                      selectionTransition?.kind === 'agent' && pendingAgentId === agent.id;
                    const canOpenAgentMenu = Boolean(agent.id && activeInstanceId);
                    const isAgentMenuOpen = agentMenuState?.item.id === agent.id;

                    return (
                      <ChatSidebarAgentItem
                        key={agent.id ?? '__main__'}
                        agent={agent}
                        isSelectionPending={isSelectionPending}
                        isAgentPending={isAgentPending}
                        isAgentMenuOpen={isAgentMenuOpen}
                        canOpenAgentMenu={canOpenAgentMenu}
                        moreActionsLabel={t('chat.sidebar.moreActions')}
                        mainAgentBadgeLabel={t('chat.sidebar.mainAgentBadge')}
                        onSelectAgent={(selectedAgent) => {
                          void onSelectAgent?.({
                            agentId: selectedAgent.id,
                          });
                        }}
                        onOpenMenuAtPoint={(event, selectedAgent) => {
                          openAgentMenuAtPoint(
                            event,
                            selectedAgent,
                            resolveSessionMenuRestoreFocusElement(event.currentTarget),
                          );
                        }}
                        onOpenMenuAtElement={(element, selectedAgent) => {
                          openAgentMenuAtElement(element, selectedAgent, element);
                        }}
                        onCloseMenu={closeAgentMenu}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : null}

        <div className="mb-4 px-3">
          <div className="grid w-full grid-cols-2 gap-0 border-b border-zinc-200/70 dark:border-zinc-800/80">
            {historyTabs.map((tab) => {
              const isActive = historyViewMode === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setHistoryViewMode(tab.id)}
                  className={cn(
                    'group relative flex w-full min-w-0 items-center justify-center px-9 py-2 text-center text-[12px] font-medium transition-colors',
                    isActive
                      ? 'text-zinc-900 dark:text-zinc-100'
                      : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200',
                  )}
                >
                  <span className="min-w-0 truncate leading-5">{tab.label}</span>
                  <span
                    className={cn(
                      'pointer-events-none absolute right-2.5 top-1/2 inline-flex min-w-[2.25rem] -translate-y-1/2 items-center justify-center text-[10px] font-medium tabular-nums',
                      isActive
                        ? 'text-zinc-600 dark:text-zinc-300'
                        : 'text-zinc-400 dark:text-zinc-500',
                    )}
                  >
                    {tab.count}
                  </span>
                  <span
                    className={cn(
                      'absolute inset-x-1 bottom-0 h-px rounded-full transition-opacity',
                      isActive
                        ? 'bg-primary-500/80 opacity-100 dark:bg-primary-300/85'
                        : 'bg-zinc-300 opacity-0 group-hover:opacity-70 dark:bg-zinc-700',
                    )}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {sidebarChrome.sections.map(({ section, titleKey }) => {
          if (section.items.length === 0) {
            return null;
          }

          return (
            <div key={section.id} className="mb-6">
              <h3 className="mb-1.5 px-3 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                {t(titleKey)}
              </h3>
              <div className="space-y-1 px-2">
                {section.items.map((item, itemIndex) => {
                  const sessionRecord = resolveSessionRecord(item.sessionId);
                  const sessionTitleText = resolveChatSidebarSessionTitleText({
                    itemDisplayTitle: item.displayTitle,
                    session: sessionRecord,
                  });
                  const isSessionMenuOpen =
                    sessionMenuState?.item.sessionId === item.sessionId;
                  const isSessionPending =
                    selectionTransition?.kind === 'session' &&
                    pendingSessionId === item.sessionId;

                  return (
                    <ChatSidebarSessionItem
                      key={`${section.id}:${item.sessionId}:${itemIndex}`}
                      item={item}
                      sessionTitleText={sessionTitleText}
                      isSelectionPending={isSelectionPending}
                      isSessionPending={isSessionPending}
                      isSessionMenuOpen={isSessionMenuOpen}
                      moreActionsLabel={t('chat.sidebar.moreActions')}
                      mainAgentBadgeLabel={t('chat.sidebar.mainAgentBadge')}
                      onSelectSession={selectSession}
                      onOpenMenuAtPoint={(event, selectedItem) => {
                        openSessionMenuAtPoint(
                          event,
                          selectedItem,
                          resolveSessionMenuRestoreFocusElement(event.currentTarget),
                        );
                      }}
                      onOpenMenuAtElement={(element, selectedItem) => {
                        openSessionMenuAtElement(element, selectedItem, element);
                      }}
                      onCloseMenu={closeSessionMenu}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}

        {sidebarChrome.showEmptyState ? (
          <div className="px-4 py-8 text-center">
            <MessageSquare className="mx-auto mb-3 h-8 w-8 text-zinc-300 dark:text-zinc-700" />
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {t('chat.sidebar.noHistory')}
            </p>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              {t('chat.sidebar.noHistoryDescription')}
            </p>
          </div>
        ) : null}
      </div>

      <ChatAgentCreationWorkflowDialog
        open={isAgentCreationDialogOpen}
        mode={agentCreationDialogMode}
        instanceId={activeInstanceId}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setAgentCreationDialogMode(null);
            return;
          }
        }}
        onCreated={async (result) => {
          return await onAgentCreated?.(result);
        }}
      />
      <ChatSidebarCreateAgentMenu
        open={isCreateAgentMenuOpen}
        actions={createAgentMenuActions}
        anchorRect={createAgentMenuState?.anchorRect ?? null}
        closeLabel={t('chat.sidebar.dismissCreateAgentMenu')}
        restoreFocusElement={createAgentMenuState?.restoreFocusElement ?? null}
        onClose={closeCreateAgentMenu}
        onSelectAction={handleCreateAgentMenuAction}
      />
      <ChatSidebarAgentActionMenu
        open={Boolean(agentMenuState && agentActionMenu)}
        sections={agentActionMenu?.sections ?? []}
        anchorRect={agentMenuState?.anchorRect ?? null}
        anchorPoint={agentMenuState?.anchorPoint ?? null}
        closeLabel={t('chat.sidebar.dismissAgentActionsMenu')}
        restoreFocusElement={agentMenuState?.restoreFocusElement ?? null}
        onClose={closeAgentMenu}
        onSelectAction={handleAgentMenuAction}
      />
      <ChatSidebarSessionActionMenu
        open={Boolean(sessionMenuState && sessionActionMenu)}
        sections={sessionActionMenu?.sections ?? []}
        anchorRect={sessionMenuState?.anchorRect ?? null}
        anchorPoint={sessionMenuState?.anchorPoint ?? null}
        closeLabel={t('chat.sidebar.dismissSessionActionsMenu')}
        restoreFocusElement={sessionMenuState?.restoreFocusElement ?? null}
        onClose={closeSessionMenu}
        onSelectAction={handleSessionMenuAction}
      />
    </div>
  );
}
