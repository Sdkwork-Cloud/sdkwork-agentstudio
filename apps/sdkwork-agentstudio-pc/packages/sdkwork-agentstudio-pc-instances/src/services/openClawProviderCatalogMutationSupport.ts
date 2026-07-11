import type { InstanceLLMProviderUpdate, InstanceWorkbenchLLMProvider } from '../types/index.ts';
import type {
  OpenClawProviderCatalogMutationPlan,
  OpenClawProviderFormState,
  OpenClawProviderModelFormState,
} from './openClawProviderDrafts.ts';
import {
  buildOpenClawProviderConfigMutationPlan,
  buildOpenClawProviderConfigSaveInput,
  buildOpenClawProviderDeleteMutationPlan,
  buildOpenClawProviderDialogMutationPlan,
  buildOpenClawProviderDialogSaveInput,
  buildOpenClawProviderModelDeleteMutationPlan,
  buildOpenClawProviderModelDialogSaveInput,
  buildOpenClawProviderModelMutationPlan,
} from './openClawProviderDrafts.ts';

type TranslateFunction = (key: string) => string;
type SavingSetter = (value: boolean) => void;
type AfterSuccess = () => void;
type ProviderConfigUpdateMutationPlan = Extract<
  OpenClawProviderCatalogMutationPlan,
  { kind: 'providerConfigUpdate' }
>;
type ProviderCreateMutationPlan = Extract<
  OpenClawProviderCatalogMutationPlan,
  { kind: 'providerCreate' }
>;
type ProviderModelUpdateMutationPlan = Extract<
  OpenClawProviderCatalogMutationPlan,
  { kind: 'providerModelUpdate' }
>;
type ProviderModelCreateMutationPlan = Extract<
  OpenClawProviderCatalogMutationPlan,
  { kind: 'providerModelCreate' }
>;
type ProviderModelDeleteMutationPlan = Extract<
  OpenClawProviderCatalogMutationPlan,
  { kind: 'providerModelDelete' }
>;
type ProviderDeleteMutationPlan = Extract<
  OpenClawProviderCatalogMutationPlan,
  { kind: 'providerDelete' }
>;

export interface OpenClawProviderCatalogMutationRequest {
  mutationPlan: OpenClawProviderCatalogMutationPlan;
  afterSuccess?: AfterSuccess;
  setSaving?: SavingSetter;
  withSpinner?: boolean;
}

export interface CreateOpenClawProviderCatalogMutationRunnerArgs {
  executeProviderConfigUpdate: (
    instanceId: string,
    providerId: string,
    providerUpdate: ProviderConfigUpdateMutationPlan['providerUpdate'],
  ) => Promise<void>;
  executeProviderCreate: (
    instanceId: string,
    providerInput: ProviderCreateMutationPlan['providerInput'],
    selection: ProviderCreateMutationPlan['selection'],
  ) => Promise<void>;
  executeProviderModelUpdate: (
    instanceId: string,
    providerId: string,
    originalId: ProviderModelUpdateMutationPlan['originalId'],
    model: ProviderModelUpdateMutationPlan['model'],
  ) => Promise<void>;
  executeProviderModelCreate: (
    instanceId: string,
    providerId: string,
    model: ProviderModelCreateMutationPlan['model'],
  ) => Promise<void>;
  executeProviderModelDelete: (
    instanceId: string,
    providerId: string,
    modelId: ProviderModelDeleteMutationPlan['modelId'],
  ) => Promise<void>;
  executeProviderDelete: (
    instanceId: string,
    providerId: ProviderDeleteMutationPlan['providerId'],
  ) => Promise<void>;
  reloadWorkbench: (
    instanceId: string,
    options: {
      withSpinner: boolean;
    },
  ) => Promise<void>;
  setSelectedProviderId: (providerId: string | null) => void;
  reportSuccess: (message: string) => void;
  reportError: (message: string) => void;
  t: TranslateFunction;
}

export type OpenClawProviderCatalogMutationBuildResult =
  | {
      kind: 'skip';
    }
  | {
      kind: 'error';
      errorMessage: string;
    }
  | {
      kind: 'mutation';
      request: OpenClawProviderCatalogMutationRequest;
    };

