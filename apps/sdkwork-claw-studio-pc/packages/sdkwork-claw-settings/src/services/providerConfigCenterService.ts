import {
  LOCAL_API_PROXY_MANAGED_PROVIDER_ID,
  createLocalApiProxyProviderCenterService,
  createLocalApiProxyProviderRoutingCatalogService,
  type ApplyLocalApiProxyProviderConfigInput,
  type LocalApiProxyProviderCenterServiceOverrides,
  type LocalApiProxyProviderConfigDraft,
  type LocalApiProxyProviderConfigPreset,
  type LocalApiProxyProviderConfigRecord,
  type LocalApiProxyProviderCenterActionSupport,
  type LocalApiProxyProviderCenterActionSupportItem,
} from "@sdkwork/local-api-proxy";
import {
  openClawConfigService,
  kernelPlatformService,
  resolveAttachedKernelConfigFile,
} from "@sdkwork/claw-core";
import {
  storage,
  studio,
  type StoragePlatformAPI,
  type StudioPlatformAPI,
} from "@sdkwork/claw-infrastructure";
import type {
  LocalAiProxyRouteManagedBy,
  LocalAiProxyRouteModelRecord,
  LocalAiProxyRouteRuntimeMetrics,
  LocalAiProxyRouteTestRecord,
  LocalAiProxyClientProtocol,
  LocalAiProxyUpstreamProtocol,
  StudioInstanceDetailRecord,
  StudioInstanceRecord,
} from "@sdkwork/claw-types";

export { PROVIDER_CONFIG_CENTER_STORAGE_NAMESPACE } from "@sdkwork/claw-core";

export type ProviderConfigModelRecord = LocalAiProxyRouteModelRecord;

export interface ProviderConfigDraft extends LocalApiProxyProviderConfigDraft {
  managedBy?: LocalAiProxyRouteManagedBy;
  clientProtocol?: LocalAiProxyClientProtocol;
  upstreamProtocol?: LocalAiProxyUpstreamProtocol;
}

export interface ProviderConfigRecord extends LocalApiProxyProviderConfigRecord {
  runtimeMetrics?: LocalAiProxyRouteRuntimeMetrics;
  latestTest?: LocalAiProxyRouteTestRecord | null;
}

export type ProviderConfigPreset = LocalApiProxyProviderConfigPreset;
export type ProviderConfigCenterActionSupport = LocalApiProxyProviderCenterActionSupport;
export type ProviderConfigCenterActionSupportItem =
  LocalApiProxyProviderCenterActionSupportItem;

export interface ProviderConfigApplyInstance {
  id: string;
  name: string;
  isDefault: boolean;
  status: StudioInstanceRecord["status"];
  deploymentMode: StudioInstanceRecord["deploymentMode"];
  configFile: string;
}

export interface ProviderConfigApplyAgent {
  id: string;
  name: string;
  isDefault: boolean;
  primaryModel?: string;
}

export interface ProviderConfigApplyTarget {
  instance: ProviderConfigApplyInstance;
  agents: ProviderConfigApplyAgent[];
}

export interface ApplyProviderConfigInput {
  instanceId: string;
  config: ProviderConfigRecord;
  agentIds?: string[];
}

export interface ProviderConfigCenterServiceOverrides {
  storageApi?: StoragePlatformAPI;
  providerRoutingApi?: LocalApiProxyProviderCenterServiceOverrides["providerRoutingApi"];
  studioApi?: Partial<Pick<StudioPlatformAPI, "listInstances" | "getInstanceDetail">>;
  kernelPlatformService?: Partial<
    Pick<
      typeof kernelPlatformService,
      "getInfo" | "ensureRunning" | "testLocalAiProxyRoute"
    >
  >;
  kernelConfigAttachmentApi?: {
    resolveAttachedKernelConfigFile?: (detail: StudioInstanceDetailRecord | null) => string | null;
  };
  openClawConfigDocumentApi?: Partial<
    Pick<
      typeof openClawConfigService,
      | "readConfigSnapshot"
      | "saveManagedLocalProxyProjection"
      | "saveAgent"
    >
  >;
  now?: () => number;
}

