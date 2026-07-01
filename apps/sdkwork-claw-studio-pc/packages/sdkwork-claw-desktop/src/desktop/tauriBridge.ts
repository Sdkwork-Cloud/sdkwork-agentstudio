import {
  WebManagePlatform,
  WebPlatform,
  WebInternalPlatform,
  configurePlatformBridge,
} from '@sdkwork/claw-infrastructure';
import type {
  HostPlatformStatusRecord,
  InstallCatalogEntry,
  InstallCatalogQuery,
  InstallDependencyRequest,
  InstallDependencyResult,
  InternalNodeSessionRecord,
  LocalAiProxyMessageCaptureSettings,
  LocalAiProxyMessageLogRecord,
  LocalAiProxyMessageLogsQuery,
  ManageHostEndpointRecord,
  ManageOpenClawGatewayInvokeRequest,
  ManageOpenClawGatewayRecord,
  ManageOpenClawRuntimeRecord,
  OpenClawMirrorExportPreview,
  OpenClawMirrorExportRequest,
  OpenClawMirrorExportResult,
  OpenClawMirrorImportPreview,
  OpenClawMirrorImportRequest,
  OpenClawMirrorImportResult,
  LocalAiProxyRequestLogRecord,
  LocalAiProxyRequestLogsQuery,
  LocalAiProxyRouteTestRecord,
  ManageRolloutListResult,
  ManageRolloutPreview,
  ManageRolloutRecord,
  PaginatedResult,
  PreviewRolloutRequest,
  InstallAssessmentResult,
  InstallProgressEvent,
  InstallRequest,
  InstallResult,
  UninstallRequest,
  UninstallResult,
  PlatformCapturedScreenshot,
  PlatformFetchedRemoteUrl,
  PlatformFileEntry,
  PlatformNotificationRequest,
  PlatformPathInfo,
  PlatformSaveFileOptions,
  PlatformSelectFileOptions,
  RuntimeAppInfo,
  RuntimeBuiltInOpenClawStatusChangedEvent,
  RuntimeConfigInfo,
  RuntimeDesktopKernelHostInfo,
  RuntimeDesktopKernelInfo,
  RuntimeEventUnsubscribe,
  RuntimeInfo,
  RuntimeJobUpdateEvent,
  RuntimeLanguagePreference,
  RuntimePathsInfo,
  RuntimeProcessOutputEvent,
  RuntimeStorageInfo,
  RuntimeSystemInfo,
  StudioInstanceRecord,
  StorageDeleteRequest,
  StorageDeleteResult,
  StorageGetTextRequest,
  StorageGetTextResult,
  StorageListKeysRequest,
  StorageListKeysResult,
  StoragePutTextRequest,
  StoragePutTextResult,
} from '@sdkwork/claw-infrastructure';
import { DESKTOP_COMMANDS, DESKTOP_EVENTS } from './catalog';
import {
  createDeferredDesktopHostedStudioPlatform as createStaticDeferredDesktopHostedStudioPlatform,
  createDesktopHostedInternalPlatform as createStaticDesktopHostedInternalPlatform,
  createDesktopHostedManagePlatform as createStaticDesktopHostedManagePlatform,
  normalizeDesktopHostedRuntimeDescriptor,
  probeDesktopHostedControlPlane as probeStaticDesktopHostedControlPlane,
  probeDesktopHostedRuntimeReadiness as probeStaticDesktopHostedRuntimeReadiness,
  type DesktopHostedRuntimeDescriptor,
  type DesktopHostedRuntimeReadinessSnapshot,
} from './desktopHostedBridge';
import {
  controlDesktopComponent,
  desktopComponentsApi,
  listDesktopComponents,
  restartDesktopComponent,
  startDesktopComponent,
  stopDesktopComponent,
} from './componentsBridge';
import {
  createDesktopHostRuntimeResolver,
  retryDesktopHostRuntimeOperation,
  type RetryDesktopHostRuntimeOperationRetryContext,
} from './desktopHostRuntimeResolver';
import {
  DesktopBridgeError,
  getDesktopWindow,
  invokeDesktopCommand,
  invokeTauriRuntimeCommand,
  isTauriRuntime,
  listenDesktopEvent,
  runDesktopOnly,
  runDesktopOrFallback,
  waitForTauriRuntime,
} from './runtime';
import {
  desktopLegacyStudioCompatApi,
  studioAbortKernelChatRun,
  studioCreateKernelAgent,
  studioCreateKernelChatSession,
  studioDeleteKernelChatSession,
  studioGetKernelChatRun,
  studioGetKernelAgentCreationCapability,
  studioGetKernelChatSession,
  studioListKernelChatAgentProfiles,
  studioListPersistedKernelChatAgents,
  studioListKernelChatRuns,
  studioListKernelChatSessions,
  studioLoadKernelChatMessages,
  studioPatchKernelChatSession,
  studioReplacePersistedKernelChatAgents,
  studioStartKernelChatRun,
} from './studioCommandCompat';

export {
  controlDesktopComponent,
  listDesktopComponents,
  restartDesktopComponent,
  startDesktopComponent,
  stopDesktopComponent,
} from './componentsBridge';
export {
  desktopLegacyStudioCompatApi,
  invokeOpenClawGateway,
  studioCreateKernelAgent,
  studioAbortKernelChatRun,
  studioCloneInstanceTask,
  studioCreateKernelChatSession,
  studioCreateInstance,
  studioCreateInstanceTask,
  studioDeleteConversation,
  studioDeleteKernelChatSession,
  studioDeleteInstance,
  studioDeleteInstanceTask,
  studioGetInstance,
  studioGetInstanceConfig,
  studioGetInstanceDetail,
  studioGetKernelAgentCreationCapability,
  studioGetKernelChatRun,
  studioGetKernelChatSession,
  studioGetInstanceLogs,
  studioListKernelChatAgentProfiles,
  studioListPersistedKernelChatAgents,
  studioListKernelChatRuns,
  studioListKernelChatSessions,
  studioListConversations,
  studioListInstanceTaskExecutions,
  studioLoadKernelChatMessages,
  studioListInstances,
  studioPatchKernelChatSession,
  studioPutConversation,
  studioReplacePersistedKernelChatAgents,
  studioRestartInstance,
  studioRunInstanceTaskNow,
  studioStartKernelChatRun,
  studioStartInstance,
  studioStopInstance,
  studioUpdateInstance,
  studioUpdateInstanceConfig,
  studioUpdateInstanceFileContent,
  studioUpdateInstanceLlmProviderConfig,
  studioUpdateInstanceTask,
  studioUpdateInstanceTaskStatus,
} from './studioCommandCompat';
export {
  DesktopHostedRuntimeReadinessError,
  isDesktopHostedRuntimeReadinessError,
} from './desktopHostedBridge';

