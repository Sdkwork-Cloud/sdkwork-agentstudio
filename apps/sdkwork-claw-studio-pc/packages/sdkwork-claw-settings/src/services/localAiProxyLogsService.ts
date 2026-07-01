import { kernelPlatformService } from "@sdkwork/claw-core";
import {
  createLocalApiProxyLogsService as createSharedLocalApiProxyLogsService,
  type LocalApiProxyLogsWorkspaceRuntimeSummary,
} from "@sdkwork/local-api-proxy";
import type {
  LocalAiProxyMessageCaptureSettings,
  LocalAiProxyMessageLogRecord,
  LocalAiProxyMessageLogsQuery,
  LocalAiProxyRequestLogRecord,
  LocalAiProxyRequestLogsQuery,
  PaginatedResult,
} from "@sdkwork/claw-types";

export type LocalAiProxyRuntimeSummary = LocalApiProxyLogsWorkspaceRuntimeSummary;

interface LocalAiProxyLogsServiceDependencies {
  kernelPlatformService: Pick<
    typeof kernelPlatformService,
    | "getInfo"
    | "listLocalAiProxyRequestLogs"
    | "listLocalAiProxyMessageLogs"
    | "updateLocalAiProxyMessageCapture"
  >;
}

export interface LocalAiProxyLogsServiceOverrides {
  kernelPlatformService?: Partial<LocalAiProxyLogsServiceDependencies["kernelPlatformService"]>;
}

export function createLocalAiProxyLogsService(
  overrides: LocalAiProxyLogsServiceOverrides = {},
) {
  const dependencies: LocalAiProxyLogsServiceDependencies = {
    kernelPlatformService: {
      getInfo: () => kernelPlatformService.getInfo(),
      listLocalAiProxyRequestLogs: (query) =>
        kernelPlatformService.listLocalAiProxyRequestLogs(query),
      listLocalAiProxyMessageLogs: (query) =>
        kernelPlatformService.listLocalAiProxyMessageLogs(query),
      updateLocalAiProxyMessageCapture: (enabled) =>
        kernelPlatformService.updateLocalAiProxyMessageCapture(enabled),
      ...overrides.kernelPlatformService,
    },
  };

  return createSharedLocalApiProxyLogsService<
    LocalAiProxyRequestLogsQuery,
    PaginatedResult<LocalAiProxyRequestLogRecord>,
    LocalAiProxyMessageLogsQuery,
    PaginatedResult<LocalAiProxyMessageLogRecord>,
    LocalAiProxyMessageCaptureSettings
  >({
    listRequestLogs: (query) => dependencies.kernelPlatformService.listLocalAiProxyRequestLogs(query),
    listMessageLogs: (query) => dependencies.kernelPlatformService.listLocalAiProxyMessageLogs(query),
    async getCaptureSettings() {
      const info = await dependencies.kernelPlatformService.getInfo();
      return {
        enabled: info?.localAiProxy?.messageCaptureEnabled ?? false,
        updatedAt: null,
      };
    },
    updateCaptureSettings: (enabled) =>
      dependencies.kernelPlatformService.updateLocalAiProxyMessageCapture(enabled),
    async getRuntimeEvidence() {
      const info = await dependencies.kernelPlatformService.getInfo();
      return {
        lifecycle: info?.localAiProxy?.lifecycle,
        observabilityDbPath: info?.localAiProxy?.observabilityDbPath,
        snapshotPath: info?.localAiProxy?.snapshotPath,
        logPath: info?.localAiProxy?.logPath,
      };
    },
  });
}

export const localAiProxyLogsService = createLocalAiProxyLogsService();
