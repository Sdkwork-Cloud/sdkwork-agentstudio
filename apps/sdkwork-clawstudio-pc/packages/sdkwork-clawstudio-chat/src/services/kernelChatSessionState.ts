import type { KernelChatAuthorityKind } from '@sdkwork/clawstudio-types';

type KernelAwareChatSessionLike = {
  model?: string | null;
  defaultModel?: string | null;
  runId?: string | null;
  thinkingLevel?: string | null;
  fastMode?: boolean | null;
  verboseLevel?: string | null;
  reasoningLevel?: string | null;
  sessionKind?: string | null;
  kernelSession?: {
    ref?: {
      kernelId?: string | null;
      instanceId?: string | null;
      sessionId?: string | null;
      nativeSessionId?: string | null;
      agentId?: string | null;
      routingKey?: string | null;
      lineageParentSessionId?: string | null;
    } | null;
    actorBinding?: {
      agentId?: string | null;
    } | null;
    authority?: {
      kind?: string | null;
      source?: string | null;
      durable?: boolean | null;
      writable?: boolean | null;
    } | null;
    lifecycle?: string | null;
    sessionKind?: string | null;
    nativeMetadata?: Record<string, unknown> | null;
    modelBinding?: {
      model?: string | null;
      defaultModel?: string | null;
      thinkingLevel?: string | null;
      fastMode?: boolean | null;
      verboseLevel?: string | null;
      reasoningLevel?: string | null;
    } | null;
    activeRunId?: string | null;
  } | null;
};

const KERNEL_CHAT_AUTHORITY_KINDS = new Set<KernelChatAuthorityKind>([
  'gateway',
  'sqlite',
  'http',
  'localProjection',
]);

function trimNullableString(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return value ?? null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function normalizeAuthorityKind(
  value: string | null | undefined,
): KernelChatAuthorityKind | null {
  const normalized = trimNullableString(value);
  if (!normalized) {
    return null;
  }

  return KERNEL_CHAT_AUTHORITY_KINDS.has(normalized as KernelChatAuthorityKind)
    ? (normalized as KernelChatAuthorityKind)
    : null;
}

function cloneNativeMetadata(value: Record<string, unknown> | null | undefined) {
  return value ? { ...value } : null;
}

export function resolveKernelChatSessionState(session: KernelAwareChatSessionLike | null | undefined) {
  const kernelSession = session?.kernelSession ?? null;
  const modelBinding = kernelSession?.modelBinding ?? null;

  return {
    kernelId: trimNullableString(kernelSession?.ref?.kernelId),
    instanceId: trimNullableString(kernelSession?.ref?.instanceId),
    sessionId: trimNullableString(kernelSession?.ref?.sessionId),
    nativeSessionId: trimNullableString(kernelSession?.ref?.nativeSessionId),
    agentId:
      trimNullableString(kernelSession?.ref?.agentId) ??
      trimNullableString(kernelSession?.actorBinding?.agentId),
    routingKey: trimNullableString(kernelSession?.ref?.routingKey),
    lineageParentSessionId: trimNullableString(kernelSession?.ref?.lineageParentSessionId),
    authorityKind: normalizeAuthorityKind(kernelSession?.authority?.kind),
    authoritySource: trimNullableString(kernelSession?.authority?.source),
    authorityDurable:
      typeof kernelSession?.authority?.durable === 'boolean'
        ? kernelSession.authority.durable
        : null,
    authorityWritable:
      typeof kernelSession?.authority?.writable === 'boolean'
        ? kernelSession.authority.writable
        : null,
    lifecycle: trimNullableString(kernelSession?.lifecycle),
    sessionKind: trimNullableString(kernelSession?.sessionKind) ?? trimNullableString(session?.sessionKind),
    nativeMetadata: cloneNativeMetadata(kernelSession?.nativeMetadata),
    activeRunId: trimNullableString(kernelSession?.activeRunId) ?? trimNullableString(session?.runId),
    model: trimNullableString(modelBinding?.model) ?? trimNullableString(session?.model),
    defaultModel:
      trimNullableString(modelBinding?.defaultModel) ?? trimNullableString(session?.defaultModel),
    thinkingLevel:
      trimNullableString(modelBinding?.thinkingLevel) ?? trimNullableString(session?.thinkingLevel),
    fastMode:
      typeof modelBinding?.fastMode === 'boolean'
        ? modelBinding.fastMode
        : typeof session?.fastMode === 'boolean'
          ? session.fastMode
          : null,
    verboseLevel:
      trimNullableString(modelBinding?.verboseLevel) ?? trimNullableString(session?.verboseLevel),
    reasoningLevel:
      trimNullableString(modelBinding?.reasoningLevel) ?? trimNullableString(session?.reasoningLevel),
  };
}
