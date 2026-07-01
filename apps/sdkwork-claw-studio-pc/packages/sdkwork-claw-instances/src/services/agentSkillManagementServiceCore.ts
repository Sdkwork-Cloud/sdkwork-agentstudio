import type { StudioInstanceDetailRecord } from '@sdkwork/claw-types';
import { resolveAttachedKernelConfigFile } from '@sdkwork/claw-core';

export interface AgentSkillManagementDependencies {
  studioApi: {
    getInstanceDetail(id: string): Promise<StudioInstanceDetailRecord | null>;
  };
  openClawGatewayClient: {
    installSkill(
      instanceId: string,
      args: Record<string, unknown>,
    ): Promise<Record<string, unknown>>;
    updateSkill(
      instanceId: string,
      args: Record<string, unknown>,
    ): Promise<Record<string, unknown>>;
  };
  kernelConfigAttachmentApi: {
    resolveAttachedKernelConfigFile(
      detail: StudioInstanceDetailRecord | null | undefined,
    ): string | null;
  };
  openClawConfigDocumentApi: {
    saveSkillEntry(input: {
      configFile: string;
      skillKey: string;
      enabled?: boolean;
      apiKey?: string;
      env?: Record<string, string>;
    }): Promise<unknown>;
    deleteSkillEntry(input: {
      configFile: string;
      skillKey: string;
    }): Promise<unknown>;
  };
  platform: {
    pathExists(path: string): Promise<boolean>;
    removePath(path: string): Promise<void>;
    readFile(path: string): Promise<string>;
    writeFile(path: string, content: string): Promise<void>;
  };
}

export interface AgentSkillManagementServiceDependencyOverrides {
  studioApi?: Partial<AgentSkillManagementDependencies['studioApi']>;
  openClawGatewayClient?: Partial<AgentSkillManagementDependencies['openClawGatewayClient']>;
  kernelConfigAttachmentApi?: Partial<AgentSkillManagementDependencies['kernelConfigAttachmentApi']>;
  openClawConfigDocumentApi?: Partial<
    AgentSkillManagementDependencies['openClawConfigDocumentApi']
  >;
  platform?: Partial<AgentSkillManagementDependencies['platform']>;
}

export interface InstallAgentSkillInput {
  instanceId: string;
  agentId: string;
  isDefaultAgent: boolean;
  slug: string;
  version?: string;
  force?: boolean;
}

export interface SetAgentSkillEnabledInput {
  instanceId: string;
  skillKey: string;
  enabled: boolean;
}

export interface RemoveAgentSkillInput {
  instanceId: string;
  skillKey: string;
  scope: 'workspace' | 'managed' | 'bundled' | 'unknown';
  workspacePath?: string | null;
  baseDir?: string | null;
  filePath?: string | null;
}

function createMissingDependencyError(name: string) {
  return new Error(`Agent skill dependency "${name}" is not configured.`);
}

function createMissingAsyncDependency<TArgs extends unknown[], TResult>(name: string) {
  return async (..._args: TArgs): Promise<TResult> => {
    throw createMissingDependencyError(name);
  };
}

type OpenClawInstanceDetailRecord = StudioInstanceDetailRecord & {
  instance: StudioInstanceDetailRecord['instance'] & {
    runtimeKind: 'openclaw';
  };
};

function normalizePath(path?: string | null) {
  const trimmed = path?.trim();
  return trimmed ? trimmed.replace(/\\/g, '/') : null;
}

function getParentDirectory(path?: string | null) {
  const normalized = normalizePath(path)?.replace(/\/+$/g, '');
  if (!normalized) {
    return null;
  }

  const lastSlashIndex = normalized.lastIndexOf('/');
  if (lastSlashIndex <= 0) {
    return normalized;
  }

  return normalized.slice(0, lastSlashIndex);
}

function joinPath(root?: string | null, ...segments: string[]) {
  const normalizedRoot = normalizePath(root);
  if (!normalizedRoot) {
    return null;
  }

  return [normalizedRoot.replace(/\/+$/g, ''), ...segments].join('/');
}