export async function runOpenClawProviderCatalogMutationBuildResult(args: {
  mutationResult: OpenClawProviderCatalogMutationBuildResult;
  executeMutation: (request: OpenClawProviderCatalogMutationRequest) => Promise<void>;
  reportError: (message: string) => void;
}) {
  if (args.mutationResult.kind === 'skip') {
    return;
  }

  if (args.mutationResult.kind === 'error') {
    args.reportError(args.mutationResult.errorMessage);
    return;
  }

  await args.executeMutation(args.mutationResult.request);
}

export interface BuildOpenClawProviderMutationHandlersArgs {
  isReadonly: boolean;
  instanceId: string | undefined;
  selectedProvider: Pick<InstanceWorkbenchLLMProvider, 'id'> | null;
  selectedProviderDraft: InstanceLLMProviderUpdate | null;
  selectedProviderRequestDraft: string;
  setSavingProviderConfig: SavingSetter;
  providerDialogDraft: OpenClawProviderFormState;
  providerDialogModels: Array<{
    id: string;
    name: string;
  }>;
  dismissProviderDialog: AfterSuccess;
  setSavingProviderDialog: SavingSetter;
  providerModelDialogDraft: OpenClawProviderModelFormState;
  dismissProviderModelDialog: AfterSuccess;
  setSavingProviderModelDialog: SavingSetter;
  providerModelDeleteId: string | null;
  clearProviderModelDeleteId: AfterSuccess;
  providerDeleteId: string | null;
  clearProviderDeleteId: AfterSuccess;
  executeMutation: (request: OpenClawProviderCatalogMutationRequest) => Promise<void>;
  reportError: (message: string) => void;
  t: TranslateFunction;
}

export function buildOpenClawProviderMutationHandlers(args: BuildOpenClawProviderMutationHandlersArgs) {
  return {
    onSaveProviderConfig: async () =>
      runOpenClawProviderCatalogMutationBuildResult({
        mutationResult: buildOpenClawProviderConfigMutationRequest({
          isReadonly: args.isReadonly,
          instanceId: args.instanceId,
          selectedProvider: args.selectedProvider,
          selectedProviderDraft: args.selectedProviderDraft,
          requestOverridesText: args.selectedProviderRequestDraft,
          setSaving: args.setSavingProviderConfig,
          t: args.t,
        }),
        executeMutation: args.executeMutation,
        reportError: args.reportError,
      }),
    onSubmitProviderDialog: async () =>
      runOpenClawProviderCatalogMutationBuildResult({
        mutationResult: buildOpenClawProviderDialogMutationRequest({
          isReadonly: args.isReadonly,
          instanceId: args.instanceId,
          providerDialogDraft: args.providerDialogDraft,
          providerDialogModels: args.providerDialogModels,
          afterSuccess: args.dismissProviderDialog,
          setSaving: args.setSavingProviderDialog,
          t: args.t,
        }),
        executeMutation: args.executeMutation,
        reportError: args.reportError,
      }),
    onSubmitProviderModelDialog: async () =>
      runOpenClawProviderCatalogMutationBuildResult({
        mutationResult: buildOpenClawProviderModelMutationRequest({
          isReadonly: args.isReadonly,
          instanceId: args.instanceId,
          selectedProvider: args.selectedProvider,
          providerModelDialogDraft: args.providerModelDialogDraft,
          afterSuccess: args.dismissProviderModelDialog,
          setSaving: args.setSavingProviderModelDialog,
          t: args.t,
        }),
        executeMutation: args.executeMutation,
        reportError: args.reportError,
      }),
    onDeleteProviderModel: async () =>
      runOpenClawProviderCatalogMutationBuildResult({
        mutationResult: buildOpenClawProviderModelDeleteMutationRequest({
          isReadonly: args.isReadonly,
          instanceId: args.instanceId,
          selectedProvider: args.selectedProvider,
          providerModelDeleteId: args.providerModelDeleteId,
          afterSuccess: args.clearProviderModelDeleteId,
        }),
        executeMutation: args.executeMutation,
        reportError: args.reportError,
      }),
    onDeleteProvider: async () =>
      runOpenClawProviderCatalogMutationBuildResult({
        mutationResult: buildOpenClawProviderDeleteMutationRequest({
          isReadonly: args.isReadonly,
          instanceId: args.instanceId,
          providerDeleteId: args.providerDeleteId,
          afterSuccess: args.clearProviderDeleteId,
        }),
        executeMutation: args.executeMutation,
        reportError: args.reportError,
      }),
  };
}

