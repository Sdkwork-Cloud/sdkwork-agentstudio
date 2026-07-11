import { useMemo } from 'react';
import { createChatSessionControlActions } from '../services';
import type {
  ChatPageKernelSessionState,
  ChatPageRuntimeAdapterCapabilities,
  ChatPageSessionControlOption,
  ChatPageTranslate,
} from './chatPageContracts';
import { useChatSessionControlCapabilityState } from './useChatSessionControlCapabilityState';
import { useChatSessionControlOptionsState } from './useChatSessionControlOptionsState';

export interface UseChatSessionControlStateInput {
  t: ChatPageTranslate;
  activeInstanceId: string | null | undefined;
  targetSessionId: string | null;
  activeAdapterCapabilities: ChatPageRuntimeAdapterCapabilities;
  activeKernelSessionState: ChatPageKernelSessionState;
  activeModelId: string | null;
  setKernelSessionModel: (params: {
    instanceId: string;
    sessionId: string;
    model: string | null;
  }) => Promise<void>;
  setKernelSessionThinkingLevel: (params: {
    instanceId: string;
    sessionId: string;
    thinkingLevel: string | null;
  }) => Promise<void>;
  setKernelSessionFastMode: (params: {
    instanceId: string;
    sessionId: string;
    fastMode: boolean | null;
  }) => Promise<void>;
  setKernelSessionVerboseLevel: (params: {
    instanceId: string;
    sessionId: string;
    verboseLevel: string | null;
  }) => Promise<void>;
  setKernelSessionReasoningLevel: (params: {
    instanceId: string;
    sessionId: string;
    reasoningLevel: string | null;
  }) => Promise<void>;
}

export interface UseChatSessionControlStateResult {
  sessionControlActions: ReturnType<typeof createChatSessionControlActions>;
  currentThinkingLevel: string | null;
  thinkingLevelDefaultLabel: string;
  thinkingLevelOptions: ChatPageSessionControlOption[];
  currentFastMode: string | null;
  fastModeDefaultLabel: string;
  fastModeOptions: ChatPageSessionControlOption[];
  currentVerboseLevel: string | null;
  verboseLevelDefaultLabel: string;
  verboseLevelOptions: ChatPageSessionControlOption[];
  currentReasoningLevel: string | null;
  reasoningLevelDefaultLabel: string;
  reasoningLevelOptions: ChatPageSessionControlOption[];
}

export function useChatSessionControlState({
  t,
  activeInstanceId,
  targetSessionId,
  activeAdapterCapabilities,
  activeKernelSessionState,
  activeModelId,
  setKernelSessionModel,
  setKernelSessionThinkingLevel,
  setKernelSessionFastMode,
  setKernelSessionVerboseLevel,
  setKernelSessionReasoningLevel,
}: UseChatSessionControlStateInput): UseChatSessionControlStateResult {
  const {
    supportsModelSelection,
    supportsThinkingLevelControl,
    supportsFastModeControl,
    supportsVerboseLevelControl,
    supportsReasoningLevelControl,
    activeThinkingLevel,
    activeFastMode,
    activeVerboseLevel,
    activeReasoningLevel,
    activeThinkingModelId,
  } = useChatSessionControlCapabilityState({
    activeAdapterCapabilities,
    activeKernelSessionState,
    activeModelId,
  });
  const sessionControlActions = useMemo(
    () =>
      createChatSessionControlActions({
        activeInstanceId,
        targetSessionId,
        supportsModelSelection,
        supportsThinkingLevelControl,
        supportsFastModeControl,
        supportsVerboseLevelControl,
        supportsReasoningLevelControl,
        setKernelSessionModel,
        setKernelSessionThinkingLevel,
        setKernelSessionFastMode,
        setKernelSessionVerboseLevel,
        setKernelSessionReasoningLevel,
      }),
    [
      activeInstanceId,
      targetSessionId,
      supportsModelSelection,
      setKernelSessionFastMode,
      setKernelSessionModel,
      setKernelSessionReasoningLevel,
      setKernelSessionThinkingLevel,
      setKernelSessionVerboseLevel,
      supportsFastModeControl,
      supportsReasoningLevelControl,
      supportsThinkingLevelControl,
      supportsVerboseLevelControl,
    ],
  );
  const {
    thinkingLevelDefaultLabel,
    thinkingLevelOptions,
    fastModeDefaultLabel,
    fastModeOptions,
    verboseLevelDefaultLabel,
    verboseLevelOptions,
    reasoningLevelDefaultLabel,
    reasoningLevelOptions,
  } = useChatSessionControlOptionsState({
    t,
    activeThinkingModelId,
  });

  return {
    sessionControlActions,
    currentThinkingLevel: activeThinkingLevel ?? null,
    thinkingLevelDefaultLabel,
    thinkingLevelOptions,
    currentFastMode: activeFastMode,
    fastModeDefaultLabel,
    fastModeOptions,
    currentVerboseLevel: activeVerboseLevel ?? null,
    verboseLevelDefaultLabel,
    verboseLevelOptions,
    currentReasoningLevel: activeReasoningLevel ?? null,
    reasoningLevelDefaultLabel,
    reasoningLevelOptions,
  };
}
