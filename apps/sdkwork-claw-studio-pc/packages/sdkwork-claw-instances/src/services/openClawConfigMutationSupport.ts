import type {
  SaveOpenClawAuthCooldownsConfigurationInput,
  SaveOpenClawDreamingConfigurationInput,
  SaveOpenClawWebFetchConfigurationInput,
  SaveOpenClawWebSearchConfigurationInput,
  SaveOpenClawWebSearchNativeCodexConfigurationInput,
  SaveOpenClawXSearchConfigurationInput,
} from '@sdkwork/claw-core';
import {
  buildOpenClawAuthCooldownsSaveInput,
  buildOpenClawWebFetchSaveInput,
  buildOpenClawWebSearchNativeCodexSaveInput,
  buildOpenClawWebSearchSaveInput,
  buildOpenClawXSearchSaveInput,
  type OpenClawAuthCooldownsDraftValue,
  type OpenClawWebFetchFallbackDraftValue,
  type OpenClawWebFetchSharedDraftValue,
  type OpenClawWebSearchNativeCodexDraftValue,
  type OpenClawWebSearchProviderDraftValue,
  type OpenClawWebSearchSharedDraftValue,
  type OpenClawXSearchDraftValue,
} from './openClawConfigDrafts.ts';
import {
  buildOpenClawDreamingSaveInput,
  type OpenClawDreamingFormState,
} from './instanceMemoryWorkbenchPresentation.ts';

type TranslateFunction = (key: string) => string;
type ErrorSetter = (value: string | null) => void;
type SavingSetter = (value: boolean) => void;

type DraftBuildResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      errorKey: string;
    };

export interface OpenClawConfigSaveRequest {
  instanceId: string;
  setSaving: (value: boolean) => void;
  setError: (value: string | null) => void;
  save: () => Promise<void>;
  successKey: string;
  failureKey: string;
}

export interface CreateOpenClawConfigSaveRunnerArgs {
  reloadWorkbench: (
    instanceId: string,
    options: {
      withSpinner: boolean;
    },
  ) => Promise<void>;
  reportSuccess: (message: string) => void;
  t: TranslateFunction;
}

export interface BuildOpenClawConfigMutationHandlersArgs {
  instanceId: string | undefined;
  executeSaveRequest: (request: OpenClawConfigSaveRequest) => Promise<void>;
  t: TranslateFunction;
  webSearch: {
    sharedDraft: OpenClawWebSearchSharedDraftValue | null;
    selectedProvider: {
      id: string;
    } | null;
    selectedProviderDraft: OpenClawWebSearchProviderDraftValue | null;
    setSaving: SavingSetter;
    setError: ErrorSetter;
    executeSave: (
      instanceId: string,
      input: Omit<SaveOpenClawWebSearchConfigurationInput, 'configFile'>,
    ) => Promise<void>;
  };
  xSearch: {
    draft: OpenClawXSearchDraftValue | null;
    setSaving: SavingSetter;
    setError: ErrorSetter;
    executeSave: (
      instanceId: string,
      input: Omit<SaveOpenClawXSearchConfigurationInput, 'configFile'>,
    ) => Promise<void>;
  };
  webSearchNativeCodex: {
    draft: OpenClawWebSearchNativeCodexDraftValue | null;
    setSaving: SavingSetter;
    setError: ErrorSetter;
    executeSave: (
      instanceId: string,
      input: Omit<SaveOpenClawWebSearchNativeCodexConfigurationInput, 'configFile'>,
    ) => Promise<void>;
  };
  webFetch: {
    sharedDraft: OpenClawWebFetchSharedDraftValue | null;
    fallbackDraft: OpenClawWebFetchFallbackDraftValue;
    setSaving: SavingSetter;
    setError: ErrorSetter;
    executeSave: (
      instanceId: string,
      input: Omit<SaveOpenClawWebFetchConfigurationInput, 'configFile'>,
    ) => Promise<void>;
  };
  authCooldowns: {
    draft: OpenClawAuthCooldownsDraftValue | null;
    setSaving: SavingSetter;
    setError: ErrorSetter;
    executeSave: (
      instanceId: string,
      input: Omit<SaveOpenClawAuthCooldownsConfigurationInput, 'configFile'>,
    ) => Promise<void>;
  };
  dreaming: {
    draft: OpenClawDreamingFormState | null;
    setSaving: SavingSetter;
    setError: ErrorSetter;
    executeSave: (
      instanceId: string,
      input: Omit<SaveOpenClawDreamingConfigurationInput, 'configFile'>,
    ) => Promise<void>;
  };
}

function createConfigSaveRequest(args: {
  instanceId: string;
  setSaving: SavingSetter;
  setError: ErrorSetter;
  save: () => Promise<void>;
  successKey: string;
  failureKey: string;
}): OpenClawConfigSaveRequest {
  return {
    instanceId: args.instanceId,
    setSaving: args.setSaving,
    setError: args.setError,
    save: args.save,
    successKey: args.successKey,
    failureKey: args.failureKey,
  };
}

function resolveConfigDraftBuildResult<T>(args: {
  result: DraftBuildResult<T>;
  setError: ErrorSetter;
  t: TranslateFunction;
}): T | null {
  if (!args.result.ok) {
    args.setError(args.t(args.result.errorKey));
    return null;
  }

  return args.result.value;
}

export function createOpenClawConfigSaveRunner(
  args: CreateOpenClawConfigSaveRunnerArgs,
) {
  return async (request: OpenClawConfigSaveRequest) => {
    request.setSaving(true);
    request.setError(null);
    try {
      await request.save();
      args.reportSuccess(args.t(request.successKey));
      await args.reloadWorkbench(request.instanceId, { withSpinner: false });
    } catch (error: any) {
      request.setError(error?.message || args.t(request.failureKey));
    } finally {
      request.setSaving(false);
    }
  };
}