function buildTranslatedProviderErrorMessage(args: {
  errorMessage?: string;
  errorKey?: string;
  fallbackKey: string;
  t: TranslateFunction;
}) {
  return args.errorMessage || args.t(args.errorKey || args.fallbackKey);
}

export function buildOpenClawProviderConfigMutationRequest(args: {
  isReadonly: boolean;
  instanceId: string | undefined;
  selectedProvider: Pick<InstanceWorkbenchLLMProvider, 'id'> | null;
  selectedProviderDraft: InstanceLLMProviderUpdate | null;
  requestOverridesText: string;
  setSaving: SavingSetter;
  t: TranslateFunction;
}): OpenClawProviderCatalogMutationBuildResult {
  if (
    args.isReadonly ||
    !args.instanceId ||
    !args.selectedProvider ||
    !args.selectedProviderDraft
  ) {
    return {
      kind: 'skip',
    };
  }

  const saveInput = buildOpenClawProviderConfigSaveInput({
    providerId: args.selectedProvider.id,
    draft: args.selectedProviderDraft,
    requestOverridesText: args.requestOverridesText,
  });
  if (!saveInput.ok) {
    return {
      kind: 'error',
      errorMessage: buildTranslatedProviderErrorMessage({
        errorMessage: saveInput.errorMessage,
        fallbackKey: 'instances.detail.instanceWorkbench.llmProviders.requestOverridesInvalid',
        t: args.t,
      }),
    };
  }

  return {
    kind: 'mutation',
    request: {
      mutationPlan: buildOpenClawProviderConfigMutationPlan({
        instanceId: args.instanceId,
        saveInput: saveInput.value,
      }),
      setSaving: args.setSaving,
      withSpinner: true,
    },
  };
}

export function buildOpenClawProviderDialogMutationRequest(args: {
  isReadonly: boolean;
  instanceId: string | undefined;
  providerDialogDraft: OpenClawProviderFormState;
  providerDialogModels: Array<{
    id: string;
    name: string;
  }>;
  afterSuccess: AfterSuccess;
  setSaving: SavingSetter;
  t: TranslateFunction;
}): OpenClawProviderCatalogMutationBuildResult {
  if (args.isReadonly || !args.instanceId) {
    return {
      kind: 'skip',
    };
  }

  const saveInput = buildOpenClawProviderDialogSaveInput({
    draft: args.providerDialogDraft,
    models: args.providerDialogModels,
  });
  if (!saveInput.ok) {
    return {
      kind: 'error',
      errorMessage: buildTranslatedProviderErrorMessage({
        errorMessage: saveInput.errorMessage,
        errorKey: saveInput.errorKey,
        fallbackKey: 'instances.detail.instanceWorkbench.llmProviders.requestOverridesInvalid',
        t: args.t,
      }),
    };
  }

  return {
    kind: 'mutation',
    request: {
      mutationPlan: buildOpenClawProviderDialogMutationPlan({
        instanceId: args.instanceId,
        saveInput: saveInput.value,
      }),
      afterSuccess: args.afterSuccess,
      setSaving: args.setSaving,
    },
  };
}

export function buildOpenClawProviderModelMutationRequest(args: {
  isReadonly: boolean;
  instanceId: string | undefined;
  selectedProvider: Pick<InstanceWorkbenchLLMProvider, 'id'> | null;
  providerModelDialogDraft: OpenClawProviderModelFormState;
  afterSuccess: AfterSuccess;
  setSaving: SavingSetter;
  t: TranslateFunction;
}): OpenClawProviderCatalogMutationBuildResult {
  if (args.isReadonly || !args.instanceId || !args.selectedProvider) {
    return {
      kind: 'skip',
    };
  }

  const saveInput = buildOpenClawProviderModelDialogSaveInput(args.providerModelDialogDraft);
  if (!saveInput.ok) {
    return {
      kind: 'error',
      errorMessage: buildTranslatedProviderErrorMessage({
        errorKey: saveInput.errorKey,
        fallbackKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.modelSaveFailed',
        t: args.t,
      }),
    };
  }

  return {
    kind: 'mutation',
    request: {
      mutationPlan: buildOpenClawProviderModelMutationPlan({
        instanceId: args.instanceId,
        providerId: args.selectedProvider.id,
        saveInput: saveInput.value,
      }),
      afterSuccess: args.afterSuccess,
      setSaving: args.setSaving,
    },
  };
}

