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
  dedupeChatMessagesById,
  hasRenderableChatMessagePayload,
  isOpenClawSilentReplyText,
  mergeChatMessageSequenceIntoNativeMetadata,
  normalizeUserVisibleChatSenderLabel,
  resolveChatMessagePrimaryPreviewText,
  resolveKernelChatMessageState,
  resolveLatestChatMessageForDisplay,
  resolveLatestChatMessageTimestamp,
  sanitizeChatSessionPreviewText,
} from './services/index.ts';
import type { ChatSession, Message } from './store/useChatStore';

const LOCAL_CHAT_PROJECTION_KERNEL_ID = 'studio-direct';
const LOCAL_CHAT_PROJECTION_SESSION_KIND = 'direct';
const CLAW_STUDIO_SESSION_IS_DRAFT_KEY = '__clawStudioIsDraft';
const CLAW_STUDIO_MESSAGE_TRANSPORT_TEXT_KEY = '__clawStudioTransportText';
const CLAW_STUDIO_MESSAGE_PENDING_DELIVERY_KEY = '__clawStudioPendingDelivery';

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

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readNativeMetadataString(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
) {
  return trimOptionalString(metadata?.[key] as string | null | undefined);
}

function readNativeMetadataBoolean(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
) {
  return typeof metadata?.[key] === 'boolean' ? (metadata[key] as boolean) : undefined;
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
    const kernelId =
      trimOptionalString(session.kernelSession?.ref?.kernelId) ??
      (session.transport === 'openclawGateway' ? 'openclaw' : null);
    const sanitizedPreview = sanitizeChatSessionPreviewText({
      text: preview,
      kernelId,
    });
    if (sanitizedPreview) {
      return sanitizedPreview;
    }

    if (kernelId !== 'openclaw') {
      return preview;
    }
  }

  const lastMessage = resolveLatestChatMessageForDisplay(session.messages);
  return resolveChatMessagePrimaryPreviewText(lastMessage, 120) ?? undefined;
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

function buildPersistedSessionNativeMetadata(session: ChatSession) {
  const baseMetadata = asRecord(session.kernelSession?.nativeMetadata) ?? {};
  if (typeof session.isDraft !== 'boolean') {
    return Object.keys(baseMetadata).length > 0 ? baseMetadata : null;
  }

  return {
    ...baseMetadata,
    [CLAW_STUDIO_SESSION_IS_DRAFT_KEY]: session.isDraft,
  };
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
    lifecycle:
      session.isDraft === true
        ? session.runId
          ? 'running'
          : 'draft'
        : session.runId
          ? 'running'
          : session.messages.length === 0
            ? 'draft'
            : 'ready',
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
    nativeMetadata: buildPersistedSessionNativeMetadata(session),
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
  const transportText = trimOptionalString(params.message.transportText);
  const pendingDelivery = params.message.pendingDelivery === true;
  const nativeMetadata = mergeChatMessageSequenceIntoNativeMetadata(
    params.message.kernelMessage?.nativeMetadata as Record<string, unknown> | null | undefined,
    params.message.seq,
  ) ?? {};

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
    nativeMetadata: {
      ...nativeMetadata,
      ...(transportText
        ? {
            [CLAW_STUDIO_MESSAGE_TRANSPORT_TEXT_KEY]: transportText,
          }
        : {}),
      ...(pendingDelivery
        ? {
            [CLAW_STUDIO_MESSAGE_PENDING_DELIVERY_KEY]: true,
          }
        : {}),
    },
  };
}

function sanitizePersistedOpenClawPreview(
  value: string | null | undefined,
  kernelSession: KernelChatSession | null | undefined,
) {
  const preview = trimOptionalString(value);
  if (!preview) {
    return undefined;
  }

  if (trimOptionalString(kernelSession?.ref?.kernelId) !== 'openclaw') {
    return preview;
  }

  if (isOpenClawSilentReplyText(preview)) {
    return undefined;
  }

  return sanitizeChatSessionPreviewText({
    text: preview,
    kernelId: trimOptionalString(kernelSession?.ref?.kernelId),
  });
}

export function mapStudioMessage(message: StudioConversationMessage): Message | null {
  const nativeMetadata = asRecord(message.kernelMessage?.nativeMetadata);
  const resolved = resolveKernelChatMessageState({
    id: message.id,
    role: message.role,
    content: message.content,
    timestamp: message.updatedAt ?? message.createdAt,
    senderLabel: message.kernelMessage?.senderLabel ?? null,
    model: message.model ?? null,
    attachments: cloneAttachments(message.attachments),
    kernelMessage: message.kernelMessage ?? null,
  });

  const mappedMessage: Message = {
    id: message.id,
    role: resolved.role,
    content: resolved.content,
    timestamp: resolved.timestamp,
    transportText:
      readNativeMetadataString(nativeMetadata, CLAW_STUDIO_MESSAGE_TRANSPORT_TEXT_KEY) ??
      undefined,
    ...(typeof resolved.seq === 'number' ? { seq: resolved.seq } : {}),
    senderLabel: resolved.senderLabel,
    model: trimOptionalString(resolved.model) ?? message.model,
    runId: trimOptionalString(resolved.runId) ?? undefined,
    attachments: resolved.attachments,
    reasoning: resolved.reasoning,
    toolCards: resolved.toolCards,
    pendingDelivery:
      readNativeMetadataBoolean(nativeMetadata, CLAW_STUDIO_MESSAGE_PENDING_DELIVERY_KEY) === true
        ? true
        : undefined,
    kernelMessage: message.kernelMessage ?? null,
  };

  return hasRenderableChatMessagePayload(mappedMessage) ? mappedMessage : null;
}

export function mapStudioConversation(record: StudioConversationRecord): ChatSession {
  const messages = dedupeChatMessagesById(
    record.messages
      .map(mapStudioMessage)
      .filter((message): message is Message => message !== null),
  );
  const latestVisibleMessage = resolveLatestChatMessageForDisplay(messages);
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
  const sessionNativeMetadata = asRecord(kernelSession?.nativeMetadata);
  const normalizedPrimaryInstanceId = trimOptionalString(record.primaryInstanceId);
  const instanceId =
    authorityKind === 'localProjection' &&
    isBuiltInOpenClawInstanceId(normalizedPrimaryInstanceId)
      ? undefined
      : normalizedPrimaryInstanceId ?? undefined;
  const restoredDraftState =
    readNativeMetadataBoolean(sessionNativeMetadata, CLAW_STUDIO_SESSION_IS_DRAFT_KEY) ??
    (kernelSession?.lifecycle === 'draft' ? true : undefined);

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
    isDraft: restoredDraftState,
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
    lastMessagePreview:
      latestVisibleMessage?.content ??
      sanitizePersistedOpenClawPreview(record.lastMessagePreview, kernelSession),
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
  const messages = dedupeChatMessagesById(session.messages).map((message) => ({
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
          nativeMetadata: {
            ...(mergeChatMessageSequenceIntoNativeMetadata(
              message.kernelMessage.nativeMetadata as Record<string, unknown> | null | undefined,
              message.seq,
            ) ?? {}),
            ...(trimOptionalString(message.transportText)
              ? {
                  [CLAW_STUDIO_MESSAGE_TRANSPORT_TEXT_KEY]: trimOptionalString(
                    message.transportText,
                  ),
                }
              : {}),
            ...(message.pendingDelivery === true
              ? {
                  [CLAW_STUDIO_MESSAGE_PENDING_DELIVERY_KEY]: true,
                }
              : {}),
          },
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
    lastMessagePreview: kernelSession.lastMessagePreview ?? '',
    kernelSession,
    messages,
  };
}
