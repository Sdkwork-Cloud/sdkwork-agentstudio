import type { ChatHeaderPresentation } from '../services';
import type { ChatSessionContextDrawerProps } from '../components/ChatSessionContextDrawer';
import type { ChatPageSessionControlActions } from './chatPageContracts';

export interface UseChatSessionContextDrawerPresentationStateInput {
  isSessionContextDrawerOpen: boolean;
  setIsSessionContextDrawerOpen: (value: boolean) => void;
  headerPresentation: ChatHeaderPresentation;
  headerStatusLabel: string;
  sessionRouteLabel: string;
  effectiveLastError: string | undefined;
  currentChannelName: string | null;
  activeModelName: string | null;
  sessionSelectedModelId: string | null;
  activeThinkingLevel: string | null;
  thinkingLevelDefaultLabel: string;
  thinkingLevelOptions: NonNullable<ChatSessionContextDrawerProps['thinkingLevelOptions']>;
  activeFastMode: string | null;
  fastModeDefaultLabel: string;
  fastModeOptions: NonNullable<ChatSessionContextDrawerProps['fastModeOptions']>;
  activeVerboseLevel: string | null;
  verboseLevelDefaultLabel: string;
  verboseLevelOptions: NonNullable<ChatSessionContextDrawerProps['verboseLevelOptions']>;
  activeReasoningLevel: string | null;
  reasoningLevelDefaultLabel: string;
  reasoningLevelOptions: NonNullable<ChatSessionContextDrawerProps['reasoningLevelOptions']>;
  sessionControlActions: ChatPageSessionControlActions;
  agentOptions: ChatSessionContextDrawerProps['agentOptions'];
  selectedAgentId: string | null | undefined;
  isAgentSelectorLoading: boolean;
  isChatSupportedRoute: boolean;
  onSelectAgent: (value: string | null | undefined) => void;
  skillOptions: ChatSessionContextDrawerProps['skillOptions'];
  selectedSkillId: string | null;
  isSkillSelectorLoading: boolean;
  setSelectedSkillId: (value: string | null) => void;
  handleOpenSettings: () => void;
}

export function useChatSessionContextDrawerPresentationState({
  isSessionContextDrawerOpen,
  setIsSessionContextDrawerOpen,
  headerPresentation,
  headerStatusLabel,
  sessionRouteLabel,
  effectiveLastError,
  currentChannelName,
  activeModelName,
  sessionSelectedModelId,
  activeThinkingLevel,
  thinkingLevelDefaultLabel,
  thinkingLevelOptions,
  activeFastMode,
  fastModeDefaultLabel,
  fastModeOptions,
  activeVerboseLevel,
  verboseLevelDefaultLabel,
  verboseLevelOptions,
  activeReasoningLevel,
  reasoningLevelDefaultLabel,
  reasoningLevelOptions,
  sessionControlActions,
  agentOptions,
  selectedAgentId,
  isAgentSelectorLoading,
  isChatSupportedRoute,
  onSelectAgent,
  skillOptions,
  selectedSkillId,
  isSkillSelectorLoading,
  setSelectedSkillId,
  handleOpenSettings,
}: UseChatSessionContextDrawerPresentationStateInput): ChatSessionContextDrawerProps {
  const sessionContextDrawerProps = {
    isOpen: isSessionContextDrawerOpen,
    onClose: () => setIsSessionContextDrawerOpen(false),
    title: headerPresentation.title,
    statusLabel: headerStatusLabel,
    statusTone: headerPresentation.status,
    detailItems: headerPresentation.detailItems,
    currentChannelName,
    currentModelName: activeModelName ?? sessionSelectedModelId ?? null,
    routeLabel: sessionRouteLabel,
    errorMessage: effectiveLastError ?? null,
    onOpenSettings: handleOpenSettings,
    currentThinkingLevel: activeThinkingLevel,
    thinkingLevelDefaultLabel,
    thinkingLevelOptions,
    onSelectThinkingLevel: sessionControlActions.onSelectThinkingLevel,
    currentFastMode: activeFastMode,
    fastModeDefaultLabel,
    fastModeOptions,
    onSelectFastMode: sessionControlActions.onSelectFastMode,
    currentVerboseLevel: activeVerboseLevel,
    verboseLevelDefaultLabel,
    verboseLevelOptions,
    onSelectVerboseLevel: sessionControlActions.onSelectVerboseLevel,
    currentReasoningLevel: activeReasoningLevel,
    reasoningLevelDefaultLabel,
    reasoningLevelOptions,
    onSelectReasoningLevel: sessionControlActions.onSelectReasoningLevel,
    agentOptions,
    selectedAgentId,
    isAgentLoading: isAgentSelectorLoading,
    showAgentSection: isChatSupportedRoute,
    onSelectAgent,
    skillOptions,
    selectedSkillId,
    isSkillLoading: isSkillSelectorLoading,
    showSkillSection: isChatSupportedRoute,
    onSelectSkill: setSelectedSkillId,
  };

  return sessionContextDrawerProps;
}
