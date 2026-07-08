import type { ComponentPlatformAPI } from './contracts/components.ts';
import type { InternalPlatformAPI } from './contracts/internal.ts';
import type { InstallerPlatformAPI } from './contracts/installer.ts';
import type { KernelPlatformAPI } from './contracts/kernel.ts';
import type { ManagePlatformAPI } from './contracts/manage.ts';
import type { StoragePlatformAPI } from './contracts/storage.ts';
import type { StudioPlatformAPI } from './contracts/studio.ts';
import type { RuntimePlatformAPI } from './contracts/runtime.ts';
import type { PlatformAPI } from './types.ts';
import { WebComponentPlatform } from './webComponents.ts';
import { WebInstallerPlatform } from './webInstaller.ts';
import { WebKernelPlatform } from './webKernel.ts';
import { WebPlatform } from './web.ts';
import { WebRuntimePlatform } from './webRuntime.ts';
import { WebStoragePlatform } from './webStorage.ts';
import { LazyWebStudioPlatform } from './lazyWebStudio.ts';
import type { StudioInstanceDetailRecord, StudioInstanceRecord } from '@sdkwork/clawstudio-types';

export interface PlatformBridge {
  platform: PlatformAPI;
  kernel: KernelPlatformAPI;
  components: ComponentPlatformAPI;
  installer: InstallerPlatformAPI;
  manage: ManagePlatformAPI;
  internal: InternalPlatformAPI;
  runtime: RuntimePlatformAPI;
  storage: StoragePlatformAPI;
  studio: StudioPlatformAPI;
}

const PLATFORM_BRIDGE_GLOBAL_KEY = Symbol.for('sdkwork.claw.platformBridge');

type GlobalPlatformBridgeState = typeof globalThis & {
  [PLATFORM_BRIDGE_GLOBAL_KEY]?: PlatformBridge;
};

function createDefaultManagePlatform(): ManagePlatformAPI {
  return {
    async listRollouts() {
      return {
        items: [],
        total: 0,
      };
    },
    async previewRollout(input) {
      throw new Error(
        `Manage rollout preview is not available for the active platform bridge: ${input.rolloutId}`,
      );
    },
    async startRollout(rolloutId) {
      throw new Error(
        `Manage rollout start is not available for the active platform bridge: ${rolloutId}`,
      );
    },
    async getHostEndpoints() {
      throw new Error('Manage host endpoints are not available for the active platform bridge.');
    },
    async getOpenClawRuntime() {
      throw new Error('Manage OpenClaw runtime is not available for the active platform bridge.');
    },
    async getOpenClawGateway() {
      throw new Error('Manage OpenClaw gateway is not available for the active platform bridge.');
    },
    async invokeOpenClawGateway(_request) {
      throw new Error(
        'Manage OpenClaw gateway invoke is not available for the active platform bridge.',
      );
    },
  };
}

function createDefaultInternalPlatform(): InternalPlatformAPI {
  return {
    async getHostPlatformStatus() {
      return {
        mode: 'web',
        lifecycle: 'inactive',
        hostId: 'web-preview',
        displayName: 'Web Preview',
        version: 'web-preview',
        distributionFamily: 'web',
        deploymentFamily: 'bareMetal',
        desiredStateProjectionVersion: 'phase1',
        rolloutEngineVersion: 'phase1',
        manageBasePath: '/claw/manage/v1',
        internalBasePath: '/claw/internal/v1',
        stateStore: {
          activeProfileId: 'web-preview',
          providers: [],
          profiles: [],
        },
        capabilityKeys: [],
        updatedAt: Date.now(),
      };
    },
    async listNodeSessions() {
      return [];
    },
  };
}

