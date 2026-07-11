import { resolveBrowserStorage } from '@sdkwork/agentstudio-pc-infrastructure';
import { base64UrlDecode, base64UrlEncode } from '@sdkwork/utils/encoding';
import { sha256Hash } from '@sdkwork/utils/crypto';
import { uuid } from '@sdkwork/utils/id';
import {
  buildDeviceAuthPayload,
  isNonRecoverableAuthError,
  OPENCLAW_GATEWAY_PROTOCOL_VERSION,
  type OpenClawGatewayAgentEvent,
  OpenClawGatewayRequestError,
  readConnectErrorRecoveryAdvice,
  resolveGatewayErrorDetailCode,
  type OpenClawGatewayAuthRole,
  type OpenClawGatewayChatEvent,
  type OpenClawGatewayChatHistoryResult,
  type OpenClawGatewayErrorInfo,
  type OpenClawGatewayEventFrame,
  type OpenClawGatewayHelloOk,
  type OpenClawGatewayModelsListResult,
  type OpenClawGatewayRequestFrame,
  type OpenClawGatewayResponseFrame,
  type OpenClawGatewaySessionMessageEvent,
  type OpenClawGatewaySessionsPatchResult,
  type OpenClawGatewaySessionsListResult,
} from './gatewayProtocol.ts';

type StorageLike = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;

type WebSocketLike = Pick<WebSocket, 'addEventListener' | 'close' | 'readyState' | 'send'>;

type PendingRequest = {
  resolve: (value: any) => void;
  reject: (error: unknown) => void;
};

type ConnectionWaiter = {
  resolve: (hello: OpenClawGatewayHelloOk) => void;
  reject: (error: unknown) => void;
};

type ListenerMap = {
  agent: (event: OpenClawGatewayAgentEvent) => void;
  connection: (event: OpenClawGatewayConnectionEvent) => void;
  chat: (event: OpenClawGatewayChatEvent) => void;
  gap: (event: OpenClawGatewayGapEvent) => void;
  'session.message': (payload: OpenClawGatewaySessionMessageEvent) => void;
  'sessions.changed': (payload: unknown) => void;
};

type ListenerKey = keyof ListenerMap;

type StoredDeviceIdentity = {
  version: 1;
  deviceId: string;
  publicKey: string;
  privateKeyPkcs8: string;
  createdAtMs: number;
};

type StoredDeviceAuthStore = {
  version: 1;
  tokens: Record<
    string,
    {
      token: string;
      scopes?: string[];
      updatedAtMs: number;
    }
  >;
};

type DeviceIdentityRecord = {
  deviceId: string;
  publicKey: string;
  sign: (payload: string) => Promise<string>;
};

type SelectedConnectAuth = {
  authToken?: string;
  authDeviceToken?: string;
  authPassword?: string;
  resolvedDeviceToken?: string;
  storedToken?: string;
  canFallbackToShared: boolean;
};

export interface OpenClawGatewayDeviceIdentityProvider {
  loadOrCreate: () => Promise<DeviceIdentityRecord | null>;
}

export interface OpenClawGatewayClientOptions {
  url: string;
  authToken?: string | null;
  password?: string | null;
  instanceId?: string;
  clientId?: string;
  clientVersion?: string;
  platform?: string;
  locale?: string;
  userAgent?: string;
  reconnect?: boolean;
  reconnectBaseMs?: number;
  reconnectMaxMs?: number;
  connectTimeoutMs?: number;
  createRequestId?: () => string;
  now?: () => number;
  storage?: StorageLike | null;
  webSocketFactory?: (url: string) => WebSocketLike;
  deviceIdentityProvider?: OpenClawGatewayDeviceIdentityProvider;
}

export type OpenClawGatewayConnectionEvent =
  | {
      status: 'connecting' | 'connected' | 'disconnected';
      hello?: OpenClawGatewayHelloOk;
      code?: number;
      reason?: string;
      error?: OpenClawGatewayErrorInfo;
    }
  | {
      status: 'reconnecting';
      code?: number;
      reason?: string;
      error?: OpenClawGatewayErrorInfo;
      delayMs: number;
    };

