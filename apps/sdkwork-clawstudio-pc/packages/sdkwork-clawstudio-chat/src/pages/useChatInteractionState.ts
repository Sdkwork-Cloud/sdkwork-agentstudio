import type { Agent, Skill } from '@sdkwork/clawstudio-types';
import {
  type ChatRunStateBinding,
  type ChatPageModelChannel,
  type InstanceChatRouteMode,
  type KernelChatAdapterCapabilities,
} from '../services';
import type { ChatComposerSubmitPayload } from '../types';
import type { ChatState } from '../store/useChatStore';
import type {
  ChatPageKernelSessionState,
  ChatPageNewSessionModelMode,
  ChatPageSendMode,
  ChatPageSessionScopeMode,
  ChatPageTranslate,
} from './chatPageContracts';
import { useChatInteractionModelState } from './useChatInteractionModelState';
import type { UseChatInteractionModelStateResult } from './useChatInteractionModelState';
import { useChatSendExecutionState } from './useChatSendExecutionState';

export interface UseChatInteractionStateInput {
  t: ChatPageTranslate;
  activeInstanceId: string | null | undefined;
  selectedSessionId: string | null;
  displaySessionId: string | null;
  sessionControlSessionId: string | null;
  activeKernelSessionState: ChatPageKernelSessionState;
  activeRunBinding: ChatRunStateBinding;
  runningRunBinding: ChatRunStateBinding | null;
  sendMode: ChatPageSendMode;
  catalogChannels: ChatPageModelChannel[];
  sessionSelectedModelId: string | null;
  activeChannelId: string;
  activeModelId: string;
  routeMode: InstanceChatRouteMode | undefined;
  isChatSupportedRoute: boolean;
  activeAdapterCapabilities: KernelChatAdapterCapabilities | null;
  newSessionModelMode: ChatPageNewSessionModelMode;
  effectiveGatewayAgentId: string | null;
  activeSkill: Skill | undefined;
  activeAgent: Agent | undefined;
  sessionScopeMode: ChatPageSessionScopeMode;
  createSession: ChatState['createSession'];
  addMessage: ChatState['addMessage'];
  updateMessage: ChatState['updateMessage'];
  removeMessages: ChatState['removeMessages'];
  flushSession: ChatState['flushSession'];
  sendKernelMessage: ChatState['sendKernelMessage'];
  abortSession: ChatState['abortSession'];
  setActiveChannel: (instanceId: string, channelId: string) => void;
  setActiveModel: (instanceId: string, modelId: string) => void;
  setKernelSessionModel: ChatState['setKernelSessionModel'];
  setKernelSessionThinkingLevel: ChatState['setKernelSessionThinkingLevel'];
  setKernelSessionFastMode: ChatState['setKernelSessionFastMode'];
  setKernelSessionVerboseLevel: ChatState['setKernelSessionVerboseLevel'];
  setKernelSessionReasoningLevel: ChatState['setKernelSessionReasoningLevel'];
}

export interface UseChatInteractionStateResult {
  isActiveSessionGenerating: boolean;
  isBusy: boolean;
  canStop: boolean;
  channels: UseChatInteractionModelStateResult['channels'];
  activeChannel: UseChatInteractionModelStateResult['activeChannel'];
  activeModel: UseChatInteractionModelStateResult['activeModel'];
  sessionControlActions: UseChatInteractionModelStateResult['sessionControlActions'];
  activeThinkingLevel: UseChatInteractionModelStateResult['activeThinkingLevel'];
  thinkingLevelDefaultLabel: UseChatInteractionModelStateResult['thinkingLevelDefaultLabel'];
  thinkingLevelOptions: UseChatInteractionModelStateResult['thinkingLevelOptions'];
  activeFastMode: UseChatInteractionModelStateResult['activeFastMode'];
  fastModeDefaultLabel: UseChatInteractionModelStateResult['fastModeDefaultLabel'];
  fastModeOptions: UseChatInteractionModelStateResult['fastModeOptions'];
  activeVerboseLevel: UseChatInteractionModelStateResult['activeVerboseLevel'];
  verboseLevelDefaultLabel: UseChatInteractionModelStateResult['verboseLevelDefaultLabel'];
  verboseLevelOptions: UseChatInteractionModelStateResult['verboseLevelOptions'];
  activeReasoningLevel: UseChatInteractionModelStateResult['activeReasoningLevel'];
  reasoningLevelDefaultLabel: UseChatInteractionModelStateResult['reasoningLevelDefaultLabel'];
  reasoningLevelOptions: UseChatInteractionModelStateResult['reasoningLevelOptions'];
  newSessionModel: UseChatInteractionModelStateResult['newSessionModel'];
  handleChannelChange: UseChatInteractionModelStateResult['handleChannelChange'];
  handleModelChange: UseChatInteractionModelStateResult['handleModelChange'];
  handleSend: (payload: ChatComposerSubmitPayload) => Promise<boolean>;
  handleStop: () => void;
}

export function useChatInteractionState({
  t,
  activeInstanceId,
  selectedSessionId,
  displaySessionId,
  sessionControlSessionId,
  activeKernelSessionState,
  activeRunBinding,
  runningRunBinding,
  sendMode,
  catalogChannels,
  sessionSelectedModelId,
  activeChannelId,
  activeModelId,
  routeMode,
  isChatSupportedRoute,
  activeAdapterCapabilities,
  newSessionModelMode,
  effectiveGatewayAgentId,
  activeSkill,
  activeAgent,
  sessionScopeMode,
  createSession,
  addMessage,
  updateMessage,
  removeMessages,
  flushSession,
  sendKernelMessage,
  abortSession,
  setActiveChannel,
  setActiveModel,
  setKernelSessionModel,
  setKernelSessionThinkingLevel,
  setKernelSessionFastMode,
  setKernelSessionVerboseLevel,
  setKernelSessionReasoningLevel,
}: UseChatInteractionStateInput): UseChatInteractionStateResult {
  const {
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
  } = useChatInteractionModelState({
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
  });
  const { isActiveSessionGenerating, isBusy, canStop, handleSend, handleStop } = useChatSendExecutionState({
    activeInstanceId,
    selectedSessionId,
    displaySessionId,
    activeRunBinding,
    runningRunBinding,
    sendMode,
    routeMode,
    isChatSupportedRoute,
    activeAdapterCapabilities,
    activeChannel,
    activeModel,
    activeSkill,
    activeAgent,
    sessionScopeMode,
    effectiveGatewayAgentId,
    newSessionModel,
    createSession,
    addMessage,
    updateMessage,
    removeMessages,
    flushSession,
    sendKernelMessage,
    abortSession,
  });

  return {
    isActiveSessionGenerating,
    isBusy,
    canStop,
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
    handleSend,
    handleStop,
  };
}
