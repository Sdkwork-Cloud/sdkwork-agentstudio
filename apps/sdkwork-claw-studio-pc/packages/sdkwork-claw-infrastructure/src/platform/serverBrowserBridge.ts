import {
  configurePlatformBridge,
  getPlatformBridge,
  type PlatformBridge,
} from './registry.ts';
import type {
  RuntimeInfo,
  RuntimePlatformKind,
  RuntimeStartupContext,
} from './contracts/runtime.ts';
import { createBrowserSessionAwareFetch } from './browserSessionFetch.ts';
import { WebInternalPlatform, DEFAULT_INTERNAL_BASE_PATH } from './webInternal.ts';
import { WebManagePlatform, DEFAULT_MANAGE_BASE_PATH } from './webManage.ts';
import { WebHostedStudioPlatform, DEFAULT_STUDIO_API_BASE_PATH } from './webHostedStudio.ts';
import type { WebPlatformFetch } from './webHttp.ts';
import { resolveWebPlatformFetch } from './webHttp.ts';
import { WebPlatform } from './web.ts';
import { WebRuntimePlatform } from './webRuntime.ts';

export const SERVER_HOST_MODE_META_NAME = 'sdkwork-claw-host-mode';
export const SERVER_API_BASE_PATH_META_NAME = 'sdkwork-claw-api-base-path';
export const SERVER_MANAGE_BASE_PATH_META_NAME = 'sdkwork-claw-manage-base-path';
export const SERVER_INTERNAL_BASE_PATH_META_NAME = 'sdkwork-claw-internal-base-path';
export const SERVER_DISTRIBUTION_FAMILY_META_NAME = 'sdkwork-claw-distribution-family';
export const SERVER_DEPLOYMENT_FAMILY_META_NAME = 'sdkwork-claw-deployment-family';
export const SERVER_ACCELERATOR_PROFILE_META_NAME = 'sdkwork-claw-accelerator-profile';
export const SERVER_BROWSER_SESSION_TOKEN_META_NAME = 'sdkwork-claw-browser-session-token';
export const SERVER_BROWSER_BOOTSTRAP_DESCRIPTOR_PATH = '/sdkwork-claw-bootstrap.json';

export interface ServerBrowserPlatformBridgeConfig {
  mode: 'server' | 'desktopCombined';
  distributionFamily: 'server' | 'desktop';
  deploymentFamily: 'bareMetal' | 'container' | 'kubernetes';
  acceleratorProfile: 'cpu' | 'nvidia-cuda' | 'amd-rocm' | null;
  apiBasePath: string;
  manageBasePath: string;
  internalBasePath: string;
  browserBaseUrl: string | null;
  browserSessionToken: string | null;
}

export interface ServerBrowserBridgeMetaElementLike {
  getAttribute(name: string): string | null;
}

export interface ServerBrowserBridgeDocumentLike {
  querySelector(selector: string): ServerBrowserBridgeMetaElementLike | null;
  baseURI?: string | null;
}

export interface ConfigureServerBrowserPlatformBridgeOptions {
  document?: ServerBrowserBridgeDocumentLike | null;
  fetchImpl?: WebPlatformFetch;
  browserBaseUrl?: string | null;
}

interface ServerBrowserBootstrapDescriptor {
  mode: 'server' | 'desktopCombined';
  distributionFamily: 'server' | 'desktop';
  deploymentFamily: 'bareMetal' | 'container' | 'kubernetes';
  acceleratorProfile: 'cpu' | 'nvidia-cuda' | 'amd-rocm' | null;
  apiBasePath: string;
  manageBasePath: string;
  internalBasePath: string;
  browserSessionToken: string | null;
}

type ServerBrowserBridgeConfigResolver = () => ServerBrowserPlatformBridgeConfig;

