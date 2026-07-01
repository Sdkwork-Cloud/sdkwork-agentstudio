import {
  createBrowserSessionAwareFetch,
  WebHostedStudioPlatform,
  WebInternalPlatform,
  WebManagePlatform,
  type HostPlatformLifecycle,
  type HostPlatformStatusRecord,
  type ManageHostEndpointRecord,
  type ManageOpenClawGatewayRecord,
  type ManageOpenClawRuntimeRecord,
  type StudioInstanceRecord,
} from '@sdkwork/claw-infrastructure';
import { resolveBuiltInOpenClawInstance } from './builtInOpenClawInstanceSelection.ts';

export interface DesktopHostedRuntimeDescriptor {
  mode: 'desktopCombined';
  lifecycle: HostPlatformLifecycle;
  apiBasePath: string;
  manageBasePath: string;
  internalBasePath: string;
  browserBaseUrl: string;
  browserSessionToken: string;
  lastError?: string | null;
  endpointId?: string | null;
  requestedPort?: number | null;
  activePort?: number | null;
  loopbackOnly?: boolean | null;
  dynamicPort?: boolean | null;
  stateStoreDriver?: string | null;
  stateStoreProfileId?: string | null;
  runtimeDataDir?: string | null;
  webDistDir?: string | null;
}

type DesktopHostedFetch = NonNullable<Parameters<typeof createBrowserSessionAwareFetch>[0]>;
type DesktopHostedWebSocketOpenHandler =
  | ((event: unknown) => void)
  | ((this: WebSocket, event: Event) => unknown)
  | null;
type DesktopHostedWebSocketErrorHandler =
  | ((event: unknown) => void)
  | ((this: WebSocket, event: Event) => unknown)
  | null;
type DesktopHostedWebSocketCloseHandler =
  | ((event: unknown) => void)
  | ((this: WebSocket, event: CloseEvent) => unknown)
  | null;
type DesktopHostedWebSocketLike = {
  onopen: DesktopHostedWebSocketOpenHandler;
  onerror: DesktopHostedWebSocketErrorHandler;
  onclose: DesktopHostedWebSocketCloseHandler;
  close: () => void;
};
type DesktopHostedWebSocketFactory = (url: string) => DesktopHostedWebSocketLike;
export type DesktopHostedRuntimeResolver = () => Promise<
  DesktopHostedRuntimeDescriptor | null | undefined
>;

export interface DesktopHostedRuntimeReadinessEvidence {
  descriptorBrowserBaseUrl: string;
  descriptorEndpointId: string | null;
  descriptorActivePort: number | null;
  hostLifecycle: HostPlatformStatusRecord['lifecycle'];
  hostLifecycleReady: boolean;
  gatewayInvokeCapabilitySupported: boolean;
  gatewayInvokeCapabilityAvailable: boolean;
  hostEndpointCount: number;
  manageEndpointId: string | null;
  manageEndpointRequestedPort: number | null;
  manageEndpointActivePort: number | null;
  manageBaseUrl: string | null;
  manageEndpointPublished: boolean;
  manageEndpointMatchesDescriptor: boolean;
  manageEndpointIdMatchesDescriptor: boolean;
  manageEndpointActivePortMatchesDescriptor: boolean;
  openClawRuntimeLifecycle: ManageOpenClawRuntimeRecord['lifecycle'];
  openClawRuntimeEndpointId: string | null;
  openClawRuntimeActivePort: number | null;
  openClawRuntimeBaseUrl: string | null;
  openClawRuntimeWebsocketUrl: string | null;
  openClawRuntimeReady: boolean;
  openClawRuntimeUrlsPublished: boolean;
  openClawGatewayLifecycle: ManageOpenClawGatewayRecord['lifecycle'];
  openClawGatewayEndpointId: string | null;
  openClawGatewayActivePort: number | null;
  openClawGatewayBaseUrl: string | null;
  openClawGatewayWebsocketUrl: string | null;
  openClawGatewayReady: boolean;
  openClawGatewayUrlsPublished: boolean;
  runtimeAndGatewayBaseUrlMatch: boolean;
  runtimeAndGatewayWebsocketUrlMatch: boolean;
  runtimeAndGatewayEndpointIdMatch: boolean;
  runtimeAndGatewayActivePortMatch: boolean;
  gatewayWebsocketReady: boolean;
  gatewayWebsocketProbeSupported: boolean;
  gatewayWebsocketDialable: boolean | null;
  builtInInstanceId: string | null;
  builtInInstanceRuntimeKind: StudioInstanceRecord['runtimeKind'] | null;
  builtInInstanceDeploymentMode: StudioInstanceRecord['deploymentMode'] | null;
  builtInInstanceTransportKind: StudioInstanceRecord['transportKind'] | null;
  builtInInstanceStatus: StudioInstanceRecord['status'] | null;
  builtInInstanceBaseUrl: string | null;
  builtInInstanceWebsocketUrl: string | null;
  builtInInstancePublished: boolean;
  builtInInstanceRuntimeKindMatchesOpenClaw: boolean;
  builtInInstanceDeploymentModeMatchesLocalManaged: boolean;
  builtInInstanceTransportKindMatchesOpenClawGateway: boolean;
  builtInInstanceOnline: boolean;
  builtInInstanceUrlsPublished: boolean;
  builtInInstanceBaseUrlMatchesGateway: boolean;
  builtInInstanceWebsocketUrlMatchesGateway: boolean;
  builtInInstanceReady: boolean;
  ready: boolean;
}