export type OpenClawGatewayGapEvent = {
  expected: number;
  received: number;
};

const DEFAULT_CLIENT_ID = 'openclaw-control-ui';
const DEFAULT_CLIENT_MODE = 'webchat';
const DEFAULT_ROLE: OpenClawGatewayAuthRole = 'operator';
const DEFAULT_SCOPES = [
  'operator.admin',
  'operator.read',
  'operator.write',
  'operator.approvals',
  'operator.pairing',
];
const DEFAULT_CAPS = ['tool-events'];
const CONNECT_FAILED_CLOSE_CODE = 4008;
const SOCKET_OPEN = 1;
const DEVICE_IDENTITY_STORAGE_KEY = 'agent-studio.openclaw.device-identity.v1';
const DEVICE_TOKEN_STORAGE_KEY = 'agent-studio.openclaw.device-token.v1';

function resolveStorage(override: StorageLike | null | undefined) {
  if (override !== undefined) {
    return override;
  }

  return resolveBrowserStorage('localStorage');
}

function createDefaultRequestId() {
  return uuid();
}

function trimToUndefined(value: string | null | undefined) {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function safeReadJson<T>(storage: StorageLike | null, key: string) {
  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function safeWriteJson(storage: StorageLike | null, key: string, value: unknown) {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // best effort only
  }
}

function readStoredDeviceToken(
  storage: StorageLike | null,
  deviceId: string,
  role: OpenClawGatewayAuthRole,
) {
  const store = safeReadJson<StoredDeviceAuthStore>(storage, DEVICE_TOKEN_STORAGE_KEY);
  if (!store || store.version !== 1 || !store.tokens || typeof store.tokens !== 'object') {
    return null;
  }

  const entry = store.tokens[`${deviceId}:${role}`];
  if (!entry || typeof entry.token !== 'string' || !entry.token.trim()) {
    return null;
  }

  return {
    token: entry.token,
    scopes: Array.isArray(entry.scopes) ? entry.scopes : [],
  };
}

function writeStoredDeviceToken(
  storage: StorageLike | null,
  params: {
    deviceId: string;
    role: OpenClawGatewayAuthRole;
    token: string;
    scopes?: string[];
    updatedAtMs: number;
  },
) {
  const current =
    safeReadJson<StoredDeviceAuthStore>(storage, DEVICE_TOKEN_STORAGE_KEY) ?? {
      version: 1,
      tokens: {},
    };

  current.tokens[`${params.deviceId}:${params.role}`] = {
    token: params.token,
    scopes: params.scopes,
    updatedAtMs: params.updatedAtMs,
  };

  safeWriteJson(storage, DEVICE_TOKEN_STORAGE_KEY, current);
}

function clearStoredDeviceToken(
  storage: StorageLike | null,
  params: {
    deviceId: string;
    role: OpenClawGatewayAuthRole;
  },
) {
  const current = safeReadJson<StoredDeviceAuthStore>(storage, DEVICE_TOKEN_STORAGE_KEY);
  if (!current || current.version !== 1 || !current.tokens || typeof current.tokens !== 'object') {
    return;
  }

  delete current.tokens[`${params.deviceId}:${params.role}`];
  safeWriteJson(storage, DEVICE_TOKEN_STORAGE_KEY, current);
}

function isTrustedRetryEndpoint(url: string) {
  try {
    const locationHref = trimToUndefined(globalThis.location?.href);
    const gatewayUrl = new URL(url, locationHref ?? 'http://127.0.0.1/');
    const host = gatewayUrl.hostname.trim().toLowerCase();
    const isLoopbackHost =
      host === 'localhost' || host === '::1' || host === '[::1]' || host === '127.0.0.1';
    const isLoopbackIPv4 = host.startsWith('127.');
    if (isLoopbackHost || isLoopbackIPv4) {
      return true;
    }

    if (!locationHref) {
      return false;
    }

    const pageUrl = new URL(locationHref);
    return gatewayUrl.host === pageUrl.host;
  } catch {
    return false;
  }
}

class DefaultDeviceIdentityProvider implements OpenClawGatewayDeviceIdentityProvider {
  private readonly storage: StorageLike | null;
  private readonly now: () => number;

  constructor(storage: StorageLike | null, now: () => number) {
    this.storage = storage;
    this.now = now;
  }

  async loadOrCreate() {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) {
      return null;
    }

    const stored = safeReadJson<StoredDeviceIdentity>(this.storage, DEVICE_IDENTITY_STORAGE_KEY);
    if (
      stored?.version === 1 &&
      typeof stored.deviceId === 'string' &&
      typeof stored.publicKey === 'string' &&
      typeof stored.privateKeyPkcs8 === 'string'
    ) {
      return this.buildRecord(stored);
    }

    try {
      const keyPair = (await subtle.generateKey(
        'Ed25519',
        true,
        ['sign', 'verify'],
      )) as CryptoKeyPair;
      const rawPublicKey = new Uint8Array(await subtle.exportKey('raw', keyPair.publicKey));
      const privateKeyPkcs8 = new Uint8Array(
        await subtle.exportKey('pkcs8', keyPair.privateKey),
      );
      const identity: StoredDeviceIdentity = {
        version: 1,
        deviceId: sha256Hash(rawPublicKey),
        publicKey: base64UrlEncode(rawPublicKey),
        privateKeyPkcs8: base64UrlEncode(privateKeyPkcs8),
        createdAtMs: this.now(),
      };

      safeWriteJson(this.storage, DEVICE_IDENTITY_STORAGE_KEY, identity);
      return this.buildRecord(identity);
    } catch {
      return null;
    }
  }

  private buildRecord(identity: StoredDeviceIdentity): DeviceIdentityRecord {
    return {
      deviceId: identity.deviceId,
      publicKey: identity.publicKey,
      sign: async (payload: string) => {
        const subtle = globalThis.crypto?.subtle;
        if (!subtle) {
          throw new Error('WebCrypto is unavailable.');
        }

        const privateKey = await subtle.importKey(
          'pkcs8',
          base64UrlDecode(identity.privateKeyPkcs8)!,
          'Ed25519',
          false,
          ['sign'],
        );
        const signature = await subtle.sign(
          'Ed25519',
          privateKey,
          new TextEncoder().encode(payload),
        );

        return base64UrlEncode(new Uint8Array(signature));
      },
    };
  }
}

