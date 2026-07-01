import type { OpenClawChannelSnapshot } from '@sdkwork/claw-core';

export type OpenClawConfigChannelDrafts = Record<string, Record<string, string>>;

export type OpenClawConfigChannelMutationPlan =
  | {
      kind: 'toggleEnabled';
      instanceId: string;
      channelId: string;
      nextEnabled: boolean;
    }
  | {
      kind: 'saveConfig';
      instanceId: string;
      channelId: string;
      values: Record<string, string>;
    }
  | {
      kind: 'deleteConfig';
      instanceId: string;
      channelId: string;
      emptyValues: Record<string, string>;
    };

export interface OpenClawConfigChannelMutationRequest {
  mutationPlan: OpenClawConfigChannelMutationPlan;
  successMessage: string;
  failureMessage: string;
  setSaving?: (value: boolean) => void;
  setError?: (value: string | null) => void;
  afterSuccess?: () => void;
}

export type OpenClawConfigChannelMutationBuildResult =
  | {
      kind: 'skip';
    }
  | {
      kind: 'error';
      errorMessage: string;
    }
  | {
      kind: 'mutation';
      request: OpenClawConfigChannelMutationRequest;
    };

export interface RunOpenClawConfigChannelMutationArgs {
  request: OpenClawConfigChannelMutationRequest;
  executeSaveConfig: (
    instanceId: string,
    channelId: string,
    values: Record<string, string>,
  ) => Promise<void>;
  executeToggleEnabled: (
    instanceId: string,
    channelId: string,
    nextEnabled: boolean,
  ) => Promise<void>;
  reloadWorkbench: (instanceId: string) => Promise<void>;
  reportSuccess: (message: string) => void;
  reportError: (message: string) => void;
}

export interface CreateOpenClawConfigChannelMutationRunnerArgs {
  executeSaveConfig: (
    instanceId: string,
    channelId: string,
    values: Record<string, string>,
  ) => Promise<void>;
  executeToggleEnabled: (
    instanceId: string,
    channelId: string,
    nextEnabled: boolean,
  ) => Promise<void>;
  reloadWorkbench: (
    instanceId: string,
    options: {
      withSpinner: boolean;
    },
  ) => Promise<void>;
  reportSuccess: (message: string) => void;
  reportError: (message: string) => void;
}

export interface BuildOpenClawConfigChannelMutationHandlersArgs {
  instanceId: string | undefined;
  configChannels:
    | Array<Pick<OpenClawChannelSnapshot, 'id' | 'name'>>
    | null
    | undefined;
  selectedConfigChannel:
    | Pick<OpenClawChannelSnapshot, 'id' | 'name' | 'fields' | 'values'>
    | null;
  selectedConfigChannelDraft: Record<string, string> | null;
  setSavingConfigChannel: (value: boolean) => void;
  setConfigChannelError: (value: string | null) => void;
  setSelectedConfigChannelId: (value: string | null) => void;
  setConfigChannelDrafts: (
    updater: (current: OpenClawConfigChannelDrafts) => OpenClawConfigChannelDrafts,
  ) => void;
  executeMutation: (request: OpenClawConfigChannelMutationRequest) => Promise<void>;
}

function buildOpenClawConfigChannelEmptyValues(
  channel: Pick<OpenClawChannelSnapshot, 'fields'>,
): Record<string, string> {
  return channel.fields.reduce<Record<string, string>>((accumulator, field) => {
    accumulator[field.key] = '';
    return accumulator;
  }, {});
}

export function applyOpenClawConfigChannelDraftChange(args: {
  drafts: OpenClawConfigChannelDrafts;
  channel: Pick<OpenClawChannelSnapshot, 'id' | 'values'>;
  fieldKey: string;
  value: string;
}): OpenClawConfigChannelDrafts {
  return {
    ...args.drafts,
    [args.channel.id]: {
      ...(args.drafts[args.channel.id] || args.channel.values),
      [args.fieldKey]: args.value,
    },
  };
}