export interface DesktopHostedRuntimeReadinessSnapshot {
  descriptor: DesktopHostedRuntimeDescriptor;
  hostPlatformStatus: HostPlatformStatusRecord;
  hostEndpoints: ManageHostEndpointRecord[];
  openClawRuntime: ManageOpenClawRuntimeRecord;
  openClawGateway: ManageOpenClawGatewayRecord;
  instances: StudioInstanceRecord[];
  evidence: DesktopHostedRuntimeReadinessEvidence;
}

export class DesktopHostedRuntimeReadinessError extends Error {
  readonly snapshot: DesktopHostedRuntimeReadinessSnapshot;
  readonly cause: unknown;

  constructor(
    message: string,
    snapshot: DesktopHostedRuntimeReadinessSnapshot,
    cause?: unknown,
  ) {
    super(message);
    this.name = 'DesktopHostedRuntimeReadinessError';
    this.snapshot = snapshot;
    this.cause = cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function isDesktopHostedRuntimeReadinessError(
  error: unknown,
): error is DesktopHostedRuntimeReadinessError {
  return error instanceof DesktopHostedRuntimeReadinessError;
}

export function normalizeDesktopHostedRuntimeDescriptor(
  descriptor: DesktopHostedRuntimeDescriptor | null | undefined,
): DesktopHostedRuntimeDescriptor | null {
  if (!descriptor || descriptor.mode !== 'desktopCombined') {
    return null;
  }

  const apiBasePath = normalizeRequiredString(descriptor.apiBasePath);
  const manageBasePath = normalizeRequiredString(descriptor.manageBasePath);
  const internalBasePath = normalizeRequiredString(descriptor.internalBasePath);
  const browserBaseUrl = normalizeRequiredString(descriptor.browserBaseUrl);
  const browserSessionToken = normalizeRequiredString(descriptor.browserSessionToken);

  if (!apiBasePath || !manageBasePath || !internalBasePath || !browserBaseUrl || !browserSessionToken) {
    return null;
  }

  return {
    mode: 'desktopCombined',
    lifecycle: descriptor.lifecycle,
    apiBasePath,
    manageBasePath,
    internalBasePath,
    browserBaseUrl,
    browserSessionToken,
    lastError: normalizeOptionalString(descriptor.lastError),
    endpointId: normalizeOptionalString(descriptor.endpointId),
    requestedPort: normalizeOptionalNumber(descriptor.requestedPort),
    activePort: normalizeOptionalNumber(descriptor.activePort),
    loopbackOnly: normalizeOptionalBoolean(descriptor.loopbackOnly),
    dynamicPort: normalizeOptionalBoolean(descriptor.dynamicPort),
    stateStoreDriver: normalizeOptionalString(descriptor.stateStoreDriver),
    stateStoreProfileId: normalizeOptionalString(descriptor.stateStoreProfileId),
    runtimeDataDir: normalizeOptionalString(descriptor.runtimeDataDir),
    webDistDir: normalizeOptionalString(descriptor.webDistDir),
  };
}

export function resolveDesktopHostedBasePath(browserBaseUrl: string, basePath: string): string {
  const normalizedBrowserBaseUrl = browserBaseUrl.endsWith('/')
    ? browserBaseUrl
    : `${browserBaseUrl}/`;

  try {
    return new URL(basePath, normalizedBrowserBaseUrl).toString();
  } catch {
    const normalizedBasePath = basePath.startsWith('/') ? basePath : `/${basePath}`;
    return `${browserBaseUrl.replace(/\/+$/, '')}${normalizedBasePath}`;
  }
}

export function createDesktopHostedManagePlatform(
  descriptor: DesktopHostedRuntimeDescriptor,
  fetchImpl?: DesktopHostedFetch,
): WebManagePlatform {
  const normalizedDescriptor = requireDesktopHostedRuntimeDescriptor(descriptor);
  return new WebManagePlatform(
    resolveDesktopHostedBasePath(
      normalizedDescriptor.browserBaseUrl,
      normalizedDescriptor.manageBasePath,
    ),
    createBrowserSessionAwareFetch(fetchImpl, normalizedDescriptor.browserSessionToken),
  );
}

export function createDesktopHostedInternalPlatform(
  descriptor: DesktopHostedRuntimeDescriptor,
  fetchImpl?: DesktopHostedFetch,
): WebInternalPlatform {
  const normalizedDescriptor = requireDesktopHostedRuntimeDescriptor(descriptor);
  return new WebInternalPlatform(
    resolveDesktopHostedBasePath(
      normalizedDescriptor.browserBaseUrl,
      normalizedDescriptor.internalBasePath,
    ),
    createBrowserSessionAwareFetch(fetchImpl, normalizedDescriptor.browserSessionToken),
  );
}

export function createDesktopHostedStudioPlatform(
  descriptor: DesktopHostedRuntimeDescriptor,
  fetchImpl?: DesktopHostedFetch,
): WebHostedStudioPlatform {
  const normalizedDescriptor = requireDesktopHostedRuntimeDescriptor(descriptor);
  return new WebHostedStudioPlatform({
    basePath: resolveDesktopHostedBasePath(
      normalizedDescriptor.browserBaseUrl,
      normalizedDescriptor.apiBasePath,
    ),
    fetchImpl: createBrowserSessionAwareFetch(fetchImpl, normalizedDescriptor.browserSessionToken),
  });
}

export function createDeferredDesktopHostedFetch(
  resolveDescriptor: DesktopHostedRuntimeResolver,
  fetchImpl?: DesktopHostedFetch,
): NonNullable<ReturnType<typeof createBrowserSessionAwareFetch>> {
  return async (input, init) => {
    const descriptor = requireDesktopHostedRuntimeDescriptor(await resolveDescriptor());
    const hostedFetch = createBrowserSessionAwareFetch(fetchImpl, descriptor.browserSessionToken);
    return hostedFetch!(input, init);
  };
}

export function createDeferredDesktopHostedStudioPlatform(
  resolveDescriptor: DesktopHostedRuntimeResolver,
  fetchImpl?: DesktopHostedFetch,
): WebHostedStudioPlatform {
  return new WebHostedStudioPlatform({
    resolveBasePath: async () => {
      const descriptor = requireDesktopHostedRuntimeDescriptor(await resolveDescriptor());
      return resolveDesktopHostedBasePath(descriptor.browserBaseUrl, descriptor.apiBasePath);
    },
    fetchImpl: createDeferredDesktopHostedFetch(resolveDescriptor, fetchImpl),
  });
}

function createInactiveOpenClawRuntimeRecord(
  descriptor: DesktopHostedRuntimeDescriptor,
): ManageOpenClawRuntimeRecord {
  return {
    runtimeKind: 'openclaw',
    lifecycle: 'inactive',
    endpointId: null,
    requestedPort: null,
    activePort: null,
    baseUrl: null,
    websocketUrl: null,
    managedBy: descriptor.mode,
    updatedAt: 0,
  };
}

function createInactiveOpenClawGatewayRecord(
  descriptor: DesktopHostedRuntimeDescriptor,
): ManageOpenClawGatewayRecord {
  return {
    gatewayKind: 'openclawGateway',
    lifecycle: 'inactive',
    endpointId: null,
    requestedPort: null,
    activePort: null,
    baseUrl: null,
    websocketUrl: null,
    managedBy: descriptor.mode,
    updatedAt: 0,
  };
}

export async function probeDesktopHostedControlPlane(
  descriptor: DesktopHostedRuntimeDescriptor,
  fetchImpl?: DesktopHostedFetch,
): Promise<{
  hostPlatformStatus: HostPlatformStatusRecord;
  hostEndpoints: ManageHostEndpointRecord[];
}> {
  const normalizedDescriptor = requireDesktopHostedRuntimeDescriptor(descriptor);
  const internal = createDesktopHostedInternalPlatform(normalizedDescriptor, fetchImpl);
  const manage = createDesktopHostedManagePlatform(normalizedDescriptor, fetchImpl);
  const [hostPlatformStatus, hostEndpoints] = await Promise.all([
    internal.getHostPlatformStatus(),
    manage.getHostEndpoints(),
  ]);

  return {
    hostPlatformStatus,
    hostEndpoints,
  };
}

export async function probeDesktopHostedRuntimeReadiness(
  descriptor: DesktopHostedRuntimeDescriptor,
  fetchImpl?: DesktopHostedFetch,
  options?: {
    requiresBuiltInOpenClawEvidence?: boolean;
    webSocketFactory?: DesktopHostedWebSocketFactory;
    webSocketConnectTimeoutMs?: number;
    signal?: AbortSignal;
  },
): Promise<DesktopHostedRuntimeReadinessSnapshot> {
  const { requiresBuiltInOpenClawEvidence = true } = options ?? {};
  const normalizedDescriptor = requireDesktopHostedRuntimeDescriptor(descriptor);
  const probeFetch = createDesktopHostedProbeFetch(fetchImpl, options?.signal);
  const internal = createDesktopHostedInternalPlatform(normalizedDescriptor, probeFetch);
  const manage = createDesktopHostedManagePlatform(normalizedDescriptor, probeFetch);
  const openClawRuntimePromise = requiresBuiltInOpenClawEvidence
    ? manage.getOpenClawRuntime()
    : Promise.resolve(createInactiveOpenClawRuntimeRecord(normalizedDescriptor));
  const openClawGatewayPromise = requiresBuiltInOpenClawEvidence
    ? manage.getOpenClawGateway()
    : Promise.resolve(createInactiveOpenClawGatewayRecord(normalizedDescriptor));
  const instancesPromise = requiresBuiltInOpenClawEvidence
    ? createDesktopHostedStudioPlatform(normalizedDescriptor, probeFetch).listInstances()
    : Promise.resolve([] as StudioInstanceRecord[]);
  const [hostPlatformStatus, hostEndpoints, openClawRuntime, openClawGateway, instances] = await Promise.all([
    internal.getHostPlatformStatus(),
    manage.getHostEndpoints(),
    openClawRuntimePromise,
    openClawGatewayPromise,
    instancesPromise,
  ]);

  const evidence = buildDesktopHostedRuntimeReadinessEvidence(
    normalizedDescriptor,
    hostPlatformStatus,
    hostEndpoints,
    openClawRuntime,
    openClawGateway,
    instances,
    {
      requiresBuiltInOpenClawEvidence,
    },
  );
  const webSocketFactory = resolveDesktopHostedWebSocketFactory(
    options?.webSocketFactory,
  );
  evidence.gatewayWebsocketProbeSupported =
    requiresBuiltInOpenClawEvidence && Boolean(webSocketFactory);
  if (
    requiresBuiltInOpenClawEvidence
    && webSocketFactory
    && evidence.openClawGatewayWebsocketUrl
  ) {
    evidence.gatewayWebsocketDialable =
      await probeDesktopHostedGatewayWebSocketDialability(
        evidence.openClawGatewayWebsocketUrl,
        webSocketFactory,
        options?.webSocketConnectTimeoutMs,
      );
    if (!evidence.gatewayWebsocketDialable) {
      evidence.ready = false;
    }
  }
  const snapshot: DesktopHostedRuntimeReadinessSnapshot = {
    descriptor: normalizedDescriptor,
    hostPlatformStatus,
    hostEndpoints,
    openClawRuntime,
    openClawGateway,
    instances,
    evidence,
  };

  try {
    assertDesktopHostedRuntimeReady(evidence, {
      requiresBuiltInOpenClawEvidence,
    });
  } catch (error) {
    throw new DesktopHostedRuntimeReadinessError(
      error instanceof Error && error.message.trim()
        ? error.message
        : 'Desktop hosted runtime readiness probe failed.',
      snapshot,
      error,
    );
  }

  return snapshot;
}

function createDesktopHostedProbeFetch(
  fetchImpl: DesktopHostedFetch | undefined,
  signal: AbortSignal | undefined,
): DesktopHostedFetch | undefined {
  if (!signal) {
    return fetchImpl;
  }

  const resolvedFetch = fetchImpl ?? resolveGlobalDesktopHostedFetch();
  return async (input, init) => {
    return resolvedFetch(input, {
      ...init,
      signal: resolveDesktopHostedProbeSignal(signal, init?.signal ?? null),
    });
  };
}

function resolveGlobalDesktopHostedFetch(): DesktopHostedFetch {
  if (typeof globalThis.fetch !== 'function') {
    throw new Error('Browser HTTP bridge requires a global fetch implementation.');
  }

  return globalThis.fetch.bind(globalThis) as DesktopHostedFetch;
}

function resolveDesktopHostedProbeSignal(
  retrySignal: AbortSignal,
  requestSignal: AbortSignal | null,
): AbortSignal {
  if (!requestSignal || requestSignal === retrySignal) {
    return retrySignal;
  }

  const signalFactory = AbortSignal as typeof AbortSignal & {
    any?: (signals: AbortSignal[]) => AbortSignal;
  };
  if (typeof signalFactory.any === 'function') {
    return signalFactory.any([retrySignal, requestSignal]);
  }

  return retrySignal;
}

function requireDesktopHostedRuntimeDescriptor(
  descriptor: DesktopHostedRuntimeDescriptor | null | undefined,
): DesktopHostedRuntimeDescriptor {
  const normalizedDescriptor = normalizeDesktopHostedRuntimeDescriptor(descriptor);
  if (normalizedDescriptor) {
    return normalizedDescriptor;
  }

  throw new Error('Canonical desktop embedded host runtime descriptor is unavailable.');
}

function normalizeRequiredString(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  return normalizeRequiredString(value);
}

function normalizeOptionalNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeOptionalBoolean(value: boolean | null | undefined): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function normalizeComparableUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = '';
    url.search = '';
    if ((url.protocol === 'http:' && url.port === '80') || (url.protocol === 'https:' && url.port === '443')) {
      url.port = '';
    }
    return url.toString().replace(/\/+$/, '');
  } catch {
    return value.replace(/\/+$/, '');
  }
}

