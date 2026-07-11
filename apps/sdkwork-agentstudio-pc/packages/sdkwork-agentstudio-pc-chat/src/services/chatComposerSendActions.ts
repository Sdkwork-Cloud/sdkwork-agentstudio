import type { Agent, Skill } from '@sdkwork/agentstudio-pc-types';
import { composeOutgoingChatText } from './chatComposerAttachments.ts';
import { resolveChatAgentDisplayIdentity } from './chatSessionOwnerPresentation.ts';
import type { ChatLocalRunActions } from './chatLocalRunActions.ts';
import type { ChatSessionRunActions } from './chatSessionRunActions.ts';
import type { ChatComposerSubmitPayload, ChatModel } from '../types/index.ts';

export interface CreateChatComposerSendActionsInput {
  activeInstanceId: string | null | undefined;
  selectedSessionId: string | null;
  sendMode: 'local' | 'gateway';
  hasActiveChannel: boolean;
  isChatSupportedRoute: boolean;
  isBusy: boolean;
  hasPendingInstanceRoute: boolean;
  activeModel: ChatModel | null;
  activeSkill: Skill | null;
  activeAgent: Agent | null;
  sessionScopeMode: 'all' | 'agentBound';
  sessionScopeAgentId?: string | null;
  newSessionModel?: string;
  inFlightSubmitRef?: {
    current: Promise<boolean> | null;
  };
  createSession: (
    model?: string,
    instanceId?: string,
    options?: {
      agentId?: string | null;
      agentLabel?: string | null;
      sessionId?: string | null;
    },
  ) => Promise<string>;
  sessionRunActions: Pick<
    ChatSessionRunActions,
    'getKernelDraftSessionOptions' | 'sendKernelRun'
  >;
  directRunActions: Pick<ChatLocalRunActions, 'sendLocalRun'>;
}

export interface ChatComposerSendActions {
  submit: (payload: ChatComposerSubmitPayload) => Promise<boolean>;
}

function trimOptionalString(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return value ?? null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function buildChatSessionCreateOptions(input: {
  agentId?: string | null;
  agentLabel?: string | null;
  sessionId?: string | null;
}) {
  const agentId = trimOptionalString(input.agentId);
  const agentLabel = trimOptionalString(input.agentLabel);
  const sessionId = trimOptionalString(input.sessionId);

  const options = {
    ...(agentId ? { agentId } : {}),
    ...(agentLabel ? { agentLabel } : {}),
    ...(sessionId ? { sessionId } : {}),
  };

  return Object.keys(options).length > 0 ? options : undefined;
}

function resolveActiveAgentDisplayName(agent: Agent | null) {
  if (!agent) {
    return null;
  }

  const agentWithKernel = agent as Agent & { kernelLabel?: string | null };
  return resolveChatAgentDisplayIdentity({
    agentId: agent.id,
    agentLabel: agent.name,
    avatarLabel: agent.avatar,
    kernelLabel: agentWithKernel.kernelLabel,
  }).name;
}

function resolveRequestAgent(agent: Agent | null) {
  const displayName = resolveActiveAgentDisplayName(agent);
  if (!agent || !displayName) {
    return agent ?? undefined;
  }

  return {
    ...agent,
    name: displayName,
  };
}

export function createChatComposerSendActions(
  input: CreateChatComposerSendActionsInput,
): ChatComposerSendActions {
  let fallbackPendingSubmit: Promise<boolean> | null = null;
  const pendingSubmitRef = input.inFlightSubmitRef ?? {
    get current() {
      return fallbackPendingSubmit;
    },
    set current(value: Promise<boolean> | null) {
      fallbackPendingSubmit = value;
    },
  };

  return {
    async submit(payload) {
      if (pendingSubmitRef.current) {
        return false;
      }

      const content = payload.text.trim();
      const normalizedAttachments = payload.attachments.map((attachment) => ({ ...attachment }));
      const requestText = composeOutgoingChatText(content, normalizedAttachments);

      if (
        !input.activeModel ||
        !input.hasActiveChannel ||
        !input.isChatSupportedRoute ||
        input.isBusy ||
        input.hasPendingInstanceRoute
      ) {
        return false;
      }

      if (!content && normalizedAttachments.length === 0) {
        return false;
      }

      const activeModel = input.activeModel;
      const submitTask = (async () => {
        let sessionId = input.selectedSessionId;
        if (!sessionId) {
          const draftAgentId =
            input.activeAgent?.id ?? input.sessionScopeAgentId ?? null;
          const draftAgentLabel = resolveActiveAgentDisplayName(input.activeAgent);
          if (input.sendMode === 'gateway' && input.activeInstanceId) {
            const draftSessionOptions = input.sessionRunActions.getKernelDraftSessionOptions({
              sessionScopeMode: input.sessionScopeMode,
              agentId: draftAgentId,
            });
            sessionId = await input.createSession(
              input.newSessionModel,
              input.activeInstanceId,
              buildChatSessionCreateOptions({
                agentId: draftAgentId,
                agentLabel: draftAgentLabel,
                ...draftSessionOptions,
              }),
            );
          } else {
            sessionId = await input.createSession(
              activeModel.name,
              input.activeInstanceId ?? undefined,
              buildChatSessionCreateOptions({
                agentId: draftAgentId,
                agentLabel: draftAgentLabel,
              }),
            );
          }
        }

        if (!sessionId) {
          return false;
        }

        if (await input.sessionRunActions.sendKernelRun({
          sessionId,
          content,
          model: activeModel.id,
          attachments: normalizedAttachments,
          requestText,
        })) {
          return true;
        }

        return input.directRunActions.sendLocalRun({
          sessionId,
          sessionInstanceId: input.activeInstanceId ?? null,
          content,
          attachments: normalizedAttachments,
          requestText,
          requestModel: activeModel,
          requestSkill: input.activeSkill ?? undefined,
          requestAgent: resolveRequestAgent(input.activeAgent),
        });
      })();

      pendingSubmitRef.current = submitTask;
      try {
        return await submitTask;
      } finally {
        if (pendingSubmitRef.current === submitTask) {
          pendingSubmitRef.current = null;
        }
      }
    },
  };
}