export function buildOpenClawConfigMutationHandlers(
  args: BuildOpenClawConfigMutationHandlersArgs,
) {
  return {
    onSaveWebSearchConfig: async () => {
      const instanceId = args.instanceId;
      const sharedDraft = args.webSearch.sharedDraft;
      const selectedProvider = args.webSearch.selectedProvider;
      const selectedProviderDraft = args.webSearch.selectedProviderDraft;
      if (!instanceId || !sharedDraft || !selectedProvider || !selectedProviderDraft) {
        return;
      }

      const saveInput = resolveConfigDraftBuildResult({
        result: buildOpenClawWebSearchSaveInput({
          sharedDraft,
          providerId: selectedProvider.id,
          providerDraft: selectedProviderDraft,
        }),
        setError: args.webSearch.setError,
        t: args.t,
      });
      if (!saveInput) {
        return;
      }

      await args.executeSaveRequest(
        createConfigSaveRequest({
          instanceId,
          setSaving: args.webSearch.setSaving,
          setError: args.webSearch.setError,
          save: () => args.webSearch.executeSave(instanceId, saveInput),
          successKey: 'instances.detail.instanceWorkbench.webSearch.toasts.saved',
          failureKey: 'instances.detail.instanceWorkbench.webSearch.toasts.saveFailed',
        }),
      );
    },
    onSaveXSearchConfig: async () => {
      const instanceId = args.instanceId;
      const draft = args.xSearch.draft;
      if (!instanceId || !draft) {
        return;
      }

      const saveInput = resolveConfigDraftBuildResult({
        result: buildOpenClawXSearchSaveInput(draft),
        setError: args.xSearch.setError,
        t: args.t,
      });
      if (!saveInput) {
        return;
      }

      await args.executeSaveRequest(
        createConfigSaveRequest({
          instanceId,
          setSaving: args.xSearch.setSaving,
          setError: args.xSearch.setError,
          save: () => args.xSearch.executeSave(instanceId, saveInput),
          successKey: 'instances.detail.instanceWorkbench.xSearch.toasts.saved',
          failureKey: 'instances.detail.instanceWorkbench.xSearch.toasts.saveFailed',
        }),
      );
    },
    onSaveWebSearchNativeCodexConfig: async () => {
      const instanceId = args.instanceId;
      const draft = args.webSearchNativeCodex.draft;
      if (!instanceId || !draft) {
        return;
      }

      await args.executeSaveRequest(
        createConfigSaveRequest({
          instanceId,
          setSaving: args.webSearchNativeCodex.setSaving,
          setError: args.webSearchNativeCodex.setError,
          save: () =>
            args.webSearchNativeCodex.executeSave(
              instanceId,
              buildOpenClawWebSearchNativeCodexSaveInput(draft),
            ),
          successKey: 'instances.detail.instanceWorkbench.webSearchNativeCodex.toasts.saved',
          failureKey: 'instances.detail.instanceWorkbench.webSearchNativeCodex.toasts.saveFailed',
        }),
      );
    },
    onSaveWebFetchConfig: async () => {
      const instanceId = args.instanceId;
      const sharedDraft = args.webFetch.sharedDraft;
      if (!instanceId || !sharedDraft) {
        return;
      }

      const saveInput = resolveConfigDraftBuildResult({
        result: buildOpenClawWebFetchSaveInput({
          sharedDraft,
          fallbackDraft: args.webFetch.fallbackDraft,
        }),
        setError: args.webFetch.setError,
        t: args.t,
      });
      if (!saveInput) {
        return;
      }

      await args.executeSaveRequest(
        createConfigSaveRequest({
          instanceId,
          setSaving: args.webFetch.setSaving,
          setError: args.webFetch.setError,
          save: () => args.webFetch.executeSave(instanceId, saveInput),
          successKey: 'instances.detail.instanceWorkbench.webFetch.toasts.saved',
          failureKey: 'instances.detail.instanceWorkbench.webFetch.toasts.saveFailed',
        }),
      );
    },
    onSaveAuthCooldownsConfig: async () => {
      const instanceId = args.instanceId;
      const draft = args.authCooldowns.draft;
      if (!instanceId || !draft) {
        return;
      }

      const saveInput = resolveConfigDraftBuildResult({
        result: buildOpenClawAuthCooldownsSaveInput(draft),
        setError: args.authCooldowns.setError,
        t: args.t,
      });
      if (!saveInput) {
        return;
      }

      await args.executeSaveRequest(
        createConfigSaveRequest({
          instanceId,
          setSaving: args.authCooldowns.setSaving,
          setError: args.authCooldowns.setError,
          save: () => args.authCooldowns.executeSave(instanceId, saveInput),
          successKey: 'instances.detail.instanceWorkbench.authCooldowns.toasts.saved',
          failureKey: 'instances.detail.instanceWorkbench.authCooldowns.toasts.saveFailed',
        }),
      );
    },
    onSaveDreamingConfig: async () => {
      const instanceId = args.instanceId;
      const draft = args.dreaming.draft;
      if (!instanceId || !draft) {
        return;
      }

      await args.executeSaveRequest(
        createConfigSaveRequest({
          instanceId,
          setSaving: args.dreaming.setSaving,
          setError: args.dreaming.setError,
          save: () => args.dreaming.executeSave(instanceId, buildOpenClawDreamingSaveInput(draft)),
          successKey: 'instances.detail.instanceWorkbench.dreaming.toasts.saved',
          failureKey: 'instances.detail.instanceWorkbench.dreaming.toasts.saveFailed',
        }),
      );
    },
  };
}
