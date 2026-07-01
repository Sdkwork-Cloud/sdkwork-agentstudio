import {
  buildOpenClawCronTaskPayload,
  openClawConfigService,
} from '@sdkwork/claw-core';
import { openClawGatewayClient, studio } from '@sdkwork/claw-infrastructure';
import { instanceService } from './instanceService.ts';
import {
  createInstanceWorkbenchService as createInstanceWorkbenchServiceCore,
  type InstanceWorkbenchServiceDependencyOverrides,
} from './instanceWorkbenchServiceCore.ts';

export type {
  InstanceWorkbenchServiceDependencies,
  InstanceWorkbenchServiceDependencyOverrides,
} from './instanceWorkbenchServiceCore.ts';

function createRuntimeDependencyOverrides(): InstanceWorkbenchServiceDependencyOverrides {
  return {
    studioApi: {
      getInstanceDetail: (id) => studio.getInstanceDetail(id),
      createInstanceTask: (instanceId, payload) => studio.createInstanceTask(instanceId, payload),
      updateInstanceTask: (instanceId, taskId, payload) =>
        studio.updateInstanceTask(instanceId, taskId, payload),
      cloneInstanceTask: (instanceId, taskId, name) =>
        studio.cloneInstanceTask(instanceId, taskId, name),
      runInstanceTaskNow: (instanceId, taskId) => studio.runInstanceTaskNow(instanceId, taskId),
      listInstanceTaskExecutions: (instanceId, taskId) =>
        studio.listInstanceTaskExecutions(instanceId, taskId),
      updateInstanceTaskStatus: (instanceId, taskId, status) =>
        studio.updateInstanceTaskStatus(instanceId, taskId, status),
      deleteInstanceTask: (instanceId, taskId) => studio.deleteInstanceTask(instanceId, taskId),
    },
    instanceService: {
      getInstanceById: (id) => instanceService.getInstanceById(id),
      getInstanceConfig: (id) => instanceService.getInstanceConfig(id),
      getInstanceToken: (id) => instanceService.getInstanceToken(id),
      getInstanceLogs: (id) => instanceService.getInstanceLogs(id),
    },
    kernelConfigAttachmentApi: {
      resolveInstanceConfigPath: (detail) => openClawConfigService.resolveInstanceConfigPath(detail),
    },
    openClawConfigDocumentApi: {
      getConfigDocumentPathInfo: (configPath) =>
        openClawConfigService.getConfigDocumentPathInfo(configPath),
      readConfigSnapshot: (configPath) => openClawConfigService.readConfigSnapshot(configPath),
      getChannelDefinitions: () => openClawConfigService.getChannelDefinitions(),
    },
    openClawGatewayClient: {
      getConfig: (instanceId) => openClawGatewayClient.getConfig(instanceId),
      listModels: (instanceId) => openClawGatewayClient.listModels(instanceId),
      getChannelStatus: (instanceId, args) => openClawGatewayClient.getChannelStatus(instanceId, args),
      getSkillsStatus: (instanceId, args) => openClawGatewayClient.getSkillsStatus(instanceId, args),
      getToolsCatalog: (instanceId, args) => openClawGatewayClient.getToolsCatalog(instanceId, args),
      listAgents: (instanceId) => openClawGatewayClient.listAgents(instanceId),
      listAgentFiles: (instanceId, args) => openClawGatewayClient.listAgentFiles(instanceId, args),
      getAgentFile: (instanceId, args) => openClawGatewayClient.getAgentFile(instanceId, args),
      searchMemory: (instanceId, args) => openClawGatewayClient.searchMemory(instanceId, args),
      getDoctorMemoryStatus: (instanceId, args) =>
        openClawGatewayClient.getDoctorMemoryStatus(instanceId, args),
      getDoctorMemoryDreamDiary: (instanceId, args) =>
        openClawGatewayClient.getDoctorMemoryDreamDiary(instanceId, args),
      listWorkbenchCronJobs: (instanceId) => openClawGatewayClient.listWorkbenchCronJobs(instanceId),
      listWorkbenchCronRuns: (instanceId, taskId) =>
        openClawGatewayClient.listWorkbenchCronRuns(instanceId, taskId),
      addCronJob: (instanceId, payload) => openClawGatewayClient.addCronJob(instanceId, payload as never),
      updateCronJob: (instanceId, taskId, patch) =>
        openClawGatewayClient.updateCronJob(instanceId, taskId, patch as never),
      removeCronJob: (instanceId, taskId) => openClawGatewayClient.removeCronJob(instanceId, taskId),
      runCronJob: (instanceId, taskId) => openClawGatewayClient.runCronJob(instanceId, taskId),
    },
    buildCronTaskPayload: (task, rawDefinition) => buildOpenClawCronTaskPayload(task, rawDefinition),
  };
}

export function createInstanceWorkbenchService(
  overrides: InstanceWorkbenchServiceDependencyOverrides = {},
) {
  const runtimeOverrides = createRuntimeDependencyOverrides();

  return createInstanceWorkbenchServiceCore({
    studioApi: {
      ...runtimeOverrides.studioApi,
      ...(overrides.studioApi || {}),
    },
    instanceService: {
      ...runtimeOverrides.instanceService,
      ...(overrides.instanceService || {}),
    },
    kernelConfigAttachmentApi: {
      ...runtimeOverrides.kernelConfigAttachmentApi,
      ...(overrides.kernelConfigAttachmentApi || {}),
    },
    openClawConfigDocumentApi: {
      ...runtimeOverrides.openClawConfigDocumentApi,
      ...(overrides.openClawConfigDocumentApi || {}),
    },
    openClawGatewayClient: {
      ...runtimeOverrides.openClawGatewayClient,
      ...(overrides.openClawGatewayClient || {}),
    },
    buildCronTaskPayload: overrides.buildCronTaskPayload || runtimeOverrides.buildCronTaskPayload,
  });
}

export const instanceWorkbenchService = createInstanceWorkbenchService();