export class OpenClawGatewayClient {
  private readonly options: OpenClawGatewayClientOptions;
  private readonly storage: StorageLike | null;
  private readonly createRequestId: () => string;
  private readonly now: () => number;
  private readonly connectTimeoutMs: number;
  private readonly reconnectEnabled: boolean;
  private readonly reconnectBaseMs: number;
  private readonly reconnectMaxMs: number;
  private readonly webSocketFactory: (url: string) => WebSocketLike;
  private readonly deviceIdentityProvider: OpenClawGatewayDeviceIdentityProvider;
  private readonly listeners: {
    [K in ListenerKey]: Set<ListenerMap[K]>;
  } = {
    agent: new Set(),
    connection: new Set(),
    chat: new Set(),
    gap: new Set(),
    'session.message': new Set(),
    'sessions.changed': new Set(),
  };

  private socket: WebSocketLike | null = null;
  private readonly pending = new Map<string, PendingRequest>();
  private readonly connectWaiters = new Set<ConnectionWaiter>();
  private hello: OpenClawGatewayHelloOk | null = null;
  private lastSeq: number | null = null;
  private connectNonce: string | null = null;
  private connectSent = false;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelayMs: number;
  private lastConnectError: OpenClawGatewayErrorInfo | undefined;
  private disconnectedManually = false;
  private isConnectingSocket = false;
  private pendingDeviceTokenRetry = false;
  private deviceTokenRetryBudgetUsed = false;

