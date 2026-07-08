import type { OpenClawAgentInput } from '@sdkwork/clawstudio-core';
import {
  buildOpenClawAgentInputFromForm,
  type OpenClawAgentFormState,
} from './openClawAgentPresentation.ts';

type TranslateFunction = (key: string) => string;
type ErrorReporter = (message: string) => void;

export interface OpenClawAgentMutationRequest<TAgent> {
  instanceId: string;
  kind: 'create' | 'update' | 'delete';
  agent?: TAgent;
  agentId?: string;
  setSaving?: (value: boolean) => void;
  afterSuccess?: () => void | Promise<void>;
  successKey: string;
  failureKey: string;
}

export type OpenClawAgentMutationBuildResult<TAgent> =
  | {
      kind: 'skip';
    }
  | {
      kind: 'error';
      errorMessage: string;
    }
  | {
      kind: 'mutation';
      request: OpenClawAgentMutationRequest<TAgent>;
    };

export interface CreateOpenClawAgentMutationRunnerArgs<TAgent> {
  executeCreate: (instanceId: string, agent: TAgent) => Promise<void>;
  executeUpdate: (instanceId: string, agent: TAgent) => Promise<void>;
  executeDelete: (instanceId: string, agentId: string) => Promise<void>;
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

export interface BuildOpenClawAgentMutationHandlersArgs {
  instanceId: string | undefined;
  editingAgentId: string | null;
  agentDialogDraft: OpenClawAgentFormState;
  setSavingAgentDialog: (value: boolean) => void;
  dismissAgentDialog: () => void;
  agentDeleteId: string | null;
  clearAgentDeleteId: () => void;
  executeMutation: (request: OpenClawAgentMutationRequest<OpenClawAgentInput>) => Promise<void>;
  afterSaveSuccess?: (
    agent: OpenClawAgentInput,
    kind: 'create' | 'update',
  ) => void | Promise<void>;
  reportError: ErrorReporter;
  t: TranslateFunction;
}

export function buildOpenClawAgentSaveMutationRequest(args: {
  instanceId: string | undefined;
  editingAgentId: string | null;
  agentDialogDraft: OpenClawAgentFormState;
  setSaving: (value: boolean) => void;
  afterSuccess?: (
    agent: OpenClawAgentInput,
    kind: 'create' | 'update',
  ) => void | Promise<void>;
  t: TranslateFunction;
}): OpenClawAgentMutationBuildResult<OpenClawAgentInput> {
  if (!args.instanceId) {
    return {
      kind: 'skip',
    };
  }

  const agentInput = buildOpenClawAgentInputFromForm(args.agentDialogDraft);
  if (!agentInput.id) {
    return {
      kind: 'error',
      errorMessage: args.t('instances.detail.instanceWorkbench.agents.toasts.agentIdRequired'),
    };
  }

  const kind = args.editingAgentId ? 'update' : 'create';

  return {
    kind: 'mutation',
    request: {
      instanceId: args.instanceId,
      kind,
      agent: agentInput,
      setSaving: args.setSaving,
      afterSuccess: () => args.afterSuccess?.(agentInput, kind),
      successKey: args.editingAgentId
        ? 'instances.detail.instanceWorkbench.agents.toasts.agentUpdated'
        : 'instances.detail.instanceWorkbench.agents.toasts.agentCreated',
      failureKey: 'instances.detail.instanceWorkbench.agents.toasts.agentSaveFailed',
    },
  };
}

export function buildOpenClawAgentDeleteMutationRequest(args: {
  instanceId: string | undefined;
  agentDeleteId: string | null;
  afterSuccess: () => void;
}): OpenClawAgentMutationBuildResult<OpenClawAgentInput> {
  if (!args.instanceId || !args.agentDeleteId) {
    return {
      kind: 'skip',
    };
  }

  return {
    kind: 'mutation',
    request: {
      instanceId: args.instanceId,
      kind: 'delete',
      agentId: args.agentDeleteId,
      afterSuccess: args.afterSuccess,
      successKey: 'instances.detail.instanceWorkbench.agents.toasts.agentRemoved',
      failureKey: 'instances.detail.instanceWorkbench.agents.toasts.agentDeleteFailed',
    },
  };
}

export function createOpenClawAgentMutationRunner<TAgent>(
  args: CreateOpenClawAgentMutationRunnerArgs<TAgent>,
) {
  return async (request: OpenClawAgentMutationRequest<TAgent>) => {
    request.setSaving?.(true);
    try {
      switch (request.kind) {
        case 'create':
          if (!request.agent) {
            throw new Error(args.t(request.failureKey));
          }
          await args.executeCreate(request.instanceId, request.agent);
          break;
        case 'update':
          if (!request.agent) {
            throw new Error(args.t(request.failureKey));
          }
          await args.executeUpdate(request.instanceId, request.agent);
          break;
        case 'delete':
          if (!request.agentId) {
            throw new Error(args.t(request.failureKey));
          }
          await args.executeDelete(request.instanceId, request.agentId);
          break;
      }

      args.reportSuccess(args.t(request.successKey));
      await request.afterSuccess?.();
      await args.reloadWorkbench(request.instanceId, { withSpinner: false });
    } catch (error: any) {
      args.reportError(error?.message || args.t(request.failureKey));
    } finally {
      request.setSaving?.(false);
    }
  };
}

export function buildOpenClawAgentMutationHandlers(
  args: BuildOpenClawAgentMutationHandlersArgs,
) {
  const dismissAgentDialog = () => args.dismissAgentDialog();
  const clearAgentDeleteId = () => args.clearAgentDeleteId();

  return {
    dismissAgentDialog,
    clearAgentDeleteId,
    onSaveAgentDialog: async () => {
      const mutationRequest = buildOpenClawAgentSaveMutationRequest({
        instanceId: args.instanceId,
        editingAgentId: args.editingAgentId,
        agentDialogDraft: args.agentDialogDraft,
        setSaving: args.setSavingAgentDialog,
        afterSuccess: async (agent, kind) => {
          dismissAgentDialog();
          await args.afterSaveSuccess?.(agent, kind);
        },
        t: args.t,
      });
      if (mutationRequest.kind === 'error') {
        args.reportError(mutationRequest.errorMessage);
        return;
      }
      if (mutationRequest.kind !== 'mutation') {
        return;
      }

      await args.executeMutation(mutationRequest.request);
    },
    onDeleteAgent: async () => {
      const mutationRequest = buildOpenClawAgentDeleteMutationRequest({
        instanceId: args.instanceId,
        agentDeleteId: args.agentDeleteId,
        afterSuccess: clearAgentDeleteId,
      });
      if (mutationRequest.kind !== 'mutation') {
        return;
      }

      await args.executeMutation(mutationRequest.request);
    },
  };
}