const webPlatform = new WebPlatform();
const DESKTOP_API_BASE_PATH = '/claw/api/v1';
const DESKTOP_MANAGE_BASE_PATH = '/claw/manage/v1';
const DESKTOP_INTERNAL_BASE_PATH = '/claw/internal/v1';
// Packaged first-launch on Windows can spend tens of seconds extracting the
// bundled runtime and then another ~26s cold-starting the OpenClaw gateway.
const DESKTOP_HOSTED_RUNTIME_READINESS_RETRY_TIMEOUT_MS = 120_000;
const DESKTOP_HOSTED_RUNTIME_READINESS_RETRY_POLL_MS = 250;
const DESKTOP_HOSTED_RUNTIME_READINESS_ATTEMPT_TIMEOUT_MS = 5_000;
const desktopHostRuntimeResolver = createDesktopHostRuntimeResolver({
  waitForRuntime: () => waitForTauriRuntime(),
  loadRuntime: async () => {
    try {
      return await getDesktopHostRuntime();
    } catch {
      return null;
    }
  },
});

export interface DesktopAppInfo extends RuntimeAppInfo {}
export interface DesktopAppPaths extends RuntimePathsInfo {}
export interface DesktopAppConfig extends RuntimeConfigInfo {}
export interface DesktopSystemInfo extends RuntimeSystemInfo {}
export interface DesktopFileEntry extends PlatformFileEntry {}
export interface DesktopPathInfo extends PlatformPathInfo {}
interface DesktopCapturedScreenshotPayload
  extends Omit<PlatformCapturedScreenshot, 'bytes'> {
  bytes: number[];
}
interface DesktopFetchedRemoteUrlPayload
  extends Omit<PlatformFetchedRemoteUrl, 'bytes'> {
  bytes: number[];
}
export interface DesktopJobUpdateEvent extends RuntimeJobUpdateEvent {}
export interface DesktopProcessOutputEvent extends RuntimeProcessOutputEvent {}
export interface DesktopBuiltInOpenClawStatusChangedEvent
  extends RuntimeBuiltInOpenClawStatusChangedEvent {}
export interface DesktopKernelInfo extends RuntimeDesktopKernelInfo {}
export interface DesktopKernelStatus extends RuntimeDesktopKernelHostInfo {}
export interface DesktopStorageInfo extends RuntimeStorageInfo {}
export type {
  DesktopHostedRuntimeDescriptor,
  DesktopHostedRuntimeReadinessSnapshot,
} from './desktopHostedBridge';

const noopUnsubscribe: RuntimeEventUnsubscribe = () => {};

function compactDesktopCommandObject<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;
}

function toDesktopLocalAiProxyRequestLogsQuery(query: LocalAiProxyRequestLogsQuery) {
  return compactDesktopCommandObject({
    page: query.page,
    pageSize: query.page_size,
    search: query.q,
    providerId: query.providerId,
    modelId: query.modelId,
    routeId: query.routeId,
    status: query.status,
  });
}

function toDesktopLocalAiProxyMessageLogsQuery(query: LocalAiProxyMessageLogsQuery) {
  return compactDesktopCommandObject({
    page: query.page,
    pageSize: query.page_size,
    search: query.q,
    providerId: query.providerId,
    modelId: query.modelId,
    routeId: query.routeId,
  });
}

function createEmbeddedInstallerRemovedError(action: string) {
  return new Error(
    `Embedded install integration was removed from the desktop runtime. Use docs, store pages, or download links instead of ${action}.`,
  );
}

export async function getAppInfo(): Promise<DesktopAppInfo | null> {
  return runDesktopOrFallback(
    'app.getInfo',
    () =>
      invokeDesktopCommand<DesktopAppInfo>(DESKTOP_COMMANDS.appInfo, undefined, {
        operation: 'app.getInfo',
      }),
    async () => null,
  );
}

export async function getAppPaths(): Promise<DesktopAppPaths | null> {
  return runDesktopOrFallback(
    'app.getPaths',
    () =>
      invokeDesktopCommand<DesktopAppPaths>(DESKTOP_COMMANDS.appPaths, undefined, {
        operation: 'app.getPaths',
      }),
    async () => null,
  );
}

export async function getAppConfig(): Promise<DesktopAppConfig | null> {
  return runDesktopOrFallback(
    'app.getConfig',
    () =>
      invokeDesktopCommand<DesktopAppConfig>(DESKTOP_COMMANDS.appConfig, undefined, {
        operation: 'app.getConfig',
      }),
    async () => null,
  );
}

export async function setAppLanguage(language: RuntimeLanguagePreference): Promise<void> {
  await runDesktopOrFallback(
    'app.setLanguage',
    () =>
      invokeDesktopCommand<void>(
        DESKTOP_COMMANDS.setAppLanguage,
        { language },
        { operation: 'app.setLanguage' },
      ),
    async () => {},
  );
}

export async function getSystemInfo(): Promise<DesktopSystemInfo | null> {
  return runDesktopOrFallback(
    'app.getSystemInfo',
    () =>
      invokeDesktopCommand<DesktopSystemInfo>(DESKTOP_COMMANDS.systemInfo, undefined, {
        operation: 'app.getSystemInfo',
      }),
    async () => null,
  );
}

export async function getDesktopKernelInfo(): Promise<DesktopKernelInfo | null> {
  return runDesktopOnly(
    'kernel.getInfo',
    () =>
      invokeDesktopCommand<DesktopKernelInfo>(DESKTOP_COMMANDS.desktopKernelInfo, undefined, {
        operation: 'kernel.getInfo',
      }),
  );
}

export async function getDesktopKernelStatus(): Promise<DesktopKernelStatus | null> {
  return runDesktopOnly(
    'kernel.getStatus',
    () =>
      invokeDesktopCommand<DesktopKernelStatus>(
        DESKTOP_COMMANDS.desktopKernelStatus,
        undefined,
        {
          operation: 'kernel.getStatus',
        },
      ),
  );
}

export async function ensureDesktopKernelRunning(): Promise<DesktopKernelStatus | null> {
  return runDesktopOnly(
    'kernel.ensureRunning',
    () =>
      invokeDesktopCommand<DesktopKernelStatus>(
        DESKTOP_COMMANDS.ensureDesktopKernelRunning,
        undefined,
        {
          operation: 'kernel.ensureRunning',
        },
      ),
  );
}

export async function restartDesktopKernel(): Promise<DesktopKernelStatus | null> {
  return runDesktopOnly(
    'kernel.restart',
    () =>
      invokeDesktopCommand<DesktopKernelStatus>(
        DESKTOP_COMMANDS.restartDesktopKernel,
        undefined,
        {
          operation: 'kernel.restart',
        },
      ),
  );
}

export async function testLocalAiProxyRoute(
  routeId: string,
): Promise<LocalAiProxyRouteTestRecord | null> {
  return runDesktopOnly(
    'kernel.testLocalAiProxyRoute',
    () =>
      invokeDesktopCommand<LocalAiProxyRouteTestRecord | null>(
        DESKTOP_COMMANDS.testLocalAiProxyRoute,
        { routeId },
        {
          operation: 'kernel.testLocalAiProxyRoute',
        },
      ),
  );
}