function resolveWorkspacePath(input: RemoveAgentSkillInput) {
  const explicitWorkspacePath = normalizePath(input.workspacePath);
  if (explicitWorkspacePath) {
    return explicitWorkspacePath;
  }

  const baseDir = normalizePath(input.baseDir) || getParentDirectory(input.filePath);
  const skillsDirectory = getParentDirectory(baseDir);
  if (!skillsDirectory?.endsWith('/skills')) {
    return null;
  }

  return getParentDirectory(skillsDirectory);
}

function resolveRemovalTargetPath(input: RemoveAgentSkillInput) {
  return normalizePath(input.baseDir) || getParentDirectory(input.filePath);
}

async function updateTrackedWorkspaceSkillLockfile(params: {
  platform: AgentSkillManagementDependencies['platform'];
  workspacePath: string | null;
  skillKey: string;
}) {
  const workspacePath = normalizePath(params.workspacePath);
  if (!workspacePath) {
    return;
  }

  const lockfilePath = joinPath(workspacePath, '.clawhub', 'lock.json');

  if (!lockfilePath) {
    return;
  }

  if (!(await params.platform.pathExists(lockfilePath))) {
    return;
  }

  const rawContent = await params.platform.readFile(lockfilePath);
  let parsed: Record<string, unknown>;
  try {
    const candidate = JSON.parse(rawContent);
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      throw new Error('invalid lockfile payload');
    }
    parsed = candidate as Record<string, unknown>;
  } catch (error) {
    throw new Error(
      `Failed to update the tracked workspace skills for "${params.skillKey}": ${
        error instanceof Error ? error.message : 'invalid lockfile'
      }`,
    );
  }

  const skillsRoot =
    parsed.skills && typeof parsed.skills === 'object' && !Array.isArray(parsed.skills)
      ? { ...(parsed.skills as Record<string, unknown>) }
      : {};
  delete skillsRoot[params.skillKey];

  await params.platform.writeFile(
    lockfilePath,
    `${JSON.stringify(
      {
        ...parsed,
        version: typeof parsed.version === 'number' ? parsed.version : 1,
        skills: skillsRoot,
      },
      null,
      2,
    )}\n`,
  );
}

function isOpenClawDetail(
  detail: StudioInstanceDetailRecord | null | undefined,
): detail is OpenClawInstanceDetailRecord {
  return detail?.instance.runtimeKind === 'openclaw';
}

function readErrorMessage(result: Record<string, unknown>) {
  const error = result.error;
  if (error && typeof error === 'object' && !Array.isArray(error)) {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === 'string' && message.trim()) {
      return message.trim();
    }
  }

  const message = result.message;
  if (typeof message === 'string' && message.trim()) {
    return message.trim();
  }

  return null;
}

class AgentSkillManagementService {
  private readonly dependencies: AgentSkillManagementDependencies;

  constructor(dependencies: AgentSkillManagementDependencies) {
    this.dependencies = dependencies;
  }

  async installSkill(input: InstallAgentSkillInput) {
    const slug = input.slug.trim();
    if (!slug) {
      throw new Error('Skill slug is required before starting installation.');
    }

    if (!input.isDefaultAgent) {
      throw new Error(
        'Direct installs only target the default OpenClaw workspace. Use the workspace command for agent-specific workspaces.',
      );
    }

    const detail = await this.dependencies.studioApi.getInstanceDetail(input.instanceId);
    if (!isOpenClawDetail(detail)) {
      throw new Error('Only OpenClaw instances support skill installation.');
    }

    const result = await this.dependencies.openClawGatewayClient.installSkill(input.instanceId, {
      source: 'clawhub',
      slug,
      ...(input.version?.trim() ? { version: input.version.trim() } : {}),
      ...(input.force ? { force: true } : {}),
    });

    if (result.ok === false) {
      throw new Error(readErrorMessage(result) || 'Failed to install the selected OpenClaw skill.');
    }
  }

