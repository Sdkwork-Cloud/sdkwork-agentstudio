export interface ChatSessionMutationTarget {
  instanceId: string;
  sessionId: string;
}

export interface ResolveChatSessionMutationTargetInput {
  activeInstanceId: string | null | undefined;
  targetSessionId: string | null | undefined;
}

export interface CreateChatSessionControlActionsInput
  extends ResolveChatSessionMutationTargetInput {
  supportsModelSelection: boolean;
  supportsThinkingLevelControl: boolean;
  supportsFastModeControl: boolean;
  supportsVerboseLevelControl: boolean;
  supportsReasoningLevelControl: boolean;
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
  logError?: (message: string, error: unknown) => void;
}

export interface ChatSessionControlActions {
  syncChannelModel: (model: string | null) => void;
  syncExplicitModel: (model: string | null) => void;
  onSelectThinkingLevel?: (thinkingLevel: string | null) => void;
  onSelectFastMode?: (fastMode: string | null) => void;
  onSelectVerboseLevel?: (verboseLevel: string | null) => void;
  onSelectReasoningLevel?: (reasoningLevel: string | null) => void;
}

export function resolveChatSessionMutationTarget(
  params: ResolveChatSessionMutationTargetInput,
): ChatSessionMutationTarget | null {
  if (!params.activeInstanceId || !params.targetSessionId) {
    return null;
  }

  return {
    instanceId: params.activeInstanceId,
    sessionId: params.targetSessionId,
  };
}

export function createChatSessionControlActions(
  input: CreateChatSessionControlActionsInput,
): ChatSessionControlActions {
  const target = resolveChatSessionMutationTarget(input);
  const modelTarget = input.supportsModelSelection ? target : null;
  const logError = input.logError ?? ((message: string, error: unknown) => {
    console.error(message, error);
  });

  const runWithTarget = (
    resolvedTarget: ChatSessionMutationTarget | null,
    callback: (target: ChatSessionMutationTarget) => Promise<void>,
    errorMessage: string,
  ) => {
    if (!resolvedTarget) {
      return;
    }

    void callback(resolvedTarget).catch((error) => {
      logError(errorMessage, error);
    });
  };

  return {
    syncChannelModel(model) {
      runWithTarget(
        modelTarget,
        (resolvedTarget) =>
          input.setKernelSessionModel({
            ...resolvedTarget,
            model,
          }),
        'Failed to switch kernel chat session model:',
      );
    },
    syncExplicitModel(model) {
      runWithTarget(
        modelTarget,
        (resolvedTarget) =>
          input.setKernelSessionModel({
            ...resolvedTarget,
            model,
          }),
        'Failed to update kernel chat session model:',
      );
    },
    onSelectThinkingLevel: input.supportsThinkingLevelControl && target
      ? (thinkingLevel) => {
          runWithTarget(
            target,
            (resolvedTarget) =>
              input.setKernelSessionThinkingLevel({
                ...resolvedTarget,
                thinkingLevel,
              }),
            'Failed to update kernel chat session thinking level:',
          );
        }
      : undefined,
    onSelectFastMode: input.supportsFastModeControl && target
      ? (fastMode) => {
          runWithTarget(
            target,
            (resolvedTarget) =>
              input.setKernelSessionFastMode({
                ...resolvedTarget,
                fastMode: fastMode === null ? null : fastMode === 'on',
              }),
            'Failed to update kernel chat session fast mode:',
          );
        }
      : undefined,
    onSelectVerboseLevel: input.supportsVerboseLevelControl && target
      ? (verboseLevel) => {
          runWithTarget(
            target,
            (resolvedTarget) =>
              input.setKernelSessionVerboseLevel({
                ...resolvedTarget,
                verboseLevel,
              }),
            'Failed to update kernel chat session verbose level:',
          );
        }
      : undefined,
    onSelectReasoningLevel: input.supportsReasoningLevelControl && target
      ? (reasoningLevel) => {
          runWithTarget(
            target,
            (resolvedTarget) =>
              input.setKernelSessionReasoningLevel({
                ...resolvedTarget,
                reasoningLevel,
              }),
            'Failed to update kernel chat session reasoning level:',
          );
        }
      : undefined,
  };
}