  constructor(options: OpenClawGatewayClientOptions) {
    this.options = options;
    this.storage = resolveStorage(options.storage);
    this.createRequestId = options.createRequestId ?? createDefaultRequestId;
    this.now = options.now ?? (() => Date.now());
    this.connectTimeoutMs = options.connectTimeoutMs ?? 750;
    this.reconnectEnabled = options.reconnect !== false;
    this.reconnectBaseMs = options.reconnectBaseMs ?? 800;
    this.reconnectMaxMs = options.reconnectMaxMs ?? 15_000;
    this.reconnectDelayMs = this.reconnectBaseMs;
    this.webSocketFactory =
      options.webSocketFactory ?? ((url) => new WebSocket(url) as WebSocketLike);
    this.deviceIdentityProvider =
      options.deviceIdentityProvider ??
      new DefaultDeviceIdentityProvider(this.storage, this.now);
  }

  get connected() {
    return this.socket?.readyState === SOCKET_OPEN && this.hello !== null;
  }

  on<K extends ListenerKey>(event: K, listener: ListenerMap[K]) {
    this.listeners[event].add(listener);
    return () => {
      this.listeners[event].delete(listener);
    };
  }

  connect() {
    if (this.connected && this.hello) {
      return Promise.resolve(this.hello);
    }

    this.disconnectedManually = false;

    return new Promise<OpenClawGatewayHelloOk>((resolve, reject) => {
      this.connectWaiters.add({ resolve, reject });
      try {
        this.ensureSocket('connecting');
      } catch (error) {
        this.rejectConnectWaiters(error);
      }
    });
  }

  disconnect() {
    this.disconnectedManually = true;
    this.clearReconnectTimer();
    this.clearConnectTimer();
    this.hello = null;
    this.connectSent = false;
    this.connectNonce = null;
    this.pendingDeviceTokenRetry = false;
    this.deviceTokenRetryBudgetUsed = false;
    this.rejectConnectWaiters(new Error('Gateway client disconnected.'));

    if (this.socket) {
      try {
        this.socket.close();
      } finally {
        this.socket = null;
      }
    }

    this.rejectPendingRequests(new Error('Gateway client disconnected.'));
    this.emit('connection', {
      status: 'disconnected',
      code: 1000,
      reason: 'manual-disconnect',
    });
  }

  async request<T = unknown>(method: string, params?: unknown) {
    await this.connect();
    return this.sendFrameRequest<T>(method, params);
  }

  listSessions(params?: {
    includeGlobal?: boolean;
    includeUnknown?: boolean;
    activeMinutes?: number;
    limit?: number;
    includeDerivedTitles?: boolean;
    includeLastMessage?: boolean;
    agentId?: string;
  }) {
    return this.request<OpenClawGatewaySessionsListResult>('sessions.list', params);
  }

  subscribeSessions() {
    return this.request('sessions.subscribe', {});
  }

  subscribeSessionMessages(params: { key: string }) {
    return this.request<{ subscribed?: boolean; key?: string }>(
      'sessions.messages.subscribe',
      params,
    );
  }

  unsubscribeSessionMessages(params: { key: string }) {
    return this.request<{ subscribed?: boolean; key?: string }>(
      'sessions.messages.unsubscribe',
      params,
    );
  }

  getChatHistory(params: { sessionKey: string; limit?: number; maxChars?: number }) {
    return this.request<OpenClawGatewayChatHistoryResult>('chat.history', {
      sessionKey: params.sessionKey,
      limit: params.limit ?? 200,
      ...(params.maxChars !== undefined ? { maxChars: params.maxChars } : {}),
    });
  }

  listModels() {
    return this.request<OpenClawGatewayModelsListResult>('models.list', {});
  }

  patchSession(params: {
    key: string;
    label?: string | null;
    model?: string | null;
    thinkingLevel?: string | null;
    fastMode?: boolean | null;
    verboseLevel?: string | null;
    reasoningLevel?: string | null;
    contextTokens?: number | null;
  }) {
    return this.request<OpenClawGatewaySessionsPatchResult>('sessions.patch', params);
  }