  async setSkillEnabled(input: SetAgentSkillEnabledInput) {
    const skillKey = input.skillKey.trim();
    if (!skillKey) {
      throw new Error('Skill key is required before updating skill configuration.');
    }

    const detail = await this.dependencies.studioApi.getInstanceDetail(input.instanceId);
    if (!isOpenClawDetail(detail)) {
      throw new Error('Only OpenClaw instances support skill configuration updates.');
    }

    const configFile = detail.lifecycle.configWritable
      ? this.dependencies.kernelConfigAttachmentApi.resolveAttachedKernelConfigFile(detail)
      : null;

    if (configFile) {
      await this.dependencies.openClawConfigDocumentApi.saveSkillEntry({
        configFile,
        skillKey,
        enabled: input.enabled,
      });
      return;
    }

    const result = await this.dependencies.openClawGatewayClient.updateSkill(
      input.instanceId,
      {
        skillKey,
        enabled: input.enabled,
      },
    );

    if (result.ok === false) {
      throw new Error(readErrorMessage(result) || 'Failed to update the selected OpenClaw skill.');
    }
  }

  async removeSkill(input: RemoveAgentSkillInput) {
    const skillKey = input.skillKey.trim();
    if (!skillKey) {
      throw new Error('Skill key is required before removing a skill.');
    }

    if (input.scope !== 'workspace') {
      throw new Error(
        'Only workspace-installed OpenClaw skills can be removed directly. Shared managed and bundled skills must be handled outside the current workspace.',
      );
    }

    const detail = await this.dependencies.studioApi.getInstanceDetail(input.instanceId);
    if (!isOpenClawDetail(detail)) {
      throw new Error('Only OpenClaw instances support skill removal.');
    }

    const removalTargetPath = resolveRemovalTargetPath(input);
    if (!removalTargetPath) {
      throw new Error('Workspace skill path is required before removing the selected skill.');
    }

    if (await this.dependencies.platform.pathExists(removalTargetPath)) {
      await this.dependencies.platform.removePath(removalTargetPath);
    }

    await updateTrackedWorkspaceSkillLockfile({
      platform: this.dependencies.platform,
      workspacePath: resolveWorkspacePath(input),
      skillKey,
    });

    const configFile = detail.lifecycle.configWritable
      ? this.dependencies.kernelConfigAttachmentApi.resolveAttachedKernelConfigFile(detail)
      : null;
    if (configFile) {
      await this.dependencies.openClawConfigDocumentApi.deleteSkillEntry({
        configFile,
        skillKey,
      });
    }
  }
}

function createDefaultDependencies(): AgentSkillManagementDependencies {
  return {
    studioApi: {
      getInstanceDetail: createMissingAsyncDependency('studioApi.getInstanceDetail'),
    },
    openClawGatewayClient: {
      installSkill: createMissingAsyncDependency('openClawGatewayClient.installSkill'),
      updateSkill: createMissingAsyncDependency('openClawGatewayClient.updateSkill'),
    },
    kernelConfigAttachmentApi: {
      resolveAttachedKernelConfigFile: resolveAttachedKernelConfigFile,
    },
    openClawConfigDocumentApi: {
      saveSkillEntry: createMissingAsyncDependency('openClawConfigDocumentApi.saveSkillEntry'),
      deleteSkillEntry: createMissingAsyncDependency('openClawConfigDocumentApi.deleteSkillEntry'),
    },
    platform: {
      pathExists: createMissingAsyncDependency('platform.pathExists'),
      removePath: createMissingAsyncDependency('platform.removePath'),
      readFile: createMissingAsyncDependency('platform.readFile'),
      writeFile: createMissingAsyncDependency('platform.writeFile'),
    },
  };
}

export function createAgentSkillManagementService(
  overrides: AgentSkillManagementServiceDependencyOverrides = {},
) {
  const defaults = createDefaultDependencies();

  return new AgentSkillManagementService({
    studioApi: {
      ...defaults.studioApi,
      ...(overrides.studioApi || {}),
    },
    openClawGatewayClient: {
      ...defaults.openClawGatewayClient,
      ...(overrides.openClawGatewayClient || {}),
    },
    kernelConfigAttachmentApi: {
      ...defaults.kernelConfigAttachmentApi,
      ...(overrides.kernelConfigAttachmentApi || {}),
    },
    openClawConfigDocumentApi: {
      ...defaults.openClawConfigDocumentApi,
      ...(overrides.openClawConfigDocumentApi || {}),
    },
    platform: {
      ...defaults.platform,
      ...(overrides.platform || {}),
    },
  });
}

export const agentSkillManagementService = createAgentSkillManagementService();
