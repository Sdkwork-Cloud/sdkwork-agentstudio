import { createLocalApiProxyProviderCenterWorkspaceService } from "@sdkwork/local-api-proxy";
import { providerConfigCenterService } from "./providerConfigCenterService.ts";
import { providerConfigImportService } from "./providerConfigImportService.ts";

export const providerConfigCenterWorkspaceService =
  createLocalApiProxyProviderCenterWorkspaceService({
    centerApi: providerConfigCenterService,
    importApi: providerConfigImportService,
  });
