import type {
  InstallAgentSkillInput,
  RemoveAgentSkillInput,
  SetAgentSkillEnabledInput,
} from './agentSkillManagementServiceCore.ts';

type TranslateFunction = (key: string) => string;

type PendingKeysSetter = (updater: (current: string[]) => string[]) => void;

type SelectedAgentInstallSource = {
  agent: {
    agent: {
      id: string;
    };
    isDefault?: boolean;
  };
};

type SelectedAgentRemoveSource = {
  paths: {
    workspacePath?: string | null;
  };
};

type SelectedAgentSkillMutationSource = SelectedAgentInstallSource & SelectedAgentRemoveSource;

export type OpenClawAgentSkillMutationRequest =
  | {
      instanceId: string;
      kind: 'install';
      setPending: (value: boolean) => void;
      execute: () => Promise<void>;
      successKey: string;
      failureKey: string;
    }
  | {
      instanceId: string;
      kind: 'toggle' | 'remove';
      pendingKey: string;
      setPendingKeys: PendingKeysSetter;
      execute: () => Promise<void>;
      successKey: string;
      failureKey: string;
    };

export type OpenClawAgentSkillMutationBuildResult =
  | {
      kind: 'skip';
    }
  | {
      kind: 'mutation';
      request: OpenClawAgentSkillMutationRequest;
    };

export interface CreateOpenClawAgentSkillMutationRunnerArgs {
  reloadWorkbench: (
    instanceId: string,
    options: {
      withSpinner: boolean;
    },
  ) => Promise<void>;
  reportSuccess: (message: string) => void;
  reportError: (message: string) => void;
  t: TranslateFunction;
}

export interface BuildOpenClawAgentSkillMutationHandlersArgs {
  instanceId: string | undefined;
  selectedAgent: SelectedAgentSkillMutationSource | null;
  setInstallingSkill: (value: boolean) => void;
  setUpdatingSkillKeys: PendingKeysSetter;
  setRemovingSkillKeys: PendingKeysSetter;
  executeInstall: (input: InstallAgentSkillInput) => Promise<void>;
  executeToggle: (input: SetAgentSkillEnabledInput) => Promise<void>;
  executeRemove: (input: RemoveAgentSkillInput) => Promise<void>;
  executeMutation: (request: OpenClawAgentSkillMutationRequest) => Promise<void>;
}

function addPendingKey(keys: string[], key: string) {
  return keys.includes(key) ? keys : [...keys, key];
}

function removePendingKey(keys: string[], key: string) {
  return keys.filter((item) => item !== key);
}

export function buildOpenClawAgentSkillInstallMutationRequest(args: {
  instanceId: string | undefined;
  selectedAgent: SelectedAgentInstallSource | null;
  slug: string;
  setPending: (value: boolean) => void;
  executeInstall: (input: InstallAgentSkillInput) => Promise<void>;
}): OpenClawAgentSkillMutationBuildResult {
  if (!args.instanceId || !args.selectedAgent) {
    return {
      kind: 'skip',
    };
  }

  return {
    kind: 'mutation',
    request: {
      instanceId: args.instanceId,
      kind: 'install',
      setPending: args.setPending,
      execute: () =>
        args.executeInstall({
          instanceId: args.instanceId!,
          agentId: args.selectedAgent!.agent.agent.id,
          isDefaultAgent: Boolean(args.selectedAgent!.agent.isDefault),
          slug: args.slug,
        }),
      successKey: 'instances.detail.instanceWorkbench.agents.toasts.skillInstalled',
      failureKey: 'instances.detail.instanceWorkbench.agents.toasts.skillInstallFailed',
    },
  };
}

export function buildOpenClawAgentSkillToggleMutationRequest(args: {
  instanceId: string | undefined;
  skillKey: string;
  enabled: boolean;
  setPendingKeys: PendingKeysSetter;
  executeToggle: (input: SetAgentSkillEnabledInput) => Promise<void>;
}): OpenClawAgentSkillMutationBuildResult {
  if (!args.instanceId) {
    return {
      kind: 'skip',
    };
  }

  return {
    kind: 'mutation',
    request: {
      instanceId: args.instanceId,
      kind: 'toggle',
      pendingKey: args.skillKey,
      setPendingKeys: args.setPendingKeys,
      execute: () =>
        args.executeToggle({
          instanceId: args.instanceId!,
          skillKey: args.skillKey,
          enabled: args.enabled,
        }),
      successKey: args.enabled
        ? 'instances.detail.instanceWorkbench.agents.toasts.skillEnabled'
        : 'instances.detail.instanceWorkbench.agents.toasts.skillDisabled',
      failureKey: 'instances.detail.instanceWorkbench.agents.toasts.skillUpdateFailed',
    },
  };
}

