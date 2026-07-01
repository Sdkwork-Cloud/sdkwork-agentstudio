import { storage, type StoragePlatformAPI } from '@sdkwork/claw-infrastructure';
import {
  LOCAL_API_PROXY_PROVIDER_ROUTE_STORAGE_NAMESPACE,
  createLocalApiProxyProviderRoutingCatalogService,
  listKnownLocalApiProxyProviderRoutingChannels,
  normalizeLocalApiProxyProviderRoutingDraft,
  type LocalApiProxyProviderChannelDefinition,
  type LocalApiProxyProviderRoutingCatalogService,
  type LocalApiProxyProviderRoutingDraft,
  type LocalApiProxyProviderRoutingDraftInput,
  type LocalApiProxyProviderRoutingRecord,
  type LocalApiProxyProviderRuntimeConfig,
} from '@sdkwork/local-api-proxy';

export const PROVIDER_CONFIG_CENTER_STORAGE_NAMESPACE =
  LOCAL_API_PROXY_PROVIDER_ROUTE_STORAGE_NAMESPACE;

export type ProviderRoutingChannelDefinition =
  LocalApiProxyProviderChannelDefinition;

export type ProviderRoutingRuntimeConfig = LocalApiProxyProviderRuntimeConfig;

export type ProviderRoutingDraft = LocalApiProxyProviderRoutingDraft;

export type ProviderRoutingDraftInput = LocalApiProxyProviderRoutingDraftInput;

export type ProviderRoutingRecord = LocalApiProxyProviderRoutingRecord;

export type ProviderRoutingCatalogService =
  LocalApiProxyProviderRoutingCatalogService;

export interface CreateProviderRoutingCatalogServiceOptions {
  storageApi?: StoragePlatformAPI;
  now?: () => number;
}

export const listKnownProviderRoutingChannels =
  listKnownLocalApiProxyProviderRoutingChannels;

export const normalizeProviderRoutingDraft =
  normalizeLocalApiProxyProviderRoutingDraft;

export function createProviderRoutingCatalogService(
  options: CreateProviderRoutingCatalogServiceOptions = {},
): ProviderRoutingCatalogService {
  return createLocalApiProxyProviderRoutingCatalogService({
    storageApi: options.storageApi || storage,
    now: options.now,
    storageNamespace: PROVIDER_CONFIG_CENTER_STORAGE_NAMESPACE,
  });
}

export const providerRoutingCatalogService = createProviderRoutingCatalogService();