export async function listLocalAiProxyRequestLogs(
  query: LocalAiProxyRequestLogsQuery,
): Promise<PaginatedResult<LocalAiProxyRequestLogRecord>> {
  return runDesktopOnly(
    'kernel.listLocalAiProxyRequestLogs',
    () =>
      invokeDesktopCommand<PaginatedResult<LocalAiProxyRequestLogRecord>>(
        DESKTOP_COMMANDS.listLocalAiProxyRequestLogs,
        { query: toDesktopLocalAiProxyRequestLogsQuery(query) },
        {
          operation: 'kernel.listLocalAiProxyRequestLogs',
        },
      ),
  );
}

export async function listLocalAiProxyMessageLogs(
  query: LocalAiProxyMessageLogsQuery,
): Promise<PaginatedResult<LocalAiProxyMessageLogRecord>> {
  return runDesktopOnly(
    'kernel.listLocalAiProxyMessageLogs',
    () =>
      invokeDesktopCommand<PaginatedResult<LocalAiProxyMessageLogRecord>>(
        DESKTOP_COMMANDS.listLocalAiProxyMessageLogs,
        { query: toDesktopLocalAiProxyMessageLogsQuery(query) },
        {
          operation: 'kernel.listLocalAiProxyMessageLogs',
        },
      ),
  );
}

export async function updateLocalAiProxyMessageCapture(
  enabled: boolean,
): Promise<LocalAiProxyMessageCaptureSettings> {
  return runDesktopOnly(
    'kernel.updateLocalAiProxyMessageCapture',
    () =>
      invokeDesktopCommand<LocalAiProxyMessageCaptureSettings>(
        DESKTOP_COMMANDS.updateLocalAiProxyMessageCapture,
        { enabled },
        {
          operation: 'kernel.updateLocalAiProxyMessageCapture',
        },
      ),
  );
}

export async function inspectOpenClawMirrorExport(): Promise<OpenClawMirrorExportPreview | null> {
  return runDesktopOnly(
    'kernel.inspectOpenClawMirrorExport',
    () =>
      invokeDesktopCommand<OpenClawMirrorExportPreview | null>(
        DESKTOP_COMMANDS.inspectOpenClawMirrorExport,
        undefined,
        {
          operation: 'kernel.inspectOpenClawMirrorExport',
        },
      ),
  );
}

export async function exportOpenClawMirror(
  request: OpenClawMirrorExportRequest,
): Promise<OpenClawMirrorExportResult> {
  return runDesktopOnly(
    'kernel.exportOpenClawMirror',
    () =>
      invokeDesktopCommand<OpenClawMirrorExportResult>(
        DESKTOP_COMMANDS.exportOpenClawMirror,
        { request },
        {
          operation: 'kernel.exportOpenClawMirror',
        },
      ),
  );
}

export async function inspectOpenClawMirrorImport(
  sourcePath: string,
): Promise<OpenClawMirrorImportPreview | null> {
  return runDesktopOnly(
    'kernel.inspectOpenClawMirrorImport',
    () =>
      invokeDesktopCommand<OpenClawMirrorImportPreview | null>(
        DESKTOP_COMMANDS.inspectOpenClawMirrorImport,
        { sourcePath },
        {
          operation: 'kernel.inspectOpenClawMirrorImport',
        },
      ),
  );
}

export async function importOpenClawMirror(
  request: OpenClawMirrorImportRequest,
): Promise<OpenClawMirrorImportResult> {
  return runDesktopOnly(
    'kernel.importOpenClawMirror',
    () =>
      invokeDesktopCommand<OpenClawMirrorImportResult>(
        DESKTOP_COMMANDS.importOpenClawMirror,
        { request },
        {
          operation: 'kernel.importOpenClawMirror',
        },
      ),
  );
}

export async function getDesktopStorageInfo(): Promise<DesktopStorageInfo | null> {
  return runDesktopOnly(
    'storage.getInfo',
    () =>
      invokeDesktopCommand<DesktopStorageInfo>(DESKTOP_COMMANDS.desktopStorageInfo, undefined, {
        operation: 'storage.getInfo',
      }),
  );
}

export async function listRollouts(): Promise<ManageRolloutListResult> {
  return runDesktopOnly(
    'manage.listRollouts',
    () =>
      invokeDesktopCommand<ManageRolloutListResult>(
        DESKTOP_COMMANDS.listRollouts,
        undefined,
        { operation: 'manage.listRollouts' },
      ),
  );
}

export async function previewRollout(
  input: PreviewRolloutRequest,
): Promise<ManageRolloutPreview> {
  return runDesktopOnly(
    'manage.previewRollout',
    () =>
      invokeDesktopCommand<ManageRolloutPreview>(
        DESKTOP_COMMANDS.previewRollout,
        { input },
        { operation: 'manage.previewRollout' },
      ),
  );
}

export async function startRollout(rolloutId: string): Promise<ManageRolloutRecord> {
  return runDesktopOnly(
    'manage.startRollout',
    () =>
      invokeDesktopCommand<ManageRolloutRecord>(
        DESKTOP_COMMANDS.startRollout,
        { rolloutId },
        { operation: 'manage.startRollout' },
      ),
  );
}

export async function getHostEndpoints(): Promise<ManageHostEndpointRecord[]> {
  return runDesktopOnly(
    'manage.getHostEndpoints',
    () =>
      invokeDesktopCommand<ManageHostEndpointRecord[]>(
        DESKTOP_COMMANDS.getHostEndpoints,
        undefined,
        { operation: 'manage.getHostEndpoints' },
      ),
  );
}

export async function getDesktopHostRuntime(): Promise<DesktopHostedRuntimeDescriptor | null> {
  return runDesktopOrFallback(
    'desktop.getHostRuntime',
    async () =>
      normalizeDesktopHostedRuntimeDescriptor(
        await invokeDesktopCommand<DesktopHostedRuntimeDescriptor | null>(
          DESKTOP_COMMANDS.getDesktopHostRuntime,
          undefined,
          { operation: 'desktop.getHostRuntime' },
        ),
      ),
    async () => null,
  );
}

export async function getOpenClawRuntime(): Promise<ManageOpenClawRuntimeRecord> {
  return runDesktopOnly(
    'manage.getOpenClawRuntime',
    () =>
      invokeDesktopCommand<ManageOpenClawRuntimeRecord>(
        DESKTOP_COMMANDS.getOpenClawRuntime,
        undefined,
        { operation: 'manage.getOpenClawRuntime' },
      ),
  );
}

export async function getOpenClawGateway(): Promise<ManageOpenClawGatewayRecord> {
  return runDesktopOnly(
    'manage.getOpenClawGateway',
    () =>
      invokeDesktopCommand<ManageOpenClawGatewayRecord>(
        DESKTOP_COMMANDS.getOpenClawGateway,
        undefined,
        { operation: 'manage.getOpenClawGateway' },
      ),
  );
}

