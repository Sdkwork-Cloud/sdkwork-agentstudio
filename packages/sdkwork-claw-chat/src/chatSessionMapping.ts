import type {
  KernelChatMessage,
  KernelChatSession,
  StudioConversationAttachment,
  StudioConversationMessage,
  StudioConversationRecord,
} from '@sdkwork/claw-types';
import {
  STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID,
  createKernelChatAuthority,
  createKernelChatSessionRef,
  isBuiltInOpenClawInstanceId,
} from '@sdkwork/claw-types';
import {
  orderChatMessagesForDisplay,
  resolveLatestChatMessageForDisplay,
  resolveLatestChatMessageTimestamp,
  mergeChatMessageSequenceIntoNativeMetadata,
  resolveChatMessageSequenceFromNativeMetadata,
  normalizeUserVisibleChatSenderLabel,
} from './services/index.ts';
import type { ChatSession, Message } from './store/useChatStore';

const LOCAL_CHAT_PROJECTION_KERNEL_ID = 'studio-direct';
const LOCAL_CHAT_PROJECTION_SESSION_KIND = 'direct';

function trimOptionalString(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return value ?? null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function normalizeOptionalTimestamp(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function cloneAttachments(
  attachments: StudioConversationAttachment[] | undefined,
) {
  return attachments?.map((attachment) => ({ ...attachment })) ?? [];
}

function cloneToolCards(toolCards: Message['toolCards']) {
  return toolCards?.map((toolCard) => ({ ...toolCard })) ?? [];
}

function normalizeMessageStatus(message: Message): StudioConversationMessage['status'] {
  return message.kernelMessage?.status ?? 'complete';
}

function normalizeStudioConversationRole(
  role: Message['role'],
): StudioConversationMessage['role'] {
  return role === 'tool' ? 'assistant' : role;
}

function resolvePersistedConversationInstanceId(session: ChatSession) {
  return (
    trimOptionalString(session.instanceId) ??
    trimOptionalString(session.kernelSession?.ref?.instanceId) ??
    STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID
  );
}

function resolveLocalSessionPreview(session: ChatSession) {
  const preview = trimOptionalString(session.lastMessagePreview);
  if (preview) {
    return preview;
  }

  const lastMessage = resolveLatestChatMessageForDisplay(session.messages);
  return trimOptionalString(lastMessage?.content.slice(0, 120));
}

function resolvePersistedSessionAgentId(session: ChatSession) {
  return (
    trimOptionalString(session.agentId) ??
    trimOptionalString(session.kernelSession?.ref?.agentId) ??
    trimOptionalString(session.kernelSession?.actorBinding?.agentId) ??
    null
  );
}

function resolvePersistedSessionAuthority(session: ChatSession) {
  if (session.instanceId && session.kernelSession?.authority) {
    return {
      ...session.kernelSession.authority,
    };
  }

  return createKernelChatAuthority({
    kind: 'localProjection',
  });
}

function resolvePersistedActorBinding(session: ChatSession, agentId: string | null) {
  if (!agentId && !session.kernelSession?.actorBinding) {
    return null;
  }

  return {
    agentId,
    profileId: trimOptionalString(session.kernelSession?.actorBinding?.profileId),
    label:
      trimOptionalString(session.agentLabel) ??
      trimOptionalString(session.kernelSession?.actorBinding?.label),
  };
}

function resolvePersistedModelBinding(session: ChatSession) {
  return {
    model: trimOptionalString(session.model) ?? trimOptionalString(session.kernelSession?.modelBinding?.model),
    defaultModel:
      trimOptionalString(session.defaultModel) ??
      trimOptionalString(session.kernelSession?.modelBinding?.defaultModel),
    thinkingLevel:
      trimOptionalString(session.thinkingLevel) ??
      trimOptionalString(session.kernelSession?.modelBinding?.thinkingLevel),
    fastMode:
      session.fastMode ??
      session.kernelSession?.modelBinding?.fastMode ??
      null,
    verboseLevel:
      trimOptionalString(session.verboseLevel) ??
      trimOptionalString(session.kernelSession?.modelBinding?.verboseLevel),
    reasoningLevel:
      trimOptionalString(session.reasoningLevel) ??
      trimOptionalString(session.kernelSession?.modelBinding?.reasoningLevel),
  };
}

function resolvePersistedSessionKind(session: ChatSession) {
  return (
    trimOptionalString(session.sessionKind) ??
    trimOptionalString(session.kernelSession?.sessionKind) ??
    LOCAL_CHAT_PROJECTION_SESSION_KIND
  );
}

function buildPersistedKernelSession(session: ChatSession): KernelChatSession {
  const agentId = resolvePersistedSessionAgentId(session);

  return {
    ref: createKernelChatSessionRef({
      kernelId: session.kernelSession?.ref?.kernelId ?? LOCAL_CHAT_PROJECTION_KERNEL_ID,
      instanceId: resolvePersistedConversationInstanceId(session),
      sessionId: session.id,
      nativeSessionId: session.kernelSession?.ref?.nativeSessionId ?? null,
      routingKey: session.kernelSession?.ref?.routingKey ?? null,
      agentId,
      lineageParentSessionId: session.kernelSession?.ref?.lineageParentSessionId ?? null,
    }),
    authority: resolvePersistedSessionAuthority(session),
    lifecycle: session.runId ? 'running' : session.messages.length === 0 ? 'draft' : 'ready',
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messageCount: session.messages.length,
    lastMessagePreview: resolveLocalSessionPreview(session),
    sessionKind: resolvePersistedSessionKind(session),
    actorBinding: resolvePersistedActorBinding(session, agentId),
    modelBinding: resolvePersistedModelBinding(session),
    capabilities: session.kernelSession?.capabilities
      ? [...session.kernelSession.capabilities]
      : undefined,
    activeRunId: trimOptionalString(session.runId),
    nativeMetadata: session.kernelSession?.nativeMetadata ?? null,
  };
}

function buildPersistedKernelMessageParts(message: Message): KernelChatMessage['parts'] {
  const parts: KernelChatMessage['parts'] = [];

  if (message.content) {
    parts.push({
      kind: 'text',
      text: message.content,
    });
  }

  const reasoning = trimOptionalString(message.reasoning);
  if (reasoning) {
    parts.push({
      kind: 'reasoning',
      text: reasoning,
    });
  }

  for (const attachment of cloneAttachments(message.attachments)) {
    parts.push({
      kind: 'attachment',
      attachment,
    });
  }

  for (const toolCard of cloneToolCards(message.toolCards)) {
    if (toolCard.kind === 'call') {
      parts.push({
        kind: 'toolCall',
        toolName: toolCard.name,
        argumentsText: trimOptionalString(
          'argumentsText' in toolCard && typeof toolCard.argumentsText === 'string'
            ? toolCard.argumentsText
            : toolCard.detail,
        ),
        detail: trimOptionalString(toolCard.detail),
      });
      continue;
    }

    parts.push({
      kind: 'toolResult',
      toolName: toolCard.name,
      text:
        'text' in toolCard && typeof toolCard.text === 'string'
          ? trimOptionalString(toolCard.text)
          : null,
      isError:
        'isError' in toolCard && typeof toolCard.isError === 'boolean'
          ? toolCard.isError
          : null,
      preview: trimOptionalString(toolCard.preview),
    });
  }

  return parts;
}

function buildPersistedKernelMessage(params: {
  sessionRef: KernelChatSession['ref'];
  activeRunId?: string | null;
  message: Message;
}): KernelChatMessage {
  const messageRunId = trimOptionalString(params.message.runId);
  const activeRunId = trimOptionalString(params.activeRunId);

  return {
    id: params.message.id,
    sessionRef: params.sessionRef,
    role: params.message.role,
    status:
      (params.message.role === 'assistant' || params.message.role === 'tool') &&
      Boolean(messageRunId) &&
      messageRunId === activeRunId
        ? 'streaming'
        : 'complete',
    createdAt: params.message.timestamp,
    updatedAt: params.message.timestamp,
    text: params.message.content,
    parts: buildPersistedKernelMessageParts(params.message),
    runId: messageRunId,
    model: trimOptionalString(params.message.model),
    senderLabel: normalizeUserVisibleChatSenderLabel(params.message.senderLabel),
    nativeMetadata: mergeChatMessageSequenceIntoNativeMetadata(
      params.message.kernelMessage?.nativeMetadata as Record<string, unknown> | null | undefined,
      params.message.seq,
    ),
  };
}

function extractKernelMessageText(message: StudioConversationMessage) {
  const textPart = message.kernelMessage?.parts.find(
    (part: KernelChatMessage['parts'][number]) => part.kind === 'text',
  );
  if (textPart?.kind === 'text') {
    return textPart.text;
  }

  return message.kernelMessage?.text ?? message.content;
}

function extractKernelMessageReasoning(message: StudioConversationMessage) {
  const reasoningPart = message.kernelMessage?.parts.find(
    (part: KernelChatMessage['parts'][number]) => part.kind === 'reasoning',
  );
  return reasoningPart?.kind === 'reasoning' ? reasoningPart.text : null;
}

function extractKernelMessageAttachments(message: StudioConversationMessage) {
  if (!message.kernelMessage) {
    return cloneAttachments(message.attachments);
  }

  return message.kernelMessage.parts.flatMap((part: KernelChatMessage['parts'][number]) =>
    part.kind === 'attachment' ? [{ ...part.attachment }] : [],
  );
}

function extractKernelMessageToolCards(message: StudioConversationMessage): Message['toolCards'] {
  if (!message.kernelMessage) {
    return [];
  }

  const toolCards: NonNullable<Message['toolCards']> = [];
  for (const part of message.kernelMessage.parts) {
    if (part.kind === 'toolCall') {
      toolCards.push({
        kind: 'call',
        name: part.toolName,
        argumentsText: part.argumentsText ?? undefined,
        detail: part.detail ?? part.argumentsText ?? undefined,
      });
      continue;
    }

    if (part.kind === 'toolResult') {
      toolCards.push({
        kind: 'result',
        name: part.toolName,
        text: part.text ?? undefined,
        isError: part.isError ?? undefined,
        preview: part.preview ?? undefined,
      });
    }
  }

  return toolCards;
}

export function mapStudioMessage(message: StudioConversationMessage): Message {
  const seq = resolveChatMessageSequenceFromNativeMetadata(
    message.kernelMessage?.nativeMetadata as Record<string, unknown> | null | undefined,
  );

  return {
    id: message.id,
    role: (message.kernelMessage?.role ?? message.role) as Message['role'],
    content: extractKernelMessageText(message),
    timestamp: message.kernelMessage?.updatedAt ?? message.updatedAt ?? message.createdAt,
    ...(typeof seq === 'number' ? { seq } : {}),
    senderLabel: normalizeUserVisibleChatSenderLabel(message.kernelMessage?.senderLabel),
    model: trimOptionalString(message.kernelMessage?.model) ?? message.model,
    runId: trimOptionalString(message.kernelMessage?.runId) ?? undefined,
    attachments: extractKernelMessageAttachments(message),
    reasoning: extractKernelMessageReasoning(message),
    toolCards: extractKernelMessageToolCards(message),
    kernelMessage: message.kernelMessage ?? null,
  };
}

export function mapStudioConversation(record: StudioConversationRecord): ChatSession {
  const messages = orderChatMessagesForDisplay(record.messages.map(mapStudioMessage));
  const latestMessageTimestamp = resolveLatestChatMessageTimestamp(messages);
  const normalizedUpdatedAt = Math.max(
    record.createdAt,
    record.updatedAt,
    record.kernelSession?.updatedAt ?? Number.NEGATIVE_INFINITY,
    latestMessageTimestamp ?? Number.NEGATIVE_INFINITY,
  );
  const kernelSession =
    record.kernelSession
      ? {
          ...record.kernelSession,
          updatedAt: normalizedUpdatedAt,
        }
      : null;
  const modelBinding = kernelSession?.modelBinding ?? null;
  const authorityKind = kernelSession?.authority.kind ?? 'localProjection';
  const normalizedPrimaryInstanceId = trimOptionalString(record.primaryInstanceId);
  const instanceId =
    authorityKind === 'localProjection' &&
    isBuiltInOpenClawInstanceId(normalizedPrimaryInstanceId)
      ? undefined
      : normalizedPrimaryInstanceId ?? undefined;

  return {
    id: record.id,
    title: record.title,
    createdAt: record.createdAt,
    updatedAt: normalizedUpdatedAt,
    lastSeenAt: normalizeOptionalTimestamp(record.lastSeenAt),
    messages,
    model:
      trimOptionalString(modelBinding?.model) ??
      trimOptionalString(modelBinding?.defaultModel) ??
      trimOptionalString(messages.find((message) => message.model)?.model) ??
      'unknown',
    defaultModel: trimOptionalString(modelBinding?.defaultModel),
    instanceId,
    transport:
      authorityKind === 'gateway'
        ? 'openclawGateway'
        : !instanceId
          ? 'local'
          : authorityKind !== 'localProjection'
            ? 'kernelAdapter'
            : 'local',
    sessionKind: record.kernelSession?.sessionKind ?? LOCAL_CHAT_PROJECTION_SESSION_KIND,
    agentId:
      trimOptionalString(record.kernelSession?.ref?.agentId) ??
      trimOptionalString(record.kernelSession?.actorBinding?.agentId) ??
      null,
    agentLabel: trimOptionalString(record.kernelSession?.actorBinding?.label),
    runId: trimOptionalString(record.kernelSession?.activeRunId),
    thinkingLevel: trimOptionalString(modelBinding?.thinkingLevel),
    fastMode: modelBinding?.fastMode ?? null,
    verboseLevel: trimOptionalString(modelBinding?.verboseLevel),
    reasoningLevel: trimOptionalString(modelBinding?.reasoningLevel),
    lastMessagePreview: record.lastMessagePreview,
    kernelSession,
  };
}

function isStudioConversationPersistableSession(session: ChatSession) {
  const authority = session.kernelSession?.authority ?? null;
  const authorityKind = authority?.kind ?? 'localProjection';
  if (!session.instanceId) {
    return authorityKind === 'localProjection';
  }

  return authority !== null && (authority.kind === 'gateway' || authority.durable === false);
}

export function mapChatSession(session: ChatSession): StudioConversationRecord {
  if (!isStudioConversationPersistableSession(session)) {
    throw new Error(
      'Durable kernel chat sessions must not be persisted through the studio conversation store.',
    );
  }

  const kernelSession = buildPersistedKernelSession(session);
  const messages = session.messages.map((message) => ({
    id: message.id,
    conversationId: session.id,
    role: normalizeStudioConversationRole(message.role),
    content: message.content,
    createdAt: message.timestamp,
    updatedAt: message.timestamp,
    model: message.model,
    senderInstanceId: null,
    status: normalizeMessageStatus(message),
    attachments: cloneAttachments(message.attachments),
    kernelMessage: message.kernelMessage
      ? {
          ...message.kernelMessage,
          nativeMetadata: mergeChatMessageSequenceIntoNativeMetadata(
            message.kernelMessage.nativeMetadata as Record<string, unknown> | null | undefined,
            message.seq,
          ),
        }
      : buildPersistedKernelMessage({
          sessionRef: kernelSession.ref,
          activeRunId: kernelSession.activeRunId,
          message,
        }),
  }));

  return {
    id: session.id,
    title: session.title,
    primaryInstanceId: resolvePersistedConversationInstanceId(session),
    participantInstanceIds: [resolvePersistedConversationInstanceId(session)],
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    lastSeenAt: normalizeOptionalTimestamp(session.lastSeenAt),
    messageCount: messages.length,
    lastMessagePreview:
      resolveLatestChatMessageForDisplay(messages)?.content.slice(0, 120) || '',
    kernelSession,
    messages,
  };
}