function normalizeCapabilityKeys(value: string[] | null | undefined) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeRequiredString(item))
    .filter((item): item is string => Boolean(item));
}

function resolveDesktopHostedWebSocketFactory(
  webSocketFactory?: DesktopHostedWebSocketFactory,
): DesktopHostedWebSocketFactory | null {
  return webSocketFactory ?? null;
}

async function probeDesktopHostedGatewayWebSocketDialability(
  websocketUrl: string,
  webSocketFactory: DesktopHostedWebSocketFactory,
  timeoutMs = 500,
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let settled = false;
    let socket: DesktopHostedWebSocketLike | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const finish = (result: boolean) => {
      if (settled) {
        return;
      }

      settled = true;
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      try {
        socket?.close();
      } catch {
        // Close is best-effort after the probe settles.
      }
      resolve(result);
    };

    try {
      socket = webSocketFactory(websocketUrl);
    } catch {
      finish(false);
      return;
    }

    socket.onopen = () => finish(true);
    socket.onerror = () => finish(false);
    socket.onclose = () => finish(false);
    timeoutHandle = setTimeout(() => finish(false), Math.max(1, timeoutMs));
  });
}

function resolveDesktopHostedManageEndpoint(
  descriptor: DesktopHostedRuntimeDescriptor,
  hostEndpoints: ManageHostEndpointRecord[],
): ManageHostEndpointRecord | null {
  const publishedEndpoints = hostEndpoints.filter((endpoint) =>
    normalizeRequiredString(endpoint.baseUrl),
  );

  if (publishedEndpoints.length === 0) {
    return null;
  }

  const descriptorEndpointId = normalizeOptionalString(descriptor.endpointId);
  if (descriptorEndpointId) {
    const endpointIdMatch = publishedEndpoints.find(
      (endpoint) => normalizeOptionalString(endpoint.endpointId) === descriptorEndpointId,
    );
    if (endpointIdMatch) {
      return endpointIdMatch;
    }
  }

  const descriptorBrowserBaseUrl = normalizeComparableUrl(descriptor.browserBaseUrl);
  const browserBaseUrlMatch = publishedEndpoints.find((endpoint) => {
    const endpointBaseUrl = normalizeRequiredString(endpoint.baseUrl);
    return Boolean(endpointBaseUrl)
      && normalizeComparableUrl(endpointBaseUrl!) === descriptorBrowserBaseUrl;
  });
  if (browserBaseUrlMatch) {
    return browserBaseUrlMatch;
  }

  const descriptorActivePort = normalizeOptionalNumber(descriptor.activePort);
  if (descriptorActivePort != null) {
    const activePortMatch = publishedEndpoints.find(
      (endpoint) => normalizeOptionalNumber(endpoint.activePort) === descriptorActivePort,
    );
    if (activePortMatch) {
      return activePortMatch;
    }
  }

  return publishedEndpoints[0] ?? null;
}