  async sendChatMessage(params: {
    sessionKey: string;
    message: string;
    idempotencyKey?: string;
    deliver?: boolean;
    attachments?: unknown[];
  }) {
    const runId = params.idempotencyKey ?? this.createRequestId();
    const payload = {
      sessionKey: params.sessionKey,
      message: params.message,
      deliver: params.deliver ?? false,
      idempotencyKey: runId,
      attachments: params.attachments,
    };

    const response = await this.request('chat.send', payload);
    return {
      runId,
      response,
    };
  }

  abortChatRun(params: { sessionKey: string; runId?: string }) {
    return this.request('chat.abort', params);
  }

  injectAssistantMessage(params: { sessionKey: string; message: string }) {
    return this.request('chat.inject', params);
  }

  resetSession(params: { key: string; reason?: 'new' | 'reset' }) {
    return this.request('sessions.reset', params);
  }

  deleteSession(params: { key: string; deleteTranscript?: boolean }) {
    return this.request('sessions.delete', {
      key: params.key,
      deleteTranscript: params.deleteTranscript ?? true,
    });
  }

  private emit(event: 'agent', payload: OpenClawGatewayAgentEvent): void;
  private emit(event: 'connection', payload: OpenClawGatewayConnectionEvent): void;
  private emit(event: 'chat', payload: OpenClawGatewayChatEvent): void;
  private emit(event: 'gap', payload: OpenClawGatewayGapEvent): void;
  private emit(event: 'session.message', payload: OpenClawGatewaySessionMessageEvent): void;
  private emit(event: 'sessions.changed', payload: unknown): void;
  private emit(event: ListenerKey, payload: unknown) {
    if (event === 'agent') {
      for (const listener of this.listeners.agent) {
        listener(payload as OpenClawGatewayAgentEvent);
      }
      return;
    }

    if (event === 'connection') {
      for (const listener of this.listeners.connection) {
        listener(payload as OpenClawGatewayConnectionEvent);
      }
      return;
    }

    if (event === 'chat') {
      for (const listener of this.listeners.chat) {
        listener(payload as OpenClawGatewayChatEvent);
      }
      return;
    }

    if (event === 'gap') {
      for (const listener of this.listeners.gap) {
        listener(payload as OpenClawGatewayGapEvent);
      }
      return;
    }

    if (event === 'session.message') {
      for (const listener of this.listeners['session.message']) {
        listener(payload as OpenClawGatewaySessionMessageEvent);
      }
      return;
    }

    for (const listener of this.listeners['sessions.changed']) {
      listener(payload);
    }
  }

  private ensureSocket(status: 'connecting' | 'reconnecting') {
    if (this.socket || this.isConnectingSocket) {
      return;
    }

    this.clearReconnectTimer();
    this.isConnectingSocket = true;
    this.emit('connection', {
      status: status === 'reconnecting' ? 'connecting' : status,
    });

    let socket: WebSocketLike;
    try {
      socket = this.webSocketFactory(this.options.url);
    } catch (error) {
      this.isConnectingSocket = false;
      this.socket = null;
      this.connectSent = false;
      this.connectNonce = null;
      this.lastConnectError = {
        code: 'SOCKET_CONSTRUCTION_FAILED',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to construct the gateway WebSocket.',
      };
      this.emit('connection', {
        status: 'disconnected',
        code: CONNECT_FAILED_CLOSE_CODE,
        reason: 'socket-construction-failed',
        error: this.lastConnectError,
      });
      throw error;
    }
    this.socket = socket;

    socket.addEventListener('open', () => {
      this.isConnectingSocket = false;
      this.queueConnect();
    });
    socket.addEventListener('message', (event: MessageEvent | { data?: string }) => {
      this.handleMessage(String(event.data ?? ''));
    });
    socket.addEventListener('close', (event: CloseEvent | { code?: number; reason?: string }) => {
      this.handleClose(event.code ?? 1005, String(event.reason ?? ''));
    });
    socket.addEventListener('error', () => {
      // close handler will carry the terminal state
    });
  }