function createDefaultPlatformBridge(): PlatformBridge {
  return {
    platform: new WebPlatform(),
    kernel: new WebKernelPlatform(),
    components: new WebComponentPlatform(),
    installer: new WebInstallerPlatform(),
    manage: createDefaultManagePlatform(),
    internal: createDefaultInternalPlatform(),
    runtime: new WebRuntimePlatform(),
    storage: new WebStoragePlatform(),
    studio: new LazyWebStudioPlatform(),
  };
}

function createUnsupportedPlatformActionError(action: string) {
  return new Error(`${action} is not available for the active platform bridge.`);
}

function readGlobalPlatformBridge() {
  const globalState = globalThis as GlobalPlatformBridgeState;
  return globalState[PLATFORM_BRIDGE_GLOBAL_KEY] ?? null;
}

function writeGlobalPlatformBridge(nextBridge: PlatformBridge) {
  const globalState = globalThis as GlobalPlatformBridgeState;
  globalState[PLATFORM_BRIDGE_GLOBAL_KEY] = nextBridge;
  return nextBridge;
}

function syncPlatformBridge() {
  const globalBridge = readGlobalPlatformBridge();

  if (globalBridge) {
    platformBridge = globalBridge;
    return globalBridge;
  }

  return writeGlobalPlatformBridge(platformBridge);
}

let platformBridge: PlatformBridge =
  readGlobalPlatformBridge() ?? writeGlobalPlatformBridge(createDefaultPlatformBridge());

type TimedPromiseCacheEntry<T> = {
  expiresAt: number;
  promise: Promise<T>;
};

type KernelInfoCacheValue = Awaited<ReturnType<KernelPlatformAPI['getInfo']>>;
type KernelStatusCacheValue = Awaited<ReturnType<KernelPlatformAPI['getStatus']>>;
type RuntimeInfoCacheValue = Awaited<ReturnType<RuntimePlatformAPI['getRuntimeInfo']>>;
type InstallerCatalogCacheValue = Awaited<ReturnType<InstallerPlatformAPI['listInstallCatalog']>>;
type InstallerInspectCacheValue = Awaited<ReturnType<InstallerPlatformAPI['inspectInstall']>>;

const STUDIO_LIST_CACHE_KEY = '__all__';
const STUDIO_LIST_CACHE_TTL_MS = 1_500;
export const STUDIO_DETAIL_CACHE_TTL_MS = 2_000;
const KERNEL_INFO_CACHE_KEY = '__kernel_info__';
const KERNEL_STATUS_CACHE_KEY = '__kernel_status__';
const RUNTIME_INFO_CACHE_KEY = '__runtime_info__';
const KERNEL_CACHE_TTL_MS = 1_500;
const RUNTIME_INFO_CACHE_TTL_MS = 1_500;
const INSTALLER_INSPECT_CACHE_TTL_MS = 1_500;

const studioListCache = new Map<string, TimedPromiseCacheEntry<StudioInstanceRecord[]>>();
const studioDetailCache = new Map<
  string,
  TimedPromiseCacheEntry<StudioInstanceDetailRecord | null>
>();
const kernelInfoCache = new Map<string, TimedPromiseCacheEntry<KernelInfoCacheValue>>();
const kernelStatusCache = new Map<string, TimedPromiseCacheEntry<KernelStatusCacheValue>>();
const runtimeInfoCache = new Map<string, TimedPromiseCacheEntry<RuntimeInfoCacheValue>>();
const installerCatalogCache = new Map<string, TimedPromiseCacheEntry<InstallerCatalogCacheValue>>();
const installerInspectCache = new Map<string, TimedPromiseCacheEntry<InstallerInspectCacheValue>>();

function withTimedPromiseCache<T>(
  cache: Map<string, TimedPromiseCacheEntry<T>>,
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }

  const nextPromise = Promise.resolve()
    .then(loader)
    .catch((error) => {
      const current = cache.get(key);
      if (current?.promise === nextPromise) {
        cache.delete(key);
      }
      throw error;
    });

  cache.set(key, {
    expiresAt: now + ttlMs,
    promise: nextPromise,
  });

  return nextPromise;
}

