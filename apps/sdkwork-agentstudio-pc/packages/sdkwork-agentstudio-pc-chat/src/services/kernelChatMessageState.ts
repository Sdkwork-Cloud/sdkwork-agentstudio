import type { KernelChatMessage, StudioConversationAttachment } from '@sdkwork/agentstudio-pc-types';
import {
  isOpenClawSilentReplyText,
  resolveOpenClawMessagePresentation,
  type OpenClawToolCard,
} from './openClawMessagePresentation.ts';
import {
  detectChatOperationalEvent,
  type ChatOperationalEventPresentation,
  sanitizeChatOperationalMessageText,
  shouldPromoteChatOperationalMessageToSystem,
} from './chatMessageStructuredContent.ts';
import { resolveChatMessageBinding } from './chatMessageBinding.ts';
import { normalizeUserVisibleChatSenderLabel } from './chatSenderLabelPolicy.ts';
import {
  resolveChatMessageSequence,
  resolveChatMessageSequenceFromNativeMetadata,
} from './chatMessageSequence.ts';
import { presentKernelChatMessageParts } from './kernelChatMessagePartsPresentation.ts';
import type { KernelChatNoticePresentation } from './kernelChatMessagePartsPresentation.ts';
import { normalizeChatMessageTextEncoding } from './chatTextEncoding.ts';

type KernelChatMessageStateSource = {
  id?: string;
  role?: string | null;
  content?: string;
  timestamp?: number;
  seq?: number;
  senderLabel?: string | null;
  model?: string | null;
  runId?: string | null;
  attachments?: StudioConversationAttachment[];
  reasoning?: string | null;
  toolCards?: OpenClawToolCard[];
  nativeMetadata?: Record<string, unknown> | null;
  kernelMessage?: KernelChatMessage | null;
};

export type KernelChatMessageState = {
  id?: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  status: 'complete' | 'streaming' | 'error';
  content: string;
  operationalEvent?: ChatOperationalEventPresentation;
  timestamp: number;
  seq?: number;
  senderLabel: string | null;
  model?: string;
  runId?: string;
  kernelId?: string;
  instanceId?: string;
  sessionId?: string;
  nativeSessionId?: string;
  routingKey?: string;
  agentId?: string;
  lineageParentSessionId?: string;
  nativeMetadata: Record<string, unknown> | null;
  attachments: StudioConversationAttachment[];
  reasoning: string | null;
  toolCards: OpenClawToolCard[];
  notices: KernelChatNoticePresentation[];
};

function trimNullableString(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return value ?? null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function normalizeRole(value: string | null | undefined): KernelChatMessageState['role'] {
  const normalized = trimNullableString(value);
  switch (normalized) {
    case 'user':
    case 'assistant':
    case 'system':
    case 'tool':
      return normalized;
    case 'runtime':
      return 'system';
    default:
      return 'assistant';
  }
}

function normalizeStatus(
  value: string | null | undefined,
): KernelChatMessageState['status'] {
  switch (trimNullableString(value)) {
    case 'streaming':
      return 'streaming';
    case 'error':
      return 'error';
    default:
      return 'complete';
  }
}

function cloneAttachments(attachments: StudioConversationAttachment[] | undefined) {
  return attachments?.map((attachment) => ({ ...attachment })) ?? [];
}

function cloneToolCards(toolCards: OpenClawToolCard[] | undefined) {
  return toolCards?.map((toolCard) => ({ ...toolCard })) ?? [];
}

function cloneNativeMetadata(value: Record<string, unknown> | null | undefined) {
  return value ? { ...value } : null;
}

function resolveOpenClawKernelMessagePresentation(params: {
  kernelMessage: KernelChatMessage;
  fallbackReasoning: string | null;
  fallbackToolCards: OpenClawToolCard[];
}) {
  const nativeMetadata = cloneNativeMetadata(
    params.kernelMessage.nativeMetadata as Record<string, unknown> | null | undefined,
  );
  const presentation = resolveOpenClawMessagePresentation({
    role: params.kernelMessage.role,
    text: params.kernelMessage.text,
    ...(params.kernelMessage.senderLabel
      ? { senderLabel: params.kernelMessage.senderLabel }
      : {}),
    ...(params.kernelMessage.model ? { model: params.kernelMessage.model } : {}),
    ...(params.kernelMessage.runId ? { runId: params.kernelMessage.runId } : {}),
    ...(nativeMetadata ? { __openclaw: nativeMetadata } : {}),
  });

  return {
    role: normalizeRole(presentation.role),
    content:
      presentation.role === 'assistant' && isOpenClawSilentReplyText(presentation.text)
        ? ''
        : presentation.text,
    senderLabel:
      normalizeUserVisibleChatSenderLabel(
        presentation.senderLabel ?? params.kernelMessage.senderLabel,
      ),
    reasoning: presentation.reasoning ?? params.fallbackReasoning,
    toolCards:
      params.fallbackToolCards.length > 0
        ? params.fallbackToolCards
        : cloneToolCards(presentation.toolCards),
  };
}

function resolveKernelMessageContent(params: {
  legacyContent?: string;
  kernelMessage: KernelChatMessage | null;
  partsContent?: string | null;
  openClawContent?: string | null;
}) {
  if (!params.kernelMessage) {
    return params.legacyContent ?? '';
  }

  const normalizedPartsContent = trimNullableString(params.partsContent);
  const normalizedKernelText = trimNullableString(params.kernelMessage.text);
  if (typeof params.openClawContent === 'string') {
    const normalizedOpenClawContent = trimNullableString(params.openClawContent);
    if (normalizedOpenClawContent) {
      return params.openClawContent;
    }

    // Preserve intentional OpenClaw suppression when raw text exists, but
    // reconstruct visible content from structured parts when the transport text
    // is absent and parts carry the canonical display text.
    if (!normalizedKernelText) {
      return normalizedPartsContent ?? '';
    }

    return params.openClawContent;
  }

  return normalizedPartsContent ?? params.kernelMessage.text;
}

function shouldPromoteKernelMessageToSystem(params: {
  resolvedRole: KernelChatMessageState['role'];
  legacyContent?: string;
  kernelMessage: KernelChatMessage | null;
  partsContent?: string | null;
  openClawContent?: string | null;
}) {
  if (params.resolvedRole === 'system' || params.resolvedRole === 'tool') {
    return params.resolvedRole === 'system';
  }

  return [
    params.kernelMessage?.text,
    params.partsContent,
    params.openClawContent,
    params.legacyContent,
  ].some(
    (value) =>
      typeof value === 'string' && shouldPromoteChatOperationalMessageToSystem(value),
  );
}

function resolveKernelOperationalEvent(params: {
  legacyContent?: string;
  kernelMessage: KernelChatMessage | null;
  partsContent?: string | null;
}) {
  const candidates = [
    params.kernelMessage?.text,
    params.partsContent,
    params.legacyContent,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || !candidate.trim()) {
      continue;
    }

    const event = detectChatOperationalEvent(candidate);
    if (event) {
      return event;
    }
  }

  return null;
}

