export interface ChatSidebarSelectionCompleted {
  status: 'completed';
  errorMessage: null;
}

export interface ChatSidebarSelectionFailed {
  status: 'failed';
  errorMessage: string;
}

export type ChatSidebarSelectionActionResult =
  | ChatSidebarSelectionCompleted
  | ChatSidebarSelectionFailed;

export const CHAT_SIDEBAR_SELECTION_COMPLETED: ChatSidebarSelectionCompleted = {
  status: 'completed',
  errorMessage: null,
};

function resolveSelectionErrorMessage(error: unknown, fallbackMessage: string) {
  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (
    error
    && typeof error === 'object'
    && 'message' in error
    && typeof (error as { message?: unknown }).message === 'string'
    && (error as { message: string }).message.trim()
  ) {
    return (error as { message: string }).message;
  }

  return fallbackMessage;
}

export function createChatSidebarSelectionFailure(
  error: unknown,
  fallbackMessage: string,
): ChatSidebarSelectionFailed {
  return {
    status: 'failed',
    errorMessage: resolveSelectionErrorMessage(error, fallbackMessage),
  };
}
