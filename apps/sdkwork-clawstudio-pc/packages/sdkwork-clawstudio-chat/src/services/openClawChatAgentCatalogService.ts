import {
  createOpenClawAgentCatalogService,
  openClawAgentCatalogService,
} from '@sdkwork/clawstudio-core';
import type {
  OpenClawAgentCatalog as OpenClawChatAgentCatalog,
  OpenClawAgentCatalogAgent as OpenClawChatAgent,
  OpenClawAgentCatalogDependencies as OpenClawChatAgentCatalogDependencies,
  OpenClawAgentCatalogDependencyOverrides as OpenClawChatAgentCatalogDependencyOverrides,
} from '@sdkwork/clawstudio-core';

export type {
  OpenClawChatAgent,
  OpenClawChatAgentCatalog,
  OpenClawChatAgentCatalogDependencies,
  OpenClawChatAgentCatalogDependencyOverrides,
};

export const createOpenClawChatAgentCatalogService = createOpenClawAgentCatalogService;
export { openClawAgentCatalogService as openClawChatAgentCatalogService };
