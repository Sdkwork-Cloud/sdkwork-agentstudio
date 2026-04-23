import {
  type ChatPageModelChannel,
  type KernelChatAdapterCapabilities,
} from '../services';
import { useChatSessionControlState, type UseChatSessionControlStateResult } from './useChatSessionControlState';
import type {
  ChatPageKernelSessionState,
  ChatPageNewSessionModelMode,
  ChatPageTranslate,
} from './chatPageContracts';
import {
  useChatPageModelSelectionState,
  type UseChatPageModelSelectionStateResult,
} from './useChatPageModelSelectionState';
import type { ChatState } from '../store/useChatStore';

export interface UseChatInteractionModelStateInput {
  t: ChatPageTranslate;
  activeInstanceId: string | null | undefined;
  sessionControlSessionId: string | null;
  activeAdapterCapabilities: KernelChatAdapterCapabilities | null;
  activeKernelSessionState: ChatPageKernelSessionState;
  catalogChannels: ChatPageModelChannel[];
  sessionSelectedModelId: string | null;
  activeChannelId: string;
  activeModelId: string;
  newSessionModelMode: ChatPageNewSessionModelMode;
  setActiveChannel: (instanceId: string, channelId: string) => void;
  setActiveModel: (instanceId: string, modelId: string) => void;
  setKernelSessionModel: ChatState['setKernelSessionModel'];
  setKernelSessionThinkingLevel: ChatState['setKernelSessionThinkingLevel'];
  setKernelSessionFastMode: ChatState['setKernelSessionFastMode'];
  setKernelSessionVerboseLevel: ChatState['setKernelSessionVerboseLevel'];
  setKernelSessionReasoningLevel: ChatState['setKernelSessionReasoningLevel'];
}

export interface UseChatInteractionModelStateResult {
  channels: UseChatPageModelSelectionStateResult['channels'];
  activeChannel: UseChatPageModelSelectionStateResult['activeChannel'];
  activeModel: UseChatPageModelSelectionStateResult['activeModel'];
  sessionControlActions: UseChatSessionControlStateResult['sessionControlActions'];
  activeThinkingLevel: UseChatSessionControlStateResult['currentThinkingLevel'];
  thinkingLevelDefaultLabel: UseChatSessionControlStateResult['thinkingLevelDefaultLabel'];
  thinkingLevelOptions: UseChatSessionControlStateResult['thinkingLevelOptions'];
  activeFastMode: UseChatSessionControlStateResult['currentFastMode'];
  fastModeDefaultLabel: UseChatSessionControlStateResult['fastModeDefaultLabel'];
  fastModeOptions: UseChatSessionControlStateResult['fastModeOptions'];
  activeVerboseLevel: UseChatSessionControlStateResult['currentVerboseLevel'];
  verboseLevelDefaultLabel: UseChatSessionControlStateResult['verboseLevelDefaultLabel'];
  verboseLevelOptions: UseChatSessionControlStateResult['verboseLevelOptions'];
  activeReasoningLevel: UseChatSessionControlStateResult['currentReasoningLevel'];
  reasoningLevelDefaultLabel: UseChatSessionControlStateResult['reasoningLevelDefaultLabel'];
  reasoningLevelOptions: UseChatSessionControlStateResult['reasoningLevelOptions'];
  newSessionModel: UseChatPageModelSelectionStateResult['newSessionModel'];
  handleChannelChange: UseChatPageModelSelectionStateResult['handleChannelChange'];
  handleModelChange: UseChatPageModelSelectionStateResult['handleModelChange'];
}

export function useChatInteractionModelState({
  t,
  activeInstanceId,
  sessionControlSessionId,
  activeAdapterCapabilities,
  activeKernelSessionState,
  catalogChannels,
  sessionSelectedModelId,
  activeChannelId,
  activeModelId,
  newSessionModelMode,
  setActiveChannel,
  setActiveModel,
  setKernelSessionModel,
  setKernelSessionThinkingLevel,
  setKernelSessionFastMode,
  setKernelSessionVerboseLevel,
  setKernelSessionReasoningLevel,
}: UseChatInteractionModelStateInput): UseChatInteractionModelStateResult {
  const resolvedSessionControlModelId = sessionSelectedModelId || activeModelId || null;

  const {
    sessionControlActions,
    currentThinkingLevel: activeThinkingLevel,
    thinkingLevelDefaultLabel,
    thinkingLevelOptions,
    currentFastMode: activeFastMode,
    fastModeDefaultLabel,
    fastModeOptions,
    currentVerboseLevel: activeVerboseLevel,
    verboseLevelDefaultLabel,
    verboseLevelOptions,
    currentReasoningLevel: activeReasoningLevel,
    reasoningLevelDefaultLabel,
    reasoningLevelOptions,
  } = useChatSessionControlState({
    t,
    activeInstanceId,
    targetSessionId: sessionControlSessionId,
    activeAdapterCapabilities,
    activeKernelSessionState,
    activeModelId: resolvedSessionControlModelId,
    setKernelSessionModel,
    setKernelSessionThinkingLevel,
    setKernelSessionFastMode,
    setKernelSessionVerboseLevel,
    setKernelSessionReasoningLevel,
  });
  const {
    channels,
    activeChannel,
    activeModel,
    newSessionModel,
    handleChannelChange,
    handleModelChange,
  } = useChatPageModelSelectionState({
    activeInstanceId,
    catalogChannels,
    sessionSelectedModelId,
    activeChannelId,
    activeModelId,
    newSessionModelMode,
    setActiveChannel,
    setActiveModel,
    sessionControlActions,
  });

  return {
    channels,
    activeChannel,
    activeModel,
    sessionControlActions,
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
    newSessionModel,
    handleChannelChange,
    handleModelChange,
  };
}
