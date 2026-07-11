import type {
  ChatPageKernelSessionState,
  ChatPageRuntimeAdapterCapabilities,
} from './chatPageContracts';

export interface UseChatSessionControlCapabilityStateInput {
  activeAdapterCapabilities: ChatPageRuntimeAdapterCapabilities;
  activeKernelSessionState: ChatPageKernelSessionState;
  activeModelId: string | null;
}

export function useChatSessionControlCapabilityState({
  activeAdapterCapabilities,
  activeKernelSessionState,
  activeModelId,
}: UseChatSessionControlCapabilityStateInput) {
  const activeCapabilitySet = activeAdapterCapabilities?.capabilitySet ?? null;
  const supportsModelSelection = Boolean(activeCapabilitySet?.supportsModelSelection);
  const supportsThinkingLevelControl = Boolean(activeCapabilitySet?.supportsThinkingLevel);
  const supportsFastModeControl = Boolean(activeCapabilitySet?.supportsFastMode);
  const supportsVerboseLevelControl = Boolean(activeCapabilitySet?.supportsVerboseLevel);
  const supportsReasoningLevelControl = Boolean(activeCapabilitySet?.supportsReasoningControl);
  const activeThinkingLevel = supportsThinkingLevelControl ? activeKernelSessionState.thinkingLevel : null;
  const activeFastMode =
    supportsFastModeControl
      ? activeKernelSessionState.fastMode === true
        ? 'on'
        : activeKernelSessionState.fastMode === false
          ? 'off'
          : null
      : null;
  const activeVerboseLevel = supportsVerboseLevelControl ? activeKernelSessionState.verboseLevel : null;
  const activeReasoningLevel = supportsReasoningLevelControl ? activeKernelSessionState.reasoningLevel : null;
  const activeThinkingModelId =
    (supportsThinkingLevelControl || supportsReasoningLevelControl)
      ? activeKernelSessionState.model || activeKernelSessionState.defaultModel || activeModelId || null
      : null;

  return {
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
  };
}
