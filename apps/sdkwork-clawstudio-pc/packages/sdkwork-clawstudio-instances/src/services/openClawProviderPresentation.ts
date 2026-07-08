import type {
  OpenClawProviderDialogModelValue,
  OpenClawProviderFormState,
  OpenClawProviderModelFormState,
} from './openClawProviderDrafts.ts';
import {
  createEmptyOpenClawProviderForm,
  createEmptyOpenClawProviderModelForm,
  createOpenClawProviderModelForm,
  parseOpenClawProviderModelsText,
} from './openClawProviderDrafts.ts';
import { parseOpenClawProviderRequestOverridesDraft } from './openClawProviderRequestDraft.ts';

export interface OpenClawProviderDialogState {
  draft: OpenClawProviderFormState;
}

export interface OpenClawProviderModelDialogState {
  draft: OpenClawProviderModelFormState;
}

export interface OpenClawProviderDialogPresentation {
  models: Array<{
    id: string;
    name: string;
  }>;
  requestParseError: string | null;
}

export interface OpenClawProviderDialogResetDrafts {
  providerDialogDraft: OpenClawProviderFormState;
  providerModelDialogDraft: OpenClawProviderModelFormState;
}

export interface OpenClawProviderWorkspaceResetState {
  isProviderDialogOpen: boolean;
  providerDialogDraft: OpenClawProviderFormState;
  providerRequestDrafts: Record<string, string>;
  isProviderModelDialogOpen: boolean;
  providerModelDialogDraft: OpenClawProviderModelFormState;
  providerModelDeleteId: string | null;
  providerDeleteId: string | null;
}

type TranslateFunction = (key: string) => string;

export function createOpenClawProviderCreateDialogState(): OpenClawProviderDialogState {
  return {
    draft: createEmptyOpenClawProviderForm(),
  };
}

export function createOpenClawProviderModelCreateDialogState(): OpenClawProviderModelDialogState {
  return {
    draft: createEmptyOpenClawProviderModelForm(),
  };
}

export function createOpenClawProviderDialogResetDrafts(): OpenClawProviderDialogResetDrafts {
  const providerDialogState = createOpenClawProviderCreateDialogState();
  const providerModelDialogState = createOpenClawProviderModelCreateDialogState();

  return {
    providerDialogDraft: providerDialogState.draft,
    providerModelDialogDraft: providerModelDialogState.draft,
  };
}

export function createOpenClawProviderWorkspaceResetState(
  resetDrafts: OpenClawProviderDialogResetDrafts = createOpenClawProviderDialogResetDrafts(),
): OpenClawProviderWorkspaceResetState {
  return {
    isProviderDialogOpen: false,
    providerDialogDraft: resetDrafts.providerDialogDraft,
    providerRequestDrafts: {},
    isProviderModelDialogOpen: false,
    providerModelDialogDraft: resetDrafts.providerModelDialogDraft,
    providerModelDeleteId: null,
    providerDeleteId: null,
  };
}

export function createOpenClawProviderModelEditDialogState(
  model: OpenClawProviderDialogModelValue,
): OpenClawProviderModelDialogState {
  return {
    draft: createOpenClawProviderModelForm(model),
  };
}

export function buildOpenClawProviderDialogPresentation(args: {
  draft: Pick<OpenClawProviderFormState, 'modelsText' | 'requestOverridesText'>;
  t: TranslateFunction;
}): OpenClawProviderDialogPresentation {
  let requestParseError: string | null = null;

  try {
    parseOpenClawProviderRequestOverridesDraft(args.draft.requestOverridesText);
  } catch (error: any) {
    requestParseError =
      error?.message || args.t('instances.detail.instanceWorkbench.llmProviders.requestOverridesInvalid');
  }

  return {
    models: parseOpenClawProviderModelsText(args.draft.modelsText),
    requestParseError,
  };
}
