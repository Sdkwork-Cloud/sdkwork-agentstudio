export const OPENCLAW_GATEWAY_PROTOCOL_VERSION = 3;

export type OpenClawGatewayAuthRole = 'operator' | 'node';

export type OpenClawGatewayRequestFrame = {
  type: 'req';
  id: string;
  method: string;
  params?: unknown;
};

export type OpenClawGatewayResponseFrame = {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

export type OpenClawGatewayEventFrame = {
  type: 'event';
  event: string;
  payload?: unknown;
  seq?: number;
  stateVersion?: {
    presence?: number;
    health?: number;
  };
};

export type OpenClawGatewayHelloOk = {
  type: 'hello-ok';
  protocol: number;
  server?: {
    version?: string;
    connId?: string;
  };
  features?: {
    methods?: string[];
    events?: string[];
  };
  canvasHostUrl?: string;
  auth?: {
    deviceToken?: string;
    role?: string;
    scopes?: string[];
    issuedAtMs?: number;
  };
  policy?: {
    maxPayload?: number;
    maxBufferedBytes?: number;
    tickIntervalMs?: number;
  };
  snapshot?: unknown;
};

export type OpenClawGatewayChatEvent = {
  runId?: string;
  sessionKey: string;
  seq?: number;
  state: 'delta' | 'final' | 'aborted' | 'error';
  message?: unknown;
  errorMessage?: string;
  usage?: unknown;
  stopReason?: string;
};

export type OpenClawGatewayAgentToolEventData = {
  phase?: 'start' | 'update' | 'result' | string;
  toolCallId?: string;
  name?: string;
  args?: unknown;
  partialResult?: unknown;
  result?: unknown;
  isError?: boolean;
  [key: string]: unknown;
};

export type OpenClawGatewayAgentEvent = {
  sessionKey: string;
  runId?: string;
  stream?: string;
  data?: OpenClawGatewayAgentToolEventData | Record<string, unknown>;
  [key: string]: unknown;
};

export type OpenClawGatewaySessionMessageEvent = {
  sessionKey: string;
  message?: unknown;
  messageId?: string;
  messageSeq?: number;
  modelProvider?: string | null;
  model?: string | null;
  thinkingLevel?: string | null;
  fastMode?: boolean | null;
  verboseLevel?: string | null;
  reasoningLevel?: string | null;
  parentSessionKey?: string | null;
  spawnedBy?: unknown;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  responseUsage?: unknown;
  [key: string]: unknown;
};

export type OpenClawGatewaySessionsDefaults = {
  modelProvider?: string | null;
  model?: string | null;
  contextTokens?: number | null;
};

export type OpenClawGatewaySessionRow = {
  key: string;
  kind: 'direct' | 'group' | 'global' | 'unknown' | string;
  label?: string;
  displayName?: string;
  derivedTitle?: string;
  lastMessagePreview?: string;
  updatedAt?: number | null;
  sessionId?: string | null;
  thinkingLevel?: string | null;
  fastMode?: boolean | null;
  verboseLevel?: string | null;
  reasoningLevel?: string | null;
  model?: string | null;
  modelProvider?: string | null;
  contextTokens?: number | null;
  totalTokens?: number;
  systemSent?: boolean | null;
  abortedLastRun?: boolean | null;
  elevatedLevel?: boolean | null;
};

export type OpenClawGatewaySessionsListResult = {
  ts: number;
  path: string;
  count: number;
  defaults: OpenClawGatewaySessionsDefaults;
  sessions: OpenClawGatewaySessionRow[];
};

export type OpenClawGatewayChatHistoryResult = {
  messages?: unknown[];
  thinkingLevel?: string | null;
  fastMode?: boolean | null;
  verboseLevel?: string | null;
  reasoningLevel?: string | null;
};

export type OpenClawGatewayModelEntry = {
  id?: string;
  name?: string;
  provider?: string;
  model?: string;
  label?: string;
  title?: string;
  contextWindow?: number | null;
};

export type OpenClawGatewayModelsListResult = {
  models: OpenClawGatewayModelEntry[];
};

export type OpenClawGatewaySessionsPatchResult = {
  ok?: boolean;
  path?: string;
  key?: string;
  entry?: unknown;
  resolved?: {
    modelProvider?: string | null;
    model?: string | null;
    thinkingLevel?: string | null;
    fastMode?: boolean | null;
    verboseLevel?: string | null;
    reasoningLevel?: string | null;
    contextTokens?: number | null;
  };
};

export type OpenClawGatewayErrorInfo = {
  code: string;
  message: string;
  details?: unknown;
};

export class OpenClawGatewayRequestError extends Error {
  readonly gatewayCode: string;
  readonly details?: unknown;

  constructor(error: OpenClawGatewayErrorInfo) {
    super(error.message);
    this.name = 'OpenClawGatewayRequestError';
    this.gatewayCode = error.code;
    this.details = error.details;
  }
}

export function buildDeviceAuthPayload(params: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: OpenClawGatewayAuthRole;
  scopes: string[];
  signedAtMs: number;
  token?: string | null;
  nonce: string;
}) {
  return [
    'v2',
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    params.scopes.join(','),
    String(params.signedAtMs),
    params.token ?? '',
    params.nonce,
  ].join('|');
}