function invalidateStudioCaches(instanceId?: string) {
  studioListCache.clear();
  if (instanceId) {
    studioDetailCache.delete(instanceId);
    return;
  }

  studioDetailCache.clear();
}

export function invalidateStudioPlatformCaches(instanceId?: string) {
  invalidateStudioCaches(instanceId);
}

function invalidateKernelCaches() {
  kernelInfoCache.clear();
  kernelStatusCache.clear();
}

function invalidateRuntimeCaches() {
  runtimeInfoCache.clear();
}

function invalidateInstallerCaches() {
  installerCatalogCache.clear();
  installerInspectCache.clear();
}

function createInstallerCatalogCacheKey(
  query?: Parameters<InstallerPlatformAPI['listInstallCatalog']>[0],
) {
  return JSON.stringify({
    hostPlatform: query?.hostPlatform ?? null,
  });
}

function normalizeInstallerVariables(variables?: Record<string, string>) {
  if (!variables) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(variables).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey)),
  );
}

function createInstallerInspectCacheKey(
  request: Parameters<InstallerPlatformAPI['inspectInstall']>[0],
) {
  return JSON.stringify({
    softwareName: request.softwareName,
    requestId: request.requestId ?? null,
    registrySource: request.registrySource ?? null,
    installScope: request.installScope ?? null,
    effectiveRuntimePlatform: request.effectiveRuntimePlatform ?? null,
    containerRuntimePreference: request.containerRuntimePreference ?? null,
    wslDistribution: request.wslDistribution ?? null,
    dockerContext: request.dockerContext ?? null,
    dockerHost: request.dockerHost ?? null,
    dryRun: request.dryRun ?? null,
    verbose: request.verbose ?? null,
    sudo: request.sudo ?? null,
    timeoutMs: request.timeoutMs ?? null,
    installerHome: request.installerHome ?? null,
    installRoot: request.installRoot ?? null,
    workRoot: request.workRoot ?? null,
    binDir: request.binDir ?? null,
    dataRoot: request.dataRoot ?? null,
    variables: normalizeInstallerVariables(request.variables),
  });
}

async function invalidateAfter<T>(instanceId: string | undefined, loader: () => Promise<T>) {
  const result = await loader();
  invalidateStudioCaches(instanceId);
  return result;
}

async function invalidateKernelAfter<T>(loader: () => Promise<T>) {
  const result = await loader();
  invalidateKernelCaches();
  invalidateRuntimeCaches();
  return result;
}

async function invalidateInstallerAfter<T>(loader: () => Promise<T>) {
  const result = await loader();
  invalidateInstallerCaches();
  return result;
}

export function configurePlatformBridge(nextBridge: Partial<PlatformBridge>) {
  platformBridge = writeGlobalPlatformBridge({
    ...syncPlatformBridge(),
    ...nextBridge,
  });
  invalidateStudioCaches();
  invalidateKernelCaches();
  invalidateRuntimeCaches();
  invalidateInstallerCaches();
}

export function getPlatformBridge(): PlatformBridge {
  return syncPlatformBridge();
}

export function getInstallerPlatform(): InstallerPlatformAPI {
  return getPlatformBridge().installer;
}

export function getManagePlatform(): ManagePlatformAPI {
  return getPlatformBridge().manage;
}

export function getInternalPlatform(): InternalPlatformAPI {
  return getPlatformBridge().internal;
}

export function getComponentPlatform(): ComponentPlatformAPI {
  return getPlatformBridge().components;
}

export function getKernelPlatform(): KernelPlatformAPI {
  return getPlatformBridge().kernel;
}

export function getRuntimePlatform(): RuntimePlatformAPI {
  return getPlatformBridge().runtime;
}

export function getStoragePlatform(): StoragePlatformAPI {
  return getPlatformBridge().storage;
}

