import type { KernelChatMessage, StudioConversationAttachment } from '@sdkwork/claw-types';
import type { OpenClawToolCard } from './openClawMessagePresentation.ts';
import { resolveChatMessageBinding } from './chatMessageBinding.ts';
import {
  resolveChatMessageSequence,
  resolveChatMessageSequenceFromNativeMetadata,
} from './chatMessageSequence.ts';
import { presentKernelChatMessageParts } from './kernelChatMessagePartsPresentation.ts';
import type { KernelChatNoticePresentation } from './kernelChatMessagePartsPresentation.ts';

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

export function resolveKernelChatMessageState(
  message: KernelChatMessageStateSource | null | undefined,
): KernelChatMessageState {
  const kernelMessage = message?.kernelMessage ?? null;
  const messageBinding = resolveChatMessageBinding(message);
  const partsPresentation = kernelMessage
    ? presentKernelChatMessageParts(kernelMessage)
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

  return {
    id: messageBinding.id ?? undefined,
    role: normalizeRole(kernelMessage?.role ?? message?.role),
    status: normalizeStatus(kernelMessage?.status),
    content: kernelMessage
      ? partsPresentation?.content ?? kernelMessage.text
      : message?.content ?? '',
    timestamp:
      kernelTimestamp ??
      (typeof message?.timestamp === 'number' ? message.timestamp : 0),
    ...(typeof resolvedSequence === 'number' ? { seq: resolvedSequence } : {}),
    senderLabel:
      messageBinding.senderLabel,
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
    reasoning: kernelMessage
      ? partsPresentation?.reasoning ?? null
      : trimNullableString(message?.reasoning),
    toolCards: kernelMessage
      ? partsPresentation?.toolCards ?? []
      : cloneToolCards(message?.toolCards),
    notices: kernelMessage
      ? partsPresentation?.notices ?? []
      : [],
  };
}