export function resolveKernelChatMessageState(
  message: KernelChatMessageStateSource | null | undefined,
): KernelChatMessageState {
  const kernelMessage = message?.kernelMessage ?? null;
  const messageBinding = resolveChatMessageBinding(message);
  const partsPresentation = kernelMessage
    ? presentKernelChatMessageParts(kernelMessage)
    : null;
  const defaultReasoning = kernelMessage
    ? partsPresentation?.reasoning ?? null
    : trimNullableString(message?.reasoning);
  const defaultToolCards = kernelMessage
    ? partsPresentation?.toolCards ?? []
    : cloneToolCards(message?.toolCards);
  const openClawPresentation =
    kernelMessage && messageBinding.kernelId === 'openclaw'
      ? resolveOpenClawKernelMessagePresentation({
          kernelMessage,
          fallbackReasoning: defaultReasoning,
          fallbackToolCards: defaultToolCards,
        })
      : null;
  const kernelTimestamp =
    typeof kernelMessage?.updatedAt === 'number'
      ? kernelMessage.updatedAt
      : typeof kernelMessage?.createdAt === 'number'
      ? kernelMessage.createdAt
      : null;
  const resolvedSequence =
    resolveChatMessageSequenceFromNativeMetadata(
      kernelMessage?.nativeMetadata as Record<string, unknown> | null | undefined,
    ) ??
    resolveChatMessageSequence({
      seq: message?.seq,
      nativeMetadata: message?.nativeMetadata,
    });
  const resolvedContent = normalizeChatMessageTextEncoding(
    resolveKernelMessageContent({
      legacyContent: message?.content,
      kernelMessage,
      partsContent: partsPresentation?.content,
      openClawContent: openClawPresentation?.content,
    }),
  );
  const resolvedRole =
    openClawPresentation?.role ??
    normalizeRole(kernelMessage?.role ?? message?.role);
  const shouldPromoteOperationalRole = shouldPromoteKernelMessageToSystem({
    resolvedRole,
    legacyContent: message?.content,
    kernelMessage,
    partsContent: partsPresentation?.content,
    openClawContent: openClawPresentation?.content,
  });
  const operationalEvent = shouldPromoteOperationalRole
    ? resolveKernelOperationalEvent({
        legacyContent: message?.content,
        kernelMessage,
        partsContent: partsPresentation?.content,
      })
    : null;

  return {
    id: messageBinding.id ?? undefined,
    role: shouldPromoteOperationalRole ? 'system' : resolvedRole,
    status: normalizeStatus(kernelMessage?.status),
    content:
      shouldPromoteOperationalRole && !openClawPresentation
        ? sanitizeChatOperationalMessageText(resolvedContent)
        : resolvedContent,
    ...(operationalEvent ? { operationalEvent } : {}),
    timestamp:
      kernelTimestamp ??
      (typeof message?.timestamp === 'number' ? message.timestamp : 0),
    ...(typeof resolvedSequence === 'number' ? { seq: resolvedSequence } : {}),
    senderLabel: openClawPresentation?.senderLabel ?? messageBinding.senderLabel,
    model: messageBinding.model ?? undefined,
    runId: messageBinding.runId ?? undefined,
    kernelId: messageBinding.kernelId ?? undefined,
    instanceId: messageBinding.instanceId ?? undefined,
    sessionId: messageBinding.sessionId ?? undefined,
    nativeSessionId: messageBinding.nativeSessionId ?? undefined,
    routingKey: messageBinding.routingKey ?? undefined,
    agentId: messageBinding.agentId ?? undefined,
    lineageParentSessionId: messageBinding.lineageParentSessionId ?? undefined,
    nativeMetadata: cloneNativeMetadata(messageBinding.nativeMetadata),
    attachments: kernelMessage
      ? partsPresentation?.attachments ?? []
      : cloneAttachments(message?.attachments),
    reasoning: openClawPresentation?.reasoning ?? defaultReasoning,
    toolCards: openClawPresentation?.toolCards ?? defaultToolCards,
    notices: kernelMessage
      ? partsPresentation?.notices ?? []
      : [],
  };
}
