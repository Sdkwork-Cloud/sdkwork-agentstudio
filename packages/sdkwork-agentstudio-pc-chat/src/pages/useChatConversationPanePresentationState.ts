import type {
  LLMChannel,
  LLMModel,
} from '@sdkwork/agentstudio-pc-core';
import type { Agent, Skill } from '@sdkwork/agentstudio-pc-types';
import type { ChatConversationPaneProps } from '../components/ChatConversationPane';
import type { ChatComposerSubmitPayload } from '../types';
import type { ChatPageTranslate } from './chatPageContracts';

export interface UseChatConversationPanePresentationStateInput {
  t: ChatPageTranslate;
  activeModel?: LLMModel;
  activeAgent?: Agent;
  activeSkill?: Skill;
  workspaceTitle?: string | null;
  handleSend: (payload: ChatComposerSubmitPayload) => Promise<unknown> | void;
  handleStop: () => void;
  canStop: boolean;
  showJumpToLatest: boolean;
  jumpToLatest: () => void;
  activeMessagesCount: number;
  isBusy: boolean;
  channels: LLMChannel[];
  activeChannel?: LLMChannel;
  handleChannelChange: (channelId: string) => void;
  handleModelChange: (channelId: string, modelId: string) => void;
  openSidebar: () => void;
  openSessionContext: () => void;
  compactModelSelector: boolean;
  handleOpenModelConfig: () => void;
}

export interface UseChatConversationPanePresentationStateResult {
  topControlsProps: ChatConversationPaneProps['topControlsProps'];
  emptyStateProps: ChatConversationPaneProps['emptyStateProps'];
  composerPanelProps: ChatConversationPaneProps['composerPanelProps'];
}

export function useChatConversationPanePresentationState({
  t,
  activeModel,
  activeAgent,
  activeSkill,
  workspaceTitle,
  handleSend,
  handleStop,
  canStop,
  showJumpToLatest,
  jumpToLatest,
  activeMessagesCount,
  isBusy,
  channels,
  activeChannel,
  handleChannelChange,
  handleModelChange,
  openSidebar,
  openSessionContext,
  compactModelSelector,
  handleOpenModelConfig,
}: UseChatConversationPanePresentationStateInput): UseChatConversationPanePresentationStateResult {
  const appName = t('common.productName');
  const normalizedWorkspaceTitle = workspaceTitle?.trim() || null;
  const suggestions = [
    t('chat.page.suggestions.quantum'),
    t('chat.page.suggestions.python'),
    t('chat.page.suggestions.react'),
    t('chat.page.suggestions.email'),
  ];
  const emptyStateDescription = activeSkill
    ? t('chat.page.emptyWithSkill', {
        skill: activeSkill.name,
        category: activeSkill.category.toLowerCase(),
        appName,
      })
    : t('chat.page.emptyDefault', {
        appName,
      });
  const emptyStateHighlights = [
    activeModel?.name
      ? { label: activeModel.name, tone: 'neutral' as const }
      : null,
    activeAgent?.name
      ? { label: activeAgent.name, tone: 'neutral' as const }
      : null,
    activeSkill?.name
      ? { label: activeSkill.name, tone: 'primary' as const }
      : null,
  ].filter((value): value is { label: string; tone: 'neutral' | 'primary' } => Boolean(value));
  const topControlsProps = {
    expandSidebarLabel: t('common.expandSidebar'),
    openSessionContextLabel: t('chat.page.openSessionContext'),
    onOpenSidebar: openSidebar,
    onClick: openSessionContext,
  };
  const emptyStateProps = {
    appName,
    title: normalizedWorkspaceTitle || t('chat.page.emptyTitle'),
    description: emptyStateDescription,
    suggestions,
    highlights: emptyStateHighlights,
    onSuggestionSelect: (suggestion: string) =>
      void handleSend({
        text: suggestion,
        attachments: [],
      }),
  };
  const composerPanelProps = {
    showJumpToLatest,
    hasMessages: activeMessagesCount > 0,
    jumpToLatestLabel: t('chat.page.jumpToLatest'),
    onJumpToLatest: jumpToLatest,
    inputProps: {
      onSend: handleSend,
      isLoading: isBusy,
      canStop,
      onStop: handleStop,
      channels,
      activeChannel,
      activeModel,
      onChannelChange: handleChannelChange,
      onModelChange: handleModelChange,
      onOpenModelConfig: handleOpenModelConfig,
      compactModelSelector,
    },
  };

  return {
    topControlsProps,
    emptyStateProps,
    composerPanelProps,
  };
}