export async function invokeManagedOpenClawGateway(
  request: ManageOpenClawGatewayInvokeRequest,
): Promise<unknown> {
  return runDesktopOnly(
    'manage.invokeOpenClawGateway',
    () =>
      invokeDesktopCommand<unknown>(
        DESKTOP_COMMANDS.invokeManagedOpenClawGateway,
        { request },
        { operation: 'manage.invokeOpenClawGateway' },
      ),
  );
}

export async function getHostPlatformStatus(): Promise<HostPlatformStatusRecord> {
  return runDesktopOnly(
    'internal.getHostPlatformStatus',
    () =>
      invokeDesktopCommand<HostPlatformStatusRecord>(
        DESKTOP_COMMANDS.getHostPlatformStatus,
        undefined,
        { operation: 'internal.getHostPlatformStatus' },
      ),
  );
}

export async function listNodeSessions(): Promise<InternalNodeSessionRecord[]> {
  return runDesktopOnly(
    'internal.listNodeSessions',
    () =>
      invokeDesktopCommand<InternalNodeSessionRecord[]>(
        DESKTOP_COMMANDS.listNodeSessions,
        undefined,
        { operation: 'internal.listNodeSessions' },
      ),
  );
}

export async function storageGetText(
  request: StorageGetTextRequest,
): Promise<StorageGetTextResult> {
  return runDesktopOnly(
    'storage.getText',
    () =>
      invokeDesktopCommand<StorageGetTextResult>(
        DESKTOP_COMMANDS.storageGetText,
        { request },
        { operation: 'storage.getText' },
      ),
  );
}

export async function storagePutText(
  request: StoragePutTextRequest,
): Promise<StoragePutTextResult> {
  return runDesktopOnly(
    'storage.putText',
    () =>
      invokeDesktopCommand<StoragePutTextResult>(
        DESKTOP_COMMANDS.storagePutText,
        { request },
        { operation: 'storage.putText' },
      ),
  );
}

export async function storageDelete(
  request: StorageDeleteRequest,
): Promise<StorageDeleteResult> {
  return runDesktopOnly(
    'storage.delete',
    () =>
      invokeDesktopCommand<StorageDeleteResult>(
        DESKTOP_COMMANDS.storageDelete,
        { request },
        { operation: 'storage.delete' },
      ),
  );
}

export async function storageListKeys(
  request: StorageListKeysRequest = {},
): Promise<StorageListKeysResult> {
  return runDesktopOnly(
    'storage.listKeys',
    () =>
      invokeDesktopCommand<StorageListKeysResult>(
        DESKTOP_COMMANDS.storageListKeys,
        { request },
        { operation: 'storage.listKeys' },
      ),
  );
}

export async function listDirectory(path = ''): Promise<DesktopFileEntry[]> {
  return runDesktopOnly(
    'filesystem.listDirectory',
    () =>
      invokeDesktopCommand<DesktopFileEntry[]>(
        DESKTOP_COMMANDS.listDirectory,
        { path },
        { operation: 'filesystem.listDirectory' },
      ),
  );
}

export async function pathExists(path: string): Promise<boolean> {
  return runDesktopOnly(
    'filesystem.pathExists',
    () =>
      invokeDesktopCommand<boolean>(DESKTOP_COMMANDS.pathExists, { path }, {
        operation: 'filesystem.pathExists',
      }),
  );
}

export async function pathExistsForUserTooling(path: string): Promise<boolean> {
  return runDesktopOnly(
    'filesystem.pathExistsForUserTooling',
    () =>
      invokeDesktopCommand<boolean>(DESKTOP_COMMANDS.pathExistsForUserTooling, { path }, {
        operation: 'filesystem.pathExistsForUserTooling',
      }),
  );
}

export async function getPathInfo(path: string): Promise<DesktopPathInfo> {
  return runDesktopOnly(
    'filesystem.getPathInfo',
    () =>
      invokeDesktopCommand<DesktopPathInfo>(DESKTOP_COMMANDS.getPathInfo, { path }, {
        operation: 'filesystem.getPathInfo',
      }),
  );
}

export async function createDirectory(path: string): Promise<void> {
  await runDesktopOnly(
    'filesystem.createDirectory',
    () =>
      invokeDesktopCommand<void>(DESKTOP_COMMANDS.createDirectory, { path }, {
        operation: 'filesystem.createDirectory',
      }),
  );
}

export async function removePath(path: string): Promise<void> {
  await runDesktopOnly(
    'filesystem.removePath',
    () =>
      invokeDesktopCommand<void>(DESKTOP_COMMANDS.removePath, { path }, {
        operation: 'filesystem.removePath',
      }),
  );
}

export async function copyPath(
  sourcePath: string,
  destinationPath: string,
): Promise<void> {
  await runDesktopOnly(
    'filesystem.copyPath',
    () =>
      invokeDesktopCommand<void>(
        DESKTOP_COMMANDS.copyPath,
        { sourcePath, destinationPath },
        { operation: 'filesystem.copyPath' },
      ),
  );
}

export async function movePath(
  sourcePath: string,
  destinationPath: string,
): Promise<void> {
  await runDesktopOnly(
    'filesystem.movePath',
    () =>
      invokeDesktopCommand<void>(
        DESKTOP_COMMANDS.movePath,
        { sourcePath, destinationPath },
        { operation: 'filesystem.movePath' },
      ),
  );
}

export async function readBinaryFile(path: string): Promise<Uint8Array> {
  return runDesktopOnly(
    'filesystem.readBinaryFile',
    async () => {
      const bytes = await invokeDesktopCommand<number[]>(
        DESKTOP_COMMANDS.readBinaryFile,
        { path },
        { operation: 'filesystem.readBinaryFile' },
      );
      return Uint8Array.from(bytes);
    },
  );
}

export async function writeBinaryFile(
  path: string,
  content: Uint8Array | number[],
): Promise<void> {
  const bytes = content instanceof Uint8Array ? Array.from(content) : content;
  await runDesktopOnly(
    'filesystem.writeBinaryFile',
    () =>
      invokeDesktopCommand<void>(
        DESKTOP_COMMANDS.writeBinaryFile,
        { path, content: bytes },
        { operation: 'filesystem.writeBinaryFile' },
      ),
  );
}

export async function readTextFile(path: string): Promise<string> {
  return runDesktopOnly(
    'filesystem.readTextFile',
    () =>
      invokeDesktopCommand<string>(DESKTOP_COMMANDS.readTextFile, { path }, {
        operation: 'filesystem.readTextFile',
      }),
  );
}

export async function readTextFileForUserTooling(path: string): Promise<string> {
  return runDesktopOnly(
    'filesystem.readTextFileForUserTooling',
    () =>
      invokeDesktopCommand<string>(DESKTOP_COMMANDS.readTextFileForUserTooling, { path }, {
        operation: 'filesystem.readTextFileForUserTooling',
      }),
  );
}

