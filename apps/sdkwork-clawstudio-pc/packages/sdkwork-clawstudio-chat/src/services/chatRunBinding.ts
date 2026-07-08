import type { KernelChatAuthorityKind } from '@sdkwork/clawstudio-types';
import {
  resolveChatSessionBinding,
  resolveKernelOwnedSessionId,
} from './chatSessionBinding.ts';
import { resolveKernelChatSessionState } from './kernelChatSessionState.ts';

export type ChatRunBindingSource = {
  id?: string | null;
  instanceId?: string | null;
  runId?: string | null;
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
    authority?: {
      kind?: string | null;
    } | null;
    lifecycle?: string | null;
    activeRunId?: string | null;
  } | null;
};

export interface ChatRunBinding {
  scopeInstanceId: string | null;
  sessionId: string | null;
  kernelOwnedSessionId: string | null;
  kernelId: string | null;
  kernelInstanceId: string | null;
  nativeSessionId: string | null;
  routingKey: string | null;
  agentId: string | null;
  lineageParentSessionId: string | null;
  authorityKind: KernelChatAuthorityKind | null;
  lifecycle: string | null;
  runId: string | null;
  isActive: boolean;
  isKernelAuthoritative: boolean;
}

export type ChatRunStateBinding = Pick<ChatRunBinding, 'sessionId' | 'runId' | 'isActive'>;

export function resolveChatRunBinding(
  session: ChatRunBindingSource | null | undefined,
): ChatRunBinding {
  const sessionBinding = resolveChatSessionBinding(session);
  const sessionState = resolveKernelChatSessionState(session);
  const runId = sessionState.activeRunId ?? null;

  return {
    scopeInstanceId: sessionBinding.scopeInstanceId,
    sessionId: sessionBinding.sessionId,
    kernelOwnedSessionId: resolveKernelOwnedSessionId(session),
    kernelId: sessionBinding.kernelId,
    kernelInstanceId: sessionBinding.kernelInstanceId,
    nativeSessionId: sessionBinding.nativeSessionId,
    routingKey: sessionBinding.routingKey,
    agentId: sessionBinding.agentId,
    lineageParentSessionId: sessionBinding.lineageParentSessionId,
    authorityKind: sessionBinding.authorityKind,
    lifecycle: sessionState.lifecycle,
    runId,
    isActive: Boolean(runId),
    isKernelAuthoritative: sessionBinding.isKernelAuthoritative,
  };
}
