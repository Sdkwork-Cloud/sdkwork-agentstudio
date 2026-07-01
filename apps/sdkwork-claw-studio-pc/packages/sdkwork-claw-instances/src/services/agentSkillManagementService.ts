import { openClawConfigService, resolveAttachedKernelConfigFile } from '@sdkwork/claw-core';
import {
  openClawGatewayClient,
  platform,
  studio,
} from '@sdkwork/claw-infrastructure';
import {
  createAgentSkillManagementService as createAgentSkillManagementServiceCore,
  type AgentSkillManagementServiceDependencyOverrides,
} from './agentSkillManagementServiceCore.ts';

export type {
  AgentSkillManagementDependencies,
  AgentSkillManagementServiceDependencyOverrides,
  InstallAgentSkillInput,
  RemoveAgentSkillInput,
  SetAgentSkillEnabledInput,
} from './agentSkillManagementServiceCore.ts';

function createRuntimeDependencyOverrides(): AgentSkillManagementServiceDependencyOverrides {
  return {
    studioApi: {
      getInstanceDetail: (id) => studio.getInstanceDetail(id),
    },
    openClawGatewayClient: {
      installSkill: (instanceId, args) => openClawGatewayClient.installSkill(instanceId, args),
      updateSkill: (instanceId, args) => openClawGatewayClient.updateSkill(instanceId, args),
    },
    kernelConfigAttachmentApi: {
      resolveAttachedKernelConfigFile: (detail) => resolveAttachedKernelConfigFile(detail),
    },
    openClawConfigDocumentApi: {
      saveSkillEntry: (input) => openClawConfigService.saveSkillEntry(input),
      deleteSkillEntry: (input) => openClawConfigService.deleteSkillEntry(input),
    },
    platform: {
      pathExists: (path) => platform.pathExists(path),
      removePath: (path) => platform.removePath(path),
      readFile: (path) => platform.readFile(path),
      writeFile: (path, content) => platform.writeFile(path, content),
    },
  };
}

export function createAgentSkillManagementService(
  overrides: AgentSkillManagementServiceDependencyOverrides = {},
) {
  const runtimeOverrides = createRuntimeDependencyOverrides();

  return createAgentSkillManagementServiceCore({
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
    platform: {
      ...runtimeOverrides.platform,
      ...(overrides.platform || {}),
    },
  });
}

export const agentSkillManagementService = createAgentSkillManagementService();