export function buildDesktopHostedRuntimeReadinessEvidence(
  descriptor: DesktopHostedRuntimeDescriptor,
  hostPlatformStatus: HostPlatformStatusRecord,
  hostEndpoints: ManageHostEndpointRecord[],
  openClawRuntime: ManageOpenClawRuntimeRecord,
  openClawGateway: ManageOpenClawGatewayRecord,
  instances: StudioInstanceRecord[],
  options?: {
    requiresBuiltInOpenClawEvidence?: boolean;
  },
): DesktopHostedRuntimeReadinessEvidence {
  const { requiresBuiltInOpenClawEvidence = true } = options ?? {};
  const manageHostEndpoint = resolveDesktopHostedManageEndpoint(descriptor, hostEndpoints);
  const manageBaseUrl = normalizeRequiredString(manageHostEndpoint?.baseUrl);
  const manageEndpointId = normalizeRequiredString(manageHostEndpoint?.endpointId);
  const manageEndpointRequestedPort = normalizeOptionalNumber(manageHostEndpoint?.requestedPort);
  const manageEndpointActivePort =
    typeof manageHostEndpoint?.activePort === 'number' && Number.isFinite(manageHostEndpoint.activePort)
      ? manageHostEndpoint.activePort
      : null;
  const descriptorEndpointId = normalizeOptionalString(descriptor.endpointId);
  const descriptorActivePort = normalizeOptionalNumber(descriptor.activePort);
  const openClawRuntimeBaseUrl = normalizeRequiredString(openClawRuntime.baseUrl);
  const openClawRuntimeWebsocketUrl = normalizeRequiredString(openClawRuntime.websocketUrl);
  const openClawGatewayBaseUrl = normalizeRequiredString(openClawGateway.baseUrl);
  const openClawGatewayWebsocketUrl = normalizeRequiredString(openClawGateway.websocketUrl);
  const openClawRuntimeEndpointId = normalizeRequiredString(openClawRuntime.endpointId);
  const openClawGatewayEndpointId = normalizeRequiredString(openClawGateway.endpointId);
  const openClawRuntimeActivePort = normalizeOptionalNumber(openClawRuntime.activePort);
  const openClawGatewayActivePort = normalizeOptionalNumber(openClawGateway.activePort);
  const builtInInstance = resolveBuiltInOpenClawInstance(instances, {
    gatewayBaseUrl: openClawGatewayBaseUrl,
    gatewayWebsocketUrl: openClawGatewayWebsocketUrl,
  });
  const builtInInstanceId = normalizeRequiredString(builtInInstance?.id);
  const builtInInstanceRuntimeKind = builtInInstance?.runtimeKind ?? null;
  const builtInInstanceDeploymentMode = builtInInstance?.deploymentMode ?? null;
  const builtInInstanceTransportKind = builtInInstance?.transportKind ?? null;
  const builtInInstanceStatus = builtInInstance?.status ?? null;
  const builtInInstanceBaseUrl = normalizeRequiredString(builtInInstance?.baseUrl);
  const builtInInstanceWebsocketUrl = normalizeRequiredString(builtInInstance?.websocketUrl);
  const manageEndpointMatchesDescriptor =
    Boolean(manageBaseUrl)
    && normalizeComparableUrl(manageBaseUrl!) === normalizeComparableUrl(descriptor.browserBaseUrl);
  const manageEndpointIdMatchesDescriptor =
    !descriptorEndpointId || !manageEndpointId || manageEndpointId === descriptorEndpointId;
  const manageEndpointActivePortMatchesDescriptor =
    descriptorActivePort == null
    || manageEndpointActivePort == null
    || manageEndpointActivePort === descriptorActivePort;
  const runtimeAndGatewayBaseUrlMatch =
    Boolean(openClawRuntimeBaseUrl && openClawGatewayBaseUrl)
    && normalizeComparableUrl(openClawRuntimeBaseUrl!)
      === normalizeComparableUrl(openClawGatewayBaseUrl!);
  const runtimeAndGatewayWebsocketUrlMatch =
    Boolean(openClawRuntimeWebsocketUrl && openClawGatewayWebsocketUrl)
    && normalizeComparableUrl(openClawRuntimeWebsocketUrl!)
      === normalizeComparableUrl(openClawGatewayWebsocketUrl!);
  const runtimeAndGatewayEndpointIdMatch =
    !openClawRuntimeEndpointId
    || !openClawGatewayEndpointId
    || openClawRuntimeEndpointId === openClawGatewayEndpointId;
  const runtimeAndGatewayActivePortMatch =
    openClawRuntimeActivePort == null
    || openClawGatewayActivePort == null
    || openClawRuntimeActivePort === openClawGatewayActivePort;
  const builtInInstanceBaseUrlMatchesGateway =
    Boolean(builtInInstanceBaseUrl && openClawGatewayBaseUrl)
    && normalizeComparableUrl(builtInInstanceBaseUrl!)
      === normalizeComparableUrl(openClawGatewayBaseUrl!);
  const builtInInstanceWebsocketUrlMatchesGateway =
    Boolean(builtInInstanceWebsocketUrl && openClawGatewayWebsocketUrl)
    && normalizeComparableUrl(builtInInstanceWebsocketUrl!)
      === normalizeComparableUrl(openClawGatewayWebsocketUrl!);
  const hostLifecycleReady =
    hostPlatformStatus.lifecycle === 'ready'
    || (
      hostPlatformStatus.lifecycle === 'degraded'
      && Boolean(manageBaseUrl)
      && manageEndpointMatchesDescriptor
      && manageEndpointIdMatchesDescriptor
      && manageEndpointActivePortMatchesDescriptor
    );
  const supportedCapabilityKeys = normalizeCapabilityKeys(
    hostPlatformStatus.supportedCapabilityKeys,
  );
  const availableCapabilityKeys = normalizeCapabilityKeys(
    hostPlatformStatus.availableCapabilityKeys,
  );
  const gatewayInvokeCapabilitySupported =
    supportedCapabilityKeys.length > 0
      ? supportedCapabilityKeys.includes('manage.openclaw.gateway.invoke')
      : true;
  const openClawRuntimeReady = openClawRuntime.lifecycle === 'ready';
  const openClawGatewayReady = openClawGateway.lifecycle === 'ready';
  const gatewayInvokeCapabilityAvailable =
    availableCapabilityKeys.length > 0
      ? availableCapabilityKeys.includes('manage.openclaw.gateway.invoke')
      : hostLifecycleReady && openClawGatewayReady;
  const openClawRuntimeUrlsPublished = Boolean(openClawRuntimeBaseUrl && openClawRuntimeWebsocketUrl);
  const openClawGatewayUrlsPublished = Boolean(openClawGatewayBaseUrl && openClawGatewayWebsocketUrl);
  const gatewayWebsocketReady = openClawGatewayReady && Boolean(openClawGatewayWebsocketUrl);
  const builtInInstancePublished = Boolean(builtInInstanceId);
  const builtInInstanceRuntimeKindMatchesOpenClaw =
    builtInInstanceRuntimeKind === 'openclaw';
  const builtInInstanceDeploymentModeMatchesLocalManaged =
    builtInInstanceDeploymentMode === 'local-managed';
  const builtInInstanceTransportKindMatchesOpenClawGateway =
    builtInInstanceTransportKind === 'openclawGatewayWs';
  const builtInInstanceOnline = builtInInstanceStatus === 'online';
  const builtInInstanceUrlsPublished = Boolean(builtInInstanceBaseUrl && builtInInstanceWebsocketUrl);
  const builtInInstanceReady =
    builtInInstancePublished
    && builtInInstanceRuntimeKindMatchesOpenClaw
    && builtInInstanceDeploymentModeMatchesLocalManaged
    && builtInInstanceTransportKindMatchesOpenClawGateway
    && builtInInstanceOnline
    && builtInInstanceUrlsPublished
    && builtInInstanceBaseUrlMatchesGateway
    && builtInInstanceWebsocketUrlMatchesGateway;

  return {
    descriptorBrowserBaseUrl: descriptor.browserBaseUrl,
    descriptorEndpointId,
    descriptorActivePort,
    hostLifecycle: hostPlatformStatus.lifecycle,
    hostLifecycleReady,
    gatewayInvokeCapabilitySupported,
    gatewayInvokeCapabilityAvailable,
    hostEndpointCount: hostEndpoints.length,
    manageEndpointId,
    manageEndpointRequestedPort,
    manageEndpointActivePort,
    manageBaseUrl,
    manageEndpointPublished: Boolean(manageBaseUrl),
    manageEndpointMatchesDescriptor,
    manageEndpointIdMatchesDescriptor,
    manageEndpointActivePortMatchesDescriptor,
    openClawRuntimeLifecycle: openClawRuntime.lifecycle,
    openClawRuntimeEndpointId,
    openClawRuntimeActivePort,
    openClawRuntimeBaseUrl,
    openClawRuntimeWebsocketUrl,
    openClawRuntimeReady,
    openClawRuntimeUrlsPublished,
    openClawGatewayLifecycle: openClawGateway.lifecycle,
    openClawGatewayEndpointId,
    openClawGatewayActivePort,
    openClawGatewayBaseUrl,
    openClawGatewayWebsocketUrl,
    openClawGatewayReady,
    openClawGatewayUrlsPublished,
    runtimeAndGatewayBaseUrlMatch,
    runtimeAndGatewayWebsocketUrlMatch,
    runtimeAndGatewayEndpointIdMatch,
    runtimeAndGatewayActivePortMatch,
    gatewayWebsocketReady,
    gatewayWebsocketProbeSupported: false,
    gatewayWebsocketDialable: null,
    builtInInstanceId,
    builtInInstanceRuntimeKind,
    builtInInstanceDeploymentMode,
    builtInInstanceTransportKind,
    builtInInstanceStatus,
    builtInInstanceBaseUrl,
    builtInInstanceWebsocketUrl,
    builtInInstancePublished,
    builtInInstanceRuntimeKindMatchesOpenClaw,
    builtInInstanceDeploymentModeMatchesLocalManaged,
    builtInInstanceTransportKindMatchesOpenClawGateway,
    builtInInstanceOnline,
    builtInInstanceUrlsPublished,
    builtInInstanceBaseUrlMatchesGateway,
    builtInInstanceWebsocketUrlMatchesGateway,
    builtInInstanceReady,
    ready:
      hostLifecycleReady
      && Boolean(manageBaseUrl)
      && manageEndpointMatchesDescriptor
      && manageEndpointIdMatchesDescriptor
      && manageEndpointActivePortMatchesDescriptor
      && (
        !requiresBuiltInOpenClawEvidence
        || (
          gatewayInvokeCapabilityAvailable
          && openClawRuntimeReady
          && openClawGatewayReady
          && openClawRuntimeUrlsPublished
          && openClawGatewayUrlsPublished
          && runtimeAndGatewayBaseUrlMatch
          && runtimeAndGatewayWebsocketUrlMatch
          && runtimeAndGatewayEndpointIdMatch
          && runtimeAndGatewayActivePortMatch
          && builtInInstanceReady
        )
      ),
  };
}