export function buildOpenClawAgentSkillRemoveMutationRequest(args: {
  instanceId: string | undefined;
  selectedAgent: SelectedAgentRemoveSource | null;
  skill: {
    skillKey: string;
    scope: RemoveAgentSkillInput['scope'];
    baseDir?: string | null;
    filePath?: string | null;
  };
  setPendingKeys: PendingKeysSetter;
  executeRemove: (input: RemoveAgentSkillInput) => Promise<void>;
}): OpenClawAgentSkillMutationBuildResult {
  if (!args.instanceId || !args.selectedAgent) {
    return {
      kind: 'skip',
    };
  }

  return {
    kind: 'mutation',
    request: {
      instanceId: args.instanceId,
      kind: 'remove',
      pendingKey: args.skill.skillKey,
      setPendingKeys: args.setPendingKeys,
      execute: () =>
        args.executeRemove({
          instanceId: args.instanceId!,
          skillKey: args.skill.skillKey,
          scope: args.skill.scope,
          workspacePath: args.selectedAgent?.paths.workspacePath,
          baseDir: args.skill.baseDir,
          filePath: args.skill.filePath,
        }),
      successKey: 'instances.detail.instanceWorkbench.agents.toasts.skillRemoved',
      failureKey: 'instances.detail.instanceWorkbench.agents.toasts.skillRemoveFailed',
    },
  };
}

export function createOpenClawAgentSkillMutationRunner(
  args: CreateOpenClawAgentSkillMutationRunnerArgs,
) {
  return async (request: OpenClawAgentSkillMutationRequest) => {
    if (request.kind === 'install') {
      request.setPending(true);
    } else {
      request.setPendingKeys((current) => addPendingKey(current, request.pendingKey));
    }

    try {
      await request.execute();
      args.reportSuccess(args.t(request.successKey));
      await args.reloadWorkbench(request.instanceId, { withSpinner: false });
    } catch (error: any) {
      args.reportError(error?.message || args.t(request.failureKey));
    } finally {
      if (request.kind === 'install') {
        request.setPending(false);
      } else {
        request.setPendingKeys((current) => removePendingKey(current, request.pendingKey));
      }
    }
  };
}

export function buildOpenClawAgentSkillMutationHandlers(
  args: BuildOpenClawAgentSkillMutationHandlersArgs,
) {
  return {
    onInstallAgentSkill: async (slug: string) => {
      const mutationRequest = buildOpenClawAgentSkillInstallMutationRequest({
        instanceId: args.instanceId,
        selectedAgent: args.selectedAgent,
        slug,
        setPending: args.setInstallingSkill,
        executeInstall: args.executeInstall,
      });
      if (mutationRequest.kind !== 'mutation') {
        return;
      }

      await args.executeMutation(mutationRequest.request);
    },
    onSetAgentSkillEnabled: async (skillKey: string, enabled: boolean) => {
      const mutationRequest = buildOpenClawAgentSkillToggleMutationRequest({
        instanceId: args.instanceId,
        skillKey,
        enabled,
        setPendingKeys: args.setUpdatingSkillKeys,
        executeToggle: args.executeToggle,
      });
      if (mutationRequest.kind !== 'mutation') {
        return;
      }

      await args.executeMutation(mutationRequest.request);
    },
    onRemoveAgentSkill: async (skill: {
      skillKey: string;
      scope: RemoveAgentSkillInput['scope'];
      baseDir?: string | null;
      filePath?: string | null;
    }) => {
      const mutationRequest = buildOpenClawAgentSkillRemoveMutationRequest({
        instanceId: args.instanceId,
        selectedAgent: args.selectedAgent,
        skill,
        setPendingKeys: args.setRemovingSkillKeys,
        executeRemove: args.executeRemove,
      });
      if (mutationRequest.kind !== 'mutation') {
        return;
      }

      await args.executeMutation(mutationRequest.request);
    },
  };
}
