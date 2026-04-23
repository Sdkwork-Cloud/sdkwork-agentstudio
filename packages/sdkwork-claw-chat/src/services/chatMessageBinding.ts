import type { KernelChatMessage } from '@sdkwork/claw-types';
import { normalizeUserVisibleChatSenderLabel } from './chatSenderLabelPolicy.ts';

type ChatMessageBindingSource = {
  id?: string;
  runId?: string | null;
  model?: string | null;
  senderLabel?: string | null;
  nativeMetadata?: Record<string, unknown> | null;
  kernelMessage?: KernelChatMessage | null;
};

export interface ChatMessageBinding {
  id: string | null;
  runId: string | null;
  model: string | null;
  senderLabel: string | null;
  kernelId: string | null;
  instanceId: string | null;
  sessionId: string | null;
  nativeSessionId: string | null;
  routingKey: string | null;
  agentId: string | null;
  lineageParentSessionId: string | null;
  nativeMetadata: Record<string, unknown> | null;
}

function trimNullableString(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return value ?? null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function cloneNativeMetadata(value: Record<string, unknown> | null | undefined) {
  return value ? { ...value } : null;
}

export function resolveChatMessageBinding(
  message: ChatMessageBindingSource | null | undefined,
): ChatMessageBinding {
  const kernelMessage = message?.kernelMessage ?? null;
  const sessionRef = kernelMessage?.sessionRef ?? null;

  return {
    id: trimNullableString(kernelMessage?.id) ?? trimNullableString(message?.id),
    runId: trimNullableString(kernelMessage?.runId) ?? trimNullableString(message?.runId),
    model: trimNullableString(kernelMessage?.model) ?? trimNullableString(message?.model),
    senderLabel: normalizeUserVisibleChatSenderLabel(
      trimNullableString(kernelMessage?.senderLabel) ??
        trimNullableString(message?.senderLabel),
    ),
    kernelId: trimNullableString(sessionRef?.kernelId),
    instanceId: trimNullableString(sessionRef?.instanceId),
    sessionId: trimNullableString(sessionRef?.sessionId),
    nativeSessionId: trimNullableString(sessionRef?.nativeSessionId),
    routingKey: trimNullableString(sessionRef?.routingKey),
    agentId: trimNullableString(sessionRef?.agentId),
    lineageParentSessionId: trimNullableString(sessionRef?.lineageParentSessionId),
    nativeMetadata: cloneNativeMetadata(kernelMessage?.nativeMetadata ?? message?.nativeMetadata),
  };
}