function assertDesktopHostedRuntimeReady(
  evidence: DesktopHostedRuntimeReadinessEvidence,
  options?: {
    requiresBuiltInOpenClawEvidence?: boolean;
  },
) {
  const { requiresBuiltInOpenClawEvidence = true } = options ?? {};

  if (!evidence.hostLifecycleReady) {
    throw new Error(
      `Desktop hosted runtime is not ready: expected lifecycle "ready" but received "${evidence.hostLifecycle}".`,
    );
  }

  if (evidence.hostEndpointCount === 0) {
    throw new Error('Desktop hosted runtime did not publish any manage host endpoints.');
  }

  if (!evidence.manageEndpointPublished) {
    throw new Error(
      'Desktop hosted runtime did not publish a manage host endpoint baseUrl.',
    );
  }

  if (!evidence.manageBaseUrl) {
    throw new Error(
      'Desktop hosted runtime did not publish a manage host endpoint baseUrl.',
    );
  }

  if (!evidence.manageEndpointMatchesDescriptor) {
    throw new Error(
      'Desktop hosted runtime descriptor browserBaseUrl does not match the published manage host endpoint baseUrl.',
    );
  }

  if (!evidence.manageEndpointIdMatchesDescriptor) {
    throw new Error(
      'Desktop hosted runtime descriptor endpointId does not match the published manage host endpoint.',
    );
  }

  if (!evidence.manageEndpointActivePortMatchesDescriptor) {
    throw new Error(
      'Desktop hosted runtime descriptor activePort does not match the published manage host endpoint.',
    );
  }

  if (!requiresBuiltInOpenClawEvidence) {
    if (!evidence.ready) {
      throw new Error(
        'Desktop hosted runtime readiness evidence remained not ready after invariant checks.',
      );
    }
    return;
  }

  if (!evidence.gatewayInvokeCapabilitySupported) {
    throw new Error(
      'Desktop hosted runtime did not advertise the OpenClaw gateway invoke capability.',
    );
  }

  if (!evidence.gatewayInvokeCapabilityAvailable) {
    throw new Error(
      'Desktop hosted runtime did not expose the OpenClaw gateway invoke capability yet.',
    );
  }

  if (!evidence.openClawRuntimeReady) {
    throw new Error(
      `Desktop hosted runtime is not ready: expected OpenClaw runtime lifecycle "ready" but received "${evidence.openClawRuntimeLifecycle}".`,
    );
  }

  if (!evidence.openClawGatewayReady) {
    throw new Error(
      `Desktop hosted runtime is not ready: expected OpenClaw gateway lifecycle "ready" but received "${evidence.openClawGatewayLifecycle}".`,
    );
  }

  if (!evidence.openClawRuntimeBaseUrl || !evidence.openClawRuntimeWebsocketUrl) {
    throw new Error(
      'Desktop hosted runtime did not expose the OpenClaw runtime urls.',
    );
  }

  if (!evidence.openClawGatewayBaseUrl || !evidence.openClawGatewayWebsocketUrl) {
    throw new Error(
      'Desktop hosted runtime did not expose the OpenClaw gateway urls.',
    );
  }

  if (
    evidence.gatewayWebsocketProbeSupported
    && evidence.gatewayWebsocketDialable === false
  ) {
    throw new Error(
      'Desktop hosted runtime did not accept a WebSocket connection on the OpenClaw gateway yet.',
    );
  }

  if (!evidence.runtimeAndGatewayEndpointIdMatch) {
    throw new Error(
      'Desktop hosted runtime projected OpenClaw runtime and gateway endpoints with mismatched endpoint ids.',
    );
  }

  if (!evidence.runtimeAndGatewayActivePortMatch) {
    throw new Error(
      'Desktop hosted runtime projected OpenClaw runtime and gateway endpoints with mismatched active ports.',
    );
  }

  if (
    !evidence.runtimeAndGatewayBaseUrlMatch
    || !evidence.runtimeAndGatewayWebsocketUrlMatch
  ) {
    throw new Error(
      'Desktop hosted runtime projected mismatched OpenClaw runtime and gateway urls.',
    );
  }

  if (!evidence.builtInInstancePublished) {
    throw new Error('Desktop hosted runtime did not expose the built-in OpenClaw instance.');
  }

  if (!evidence.builtInInstanceBaseUrl) {
    throw new Error(
      'Desktop hosted runtime did not expose the built-in OpenClaw instance baseUrl.',
    );
  }

  if (!evidence.builtInInstanceWebsocketUrl) {
    throw new Error(
      'Desktop hosted runtime did not expose the built-in OpenClaw instance websocketUrl.',
    );
  }

  if (
    !evidence.builtInInstanceBaseUrlMatchesGateway
    || !evidence.builtInInstanceWebsocketUrlMatchesGateway
  ) {
    throw new Error(
      'Desktop hosted runtime projected built-in OpenClaw instance urls that do not match the OpenClaw gateway projection.',
    );
  }

  if (!evidence.builtInInstanceRuntimeKindMatchesOpenClaw) {
    throw new Error(
      `Desktop hosted runtime projected a built-in instance runtimeKind "${evidence.builtInInstanceRuntimeKind}" instead of "openclaw".`,
    );
  }

  if (!evidence.builtInInstanceDeploymentModeMatchesLocalManaged) {
    throw new Error(
      `Desktop hosted runtime projected a built-in instance deploymentMode "${evidence.builtInInstanceDeploymentMode}" instead of "local-managed".`,
    );
  }

  if (!evidence.builtInInstanceTransportKindMatchesOpenClawGateway) {
    throw new Error(
      `Desktop hosted runtime projected a built-in instance transportKind "${evidence.builtInInstanceTransportKind}" instead of "openclawGatewayWs".`,
    );
  }

  if (!evidence.builtInInstanceOnline) {
    throw new Error(
      `Desktop hosted runtime projected the built-in OpenClaw instance is not online yet (status: ${evidence.builtInInstanceStatus}).`,
    );
  }

  if (!evidence.ready) {
    throw new Error(
      'Desktop hosted runtime readiness evidence remained not ready after invariant checks.',
    );
  }
}