  private queueConnect() {
    this.connectNonce = null;
    this.connectSent = false;
    this.clearConnectTimer();
    this.connectTimer = setTimeout(() => {
      void this.sendConnect();
    }, this.connectTimeoutMs);
  }

  private async sendConnect() {
    if (!this.socket || this.socket.readyState !== SOCKET_OPEN || this.connectSent) {
      return;
    }

    this.connectSent = true;
    this.clearConnectTimer();

    const clientId = trimToUndefined(this.options.clientId) ?? DEFAULT_CLIENT_ID;
    const explicitGatewayToken = trimToUndefined(this.options.authToken);
    const authPassword = trimToUndefined(this.options.password);
    const identity = await this.deviceIdentityProvider.loadOrCreate();
    const selectedAuth: SelectedConnectAuth =
      identity !== null
        ? this.selectConnectAuth({
            role: DEFAULT_ROLE,
            deviceId: identity.deviceId,
          })
        : {
            authToken: explicitGatewayToken,
            authPassword,
            canFallbackToShared: false,
          };
    const authToken = selectedAuth.authToken;
    const authDeviceToken = selectedAuth.authDeviceToken;
    if (this.pendingDeviceTokenRetry && authDeviceToken) {
      this.pendingDeviceTokenRetry = false;
    }
    const auth =
      authToken || authDeviceToken || selectedAuth.authPassword
        ? {
            ...(authToken ? { token: authToken } : {}),
            ...(authDeviceToken ? { deviceToken: authDeviceToken } : {}),
            ...(selectedAuth.authPassword ? { password: selectedAuth.authPassword } : {}),
          }
        : undefined;

    const signedAt = this.now();
    const device =
      identity !== null
        ? {
            id: identity.deviceId,
            publicKey: identity.publicKey,
            signature: await identity.sign(
              buildDeviceAuthPayload({
                deviceId: identity.deviceId,
                clientId,
                clientMode: DEFAULT_CLIENT_MODE,
                role: DEFAULT_ROLE,
                scopes: DEFAULT_SCOPES,
                signedAtMs: signedAt,
                token: authToken,
                nonce: this.connectNonce ?? '',
              }),
            ),
            signedAt,
            nonce: this.connectNonce ?? '',
          }
        : undefined;

    try {
      const hello = await this.sendFrameRequest<OpenClawGatewayHelloOk>('connect', {
        minProtocol: OPENCLAW_GATEWAY_PROTOCOL_VERSION,
        maxProtocol: OPENCLAW_GATEWAY_PROTOCOL_VERSION,
        client: {
          id: clientId,
          version: trimToUndefined(this.options.clientVersion) ?? 'agent-studio',
          platform:
            trimToUndefined(this.options.platform) ??
            trimToUndefined(globalThis.navigator?.platform) ??
            'web',
          mode: DEFAULT_CLIENT_MODE,
          instanceId: trimToUndefined(this.options.instanceId),
        },
        role: DEFAULT_ROLE,
        scopes: DEFAULT_SCOPES,
        caps: DEFAULT_CAPS,
        commands: [],
        permissions: {},
        auth,
        locale:
          trimToUndefined(this.options.locale) ??
          trimToUndefined(globalThis.navigator?.language) ??
          'en-US',
        userAgent:
          trimToUndefined(this.options.userAgent) ??
          trimToUndefined(globalThis.navigator?.userAgent) ??
          'agent-studio',
        device,
      });

      this.lastConnectError = undefined;
      this.hello = hello;
      this.reconnectDelayMs = this.reconnectBaseMs;
      this.pendingDeviceTokenRetry = false;
      this.deviceTokenRetryBudgetUsed = false;

      if (hello.auth?.deviceToken && identity) {
        writeStoredDeviceToken(this.storage, {
          deviceId: identity.deviceId,
          role: DEFAULT_ROLE,
          token: hello.auth.deviceToken,
          scopes: hello.auth.scopes,
          updatedAtMs: this.now(),
        });
      }

      this.resolveConnectWaiters(hello);
      this.emit('connection', {
        status: 'connected',
        hello,
      });
    } catch (error) {
      const connectErrorCode =
        error instanceof OpenClawGatewayRequestError ? resolveGatewayErrorDetailCode(error) : null;
      const recoveryAdvice =
        error instanceof OpenClawGatewayRequestError
          ? readConnectErrorRecoveryAdvice(error.details)
          : {};
      const retryWithDeviceTokenRecommended =
        recoveryAdvice.recommendedNextStep === 'retry_with_device_token';
      const canRetryWithDeviceTokenHint =
        recoveryAdvice.canRetryWithDeviceToken === true ||
        retryWithDeviceTokenRecommended ||
        connectErrorCode === 'AUTH_TOKEN_MISMATCH';
      const shouldRetryWithDeviceToken =
        !this.deviceTokenRetryBudgetUsed &&
        !selectedAuth.authDeviceToken &&
        Boolean(explicitGatewayToken) &&
        Boolean(identity) &&
        Boolean(selectedAuth.storedToken) &&
        canRetryWithDeviceTokenHint &&
        isTrustedRetryEndpoint(this.options.url);
      if (shouldRetryWithDeviceToken) {
        this.pendingDeviceTokenRetry = true;
        this.deviceTokenRetryBudgetUsed = true;
      }

      this.lastConnectError =
        error instanceof OpenClawGatewayRequestError
          ? {
              code: error.gatewayCode,
              message: error.message,
              details: error.details,
            }
          : undefined;

      if (
        selectedAuth.canFallbackToShared &&
        identity &&
        connectErrorCode === 'AUTH_DEVICE_TOKEN_MISMATCH'
      ) {
        clearStoredDeviceToken(this.storage, {
          deviceId: identity.deviceId,
          role: DEFAULT_ROLE,
        });
      }

      this.socket?.close(CONNECT_FAILED_CLOSE_CODE, 'connect failed');
    }
  }

