import type { KernelChatAuthorityKind } from '@sdkwork/clawstudio-types';
import { isOpenClawMainSession } from './chatSessionBootstrap.ts';
import { resolveKernelChatSessionState } from './kernelChatSessionState.ts';

export type ChatSessionBindingSource = {
  id?: string | null;
  instanceId?: string | null;
  agentId?: string | null;
  agentLabel?: string | null;
  sessionKind?: string | null;
  kernelSession?: {
    ref?: {
      kernelId?: string | null;
      instanceId?: string | null;
      sessionId?: string | null;
      nativeSessionId?: string | null;
      routingKey?: string | null;
      agentId?: string | null;
      lineageParentSessionId?: string | null;
    } | null;
    actorBinding?: {
      agentId?: string | null;
      label?: string | null;
    } | null;
    authority?: {
      kind?: string | null;
    } | null;
    sessionKind?: string | null;
  } | null;
};

export interface ChatSessionBinding {
  scopeInstanceId: string | null;
  sessionId: string | null;
  kernelId: string | null;
  kernelInstanceId: string | null;
  nativeSessionId: string | null;
  routingKey: string | null;
  agentId: string | null;
  lineageParentSessionId: string | null;
  authorityKind: KernelChatAuthorityKind | null;
  sessionKind: string | null;
  isKernelAuthoritative: boolean;
  isMainAgentSession: boolean;
}

export type ChatSessionSelectionBinding = Pick<ChatSessionBinding, 'sessionId' | 'agentId'>;

function normalizeOptionalString(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return value ?? null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function resolveOpenClawSessionAgentId(sessionId: string | null | undefined) {
  const normalizedSessionId = normalizeOptionalString(sessionId);
  if (!normalizedSessionId || !normalizedSessionId.startsWith('agent:')) {
    return null;
  }

  const parts = normalizedSessionId.split(':').filter(Boolean);
  return parts[1] ?? null;
}

export function resolveChatSessionBinding(
  session: ChatSessionBindingSource | null | undefined,
): ChatSessionBinding {
  const kernelState = resolveKernelChatSessionState(session);
  const sessionId =
    normalizeOptionalString(session?.id) ?? kernelState.sessionId ?? null;
  const agentId =
    normalizeOptionalString(session?.agentId) ??
    kernelState.agentId ??
    resolveOpenClawSessionAgentId(sessionId) ??
    null;
  const authorityKind = kernelState.authorityKind;

  return {
    scopeInstanceId: normalizeOptionalString(session?.instanceId),
    sessionId,
    kernelId: kernelState.kernelId,
    kernelInstanceId: kernelState.instanceId,
    nativeSessionId: kernelState.nativeSessionId,
    routingKey: kernelState.routingKey,
    agentId,
    lineageParentSessionId: kernelState.lineageParentSessionId,
    authorityKind,
    sessionKind: kernelState.sessionKind ?? normalizeOptionalString(session?.sessionKind),
    isKernelAuthoritative:
      authorityKind !== null && authorityKind !== 'localProjection',
    isMainAgentSession: Boolean(
      sessionId && isOpenClawMainSession(sessionId, agentId),
    ),
  };
}

export function resolveKernelOwnedSessionId(
  session: ChatSessionBindingSource | null | undefined,
) {
  const binding = resolveChatSessionBinding(session);
  return binding.nativeSessionId ?? binding.sessionId;
}