function buildAgentModelRef(providerId: string, modelId: string) {
  return `${providerId.trim().toLowerCase()}/${modelId.trim()}`;
}

function mapDetailToApplyInstance(
  detail: StudioInstanceDetailRecord | null,
  configFile: string | null,
): ProviderConfigApplyInstance | null {
  if (!detail || !detail.lifecycle.configWritable || !configFile) {
    return null;
  }

  return {
    id: detail.instance.id,
    name: detail.instance.name,
    isDefault: detail.instance.isDefault,
    status: detail.instance.status,
    deploymentMode: detail.instance.deploymentMode,
    configFile,
  };
}

export function createProviderConfigCenterService(
  overrides: ProviderConfigCenterServiceOverrides = {},
) {
  const routingDefaults = createLocalApiProxyProviderRoutingCatalogService({
    storageApi: overrides.storageApi || storage,
    now: overrides.now,
  });
  const studioApi = {
    listInstances: overrides.studioApi?.listInstances ?? (() => studio.listInstances()),
    getInstanceDetail:
      overrides.studioApi?.getInstanceDetail
      ?? ((instanceId: string) => studio.getInstanceDetail(instanceId)),
  };
  const kernelConfigAttachmentApi = {
    resolveAttachedKernelConfigFile:
      overrides.kernelConfigAttachmentApi?.resolveAttachedKernelConfigFile
      ?? ((detail: StudioInstanceDetailRecord | null) => resolveAttachedKernelConfigFile(detail)),
  };
  const openClawConfigDocumentApi = {
    readConfigSnapshot:
      overrides.openClawConfigDocumentApi?.readConfigSnapshot
      ?? ((configFile: string) => openClawConfigService.readConfigSnapshot(configFile)),
    saveManagedLocalProxyProjection:
      overrides.openClawConfigDocumentApi?.saveManagedLocalProxyProjection
      ?? ((input: any) => openClawConfigService.saveManagedLocalProxyProjection(input)),
    saveAgent:
      overrides.openClawConfigDocumentApi?.saveAgent
      ?? ((input: any) => openClawConfigService.saveAgent(input)),
  };
  const sharedService = createLocalApiProxyProviderCenterService({
    providerRoutingApi: {
      listProviderRoutingRecords:
        overrides.providerRoutingApi?.listProviderRoutingRecords
        ?? (() => routingDefaults.listProviderRoutingRecords()),
      saveProviderRoutingRecord:
        overrides.providerRoutingApi?.saveProviderRoutingRecord
        ?? ((input) => routingDefaults.saveProviderRoutingRecord(input)),
      deleteProviderRoutingRecord:
        overrides.providerRoutingApi?.deleteProviderRoutingRecord
        ?? ((id) => routingDefaults.deleteProviderRoutingRecord(id)),
    },
    runtimeApi: {
      getInfo:
        overrides.kernelPlatformService?.getInfo ?? (() => kernelPlatformService.getInfo()),
      ensureRunning:
        overrides.kernelPlatformService?.ensureRunning
        ?? (() => kernelPlatformService.ensureRunning()),
      testLocalApiProxyRoute:
        overrides.kernelPlatformService?.testLocalAiProxyRoute
        ?? ((routeId) => kernelPlatformService.testLocalAiProxyRoute(routeId)),
    },
    applyApi: {
      listTargets: async () => {
        const instances = await studioApi.listInstances();
        const details = await Promise.all(
          instances.map(async (instance) => {
            try {
              const detail = await studioApi.getInstanceDetail(instance.id);
              const configFile = kernelConfigAttachmentApi.resolveAttachedKernelConfigFile(detail);
              const mapped = mapDetailToApplyInstance(detail, configFile);
              return mapped
                ? {
                    id: mapped.id,
                    name: mapped.name,
                    kind: detail?.instance.runtimeKind || "openclaw",
                    isDefault: mapped.isDefault,
                    writable: true,
                    configFile: mapped.configFile,
                    detail: mapped.deploymentMode,
                  }
                : null;
            } catch {
              return null;
            }
          }),
        );

        return details.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
      },
      getTarget: async (targetId) => {
        const detail = await studioApi.getInstanceDetail(targetId);
        const configFile = kernelConfigAttachmentApi.resolveAttachedKernelConfigFile(detail);
        const mappedInstance = mapDetailToApplyInstance(detail, configFile);
        if (!mappedInstance) {
          return null;
        }

        const snapshot = await openClawConfigDocumentApi.readConfigSnapshot(mappedInstance.configFile);
        return {
          target: {
            id: mappedInstance.id,
            name: mappedInstance.name,
            kind: detail?.instance.runtimeKind || "openclaw",
            isDefault: mappedInstance.isDefault,
            writable: true,
            configFile: mappedInstance.configFile,
            detail: mappedInstance.deploymentMode,
          },
          agents: (snapshot.agentSnapshots || []).map((agent) => ({
            id: agent.id,
            name: agent.name,
            isDefault: agent.isDefault,
            primaryModel: agent.model.primary,
          })),
        };
      },
      applyProjection: async (input) => {
        await openClawConfigDocumentApi.saveManagedLocalProxyProjection({
          configFile: input.configFile,
          projection: input.projection as any,
        });

        const reasoningModelId = input.projection.selection.reasoningModelId?.trim();
        const fallbacks = reasoningModelId
          ? [buildAgentModelRef(LOCAL_API_PROXY_MANAGED_PROVIDER_ID, reasoningModelId)]
          : [];

        for (const agentId of input.agentIds || []) {
          await openClawConfigDocumentApi.saveAgent({
            configFile: input.configFile,
            agent: {
              id: agentId,
              model: {
                primary: buildAgentModelRef(
                  LOCAL_API_PROXY_MANAGED_PROVIDER_ID,
                  input.projection.selection.defaultModelId,
                ),
                fallbacks,
              },
            },
          });
        }
      },
    },
  });

  return {
    listPresets: () => sharedService.listPresets(),
    listProviderConfigs: () => sharedService.listProviderConfigs() as Promise<ProviderConfigRecord[]>,
    saveProviderConfig: (input: ProviderConfigDraft & { id?: string }) =>
      sharedService.saveProviderConfig(input) as Promise<ProviderConfigRecord>,
    deleteProviderConfig: (id: string) => sharedService.deleteProviderConfig(id),
    getActionSupport: () => sharedService.getActionSupport(),
    testProviderConfigRoute: (routeId: string) => sharedService.testProviderConfigRoute(routeId),
    listApplyInstances: async (): Promise<ProviderConfigApplyInstance[]> => {
      const targets = await sharedService.listApplyTargets();
      return targets
        .filter((target) => Boolean(target.configFile))
        .map((target) => ({
          id: target.id,
          name: target.name,
          isDefault: target.isDefault,
          status: "online",
          deploymentMode: (target.detail || "local-managed") as StudioInstanceRecord["deploymentMode"],
          configFile: target.configFile!,
        }));
    },
    getInstanceApplyTarget: async (instanceId: string): Promise<ProviderConfigApplyTarget> => {
      const target = await sharedService.getApplyTarget(instanceId);
      return {
        instance: {
          id: target.target.id,
          name: target.target.name,
          isDefault: target.target.isDefault,
          status: "online",
          deploymentMode: (target.target.detail || "local-managed") as StudioInstanceRecord["deploymentMode"],
          configFile: target.target.configFile!,
        },
        agents: target.agents.map((agent) => ({
          id: agent.id,
          name: agent.name,
          isDefault: agent.isDefault,
          primaryModel: agent.primaryModel,
        })),
      };
    },
    applyProviderConfig: (input: ApplyProviderConfigInput) =>
      sharedService.applyProviderConfig({
        targetId: input.instanceId,
        config: input.config,
        agentIds: input.agentIds,
      } satisfies ApplyLocalApiProxyProviderConfigInput),
  };
}

export const providerConfigCenterService = createProviderConfigCenterService();