export function buildOpenClawConfigChannelToggleMutationRequest(args: {
  instanceId: string | undefined;
  channel: Pick<OpenClawChannelSnapshot, 'id' | 'name'>;
  nextEnabled: boolean;
}): OpenClawConfigChannelMutationBuildResult {
  if (!args.instanceId) {
    return {
      kind: 'skip',
    };
  }

  return {
    kind: 'mutation',
    request: {
      mutationPlan: {
        kind: 'toggleEnabled',
        instanceId: args.instanceId,
        channelId: args.channel.id,
        nextEnabled: args.nextEnabled,
      },
      successMessage: args.nextEnabled ? `${args.channel.name} enabled.` : `${args.channel.name} disabled.`,
      failureMessage: `Failed to update ${args.channel.name}.`,
    },
  };
}

export function buildOpenClawConfigChannelSaveMutationRequest(args: {
  instanceId: string | undefined;
  channel: Pick<OpenClawChannelSnapshot, 'id' | 'name' | 'fields'> | null;
  draft: Record<string, string> | null;
  setSaving: (value: boolean) => void;
  setError: (value: string | null) => void;
  afterSuccess?: () => void;
}): OpenClawConfigChannelMutationBuildResult {
  if (!args.instanceId || !args.channel || !args.draft) {
    return {
      kind: 'skip',
    };
  }

  for (const field of args.channel.fields) {
    if (field.required && !(args.draft[field.key] || '').trim()) {
      return {
        kind: 'error',
        errorMessage: `${field.label} is required.`,
      };
    }
  }

  return {
    kind: 'mutation',
    request: {
      mutationPlan: {
        kind: 'saveConfig',
        instanceId: args.instanceId,
        channelId: args.channel.id,
        values: args.draft,
      },
      successMessage: `${args.channel.name} configuration saved.`,
      failureMessage: `Failed to save ${args.channel.name}.`,
      setSaving: args.setSaving,
      setError: args.setError,
      afterSuccess: args.afterSuccess,
    },
  };
}

export function buildOpenClawConfigChannelDeleteMutationRequest(args: {
  instanceId: string | undefined;
  channel: Pick<OpenClawChannelSnapshot, 'id' | 'name' | 'fields'> | null;
  setSaving: (value: boolean) => void;
  setError: (value: string | null) => void;
  afterSuccess?: () => void;
}): OpenClawConfigChannelMutationBuildResult {
  if (!args.instanceId || !args.channel) {
    return {
      kind: 'skip',
    };
  }

  return {
    kind: 'mutation',
    request: {
      mutationPlan: {
        kind: 'deleteConfig',
        instanceId: args.instanceId,
        channelId: args.channel.id,
        emptyValues: buildOpenClawConfigChannelEmptyValues(args.channel),
      },
      successMessage: `${args.channel.name} configuration removed.`,
      failureMessage: `Failed to delete ${args.channel.name} configuration.`,
      setSaving: args.setSaving,
      setError: args.setError,
      afterSuccess: args.afterSuccess,
    },
  };
}

export function createOpenClawConfigChannelMutationRunner(
  args: CreateOpenClawConfigChannelMutationRunnerArgs,
) {
  return async (request: OpenClawConfigChannelMutationRequest) => {
    await runOpenClawConfigChannelMutation({
      request,
      executeSaveConfig: args.executeSaveConfig,
      executeToggleEnabled: args.executeToggleEnabled,
      reloadWorkbench: (instanceId) => args.reloadWorkbench(instanceId, { withSpinner: false }),
      reportSuccess: args.reportSuccess,
      reportError: args.reportError,
    });
  };
}

function findConfigChannelById(
  configChannels:
    | Array<Pick<OpenClawChannelSnapshot, 'id' | 'name'>>
    | null
    | undefined,
  channelId: string,
) {
  return (configChannels || []).find((channel) => channel.id === channelId) || null;
}