export async function writeTextFile(path: string, content: string): Promise<void> {
  await runDesktopOnly(
    'filesystem.writeTextFile',
    () =>
      invokeDesktopCommand<void>(DESKTOP_COMMANDS.writeTextFile, { path, content }, {
        operation: 'filesystem.writeTextFile',
      }),
  );
}

export async function getDeviceId(): Promise<string> {
  return runDesktopOnly(
    'app.getDeviceId',
    () =>
      invokeDesktopCommand<string>(DESKTOP_COMMANDS.getDeviceId, undefined, {
        operation: 'app.getDeviceId',
      }),
  );
}

export async function submitJob(kind: string): Promise<string> {
  return invokeDesktopCommand<string>(DESKTOP_COMMANDS.jobSubmit, { kind }, {
    operation: 'jobs.submit',
  });
}

export async function submitProcessJob(profileId: string): Promise<string> {
  return invokeDesktopCommand<string>(DESKTOP_COMMANDS.jobSubmitProcess, { profileId }, {
    operation: 'jobs.submitProcess',
  });
}

export async function getJob(id: string): Promise<DesktopJobUpdateEvent['record']> {
  return invokeDesktopCommand<DesktopJobUpdateEvent['record']>(DESKTOP_COMMANDS.jobGet, { id }, {
    operation: 'jobs.get',
  });
}

export async function listJobs(): Promise<DesktopJobUpdateEvent['record'][]> {
  return invokeDesktopCommand<DesktopJobUpdateEvent['record'][]>(DESKTOP_COMMANDS.jobList, undefined, {
    operation: 'jobs.list',
  });
}

export async function cancelJob(id: string): Promise<DesktopJobUpdateEvent['record']> {
  return invokeDesktopCommand<DesktopJobUpdateEvent['record']>(DESKTOP_COMMANDS.jobCancel, { id }, {
    operation: 'jobs.cancel',
  });
}

export async function subscribeJobUpdates(
  listener: (event: DesktopJobUpdateEvent) => void,
): Promise<RuntimeEventUnsubscribe> {
  if (!isTauriRuntime()) {
    return noopUnsubscribe;
  }

  return listenDesktopEvent<DesktopJobUpdateEvent>(DESKTOP_EVENTS.jobUpdated, listener, {
    operation: 'jobs.subscribeUpdates',
  });
}

export async function subscribeProcessOutput(
  listener: (event: DesktopProcessOutputEvent) => void,
): Promise<RuntimeEventUnsubscribe> {
  if (!isTauriRuntime()) {
    return noopUnsubscribe;
  }

  return listenDesktopEvent<DesktopProcessOutputEvent>(
    DESKTOP_EVENTS.processOutput,
    listener,
    {
      operation: 'jobs.subscribeProcessOutput',
    },
  );
}

export async function subscribeBuiltInOpenClawStatusChanged(
  listener: (event: DesktopBuiltInOpenClawStatusChangedEvent) => void,
): Promise<RuntimeEventUnsubscribe> {
  if (!isTauriRuntime()) {
    return noopUnsubscribe;
  }

  return listenDesktopEvent<DesktopBuiltInOpenClawStatusChangedEvent>(
    DESKTOP_EVENTS.builtInOpenClawStatusChanged,
    listener,
    {
      operation: 'runtime.subscribeBuiltInOpenClawStatusChanged',
    },
  );
}

export async function subscribeInstallProgress(
  listener: (event: InstallProgressEvent) => void,
): Promise<RuntimeEventUnsubscribe> {
  void listener;
  return noopUnsubscribe;
}

export async function openExternal(url: string): Promise<void> {
  await runDesktopOrFallback(
    'shell.openExternal',
    () =>
      invokeDesktopCommand<void>(DESKTOP_COMMANDS.openExternal, { url }, {
        operation: 'shell.openExternal',
      }),
    () => webPlatform.openExternal(url),
  );
}

export async function openPath(path: string): Promise<void> {
  await runDesktopOnly(
    'shell.openPath',
    () =>
      invokeDesktopCommand<void>(DESKTOP_COMMANDS.openPath, { path }, {
        operation: 'shell.openPath',
      }),
  );
}

export async function revealPath(path: string): Promise<void> {
  await runDesktopOnly(
    'shell.revealPath',
    () =>
      invokeDesktopCommand<void>(DESKTOP_COMMANDS.revealPath, { path }, {
        operation: 'shell.revealPath',
      }),
  );
}

export async function showDesktopNotification(
  notification: PlatformNotificationRequest,
): Promise<void> {
  await runDesktopOrFallback(
    'shell.showNotification',
    () =>
      invokeTauriRuntimeCommand<void>('plugin:notification|notify', {
        options: {
          title: notification.title,
          body: notification.body,
        },
      }, {
        operation: 'shell.showNotification',
      }),
    () => webPlatform.showNotification(notification),
  );
}

export function supportsNativeScreenshot(): boolean {
  return isTauriRuntime();
}

export async function captureScreenshot(): Promise<PlatformCapturedScreenshot | null> {
  return runDesktopOrFallback(
    'shell.captureScreenshot',
    async () => {
      const payload = await invokeDesktopCommand<DesktopCapturedScreenshotPayload>(
        DESKTOP_COMMANDS.captureScreenshot,
        undefined,
        {
          operation: 'shell.captureScreenshot',
        },
      );

      return {
        ...payload,
        bytes: Uint8Array.from(payload.bytes ?? []),
      };
    },
    async () => null,
  );
}

export async function fetchRemoteUrl(url: string): Promise<PlatformFetchedRemoteUrl> {
  return runDesktopOrFallback(
    'shell.fetchRemoteUrl',
    async () => {
      const payload = await invokeDesktopCommand<DesktopFetchedRemoteUrlPayload>(
        DESKTOP_COMMANDS.fetchRemoteUrl,
        { url },
        {
          operation: 'shell.fetchRemoteUrl',
        },
      );

      return {
        ...payload,
        bytes: Uint8Array.from(payload.bytes ?? []),
      };
    },
    () => webPlatform.fetchRemoteUrl(url),
  );
}

export async function selectFiles(
  options?: PlatformSelectFileOptions,
): Promise<string[]> {
  return runDesktopOrFallback(
    'shell.selectFiles',
    () =>
      invokeDesktopCommand<string[]>(DESKTOP_COMMANDS.selectFiles, { options }, {
        operation: 'shell.selectFiles',
      }),
    () => webPlatform.selectFile(options),
  );
}

export async function saveFile(
  data: Blob,
  filename: string,
  options?: PlatformSaveFileOptions,
): Promise<void> {
  await runDesktopOrFallback(
    'shell.saveFile',
    async () => {
      const bytes = Array.from(new Uint8Array(await data.arrayBuffer()));
      await invokeDesktopCommand<void>(
        DESKTOP_COMMANDS.saveBlobFile,
        { filename, content: bytes, options },
        { operation: 'shell.saveFile' },
      );
    },
    () => webPlatform.saveFile(data, filename, options),
  );
}

