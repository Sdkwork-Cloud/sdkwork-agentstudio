import type { Agent, Skill, StudioConversationAttachment } from '@sdkwork/clawstudio-types';
import type { ChatModel } from '../types/index.ts';

type PendingSendSessionIdSetter = (
  nextState: string | null | ((current: string | null) => string | null),
) => void;

type LocalChatMessageRole = 'user' | 'assistant' | 'system' | 'tool';

interface LocalChatMessageMutationInput {
  role: LocalChatMessageRole;
  content: string;
  attachments?: StudioConversationAttachment[];
  model?: string;
}

interface LocalChatSessionMessageLike {
  id: string;
  role: LocalChatMessageRole;
}

interface LocalChatSessionLike {
  id: string;
  messages?: LocalChatSessionMessageLike[] | null;
  instanceId?: string | null;
  kernelSession?: {
    ref?: {
      kernelId?: string | null;
      instanceId?: string | null;
      sessionId?: string | null;
    } | null;
  } | null;
}

interface LocalChatMessageUpdateOptions {
  persist?: boolean;
}

interface AbortControllerRefLike {
  current: AbortController | null;
}

export interface CreateChatLocalRunActionsInput {
  sendMode: 'local' | 'gateway';
  abortControllerRef: AbortControllerRefLike;
  setPendingSendSessionId: PendingSendSessionIdSetter;
  addMessage: (
    sessionId: string,
    message: LocalChatMessageMutationInput,
    instanceId?: string | null,
  ) => void;
  updateMessage: (
    sessionId: string,
    messageId: string,
    content: string,
    instanceId?: string | null,
    options?: LocalChatMessageUpdateOptions,
  ) => void;
  removeMessages: (
    sessionId: string,
    messageIds: string[],
    instanceId?: string | null,
  ) => void;
  flushSession: (sessionId: string, instanceId?: string | null) => Promise<void>;
  getSessionById: (
    sessionId: string,
    instanceId?: string | null,
  ) => LocalChatSessionLike | undefined;
  sendMessageStream: (
    chatSession: unknown,
    message: string,
    model: ChatModel,
    skill?: Skill,
    agent?: Agent,
    abortSignal?: AbortSignal,
    attachments?: StudioConversationAttachment[],
  ) => AsyncGenerator<string, void, unknown>;
  logError?: (message: string, error: unknown) => void;
}

export interface SendChatLocalRunInput {
  sessionId: string;
  sessionInstanceId?: string | null;
  content: string;
  attachments: StudioConversationAttachment[];
  requestText: string;
  requestModel: ChatModel;
  requestSkill?: Skill;
  requestAgent?: Agent;
}

export interface ChatLocalRunActions {
  sendLocalRun: (params: SendChatLocalRunInput) => Promise<boolean>;
  stopActiveRun: () => boolean;
}

function updateLastAssistantMessage(params: {
  sessionId: string;
  sessionInstanceId?: string | null;
  nextContent: string;
  updateOptions?: LocalChatMessageUpdateOptions;
  getSessionById: CreateChatLocalRunActionsInput['getSessionById'];
  updateMessage: CreateChatLocalRunActionsInput['updateMessage'];
}) {
  const currentSession = params.getSessionById(
    params.sessionId,
    params.sessionInstanceId,
  );
  const currentMessages = Array.isArray(currentSession?.messages)
    ? currentSession.messages
    : [];
  const lastMessage = [...currentMessages]
    .reverse()
    .find((message) => message.role === 'assistant');
  if (lastMessage?.role === 'assistant') {
    params.updateMessage(
      params.sessionId,
      lastMessage.id,
      params.nextContent,
      params.sessionInstanceId,
      params.updateOptions,
    );
    return true;
  }

  return false;
}

function updateAssistantMessage(params: {
  sessionId: string;
  sessionInstanceId?: string | null;
  assistantMessageId?: string;
  nextContent: string;
  updateOptions?: LocalChatMessageUpdateOptions;
  getSessionById: CreateChatLocalRunActionsInput['getSessionById'];
  updateMessage: CreateChatLocalRunActionsInput['updateMessage'];
}) {
  if (params.assistantMessageId) {
    const currentSession = params.getSessionById(
      params.sessionId,
      params.sessionInstanceId,
    );
    const currentMessages = Array.isArray(currentSession?.messages)
      ? currentSession.messages
      : [];
    const targetMessage = currentMessages.find(
      (message) => message.id === params.assistantMessageId,
    );
    if (targetMessage?.role === 'assistant') {
      params.updateMessage(
        params.sessionId,
        params.assistantMessageId,
        params.nextContent,
        params.sessionInstanceId,
        params.updateOptions,
      );
      return true;
    }
  }

  return updateLastAssistantMessage(params);
}

