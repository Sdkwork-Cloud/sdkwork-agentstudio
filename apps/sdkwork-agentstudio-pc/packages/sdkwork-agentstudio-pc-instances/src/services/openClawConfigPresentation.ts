import type {
  OpenClawAuthCooldownsDraftValue,
  OpenClawWebFetchFallbackDraftValue,
  OpenClawWebFetchSharedDraftValue,
  OpenClawWebSearchNativeCodexDraftValue,
  OpenClawWebSearchProviderDraftValue,
  OpenClawWebSearchSharedDraftValue,
  OpenClawXSearchDraftValue,
} from './openClawConfigDrafts.ts';
import {
  applyOpenClawDraftFieldChange,
  applyOpenClawNullableDraftFieldChange,
  applyOpenClawWebSearchProviderDraftChange,
} from './openClawConfigDrafts.ts';
import type { OpenClawDreamingFormState } from './instanceMemoryWorkbenchPresentation.ts';
import type { InstanceWorkbenchSnapshot } from '../types/index.ts';

type NullableDraftSetter<T> = (updater: (current: T | null) => T | null) => void;
type DraftSetter<T> = (updater: (current: T) => T) => void;
type ErrorSetter = (value: string | null) => void;
type ConfigWebSearchProvider =
  NonNullable<InstanceWorkbenchSnapshot['configWebSearch']>['providers'][number];

export interface BuildOpenClawConfigDraftChangeHandlersArgs {
  selectedWebSearchProvider: ConfigWebSearchProvider | null;
  setWebSearchError: ErrorSetter;
  setWebSearchSharedDraft: NullableDraftSetter<OpenClawWebSearchSharedDraftValue>;
  setWebSearchProviderDrafts: (
    updater: (
      current: Record<string, OpenClawWebSearchProviderDraftValue>,
    ) => Record<string, OpenClawWebSearchProviderDraftValue>,
  ) => void;
  setXSearchError: ErrorSetter;
  setXSearchDraft: NullableDraftSetter<OpenClawXSearchDraftValue>;
  setWebSearchNativeCodexError: ErrorSetter;
  setWebSearchNativeCodexDraft: NullableDraftSetter<OpenClawWebSearchNativeCodexDraftValue>;
  setWebFetchError: ErrorSetter;
  setWebFetchSharedDraft: NullableDraftSetter<OpenClawWebFetchSharedDraftValue>;
  setWebFetchFallbackDraft: DraftSetter<OpenClawWebFetchFallbackDraftValue>;
  setAuthCooldownsError: ErrorSetter;
  setAuthCooldownsDraft: NullableDraftSetter<OpenClawAuthCooldownsDraftValue>;
  setDreamingError: ErrorSetter;
  setDreamingDraft: NullableDraftSetter<OpenClawDreamingFormState>;
}

export function buildOpenClawConfigDraftChangeHandlers(
  args: BuildOpenClawConfigDraftChangeHandlersArgs,
) {
  return {
    onWebSearchSharedDraftChange: (
      key: keyof OpenClawWebSearchSharedDraftValue,
      value: string | boolean,
    ) => {
      args.setWebSearchError(null);
      args.setWebSearchSharedDraft((current) =>
        applyOpenClawNullableDraftFieldChange(current, key, value),
      );
    },
    onWebSearchProviderDraftChange: (
      key: keyof OpenClawWebSearchProviderDraftValue,
      value: string,
    ) => {
      if (!args.selectedWebSearchProvider) {
        return;
      }

      args.setWebSearchError(null);
      args.setWebSearchProviderDrafts((current) =>
        applyOpenClawWebSearchProviderDraftChange({
          currentDrafts: current,
          selectedProvider: args.selectedWebSearchProvider,
          key,
          value,
        }),
      );
    },
    onXSearchDraftChange: (key: keyof OpenClawXSearchDraftValue, value: string | boolean) => {
      args.setXSearchError(null);
      args.setXSearchDraft((current) => applyOpenClawNullableDraftFieldChange(current, key, value));
    },
    onWebSearchNativeCodexDraftChange: (
      key: keyof OpenClawWebSearchNativeCodexDraftValue,
      value: string | boolean,
    ) => {
      args.setWebSearchNativeCodexError(null);
      args.setWebSearchNativeCodexDraft((current) =>
        applyOpenClawNullableDraftFieldChange(current, key, value),
      );
    },
    onWebFetchSharedDraftChange: (
      key: keyof OpenClawWebFetchSharedDraftValue,
      value: string | boolean,
    ) => {
      args.setWebFetchError(null);
      args.setWebFetchSharedDraft((current) =>
        applyOpenClawNullableDraftFieldChange(current, key, value),
      );
    },
    onWebFetchFallbackDraftChange: (
      key: keyof OpenClawWebFetchFallbackDraftValue,
      value: string,
    ) => {
      args.setWebFetchError(null);
      args.setWebFetchFallbackDraft((current) => applyOpenClawDraftFieldChange(current, key, value));
    },
    onAuthCooldownsDraftChange: (
      key: keyof OpenClawAuthCooldownsDraftValue,
      value: string,
    ) => {
      args.setAuthCooldownsError(null);
      args.setAuthCooldownsDraft((current) =>
        applyOpenClawNullableDraftFieldChange(current, key, value),
      );
    },
    onDreamingDraftChange: (
      key: keyof OpenClawDreamingFormState,
      value: string | boolean,
    ) => {
      args.setDreamingError(null);
      args.setDreamingDraft((current) => applyOpenClawNullableDraftFieldChange(current, key, value));
    },
  };
}
