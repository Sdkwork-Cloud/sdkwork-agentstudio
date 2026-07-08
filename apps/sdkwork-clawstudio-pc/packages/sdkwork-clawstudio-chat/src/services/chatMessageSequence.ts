type ChatMessageSequenceLike = {
  seq?: number | null;
  nativeMetadata?: Record<string, unknown> | null;
};

function normalizeMessageSequence(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function resolveChatMessageSequenceFromNativeMetadata(
  nativeMetadata: Record<string, unknown> | null | undefined,
) {
  const metadata =
    nativeMetadata && typeof nativeMetadata === 'object' ? nativeMetadata : null;
  const resolvedSequence =
    normalizeMessageSequence(metadata?.seq) ??
    normalizeMessageSequence(metadata?.messageSeq) ??
    normalizeMessageSequence(metadata?.upstreamMessageSeq);

  return resolvedSequence === null ? undefined : resolvedSequence;
}

export function resolveChatMessageSequence(
  source: ChatMessageSequenceLike | null | undefined,
) {
  const resolvedSequence =
    resolveChatMessageSequenceFromNativeMetadata(source?.nativeMetadata) ??
    normalizeMessageSequence(source?.seq);

  return resolvedSequence === null ? undefined : resolvedSequence;
}

export function mergeChatMessageSequenceIntoNativeMetadata(
  nativeMetadata: Record<string, unknown> | null | undefined,
  seq: number | null | undefined,
) {
  const metadata =
    nativeMetadata && typeof nativeMetadata === 'object' ? { ...nativeMetadata } : null;
  const resolvedSequence =
    resolveChatMessageSequenceFromNativeMetadata(metadata) ??
    normalizeMessageSequence(seq);

  if (resolvedSequence === null || resolvedSequence === undefined) {
    return metadata;
  }

  return {
    ...(metadata ?? {}),
    seq: resolvedSequence,
  };
}
