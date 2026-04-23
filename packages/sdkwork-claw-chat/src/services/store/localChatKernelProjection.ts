import type {
  KernelChatAuthority,
  KernelChatMessage,
  KernelChatSession,
  KernelChatSessionRef,
  StudioConversationAttachment,
} from '@sdkwork/claw-types';
import {
  STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID,
  createKernelChatAuthority,
  createKernelChatSessionRef,
} from '@sdkwork/claw-types';
import type { OpenClawToolCard } from '../openClawMessagePresentation.ts';
import { mergeChatMessageSequenceIntoNativeMetadata } from '../chatMessageSequence.ts';
import { normalizeUserVisibleChatSenderLabel } from '../chatSenderLabelPolicy.ts';
import { resolveChatMessagePrimaryPreviewText } from '../chatMessagePreview.ts';
import { resolveLatestChatMessageForDisplay } from '../chatMessageOrdering.ts';
import { sanitizeChatSessionPreviewText } from '../chatSessionPreviewSanitizer.ts';
import {
  buildKernelChatMessageParts,
  type KernelChatProjectionNotice,
  trimOptionalString,
} from '../kernelChatProjectionParts.ts';

export const LOCAL_CHAT_PROJECTION_KERNEL_ID = 'studio-direct';
export const LOCAL_CHAT_PROJECTION_INSTANCE_ID = STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID;
export const LOCAL_CHAT_PROJECTION_SESSION_KIND = 'direct';

export interface LocalChatKernelProjectionMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  seq?: number;
  senderLabel?: string | null;
  model?: string;
  runId?: string;
  attachments?: StudioConversationAttachment[];
  reasoning?: string | null;
  toolCards?: OpenClawToolCard[];
  notices?: KernelChatProjectionNotice[];
}

export interface LocalChatKernelProjectionSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: LocalChatKernelProjectionMessage[];
  model: string;
  instanceId?: string;
  agentId?: string | null;
  agentLabel?: string | null;
  defaultModel?: string | null;
  runId?: string | null;
  thinkingLevel?: string | null;
  fastMode?: boolean | null;
  verboseLevel?: string | null;
  reasoningLevel?: string | null;
  lastMessagePreview?: string;
  sessionKind?: string | null;
  kernelSession?: {
    actorBinding?: {
      agentId?: string | null;
      profileId?: string | null;
      label?: string | null;
    } | null;
  } | null;
}

export type LocalChatProjectedMessage<T extends LocalChatKernelProjectionMessage =
  LocalChatKernelProjectionMessage> = T & {
  kernelMessage: KernelChatMessage;
};

export type LocalChatProjectedSession<T extends LocalChatKernelProjectionSession =
  LocalChatKernelProjectionSession> = Omit<T, 'messages'> & {
  messages: Array<LocalChatProjectedMessage<T['messages'][number]>>;
  kernelSession: KernelChatSession;
};

function resolveProjectedMessageStatus(input: {
  role: LocalChatKernelProjectionMessage['role'];
  messageRunId?: string | null;
  activeRunId?: string | null;
}): KernelChatMessage['status'] {
  const messageRunId = trimOptionalString(input.messageRunId);
  const activeRunId = trimOptionalString(input.activeRunId);
  if (
    (input.role === 'assistant' || input.role === 'tool') &&
    messageRunId &&
    activeRunId &&
    messageRunId === activeRunId
  ) {
    return 'streaming';
  }

  return 'complete';
}

function normalizeTimestamp(value: number | undefined) {
  return typeof value === 'number' ? value : 0;
}

function resolveLocalProjectionInstanceId(instanceId: string | undefined) {
  return trimOptionalString(instanceId) ?? LOCAL_CHAT_PROJECTION_INSTANCE_ID;
}

function resolveSessionKind(sessionKind: string | null | undefined) {
  return trimOptionalString(sessionKind) ?? LOCAL_CHAT_PROJECTION_SESSION_KIND;
}

function resolveLastMessagePreview(session: LocalChatKernelProjectionSession) {
  const previewFromSession = sanitizeChatSessionPreviewText({
    text: session.lastMessagePreview,
    kernelId: LOCAL_CHAT_PROJECTION_KERNEL_ID,
  });
  if (previewFromSession) {
    return previewFromSession;
  }

  return resolveChatMessagePrimaryPreviewText(
    resolveLatestChatMessageForDisplay(session.messages),
    120,
  );
}