export function getStudioPlatform(): StudioPlatformAPI {
  return getPlatformBridge().studio;
}

export const platform: PlatformAPI = {
  getPlatform: () => getPlatformBridge().platform.getPlatform(),
  getDeviceId: () => getPlatformBridge().platform.getDeviceId(),
  setStorage: (key, value) => getPlatformBridge().platform.setStorage(key, value),
  getStorage: (key) => getPlatformBridge().platform.getStorage(key),
  copy: (text) => getPlatformBridge().platform.copy(text),
  showNotification: (notification) => getPlatformBridge().platform.showNotification(notification),
  openExternal: (url) => getPlatformBridge().platform.openExternal(url),
  openPath: (path) =>
    getPlatformBridge().platform.openPath?.(path) ??
    Promise.reject(createUnsupportedPlatformActionError('Opening filesystem paths')),
  revealPath: (path) =>
    getPlatformBridge().platform.revealPath?.(path) ??
    Promise.reject(createUnsupportedPlatformActionError('Revealing filesystem paths')),
  supportsNativeScreenshot: () => getPlatformBridge().platform.supportsNativeScreenshot(),
  captureScreenshot: () => getPlatformBridge().platform.captureScreenshot(),
  fetchRemoteUrl: (url) => getPlatformBridge().platform.fetchRemoteUrl(url),
  selectFile: (options) => getPlatformBridge().platform.selectFile(options),
  saveFile: (data, filename, options) => getPlatformBridge().platform.saveFile(data, filename, options),
  minimizeWindow: () => getPlatformBridge().platform.minimizeWindow(),
  maximizeWindow: () => getPlatformBridge().platform.maximizeWindow(),
  restoreWindow: () => getPlatformBridge().platform.restoreWindow(),
  isWindowMaximized: () => getPlatformBridge().platform.isWindowMaximized(),
  subscribeWindowMaximized: (listener) =>
    getPlatformBridge().platform.subscribeWindowMaximized(listener),
  closeWindow: () => getPlatformBridge().platform.closeWindow(),
  listDirectory: (path) => getPlatformBridge().platform.listDirectory(path),
  pathExists: (path) => getPlatformBridge().platform.pathExists(path),
  pathExistsForUserTooling: (path) => getPlatformBridge().platform.pathExistsForUserTooling(path),
  getPathInfo: (path) => getPlatformBridge().platform.getPathInfo(path),
  createDirectory: (path) => getPlatformBridge().platform.createDirectory(path),
  removePath: (path) => getPlatformBridge().platform.removePath(path),
  copyPath: (sourcePath, destinationPath) => getPlatformBridge().platform.copyPath(sourcePath, destinationPath),
  movePath: (sourcePath, destinationPath) => getPlatformBridge().platform.movePath(sourcePath, destinationPath),
  readBinaryFile: (path) => getPlatformBridge().platform.readBinaryFile(path),
  writeBinaryFile: (path, content) => getPlatformBridge().platform.writeBinaryFile(path, content),
  readFile: (path) => getPlatformBridge().platform.readFile(path),
  readFileForUserTooling: (path) => getPlatformBridge().platform.readFileForUserTooling(path),
  writeFile: (path, content) => getPlatformBridge().platform.writeFile(path, content),
};

export const storage: StoragePlatformAPI = {
  getStorageInfo: () => getPlatformBridge().storage.getStorageInfo(),
  getText: (request) => getPlatformBridge().storage.getText(request),
  putText: (request) => getPlatformBridge().storage.putText(request),
  delete: (request) => getPlatformBridge().storage.delete(request),
  listKeys: (request) => getPlatformBridge().storage.listKeys(request),
};