export function readServerBrowserPlatformBridgeConfig(
  options: Pick<ConfigureServerBrowserPlatformBridgeOptions, 'document' | 'browserBaseUrl'> = {},
): ServerBrowserPlatformBridgeConfig | null {
  const documentLike = options.document ?? resolveDocumentLike();
  const mode = readMetaContent(documentLike, SERVER_HOST_MODE_META_NAME);

  if (mode !== 'server' && mode !== 'desktopCombined') {
    return null;
  }

  return {
    mode,
    distributionFamily:
      normalizeDistributionFamily(
        readMetaContent(documentLike, SERVER_DISTRIBUTION_FAMILY_META_NAME),
      ) ?? deriveDistributionFamily(mode),
    deploymentFamily:
      normalizeDeploymentFamily(
        readMetaContent(documentLike, SERVER_DEPLOYMENT_FAMILY_META_NAME),
      ) ?? 'bareMetal',
    acceleratorProfile: normalizeAcceleratorProfile(
      readMetaContent(documentLike, SERVER_ACCELERATOR_PROFILE_META_NAME),
    ),
    apiBasePath:
      readMetaContent(documentLike, SERVER_API_BASE_PATH_META_NAME) ??
      DEFAULT_STUDIO_API_BASE_PATH,
    manageBasePath:
      readMetaContent(documentLike, SERVER_MANAGE_BASE_PATH_META_NAME) ??
      DEFAULT_MANAGE_BASE_PATH,
    internalBasePath:
      readMetaContent(documentLike, SERVER_INTERNAL_BASE_PATH_META_NAME) ??
      DEFAULT_INTERNAL_BASE_PATH,
    browserBaseUrl:
      normalizeBrowserBaseUrl(options.browserBaseUrl) ??
      resolveBrowserBaseUrl(documentLike),
    browserSessionToken: readMetaContent(
      documentLike,
      SERVER_BROWSER_SESSION_TOKEN_META_NAME,
    ),
  };
}

export function createServerBrowserPlatformBridge(
  config: ServerBrowserPlatformBridgeConfig,
  options: Pick<ConfigureServerBrowserPlatformBridgeOptions, 'fetchImpl'> = {},
): Pick<PlatformBridge, 'platform' | 'manage' | 'internal' | 'runtime' | 'studio'> {
  return createLiveServerBrowserPlatformBridge(() => config, options);
}

function createLiveServerBrowserPlatformBridge(
  resolveConfig: ServerBrowserBridgeConfigResolver,
  options: Pick<ConfigureServerBrowserPlatformBridgeOptions, 'fetchImpl'> = {},
): Pick<PlatformBridge, 'platform' | 'manage' | 'internal' | 'runtime' | 'studio'> {
  return {
    platform: new HostedBrowserPlatform(() => resolveConfig().mode),
    studio: new WebHostedStudioPlatform({
      resolveBasePath: async () => resolveConfig().apiBasePath,
      fetchImpl: createDeferredServerBrowserFetch(resolveConfig, options.fetchImpl),
    }),
    manage: createLiveServerBrowserManagePlatform(resolveConfig, options.fetchImpl),
    internal: createLiveServerBrowserInternalPlatform(resolveConfig, options.fetchImpl),
    runtime: new HostedBrowserRuntimePlatform(() =>
      createHostedBrowserStartupContext(resolveConfig()),
    ),
  };
}

export function configureServerBrowserPlatformBridge(
  options: ConfigureServerBrowserPlatformBridgeOptions = {},
): boolean {
  const config = readServerBrowserPlatformBridgeConfig({
    document: options.document,
    browserBaseUrl: options.browserBaseUrl,
  });

  if (!config) {
    return false;
  }

  if (isDesktopPlatformBridgeActive()) {
    return false;
  }

  const resolveConfig = () =>
    readServerBrowserPlatformBridgeConfig({
      document: options.document,
      browserBaseUrl: options.browserBaseUrl,
    }) ?? config;

  configurePlatformBridge(
    createLiveServerBrowserPlatformBridge(resolveConfig, {
      fetchImpl: options.fetchImpl,
    }),
  );

  return true;
}

export async function bootstrapServerBrowserPlatformBridge(
  options: ConfigureServerBrowserPlatformBridgeOptions = {},
): Promise<boolean> {
  if (isDesktopPlatformBridgeActive()) {
    return false;
  }

  const config = await readStructuredServerBrowserPlatformBridgeConfig(options);

  if (!config) {
    return configureServerBrowserPlatformBridge(options);
  }

  configurePlatformBridge(
    createServerBrowserPlatformBridge(config, {
      fetchImpl: options.fetchImpl,
    }),
  );

  return true;
}

function isDesktopPlatformBridgeActive(): boolean {
  try {
    const activePlatform = getPlatformBridge().platform;
    return activePlatform.getPlatform() === 'desktop' &&
      activePlatform.supportsNativeScreenshot();
  } catch {
    return false;
  }
}

function resolveDocumentLike(): ServerBrowserBridgeDocumentLike | null {
  if (typeof document === 'undefined') {
    return null;
  }

  return document as unknown as ServerBrowserBridgeDocumentLike;
}

function readMetaContent(
  documentLike: ServerBrowserBridgeDocumentLike | null,
  name: string,
): string | null {
  return documentLike?.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ?? null;
}