function resolveActorBindingLabel(session: LocalChatKernelProjectionSession) {
  return (
    trimOptionalString(session.agentLabel) ??
    trimOptionalString(session.kernelSession?.actorBinding?.label) ??
    null
  );
}

export function buildLocalChatKernelChatAuthority(): KernelChatAuthority {
  return createKernelChatAuthority({
    kind: 'localProjection',
  });
}

export function buildLocalChatKernelChatSessionRef(input: {
  sessionId: string;
  instanceId?: string;
  agentId?: string | null;
}): KernelChatSessionRef {
  return createKernelChatSessionRef({
    kernelId: LOCAL_CHAT_PROJECTION_KERNEL_ID,
    instanceId: resolveLocalProjectionInstanceId(input.instanceId),
    sessionId: input.sessionId,
    agentId: trimOptionalString(input.agentId),
  });
}

export function buildLocalChatKernelChatSession(input: {
  session: LocalChatKernelProjectionSession;
}): KernelChatSession {
  const sessionRef = buildLocalChatKernelChatSessionRef({
    sessionId: input.session.id,
    instanceId: input.session.instanceId,
    agentId: input.session.agentId,
  });
  const agentId = trimOptionalString(input.session.agentId);
  const actorBindingLabel = resolveActorBindingLabel(input.session);

  return {
    ref: sessionRef,
    authority: buildLocalChatKernelChatAuthority(),
    lifecycle: input.session.runId ? 'running' : input.session.messages.length === 0 ? 'draft' : 'ready',
    title: input.session.title,
    createdAt: normalizeTimestamp(input.session.createdAt),
    updatedAt: normalizeTimestamp(input.session.updatedAt),
    messageCount: input.session.messages.length,
    lastMessagePreview: resolveLastMessagePreview(input.session),
    sessionKind: resolveSessionKind(input.session.sessionKind),
    actorBinding: agentId
      ? {
          agentId,
          profileId: trimOptionalString(input.session.kernelSession?.actorBinding?.profileId),
          label: actorBindingLabel,
        }
      : null,
    modelBinding: {
      model: trimOptionalString(input.session.model),
      defaultModel: trimOptionalString(input.session.defaultModel),
      thinkingLevel: trimOptionalString(input.session.thinkingLevel),
      fastMode: input.session.fastMode ?? null,
      verboseLevel: trimOptionalString(input.session.verboseLevel),
      reasoningLevel: trimOptionalString(input.session.reasoningLevel),
    },
    activeRunId: trimOptionalString(input.session.runId),
  };
}

export function buildLocalChatKernelChatMessage(input: {
  sessionRef: KernelChatSessionRef;
  message: LocalChatKernelProjectionMessage;
  activeRunId?: string | null;
}): KernelChatMessage {
  return {
    id: input.message.id,
    sessionRef: input.sessionRef,
    role: input.message.role,
    status: resolveProjectedMessageStatus({
      role: input.message.role,
      messageRunId: input.message.runId,
      activeRunId: input.activeRunId,
    }),
    createdAt: normalizeTimestamp(input.message.timestamp),
    updatedAt: normalizeTimestamp(input.message.timestamp),
    text: input.message.content,
    parts: buildKernelChatMessageParts(input.message),
    runId: trimOptionalString(input.message.runId),
    model: trimOptionalString(input.message.model),
    senderLabel: normalizeUserVisibleChatSenderLabel(input.message.senderLabel),
    nativeMetadata: mergeChatMessageSequenceIntoNativeMetadata(
      {
        upstreamMessageId: input.message.id,
      },
      input.message.seq,
    ),
  };
}

export function hydrateLocalChatKernelProjection<
  TSession extends LocalChatKernelProjectionSession,
>(input: {
  session: TSession;
}): LocalChatProjectedSession<TSession> {
  const kernelSession = buildLocalChatKernelChatSession(input);
  const messages = input.session.messages.map((message) => ({
    ...message,
    kernelMessage: buildLocalChatKernelChatMessage({
      sessionRef: kernelSession.ref,
      message,
      activeRunId: kernelSession.activeRunId,
    }),
  })) as Array<LocalChatProjectedMessage<TSession['messages'][number]>>;

  return {
    ...input.session,
    messages,
    kernelSession,
  };
}