export const kernel: KernelPlatformAPI = {
  getInfo: () =>
    withTimedPromiseCache(kernelInfoCache, KERNEL_INFO_CACHE_KEY, KERNEL_CACHE_TTL_MS, () =>
      getPlatformBridge().kernel.getInfo(),
    ),
  getStorageInfo: () => getPlatformBridge().kernel.getStorageInfo(),
  getStatus: () =>
    withTimedPromiseCache(kernelStatusCache, KERNEL_STATUS_CACHE_KEY, KERNEL_CACHE_TTL_MS, () =>
      getPlatformBridge().kernel.getStatus(),
    ),
  ensureRunning: () => invalidateKernelAfter(() => getPlatformBridge().kernel.ensureRunning()),
  restart: () => invalidateKernelAfter(() => getPlatformBridge().kernel.restart()),
  testLocalAiProxyRoute: (routeId) =>
    invalidateKernelAfter(() => getPlatformBridge().kernel.testLocalAiProxyRoute(routeId)),
  listLocalAiProxyRequestLogs: (query) =>
    getPlatformBridge().kernel.listLocalAiProxyRequestLogs(query),
  listLocalAiProxyMessageLogs: (query) =>
    getPlatformBridge().kernel.listLocalAiProxyMessageLogs(query),
  updateLocalAiProxyMessageCapture: (enabled) =>
    invalidateKernelAfter(() => getPlatformBridge().kernel.updateLocalAiProxyMessageCapture(enabled)),
  inspectOpenClawMirrorExport: () => getPlatformBridge().kernel.inspectOpenClawMirrorExport(),
  exportOpenClawMirror: (request) => getPlatformBridge().kernel.exportOpenClawMirror(request),
  inspectOpenClawMirrorImport: (sourcePath) =>
    getPlatformBridge().kernel.inspectOpenClawMirrorImport(sourcePath),
  importOpenClawMirror: (request) => getPlatformBridge().kernel.importOpenClawMirror(request),
};

export const runtime: RuntimePlatformAPI = {
  getRuntimeInfo: () =>
    withTimedPromiseCache(
      runtimeInfoCache,
      RUNTIME_INFO_CACHE_KEY,
      RUNTIME_INFO_CACHE_TTL_MS,
      () => getPlatformBridge().runtime.getRuntimeInfo(),
    ),
  setAppLanguage: async (language) => {
    const result = await getPlatformBridge().runtime.setAppLanguage(language);
    invalidateRuntimeCaches();
    return result;
  },
  submitProcessJob: (profileId) => getPlatformBridge().runtime.submitProcessJob(profileId),
  getJob: (id) => getPlatformBridge().runtime.getJob(id),
  listJobs: () => getPlatformBridge().runtime.listJobs(),
  cancelJob: (id) => getPlatformBridge().runtime.cancelJob(id),
  subscribeJobUpdates: (listener) => getPlatformBridge().runtime.subscribeJobUpdates(listener),
  subscribeProcessOutput: (listener) =>
    getPlatformBridge().runtime.subscribeProcessOutput(listener),
  subscribeBuiltInOpenClawStatusChanged: (listener) =>
    getPlatformBridge().runtime.subscribeBuiltInOpenClawStatusChanged(listener),
};

export const manage: ManagePlatformAPI = {
  listRollouts: () => getPlatformBridge().manage.listRollouts(),
  previewRollout: (input) => getPlatformBridge().manage.previewRollout(input),
  startRollout: (rolloutId) => getPlatformBridge().manage.startRollout(rolloutId),
  getHostEndpoints: () => getPlatformBridge().manage.getHostEndpoints(),
  getOpenClawRuntime: () => getPlatformBridge().manage.getOpenClawRuntime(),
  getOpenClawGateway: () => getPlatformBridge().manage.getOpenClawGateway(),
  invokeOpenClawGateway: (request) => getPlatformBridge().manage.invokeOpenClawGateway(request),
};

export const internal: InternalPlatformAPI = {
  getHostPlatformStatus: () => getPlatformBridge().internal.getHostPlatformStatus(),
  listNodeSessions: () => getPlatformBridge().internal.listNodeSessions(),
};