export async function minimizeWindow(): Promise<void> {
  const currentWindow = getDesktopWindow();
  if (!currentWindow) {
    return webPlatform.minimizeWindow();
  }

  await currentWindow.minimize();
}

export async function maximizeWindow(): Promise<void> {
  const currentWindow = getDesktopWindow();
  if (!currentWindow) {
    return webPlatform.maximizeWindow();
  }

  if (await currentWindow.isFullscreen()) {
    await currentWindow.setFullscreen(false);
  }

  await currentWindow.maximize();
}

export async function restoreWindow(): Promise<void> {
  const currentWindow = getDesktopWindow();
  if (!currentWindow) {
    return webPlatform.restoreWindow();
  }

  const [
    isFullscreenWindow,
    isMaximizedWindow,
    isMinimizedWindow,
    isHiddenWindow,
  ] = await Promise.all([
    currentWindow.isFullscreen(),
    currentWindow.isMaximized(),
    currentWindow.isMinimized(),
    currentWindow.isVisible().then((isVisibleWindow) => !isVisibleWindow),
  ]);

  if (isHiddenWindow) {
    await currentWindow.show();
  }

  if (isFullscreenWindow) {
    await currentWindow.setFullscreen(false);
  }

  if (isMinimizedWindow) {
    await currentWindow.unminimize();
  }

  if (isMaximizedWindow) {
    await currentWindow.unmaximize();
  }

  if (isFullscreenWindow || isMinimizedWindow || isHiddenWindow) {
    await currentWindow.setFocus().catch(() => {
      // Focus is best-effort after restoring window visibility.
    });
  }
}

export async function isWindowMaximized(): Promise<boolean> {
  const currentWindow = getDesktopWindow();
  if (!currentWindow) {
    return webPlatform.isWindowMaximized();
  }

  const [isFullscreenWindow, isMaximizedWindow] = await Promise.all([
    currentWindow.isFullscreen(),
    currentWindow.isMaximized(),
  ]);

  return isFullscreenWindow || isMaximizedWindow;
}

export async function subscribeWindowMaximized(
  listener: (isMaximized: boolean) => void,
): Promise<RuntimeEventUnsubscribe> {
  if (!isTauriRuntime()) {
    return webPlatform.subscribeWindowMaximized(listener);
  }

  const currentWindow = getDesktopWindow();
  if (!currentWindow) {
    return noopUnsubscribe;
  }

  let active = true;

  const emitWindowState = async () => {
    if (!active) {
      return;
    }

    listener(await isWindowMaximized());
  };

  await emitWindowState();

  const unlistenResize = await currentWindow.onResized(() => {
    void emitWindowState();
  });

  const unlistenMove = await currentWindow.onMoved(() => {
    void emitWindowState();
  });

  return async () => {
    active = false;
    await Promise.all([unlistenResize(), unlistenMove()]);
  };
}

export async function closeWindow(): Promise<void> {
  const currentWindow = getDesktopWindow();
  if (!currentWindow) {
    return webPlatform.closeWindow();
  }

  await currentWindow.hide();
}

export async function runInstall(
  request: InstallRequest,
): Promise<InstallResult> {
  void request;
  throw createEmbeddedInstallerRemovedError('desktop install');
}

export async function listInstallCatalog(
  query?: InstallCatalogQuery,
): Promise<InstallCatalogEntry[]> {
  void query;
  return [];
}

export async function runInstallDependencies(
  request: InstallDependencyRequest,
): Promise<InstallDependencyResult> {
  void request;
  throw createEmbeddedInstallerRemovedError('desktop dependency install');
}

export async function inspectInstall(
  request: InstallRequest,
): Promise<InstallAssessmentResult> {
  void request;
  throw createEmbeddedInstallerRemovedError('desktop install inspection');
}

export async function runUninstall(
  request: UninstallRequest,
): Promise<UninstallResult> {
  void request;
  throw createEmbeddedInstallerRemovedError('desktop uninstall');
}

async function resolveDesktopHostRuntime(): Promise<DesktopHostedRuntimeDescriptor | null> {
  return desktopHostRuntimeResolver.resolve();
}

async function requireDesktopHostedRuntime(
  operation: string,
): Promise<DesktopHostedRuntimeDescriptor> {
  const desktopHostRuntime = await resolveDesktopHostRuntime();
  if (!desktopHostRuntime) {
    throw new DesktopBridgeError({
      operation,
      runtime: 'desktop',
      cause: 'Canonical desktop embedded host runtime descriptor is unavailable.',
    });
  }

  return desktopHostRuntime;
}

async function createDesktopHostedManagePlatform(
  operation: string,
): Promise<WebManagePlatform> {
  return createStaticDesktopHostedManagePlatform(
    await requireDesktopHostedRuntime(operation),
  );
}

async function createDesktopHostedInternalPlatform(
  operation: string,
): Promise<WebInternalPlatform> {
  return createStaticDesktopHostedInternalPlatform(
    await requireDesktopHostedRuntime(operation),
  );
}

function createDesktopHttpFirstManagePlatform() {
  return {
    async listRollouts() {
      const hostedPlatform = await createDesktopHostedManagePlatform(
        'manage.listRollouts',
      );
      return hostedPlatform.listRollouts();
    },
    async previewRollout(input: PreviewRolloutRequest) {
      const hostedPlatform = await createDesktopHostedManagePlatform(
        'manage.previewRollout',
      );
      return hostedPlatform.previewRollout(input);
    },
    async startRollout(rolloutId: string) {
      const hostedPlatform = await createDesktopHostedManagePlatform(
        'manage.startRollout',
      );
      return hostedPlatform.startRollout(rolloutId);
    },
    async getHostEndpoints() {
      const hostedPlatform = await createDesktopHostedManagePlatform(
        'manage.getHostEndpoints',
      );
      return hostedPlatform.getHostEndpoints();
    },
    async getOpenClawRuntime() {
      const hostedPlatform = await createDesktopHostedManagePlatform(
        'manage.getOpenClawRuntime',
      );
      return hostedPlatform.getOpenClawRuntime();
    },
    async getOpenClawGateway() {
      const hostedPlatform = await createDesktopHostedManagePlatform(
        'manage.getOpenClawGateway',
      );
      return hostedPlatform.getOpenClawGateway();
    },
    async invokeOpenClawGateway(request: ManageOpenClawGatewayInvokeRequest) {
      const hostedPlatform = await createDesktopHostedManagePlatform(
        'manage.invokeOpenClawGateway',
      );
      return hostedPlatform.invokeOpenClawGateway(request);
    },
  };
}

