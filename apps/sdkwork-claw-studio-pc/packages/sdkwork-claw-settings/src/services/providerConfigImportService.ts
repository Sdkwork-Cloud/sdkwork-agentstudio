import {
  createLocalApiProxyProviderImportService,
  type ImportedLocalApiProxyProviderDraft,
  type LocalApiProxyProviderImportResult,
  type LocalApiProxyProviderImportSource,
} from "@sdkwork/local-api-proxy";
import {
  platform,
  runtime,
  type PlatformAPI,
  type RuntimePlatformAPI,
} from "@sdkwork/claw-infrastructure";

export type ProviderConfigImportSource = LocalApiProxyProviderImportSource;
export type ImportedProviderConfigDraft = ImportedLocalApiProxyProviderDraft;
export type ProviderConfigImportResult = LocalApiProxyProviderImportResult;

interface ProviderConfigImportServiceDependencies {
  platformApi: Pick<
    PlatformAPI,
    "getPlatform" | "pathExistsForUserTooling" | "readFileForUserTooling"
  >;
  runtimeApi: Pick<RuntimePlatformAPI, "getRuntimeInfo">;
}

export interface ProviderConfigImportServiceOverrides {
  platformApi?: Partial<ProviderConfigImportServiceDependencies["platformApi"]>;
  runtimeApi?: Partial<ProviderConfigImportServiceDependencies["runtimeApi"]>;
}

export function createProviderConfigImportService(
  overrides: ProviderConfigImportServiceOverrides = {},
) {
  return createLocalApiProxyProviderImportService({
    platformApi: {
      getPlatform: overrides.platformApi?.getPlatform ?? (() => platform.getPlatform()),
      pathExistsForUserTooling:
        overrides.platformApi?.pathExistsForUserTooling
        ?? ((filePath) => platform.pathExistsForUserTooling(filePath)),
      readFileForUserTooling:
        overrides.platformApi?.readFileForUserTooling
        ?? ((filePath) => platform.readFileForUserTooling(filePath)),
    },
    runtimeApi: {
      getRuntimeInfo:
        overrides.runtimeApi?.getRuntimeInfo ?? (() => runtime.getRuntimeInfo()),
    },
  });
}

export const providerConfigImportService = createProviderConfigImportService();