export const installer: InstallerPlatformAPI = {
  listInstallCatalog: (query) =>
    withTimedPromiseCache(
      installerCatalogCache,
      createInstallerCatalogCacheKey(query),
      INSTALLER_INSPECT_CACHE_TTL_MS,
      () => getPlatformBridge().installer.listInstallCatalog(query),
    ),
  inspectInstall: (request) =>
    withTimedPromiseCache(
      installerInspectCache,
      createInstallerInspectCacheKey(request),
      INSTALLER_INSPECT_CACHE_TTL_MS,
      () => getPlatformBridge().installer.inspectInstall(request),
    ),
  runInstallDependencies: (request) =>
    invalidateInstallerAfter(() => getPlatformBridge().installer.runInstallDependencies(request)),
  runInstall: (request) =>
    invalidateInstallerAfter(() => getPlatformBridge().installer.runInstall(request)),
  runUninstall: (request) =>
    invalidateInstallerAfter(() => getPlatformBridge().installer.runUninstall(request)),
  subscribeInstallProgress: (listener) =>
    getPlatformBridge().installer.subscribeInstallProgress(listener),
};

export const studio: StudioPlatformAPI = {
  listInstances: () =>
    withTimedPromiseCache(studioListCache, STUDIO_LIST_CACHE_KEY, STUDIO_LIST_CACHE_TTL_MS, () =>
      getPlatformBridge().studio.listInstances(),
    ),
  getInstance: (id) => getPlatformBridge().studio.getInstance(id),
  getInstanceDetail: (id) =>
    withTimedPromiseCache(studioDetailCache, id, STUDIO_DETAIL_CACHE_TTL_MS, () =>
      getPlatformBridge().studio.getInstanceDetail(id),
    ),
  getKernelAgentCreationCapability: async (instanceId) => {
    const studioBridge = getPlatformBridge().studio;
    const bridgeMethod = studioBridge.getKernelAgentCreationCapability;
    if (!bridgeMethod) {
      throw new Error(
        'Studio kernel agent creation capability is not available for the active platform bridge.',
      );
    }
    return bridgeMethod.call(studioBridge, instanceId);
  },
  createKernelAgent: async (input) => {
    const studioBridge = getPlatformBridge().studio;
    const bridgeMethod = studioBridge.createKernelAgent;
    if (!bridgeMethod) {
      throw new Error(
        'Studio kernel agent creation is not available for the active platform bridge.',
      );
    }
    const result = await bridgeMethod.call(studioBridge, input);
    invalidateStudioCaches(input.instanceId);
    return result;
  },
  listKernelChatAgentProfiles: async (instanceId) => {
    const studioBridge = getPlatformBridge().studio;
    const bridgeMethod = studioBridge.listKernelChatAgentProfiles;
    if (!bridgeMethod) {
      throw new Error(
        'Studio kernel chat agent profiles are not available for the active platform bridge.',
      );
    }
    return bridgeMethod.call(studioBridge, instanceId);
  },
  listPersistedKernelChatAgents: async (instanceId) => {
    const studioBridge = getPlatformBridge().studio;
    const bridgeMethod = studioBridge.listPersistedKernelChatAgents;
    if (!bridgeMethod) {
      throw new Error(
        'Studio persisted kernel chat agents are not available for the active platform bridge.',
      );
    }
    return bridgeMethod.call(studioBridge, instanceId);
  },
  replacePersistedKernelChatAgents: async (instanceId, records) => {
    const studioBridge = getPlatformBridge().studio;
    const bridgeMethod = studioBridge.replacePersistedKernelChatAgents;
    if (!bridgeMethod) {
      throw new Error(
        'Studio persisted kernel chat agent writes are not available for the active platform bridge.',
      );
    }
    return bridgeMethod.call(studioBridge, instanceId, records);
  },
  listKernelChatSessions: async (instanceId) => {
    const studioBridge = getPlatformBridge().studio;
    const bridgeMethod = studioBridge.listKernelChatSessions;
    if (!bridgeMethod) {
      throw new Error(
        'Studio kernel chat sessions are not available for the active platform bridge.',
      );
    }
    return bridgeMethod.call(studioBridge, instanceId);
  },
  getKernelChatSession: async (instanceId, sessionId) => {
    const studioBridge = getPlatformBridge().studio;
    const bridgeMethod = studioBridge.getKernelChatSession;
    if (!bridgeMethod) {
      throw new Error(
        'Studio kernel chat session lookup is not available for the active platform bridge.',
      );
    }
    return bridgeMethod.call(studioBridge, instanceId, sessionId);
  },
  createKernelChatSession: async (input) => {
    const studioBridge = getPlatformBridge().studio;
    const bridgeMethod = studioBridge.createKernelChatSession;
    if (!bridgeMethod) {
      throw new Error(
        'Studio kernel chat session creation is not available for the active platform bridge.',
      );
    }
    return bridgeMethod.call(studioBridge, input);
  },
  listKernelChatRuns: async (instanceId, sessionId) => {
    const studioBridge = getPlatformBridge().studio;
    const bridgeMethod = studioBridge.listKernelChatRuns;
    if (!bridgeMethod) {
      throw new Error(
        'Studio kernel chat run listing is not available for the active platform bridge.',
      );
    }
    return bridgeMethod.call(studioBridge, instanceId, sessionId);
  },
  getKernelChatRun: async (instanceId, sessionId, runId) => {
    const studioBridge = getPlatformBridge().studio;
    const bridgeMethod = studioBridge.getKernelChatRun;
    if (!bridgeMethod) {
      throw new Error(
        'Studio kernel chat run lookup is not available for the active platform bridge.',
      );
    }
    return bridgeMethod.call(studioBridge, instanceId, sessionId, runId);
  },
  patchKernelChatSession: async (input) => {
    const studioBridge = getPlatformBridge().studio;
    const bridgeMethod = studioBridge.patchKernelChatSession;
    if (!bridgeMethod) {
      throw new Error(
        'Studio kernel chat session mutation is not available for the active platform bridge.',
      );
    }
    return bridgeMethod.call(studioBridge, input);
  },
  deleteKernelChatSession: async (instanceId, sessionId) => {
    const studioBridge = getPlatformBridge().studio;
    const bridgeMethod = studioBridge.deleteKernelChatSession;
    if (!bridgeMethod) {
      throw new Error(
        'Studio kernel chat session deletion is not available for the active platform bridge.',
      );
    }
    return bridgeMethod.call(studioBridge, instanceId, sessionId);
  },
  startKernelChatRun: async (input) => {
    const studioBridge = getPlatformBridge().studio;
    const bridgeMethod = studioBridge.startKernelChatRun;
    if (!bridgeMethod) {
      throw new Error(
        'Studio kernel chat run start is not available for the active platform bridge.',
      );
    }
    return bridgeMethod.call(studioBridge, input);
  },
  abortKernelChatRun: async (instanceId, sessionId, runId) => {
    const studioBridge = getPlatformBridge().studio;
    const bridgeMethod = studioBridge.abortKernelChatRun;
    if (!bridgeMethod) {
      throw new Error(
        'Studio kernel chat run abort is not available for the active platform bridge.',
      );
    }
    return bridgeMethod.call(studioBridge, instanceId, sessionId, runId);
  },
  loadKernelChatMessages: async (instanceId, sessionId) => {
    const studioBridge = getPlatformBridge().studio;
    const bridgeMethod = studioBridge.loadKernelChatMessages;
    if (!bridgeMethod) {
      throw new Error(
        'Studio kernel chat message loading is not available for the active platform bridge.',
      );
    }
    return bridgeMethod.call(studioBridge, instanceId, sessionId);
  },
  invokeOpenClawGateway: async (instanceId, request, options) => {
    const studioBridge = getPlatformBridge().studio;
    if (!studioBridge.invokeOpenClawGateway) {
      throw new Error(
        'Studio OpenClaw gateway invoke is not available for the active platform bridge.',
      );
    }

    return studioBridge.invokeOpenClawGateway(instanceId, request, options);
  },
  createInstance: async (input) => {
    const instance = await getPlatformBridge().studio.createInstance(input);
    invalidateStudioCaches(instance.id);
    return instance;
  },
  updateInstance: (id, input) =>
    invalidateAfter(id, () => getPlatformBridge().studio.updateInstance(id, input)),
  deleteInstance: (id) =>
    invalidateAfter(id, () => getPlatformBridge().studio.deleteInstance(id)),
  startInstance: (id) =>
    invalidateAfter(id, () => getPlatformBridge().studio.startInstance(id)),
  stopInstance: (id) =>
    invalidateAfter(id, () => getPlatformBridge().studio.stopInstance(id)),
  restartInstance: (id) =>
    invalidateAfter(id, () => getPlatformBridge().studio.restartInstance(id)),
  setInstanceStatus: (id, status) =>
    invalidateAfter(id, () => getPlatformBridge().studio.setInstanceStatus(id, status)),
  getInstanceConfig: (id) => getPlatformBridge().studio.getInstanceConfig(id),
  updateInstanceConfig: (id, config) =>
    invalidateAfter(id, () => getPlatformBridge().studio.updateInstanceConfig(id, config)),
  getInstanceLogs: (id) => getPlatformBridge().studio.getInstanceLogs(id),
  createInstanceTask: (instanceId, payload) =>
    invalidateAfter(instanceId, () =>
      getPlatformBridge().studio.createInstanceTask(instanceId, payload),
    ),
  updateInstanceTask: (instanceId, taskId, payload) =>
    invalidateAfter(instanceId, () =>
      getPlatformBridge().studio.updateInstanceTask(instanceId, taskId, payload),
    ),
  updateInstanceFileContent: (instanceId, fileId, content) =>
    invalidateAfter(instanceId, () =>
      getPlatformBridge().studio.updateInstanceFileContent(instanceId, fileId, content),
    ),
  updateInstanceLlmProviderConfig: (instanceId, providerId, update) =>
    invalidateAfter(instanceId, () =>
      getPlatformBridge().studio.updateInstanceLlmProviderConfig(instanceId, providerId, update),
    ),
  cloneInstanceTask: (instanceId, taskId, name) =>
    invalidateAfter(instanceId, () =>
      getPlatformBridge().studio.cloneInstanceTask(instanceId, taskId, name),
    ),
  runInstanceTaskNow: (instanceId, taskId) =>
    invalidateAfter(instanceId, () =>
      getPlatformBridge().studio.runInstanceTaskNow(instanceId, taskId),
    ),
  listInstanceTaskExecutions: (instanceId, taskId) =>
    getPlatformBridge().studio.listInstanceTaskExecutions(instanceId, taskId),
  updateInstanceTaskStatus: (instanceId, taskId, status) =>
    invalidateAfter(instanceId, () =>
      getPlatformBridge().studio.updateInstanceTaskStatus(instanceId, taskId, status),
    ),
  deleteInstanceTask: (instanceId, taskId) =>
    invalidateAfter(instanceId, () =>
      getPlatformBridge().studio.deleteInstanceTask(instanceId, taskId),
    ),
  listConversations: (instanceId) => getPlatformBridge().studio.listConversations(instanceId),
  putConversation: (record) => getPlatformBridge().studio.putConversation(record),
  deleteConversation: (id) => getPlatformBridge().studio.deleteConversation(id),
};

export const components: ComponentPlatformAPI = {
  listComponents: () => getPlatformBridge().components.listComponents(),
  controlComponent: (request) => getPlatformBridge().components.controlComponent(request),
};
