import { openClawConfigService } from '@sdkwork/claw-core';
import { openClawGatewayClient } from '@sdkwork/claw-infrastructure';
import {
  createAgentWorkbenchService as createAgentWorkbenchServiceCore,
  type AgentWorkbenchServiceDependencyOverrides,
} from './agentWorkbenchServiceCore.ts';

export type {
  AgentWorkbenchChannel,
  AgentWorkbenchChannelRouteStatus,
  AgentWorkbenchModelSelection,
  AgentWorkbenchPaths,
  AgentWorkbenchRequest,
  AgentWorkbenchService,
  AgentWorkbenchServiceDependencies,
  AgentWorkbenchServiceDependencyOverrides,
  AgentWorkbenchSkill,
  AgentWorkbenchSkillInstallOption,
  AgentWorkbenchSkillMissingRequirements,
  AgentWorkbenchSkillScope,
  AgentWorkbenchSnapshot,
} from './agentWorkbenchServiceCore.ts';

function createRuntimeDependencyOverrides(): AgentWorkbenchServiceDependencyOverrides {
  return {
    readOpenClawConfigSnapshot: (configFile) => openClawConfigService.readConfigSnapshot(configFile),
    openClawGatewayClient: {
      getSkillsStatus: (instanceId, args = {}) =>
        openClawGatewayClient.getSkillsStatus(instanceId, args),
      getToolsCatalog: (instanceId, args = {}) =>
        openClawGatewayClient.getToolsCatalog(instanceId, args),
    },
  };
}

export function createAgentWorkbenchService(
  overrides: AgentWorkbenchServiceDependencyOverrides = {},
) {
  const runtimeOverrides = createRuntimeDependencyOverrides();

  return createAgentWorkbenchServiceCore({
    readOpenClawConfigSnapshot:
      overrides.readOpenClawConfigSnapshot || runtimeOverrides.readOpenClawConfigSnapshot,
    openClawGatewayClient: {
      ...runtimeOverrides.openClawGatewayClient,
      ...(overrides.openClawGatewayClient || {}),
    },
  });
}

export const agentWorkbenchService = createAgentWorkbenchService();