function createDesktopHttpFirstInternalPlatform() {
  return {
    async getHostPlatformStatus() {
      const hostedPlatform = await createDesktopHostedInternalPlatform(
        'internal.getHostPlatformStatus',
      );
      return hostedPlatform.getHostPlatformStatus();
    },
    async listNodeSessions() {
      const hostedPlatform = await createDesktopHostedInternalPlatform(
        'internal.listNodeSessions',
      );
      return hostedPlatform.listNodeSessions();
    },
  };
}

function createDesktopHttpFirstStudioPlatform() {
  const hostedPlatform = createStaticDeferredDesktopHostedStudioPlatform(() =>
    requireDesktopHostedRuntime('studio.requestHostedSurface')
  );

  return Object.assign(hostedPlatform, {
    getKernelAgentCreationCapability: (instanceId: string) =>
      studioGetKernelAgentCreationCapability(instanceId),
    createKernelAgent: (
      input: Parameters<typeof studioCreateKernelAgent>[0],
    ) => studioCreateKernelAgent(input),
    listKernelChatAgentProfiles: (instanceId: string) =>
      studioListKernelChatAgentProfiles(instanceId),
    listPersistedKernelChatAgents: (instanceId: string) =>
      studioListPersistedKernelChatAgents(instanceId),
    replacePersistedKernelChatAgents: (
      instanceId: string,
      records: Parameters<typeof studioReplacePersistedKernelChatAgents>[1],
    ) => studioReplacePersistedKernelChatAgents(instanceId, records),
    listKernelChatSessions: (instanceId: string) =>
      studioListKernelChatSessions(instanceId),
    getKernelChatSession: (instanceId: string, sessionId: string) =>
      studioGetKernelChatSession(instanceId, sessionId),
    createKernelChatSession: (
      input: Parameters<typeof studioCreateKernelChatSession>[0],
    ) => studioCreateKernelChatSession(input),
    listKernelChatRuns: (instanceId: string, sessionId: string) =>
      studioListKernelChatRuns(instanceId, sessionId),
    getKernelChatRun: (
      instanceId: string,
      sessionId: string,
      runId: string,
    ) => studioGetKernelChatRun(instanceId, sessionId, runId),
    patchKernelChatSession: (
      input: Parameters<typeof studioPatchKernelChatSession>[0],
    ) => studioPatchKernelChatSession(input),
    deleteKernelChatSession: (instanceId: string, sessionId: string) =>
      studioDeleteKernelChatSession(instanceId, sessionId),
    startKernelChatRun: (input: Parameters<typeof studioStartKernelChatRun>[0]) =>
      studioStartKernelChatRun(input),
    abortKernelChatRun: (
      instanceId: string,
      sessionId: string,
      runId?: string | null,
    ) => studioAbortKernelChatRun(instanceId, sessionId, runId),
    loadKernelChatMessages: (instanceId: string, sessionId: string) =>
      studioLoadKernelChatMessages(instanceId, sessionId),
  });
}

export async function probeDesktopHostedControlPlane(): Promise<{
  hostPlatformStatus: HostPlatformStatusRecord;
  hostEndpoints: ManageHostEndpointRecord[];
}> {
  return probeStaticDesktopHostedControlPlane(
    await requireDesktopHostedRuntime('desktop.probeHostedControlPlane'),
  );
}

export async function probeDesktopHostedRuntimeReadiness(options?: {
  requiresBuiltInOpenClawEvidence?: boolean;
  retryTimeoutMs?: number;
  retryPollMs?: number;
  attemptTimeoutMs?: number;
  onRetry?: (context: RetryDesktopHostRuntimeOperationRetryContext) => void;
}): Promise<DesktopHostedRuntimeReadinessSnapshot> {
  return retryDesktopHostRuntimeOperation({
    retryTimeoutMs:
      options?.retryTimeoutMs ?? DESKTOP_HOSTED_RUNTIME_READINESS_RETRY_TIMEOUT_MS,
    retryPollMs:
      options?.retryPollMs ?? DESKTOP_HOSTED_RUNTIME_READINESS_RETRY_POLL_MS,
    attemptTimeoutMs:
      options?.attemptTimeoutMs ?? DESKTOP_HOSTED_RUNTIME_READINESS_ATTEMPT_TIMEOUT_MS,
    onRetry: options?.onRetry,
    operation: async ({ signal }) =>
      probeStaticDesktopHostedRuntimeReadiness(
        await requireDesktopHostedRuntime('desktop.probeHostedRuntimeReadiness'),
        undefined,
        {
          requiresBuiltInOpenClawEvidence:
            options?.requiresBuiltInOpenClawEvidence ?? false,
          signal,
          webSocketFactory:
            typeof WebSocket === 'function'
              ? (url) => new WebSocket(url)
              : undefined,
        },
      ),
  });
}

export async function getRuntimeInfo(): Promise<RuntimeInfo> {
  const [app, paths, config, system, desktopHostRuntime] = await Promise.all([
    getAppInfo(),
    getAppPaths(),
    getAppConfig(),
    getSystemInfo(),
    resolveDesktopHostRuntime(),
  ]);

  return {
    platform: 'desktop' as const,
    startup: {
      hostMode: desktopHostRuntime?.mode ?? 'desktopCombined',
      distributionFamily: 'desktop',
      deploymentFamily: 'bareMetal',
      acceleratorProfile: null,
      hostedBrowser: false,
      apiBasePath: desktopHostRuntime?.apiBasePath ?? DESKTOP_API_BASE_PATH,
      manageBasePath: desktopHostRuntime?.manageBasePath ?? DESKTOP_MANAGE_BASE_PATH,
      internalBasePath: desktopHostRuntime?.internalBasePath ?? DESKTOP_INTERNAL_BASE_PATH,
      browserBaseUrl: desktopHostRuntime?.browserBaseUrl ?? null,
      hostEndpointId: desktopHostRuntime?.endpointId ?? null,
      hostRequestedPort: desktopHostRuntime?.requestedPort ?? null,
      hostActivePort: desktopHostRuntime?.activePort ?? null,
      hostLoopbackOnly: desktopHostRuntime?.loopbackOnly ?? null,
      hostDynamicPort: desktopHostRuntime?.dynamicPort ?? null,
      stateStoreDriver: desktopHostRuntime?.stateStoreDriver ?? null,
      stateStoreProfileId: desktopHostRuntime?.stateStoreProfileId ?? null,
      runtimeDataDir: desktopHostRuntime?.runtimeDataDir ?? null,
      webDistDir: desktopHostRuntime?.webDistDir ?? null,
    },
    app,
    paths,
    config,
    system,
  };
}

