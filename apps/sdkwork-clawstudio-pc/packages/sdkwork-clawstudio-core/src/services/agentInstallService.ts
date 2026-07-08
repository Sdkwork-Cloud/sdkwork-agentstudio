import { platform, studio } from '@sdkwork/clawstudio-infrastructure';
import type {
  StudioInstanceDetailRecord,
  StudioInstanceRecord,
  StudioInstanceStatus,
} from '@sdkwork/clawstudio-types';
import { openClawConfigService } from './openClawConfigService.ts';
import {
  AGENT_MARKET_TEMPLATES,
  buildAgentWorkspaceFiles,
  buildCoordinatorWorkspaceFiles,
  type AgentMarketTemplate,
} from './agentCatalog.ts';

export interface AgentInstallTarget {
  id: string;
  name: string;
  kernelId: string;
  typeLabel: string;
  host: string;
  status: StudioInstanceStatus;
  deploymentMode: StudioInstanceRecord['deploymentMode'];
  isBuiltIn: boolean;
  configFile: string;
  agentCount: number;
  installedAgentIds: string[];
  installedTemplateIds: string[];
}

function normalizePath(path: string) {
  return path.replace(/\\/g, '/');
}

function getDirectoryName(path: string) {
  const normalized = normalizePath(path).replace(/\/+$/, '');
  const lastSlashIndex = normalized.lastIndexOf('/');
  if (lastSlashIndex <= 0) {
    return lastSlashIndex === 0 ? '/' : normalized;
  }

  return normalized.slice(0, lastSlashIndex);
}

function joinPath(root: string, ...segments: string[]) {
  return [normalizePath(root).replace(/\/+$/, ''), ...segments].join('/');
}

function resolveInstallableConfigFile(detail: StudioInstanceDetailRecord | null) {
  if (!detail || detail.instance.runtimeKind !== 'openclaw') {
    return null;
  }

  return openClawConfigService.resolveInstanceConfigPath(detail, {
    requireWritable: true,
  });
}

function resolveTemplate(templateId: string) {
  const template = AGENT_MARKET_TEMPLATES.find((entry) => entry.id === templateId);
  if (!template) {
    throw new Error(`Unknown agent template: ${templateId}`);
  }

  return template;
}

async function ensureDirectory(path: string) {
  if (await platform.pathExists(path)) {
    return;
  }

  await platform.createDirectory(path);
}

async function ensureWorkspaceFiles(
  workspacePath: string,
  files: Record<string, string>,
) {
  await ensureDirectory(workspacePath);

  for (const [name, content] of Object.entries(files)) {
    const filePath = joinPath(workspacePath, name);
    if (await platform.pathExists(filePath)) {
      continue;
    }

    await platform.writeFile(filePath, content);
  }
}

async function ensureAgentWorkspaceSkeleton(input: {
  workspacePath: string;
  agentDir: string;
  files: Record<string, string>;
}) {
  await ensureWorkspaceFiles(input.workspacePath, input.files);
  await ensureDirectory(joinPath(input.workspacePath, 'memory'));
  await ensureDirectory(input.agentDir);
  await ensureDirectory(joinPath(getDirectoryName(input.agentDir), 'sessions'));
}

async function loadInstallDetail(instanceId: string) {
  const detail = await studio.getInstanceDetail(instanceId);
  const configFile = resolveInstallableConfigFile(detail);
  if (!configFile) {
    throw new Error(
      'The selected instance does not expose a writable OpenClaw config file from this host.',
    );
  }

  return {
    detail,
    configFile,
  };
}