async function readStructuredServerBrowserPlatformBridgeConfig(
  options: ConfigureServerBrowserPlatformBridgeOptions,
): Promise<ServerBrowserPlatformBridgeConfig | null> {
  const documentLike = options.document ?? resolveDocumentLike();
  const browserBaseUrl =
    normalizeBrowserBaseUrl(options.browserBaseUrl) ??
    resolveBrowserBaseUrl(documentLike);
  const descriptor = await fetchServerBrowserBootstrapDescriptor(
    browserBaseUrl,
    options.fetchImpl,
  );

  if (!descriptor) {
    return null;
  }

  return {
    ...descriptor,
    browserBaseUrl,
  };
}

async function fetchServerBrowserBootstrapDescriptor(
  browserBaseUrl: string | null,
  fetchImpl?: WebPlatformFetch,
): Promise<ServerBrowserBootstrapDescriptor | null> {
  if (!browserBaseUrl) {
    return null;
  }

  try {
    const response = await resolveWebPlatformFetch(fetchImpl)(
      resolveServerBrowserBootstrapDescriptorUrl(browserBaseUrl),
      {
        method: 'GET',
        headers: {
          accept: 'application/json',
        },
      },
    );

    if (!response.ok) {
      return null;
    }

    return normalizeServerBrowserBootstrapDescriptor(await response.json());
  } catch {
    return null;
  }
}

function resolveServerBrowserBootstrapDescriptorUrl(browserBaseUrl: string): string {
  const normalizedBrowserBaseUrl = browserBaseUrl.endsWith('/')
    ? browserBaseUrl
    : `${browserBaseUrl}/`;

  try {
    return new URL(
      SERVER_BROWSER_BOOTSTRAP_DESCRIPTOR_PATH,
      normalizedBrowserBaseUrl,
    ).toString();
  } catch {
    return `${browserBaseUrl.replace(/\/+$/, '')}${SERVER_BROWSER_BOOTSTRAP_DESCRIPTOR_PATH}`;
  }
}

function deriveDistributionFamily(mode: ServerBrowserPlatformBridgeConfig['mode']): 'server' | 'desktop' {
  return mode === 'server' ? 'server' : 'desktop';
}

function normalizeDistributionFamily(value: string | null): 'server' | 'desktop' | null {
  if (value === 'server' || value === 'desktop') {
    return value;
  }

  return null;
}

function normalizeDeploymentFamily(
  value: string | null,
): 'bareMetal' | 'container' | 'kubernetes' | null {
  if (value === 'bareMetal' || value === 'container' || value === 'kubernetes') {
    return value;
  }

  return null;
}

function normalizeAcceleratorProfile(
  value: string | null,
): 'cpu' | 'nvidia-cuda' | 'amd-rocm' | null {
  if (value === 'cpu' || value === 'nvidia-cuda' || value === 'amd-rocm') {
    return value;
  }

  return null;
}

function createHostedBrowserStartupContext(
  config: ServerBrowserPlatformBridgeConfig,
): RuntimeStartupContext {
  return {
    hostMode: config.mode,
    distributionFamily: config.distributionFamily,
    deploymentFamily: config.deploymentFamily,
    acceleratorProfile: config.acceleratorProfile,
    hostedBrowser: true,
    apiBasePath: config.apiBasePath,
    manageBasePath: config.manageBasePath,
    internalBasePath: config.internalBasePath,
    browserBaseUrl: config.browserBaseUrl,
  };
}

class HostedBrowserRuntimePlatform extends WebRuntimePlatform {
  private readonly resolveStartupContext: () => RuntimeStartupContext;

  constructor(resolveStartupContext: () => RuntimeStartupContext) {
    super();
    this.resolveStartupContext = resolveStartupContext;
  }

  async getRuntimeInfo(): Promise<RuntimeInfo> {
    const runtimeInfo = await super.getRuntimeInfo();
    const startup = this.resolveStartupContext();

    return {
      ...runtimeInfo,
      platform: deriveHostedBrowserRuntimePlatform(startup),
      startup,
    };
  }
}

class HostedBrowserPlatform extends WebPlatform {
  private readonly resolveMode: () => ServerBrowserPlatformBridgeConfig['mode'];

  constructor(resolveMode: () => ServerBrowserPlatformBridgeConfig['mode']) {
    super();
    this.resolveMode = resolveMode;
  }

  getPlatform(): 'web' | 'desktop' {
    return this.resolveMode() === 'desktopCombined' ? 'desktop' : 'web';
  }
}

function deriveHostedBrowserRuntimePlatform(
  startup: RuntimeStartupContext,
): RuntimePlatformKind {
  return startup.distributionFamily === 'desktop' ||
    startup.hostMode === 'desktopCombined'
    ? 'desktop'
    : 'server';
}