export const desktopTemplateApi = {
  catalog: {
    commands: DESKTOP_COMMANDS,
    events: DESKTOP_EVENTS,
  },
  meta: {
    isTauriRuntime,
    getDesktopWindow,
  },
  app: {
    getInfo: getAppInfo,
    getPaths: getAppPaths,
    getConfig: getAppConfig,
    setLanguage: setAppLanguage,
    getSystemInfo,
    getDeviceId,
  },
  kernel: {
    getInfo: getDesktopKernelInfo,
    getStatus: getDesktopKernelStatus,
    ensureRunning: ensureDesktopKernelRunning,
    restart: restartDesktopKernel,
    testLocalAiProxyRoute,
    listLocalAiProxyRequestLogs,
    listLocalAiProxyMessageLogs,
    updateLocalAiProxyMessageCapture,
    inspectOpenClawMirrorExport,
    exportOpenClawMirror,
    inspectOpenClawMirrorImport,
    importOpenClawMirror,
    getStorageInfo: getDesktopStorageInfo,
  },
  storage: {
    getInfo: getDesktopStorageInfo,
    getText: storageGetText,
    putText: storagePutText,
    delete: storageDelete,
    listKeys: storageListKeys,
  },
  studio: createDesktopHttpFirstStudioPlatform(),
  filesystem: {
    listDirectory,
    pathExists,
    getPathInfo,
    createDirectory,
    removePath,
    copyPath,
    movePath,
    readBinaryFile,
    writeBinaryFile,
    readTextFile,
    writeTextFile,
  },
  jobs: {
    submit: submitJob,
    submitProcess: submitProcessJob,
    get: getJob,
    list: listJobs,
    cancel: cancelJob,
    subscribeUpdates: subscribeJobUpdates,
    subscribeProcessOutput,
  },
  shell: {
    showNotification: showDesktopNotification,
    openExternal,
    openPath,
    revealPath,
    fetchRemoteUrl,
    captureScreenshot,
    supportsNativeScreenshot,
    selectFiles,
    saveFile,
    minimizeWindow,
    maximizeWindow,
    restoreWindow,
    isWindowMaximized,
    subscribeWindowMaximized,
    closeWindow,
  },
  installer: {
    listInstallCatalog,
    inspectInstall,
    runInstallDependencies,
    runInstall,
    runUninstall,
    subscribeInstallProgress,
  },
  manage: createDesktopHttpFirstManagePlatform(),
  internal: createDesktopHttpFirstInternalPlatform(),
  runtime: {
    getInfo: getRuntimeInfo,
    setAppLanguage,
    subscribeBuiltInOpenClawStatusChanged,
  },
};

export type DesktopTemplateApi = typeof desktopTemplateApi;

export function configureDesktopPlatformBridge() {
  configurePlatformBridge({
    platform: {
      getPlatform: () => 'desktop',
      getDeviceId: () => getDeviceId(),
      setStorage: (key, value) => webPlatform.setStorage(key, value),
      getStorage: (key) => webPlatform.getStorage(key),
      copy: (text) => webPlatform.copy(text),
      showNotification: (notification) => showDesktopNotification(notification),
      openExternal: (url) => openExternal(url),
      openPath: (path) => openPath(path),
      revealPath: (path) => revealPath(path),
      supportsNativeScreenshot: () => supportsNativeScreenshot(),
      captureScreenshot: () => captureScreenshot(),
      fetchRemoteUrl: (url) => fetchRemoteUrl(url),
      selectFile: (options) => selectFiles(options),
      saveFile: (data, filename, options) => saveFile(data, filename, options),
      minimizeWindow: () => minimizeWindow(),
      maximizeWindow: () => maximizeWindow(),
      restoreWindow: () => restoreWindow(),
      isWindowMaximized: () => isWindowMaximized(),
      subscribeWindowMaximized: (listener) => subscribeWindowMaximized(listener),
      closeWindow: () => closeWindow(),
      listDirectory: (path) => listDirectory(path),
      pathExists: (path) => pathExists(path),
      pathExistsForUserTooling: (path) => pathExistsForUserTooling(path),
      getPathInfo: (path) => getPathInfo(path),
      createDirectory: (path) => createDirectory(path),
      removePath: (path) => removePath(path),
      copyPath: (sourcePath, destinationPath) => copyPath(sourcePath, destinationPath),
      movePath: (sourcePath, destinationPath) => movePath(sourcePath, destinationPath),
      readBinaryFile: (path) => readBinaryFile(path),
      writeBinaryFile: (path, content) => writeBinaryFile(path, content),
      readFile: (path) => readTextFile(path),
      readFileForUserTooling: (path) => readTextFileForUserTooling(path),
      writeFile: (path, content) => writeTextFile(path, content),
    },
    kernel: {
      getInfo: () => getDesktopKernelInfo(),
      getStorageInfo: () => getDesktopStorageInfo(),
      getStatus: () => getDesktopKernelStatus(),
      ensureRunning: () => ensureDesktopKernelRunning(),
      restart: () => restartDesktopKernel(),
      testLocalAiProxyRoute: (routeId) => testLocalAiProxyRoute(routeId),
      listLocalAiProxyRequestLogs: (query) => listLocalAiProxyRequestLogs(query),
      listLocalAiProxyMessageLogs: (query) => listLocalAiProxyMessageLogs(query),
      updateLocalAiProxyMessageCapture: (enabled) => updateLocalAiProxyMessageCapture(enabled),
      inspectOpenClawMirrorExport: () => inspectOpenClawMirrorExport(),
      exportOpenClawMirror: (request) => exportOpenClawMirror(request),
      inspectOpenClawMirrorImport: (sourcePath) => inspectOpenClawMirrorImport(sourcePath),
      importOpenClawMirror: (request) => importOpenClawMirror(request),
    },
    installer: {
      listInstallCatalog: (query) => listInstallCatalog(query),
      inspectInstall: (request) => inspectInstall(request),
      runInstallDependencies: (request) => runInstallDependencies(request),
      runInstall: (request) => runInstall(request),
      runUninstall: (request) => runUninstall(request),
      subscribeInstallProgress: (listener) => subscribeInstallProgress(listener),
    },
    manage: createDesktopHttpFirstManagePlatform(),
    internal: createDesktopHttpFirstInternalPlatform(),
    components: {
      listComponents: () => desktopComponentsApi.list(),
      controlComponent: (request) => desktopComponentsApi.control(request.componentId, request.action),
    },
    storage: {
      getStorageInfo: () => getDesktopStorageInfo(),
      getText: (request) => storageGetText(request),
      putText: (request) => storagePutText(request),
      delete: (request) => storageDelete(request),
      listKeys: (request) => storageListKeys(request),
    },
    studio: createDesktopHttpFirstStudioPlatform(),
    runtime: {
      getRuntimeInfo: () => getRuntimeInfo(),
      setAppLanguage: (language) => setAppLanguage(language),
      submitProcessJob: (profileId) => submitProcessJob(profileId),
      getJob: (id) => getJob(id),
      listJobs: () => listJobs(),
      cancelJob: (id) => cancelJob(id),
      subscribeJobUpdates: (listener) => subscribeJobUpdates(listener),
      subscribeProcessOutput: (listener) => subscribeProcessOutput(listener),
      subscribeBuiltInOpenClawStatusChanged: (listener) =>
        subscribeBuiltInOpenClawStatusChanged(listener),
    },
  });
}
