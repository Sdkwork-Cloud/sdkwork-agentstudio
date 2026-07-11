import {
  kernel,
  type KernelPlatformAPI,
} from '@sdkwork/agentstudio-pc-infrastructure';
import type {
  OpenClawMirrorExportPreview,
  OpenClawMirrorExportRequest,
  OpenClawMirrorExportResult,
  OpenClawMirrorImportPreview,
  OpenClawMirrorImportRequest,
  OpenClawMirrorImportResult,
} from '@sdkwork/agentstudio-pc-types';

export interface CreateOpenClawMirrorServiceOptions {
  getKernelPlatform?: () => KernelPlatformAPI;
}

export function createOpenClawMirrorService(
  options: CreateOpenClawMirrorServiceOptions = {},
) {
  const resolveKernelPlatform = options.getKernelPlatform ?? (() => kernel);

  return {
    async inspectOpenClawMirrorExport(): Promise<OpenClawMirrorExportPreview | null> {
      return resolveKernelPlatform().inspectOpenClawMirrorExport();
    },

    async exportOpenClawMirror(
      request: OpenClawMirrorExportRequest,
    ): Promise<OpenClawMirrorExportResult> {
      return resolveKernelPlatform().exportOpenClawMirror(request);
    },

    async inspectOpenClawMirrorImport(
      sourcePath: string,
    ): Promise<OpenClawMirrorImportPreview | null> {
      return resolveKernelPlatform().inspectOpenClawMirrorImport(sourcePath);
    },

    async importOpenClawMirror(
      request: OpenClawMirrorImportRequest,
    ): Promise<OpenClawMirrorImportResult> {
      return resolveKernelPlatform().importOpenClawMirror(request);
    },
  };
}

export const openClawMirrorService = createOpenClawMirrorService();
