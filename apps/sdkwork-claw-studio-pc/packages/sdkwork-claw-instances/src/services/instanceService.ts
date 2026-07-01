import { openClawGatewayClient, studio } from '@sdkwork/claw-infrastructure';
import { openClawConfigService } from '@sdkwork/claw-core';
import {
  buildOpenClawAgentFileId,
  createInstanceService as createInstanceServiceCore,
  type InstanceServiceDependencyOverrides,
} from './instanceServiceCore.ts';

export type {
  CreateInstanceDTO,
  IInstanceService,
  InstanceServiceDependencies,
  InstanceServiceDependencyOverrides,
  OpenClawConfigSchemaSnapshot,
  UpdateInstanceDTO,
} from './instanceServiceCore.ts';

function createRuntimeDependencyOverrides(): InstanceServiceDependencyOverrides {
  return {
    studioApi: {
      listInstances: () => studio.listInstances(),
      getInstance: (id) => studio.getInstance(id),
      getInstanceDetail: (id) => studio.getInstanceDetail(id),
      createInstance: (input) => studio.createInstance(input),
      updateInstance: (id, input) => studio.updateInstance(id, input),
      deleteInstance: (id) => studio.deleteInstance(id),
      startInstance: (id) => studio.startInstance(id),
      stopInstance: (id) => studio.stopInstance(id),
      restartInstance: (id) => studio.restartInstance(id),
      getInstanceConfig: (id) => studio.getInstanceConfig(id),
      updateInstanceConfig: (id, config) => studio.updateInstanceConfig(id, config),
      getInstanceLogs: (id) => studio.getInstanceLogs(id),
      updateInstanceFileContent: (instanceId, fileId, content) =>
        studio.updateInstanceFileContent(instanceId, fileId, content),
      updateInstanceLlmProviderConfig: (instanceId, providerId, update) =>
        studio.updateInstanceLlmProviderConfig(instanceId, providerId, update),
    },
    openClawGatewayClient: {
      getAgentFile: (instanceId, args) => openClawGatewayClient.getAgentFile(instanceId, args),
      setAgentFile: (instanceId, args) => openClawGatewayClient.setAgentFile(instanceId, args),
      getConfig: (instanceId) => openClawGatewayClient.getConfig(instanceId),
      getConfigSchema: (instanceId) => openClawGatewayClient.getConfigSchema(instanceId),
      openConfigFile: (instanceId) => openClawGatewayClient.openConfigFile(instanceId),
      setConfig: (instanceId, args) => openClawGatewayClient.setConfig(instanceId, args),
      patchConfig: (instanceId, args) => openClawGatewayClient.patchConfig(instanceId, args),
      applyConfig: (instanceId, args) => openClawGatewayClient.applyConfig(instanceId, args),
      runUpdate: (instanceId) => openClawGatewayClient.runUpdate(instanceId),
    },
    kernelConfigAttachmentApi: {
      resolveInstanceConfigPath: (detail) => openClawConfigService.resolveInstanceConfigPath(detail),
    },
    openClawConfigDocumentApi: {
      getConfigDocumentPathInfo: (configPath) =>
        openClawConfigService.getConfigDocumentPathInfo(configPath),
      readConfigDocument: (configPath) => openClawConfigService.readConfigDocument(configPath),
      writeConfigDocument: (configPath, raw) =>
        openClawConfigService.writeConfigDocument(configPath, raw),
      saveAgent: (input) => openClawConfigService.saveAgent(input),
      deleteAgent: (input) => openClawConfigService.deleteAgent(input),
      saveChannelConfiguration: (input) => openClawConfigService.saveChannelConfiguration(input),
      saveWebSearchConfiguration: (input) => openClawConfigService.saveWebSearchConfiguration(input),
      saveXSearchConfiguration: (input) => openClawConfigService.saveXSearchConfiguration(input),
      saveWebSearchNativeCodexConfiguration: (input) =>
        openClawConfigService.saveWebSearchNativeCodexConfiguration(input),
      saveWebFetchConfiguration: (input) => openClawConfigService.saveWebFetchConfiguration(input),
      saveAuthCooldownsConfiguration: (input) =>
        openClawConfigService.saveAuthCooldownsConfiguration(input),
      saveDreamingConfiguration: (input) =>
        openClawConfigService.saveDreamingConfiguration(input),
      setChannelEnabled: (input) => openClawConfigService.setChannelEnabled(input),
    },
  };
}

export function createInstanceService(
  overrides: InstanceServiceDependencyOverrides = {},
) {
  const runtimeOverrides = createRuntimeDependencyOverrides();

  return createInstanceServiceCore({
    studioApi: {
      ...runtimeOverrides.studioApi,
      ...(overrides.studioApi || {}),
    },
    openClawGatewayClient: {
      ...runtimeOverrides.openClawGatewayClient,
      ...(overrides.openClawGatewayClient || {}),
    },
    kernelConfigAttachmentApi: {
      ...runtimeOverrides.kernelConfigAttachmentApi,
      ...(overrides.kernelConfigAttachmentApi || {}),
    },
    openClawConfigDocumentApi: {
      ...runtimeOverrides.openClawConfigDocumentApi,
      ...(overrides.openClawConfigDocumentApi || {}),
    },
  });
}

export { buildOpenClawAgentFileId };

export const instanceService = createInstanceService();