function resolveLocalRunErrorMessage(error: unknown) {
  const message =
    error instanceof Error
      ? error.message.trim()
      : typeof error === 'string'
        ? error.trim()
        : '';

  if (!message) {
    return 'Error: Failed to generate a response.';
  }

  return message.toLowerCase().startsWith('error:') ? message : `Error: ${message}`;
}

function appendAssistantFailureSuffix(content: string, errorMessage: string) {
  if (!content.trim()) {
    return errorMessage;
  }

  if (content.includes(errorMessage)) {
    return content;
  }

  return `${content.trimEnd()}\n\n${errorMessage}`;
}

function listSessionMessageIds(
  session: LocalChatSessionLike | undefined,
  startIndex = 0,
) {
  if (!Array.isArray(session?.messages)) {
    return [];
  }

  return session.messages.slice(startIndex).map((message) => message.id);
}

export function createChatLocalRunActions(
  input: CreateChatLocalRunActionsInput,
): ChatLocalRunActions {
  const logError = input.logError ?? ((message: string, error: unknown) => {
    console.error(message, error);
  });

  return {
    async sendLocalRun(params) {
      if (input.sendMode !== 'local') {
        return false;
      }

      const previousMessageCount = listSessionMessageIds(
        input.getSessionById(params.sessionId, params.sessionInstanceId),
      ).length;
      input.addMessage(
        params.sessionId,
        {
          role: 'user',
          content: params.content,
          attachments: params.attachments,
        },
        params.sessionInstanceId,
      );
      input.setPendingSendSessionId(params.sessionId);
      input.addMessage(
        params.sessionId,
        {
          role: 'assistant',
          content: '',
          model: params.requestModel.name,
        },
        params.sessionInstanceId,
      );
      const optimisticMessageIds = listSessionMessageIds(
        input.getSessionById(params.sessionId, params.sessionInstanceId),
        previousMessageCount,
      );
      const assistantPlaceholderId = optimisticMessageIds.at(-1);
      let fullContent = '';

      try {
        input.abortControllerRef.current = new AbortController();
        const stream = input.sendMessageStream(
          input.getSessionById(params.sessionId, params.sessionInstanceId) ?? null,
          params.requestText,
          params.requestModel,
          params.requestSkill,
          params.requestAgent,
          input.abortControllerRef.current.signal,
          params.attachments,
        );

        for await (const chunk of stream) {
          fullContent += chunk;
          updateAssistantMessage({
            sessionId: params.sessionId,
            sessionInstanceId: params.sessionInstanceId,
            assistantMessageId: assistantPlaceholderId,
            nextContent: fullContent,
            updateOptions: { persist: false },
            getSessionById: input.getSessionById,
            updateMessage: input.updateMessage,
          });
        }
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          if (fullContent.length === 0) {
            if (assistantPlaceholderId) {
              input.removeMessages(
                params.sessionId,
                [assistantPlaceholderId],
                params.sessionInstanceId,
              );
            }
          }
        } else {
          logError('Chat error:', error);
          const failureContent = appendAssistantFailureSuffix(
            fullContent,
            resolveLocalRunErrorMessage(error),
          );
          const updatedExistingAssistant = updateAssistantMessage({
            sessionId: params.sessionId,
            sessionInstanceId: params.sessionInstanceId,
            assistantMessageId: assistantPlaceholderId,
            nextContent: failureContent,
            updateOptions: { persist: false },
            getSessionById: input.getSessionById,
            updateMessage: input.updateMessage,
          });
          if (!updatedExistingAssistant) {
            input.addMessage(
              params.sessionId,
              {
                role: 'assistant',
                content: failureContent,
                model: params.requestModel.name,
              },
              params.sessionInstanceId,
            );
          }
        }
      } finally {
        input.setPendingSendSessionId((current) => (current === params.sessionId ? null : current));
        input.abortControllerRef.current = null;
        void input.flushSession(params.sessionId, params.sessionInstanceId);
      }

      return true;
    },
    stopActiveRun() {
      if (input.sendMode !== 'local' || !input.abortControllerRef.current) {
        return false;
      }

      input.abortControllerRef.current.abort();
      return true;
    },
  };
}
