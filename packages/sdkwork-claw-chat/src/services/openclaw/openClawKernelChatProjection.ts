import type {
  KernelChatAuthority,
  KernelChatMessage,
  KernelChatSession,
  KernelChatSessionRef,
  StudioConversationAttachment,
} from '@sdkwork/claw-types';
import {
  createKernelChatAuthority,
  createKernelChatSessionRef,
} from '@sdkwork/claw-types';
import type { OpenClawToolCard } from '../openClawMessagePresentation.ts';
import { normalizeUserVisibleChatSenderLabel } from '../chatSenderLabelPolicy.ts';
import {
  buildKernelChatMessageParts,
  trimOptionalString,
} from '../kernelChatProjectionParts.ts';

export interface OpenClawKernelChatProjectionMessage {
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
}

export interface OpenClawKernelChatProjectionSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: OpenClawKernelChatProjectionMessage[];
  model: string;
  defaultModel?: string | null;
  runId?: string | null;
  thinkingLevel?: string | null;
  fastMode?: boolean | null;
  verboseLevel?: string | null;
  reasoningLevel?: string | null;
  lastMessagePreview?: string;
  sessionKind?: string | null;
}

export type OpenClawKernelChatProjectedMessage<T extends OpenClawKernelChatProjectionMessage =
  OpenClawKernelChatProjectionMessage> = T & {
  kernelMessage: KernelChatMessage;
};

export type OpenClawKernelChatProjectedSession<T extends OpenClawKernelChatProjectionSession =
  OpenClawKernelChatProjectionSession> = Omit<T, 'messages'> & {
  messages: Array<OpenClawKernelChatProjectedMessage<T['messages'][number]>>;
  kernelSession: KernelChatSession;
};

function resolveProjectedMessageStatus(input: {
  role: OpenClawKernelChatProjectionMessage['role'];
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

export function parseOpenClawAgentSessionRoutingKey(routingKey: string): {
  agentId: string | null;
  logicalKey: string;
  routingKey: string;
} {
  const normalizedRoutingKey = routingKey.trim();
  const match = /^agent:([^:]+):(.+)$/.exec(normalizedRoutingKey);
  if (!match) {
    return {
      agentId: null,
      logicalKey: normalizedRoutingKey,
      routingKey: normalizedRoutingKey,
    };
  }

  return {
    agentId: match[1]?.trim() || null,
    logicalKey: match[2]?.trim() || normalizedRoutingKey,
    routingKey: normalizedRoutingKey,
  };
}

export function buildOpenClawKernelChatAuthority(): KernelChatAuthority {
  return createKernelChatAuthority({
    kind: 'gateway',
  });
}

export function buildOpenClawKernelChatSessionRef(input: {
  instanceId: string;
  sessionId: string;
  nativeSessionId?: string | null;
}): KernelChatSessionRef {
  const routing = parseOpenClawAgentSessionRoutingKey(input.sessionId);
  return createKernelChatSessionRef({
    kernelId: 'openclaw',
    instanceId: input.instanceId,
    sessionId: input.sessionId,
    nativeSessionId: trimOptionalString(input.nativeSessionId),
    routingKey: routing.routingKey,
    agentId: routing.agentId,
  });
}

export function buildOpenClawKernelChatSession(input: {
  instanceId: string;
  session: OpenClawKernelChatProjectionSession;
}): KernelChatSession {
  const sessionRef = buildOpenClawKernelChatSessionRef({
    instanceId: input.instanceId,
    sessionId: input.session.id,
  });
  const routing = parseOpenClawAgentSessionRoutingKey(input.session.id);
  return {
    ref: sessionRef,
    authority: buildOpenClawKernelChatAuthority(),
    lifecycle: input.session.runId ? 'running' : input.session.messages.length === 0 ? 'draft' : 'ready',
    title: input.session.title,
    createdAt: input.session.createdAt,
    updatedAt: input.session.updatedAt,
    messageCount: input.session.messages.length,
    lastMessagePreview: trimOptionalString(input.session.lastMessagePreview),
    sessionKind: trimOptionalString(input.session.sessionKind),
    actorBinding: sessionRef.agentId
      ? {
          agentId: sessionRef.agentId,
          profileId: sessionRef.agentId,
          label: sessionRef.agentId,
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
    nativeMetadata: {
      upstreamSessionId: input.session.id,
      routingKey: routing.routingKey,
      logicalSessionId: routing.logicalKey,
      agentId: routing.agentId,
    },
  };
}

export function buildOpenClawKernelChatMessage(input: {
  sessionRef: KernelChatSessionRef;
  message: OpenClawKernelChatProjectionMessage;
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
    createdAt: input.message.timestamp,
    updatedAt: input.message.timestamp,
    text: input.message.content,
    parts: buildKernelChatMessageParts(input.message),
    runId: trimOptionalString(input.message.runId),
    model: trimOptionalString(input.message.model),
    senderLabel: normalizeUserVisibleChatSenderLabel(input.message.senderLabel),
    nativeMetadata: {
      upstreamMessageId: input.message.id,
      routingKey: input.sessionRef.routingKey ?? null,
      agentId: input.sessionRef.agentId ?? null,
      ...(typeof input.message.seq === 'number' ? { seq: input.message.seq } : {}),
    },
  };
}

export function hydrateOpenClawKernelChatProjection<TSession extends OpenClawKernelChatProjectionSession>(input: {
  instanceId: string;
  session: TSession;
}): OpenClawKernelChatProjectedSession<TSession> {
  const kernelSession = buildOpenClawKernelChatSession(input);
  const messages = input.session.messages.map((message) => ({
    ...message,
    kernelMessage: buildOpenClawKernelChatMessage({
      sessionRef: kernelSession.ref,
      message,
      activeRunId: kernelSession.activeRunId,
    }),
  })) as Array<OpenClawKernelChatProjectedMessage<TSession['messages'][number]>>;

  return {
    ...input.session,
    messages,
    kernelSession,
  };
}
