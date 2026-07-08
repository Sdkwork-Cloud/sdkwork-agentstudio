export interface ChatAgentCreationFollowUpCompleted {
  status: 'completed';
  errorMessage: null;
}

export interface ChatAgentCreationFollowUpActivationFailed {
  status: 'activationFailed';
  errorMessage: string | null;
}

export type ChatAgentCreationFollowUpResult =
  | ChatAgentCreationFollowUpCompleted
  | ChatAgentCreationFollowUpActivationFailed;

export const CHAT_AGENT_CREATION_FOLLOW_UP_COMPLETED: ChatAgentCreationFollowUpCompleted = {
  status: 'completed',
  errorMessage: null,
};

function resolveFollowUpErrorMessage(error: unknown) {
  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.message || null;
  }

  if (
    error
    && typeof error === 'object'
    && 'message' in error
    && typeof (error as { message?: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message || null;
  }

  return null;
}

export function createChatAgentCreationFollowUpFailure(
  error: unknown,
): ChatAgentCreationFollowUpActivationFailed {
  return {
    status: 'activationFailed',
    errorMessage: resolveFollowUpErrorMessage(error),
  };
}

export function normalizeChatAgentCreationFollowUpResult(
  result: ChatAgentCreationFollowUpResult | void | null | undefined,
): ChatAgentCreationFollowUpResult {
  if (result?.status === 'activationFailed') {
    return result;
  }

  return CHAT_AGENT_CREATION_FOLLOW_UP_COMPLETED;
}