export function buildOpenClawProviderModelDeleteMutationRequest(args: {
  isReadonly: boolean;
  instanceId: string | undefined;
  selectedProvider: Pick<InstanceWorkbenchLLMProvider, 'id'> | null;
  providerModelDeleteId: string | null;
  afterSuccess: AfterSuccess;
}): OpenClawProviderCatalogMutationBuildResult {
  if (
    args.isReadonly ||
    !args.instanceId ||
    !args.selectedProvider ||
    !args.providerModelDeleteId
  ) {
    return {
      kind: 'skip',
    };
  }

  return {
    kind: 'mutation',
    request: {
      mutationPlan: buildOpenClawProviderModelDeleteMutationPlan({
        instanceId: args.instanceId,
        providerId: args.selectedProvider.id,
        modelId: args.providerModelDeleteId,
      }),
      afterSuccess: args.afterSuccess,
    },
  };
}

export function buildOpenClawProviderDeleteMutationRequest(args: {
  isReadonly: boolean;
  instanceId: string | undefined;
  providerDeleteId: string | null;
  afterSuccess: AfterSuccess;
}): OpenClawProviderCatalogMutationBuildResult {
  if (args.isReadonly || !args.instanceId || !args.providerDeleteId) {
    return {
      kind: 'skip',
    };
  }

  return {
    kind: 'mutation',
    request: {
      mutationPlan: buildOpenClawProviderDeleteMutationPlan({
        instanceId: args.instanceId,
        providerId: args.providerDeleteId,
      }),
      afterSuccess: args.afterSuccess,
    },
  };
}

export function createOpenClawProviderCatalogMutationRunner(
  args: CreateOpenClawProviderCatalogMutationRunnerArgs,
) {
  return async (request: OpenClawProviderCatalogMutationRequest) => {
    request.setSaving?.(true);
    try {
      switch (request.mutationPlan.kind) {
        case 'providerConfigUpdate':
          await args.executeProviderConfigUpdate(
            request.mutationPlan.instanceId,
            request.mutationPlan.providerId,
            request.mutationPlan.providerUpdate,
          );
          break;
        case 'providerCreate':
          await args.executeProviderCreate(
            request.mutationPlan.instanceId,
            request.mutationPlan.providerInput,
            request.mutationPlan.selection,
          );
          break;
        case 'providerModelUpdate':
          await args.executeProviderModelUpdate(
            request.mutationPlan.instanceId,
            request.mutationPlan.providerId,
            request.mutationPlan.originalId,
            request.mutationPlan.model,
          );
          break;
        case 'providerModelCreate':
          await args.executeProviderModelCreate(
            request.mutationPlan.instanceId,
            request.mutationPlan.providerId,
            request.mutationPlan.model,
          );
          break;
        case 'providerModelDelete':
          await args.executeProviderModelDelete(
            request.mutationPlan.instanceId,
            request.mutationPlan.providerId,
            request.mutationPlan.modelId,
          );
          break;
        case 'providerDelete':
          await args.executeProviderDelete(
            request.mutationPlan.instanceId,
            request.mutationPlan.providerId,
          );
          break;
      }

      args.reportSuccess(args.t(request.mutationPlan.successKey));
      request.afterSuccess?.();
      await args.reloadWorkbench(request.mutationPlan.instanceId, {
        withSpinner: request.withSpinner ?? false,
      });
      args.setSelectedProviderId(request.mutationPlan.selectedProviderId);
    } catch (error: any) {
      args.reportError(error?.message || args.t(request.mutationPlan.failureKey));
    } finally {
      request.setSaving?.(false);
    }
  };
}
