export const CHAT_NEAR_BOTTOM_THRESHOLD_PX = 450;

type ChatViewportMetrics = {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
};

type ChatScrollSignatureCollection = readonly unknown[] | null | undefined;

export interface ChatMessageScrollSignatureMessage {
  id?: string | number | null;
  role?: string | null;
  timestamp?: string | number | null;
  content?: string | null;
  model?: string | null;
  senderLabel?: string | null;
  reasoning?: string | null;
  attachments?: ChatScrollSignatureCollection;
  notices?: ChatScrollSignatureCollection;
  toolCards?: ChatScrollSignatureCollection;
  pendingDelivery?: boolean | null;
  operationalEvent?: {
    kind?: string | null;
    summary?: string | null;
  } | null;
  kernelMessage?: {
    status?: string | null;
    parts?: ChatScrollSignatureCollection;
    nativeMetadata?: {
      seq?: string | number | null;
      runId?: string | null;
    } | null;
  } | null;
}

function normalizeSignatureValue(value: unknown) {
  return value === null || value === undefined ? '' : String(value);
}

function normalizeSignatureTextLength(value: unknown) {
  return typeof value === 'string' ? value.length : 0;
}

function toSignatureRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function resolveChatScrollCollectionItemSignature(item: unknown, index: number) {
  const record = toSignatureRecord(item);
  if (!record) {
    return [
      index,
      typeof item,
      normalizeSignatureTextLength(normalizeSignatureValue(item)),
    ].join(',');
  }

  return [
    index,
    normalizeSignatureValue(record.id ?? record.toolCallId ?? record.fileId ?? record.code),
    normalizeSignatureValue(record.kind ?? record.type ?? record.level ?? record.status),
    normalizeSignatureValue(record.name ?? record.fileName ?? record.label),
    normalizeSignatureValue(record.isError),
    normalizeSignatureTextLength(record.text),
    normalizeSignatureTextLength(record.preview),
    normalizeSignatureTextLength(record.detail),
    normalizeSignatureTextLength(record.argumentsText),
    normalizeSignatureTextLength(record.content),
    normalizeSignatureTextLength(record.url),
    normalizeSignatureTextLength(record.previewUrl),
    normalizeSignatureTextLength(record.originalUrl),
  ].join(',');
}

function resolveChatScrollCollectionSignature(collection: ChatScrollSignatureCollection) {
  if (!Array.isArray(collection) || collection.length === 0) {
    return '0';
  }

  return `${collection.length}[${collection
    .map((item, index) => resolveChatScrollCollectionItemSignature(item, index))
    .join('|')}]`;
}

function resolveChatScrollMessageSignature(
  message: ChatMessageScrollSignatureMessage,
  index: number,
) {
  return [
    index,
    normalizeSignatureValue(message.id),
    normalizeSignatureValue(message.role),
    normalizeSignatureValue(message.timestamp),
    normalizeSignatureValue(message.model),
    normalizeSignatureValue(message.senderLabel),
    normalizeSignatureValue(message.pendingDelivery),
    normalizeSignatureValue(message.kernelMessage?.status),
    normalizeSignatureValue(message.kernelMessage?.nativeMetadata?.seq),
    normalizeSignatureValue(message.kernelMessage?.nativeMetadata?.runId),
    normalizeSignatureTextLength(message.content),
    normalizeSignatureTextLength(message.reasoning),
    normalizeSignatureValue(message.operationalEvent?.kind),
    normalizeSignatureTextLength(message.operationalEvent?.summary),
    resolveChatScrollCollectionSignature(message.attachments),
    resolveChatScrollCollectionSignature(message.notices),
    resolveChatScrollCollectionSignature(message.toolCards),
    resolveChatScrollCollectionSignature(message.kernelMessage?.parts),
  ].join(',');
}

export function resolveChatMessageScrollSignature(
  messages: readonly ChatMessageScrollSignatureMessage[],
) {
  return `${messages.length}:${messages
    .map((message, index) => resolveChatScrollMessageSignature(message, index))
    .join(';')}`;
}

export function isChatViewportNearBottom(
  params: ChatViewportMetrics & {
    thresholdPx?: number;
  },
) {
  const thresholdPx = params.thresholdPx ?? CHAT_NEAR_BOTTOM_THRESHOLD_PX;
  const distanceFromBottom = params.scrollHeight - params.scrollTop - params.clientHeight;
  return distanceFromBottom < thresholdPx;
}

export function resolveChatAutoScrollDecision(
  params: ChatViewportMetrics & {
    force?: boolean;
    hasAutoScrolled: boolean;
    userNearBottom: boolean;
  },
) {
  const effectiveForce = Boolean(params.force) && !params.hasAutoScrolled;
  const shouldScroll =
    effectiveForce ||
    params.userNearBottom ||
    isChatViewportNearBottom(params);

  return {
    shouldScroll,
    showJumpToLatest: !shouldScroll,
    nextHasAutoScrolled: params.hasAutoScrolled || effectiveForce,
    effectiveForce,
  };
}