export function buildOpenClawConfigChannelMutationHandlers(
  args: BuildOpenClawConfigChannelMutationHandlersArgs,
) {
  const clearSelectedConfigChannelId = () => args.setSelectedConfigChannelId(null);

  return {
    clearSelectedConfigChannelId,
    onToggleConfigChannel: async (channelId: string, nextEnabled: boolean) => {
      const configChannel = findConfigChannelById(args.configChannels, channelId);
      if (!configChannel) {
        return;
      }

      const mutationRequest = buildOpenClawConfigChannelToggleMutationRequest({
        instanceId: args.instanceId,
        channel: configChannel,
        nextEnabled,
      });
      if (mutationRequest.kind !== 'mutation') {
        return;
      }

      await args.executeMutation(mutationRequest.request);
    },
    onSaveConfigChannel: async () => {
      const mutationRequest = buildOpenClawConfigChannelSaveMutationRequest({
        instanceId: args.instanceId,
        channel: args.selectedConfigChannel,
        draft: args.selectedConfigChannelDraft,
        setSaving: args.setSavingConfigChannel,
        setError: args.setConfigChannelError,
        afterSuccess: clearSelectedConfigChannelId,
      });
      if (mutationRequest.kind === 'skip') {
        return;
      }

      if (mutationRequest.kind === 'error') {
        args.setConfigChannelError(mutationRequest.errorMessage);
        return;
      }

      await args.executeMutation(mutationRequest.request);
    },
    onDeleteConfigChannelConfiguration: async () => {
      const mutationRequest = buildOpenClawConfigChannelDeleteMutationRequest({
        instanceId: args.instanceId,
        channel: args.selectedConfigChannel,
        setSaving: args.setSavingConfigChannel,
        setError: args.setConfigChannelError,
        afterSuccess: clearSelectedConfigChannelId,
      });
      if (mutationRequest.kind !== 'mutation') {
        return;
      }

      const baseRequest = mutationRequest.request;
      if (baseRequest.mutationPlan.kind === 'deleteConfig' && args.selectedConfigChannel) {
        const { emptyValues } = baseRequest.mutationPlan;
        const selectedConfigChannelId = args.selectedConfigChannel.id;

        await args.executeMutation({
          ...baseRequest,
          afterSuccess: () => {
            args.setConfigChannelDrafts((current) => ({
              ...current,
              [selectedConfigChannelId]: emptyValues,
            }));
            baseRequest.afterSuccess?.();
          },
        });
        return;
      }

      await args.executeMutation(baseRequest);
    },
  };
}

export async function runOpenClawConfigChannelMutation({
  request,
  executeSaveConfig,
  executeToggleEnabled,
  reloadWorkbench,
  reportSuccess,
  reportError,
}: RunOpenClawConfigChannelMutationArgs) {
  request.setSaving?.(true);
  request.setError?.(null);
  try {
    switch (request.mutationPlan.kind) {
      case 'toggleEnabled':
        await executeToggleEnabled(
          request.mutationPlan.instanceId,
          request.mutationPlan.channelId,
          request.mutationPlan.nextEnabled,
        );
        break;
      case 'saveConfig':
        await executeSaveConfig(
          request.mutationPlan.instanceId,
          request.mutationPlan.channelId,
          request.mutationPlan.values,
        );
        break;
      case 'deleteConfig':
        await executeSaveConfig(
          request.mutationPlan.instanceId,
          request.mutationPlan.channelId,
          request.mutationPlan.emptyValues,
        );
        await executeToggleEnabled(
          request.mutationPlan.instanceId,
          request.mutationPlan.channelId,
          false,
        );
        break;
    }

    reportSuccess(request.successMessage);
    request.afterSuccess?.();
    await reloadWorkbench(request.mutationPlan.instanceId);
  } catch (error: any) {
    const message = error?.message || request.failureMessage;
    if (request.setError) {
      request.setError(message);
    } else {
      reportError(message);
    }
  } finally {
    request.setSaving?.(false);
  }
}