  private sendFrameRequest<T>(method: string, params?: unknown) {
    if (!this.socket || this.socket.readyState !== SOCKET_OPEN) {
      return Promise.reject(new Error('Gateway socket is not connected.'));
    }

    const id = this.createRequestId();
    const frame: OpenClawGatewayRequestFrame = {
      type: 'req',
      id,
      method,
      params,
    };

    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket?.send(JSON.stringify(frame));
    });
  }

  private handleMessage(raw: string) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    const frame = parsed as { type?: unknown };
    if (frame.type === 'event') {
      const eventFrame = parsed as OpenClawGatewayEventFrame;

      if (eventFrame.event === 'connect.challenge') {
        const nonce = (eventFrame.payload as { nonce?: unknown } | undefined)?.nonce;
        this.connectNonce = typeof nonce === 'string' ? nonce : null;
        void this.sendConnect();
        return;
      }

      const seq = typeof eventFrame.seq === 'number' ? eventFrame.seq : null;
      if (seq !== null) {
        if (this.lastSeq !== null && seq > this.lastSeq + 1) {
          this.emit('gap', {
            expected: this.lastSeq + 1,
            received: seq,
          });
        }
        this.lastSeq = seq;
      }

      if (eventFrame.event === 'chat') {
        this.emit('chat', eventFrame.payload as OpenClawGatewayChatEvent);
      }

      if (eventFrame.event === 'agent') {
        this.emit('agent', eventFrame.payload as OpenClawGatewayAgentEvent);
      }

      if (eventFrame.event === 'session.message') {
        this.emit('session.message', eventFrame.payload as OpenClawGatewaySessionMessageEvent);
      }

      if (eventFrame.event === 'sessions.changed') {
        this.emit('sessions.changed', eventFrame.payload);
      }
      return;
    }

    if (frame.type === 'res') {
      const response = parsed as OpenClawGatewayResponseFrame;
      const pending = this.pending.get(response.id);
      if (!pending) {
        return;
      }

      this.pending.delete(response.id);
      if (response.ok) {
        pending.resolve(response.payload);
        return;
      }

      pending.reject(
        new OpenClawGatewayRequestError({
          code: response.error?.code ?? 'UNAVAILABLE',
          message: response.error?.message ?? 'Gateway request failed.',
          details: response.error?.details,
        }),
      );
    }
  }

  private handleClose(code: number, reason: string) {
    this.clearConnectTimer();
    this.rejectPendingRequests(new Error(`Gateway closed (${code}): ${reason || 'no reason'}`));

    const wasManual = this.disconnectedManually;
    const error = this.lastConnectError;
    this.socket = null;
    this.hello = null;
    this.connectSent = false;
    this.connectNonce = null;
    this.isConnectingSocket = false;

    if (wasManual) {
      return;
    }

    const connectErrorCode = resolveGatewayErrorDetailCode(error);
    if (
      connectErrorCode === 'AUTH_TOKEN_MISMATCH' &&
      this.deviceTokenRetryBudgetUsed &&
      !this.pendingDeviceTokenRetry
    ) {
      this.rejectConnectWaiters(
        new Error(error?.message ?? `Gateway disconnected (${code}): ${reason || 'no reason'}`),
      );
      this.emit('connection', {
        status: 'disconnected',
        code,
        reason,
        error,
      });
      return;
    }

    const shouldReconnect = this.reconnectEnabled && !isNonRecoverableAuthError(error);
    if (shouldReconnect) {
      const delayMs = this.reconnectDelayMs;
      this.reconnectDelayMs = Math.min(Math.round(this.reconnectDelayMs * 1.7), this.reconnectMaxMs);
      this.emit('connection', {
        status: 'reconnecting',
        code,
        reason,
        error,
        delayMs,
      });
      this.reconnectTimer = setTimeout(() => {
        this.ensureSocket('reconnecting');
      }, delayMs);
      return;
    }

    this.rejectConnectWaiters(
      new Error(error?.message ?? `Gateway disconnected (${code}): ${reason || 'no reason'}`),
    );
    this.emit('connection', {
      status: 'disconnected',
      code,
      reason,
      error,
    });
  }

  private clearConnectTimer() {
    if (this.connectTimer !== null) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private resolveConnectWaiters(hello: OpenClawGatewayHelloOk) {
    for (const waiter of this.connectWaiters) {
      waiter.resolve(hello);
    }
    this.connectWaiters.clear();
  }

  private rejectConnectWaiters(error: unknown) {
    for (const waiter of this.connectWaiters) {
      waiter.reject(error);
    }
    this.connectWaiters.clear();
  }

  private rejectPendingRequests(error: unknown) {
    for (const request of this.pending.values()) {
      request.reject(error);
    }
    this.pending.clear();
  }

  private selectConnectAuth(params: {
    role: OpenClawGatewayAuthRole;
    deviceId: string;
  }): SelectedConnectAuth {
    const explicitGatewayToken = trimToUndefined(this.options.authToken);
    const authPassword = trimToUndefined(this.options.password);
    const storedToken = readStoredDeviceToken(this.storage, params.deviceId, params.role)?.token;
    const shouldUseDeviceRetryToken =
      this.pendingDeviceTokenRetry &&
      Boolean(explicitGatewayToken) &&
      Boolean(storedToken) &&
      isTrustedRetryEndpoint(this.options.url);
    const resolvedDeviceToken =
      !(explicitGatewayToken || authPassword) && storedToken ? storedToken : undefined;
    const authToken = explicitGatewayToken ?? resolvedDeviceToken;

    return {
      authToken,
      authDeviceToken: shouldUseDeviceRetryToken ? storedToken : undefined,
      authPassword,
      resolvedDeviceToken,
      storedToken,
      canFallbackToShared: Boolean(storedToken && explicitGatewayToken),
    };
  }
}