export function readConnectErrorDetailCode(details: unknown): string | null {
  if (!details || typeof details !== 'object' || Array.isArray(details)) {
    return null;
  }

  const code = (details as { code?: unknown }).code;
  return typeof code === 'string' && code.trim() ? code : null;
}

export function readConnectErrorRecoveryAdvice(details: unknown): {
  canRetryWithDeviceToken?: boolean;
  recommendedNextStep?: string;
} {
  if (!details || typeof details !== 'object' || Array.isArray(details)) {
    return {
      canRetryWithDeviceToken: undefined,
      recommendedNextStep: undefined,
    };
  }

  const record = details as {
    canRetryWithDeviceToken?: unknown;
    recommendedNextStep?: unknown;
  };

  return {
    canRetryWithDeviceToken:
      typeof record.canRetryWithDeviceToken === 'boolean'
        ? record.canRetryWithDeviceToken
        : undefined,
    recommendedNextStep:
      typeof record.recommendedNextStep === 'string'
        ? record.recommendedNextStep
        : undefined,
  };
}

export function resolveGatewayErrorDetailCode(
  error: { details?: unknown } | null | undefined,
): string | null {
  return readConnectErrorDetailCode(error?.details);
}

export function resolveGatewayMethodSupport(
  hello: Pick<OpenClawGatewayHelloOk, 'features'> | null | undefined,
  method: string,
): boolean | null {
  const methods = hello?.features?.methods;
  if (!Array.isArray(methods)) {
    return null;
  }

  return methods.includes(method);
}

export function resolveGatewayEventSupport(
  hello: Pick<OpenClawGatewayHelloOk, 'features'> | null | undefined,
  event: string,
): boolean | null {
  const events = hello?.features?.events;
  if (!Array.isArray(events)) {
    return null;
  }

  return events.includes(event);
}

export function isGatewayMethodUnavailableError(error: unknown, method: string) {
  const normalizedMethod = method.trim().toLowerCase();
  if (!normalizedMethod) {
    return false;
  }

  const message =
    error instanceof OpenClawGatewayRequestError
      ? error.message
      : error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : '';
  const normalizedMessage = message.trim().toLowerCase();
  if (!normalizedMessage || !normalizedMessage.includes(normalizedMethod)) {
    return false;
  }

  return (
    normalizedMessage.includes('unknown method') ||
    normalizedMessage.includes('method not found') ||
    normalizedMessage.includes('no such method') ||
    normalizedMessage.includes('not supported') ||
    normalizedMessage.includes('unsupported')
  );
}

const NON_RECOVERABLE_AUTH_CODES = new Set([
  'AUTH_TOKEN_MISSING',
  'AUTH_BOOTSTRAP_TOKEN_INVALID',
  'AUTH_PASSWORD_MISSING',
  'AUTH_PASSWORD_MISMATCH',
  'AUTH_RATE_LIMITED',
  'PAIRING_REQUIRED',
  'CONTROL_UI_DEVICE_IDENTITY_REQUIRED',
  'DEVICE_IDENTITY_REQUIRED',
]);

export function isNonRecoverableAuthError(error: OpenClawGatewayErrorInfo | undefined) {
  if (!error) {
    return false;
  }

  const detailCode = resolveGatewayErrorDetailCode(error);
  return detailCode ? NON_RECOVERABLE_AUTH_CODES.has(detailCode) : false;
}