function createLiveServerBrowserManagePlatform(
  resolveConfig: ServerBrowserBridgeConfigResolver,
  fetchImpl?: WebPlatformFetch,
): PlatformBridge['manage'] {
  return {
    async listRollouts() {
      return createHostedManagePlatform(resolveConfig(), fetchImpl).listRollouts();
    },
    async previewRollout(input) {
      return createHostedManagePlatform(resolveConfig(), fetchImpl).previewRollout(input);
    },
    async startRollout(rolloutId) {
      return createHostedManagePlatform(resolveConfig(), fetchImpl).startRollout(rolloutId);
    },
    async getHostEndpoints() {
      return createHostedManagePlatform(resolveConfig(), fetchImpl).getHostEndpoints();
    },
    async getOpenClawRuntime() {
      return createHostedManagePlatform(resolveConfig(), fetchImpl).getOpenClawRuntime();
    },
    async getOpenClawGateway() {
      return createHostedManagePlatform(resolveConfig(), fetchImpl).getOpenClawGateway();
    },
    async invokeOpenClawGateway(request) {
      return createHostedManagePlatform(resolveConfig(), fetchImpl).invokeOpenClawGateway(request);
    },
  };
}

function createLiveServerBrowserInternalPlatform(
  resolveConfig: ServerBrowserBridgeConfigResolver,
  fetchImpl?: WebPlatformFetch,
): PlatformBridge['internal'] {
  return {
    async getHostPlatformStatus() {
      return createHostedInternalPlatform(resolveConfig(), fetchImpl).getHostPlatformStatus();
    },
    async listNodeSessions() {
      return createHostedInternalPlatform(resolveConfig(), fetchImpl).listNodeSessions();
    },
  };
}

function createHostedManagePlatform(
  config: ServerBrowserPlatformBridgeConfig,
  fetchImpl?: WebPlatformFetch,
): WebManagePlatform {
  return new WebManagePlatform(
    config.manageBasePath,
    createHostedServerBrowserFetch(config, fetchImpl),
  );
}

function createHostedInternalPlatform(
  config: ServerBrowserPlatformBridgeConfig,
  fetchImpl?: WebPlatformFetch,
): WebInternalPlatform {
  return new WebInternalPlatform(
    config.internalBasePath,
    createHostedServerBrowserFetch(config, fetchImpl),
  );
}

function createDeferredServerBrowserFetch(
  resolveConfig: ServerBrowserBridgeConfigResolver,
  fetchImpl?: WebPlatformFetch,
): WebPlatformFetch {
  return async (input, init) =>
    createHostedServerBrowserFetch(resolveConfig(), fetchImpl)(input, init);
}

function createHostedServerBrowserFetch(
  config: ServerBrowserPlatformBridgeConfig,
  fetchImpl?: WebPlatformFetch,
): WebPlatformFetch {
  const browserSessionAwareFetch = createBrowserSessionAwareFetch(
    fetchImpl,
    config.browserSessionToken,
  );

  return resolveWebPlatformFetch(browserSessionAwareFetch ?? fetchImpl);
}

function resolveBrowserBaseUrl(
  documentLike: ServerBrowserBridgeDocumentLike | null,
): string | null {
  const globalOrigin =
    typeof location === 'undefined' ? null : normalizeBrowserBaseUrl(location.origin);
  if (globalOrigin) {
    return globalOrigin;
  }

  const baseUri = normalizeBrowserBaseUrl(documentLike?.baseURI ?? null);
  if (!baseUri) {
    return null;
  }

  try {
    return new URL(baseUri).origin;
  } catch {
    return baseUri;
  }
}

function normalizeBrowserBaseUrl(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeServerBrowserBootstrapDescriptor(
  value: unknown,
): ServerBrowserBootstrapDescriptor | null {
  if (!isRecord(value)) {
    return null;
  }

  const mode = value.mode;
  if (mode !== 'server' && mode !== 'desktopCombined') {
    return null;
  }

  return {
    mode,
    distributionFamily:
      normalizeDistributionFamily(readStringField(value, 'distributionFamily')) ??
      deriveDistributionFamily(mode),
    deploymentFamily:
      normalizeDeploymentFamily(readStringField(value, 'deploymentFamily')) ??
      'bareMetal',
    acceleratorProfile: normalizeAcceleratorProfile(
      readStringField(value, 'acceleratorProfile'),
    ),
    apiBasePath:
      readStringField(value, 'apiBasePath') ?? DEFAULT_STUDIO_API_BASE_PATH,
    manageBasePath:
      readStringField(value, 'manageBasePath') ?? DEFAULT_MANAGE_BASE_PATH,
    internalBasePath:
      readStringField(value, 'internalBasePath') ?? DEFAULT_INTERNAL_BASE_PATH,
    browserSessionToken: readStringField(value, 'browserSessionToken'),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readStringField(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  return typeof value === 'string' ? value : null;
}
