import type {
  KernelPlatformAPI,
  RuntimeDesktopKernelHostInfo,
} from './contracts/kernel.ts';
import type {
  LocalAiProxyMessageCaptureSettings,
  LocalAiProxyMessageLogRecord,
  LocalAiProxyMessageLogsQuery,
  OpenClawMirrorExportPreview,
  OpenClawMirrorExportRequest,
  OpenClawMirrorExportResult,
  OpenClawMirrorImportPreview,
  OpenClawMirrorImportRequest,
  OpenClawMirrorImportResult,
  LocalAiProxyRequestLogRecord,
  LocalAiProxyRequestLogsQuery,
  LocalAiProxyRouteTestRecord,
  PaginatedResult,
} from '@sdkwork/claw-types';
import type {
  RuntimeDesktopKernelInfo,
  RuntimeStorageInfo,
} from './contracts/runtime.ts';

function createEmptyPage<T>(): PaginatedResult<T> {
  return {
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
    hasMore: false,
  };
}

export class WebKernelPlatform implements KernelPlatformAPI {
  async getInfo(): Promise<RuntimeDesktopKernelInfo | null> {
    return null;
  }

  async getStorageInfo(): Promise<RuntimeStorageInfo | null> {
    return null;
  }

  async getStatus(): Promise<RuntimeDesktopKernelHostInfo | null> {
    return null;
  }

  async ensureRunning(): Promise<RuntimeDesktopKernelHostInfo | null> {
    return null;
  }

  async restart(): Promise<RuntimeDesktopKernelHostInfo | null> {
    return null;
  }

  async testLocalAiProxyRoute(
    _routeId: string,
  ): Promise<LocalAiProxyRouteTestRecord | null> {
    return null;
  }

  async listLocalAiProxyRequestLogs(
    _query: LocalAiProxyRequestLogsQuery,
  ): Promise<PaginatedResult<LocalAiProxyRequestLogRecord>> {
    return createEmptyPage();
  }

  async listLocalAiProxyMessageLogs(
    _query: LocalAiProxyMessageLogsQuery,
  ): Promise<PaginatedResult<LocalAiProxyMessageLogRecord>> {
    return createEmptyPage();
  }

  async updateLocalAiProxyMessageCapture(
    enabled: boolean,
  ): Promise<LocalAiProxyMessageCaptureSettings> {
    return {
      enabled,
      updatedAt: null,
    };
  }

  async inspectOpenClawMirrorExport(): Promise<OpenClawMirrorExportPreview | null> {
    return null;
  }

  async exportOpenClawMirror(
    _request: OpenClawMirrorExportRequest,
  ): Promise<OpenClawMirrorExportResult> {
    throw new Error('OpenClaw mirror export is not available for the active platform bridge.');
  }

  async inspectOpenClawMirrorImport(
    _sourcePath: string,
  ): Promise<OpenClawMirrorImportPreview | null> {
    return null;
  }

  async importOpenClawMirror(
    _request: OpenClawMirrorImportRequest,
  ): Promise<OpenClawMirrorImportResult> {
    throw new Error('OpenClaw mirror import is not available for the active platform bridge.');
  }
}