function mapInstallTarget(
  instance: StudioInstanceRecord,
  configFile: string,
  installedAgentIds: string[],
): AgentInstallTarget {
  const installedTemplateIds = AGENT_MARKET_TEMPLATES
    .map((template) => template.id)
    .filter((templateId) => installedAgentIds.includes(templateId));

  return {
    id: instance.id,
    name: instance.name,
    kernelId: instance.runtimeKind,
    typeLabel: instance.typeLabel,
    host: instance.host,
    status: instance.status,
    deploymentMode: instance.deploymentMode,
    isBuiltIn: instance.isBuiltIn,
    configFile,
    agentCount: installedAgentIds.length,
    installedAgentIds,
    installedTemplateIds,
  };
}

class AgentInstallService {
  readonly templates = AGENT_MARKET_TEMPLATES;

  async listInstallTargets(): Promise<AgentInstallTarget[]> {
    const instances = await studio.listInstances();
    const openClawInstances = instances.filter((instance) => instance.runtimeKind === 'openclaw');
    const targetResults = await Promise.allSettled(
      openClawInstances.map(async (instance) => {
        const detail = await studio.getInstanceDetail(instance.id);
        const configFile = resolveInstallableConfigFile(detail);
        if (!configFile) {
          return null;
        }

        const snapshot = await openClawConfigService.readConfigSnapshot(configFile);
        return mapInstallTarget(
          instance,
          configFile,
          snapshot.agentSnapshots.map((agent) => agent.id),
        );
      }),
    );

    const targets = targetResults.flatMap((result) =>
      result.status === 'fulfilled' && result.value ? [result.value] : [],
    );
    if (targets.length === 0) {
      const rejectedResult = targetResults.find((result) => result.status === 'rejected');
      if (rejectedResult?.status === 'rejected') {
        throw rejectedResult.reason;
      }
    }

    return targets.sort((left, right) => {
      if (left.isBuiltIn !== right.isBuiltIn) {
        return left.isBuiltIn ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    });
  }

  async installTemplate(input: {
    instanceId: string;
    templateId: string;
  }) {
    const template = resolveTemplate(input.templateId);
    const { configFile } = await loadInstallDetail(input.instanceId);
    const installPlan = await openClawConfigService.resolveAgentPaths({
      configFile,
      agentId: template.id,
    });
    const existingSnapshot = await openClawConfigService.readConfigSnapshot(configFile);

    if (existingSnapshot.agentSnapshots.some((agent) => agent.id === installPlan.id)) {
      throw new Error(`${template.name} is already installed on this OpenClaw instance.`);
    }

    await ensureAgentWorkspaceSkeleton({
      workspacePath: installPlan.workspace,
      agentDir: installPlan.agentDir,
      files: buildAgentWorkspaceFiles(template),
    });

    await openClawConfigService.saveAgent({
      configFile,
      agent: {
        id: installPlan.id,
        name: template.name,
        avatar: template.emoji,
        workspace: installPlan.workspace,
        agentDir: installPlan.agentDir,
        isDefault: false,
      },
    });

    const updatedSnapshot = await openClawConfigService.readConfigSnapshot(configFile);
    const allowAgentIds = updatedSnapshot.agentSnapshots.map((agent) => agent.id);

    const multiAgentSnapshot = await openClawConfigService.configureMultiAgentSupport({
      configFile,
      coordinatorAgentId: 'main',
      allowAgentIds,
      subagentDefaults: {
        maxConcurrent: 4,
        maxSpawnDepth: 2,
        maxChildrenPerAgent: 5,
      },
      sessionsVisibility: 'all',
    });

    const coordinator = multiAgentSnapshot.agentSnapshots.find((agent) => agent.id === 'main');
    if (coordinator) {
      await ensureAgentWorkspaceSkeleton({
        workspacePath: coordinator.workspace,
        agentDir: coordinator.agentDir,
        files: buildCoordinatorWorkspaceFiles({
          id: coordinator.id,
          name: coordinator.name,
          emoji: coordinator.avatar,
        }),
      });
    }

    return multiAgentSnapshot;
  }

  getTemplate(templateId: string): AgentMarketTemplate {
    return resolveTemplate(templateId);
  }
}

export const agentInstallService = new AgentInstallService();
