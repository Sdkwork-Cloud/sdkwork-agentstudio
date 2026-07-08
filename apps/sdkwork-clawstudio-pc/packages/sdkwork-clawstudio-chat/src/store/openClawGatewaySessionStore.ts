import type {
  KernelChatMessage,
  KernelChatSession,
  StudioConversationAttachment,
} from '@sdkwork/clawstudio-types';
import type {
  OpenClawGatewayAgentEvent,
  OpenClawGatewayChatEvent,
  OpenClawGatewayChatHistoryResult,
  OpenClawGatewayHelloOk,
  OpenClawGatewayConnectionEvent,
  OpenClawGatewayGapEvent,
  OpenClawGatewayModelsListResult,
  OpenClawGatewaySessionMessageEvent,
  OpenClawGatewaySessionsPatchResult,
  OpenClawGatewaySessionsListResult,
} from '../services/store/index.ts';
import {
  OpenClawGatewayRequestError,
  buildOpenClawMainSessionKey,
  buildOpenClawThreadSessionKey,
  buildGatewayAttachments,
  composeOutgoingChatText,
  DEFAULT_CHAT_SESSION_TITLE,
  hydrateOpenClawKernelChatProjection,
  isGatewayMethodUnavailableError,
  isAnyOpenClawMainSession,
  isReadableChatSessionTitle,
  normalizeChatSessionTitle,
  resolveOpenClawMessagePresentation,
  sanitizeChatSessionPreviewText,
  type OpenClawMessagePresentationRole,
  type OpenClawToolCard,
  resolveGatewayErrorDetailCode,
  resolveInitialChatSessionTitle,
  resolveGatewayEventSupport,
  resolveGatewayMethodSupport,
  selectReadableChatSessionTitleCandidates,
} from '../services/store/index.ts';
import {
  dedupeChatMessagesById,
  orderChatMessagesForDisplay,
  normalizeUserVisibleChatSenderLabel,
  resolveChatMessagePrimaryPreviewText,
  resolveLatestChatMessageForDisplay,
  resolveLatestChatMessageTimestamp,
  parseOpenClawGatewayAgentLifecycleEvent,
  type KernelAgentLifecycleEvent,
} from '../services/index.ts';
import { shouldRefreshChatAgentCatalogForGatewayAgentEvent } from './openClawGatewayAgentCatalogRefreshPolicy.ts';

export type OpenClawGatewayRole = OpenClawMessagePresentationRole;
export type OpenClawGatewaySyncState = 'idle' | 'loading' | 'error';
export type OpenClawGatewayHistoryState = 'idle' | 'loading' | 'ready' | 'error';
export type OpenClawGatewayConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected';
type OpenClawGatewayTitleSource = 'default' | 'preview' | 'explicit' | 'firstUser';

const TITLE_REPAIR_HISTORY_LIMIT = 4;
const HISTORY_MERGE_EXACT_CELL_LIMIT = 12_000;

export interface OpenClawGatewayMessage {
  id: string;
  role: OpenClawGatewayRole;
  content: string;
  transportText?: string;
  timestamp: number;
  senderLabel?: string | null;
  seq?: number;
  model?: string;
  runId?: string;
  attachments?: StudioConversationAttachment[];
  reasoning?: string | null;
  toolCards?: OpenClawToolCard[];
  pendingDelivery?: boolean;
  kernelMessage?: KernelChatMessage | null;
}

export interface OpenClawGatewayChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  lastSeenAt?: number | null;
  messages: OpenClawGatewayMessage[];
  model: string;
  defaultModel?: string | null;
  instanceId?: string;
  transport?: 'openclawGateway';
  isDraft?: boolean;
  runId?: string | null;
  thinkingLevel?: string | null;
  fastMode?: boolean | null;
  verboseLevel?: string | null;
  reasoningLevel?: string | null;
  lastMessagePreview?: string;
  titleSource?: OpenClawGatewayTitleSource;
  historyState?: OpenClawGatewayHistoryState;
  sessionKind?: string | null;
  kernelSession?: KernelChatSession | null;
}

export interface OpenClawGatewayInstanceSnapshot {
  sessions: OpenClawGatewayChatSession[];
  activeSessionId: string | null;
  syncState: OpenClawGatewaySyncState;
  connectionStatus: OpenClawGatewayConnectionStatus;
  lastError?: string;
  isEmptySnapshotAuthoritative?: boolean;
}

export interface OpenClawGatewayAgentCatalogChangedEvent {
  instanceId: string;
  payload: OpenClawGatewayAgentEvent | Record<string, unknown>;
  lifecycleEvent?: KernelAgentLifecycleEvent | null;
}

export interface OpenClawGatewayClientLike {
  connect: () => Promise<OpenClawGatewayHelloOk>;
  disconnect: () => void;
  subscribeSessions: () => Promise<unknown>;
  subscribeSessionMessages: (params: { key: string }) => Promise<unknown>;
  unsubscribeSessionMessages: (params: { key: string }) => Promise<unknown>;
  listSessions: (params?: {
    includeGlobal?: boolean;
    includeUnknown?: boolean;
    activeMinutes?: number;
    limit?: number;
    includeDerivedTitles?: boolean;
    includeLastMessage?: boolean;
    agentId?: string;
  }) => Promise<OpenClawGatewaySessionsListResult>;
  getChatHistory: (params: {
    sessionKey: string;
    limit?: number;
    maxChars?: number;
  }) => Promise<OpenClawGatewayChatHistoryResult>;
  listModels: () => Promise<OpenClawGatewayModelsListResult>;
  patchSession: (params: {
    key: string;
    label?: string | null;
    model?: string | null;
    thinkingLevel?: string | null;
    fastMode?: boolean | null;
    verboseLevel?: string | null;
    reasoningLevel?: string | null;
    contextTokens?: number | null;
  }) => Promise<OpenClawGatewaySessionsPatchResult>;
  sendChatMessage: (params: {
    sessionKey: string;
    message: string;
    idempotencyKey?: string;
    deliver?: boolean;
    attachments?: unknown[];
  }) => Promise<{
    runId: string;
    response?: unknown;
  }>;
  abortChatRun: (params: { sessionKey: string; runId?: string }) => Promise<unknown>;
  resetSession: (params: { key: string; reason?: 'new' | 'reset' }) => Promise<unknown>;
  deleteSession: (params: { key: string; deleteTranscript?: boolean }) => Promise<unknown>;
  on(event: 'agent', listener: (payload: OpenClawGatewayAgentEvent) => void): () => void;
  on(event: 'chat', listener: (payload: OpenClawGatewayChatEvent) => void): () => void;
  on(
    event: 'connection',
    listener: (payload: OpenClawGatewayConnectionEvent) => void,
  ): () => void;
  on(event: 'gap', listener: (payload: OpenClawGatewayGapEvent) => void): () => void;
  on(
    event: 'session.message',
    listener: (payload: OpenClawGatewaySessionMessageEvent) => void,
  ): () => void;
  on(event: 'sessions.changed', listener: (payload: unknown) => void): () => void;
}

interface OpenClawGatewaySessionStoreOptions {
  getClient: (
    instanceId: string,
  ) => OpenClawGatewayClientLike | Promise<OpenClawGatewayClientLike>;
  now?: () => number;
  createSessionKey?: (instanceId: string, agentId?: string | null) => string;
  createRunId?: () => string;
  historyMaxChars?: number;
  resolveHistoryMaxChars?: (instanceId: string) => number | undefined | Promise<number | undefined>;
}

type InternalInstanceState = {
  client: OpenClawGatewayClientLike;
  snapshot: OpenClawGatewayInstanceSnapshot;
  placeholderClient: boolean;
  subscribed: boolean;
  sessionsSubscribeUnsupported: boolean;
  sessionMessagesSubscribeUnsupported: boolean;
  subscribedSessionMessageKeys: Set<string>;
  pendingConnectInterrupts: Set<() => void>;
  offAgent?: () => void;
  offChat?: () => void;
  offConnection?: () => void;
  offGap?: () => void;
  offSessionMessage?: () => void;
  offSessionsChanged?: () => void;
  refreshVersion: number;
};

type SessionHistoryRequestSnapshot = {
  updatedAt: number;
  runId: string | null;
  messageCount: number;
};

type PendingConnectResult =
  | {
      kind: 'connected';
      hello: OpenClawGatewayHelloOk;
    }
  | {
      kind: 'failed';
      error: unknown;
    }
  | {
      kind: 'interrupted';
    };

const SILENT_REPLY_TOKENS = new Set(['NO_REPLY', 'ANNOUNCE_SKIP', 'REPLY_SKIP']);
const MISSING_OPERATOR_READ_SCOPE_MESSAGE = 'missing scope: operator.read';
const AUTH_UNAUTHORIZED_DETAIL_CODE = 'AUTH_UNAUTHORIZED';

function createInitialSnapshot(): OpenClawGatewayInstanceSnapshot {
  return {
    sessions: [],
    activeSessionId: null,
    syncState: 'idle',
    connectionStatus: 'disconnected',
    lastError: undefined,
    isEmptySnapshotAuthoritative: false,
  };
}

function createMessageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeInlineWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeSeenTimestamp(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function normalizeGatewaySessionMessages(messages: OpenClawGatewayMessage[]) {
  return dedupeChatMessagesById(messages);
}

function resolveGatewaySessionLastDisplayMessage(
  session: Pick<OpenClawGatewayChatSession, 'messages'>,
) {
  return resolveLatestChatMessageForDisplay(session.messages);
}

function resolveSessionVisibleTimestamp(
  session: Pick<OpenClawGatewayChatSession, 'createdAt' | 'updatedAt' | 'messages'>,
) {
  return Math.max(
    session.createdAt,
    session.updatedAt,
    resolveLatestChatMessageTimestamp(session.messages) ?? Number.NEGATIVE_INFINITY,
  );
}

function markGatewaySessionSeen(
  session: OpenClawGatewayChatSession,
  seenAt = resolveSessionVisibleTimestamp(session),
) {
  const normalizedSeenAt = normalizeSeenTimestamp(seenAt);
  if (normalizedSeenAt === null) {
    return;
  }

  const currentLastSeenAt = normalizeSeenTimestamp(session.lastSeenAt);
  if (currentLastSeenAt !== null && currentLastSeenAt >= normalizedSeenAt) {
    return;
  }

  session.lastSeenAt = normalizedSeenAt;
}

function truncatePreview(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3).trimEnd()}...`;
}

function isSilentReplyText(value: string) {
  return SILENT_REPLY_TOKENS.has(value.trim());
}

function isMissingOperatorReadScopeError(error: unknown): boolean {
  if (error instanceof OpenClawGatewayRequestError) {
    const detailCode = resolveGatewayErrorDetailCode(error);
    if (detailCode === AUTH_UNAUTHORIZED_DETAIL_CODE) {
      return true;
    }
  }

  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return message.toLowerCase().includes(MISSING_OPERATOR_READ_SCOPE_MESSAGE);
}

function formatMissingOperatorReadScopeMessage(feature: string) {
  return `This connection is missing operator.read, so ${feature} cannot be loaded yet.`;
}

function normalizeGatewayErrorMessage(message: unknown): string | null {
  if (typeof message === 'string' && message.trim()) {
    return message;
  }

  if (message instanceof Error && typeof message.message === 'string' && message.message.trim()) {
    return message.message;
  }

  return null;
}

function formatGatewayConnectError(error: unknown): string | null {
  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  if (!error || typeof error !== 'object') {
    return null;
  }

  const message = normalizeGatewayErrorMessage(
    error instanceof Error ? error : (error as { message?: unknown }).message,
  );
  const detailCode = resolveGatewayErrorDetailCode(error as { details?: unknown });

  switch (detailCode) {
    case 'AUTH_TOKEN_MISMATCH':
      return 'gateway token mismatch';
    case AUTH_UNAUTHORIZED_DETAIL_CODE:
      return 'gateway auth failed';
    case 'AUTH_RATE_LIMITED':
      return 'too many failed authentication attempts';
    case 'PAIRING_REQUIRED':
      return 'gateway pairing required';
    case 'CONTROL_UI_DEVICE_IDENTITY_REQUIRED':
      return 'device identity required (use HTTPS/localhost or allow insecure auth explicitly)';
    case 'CONTROL_UI_ORIGIN_NOT_ALLOWED':
      return 'origin not allowed (open the Control UI from the gateway host or allow it in gateway.controlUi.allowedOrigins)';
    case 'AUTH_TOKEN_MISSING':
      return 'gateway token missing';
    default:
      break;
  }

  if (!message) {
    return null;
  }

  const normalized = message.trim().toLowerCase();
  if (
    normalized === 'fetch failed' ||
    normalized === 'failed to fetch' ||
    normalized === 'connect failed'
  ) {
    return 'gateway connect failed';
  }

  return message;
}

function isSilentReplyAssistantPayload(payload: unknown, extractedText: string) {
  if (!extractedText || !isSilentReplyText(extractedText)) {
    return false;
  }

  if (!payload || typeof payload !== 'object') {
    return true;
  }

  const role = (payload as Record<string, unknown>).role;
  if (typeof role !== 'string') {
    return true;
  }

  return role.toLowerCase() === 'assistant';
}

function extractMessagePresentation(payload: unknown) {
  return resolveOpenClawMessagePresentation(payload);
}

function extractMessageText(payload: unknown) {
  return extractMessagePresentation(payload).text;
}

function normalizeTimestamp(payload: unknown, fallback: number) {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  const record = payload as Record<string, unknown>;
  const candidate = record.timestamp ?? record.createdAt ?? record.updatedAt ?? record.ts;
  return typeof candidate === 'number' ? candidate : fallback;
}

function normalizeRole(payload: unknown): OpenClawGatewayRole {
  return extractMessagePresentation(payload).role;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function resolveChatPayloadMessage(payload: OpenClawGatewayChatEvent | Record<string, unknown>) {
  if (payload.message !== undefined) {
    return payload.message;
  }

  const record = payload as Record<string, unknown>;
  if (
    record.delta !== undefined ||
    record.text !== undefined ||
    record.content !== undefined ||
    record.toolCards !== undefined ||
    record.tool_calls !== undefined ||
    record.tool_call !== undefined ||
    record.tool_results !== undefined ||
    record.tool_result !== undefined
  ) {
    return record;
  }

  return undefined;
}

function normalizeChatSendResponseEvent(params: {
  response: unknown;
  sessionKey: string;
  runId: string;
}): OpenClawGatewayChatEvent | null {
  if (!isPlainRecord(params.response)) {
    return null;
  }

  const state = params.response.state;
  const normalizedState =
    state === 'delta' || state === 'final' || state === 'aborted' || state === 'error'
      ? state
      : 'final';
  const sessionKey = params.sessionKey;
  const runId = params.runId;
  const message = resolveChatPayloadMessage(params.response);
  const errorMessage =
    typeof params.response.errorMessage === 'string'
      ? params.response.errorMessage
      : typeof params.response.error === 'string'
        ? params.response.error
        : undefined;

  if (message === undefined && !errorMessage) {
    return null;
  }

  return {
    ...params.response,
    sessionKey,
    runId,
    state: normalizedState,
    ...(message !== undefined ? { message } : {}),
    ...(errorMessage ? { errorMessage } : {}),
  };
}

function normalizeAttachmentKind(value: unknown): StudioConversationAttachment['kind'] {
  return value === 'image' ||
    value === 'audio' ||
    value === 'video' ||
    value === 'screenshot' ||
    value === 'screen-recording' ||
    value === 'link'
    ? value
    : 'file';
}

function normalizeAttachment(payload: unknown): StudioConversationAttachment | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const idCandidate = record.id ?? record.fileId ?? record.objectKey ?? record.url;
  const nameCandidate = record.name ?? record.fileName ?? record.label ?? record.objectKey;
  const id = typeof idCandidate === 'string' && idCandidate.trim()
    ? idCandidate.trim()
    : null;
  const name = typeof nameCandidate === 'string' && nameCandidate.trim()
    ? nameCandidate.trim()
    : 'Attachment';

  if (!id) {
    return null;
  }

  const sizeBytesCandidate = record.sizeBytes ?? record.size ?? record.fileSize;
  const widthCandidate = record.width;
  const heightCandidate = record.height;
  const durationMsCandidate = record.durationMs ?? record.duration;

  return {
    id,
    kind: normalizeAttachmentKind(record.kind ?? record.type),
    name,
    url: typeof record.url === 'string' ? record.url : undefined,
    previewUrl:
      typeof record.previewUrl === 'string'
        ? record.previewUrl
        : typeof record.url === 'string'
          ? record.url
          : undefined,
    objectKey: typeof record.objectKey === 'string' ? record.objectKey : undefined,
    mimeType:
      typeof record.mimeType === 'string'
        ? record.mimeType
        : typeof record.contentType === 'string'
          ? record.contentType
          : undefined,
    sizeBytes: typeof sizeBytesCandidate === 'number' ? sizeBytesCandidate : undefined,
    fileId: typeof record.fileId === 'string' ? record.fileId : undefined,
    originalUrl:
      typeof record.originalUrl === 'string' ? record.originalUrl : undefined,
    width: typeof widthCandidate === 'number' ? widthCandidate : undefined,
    height: typeof heightCandidate === 'number' ? heightCandidate : undefined,
    durationMs:
      typeof durationMsCandidate === 'number' ? durationMsCandidate : undefined,
  };
}

function resolveInlineAttachmentName(url: string | undefined, fallback: string) {
  if (!url) {
    return fallback;
  }

  try {
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname.trim();
    const lastSegment = pathname.split('/').filter(Boolean).at(-1);
    return lastSegment || fallback;
  } catch {
    return fallback;
  }
}

function resolveInlineAttachmentDataUrl(source: Record<string, unknown>) {
  if (typeof source.data !== 'string' || !source.data.trim()) {
    return null;
  }

  const data = source.data.trim();
  if (data.startsWith('data:')) {
    return data;
  }

  const mediaType =
    typeof source.media_type === 'string' && source.media_type.trim()
      ? source.media_type.trim()
      : 'image/png';

  return `data:${mediaType};base64,${data}`;
}

function normalizeInlineContentAttachment(
  payload: unknown,
  index: number,
): StudioConversationAttachment | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const type = typeof record.type === 'string' ? record.type.toLowerCase() : '';
  if (type === 'image') {
    const source =
      record.source && typeof record.source === 'object' && !Array.isArray(record.source)
        ? (record.source as Record<string, unknown>)
        : null;
    const inlineUrl =
      (source ? resolveInlineAttachmentDataUrl(source) : null) ||
      (typeof record.url === 'string' && record.url.trim() ? record.url.trim() : null);
    if (!inlineUrl) {
      return null;
    }

    const mimeType =
      typeof source?.media_type === 'string' && source.media_type.trim()
        ? source.media_type.trim()
        : undefined;

    return {
      id:
        (typeof record.id === 'string' && record.id.trim()) ||
        (typeof record.fileId === 'string' && record.fileId.trim()) ||
        inlineUrl ||
        `inline-image-${index}`,
      kind: 'image',
      name:
        (typeof record.name === 'string' && record.name.trim()) ||
        resolveInlineAttachmentName(
          typeof record.url === 'string' ? record.url : undefined,
          'Image',
        ),
      url: inlineUrl.startsWith('data:') ? undefined : inlineUrl,
      previewUrl: inlineUrl,
      mimeType,
    };
  }

  if (type === 'image_url') {
    const imageUrl =
      record.image_url && typeof record.image_url === 'object' && !Array.isArray(record.image_url)
        ? (record.image_url as Record<string, unknown>)
        : null;
    const url =
      typeof imageUrl?.url === 'string' && imageUrl.url.trim() ? imageUrl.url.trim() : null;
    if (!url) {
      return null;
    }

    return {
      id:
        (typeof record.id === 'string' && record.id.trim()) ||
        (typeof record.fileId === 'string' && record.fileId.trim()) ||
        url ||
        `inline-image-url-${index}`,
      kind: 'image',
      name:
        (typeof record.name === 'string' && record.name.trim()) ||
        resolveInlineAttachmentName(url, 'Image'),
      url,
      previewUrl: url,
    };
  }

  return null;
}

function normalizeAttachments(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const record = payload as Record<string, unknown>;
  const attachmentItems = Array.isArray(record.attachments) ? record.attachments : [];
  const contentItems = Array.isArray(record.content) ? record.content : [];
  const attachments = [
    ...attachmentItems.map((attachment) => normalizeAttachment(attachment)),
    ...contentItems.map((item, index) => normalizeInlineContentAttachment(item, index)),
  ]
    .filter((attachment): attachment is StudioConversationAttachment => attachment !== null);

  return attachments.length > 0 ? attachments : undefined;
}

function cloneAttachments(
  attachments: StudioConversationAttachment[] | undefined,
) {
  if (!attachments || attachments.length === 0) {
    return undefined;
  }

  return attachments.map((attachment) => ({ ...attachment }));
}

function cloneToolCards(toolCards: OpenClawToolCard[] | undefined) {
  if (!toolCards || toolCards.length === 0) {
    return undefined;
  }

  return toolCards.map((toolCard) => ({ ...toolCard }));
}

function normalizeAgentToolName(value: unknown, fallback?: string | null) {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  return fallback?.trim() || 'Tool';
}

function summarizeAgentToolArgs(args: unknown): string | undefined {
  if (typeof args === 'string') {
    const normalized = normalizeInlineWhitespace(args);
    return normalized ? truncatePreview(normalized, 120) : undefined;
  }

  if (typeof args === 'number' || typeof args === 'boolean') {
    return String(args);
  }

  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    return undefined;
  }

  const record = args as Record<string, unknown>;
  for (const key of ['command', 'cmd', 'query', 'prompt', 'path', 'url', 'text']) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return truncatePreview(normalizeInlineWhitespace(value), 120);
    }
  }

  const serialized = JSON.stringify(args);
  if (!serialized || serialized === '{}' || serialized === '[]') {
    return undefined;
  }

  return truncatePreview(serialized, 120);
}

function summarizeAgentToolResult(result: unknown, isError?: boolean): string | undefined {
  let preview: string | undefined;

  if (typeof result === 'string') {
    const normalized = normalizeInlineWhitespace(result);
    preview = normalized ? truncatePreview(normalized, 160) : undefined;
  } else if (typeof result === 'number' || typeof result === 'boolean') {
    preview = String(result);
  } else if (Array.isArray(result)) {
    const parts = result
      .map((entry) => summarizeAgentToolResult(entry))
      .filter((value): value is string => Boolean(value));
    preview = parts.length > 0 ? truncatePreview(parts.join(' | '), 160) : undefined;
  } else if (result && typeof result === 'object') {
    const record = result as Record<string, unknown>;
    for (const key of ['text', 'content', 'summary', 'message', 'status', 'url', 'path']) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) {
        preview = truncatePreview(normalizeInlineWhitespace(value), 160);
        break;
      }
    }

    if (!preview) {
      const serialized = JSON.stringify(result);
      if (serialized && serialized !== '{}' && serialized !== '[]') {
        preview = truncatePreview(serialized, 160);
      }
    }
  }

  if (!preview) {
    return undefined;
  }

  if (isError && !preview.toLowerCase().startsWith('error')) {
    return `Error: ${preview}`;
  }

  return preview;
}

function serializeAgentToolPayload(value: unknown) {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized || undefined;
  }

  if (value == null) {
    return undefined;
  }

  try {
    const serialized = JSON.stringify(value);
    return serialized && serialized !== 'null' ? serialized : undefined;
  } catch {
    return undefined;
  }
}

function buildAgentToolMessageId(params: {
  sessionKey: string;
  runId?: string | null;
  toolCallId: string;
}) {
  return `agent-tool:${params.sessionKey}:${params.runId?.trim() || 'unknown'}:${params.toolCallId}`;
}

function buildAgentToolMessage(params: {
  sessionKey: string;
  runId?: string | null;
  timestamp: number;
  toolCallId: string;
  name?: unknown;
  args?: unknown;
  result?: unknown;
  isError?: boolean;
  existingMessage?: OpenClawGatewayMessage | null;
}): OpenClawGatewayMessage {
  const existingCallCard = params.existingMessage?.toolCards?.find((toolCard) => toolCard.kind === 'call');
  const resolvedName = normalizeAgentToolName(params.name, existingCallCard?.name);
  const callArgumentsText =
    params.args !== undefined
      ? serializeAgentToolPayload(params.args)
      : existingCallCard?.argumentsText;
  const resultText = serializeAgentToolPayload(params.result);
  const callDetail =
    params.args !== undefined
      ? summarizeAgentToolArgs(params.args)
      : existingCallCard?.detail;
  const resultPreview = summarizeAgentToolResult(params.result, params.isError);
  const toolCards: OpenClawToolCard[] = [
    {
      kind: 'call',
      name: resolvedName,
      toolCallId: params.toolCallId,
      ...(callArgumentsText ? { argumentsText: callArgumentsText } : {}),
      ...(callDetail ? { detail: callDetail } : {}),
    },
    ...(resultPreview
      ? [
          {
            kind: 'result' as const,
            name: resolvedName,
            toolCallId: params.toolCallId,
            ...(resultText ? { text: resultText } : {}),
            isError: params.isError === true,
            preview: resultPreview,
          },
        ]
      : []),
  ];

  return createGatewayMessage({
    id: buildAgentToolMessageId({
      sessionKey: params.sessionKey,
      runId: params.runId,
      toolCallId: params.toolCallId,
    }),
    role: 'tool',
    content: '',
    timestamp: params.timestamp,
    runId: params.runId ?? undefined,
    toolCards,
  });
}

function normalizeSenderLabelValue(value: unknown) {
  return normalizeUserVisibleChatSenderLabel(value);
}

function normalizeDisplaySenderLabel(value: unknown) {
  return normalizeSenderLabelValue(value);
}

function resolveSenderLabel(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  if (normalizeDisplaySenderLabel(record.senderLabel)) {
    return normalizeDisplaySenderLabel(record.senderLabel);
  }

  if (normalizeDisplaySenderLabel(record.sender_label)) {
    return normalizeDisplaySenderLabel(record.sender_label);
  }

  const openClawMeta =
    record.__openclaw && typeof record.__openclaw === 'object' && !Array.isArray(record.__openclaw)
      ? (record.__openclaw as Record<string, unknown>)
      : null;
  if (normalizeDisplaySenderLabel(openClawMeta?.senderLabel)) {
    return normalizeDisplaySenderLabel(openClawMeta?.senderLabel);
  }

  return normalizeDisplaySenderLabel(openClawMeta?.sender_label);
}

function createGatewayMessage(input: {
  id: string;
  role: OpenClawGatewayRole;
  content: string;
  transportText?: string;
  timestamp: number;
  senderLabel?: string | null;
  seq?: number;
  model?: string;
  runId?: string;
  attachments?: StudioConversationAttachment[];
  reasoning?: string | null;
  toolCards?: OpenClawToolCard[];
  pendingDelivery?: boolean;
}): OpenClawGatewayMessage {
  const attachments = cloneAttachments(input.attachments);
  const toolCards = cloneToolCards(input.toolCards);
  const senderLabel =
    input.senderLabel !== undefined
      ? normalizeUserVisibleChatSenderLabel(input.senderLabel)
      : undefined;
  const message: OpenClawGatewayMessage = {
    id: input.id,
    role: input.role,
    content: input.content,
    ...(input.transportText !== undefined ? { transportText: input.transportText } : {}),
    timestamp: input.timestamp,
    ...(senderLabel !== undefined ? { senderLabel } : {}),
    ...(typeof input.seq === 'number' ? { seq: input.seq } : {}),
    ...(input.model !== undefined ? { model: input.model } : {}),
    ...(input.runId !== undefined ? { runId: input.runId } : {}),
    ...(attachments ? { attachments } : {}),
    ...(input.reasoning !== undefined ? { reasoning: input.reasoning } : {}),
    ...(toolCards ? { toolCards } : {}),
  };

  if (input.pendingDelivery) {
    Object.defineProperty(message, 'pendingDelivery', {
      value: true,
      enumerable: false,
      configurable: true,
      writable: true,
    });
  }

  return message;
}

function resolveMessagePreview(message: {
  content: string;
  attachments?: StudioConversationAttachment[];
  toolCards?: OpenClawToolCard[];
}) {
  return resolveChatMessagePrimaryPreviewText(message, 160) ?? undefined;
}

function syncGatewaySessionDerivedMessageState(session: OpenClawGatewayChatSession) {
  syncGatewaySessionDerivedMessageStateWithOptions(session);
}

function syncGatewaySessionDerivedMessageStateWithOptions(
  session: OpenClawGatewayChatSession,
  options?: {
    clearPreviewWhenMessagesEmpty?: boolean;
  },
) {
  session.messages = normalizeGatewaySessionMessages(session.messages);
  const lastDisplayMessage = resolveGatewaySessionLastDisplayMessage(session);
  const lastDisplayPreview = lastDisplayMessage
    ? resolveMessagePreview(lastDisplayMessage)
    : undefined;
  if (lastDisplayPreview) {
    session.lastMessagePreview = lastDisplayPreview;
  } else if (options?.clearPreviewWhenMessagesEmpty) {
    session.lastMessagePreview = undefined;
  }

  session.updatedAt = Math.max(
    session.createdAt,
    session.updatedAt,
    resolveLatestChatMessageTimestamp(session.messages) ?? Number.NEGATIVE_INFINITY,
  );
}

function resolveGatewayRunErrorMessage(message: unknown) {
  const normalized = normalizeGatewayErrorMessage(message)?.trim() || 'OpenClaw chat error.';
  return normalized.toLowerCase().startsWith('error:')
    ? normalized
    : `Error: ${normalized}`;
}

function appendGatewayAssistantErrorContent(content: string, errorMessage: string) {
  if (!content.trim()) {
    return errorMessage;
  }

  if (content.includes(errorMessage)) {
    return content;
  }

  return `${content.trimEnd()}\n\n${errorMessage}`;
}

function normalizeComparableRunId(value: string | null | undefined) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function findLatestAssistantMessageIndexForRun(
  messages: OpenClawGatewayMessage[],
  runId?: string | null,
) {
  const normalizedRunId = normalizeComparableRunId(runId);
  if (!normalizedRunId) {
    return -1;
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || message.role !== 'assistant') {
      continue;
    }

    if (normalizeComparableRunId(message.runId) === normalizedRunId) {
      return index;
    }
  }

  return -1;
}

function shouldMergeAssistantRunPayloadIntoLastMessage(params: {
  lastMessage: OpenClawGatewayMessage | null | undefined;
  comparableRunId: string | null;
  payloadRole: OpenClawGatewayRole;
  toolCards: OpenClawToolCard[] | undefined;
}) {
  if (!params.comparableRunId) {
    return false;
  }

  return Boolean(
    params.payloadRole === 'assistant' &&
      (!params.toolCards || params.toolCards.length === 0) &&
      params.lastMessage &&
      params.lastMessage.role === 'assistant' &&
      normalizeComparableRunId(params.lastMessage.runId) === params.comparableRunId,
  );
}

function normalizeMessage(
  payload: unknown,
  fallbackTimestamp: number,
  fallbackIdPrefix: string,
): OpenClawGatewayMessage | null {
  const presentation = extractMessagePresentation(payload);
  const content = presentation.text;
  const attachments = normalizeAttachments(payload);
  const toolCards = cloneToolCards(presentation.toolCards);
  if (!content && (!attachments || attachments.length === 0) && (!toolCards || toolCards.length === 0)) {
    return null;
  }

  const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const role = presentation.role;
  if (role === 'assistant' && isSilentReplyText(content)) {
    return null;
  }

  const idCandidate = record.id ?? record.messageId;
  return createGatewayMessage({
    id: typeof idCandidate === 'string' && idCandidate ? idCandidate : createMessageId(fallbackIdPrefix),
    role,
    content,
    timestamp: normalizeTimestamp(payload, fallbackTimestamp),
    senderLabel: presentation.senderLabel ?? resolveSenderLabel(record),
    seq: typeof record.seq === 'number' ? record.seq : undefined,
    model: typeof record.model === 'string' ? record.model : undefined,
    runId: typeof record.runId === 'string' ? record.runId : undefined,
    attachments,
    reasoning: presentation.reasoning,
    toolCards,
  });
}

function normalizeSessionMessage(
  payload: OpenClawGatewaySessionMessageEvent,
  fallbackTimestamp: number,
) {
  const record = payload as Record<string, unknown>;
  const messageRecord =
    record.message && typeof record.message === 'object' && !Array.isArray(record.message)
      ? ({ ...(record.message as Record<string, unknown>) } satisfies Record<string, unknown>)
      : {};
  const openClawMeta =
    messageRecord.__openclaw &&
    typeof messageRecord.__openclaw === 'object' &&
    !Array.isArray(messageRecord.__openclaw)
      ? (messageRecord.__openclaw as Record<string, unknown>)
      : null;
  const normalizedPayload: Record<string, unknown> = {
    ...messageRecord,
    ...(typeof record.messageId === 'string' && !messageRecord.id
      ? { id: record.messageId }
      : {}),
    ...(typeof record.messageSeq === 'number' && messageRecord.seq === undefined
      ? { seq: record.messageSeq }
      : {}),
    ...(typeof record.runId === 'string' && typeof messageRecord.runId !== 'string'
      ? { runId: record.runId }
      : {}),
    ...(typeof record.model === 'string' && typeof messageRecord.model !== 'string'
      ? { model: record.model }
      : {}),
    ...(typeof record.timestamp === 'number' && typeof messageRecord.timestamp !== 'number'
      ? { timestamp: record.timestamp }
      : {}),
    ...(typeof record.createdAt === 'number' && typeof messageRecord.createdAt !== 'number'
      ? { createdAt: record.createdAt }
      : {}),
    ...(typeof record.updatedAt === 'number' && typeof messageRecord.updatedAt !== 'number'
      ? { updatedAt: record.updatedAt }
      : {}),
    ...(typeof record.ts === 'number' && typeof messageRecord.ts !== 'number'
      ? { ts: record.ts }
      : {}),
    ...(normalizeDisplaySenderLabel(record.senderLabel) &&
    !normalizeDisplaySenderLabel(messageRecord.senderLabel)
      ? { senderLabel: normalizeDisplaySenderLabel(record.senderLabel) }
      : {}),
    ...(normalizeDisplaySenderLabel(record.sender_label) &&
    !normalizeDisplaySenderLabel(messageRecord.senderLabel) &&
    !normalizeDisplaySenderLabel(messageRecord.sender_label)
      ? { sender_label: normalizeDisplaySenderLabel(record.sender_label) }
      : {}),
    ...(typeof openClawMeta?.id === 'string' && !messageRecord.id ? { id: openClawMeta.id } : {}),
    ...(typeof openClawMeta?.seq === 'number' && messageRecord.seq === undefined
      ? { seq: openClawMeta.seq }
      : {}),
  };
  return normalizeMessage(normalizedPayload, fallbackTimestamp, 'session-message');
}

function resolveGatewayChatEventMessageId(
  payload: OpenClawGatewayChatEvent,
  fallbackPrefix: string,
) {
  const record = payload as Record<string, unknown>;
  const messageRecord =
    record.message && typeof record.message === 'object' && !Array.isArray(record.message)
      ? (record.message as Record<string, unknown>)
      : null;
  const idCandidate = messageRecord?.id ?? messageRecord?.messageId ?? record.messageId ?? record.id;
  return typeof idCandidate === 'string' && idCandidate.trim()
    ? idCandidate.trim()
    : createMessageId(fallbackPrefix);
}

function resolveGatewayChatEventMessageSeq(payload: OpenClawGatewayChatEvent) {
  const record = payload as Record<string, unknown>;
  const messageRecord =
    record.message && typeof record.message === 'object' && !Array.isArray(record.message)
      ? (record.message as Record<string, unknown>)
      : null;
  const candidate = messageRecord?.seq ?? record.messageSeq ?? record.seq;
  return typeof candidate === 'number' ? candidate : undefined;
}

function deriveSessionTitle(
  existingTitle: string,
  messageContent: string,
  attachments: StudioConversationAttachment[],
  isFirstUserMessage: boolean,
) {
  return resolveInitialChatSessionTitle({
    existingTitle,
    text: messageContent,
    attachments,
    isFirstUserMessage,
  });
}

function deriveReadableSessionTitleFromMessage(message: OpenClawGatewayMessage) {
  if (message.role === 'system' || message.role === 'tool') {
    return null;
  }

  const title = deriveSessionTitle(
    DEFAULT_CHAT_SESSION_TITLE,
    message.content,
    message.attachments ?? [],
    true,
  );
  return title && title !== DEFAULT_CHAT_SESSION_TITLE ? title : null;
}

function resolveReadableSessionTitleFromMessages(messages: OpenClawGatewayMessage[]) {
  for (const message of messages) {
    if (message.role !== 'user') {
      continue;
    }

    const title = deriveReadableSessionTitleFromMessage(message);
    if (title) {
      return title;
    }
  }

  for (const message of messages) {
    const title = deriveReadableSessionTitleFromMessage(message);
    if (title) {
      return title;
    }
  }

  return null;
}

function resolvePersistableSessionTitleLabel(
  session: OpenClawGatewayChatSession | null | undefined,
) {
  if (session?.titleSource !== 'firstUser') {
    return null;
  }

  const title = normalizeChatSessionTitle(session.title);
  if (!title || title === DEFAULT_CHAT_SESSION_TITLE) {
    return null;
  }

  return title;
}

function buildSessionTitle(row: Record<string, unknown>) {
  return selectReadableChatSessionTitleCandidates(
    [
      typeof row.derivedTitle === 'string' ? row.derivedTitle : undefined,
      typeof row.displayName === 'string' ? row.displayName : undefined,
      typeof row.label === 'string' ? row.label : undefined,
    ],
    DEFAULT_CHAT_SESSION_TITLE,
  );
}

function buildSessionTitleState(row: Record<string, unknown>) {
  const explicitTitle = selectReadableChatSessionTitleCandidates(
    [
      typeof row.derivedTitle === 'string' ? row.derivedTitle : undefined,
      typeof row.displayName === 'string' ? row.displayName : undefined,
      typeof row.label === 'string' ? row.label : undefined,
    ],
    '',
  );

  if (explicitTitle) {
    return {
      title: explicitTitle,
      source: 'explicit' as const,
    };
  }

  return {
    title: buildSessionTitle(row),
    source: 'default' as const,
  };
}

function createAttachmentMatchKey(attachment: StudioConversationAttachment) {
  return [
    attachment.id,
    attachment.objectKey,
    attachment.fileId,
    attachment.url,
    attachment.name,
    attachment.kind,
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join('::');
}

function areAttachmentsSemanticallyEqual(
  left: StudioConversationAttachment[] | undefined,
  right: StudioConversationAttachment[] | undefined,
) {
  const leftAttachments = left ?? [];
  const rightAttachments = right ?? [];
  if (leftAttachments.length !== rightAttachments.length) {
    return false;
  }

  return leftAttachments.every((attachment, index) => {
    const rightAttachment = rightAttachments[index];
    if (!rightAttachment) {
      return false;
    }

    return createAttachmentMatchKey(attachment) === createAttachmentMatchKey(rightAttachment);
  });
}

function areToolCardsSemanticallyEqual(
  left: OpenClawToolCard[] | undefined,
  right: OpenClawToolCard[] | undefined,
) {
  const leftCards = left ?? [];
  const rightCards = right ?? [];
  if (leftCards.length !== rightCards.length) {
    return false;
  }

  return leftCards.every((toolCard, index) => {
    const rightToolCard = rightCards[index];
    if (!rightToolCard) {
      return false;
    }

    return (
      toolCard.kind === rightToolCard.kind &&
      toolCard.name === rightToolCard.name &&
      (toolCard.toolCallId ?? '') === (rightToolCard.toolCallId ?? '') &&
      (toolCard.argumentsText ?? '') === (rightToolCard.argumentsText ?? '') &&
      (toolCard.text ?? '') === (rightToolCard.text ?? '') &&
      (toolCard.isError ?? false) === (rightToolCard.isError ?? false) &&
      (toolCard.detail ?? '') === (rightToolCard.detail ?? '') &&
      (toolCard.preview ?? '') === (rightToolCard.preview ?? '')
    );
  });
}

function areMessagesSemanticallyEqual(
  left: OpenClawGatewayMessage,
  right: OpenClawGatewayMessage,
) {
  return (
    left.role === right.role &&
    (left.senderLabel?.trim() || '') === (right.senderLabel?.trim() || '') &&
    left.content.trim() === right.content.trim() &&
    areAttachmentsSemanticallyEqual(left.attachments, right.attachments) &&
    areToolCardsSemanticallyEqual(left.toolCards, right.toolCards)
  );
}

function areSenderLabelsCompatible(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  const normalizedLeft = left?.trim() || '';
  const normalizedRight = right?.trim() || '';
  return !normalizedLeft || !normalizedRight || normalizedLeft === normalizedRight;
}

function normalizeComparableUserMessageText(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = normalizeInlineWhitespace(value);
  return normalized || null;
}

function areUserMessageAttachmentsCompatible(params: {
  pendingMessage: OpenClawGatewayMessage;
  persistedMessage: OpenClawGatewayMessage;
}) {
  const pendingAttachments = params.pendingMessage.attachments ?? [];
  const persistedAttachments = params.persistedMessage.attachments ?? [];
  if (pendingAttachments.length === 0 && persistedAttachments.length === 0) {
    return true;
  }

  if (pendingAttachments.length > 0 && persistedAttachments.length > 0) {
    return areAttachmentsSemanticallyEqual(pendingAttachments, persistedAttachments);
  }

  const pendingTransportText = normalizeComparableUserMessageText(
    params.pendingMessage.transportText,
  );
  const persistedTransportText = normalizeComparableUserMessageText(
    params.persistedMessage.transportText,
  );
  const pendingContentText = normalizeComparableUserMessageText(params.pendingMessage.content);
  const persistedContentText = normalizeComparableUserMessageText(params.persistedMessage.content);
  if (pendingContentText && pendingContentText === persistedContentText) {
    return true;
  }

  return Boolean(
    (pendingTransportText &&
      (pendingTransportText === persistedContentText ||
        pendingTransportText === persistedTransportText)) ||
      (persistedTransportText &&
        (persistedTransportText === pendingContentText ||
          persistedTransportText === pendingTransportText)),
  );
}

function mergeEquivalentPendingUserMessages(
  left: OpenClawGatewayMessage,
  right: OpenClawGatewayMessage,
) {
  const pendingMessage = left.pendingDelivery ? left : right.pendingDelivery ? right : null;
  const persistedMessage = pendingMessage === left ? right : pendingMessage === right ? left : null;
  if (!pendingMessage || !persistedMessage) {
    return null;
  }

  return createGatewayMessage({
    id: persistedMessage.id,
    role: persistedMessage.role,
    content: pendingMessage.content,
    transportText: pendingMessage.transportText ?? persistedMessage.transportText,
    timestamp: persistedMessage.timestamp,
    senderLabel: persistedMessage.senderLabel ?? pendingMessage.senderLabel,
    seq: persistedMessage.seq ?? pendingMessage.seq,
    model: persistedMessage.model ?? pendingMessage.model,
    runId: persistedMessage.runId ?? pendingMessage.runId,
    attachments: pendingMessage.attachments ?? persistedMessage.attachments,
    reasoning: pendingMessage.reasoning ?? persistedMessage.reasoning,
    toolCards: pendingMessage.toolCards ?? persistedMessage.toolCards,
  });
}

function mergeSessionMessages(
  existingMessage: OpenClawGatewayMessage,
  candidate: OpenClawGatewayMessage,
) {
  const mergedPendingUserMessage = mergeEquivalentPendingUserMessages(
    existingMessage,
    candidate,
  );
  if (mergedPendingUserMessage) {
    return mergedPendingUserMessage;
  }

  const clonedCandidate = cloneMessage(candidate);
  return {
    ...existingMessage,
    ...clonedCandidate,
    transportText: clonedCandidate.transportText ?? existingMessage.transportText,
    attachments: cloneAttachments(candidate.attachments) ?? cloneAttachments(existingMessage.attachments),
  };
}

function areMessagesEquivalentForPendingMerge(
  left: OpenClawGatewayMessage,
  right: OpenClawGatewayMessage,
) {
  if (areMessagesSemanticallyEqual(left, right)) {
    return true;
  }

  const pendingMessage = left.pendingDelivery ? left : right.pendingDelivery ? right : null;
  const persistedMessage = pendingMessage === left ? right : pendingMessage === right ? left : null;
  if (!pendingMessage || !persistedMessage || pendingMessage.role !== 'user' || persistedMessage.role !== 'user') {
    return false;
  }

  const pendingTexts = new Set(
    [
      normalizeComparableUserMessageText(pendingMessage.content),
      normalizeComparableUserMessageText(pendingMessage.transportText),
    ].filter((value): value is string => Boolean(value)),
  );
  const persistedTexts = new Set(
    [
      normalizeComparableUserMessageText(persistedMessage.content),
      normalizeComparableUserMessageText(persistedMessage.transportText),
    ].filter((value): value is string => Boolean(value)),
  );
  const hasMatchingText = [...pendingTexts].some((value) => persistedTexts.has(value));
  if (!hasMatchingText) {
    return false;
  }

  return (
    areUserMessageAttachmentsCompatible({
      pendingMessage,
      persistedMessage,
    }) &&
    areToolCardsSemanticallyEqual(pendingMessage.toolCards, persistedMessage.toolCards) &&
    areSenderLabelsCompatible(pendingMessage.senderLabel, persistedMessage.senderLabel)
  );
}

function cloneMessage(message: OpenClawGatewayMessage): OpenClawGatewayMessage {
  return createGatewayMessage({
    id: message.id,
    role: message.role,
    content: message.content,
    transportText: message.transportText,
    timestamp: message.timestamp,
    senderLabel: message.senderLabel,
    seq: message.seq,
    model: message.model,
    runId: message.runId,
    attachments: message.attachments,
    reasoning: message.reasoning,
    toolCards: message.toolCards,
    pendingDelivery: message.pendingDelivery,
  });
}

function findExistingMessageIndex(
  messages: OpenClawGatewayMessage[],
  candidate: OpenClawGatewayMessage,
) {
  const normalizedId = candidate.id.trim();
  if (normalizedId) {
    const idMatchIndex = messages.findIndex((message) => message.id === normalizedId);
    if (idMatchIndex >= 0) {
      return idMatchIndex;
    }
  }

  if (typeof candidate.seq === 'number') {
    const seqMatchIndex = messages.findIndex(
      (message) => message.seq === candidate.seq && message.role === candidate.role,
    );
    if (seqMatchIndex >= 0) {
      return seqMatchIndex;
    }
  }

  return -1;
}

function findPendingEquivalentMessageIndex(
  messages: OpenClawGatewayMessage[],
  candidate: OpenClawGatewayMessage,
) {
  return messages.findIndex((message) => {
    if (!areMessagesEquivalentForPendingMerge(message, candidate)) {
      return false;
    }

    if (message.pendingDelivery || candidate.pendingDelivery) {
      return true;
    }

    const comparableExistingRunId = normalizeComparableRunId(message.runId);
    if (
      comparableExistingRunId &&
      comparableExistingRunId === normalizeComparableRunId(candidate.runId)
    ) {
      return true;
    }

    return message.timestamp === candidate.timestamp;
  });
}

function upsertSessionMessage(
  messages: OpenClawGatewayMessage[],
  candidate: OpenClawGatewayMessage,
) {
  const identityMatchIndex = findExistingMessageIndex(messages, candidate);
  const existingIndex =
    identityMatchIndex >= 0
      ? identityMatchIndex
      : findPendingEquivalentMessageIndex(messages, candidate);
  if (existingIndex < 0) {
    return normalizeGatewaySessionMessages([...messages, cloneMessage(candidate)]);
  }

  return normalizeGatewaySessionMessages(
    messages.map((message, index) =>
      index === existingIndex
        ? mergeSessionMessages(message, candidate)
        : message,
    ),
  );
}

function shouldPreserveLocalMessageInHistoryMerge(
  message: OpenClawGatewayMessage,
  preserveAssistantRunId?: string | null,
) {
  if (message.role === 'user') {
    return true;
  }

  const normalizedAssistantRunId = preserveAssistantRunId?.trim() || null;
  return (
    Boolean(normalizedAssistantRunId) &&
    (message.role === 'assistant' || message.role === 'tool') &&
    (message.runId?.trim() || null) === normalizedAssistantRunId
  );
}

function shouldSkipLocalAssistantForRemoteTerminalMessage(params: {
  localMessage: OpenClawGatewayMessage;
  remoteMessages: OpenClawGatewayMessage[];
  remoteIndex: number;
  preserveAssistantRunId?: string | null;
  preferRemoteTerminalAssistantMessage?: boolean;
}) {
  const {
    localMessage,
    remoteMessages,
    remoteIndex,
    preserveAssistantRunId,
    preferRemoteTerminalAssistantMessage,
  } = params;
  if (
    !preferRemoteTerminalAssistantMessage ||
    localMessage.role !== 'assistant' ||
    !shouldPreserveLocalMessageInHistoryMerge(localMessage, preserveAssistantRunId)
  ) {
    return false;
  }

  for (let index = remoteIndex; index < remoteMessages.length; index += 1) {
    if (remoteMessages[index]?.role === 'assistant') {
      return true;
    }
  }

  return false;
}

function hasSemanticallyMatchingMessage(
  messages: OpenClawGatewayMessage[],
  candidate: OpenClawGatewayMessage,
) {
  return messages.some((message) => {
    const byIdentity = findExistingMessageIndex([message], candidate) >= 0;
    return byIdentity || areMessagesEquivalentForPendingMerge(message, candidate);
  });
}

function mergeLargeHistoryWithLocalMessages(
  mergeableLocalMessages: OpenClawGatewayMessage[],
  remoteMessages: OpenClawGatewayMessage[],
  appendedLocalMessages: OpenClawGatewayMessage[],
  options: {
    preserveAssistantRunId?: string | null;
    preferRemoteTerminalAssistantMessage?: boolean;
  },
) {
  const mergedMessages = remoteMessages.map((message) => cloneMessage(message));
  const appendIfNeeded = (localMessage: OpenClawGatewayMessage) => {
    if (
      options.preferRemoteTerminalAssistantMessage &&
      localMessage.role === 'assistant' &&
      resolveLatestChatMessageForDisplay(mergedMessages)?.role === 'assistant'
    ) {
      return;
    }

    if (!hasSemanticallyMatchingMessage(mergedMessages, localMessage)) {
      mergedMessages.push(cloneMessage(localMessage));
    }
  };

  for (const localMessage of mergeableLocalMessages) {
    if (
      localMessage.pendingDelivery ||
      (localMessage.role !== 'user' &&
        shouldPreserveLocalMessageInHistoryMerge(localMessage, options.preserveAssistantRunId))
    ) {
      appendIfNeeded(localMessage);
    }
  }

  for (const localMessage of appendedLocalMessages) {
    appendIfNeeded(localMessage);
  }

  return normalizeGatewaySessionMessages(mergedMessages);
}

export function mergeHistoryWithLocalMessages(
  localMessages: OpenClawGatewayMessage[],
  remoteMessages: OpenClawGatewayMessage[],
  options?: {
    preserveAssistantRunId?: string | null;
    preserveFromIndex?: number | null;
    preferRemoteTerminalAssistantMessage?: boolean;
  },
) {
  const preserveAssistantRunId = options?.preserveAssistantRunId;
  const preserveFromIndex = options?.preserveFromIndex;
  const preferRemoteTerminalAssistantMessage = options?.preferRemoteTerminalAssistantMessage;
  const mergeableLocalMessages =
    typeof preserveFromIndex === 'number'
      ? localMessages.slice(0, preserveFromIndex)
      : localMessages;
  const appendedLocalMessages =
    typeof preserveFromIndex === 'number'
      ? localMessages.slice(preserveFromIndex)
      : [];

  if (mergeableLocalMessages.length === 0 && appendedLocalMessages.length > 0) {
    const mergedMessages = remoteMessages.map((message) => cloneMessage(message));
    for (const localMessage of appendedLocalMessages) {
      if (!hasSemanticallyMatchingMessage(mergedMessages, localMessage)) {
        mergedMessages.push(cloneMessage(localMessage));
      }
    }
    return normalizeGatewaySessionMessages(mergedMessages);
  }

  if (mergeableLocalMessages.length === 0 || remoteMessages.length === 0) {
    return normalizeGatewaySessionMessages(
      remoteMessages.length === 0
        ? [...mergeableLocalMessages, ...appendedLocalMessages]
            .filter((message) =>
              shouldPreserveLocalMessageInHistoryMerge(message, preserveAssistantRunId),
            )
            .map((message) => cloneMessage(message))
        : [
            ...remoteMessages.map((message) => cloneMessage(message)),
            ...appendedLocalMessages
              .filter((message) => !hasSemanticallyMatchingMessage(remoteMessages, message))
              .map((message) => cloneMessage(message)),
          ],
    );
  }

  if (mergeableLocalMessages.length * remoteMessages.length > HISTORY_MERGE_EXACT_CELL_LIMIT) {
    return mergeLargeHistoryWithLocalMessages(
      mergeableLocalMessages,
      remoteMessages,
      appendedLocalMessages,
      {
        preserveAssistantRunId,
        preferRemoteTerminalAssistantMessage,
      },
    );
  }

  const dp = Array.from({ length: mergeableLocalMessages.length + 1 }, () =>
    Array<number>(remoteMessages.length + 1).fill(0),
  );

  for (let localIndex = mergeableLocalMessages.length - 1; localIndex >= 0; localIndex -= 1) {
    for (let remoteIndex = remoteMessages.length - 1; remoteIndex >= 0; remoteIndex -= 1) {
      dp[localIndex]![remoteIndex] = areMessagesEquivalentForPendingMerge(
        mergeableLocalMessages[localIndex]!,
        remoteMessages[remoteIndex]!,
      )
        ? 1 + dp[localIndex + 1]![remoteIndex + 1]!
        : Math.max(dp[localIndex + 1]![remoteIndex]!, dp[localIndex]![remoteIndex + 1]!);
    }
  }

  const mergedMessages: OpenClawGatewayMessage[] = [];
  let localIndex = 0;
  let remoteIndex = 0;

  while (localIndex < mergeableLocalMessages.length && remoteIndex < remoteMessages.length) {
    const localMessage = mergeableLocalMessages[localIndex]!;
    const remoteMessage = remoteMessages[remoteIndex]!;
    if (areMessagesEquivalentForPendingMerge(localMessage, remoteMessage)) {
      mergedMessages.push(mergeSessionMessages(localMessage, remoteMessage));
      localIndex += 1;
      remoteIndex += 1;
      continue;
    }

    if (dp[localIndex + 1]![remoteIndex]! >= dp[localIndex]![remoteIndex + 1]!) {
      if (
        shouldPreserveLocalMessageInHistoryMerge(localMessage, preserveAssistantRunId) &&
        !shouldSkipLocalAssistantForRemoteTerminalMessage({
          localMessage,
          remoteMessages,
          remoteIndex,
          preserveAssistantRunId,
          preferRemoteTerminalAssistantMessage,
        })
      ) {
        mergedMessages.push(cloneMessage(localMessage));
      }
      localIndex += 1;
      continue;
    }

    mergedMessages.push(remoteMessage);
    remoteIndex += 1;
  }

  while (localIndex < mergeableLocalMessages.length) {
    const localMessage = mergeableLocalMessages[localIndex]!;
    if (
      shouldPreserveLocalMessageInHistoryMerge(localMessage, preserveAssistantRunId) &&
      !shouldSkipLocalAssistantForRemoteTerminalMessage({
        localMessage,
        remoteMessages,
        remoteIndex,
        preserveAssistantRunId,
        preferRemoteTerminalAssistantMessage,
      })
    ) {
      mergedMessages.push(cloneMessage(localMessage));
    }
    localIndex += 1;
  }

  while (remoteIndex < remoteMessages.length) {
    mergedMessages.push(remoteMessages[remoteIndex]!);
    remoteIndex += 1;
  }

  for (const localMessage of appendedLocalMessages) {
    if (
      preferRemoteTerminalAssistantMessage &&
      localMessage.role === 'assistant' &&
      resolveLatestChatMessageForDisplay(mergedMessages)?.role === 'assistant'
    ) {
      continue;
    }
    if (!hasSemanticallyMatchingMessage(mergedMessages, localMessage)) {
      mergedMessages.push(cloneMessage(localMessage));
    }
  }

  return normalizeGatewaySessionMessages(mergedMessages);
}

function shouldMergeTranscriptIntoActiveAssistant(params: {
  sessionRunId?: string | null;
  lastMessage?: OpenClawGatewayMessage;
  transcriptMessage: OpenClawGatewayMessage;
}) {
  const sessionRunId = params.sessionRunId?.trim() || null;
  const { lastMessage, transcriptMessage } = params;
  if (
    !sessionRunId ||
    !lastMessage ||
    lastMessage.role !== 'assistant' ||
    transcriptMessage.role !== 'assistant' ||
    (lastMessage.runId?.trim() || null) !== sessionRunId
  ) {
    return false;
  }

  const lastContent = lastMessage.content.trim();
  const transcriptContent = transcriptMessage.content.trim();
  if (!lastContent || !transcriptContent) {
    return false;
  }

  return (
    lastContent === transcriptContent ||
    lastContent.startsWith(transcriptContent) ||
    transcriptContent.startsWith(lastContent)
  );
}

function cloneSession(session: OpenClawGatewayChatSession): OpenClawGatewayChatSession {
  return {
    ...session,
    messages: session.messages.map((message) => cloneMessage(message)),
  };
}

function normalizeRestoredMirrorSession(
  instanceId: string,
  session: OpenClawGatewayChatSession,
): OpenClawGatewayChatSession {
  const normalizedSession: OpenClawGatewayChatSession = {
    ...cloneSession(session),
    instanceId,
    transport: 'openclawGateway',
    historyState:
      session.historyState ??
      (session.messages.length > 0 ? 'ready' : 'idle'),
  };

  syncGatewaySessionDerivedMessageState(normalizedSession);
  return normalizedSession;
}

function mergeRestoredMirrorSession(
  existing: OpenClawGatewayChatSession,
  restored: OpenClawGatewayChatSession,
): OpenClawGatewayChatSession {
  const preferRestored =
    restored.updatedAt > existing.updatedAt ||
    restored.messages.length > existing.messages.length;
  const preferred = preferRestored ? restored : existing;
  const fallback = preferRestored ? existing : restored;

  const mergedSession: OpenClawGatewayChatSession = {
    ...cloneSession(preferred),
    title: preferred.title || fallback.title,
    lastSeenAt: preferred.lastSeenAt ?? fallback.lastSeenAt ?? null,
    defaultModel: preferred.defaultModel ?? fallback.defaultModel ?? null,
    model: preferred.model || fallback.model,
    runId: preferred.runId ?? fallback.runId ?? null,
    isDraft:
      typeof preferred.isDraft === 'boolean'
        ? preferred.isDraft
        : fallback.isDraft,
    thinkingLevel: preferred.thinkingLevel ?? fallback.thinkingLevel ?? null,
    fastMode:
      typeof preferred.fastMode === 'boolean'
        ? preferred.fastMode
        : fallback.fastMode ?? null,
    verboseLevel: preferred.verboseLevel ?? fallback.verboseLevel ?? null,
    reasoningLevel: preferred.reasoningLevel ?? fallback.reasoningLevel ?? null,
    lastMessagePreview: sanitizeChatSessionPreviewText({
      text: preferred.lastMessagePreview ?? fallback.lastMessagePreview,
      kernelId: 'openclaw',
    }),
    titleSource: preferred.titleSource ?? fallback.titleSource,
    historyState:
      preferred.historyState ??
      fallback.historyState ??
      (preferred.messages.length > 0 ? 'ready' : 'idle'),
    sessionKind: preferred.sessionKind ?? fallback.sessionKind ?? null,
  };

  syncGatewaySessionDerivedMessageState(mergedSession);
  return mergedSession;
}

function hasOwnSessionOverrideField(record: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function readNullableStringSessionOverride(
  record: Record<string, unknown>,
  key: string,
): string | null | undefined {
  if (!hasOwnSessionOverrideField(record, key)) {
    return undefined;
  }

  const value = record[key];
  return typeof value === 'string' || value === null ? value : undefined;
}

function readNullableBooleanSessionOverride(
  record: Record<string, unknown>,
  key: string,
): boolean | null | undefined {
  if (!hasOwnSessionOverrideField(record, key)) {
    return undefined;
  }

  const value = record[key];
  return typeof value === 'boolean' || value === null ? value : undefined;
}

function applySessionOverrideFields(
  session: OpenClawGatewayChatSession,
  record: Record<string, unknown> | null | undefined,
) {
  if (!record) {
    return;
  }

  const thinkingLevel = readNullableStringSessionOverride(record, 'thinkingLevel');
  if (thinkingLevel !== undefined) {
    session.thinkingLevel = thinkingLevel;
  }

  const fastMode = readNullableBooleanSessionOverride(record, 'fastMode');
  if (fastMode !== undefined) {
    session.fastMode = fastMode;
  }

  const verboseLevel = readNullableStringSessionOverride(record, 'verboseLevel');
  if (verboseLevel !== undefined) {
    session.verboseLevel = verboseLevel;
  }

  const reasoningLevel = readNullableStringSessionOverride(record, 'reasoningLevel');
  if (reasoningLevel !== undefined) {
    session.reasoningLevel = reasoningLevel;
  }
}

function normalizeSessionModelRef(params: {
  provider?: string | null;
  model?: string | null;
}) {
  const provider = params.provider?.trim();
  const model = params.model?.trim();
  if (!model) {
    return null;
  }

  return provider ? `${provider}/${model}` : model;
}

function resolveSessionMessageSupport(
  hello: Pick<OpenClawGatewayHelloOk, 'features'> | null | undefined,
) {
  const subscribeSupport = resolveGatewayMethodSupport(hello, 'sessions.messages.subscribe');
  const unsubscribeSupport = resolveGatewayMethodSupport(hello, 'sessions.messages.unsubscribe');
  const eventSupport = resolveGatewayEventSupport(hello, 'session.message');

  if (subscribeSupport === false || unsubscribeSupport === false || eventSupport === false) {
    return false;
  }

  if (subscribeSupport === true && unsubscribeSupport === true && eventSupport === true) {
    return true;
  }

  return null;
}

function resolveConnectionEventErrorMessage(event: OpenClawGatewayConnectionEvent): string | null {
  if (event.error?.message?.trim()) {
    return event.error.message.trim();
  }

  const reason = event.reason?.trim() || 'no reason';
  if (typeof event.code === 'number') {
    return `Gateway disconnected (${event.code}): ${reason}`;
  }

  return reason === 'no reason' ? null : reason;
}

export class OpenClawGatewaySessionStore {
  private readonly getClient: OpenClawGatewaySessionStoreOptions['getClient'];
  private readonly now: () => number;
  private readonly createSessionKey: (instanceId: string, agentId?: string | null) => string;
  private readonly createRunId: () => string;
  private readonly historyMaxChars: number | undefined;
  private readonly resolveHistoryMaxChars:
    (instanceId: string) => number | undefined | Promise<number | undefined>;
  private readonly instances = new Map<string, InternalInstanceState>();
  private readonly listeners = new Set<
    (instanceId: string, snapshot: OpenClawGatewayInstanceSnapshot) => void
  >();
  private readonly agentCatalogListeners = new Set<
    (event: OpenClawGatewayAgentCatalogChangedEvent) => void
  >();
  private readonly agentLifecycleListeners = new Set<
    (event: KernelAgentLifecycleEvent) => void
  >();
  private runCounter = 0;

  constructor(options: OpenClawGatewaySessionStoreOptions) {
    this.getClient = options.getClient;
    this.now = options.now ?? (() => Date.now());
    this.createSessionKey =
      options.createSessionKey ??
      ((instanceId, agentId) =>
        buildOpenClawThreadSessionKey(
          agentId,
          `claw-studio:${instanceId}:${Math.random().toString(36).slice(2, 10)}`,
        ));
    this.createRunId =
      options.createRunId ??
      (() => {
        this.runCounter += 1;
        return `run-${this.runCounter}`;
      });
    this.historyMaxChars = options.historyMaxChars;
    this.resolveHistoryMaxChars =
      options.resolveHistoryMaxChars ??
      (() => this.historyMaxChars);
  }

  subscribe(listener: (instanceId: string, snapshot: OpenClawGatewayInstanceSnapshot) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  subscribeAgentCatalogChanged(
    listener: (event: OpenClawGatewayAgentCatalogChangedEvent) => void,
  ) {
    this.agentCatalogListeners.add(listener);
    return () => {
      this.agentCatalogListeners.delete(listener);
    };
  }

  subscribeAgentLifecycle(listener: (event: KernelAgentLifecycleEvent) => void) {
    this.agentLifecycleListeners.add(listener);
    return () => {
      this.agentLifecycleListeners.delete(listener);
    };
  }

  getSnapshot(instanceId: string): OpenClawGatewayInstanceSnapshot {
    const snapshot = this.instances.get(instanceId)?.snapshot ?? createInitialSnapshot();
    return {
      ...snapshot,
      sessions: snapshot.sessions.map((session) =>
        hydrateOpenClawKernelChatProjection({
          instanceId,
          session: cloneSession(session),
        }),
      ),
    };
  }

  restorePersistedMirror(params: {
    instanceId: string;
    sessions: OpenClawGatewayChatSession[];
    activeSessionId?: string | null;
    emit?: boolean;
  }) {
    if (params.sessions.length === 0) {
      return this.getSnapshot(params.instanceId);
    }

    const state = this.getOrCreatePlaceholderState(params.instanceId);
    const nextSessionsById = new Map(
      state.snapshot.sessions.map((session) => [session.id, cloneSession(session)] as const),
    );

    for (const restoredSession of params.sessions) {
      const normalizedSession = normalizeRestoredMirrorSession(
        params.instanceId,
        restoredSession,
      );
      const existingSession = nextSessionsById.get(normalizedSession.id);
      nextSessionsById.set(
        normalizedSession.id,
        existingSession
          ? mergeRestoredMirrorSession(existingSession, normalizedSession)
          : normalizedSession,
      );
    }

    state.snapshot.sessions = [...nextSessionsById.values()];
    state.snapshot.isEmptySnapshotAuthoritative = false;
    this.sortSessions(state.snapshot);
    state.snapshot.activeSessionId = this.resolveActiveSessionId(
      state.snapshot,
      params.activeSessionId ?? state.snapshot.activeSessionId,
    );
    this.syncActiveSessionSeen(state.snapshot);
    if (params.emit !== false) {
      this.emit(params.instanceId);
    }
    return this.getSnapshot(params.instanceId);
  }

  async hydrateInstance(instanceId: string) {
    return this.refreshInstance(instanceId, {
      preserveActiveSessionId: true,
      reloadActiveHistory: true,
    });
  }

  releaseInstance(instanceId: string) {
    const state = this.instances.get(instanceId);
    if (!state) {
      return;
    }

    this.instances.delete(instanceId);
    state.offAgent?.();
    state.offChat?.();
    state.offConnection?.();
    state.offGap?.();
    state.offSessionMessage?.();
    state.offSessionsChanged?.();
    this.interruptPendingConnects(state);
    state.client.disconnect();
    this.emit(instanceId);
  }

  createDraftSession(
    instanceId: string,
    model?: string,
    options?: {
      sessionId?: string | null;
      agentId?: string | null;
    },
  ) {
    const state = this.getOrCreatePlaceholderState(instanceId);
    const timestamp = this.now();
    const normalizedModel = model?.trim() || '';
    const session: OpenClawGatewayChatSession = {
      id: options?.sessionId?.trim() || this.createSessionKey(instanceId, options?.agentId),
      title: DEFAULT_CHAT_SESSION_TITLE,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastSeenAt: timestamp,
      messages: [],
      model: normalizedModel,
      instanceId,
      transport: 'openclawGateway',
      isDraft: true,
      runId: null,
      thinkingLevel: null,
      fastMode: null,
      verboseLevel: null,
      reasoningLevel: null,
      lastMessagePreview: undefined,
      titleSource: 'default',
      historyState: 'ready',
    };

    state.snapshot.sessions = [session, ...state.snapshot.sessions.filter((item) => item.id !== session.id)];
    state.snapshot.activeSessionId = session.id;
    state.snapshot.lastError = undefined;
    this.sortSessions(state.snapshot);
    this.emit(instanceId);
    void this.synchronizeSessionMessageSubscription(instanceId, state);
    return hydrateOpenClawKernelChatProjection({
      instanceId,
      session: cloneSession(session),
    });
  }

  async setActiveSession(params: { instanceId: string; sessionId: string | null }) {
    const state = await this.ensureState(params.instanceId);
    state.snapshot.activeSessionId = params.sessionId;
    state.snapshot.lastError = undefined;

    if (!params.sessionId) {
      this.emit(params.instanceId);
      void this.synchronizeSessionMessageSubscription(params.instanceId, state);
      return this.getSnapshot(params.instanceId);
    }

    const session = state.snapshot.sessions.find((entry) => entry.id === params.sessionId);
    if (session) {
      markGatewaySessionSeen(session);
    }
    this.emit(params.instanceId);
    void this.synchronizeSessionMessageSubscription(params.instanceId, state);

    if (session && !session.isDraft) {
      await this.refreshSessionHistory(params.instanceId, params.sessionId, undefined, {
        preserveSessionUpdatedAt: true,
      });
    }

    return this.getSnapshot(params.instanceId);
  }

  async setSessionModel(params: {
    instanceId: string;
    sessionId: string;
    model: string | null;
  }) {
    const state = await this.ensureState(params.instanceId);
    const session = this.findSession(state, params.sessionId);
    if (!session) {
      throw new Error(`OpenClaw session not found: ${params.sessionId}`);
    }

    if (session.isDraft) {
      session.model = params.model?.trim() || session.defaultModel || session.model;
      session.updatedAt = this.now();
      state.snapshot.lastError = undefined;
      this.syncActiveSessionSeen(state.snapshot);
      this.sortSessions(state.snapshot);
      this.emit(params.instanceId);
      return this.getSnapshot(params.instanceId);
    }

    try {
      const result = await state.client.patchSession({
        key: params.sessionId,
        model: params.model?.trim() || null,
      });
      const resolvedModel = normalizeSessionModelRef({
        provider: result.resolved?.modelProvider,
        model: result.resolved?.model,
      });
      if (params.model?.trim()) {
        session.model = params.model.trim();
      } else {
        session.model = resolvedModel || session.defaultModel || session.model;
        if (resolvedModel) {
          session.defaultModel = resolvedModel;
        }
      }
      session.updatedAt = this.now();
      state.snapshot.lastError = undefined;
      this.syncActiveSessionSeen(state.snapshot);
      this.sortSessions(state.snapshot);
      this.emit(params.instanceId);
      return this.getSnapshot(params.instanceId);
    } catch (error) {
      state.snapshot.lastError = this.toErrorMessage(
        error,
        'Failed to update the OpenClaw session model.',
      );
      this.emit(params.instanceId);
      throw error;
    }
  }

  async setSessionThinkingLevel(params: {
    instanceId: string;
    sessionId: string;
    thinkingLevel: string | null;
  }) {
    return this.setSessionOverrides({
      instanceId: params.instanceId,
      sessionId: params.sessionId,
      patch: {
        thinkingLevel: params.thinkingLevel?.trim() || null,
      },
      errorMessage: 'Failed to update the OpenClaw session thinking level.',
    });
  }

  async setSessionFastMode(params: {
    instanceId: string;
    sessionId: string;
    fastMode: boolean | null;
  }) {
    return this.setSessionOverrides({
      instanceId: params.instanceId,
      sessionId: params.sessionId,
      patch: {
        fastMode: params.fastMode,
      },
      errorMessage: 'Failed to update the OpenClaw session fast mode.',
    });
  }

  async setSessionVerboseLevel(params: {
    instanceId: string;
    sessionId: string;
    verboseLevel: string | null;
  }) {
    return this.setSessionOverrides({
      instanceId: params.instanceId,
      sessionId: params.sessionId,
      patch: {
        verboseLevel: params.verboseLevel?.trim() || null,
      },
      errorMessage: 'Failed to update the OpenClaw session verbose level.',
    });
  }

  async setSessionReasoningLevel(params: {
    instanceId: string;
    sessionId: string;
    reasoningLevel: string | null;
  }) {
    return this.setSessionOverrides({
      instanceId: params.instanceId,
      sessionId: params.sessionId,
      patch: {
        reasoningLevel: params.reasoningLevel?.trim() || null,
      },
      errorMessage: 'Failed to update the OpenClaw session reasoning level.',
    });
  }

  private async setSessionOverrides(params: {
    instanceId: string;
    sessionId: string;
    patch: {
      thinkingLevel?: string | null;
      fastMode?: boolean | null;
      verboseLevel?: string | null;
      reasoningLevel?: string | null;
    };
    errorMessage: string;
  }) {
    const state = await this.ensureState(params.instanceId);
    const session = this.findSession(state, params.sessionId);
    if (!session) {
      throw new Error(`OpenClaw session not found: ${params.sessionId}`);
    }

    if (session.isDraft) {
      applySessionOverrideFields(
        session,
        params.patch as Record<string, unknown>,
      );
      session.updatedAt = this.now();
      state.snapshot.lastError = undefined;
      this.syncActiveSessionSeen(state.snapshot);
      this.sortSessions(state.snapshot);
      this.emit(params.instanceId);
      return this.getSnapshot(params.instanceId);
    }

    try {
      const result = await state.client.patchSession({
        key: params.sessionId,
        ...params.patch,
      });
      applySessionOverrideFields(
        session,
        params.patch as Record<string, unknown>,
      );
      applySessionOverrideFields(
        session,
        (result.resolved ?? null) as Record<string, unknown> | null,
      );
      session.updatedAt = this.now();
      state.snapshot.lastError = undefined;
      this.syncActiveSessionSeen(state.snapshot);
      this.sortSessions(state.snapshot);
      this.emit(params.instanceId);
      return this.getSnapshot(params.instanceId);
    } catch (error) {
      state.snapshot.lastError = this.toErrorMessage(error, params.errorMessage);
      this.emit(params.instanceId);
      throw error;
    }
  }

  private async persistSessionTitleLabelBestEffort(params: {
    state: InternalInstanceState;
    session: OpenClawGatewayChatSession;
  }) {
    const label = resolvePersistableSessionTitleLabel(params.session);
    if (!label) {
      return;
    }

    try {
      await params.state.client.patchSession({
        key: params.session.id,
        label,
      });
    } catch (error) {
      console.error('Failed to persist OpenClaw session title label:', error);
    }
  }

  async sendMessage(params: {
    instanceId: string;
    sessionId: string;
    content: string;
    model?: string;
    attachments?: StudioConversationAttachment[];
    requestText?: string;
  }) {
    const state = await this.ensureState(params.instanceId);
    const session = this.findSession(state, params.sessionId);
    if (!session) {
      throw new Error(`OpenClaw session not found: ${params.sessionId}`);
    }

    const requestedModel = params.model?.trim() || null;
    const effectiveDefaultModel = session.defaultModel || session.model;
    if (
      requestedModel &&
      requestedModel !== session.model &&
      requestedModel !== effectiveDefaultModel
    ) {
      await this.setSessionModel({
        instanceId: params.instanceId,
        sessionId: params.sessionId,
        model: requestedModel,
      });
    }

    const timestamp = this.now();
    const attachments = cloneAttachments(params.attachments);
    const outgoingAttachments = attachments ?? [];
    const outgoingText =
      params.requestText?.trim() ||
      composeOutgoingChatText(params.content, outgoingAttachments);
    const hadUserMessageBefore = session.messages.some((message) => message.role === 'user');
    const isFirstUserMessage = !hadUserMessageBefore;
    const userMessage = createGatewayMessage({
      id: createMessageId('msg'),
      role: 'user',
      content: params.content,
      transportText: outgoingText,
      timestamp,
      attachments,
      pendingDelivery: true,
    });

    session.messages = upsertSessionMessage(session.messages, userMessage);
    session.updatedAt = timestamp;
    session.model = requestedModel || session.model;
    session.title = deriveSessionTitle(
      session.title,
      params.content,
      outgoingAttachments,
      isFirstUserMessage,
    );
    if (isFirstUserMessage) {
      session.titleSource = 'firstUser';
    }
    syncGatewaySessionDerivedMessageState(session);
    state.snapshot.activeSessionId = session.id;
    state.snapshot.lastError = undefined;
    this.syncActiveSessionSeen(state.snapshot);
    this.sortSessions(state.snapshot);
    this.emit(params.instanceId);

    try {
      const runId = this.createRunId();
      const result = await state.client.sendChatMessage({
        sessionKey: session.id,
        message: outgoingText,
        deliver: false,
        idempotencyKey: runId,
        ...(outgoingAttachments.length > 0
          ? { attachments: buildGatewayAttachments(outgoingAttachments) }
          : {}),
      });
      const resolvedRunId = result.runId || runId;
      session.runId = resolvedRunId;
      const responseEvent = normalizeChatSendResponseEvent({
        response: result.response,
        sessionKey: session.id,
        runId: resolvedRunId,
      });
      if (responseEvent) {
        this.handleChatEvent(params.instanceId, responseEvent);
      }
      if (isFirstUserMessage) {
        await this.persistSessionTitleLabelBestEffort({
          state,
          session,
        });
      }
      this.emit(params.instanceId);
      return {
        runId: resolvedRunId,
      };
    } catch (error) {
      const errorMessage = this.toErrorMessage(error, 'Failed to send OpenClaw message.');
      const errorTimestamp = this.now();
      session.messages = upsertSessionMessage(
        session.messages,
        createGatewayMessage({
          id: createMessageId('assistant'),
          role: 'assistant',
          content: `Error: ${errorMessage}`,
          timestamp: errorTimestamp,
        }),
      );
      session.runId = null;
      session.updatedAt = errorTimestamp;
      syncGatewaySessionDerivedMessageState(session);
      this.syncActiveSessionSeen(state.snapshot);
      this.sortSessions(state.snapshot);
      state.snapshot.lastError = errorMessage;
      this.emit(params.instanceId);
      throw error;
    }
  }

  async abortRun(params: { instanceId: string; sessionId: string }) {
    const state = await this.ensureState(params.instanceId);
    const session = this.findSession(state, params.sessionId);
    if (!session) {
      return false;
    }

    try {
      await state.client.abortChatRun({
        sessionKey: params.sessionId,
        runId: session.runId ?? undefined,
      });
      await this.refreshSessionHistory(params.instanceId, params.sessionId);
      return true;
    } catch (error) {
      state.snapshot.lastError = this.toErrorMessage(error, 'Failed to abort OpenClaw response.');
      this.emit(params.instanceId);
      return false;
    }
  }

  async resetSession(params: { instanceId: string; sessionId: string }) {
    const state = await this.ensureState(params.instanceId);
    try {
      await state.client.resetSession({ key: params.sessionId });
      await this.refreshSessionHistory(params.instanceId, params.sessionId);
      return true;
    } catch (error) {
      state.snapshot.lastError = this.toErrorMessage(error, 'Failed to reset OpenClaw session.');
      this.emit(params.instanceId);
      return false;
    }
  }

  async startNewSession(params: {
    instanceId: string;
    agentId?: string | null;
    model?: string;
  }) {
    const state = await this.ensureState(params.instanceId);
    const sessionId = buildOpenClawMainSessionKey(params.agentId);
    const previousActiveSessionId = state.snapshot.activeSessionId;
    state.snapshot.activeSessionId = sessionId;
    state.snapshot.lastError = undefined;
    this.emit(params.instanceId);

    try {
      await state.client.resetSession({
        key: sessionId,
        reason: 'new',
      });
      await this.refreshInstance(params.instanceId, {
        preserveActiveSessionId: true,
        reloadActiveHistory: true,
      });
    } catch (error) {
      state.snapshot.activeSessionId = previousActiveSessionId;
      state.snapshot.lastError = this.toErrorMessage(
        error,
        'Failed to start a new OpenClaw session.',
      );
      this.emit(params.instanceId);
      return null;
    }

    const requestedModel = params.model?.trim() || null;
    const nextSession = this.getSnapshot(params.instanceId).sessions.find(
      (session) => session.id === sessionId,
    );
    const nextDefaultModel = nextSession?.defaultModel?.trim() || null;
    if (
      requestedModel &&
      nextSession &&
      requestedModel !== nextSession.model &&
      requestedModel !== nextDefaultModel
    ) {
      try {
        await this.setSessionModel({
          instanceId: params.instanceId,
          sessionId,
          model: requestedModel,
        });
      } catch {
        // setSessionModel already records the gateway error state for the UI
      }
    }

    return sessionId;
  }

  async deleteSession(params: { instanceId: string; sessionId: string }) {
    const state = await this.ensureState(params.instanceId);
    try {
      await state.client.deleteSession({
        key: params.sessionId,
        deleteTranscript: true,
      });
      state.snapshot.sessions = state.snapshot.sessions.filter(
        (session) => session.id !== params.sessionId,
      );
      state.snapshot.isEmptySnapshotAuthoritative =
        state.snapshot.sessions.length === 0;
      state.snapshot.activeSessionId = this.resolveActiveSessionId(
        state.snapshot,
        state.snapshot.activeSessionId === params.sessionId
          ? null
          : state.snapshot.activeSessionId,
      );
      state.snapshot.syncState = 'idle';
      this.syncActiveSessionSeen(state.snapshot);
      state.snapshot.lastError = undefined;
      this.emit(params.instanceId);
      await this.synchronizeSessionMessageSubscription(params.instanceId, state);
      await this.refreshInstance(params.instanceId, {
        preserveActiveSessionId: false,
        reloadActiveHistory: true,
      });
      return true;
    } catch (error) {
      state.snapshot.lastError = this.toErrorMessage(error, 'Failed to delete OpenClaw session.');
      this.emit(params.instanceId);
      return false;
    }
  }

  private async ensureState(instanceId: string) {
    const existing = this.instances.get(instanceId);
    if (existing) {
      if (existing.placeholderClient) {
        const client = await Promise.resolve(this.getClient(instanceId));
        this.bindClient(instanceId, existing, client);
        existing.placeholderClient = false;
      }
      return existing;
    }

    const client = await Promise.resolve(this.getClient(instanceId));
    const state: InternalInstanceState = {
      client,
      snapshot: createInitialSnapshot(),
      placeholderClient: false,
      subscribed: false,
      sessionsSubscribeUnsupported: false,
      sessionMessagesSubscribeUnsupported: false,
      subscribedSessionMessageKeys: new Set<string>(),
      pendingConnectInterrupts: new Set<() => void>(),
      refreshVersion: 0,
    };
    this.bindClient(instanceId, state, client);
    this.instances.set(instanceId, state);
    return state;
  }

  private getOrCreatePlaceholderState(instanceId: string) {
    const existing = this.instances.get(instanceId);
    if (existing) {
      return existing;
    }

    const state: InternalInstanceState = {
      client: {
        connect: async () => ({ type: 'hello-ok', protocol: 3 }),
        disconnect: () => {},
        subscribeSessions: async () => ({ ok: true }),
        subscribeSessionMessages: async ({ key }) => ({ subscribed: true, key }),
        unsubscribeSessionMessages: async ({ key }) => ({ subscribed: false, key }),
        listSessions: async () => ({
          ts: this.now(),
          path: '',
          count: 0,
          defaults: {},
          sessions: [],
        }),
        getChatHistory: async () => ({ messages: [], thinkingLevel: null }),
        listModels: async () => ({ models: [] }),
        patchSession: async () => ({ ok: true }),
        sendChatMessage: async () => ({ runId: this.createRunId() }),
        abortChatRun: async () => ({ aborted: true }),
        resetSession: async () => ({ ok: true }),
        deleteSession: async () => ({ ok: true }),
        on: () => () => {},
      },
      snapshot: createInitialSnapshot(),
      placeholderClient: true,
      subscribed: false,
      sessionsSubscribeUnsupported: false,
      sessionMessagesSubscribeUnsupported: false,
      subscribedSessionMessageKeys: new Set<string>(),
      pendingConnectInterrupts: new Set<() => void>(),
      refreshVersion: 0,
    };
    this.instances.set(instanceId, state);
    return state;
  }

  private bindClient(
    instanceId: string,
    state: InternalInstanceState,
    client: OpenClawGatewayClientLike,
  ) {
    state.offAgent?.();
    state.offChat?.();
    state.offConnection?.();
    state.offGap?.();
    state.offSessionMessage?.();
    state.offSessionsChanged?.();
    state.client = client;
    state.offAgent = client.on('agent', (payload: OpenClawGatewayAgentEvent) => {
      this.handleAgentEvent(instanceId, payload);
    });
    state.offChat = client.on('chat', (payload: OpenClawGatewayChatEvent) => {
      this.handleChatEvent(instanceId, payload);
    });
    state.offSessionMessage = client.on(
      'session.message',
      (payload: OpenClawGatewaySessionMessageEvent) => {
        this.handleSessionMessageEvent(instanceId, payload);
      },
    );
    state.offConnection = client.on('connection', (event: OpenClawGatewayConnectionEvent) => {
      state.snapshot.connectionStatus = event.status;
      if (event.status === 'connected') {
        state.snapshot.lastError = undefined;
      } else {
        const errorMessage = resolveConnectionEventErrorMessage(event);
        if (errorMessage) {
          state.snapshot.lastError = errorMessage;
        }
      }

      if (event.status === 'reconnecting' || event.status === 'disconnected') {
        state.subscribed = false;
        state.sessionsSubscribeUnsupported = false;
        state.sessionMessagesSubscribeUnsupported = false;
        state.subscribedSessionMessageKeys.clear();
        if (state.snapshot.syncState === 'loading') {
          state.snapshot.syncState = 'error';
          this.interruptPendingConnects(state);
        }
        this.emit(instanceId);
      }

      if (event.status === 'connecting') {
        this.emit(instanceId);
      }

      if (event.status === 'connected') {
        state.subscribed = false;
        state.sessionsSubscribeUnsupported = false;
        state.sessionMessagesSubscribeUnsupported = false;
        state.subscribedSessionMessageKeys.clear();
        if (state.snapshot.syncState === 'loading') {
          this.emit(instanceId);
          return;
        }

        this.emit(instanceId);
        void this.refreshInstance(instanceId, {
          preserveActiveSessionId: true,
          reloadActiveHistory: true,
        });
      }
    });
    state.offGap = client.on('gap', (_event: OpenClawGatewayGapEvent) => {
      if (state.snapshot.syncState === 'loading') {
        return;
      }

      void this.refreshInstance(instanceId, {
        preserveActiveSessionId: true,
        reloadActiveHistory: true,
      });
    });
    state.offSessionsChanged = client.on('sessions.changed', (payload: unknown) => {
      if (this.shouldIgnoreSessionsChangedRefresh(state, payload)) {
        return;
      }

      void this.refreshInstance(instanceId, {
        preserveActiveSessionId: true,
        reloadActiveHistory: true,
      });
    });
  }

  private async refreshInstance(
    instanceId: string,
    options: {
      preserveActiveSessionId: boolean;
      reloadActiveHistory: boolean;
    },
  ) {
    const state = await this.ensureState(instanceId);
    const refreshVersion = state.refreshVersion + 1;
    state.refreshVersion = refreshVersion;
    state.snapshot.syncState = 'loading';
    if (state.snapshot.connectionStatus === 'disconnected') {
      state.snapshot.connectionStatus = 'connecting';
    }
    state.snapshot.lastError = undefined;
    this.emit(instanceId);

    try {
      const connectResult = await this.waitForConnectResult(state);
      if (connectResult.kind === 'interrupted') {
        return this.getSnapshot(instanceId);
      }

      if (connectResult.kind === 'failed') {
        throw connectResult.error;
      }

      const hello = connectResult.hello;
      state.snapshot.connectionStatus = 'connected';
      const sessionsSubscribeSupport = resolveGatewayMethodSupport(hello, 'sessions.subscribe');
      if (sessionsSubscribeSupport === false) {
        state.sessionsSubscribeUnsupported = true;
        state.subscribed = false;
      } else if (sessionsSubscribeSupport === true) {
        state.sessionsSubscribeUnsupported = false;
      }

      const sessionMessageSupport = resolveSessionMessageSupport(hello);
      if (sessionMessageSupport === false) {
        state.sessionMessagesSubscribeUnsupported = true;
        state.subscribedSessionMessageKeys.clear();
      } else if (sessionMessageSupport === true) {
        state.sessionMessagesSubscribeUnsupported = false;
      }

      if (!state.subscribed && !state.sessionsSubscribeUnsupported) {
        try {
          await state.client.subscribeSessions();
          state.subscribed = true;
        } catch (error) {
          if (this.isSessionsSubscribeUnsupportedError(error)) {
            state.sessionsSubscribeUnsupported = true;
            state.subscribed = false;
          } else {
            throw error;
          }
        }
      }

      const result = await state.client.listSessions({
        includeGlobal: true,
        includeUnknown: true,
        includeDerivedTitles: true,
        includeLastMessage: true,
      });
      if (!this.isLatestRefresh(state, refreshVersion)) {
        return this.getSnapshot(instanceId);
      }

      const existingSessions = new Map(
        state.snapshot.sessions.map((session) => [session.id, session] as const),
      );
      const draftSessions = state.snapshot.sessions.filter(
        (session) => session.isDraft && !result.sessions.some((row) => row.key === session.id),
      );
      const nextSessions = result.sessions.map((row) => {
        const record = row as Record<string, unknown>;
        const existing = existingSessions.get(String(record.key));
        const rowTitleState = buildSessionTitleState(record);
        const rowLastMessagePreview = sanitizeChatSessionPreviewText({
          text: typeof record.lastMessagePreview === 'string' ? record.lastMessagePreview : undefined,
          kernelId: 'openclaw',
        });
        const updatedAt =
          typeof record.updatedAt === 'number' ? record.updatedAt : existing?.updatedAt ?? this.now();
        const resolvedModel =
          normalizeSessionModelRef({
            provider: typeof record.modelProvider === 'string' ? record.modelProvider : null,
            model: typeof record.model === 'string' ? record.model : null,
          }) ||
          normalizeSessionModelRef({
            provider: result.defaults.modelProvider,
            model: result.defaults.model,
          });
        const shouldKeepExistingTitle =
          rowTitleState.source !== 'explicit' &&
          (existing?.titleSource === 'firstUser' || existing?.titleSource === 'explicit') &&
          Boolean(existing?.title);

        const nextSession: OpenClawGatewayChatSession = {
          id: String(record.key),
          title: shouldKeepExistingTitle ? existing!.title : rowTitleState.title,
          createdAt: existing?.createdAt ?? updatedAt,
          updatedAt,
          lastSeenAt: existing?.lastSeenAt ?? null,
          messages: existing?.messages ?? [],
          model: resolvedModel || existing?.model || 'OpenClaw Gateway',
          defaultModel:
            existing?.defaultModel ??
            (resolvedModel || existing?.model || 'OpenClaw Gateway'),
          instanceId,
          transport: 'openclawGateway' as const,
          isDraft: existing?.isDraft && !result.sessions.some((entry) => entry.key === record.key)
            ? true
            : undefined,
          runId: existing?.runId ?? null,
          thinkingLevel: existing?.thinkingLevel ?? null,
          fastMode: existing?.fastMode ?? null,
          verboseLevel: existing?.verboseLevel ?? null,
          reasoningLevel: existing?.reasoningLevel ?? null,
          lastMessagePreview:
            rowLastMessagePreview ??
            sanitizeChatSessionPreviewText({
              text: existing?.lastMessagePreview,
              kernelId: 'openclaw',
            }),
          titleSource: shouldKeepExistingTitle ? existing?.titleSource : rowTitleState.source,
          historyState:
            existing?.historyState ??
            ((existing?.messages?.length ?? 0) > 0 ? 'ready' : 'idle'),
          sessionKind:
            typeof record.kind === 'string'
              ? record.kind
              : existing?.sessionKind ?? null,
        };
        applySessionOverrideFields(
          nextSession,
          record as Record<string, unknown>,
        );
        return nextSession satisfies OpenClawGatewayChatSession;
      });

      state.snapshot.sessions = [...nextSessions, ...draftSessions].map((session) => ({
        ...session,
        instanceId,
        transport: 'openclawGateway',
      }));
      this.sortSessions(state.snapshot);

      const nextActiveSessionId = this.resolveActiveSessionId(
        state.snapshot,
        options.preserveActiveSessionId ? state.snapshot.activeSessionId : null,
      );
      state.snapshot.activeSessionId = nextActiveSessionId;
      this.syncActiveSessionSeen(state.snapshot);
      state.snapshot.syncState = 'idle';
      state.snapshot.lastError = undefined;
      state.snapshot.isEmptySnapshotAuthoritative = result.sessions.length === 0;

      if (options.reloadActiveHistory && nextActiveSessionId) {
        const activeSession = state.snapshot.sessions.find(
          (session) => session.id === nextActiveSessionId,
        );
        if (activeSession && !activeSession.isDraft) {
          await this.refreshSessionHistory(instanceId, nextActiveSessionId, refreshVersion);
          if (!this.isLatestRefresh(state, refreshVersion)) {
            return this.getSnapshot(instanceId);
          }
        }
      }

      await this.synchronizeSessionMessageSubscription(instanceId, state, hello);
      this.emit(instanceId);
      void this.repairUnreadableSessionTitlesFromHistory(
        instanceId,
        state,
        refreshVersion,
      ).catch((error) => {
        console.error('Failed to repair OpenClaw session titles from history:', error);
      });
      return this.getSnapshot(instanceId);
    } catch (error) {
      state.snapshot.connectionStatus = 'disconnected';
      state.snapshot.syncState = 'error';
      state.snapshot.lastError = this.toErrorMessage(
        error,
        'Failed to synchronize OpenClaw sessions.',
      );
      this.emit(instanceId);
      return this.getSnapshot(instanceId);
    }
  }

  private shouldRepairSessionTitleFromHistory(session: OpenClawGatewayChatSession) {
    if (
      session.isDraft ||
      session.historyState === 'loading' ||
      session.historyState === 'ready' ||
      session.messages.some((message) => message.role === 'user')
    ) {
      return false;
    }

    return !isReadableChatSessionTitle(session.title);
  }

  private async repairUnreadableSessionTitlesFromHistory(
    instanceId: string,
    state: InternalInstanceState,
    refreshVersion: number,
  ) {
    const sessionsToRepair = state.snapshot.sessions
      .filter((session) => this.shouldRepairSessionTitleFromHistory(session))
      .slice(0, TITLE_REPAIR_HISTORY_LIMIT);

    for (const session of sessionsToRepair) {
      if (!this.isLatestRefresh(state, refreshVersion)) {
        return;
      }

      await this.refreshSessionHistory(instanceId, session.id, refreshVersion, {
        preserveLastMessagePreview: true,
        preserveSessionUpdatedAt: true,
      });
    }
  }

  private async refreshSessionHistory(
    instanceId: string,
    sessionId: string,
    refreshVersion?: number,
    options?: {
      preserveLocalUserMessages?: boolean;
      preserveLocalAssistantRunId?: string | null;
      preserveLocalMessagesFromIndex?: number | null;
      preserveRunId?: string | null;
      preferRemoteTerminalAssistantMessage?: boolean;
      preserveLastMessagePreview?: boolean;
      preserveSessionUpdatedAt?: boolean;
    },
  ) {
    const state = await this.ensureState(instanceId);
    const session = this.findSession(state, sessionId);
    if (session) {
      const previousHistoryState = session.historyState ?? 'idle';
      if (previousHistoryState !== 'loading') {
        session.historyState = 'loading';
        this.emit(instanceId);
      }
    }

    try {
      const historyMaxChars = await this.resolveHistoryMaxChars(instanceId);
      const requestSnapshot = this.captureSessionHistoryRequestSnapshot(state, sessionId);
      const history = await state.client.getChatHistory({
        sessionKey: sessionId,
        limit: 200,
        ...(historyMaxChars !== undefined ? { maxChars: historyMaxChars } : {}),
      });
      if (refreshVersion !== undefined && !this.isLatestRefresh(state, refreshVersion)) {
        return;
      }

      const session = this.findSession(state, sessionId);
      if (!session) {
        return;
      }
      const advancedSinceRequest =
        requestSnapshot &&
        this.hasSessionStateAdvancedSinceHistoryRequest(session, requestSnapshot);
      const effectiveOptions = advancedSinceRequest
        ? {
            preserveLocalUserMessages: true,
            preserveLocalAssistantRunId:
              options?.preserveLocalAssistantRunId ?? (session.runId?.trim() || null),
            preserveLocalMessagesFromIndex: requestSnapshot.messageCount,
            preserveRunId: options?.preserveRunId ?? (session.runId?.trim() || null),
            preferRemoteTerminalAssistantMessage:
              options?.preferRemoteTerminalAssistantMessage,
            preserveLastMessagePreview: options?.preserveLastMessagePreview,
          }
        : options;

      const titleSourceBeforeHistory = session.titleSource;
      const previousUpdatedAt = session.updatedAt;
      this.applyHistory(session, history, effectiveOptions);
      if (effectiveOptions?.preserveSessionUpdatedAt) {
        session.updatedAt = previousUpdatedAt;
      }
      const shouldPersistTitleLabel =
        titleSourceBeforeHistory !== 'firstUser' &&
        Boolean(resolvePersistableSessionTitleLabel(session));
      state.snapshot.syncState = 'idle';
      state.snapshot.lastError = undefined;
      this.syncActiveSessionSeen(state.snapshot);
      this.sortSessions(state.snapshot);
      await this.synchronizeSessionMessageSubscription(instanceId, state);
      if (shouldPersistTitleLabel) {
        await this.persistSessionTitleLabelBestEffort({
          state,
          session,
        });
      }
      this.emit(instanceId);
    } catch (error) {
      state.snapshot.syncState = 'error';
      const session = this.findSession(state, sessionId);
      if (session && isMissingOperatorReadScopeError(error)) {
        session.messages = [];
        session.historyState = 'error';
        syncGatewaySessionDerivedMessageStateWithOptions(session, {
          clearPreviewWhenMessagesEmpty: true,
        });
        state.snapshot.lastError = formatMissingOperatorReadScopeMessage('existing chat history');
      } else {
        if (session) {
          session.historyState = 'error';
        }
        state.snapshot.lastError = this.toErrorMessage(
          error,
          'Failed to load OpenClaw history.',
        );
      }
      this.emit(instanceId);
    }
  }

  private applyHistory(
    session: OpenClawGatewayChatSession,
    history: OpenClawGatewayChatHistoryResult,
    options?: {
      preserveLocalUserMessages?: boolean;
      preserveLocalAssistantRunId?: string | null;
      preserveLocalMessagesFromIndex?: number | null;
      preserveRunId?: string | null;
      preferRemoteTerminalAssistantMessage?: boolean;
      preserveLastMessagePreview?: boolean;
      preserveSessionUpdatedAt?: boolean;
    },
  ) {
    const baseTimestamp = this.now();
    const previousLastMessagePreview = options?.preserveLastMessagePreview
      ? sanitizeChatSessionPreviewText({
          text: session.lastMessagePreview,
          kernelId: 'openclaw',
        })
      : undefined;
    const remoteMessages = Array.isArray(history.messages)
      ? history.messages
          .map((message, index) => normalizeMessage(message, baseTimestamp + index, 'history'))
          .filter((message): message is OpenClawGatewayMessage => message !== null)
      : [];
    session.messages =
      options?.preserveLocalUserMessages || options?.preserveLocalAssistantRunId
        ? mergeHistoryWithLocalMessages(session.messages, remoteMessages, {
            preserveAssistantRunId: options?.preserveLocalAssistantRunId,
            preserveFromIndex: options?.preserveLocalMessagesFromIndex,
            preferRemoteTerminalAssistantMessage:
              options?.preferRemoteTerminalAssistantMessage,
          })
        : remoteMessages;
    applySessionOverrideFields(
      session,
      history as Record<string, unknown>,
    );
    session.runId =
      options && 'preserveRunId' in options
        ? options.preserveRunId ?? null
        : null;
    session.isDraft = false;
    session.historyState = 'ready';
    syncGatewaySessionDerivedMessageStateWithOptions(session, {
      clearPreviewWhenMessagesEmpty: true,
    });
    if (previousLastMessagePreview) {
      session.lastMessagePreview = previousLastMessagePreview;
    }
    if (session.messages.length > 0 && session.titleSource !== 'explicit') {
      const titleFromMessages = resolveReadableSessionTitleFromMessages(session.messages);
      if (titleFromMessages) {
        session.title = titleFromMessages;
        session.titleSource = 'firstUser';
      }
    }
  }

  private shouldIgnoreSessionsChangedRefresh(state: InternalInstanceState, payload: unknown) {
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    const record = payload as Record<string, unknown>;
    return (
      record.phase === 'message' &&
      typeof record.sessionKey === 'string' &&
      state.subscribedSessionMessageKeys.has(record.sessionKey)
    );
  }

  private async synchronizeSessionMessageSubscription(
    instanceId: string,
    state: InternalInstanceState,
    hello?: Pick<OpenClawGatewayHelloOk, 'features'> | null,
  ) {
    try {
      await this.syncSessionMessageSubscription(state, hello);
    } catch (error) {
      state.snapshot.lastError = this.toErrorMessage(
        error,
        'Failed to synchronize OpenClaw transcript updates.',
      );
      this.emit(instanceId);
    }
  }

  private async syncSessionMessageSubscription(
    state: InternalInstanceState,
    hello?: Pick<OpenClawGatewayHelloOk, 'features'> | null,
  ) {
    const support =
      hello === undefined ? null : resolveSessionMessageSupport(hello);
    if (support === false) {
      state.sessionMessagesSubscribeUnsupported = true;
      state.subscribedSessionMessageKeys.clear();
    } else if (support === true) {
      state.sessionMessagesSubscribeUnsupported = false;
    }

    if (state.sessionMessagesSubscribeUnsupported) {
      return;
    }

    const desiredKeys = state.snapshot.sessions
      .filter((session) => !session.isDraft)
      .map((session) => session.id);
    const desiredKeySet = new Set(desiredKeys);
    const subscribedKeys = [...state.subscribedSessionMessageKeys];

    for (const key of subscribedKeys) {
      if (desiredKeySet.has(key)) {
        continue;
      }

      try {
        await state.client.unsubscribeSessionMessages({ key });
      } catch (error) {
        if (!this.isSessionMessagesSubscribeUnsupportedError(error)) {
          throw error;
        }
        state.sessionMessagesSubscribeUnsupported = true;
        state.subscribedSessionMessageKeys.clear();
        return;
      }

      state.subscribedSessionMessageKeys.delete(key);
    }

    for (const key of desiredKeys) {
      if (state.subscribedSessionMessageKeys.has(key)) {
        continue;
      }

      try {
        await state.client.subscribeSessionMessages({ key });
      } catch (error) {
        if (!this.isSessionMessagesSubscribeUnsupportedError(error)) {
          throw error;
        }
        state.sessionMessagesSubscribeUnsupported = true;
        state.subscribedSessionMessageKeys.clear();
        return;
      }

      state.subscribedSessionMessageKeys.add(key);
    }
  }

  private handleSessionMessageEvent(
    instanceId: string,
    payload: OpenClawGatewaySessionMessageEvent,
  ) {
    const state = this.instances.get(instanceId);
    if (
      !state ||
      !payload?.sessionKey ||
      !state.subscribedSessionMessageKeys.has(payload.sessionKey)
    ) {
      return;
    }

    const session = this.findSession(state, payload.sessionKey);
    if (!session) {
      return;
    }

    const hadUserMessageBefore = session.messages.some((message) => message.role === 'user');
    const normalizedMessage = normalizeSessionMessage(payload, this.now());
    if (!normalizedMessage) {
      return;
    }
    const lastMessage = resolveGatewaySessionLastDisplayMessage(session) ?? undefined;
    if (
      shouldMergeTranscriptIntoActiveAssistant({
        sessionRunId:
          normalizedMessage.runId ?? session.runId ?? lastMessage?.runId ?? null,
        lastMessage,
        transcriptMessage: normalizedMessage,
      })
    ) {
      const mergedContent =
        normalizedMessage.content.length >= (lastMessage?.content.length ?? 0)
          ? normalizedMessage.content
          : lastMessage?.content ?? normalizedMessage.content;
      if (lastMessage) {
        lastMessage.id = normalizedMessage.id;
        if (typeof normalizedMessage.seq === 'number') {
          lastMessage.seq = normalizedMessage.seq;
        }
        lastMessage.content = mergedContent;
        lastMessage.timestamp = Math.max(lastMessage.timestamp, normalizedMessage.timestamp);
        if (normalizedMessage.senderLabel !== undefined) {
          lastMessage.senderLabel = normalizedMessage.senderLabel;
        }
        if (normalizedMessage.model) {
          lastMessage.model = normalizedMessage.model;
        }
        if (normalizedMessage.attachments) {
          lastMessage.attachments = cloneAttachments(normalizedMessage.attachments);
        }
        lastMessage.reasoning = normalizedMessage.reasoning;
        lastMessage.toolCards = cloneToolCards(normalizedMessage.toolCards);
      }
    } else {
      session.messages = upsertSessionMessage(session.messages, normalizedMessage);
    }
    session.updatedAt = Math.max(session.updatedAt, normalizedMessage.timestamp);
    session.isDraft = false;
    session.historyState = 'ready';

    const payloadRecord = payload as Record<string, unknown>;
    const resolvedModel = normalizeSessionModelRef({
      provider:
        typeof payloadRecord.modelProvider === 'string' ? payloadRecord.modelProvider : null,
      model: typeof payloadRecord.model === 'string' ? payloadRecord.model : null,
    });
    if (resolvedModel) {
      session.model = resolvedModel;
      session.defaultModel = session.defaultModel ?? resolvedModel;
    }
    applySessionOverrideFields(session, payloadRecord);
    syncGatewaySessionDerivedMessageState(session);
    if (!hadUserMessageBefore && normalizedMessage.role === 'user' && session.titleSource !== 'explicit') {
      session.title = deriveSessionTitle(
        DEFAULT_CHAT_SESSION_TITLE,
        normalizedMessage.content,
        normalizedMessage.attachments ?? [],
        true,
      );
      session.titleSource = 'firstUser';
    }

    this.syncActiveSessionSeen(state.snapshot);
    this.sortSessions(state.snapshot);
    this.emit(instanceId);
  }

  private handleAgentEvent(instanceId: string, payload: OpenClawGatewayAgentEvent) {
    const state = this.instances.get(instanceId);
    if (!state) {
      return;
    }

    const lifecycleEvent = parseOpenClawGatewayAgentLifecycleEvent({
      instanceId,
      kernelId: 'openclaw',
      payload,
    });
    if (lifecycleEvent) {
      this.emitAgentLifecycle(lifecycleEvent);
      this.emitAgentCatalogChanged(instanceId, payload, lifecycleEvent);
    } else if (shouldRefreshChatAgentCatalogForGatewayAgentEvent(payload)) {
      this.emitAgentCatalogChanged(instanceId, payload, null);
    }

    if (!payload?.sessionKey || payload.stream !== 'tool') {
      return;
    }

    const data =
      payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
        ? (payload.data as Record<string, unknown>)
        : null;
    const phase = typeof data?.phase === 'string' ? data.phase : null;
    const toolCallId = typeof data?.toolCallId === 'string' ? data.toolCallId.trim() : '';
    if (!phase || !toolCallId) {
      return;
    }

    const timestamp = this.now();
    let session = this.findSession(state, payload.sessionKey);
    let createdLiveSession = false;
    const existingMessageId = buildAgentToolMessageId({
      sessionKey: payload.sessionKey,
      runId: typeof payload.runId === 'string' ? payload.runId : null,
      toolCallId,
    });
    const existingMessage =
      session?.messages.find((message) => message.id === existingMessageId) ?? null;
    const toolMessage = buildAgentToolMessage({
      sessionKey: payload.sessionKey,
      runId: typeof payload.runId === 'string' ? payload.runId : null,
      timestamp,
      toolCallId,
      name: data?.name,
      args: phase === 'start' ? data?.args : undefined,
      result:
        phase === 'update'
          ? data?.partialResult
          : phase === 'result'
            ? data?.result
            : undefined,
      isError: data?.isError === true,
      existingMessage,
    });

    if (!session) {
      const createdSession = this.createLivePlaceholderSession({
        instanceId,
        state,
        sessionId: payload.sessionKey,
        timestamp,
        role: 'tool',
        content: toolMessage.content,
        attachments: undefined,
        toolCards: toolMessage.toolCards,
        payload: payload as Record<string, unknown>,
        isSilentAssistantMessage: false,
      });
      if (!createdSession) {
        return;
      }
      session = createdSession;
      createdLiveSession = true;
    }

    session.messages = upsertSessionMessage(session.messages, toolMessage);
    session.runId =
      typeof payload.runId === 'string' && payload.runId.trim()
        ? payload.runId
        : session.runId ?? null;
    session.updatedAt = Math.max(session.updatedAt, toolMessage.timestamp);
    session.isDraft = false;
    session.historyState = 'ready';
    syncGatewaySessionDerivedMessageState(session);

    this.syncActiveSessionSeen(state.snapshot);
    this.sortSessions(state.snapshot);
    this.emit(instanceId);
    if (createdLiveSession) {
      void this.synchronizeSessionMessageSubscription(instanceId, state);
    }
  }

  private handleChatEvent(instanceId: string, payload: OpenClawGatewayChatEvent) {
    const state = this.instances.get(instanceId);
    if (!state || !payload?.sessionKey) {
      return;
    }

    const timestamp = this.now();
    const messagePayload = resolveChatPayloadMessage(payload);
    const timestampPayload = messagePayload ?? payload;
    const messageTimestamp = normalizeTimestamp(timestampPayload, timestamp);
    const presentation = extractMessagePresentation(messagePayload);
    const content = presentation.text;
    const attachments = normalizeAttachments(messagePayload);
    const toolCards = cloneToolCards(presentation.toolCards);
    const payloadRole = presentation.role;
    const isSilentAssistantMessage = isSilentReplyAssistantPayload(messagePayload, content);
    const payloadRecord = payload as Record<string, unknown>;
    const hasRenderableMessage =
      !isSilentAssistantMessage &&
      (payloadRole === 'assistant' || payloadRole === 'tool') &&
      (Boolean(content) || Boolean(attachments?.length) || Boolean(toolCards?.length));
    let createdLiveSession = false;
    let session = this.findSession(state, payload.sessionKey);
    if (!session) {
      const createdSession = this.createLivePlaceholderSession({
        instanceId,
        state,
        sessionId: payload.sessionKey,
        timestamp,
        role: payloadRole,
        content,
        attachments,
        toolCards,
        payload: payloadRecord,
        isSilentAssistantMessage,
      });
      if (!createdSession) {
        return;
      }
      session = createdSession;
      createdLiveSession = true;
    }

    if (payloadRole === 'system') {
      if (
        payload.state === 'delta' ||
        (!content && !attachments?.length && !toolCards?.length)
      ) {
        return;
      }

      session.messages = upsertSessionMessage(
        session.messages,
        createGatewayMessage({
          id: resolveGatewayChatEventMessageId(payload, 'system'),
          role: 'system',
          content,
          timestamp: messageTimestamp,
          ...(typeof resolveGatewayChatEventMessageSeq(payload) === 'number'
            ? { seq: resolveGatewayChatEventMessageSeq(payload) }
            : {}),
          attachments,
          reasoning: presentation.reasoning,
          toolCards,
        }),
      );
      session.updatedAt = messageTimestamp;
      session.isDraft = false;
      session.historyState = 'ready';
      applySessionOverrideFields(session, payloadRecord);
      syncGatewaySessionDerivedMessageState(session);
      this.syncActiveSessionSeen(state.snapshot);
      this.sortSessions(state.snapshot);
      this.emit(instanceId);
      if (createdLiveSession) {
        void this.synchronizeSessionMessageSubscription(instanceId, state);
      }
      return;
    }

    const lastMessage = resolveGatewaySessionLastDisplayMessage(session);
    const activeRunId = normalizeComparableRunId(session.runId);
    const incomingRunId = normalizeComparableRunId(payload.runId);
    const isOtherRunEvent = Boolean(activeRunId && incomingRunId && activeRunId !== incomingRunId);

    if (isOtherRunEvent) {
      if (payload.state !== 'final') {
        return;
      }

      if (!hasRenderableMessage) {
        void this.refreshSessionHistory(instanceId, session.id, undefined, {
          preserveLocalUserMessages: true,
          preserveLocalAssistantRunId: activeRunId,
          preserveRunId: activeRunId,
        });
        return;
      }

      session.messages = upsertSessionMessage(
        session.messages,
        createGatewayMessage({
          id: createMessageId(payloadRole),
          role: payloadRole,
          content,
          timestamp: messageTimestamp,
          runId: incomingRunId ?? undefined,
          attachments,
          reasoning: presentation.reasoning,
          toolCards,
        }),
      );
      session.updatedAt = messageTimestamp;
      session.isDraft = false;
      session.historyState = 'ready';
      syncGatewaySessionDerivedMessageState(session);
      this.syncActiveSessionSeen(state.snapshot);
      this.sortSessions(state.snapshot);
      this.emit(instanceId);
      if (createdLiveSession) {
        void this.synchronizeSessionMessageSubscription(instanceId, state);
      }
      return;
    }

    if (payload.state === 'delta') {
      if (!hasRenderableMessage) {
        return;
      }

      const comparableRunId = incomingRunId ?? activeRunId;
      const shouldMergeIntoLastMessage = Boolean(
        lastMessage &&
          shouldMergeAssistantRunPayloadIntoLastMessage({
            lastMessage,
            comparableRunId,
            payloadRole,
            toolCards,
          }),
      );
      if (
        shouldMergeIntoLastMessage &&
        lastMessage
      ) {
        if (!lastMessage.content || content.length >= lastMessage.content.length) {
          lastMessage.content = content;
        }
        lastMessage.timestamp = messageTimestamp;
        if (attachments) {
          lastMessage.attachments = attachments;
        }
        lastMessage.reasoning = presentation.reasoning;
        lastMessage.toolCards = toolCards;
        session.messages = normalizeGatewaySessionMessages(session.messages);
      } else {
        session.messages = upsertSessionMessage(
          session.messages,
          createGatewayMessage({
            id: createMessageId(payloadRole),
            role: payloadRole,
            content,
            timestamp: messageTimestamp,
            runId: comparableRunId ?? undefined,
            attachments,
            reasoning: presentation.reasoning,
            toolCards,
          }),
        );
      }
      session.runId = incomingRunId ?? session.runId ?? null;
      session.updatedAt = messageTimestamp;
      session.isDraft = false;
      session.historyState = 'ready';
      applySessionOverrideFields(session, payloadRecord);
      syncGatewaySessionDerivedMessageState(session);
      this.syncActiveSessionSeen(state.snapshot);
      this.sortSessions(state.snapshot);
      this.emit(instanceId);
      if (createdLiveSession) {
        void this.synchronizeSessionMessageSubscription(instanceId, state);
        void this.refreshSessionHistory(instanceId, session.id, undefined, {
          preserveLocalAssistantRunId: incomingRunId,
          preserveRunId: incomingRunId,
        });
      }
      return;
    }

    if (payload.state === 'final' || payload.state === 'aborted') {
      const terminalRunId = incomingRunId ?? activeRunId;
      const shouldMergeIntoLastMessage = Boolean(
        lastMessage &&
          shouldMergeAssistantRunPayloadIntoLastMessage({
            lastMessage,
            comparableRunId: terminalRunId,
            payloadRole,
            toolCards,
          }),
      );
      if (
        hasRenderableMessage &&
        shouldMergeIntoLastMessage &&
        lastMessage
      ) {
        lastMessage.content = content;
        lastMessage.timestamp = messageTimestamp;
        lastMessage.attachments = attachments;
        lastMessage.reasoning = presentation.reasoning;
        lastMessage.toolCards = toolCards;
        session.messages = normalizeGatewaySessionMessages(session.messages);
      } else if (hasRenderableMessage) {
        session.messages = upsertSessionMessage(
          session.messages,
          createGatewayMessage({
            id: createMessageId(payloadRole),
            role: payloadRole,
            content,
            timestamp: messageTimestamp,
            runId: terminalRunId ?? undefined,
            attachments,
            reasoning: presentation.reasoning,
            toolCards,
          }),
        );
      }
      session.runId = null;
      session.isDraft = false;
      session.updatedAt = messageTimestamp;
      session.historyState = 'ready';
      applySessionOverrideFields(session, payloadRecord);
      syncGatewaySessionDerivedMessageState(session);
      this.syncActiveSessionSeen(state.snapshot);
      this.sortSessions(state.snapshot);
      this.emit(instanceId);
      if (createdLiveSession) {
        void this.synchronizeSessionMessageSubscription(instanceId, state);
      }
      void this.refreshSessionHistory(instanceId, session.id, undefined, {
        preserveLocalUserMessages: true,
        preserveLocalAssistantRunId: terminalRunId,
        preferRemoteTerminalAssistantMessage: payload.state === 'final',
      });
      return;
    }

    if (payload.state === 'error') {
      const failedRunId = incomingRunId ?? activeRunId;
      const errorMessage = resolveGatewayRunErrorMessage(payload.errorMessage);
      const assistantMessageIndex = findLatestAssistantMessageIndexForRun(
        session.messages,
        failedRunId,
      );
      if (assistantMessageIndex >= 0) {
        const nextMessages = [...session.messages];
        const targetMessage = nextMessages[assistantMessageIndex]!;
        nextMessages[assistantMessageIndex] = {
          ...targetMessage,
          content: appendGatewayAssistantErrorContent(
            targetMessage.content,
            errorMessage,
          ),
          timestamp: messageTimestamp,
        };
        session.messages = normalizeGatewaySessionMessages(nextMessages);
      } else {
        session.messages = upsertSessionMessage(
          session.messages,
          createGatewayMessage({
            id: createMessageId('assistant'),
            role: 'assistant',
            content: errorMessage,
            timestamp: messageTimestamp,
            runId: failedRunId ?? undefined,
          }),
        );
      }
      session.runId = null;
      session.updatedAt = messageTimestamp;
      session.historyState = 'error';
      syncGatewaySessionDerivedMessageState(session);
      state.snapshot.lastError =
        normalizeGatewayErrorMessage(payload.errorMessage) || 'OpenClaw chat error.';
      this.syncActiveSessionSeen(state.snapshot);
      this.emit(instanceId);
      if (createdLiveSession) {
        void this.synchronizeSessionMessageSubscription(instanceId, state);
      }
    }
  }

  private createLivePlaceholderSession(params: {
    instanceId: string;
    state: InternalInstanceState;
    sessionId: string;
    timestamp: number;
    role: OpenClawGatewayRole;
    content: string;
    attachments: StudioConversationAttachment[] | undefined;
    toolCards: OpenClawToolCard[] | undefined;
    payload: Record<string, unknown>;
    isSilentAssistantMessage: boolean;
  }) {
    const hasRenderableContent =
      Boolean(params.content) ||
      Boolean(params.attachments?.length) ||
      Boolean(params.toolCards?.length);
    if (!hasRenderableContent || params.isSilentAssistantMessage) {
      return null;
    }

    const resolvedModel = normalizeSessionModelRef({
      provider:
        typeof params.payload.modelProvider === 'string'
          ? params.payload.modelProvider
          : null,
      model: typeof params.payload.model === 'string' ? params.payload.model : null,
    });
    const session: OpenClawGatewayChatSession = {
      id: params.sessionId,
      title:
        params.role === 'user'
          ? deriveSessionTitle(
              DEFAULT_CHAT_SESSION_TITLE,
              params.content,
              params.attachments ?? [],
              true,
            )
          : DEFAULT_CHAT_SESSION_TITLE,
      createdAt: params.timestamp,
      updatedAt: params.timestamp,
      lastSeenAt: params.state.snapshot.activeSessionId ? null : params.timestamp,
      messages: [],
      model: resolvedModel ?? '',
      defaultModel: resolvedModel ?? null,
      instanceId: params.instanceId,
      transport: 'openclawGateway',
      isDraft: false,
      runId: null,
      thinkingLevel: null,
      fastMode: null,
      verboseLevel: null,
      reasoningLevel: null,
      lastMessagePreview: resolveMessagePreview({
        content: params.content,
        attachments: params.attachments,
        toolCards: params.toolCards,
      }),
      titleSource: params.role === 'user' ? 'firstUser' : 'default',
      historyState: 'ready',
    };
    applySessionOverrideFields(session, params.payload);

    params.state.snapshot.sessions = [session, ...params.state.snapshot.sessions];
    if (!params.state.snapshot.activeSessionId) {
      params.state.snapshot.activeSessionId = session.id;
    }
    return session;
  }

  private syncActiveSessionSeen(snapshot: OpenClawGatewayInstanceSnapshot) {
    if (!snapshot.activeSessionId) {
      return;
    }

    const activeSession = snapshot.sessions.find(
      (session) => session.id === snapshot.activeSessionId,
    );
    if (!activeSession) {
      return;
    }

    markGatewaySessionSeen(activeSession);
  }

  private resolveActiveSessionId(
    snapshot: OpenClawGatewayInstanceSnapshot,
    preservedSessionId: string | null,
  ) {
    if (preservedSessionId && snapshot.sessions.some((session) => session.id === preservedSessionId)) {
      return preservedSessionId;
    }

    return (
      snapshot.sessions.find((session) => isAnyOpenClawMainSession(session.id))?.id ??
      snapshot.sessions[0]?.id ??
      null
    );
  }

  private findSession(state: InternalInstanceState, sessionId: string) {
    return state.snapshot.sessions.find((session) => session.id === sessionId);
  }

  private captureSessionHistoryRequestSnapshot(
    state: InternalInstanceState,
    sessionId: string,
  ): SessionHistoryRequestSnapshot | null {
    const session = this.findSession(state, sessionId);
    if (!session) {
      return null;
    }

    return {
      updatedAt: session.updatedAt,
      runId: session.runId?.trim() || null,
      messageCount: session.messages.length,
    };
  }

  private hasSessionStateAdvancedSinceHistoryRequest(
    session: OpenClawGatewayChatSession,
    snapshot: SessionHistoryRequestSnapshot,
  ) {
    return (
      session.updatedAt !== snapshot.updatedAt ||
      (session.runId?.trim() || null) !== snapshot.runId ||
      session.messages.length !== snapshot.messageCount
    );
  }

  private isLatestRefresh(state: InternalInstanceState, refreshVersion: number) {
    return state.refreshVersion === refreshVersion;
  }

  private async waitForConnectResult(state: InternalInstanceState): Promise<PendingConnectResult> {
    const connectAttempt: Promise<PendingConnectResult> = Promise.resolve()
      .then(() => state.client.connect())
      .then((hello) => ({
        kind: 'connected' as const,
        hello,
      }))
      .catch((error): PendingConnectResult => ({
        kind: 'failed' as const,
        error,
      }));

    let interrupt!: () => void;
    const interruptPromise = new Promise<PendingConnectResult>((resolve) => {
      interrupt = () => resolve({ kind: 'interrupted' });
    });
    state.pendingConnectInterrupts.add(interrupt);

    try {
      return await Promise.race([connectAttempt, interruptPromise]);
    } finally {
      state.pendingConnectInterrupts.delete(interrupt);
    }
  }

  private interruptPendingConnects(state: InternalInstanceState) {
    if (state.pendingConnectInterrupts.size === 0) {
      return;
    }

    const interrupts = [...state.pendingConnectInterrupts];
    state.pendingConnectInterrupts.clear();
    for (const interrupt of interrupts) {
      interrupt();
    }
  }

  private sortSessions(snapshot: OpenClawGatewayInstanceSnapshot) {
    snapshot.sessions.sort((left, right) => right.updatedAt - left.updatedAt);
  }

  private emit(instanceId: string) {
    const snapshot = this.getSnapshot(instanceId);
    for (const listener of this.listeners) {
      listener(instanceId, snapshot);
    }
  }

  private emitAgentCatalogChanged(
    instanceId: string,
    payload: OpenClawGatewayAgentEvent | Record<string, unknown>,
    lifecycleEvent?: KernelAgentLifecycleEvent | null,
  ) {
    const event = {
      instanceId,
      payload,
      lifecycleEvent,
    };
    for (const listener of this.agentCatalogListeners) {
      listener(event);
    }
  }

  private emitAgentLifecycle(event: KernelAgentLifecycleEvent) {
    for (const listener of this.agentLifecycleListeners) {
      listener(event);
    }
  }

  private toErrorMessage(error: unknown, fallback: string) {
    const formatted = formatGatewayConnectError(error);
    if (formatted) {
      return formatted;
    }

    return fallback;
  }

  private isSessionsSubscribeUnsupportedError(error: unknown) {
    return isGatewayMethodUnavailableError(error, 'sessions.subscribe');
  }

  private isSessionMessagesSubscribeUnsupportedError(error: unknown) {
    return (
      isGatewayMethodUnavailableError(error, 'sessions.messages.subscribe') ||
      isGatewayMethodUnavailableError(error, 'sessions.messages.unsubscribe')
    );
  }
}
