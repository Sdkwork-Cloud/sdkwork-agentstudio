import type { InstanceWorkbenchSnapshot } from '../types/index.ts';
import { createOpenClawDreamingFormState } from './instanceMemoryWorkbenchPresentation.ts';
import {
  createOpenClawAuthCooldownsDraft as createAuthCooldownsFormState,
  createOpenClawWebFetchDraftState,
  createOpenClawWebSearchDraftState,
  createOpenClawWebSearchNativeCodexDraft as createWebSearchNativeCodexFormState,
  createOpenClawXSearchDraft as createXSearchFormState,
} from './openClawConfigDrafts.ts';

type Setter<T> = (value: T) => void;

export interface ApplyInstanceDetailConfigWebSearchSyncStateInput {
  config: InstanceWorkbenchSnapshot['configWebSearch'] | null | undefined;
  currentProviderId: string | null;
  setSelectedWebSearchProviderId: Setter<string | null>;
  setWebSearchSharedDraft: Setter<ReturnType<typeof createOpenClawWebSearchDraftState>['sharedDraft']>;
  setWebSearchProviderDrafts: Setter<
    ReturnType<typeof createOpenClawWebSearchDraftState>['providerDrafts']
  >;
  setWebSearchError: Setter<string | null>;
}

export interface ApplyInstanceDetailConfigAuthCooldownsSyncStateInput {
  config: InstanceWorkbenchSnapshot['configAuthCooldowns'] | null | undefined;
  setAuthCooldownsDraft: Setter<ReturnType<typeof createAuthCooldownsFormState>>;
  setAuthCooldownsError: Setter<string | null>;
}

export interface ApplyInstanceDetailConfigDreamingSyncStateInput {
  config: InstanceWorkbenchSnapshot['configDreaming'] | null | undefined;
  setDreamingDraft: Setter<ReturnType<typeof createOpenClawDreamingFormState>>;
  setDreamingError: Setter<string | null>;
}

export interface ApplyInstanceDetailConfigXSearchSyncStateInput {
  config: InstanceWorkbenchSnapshot['configXSearch'] | null | undefined;
  setXSearchDraft: Setter<ReturnType<typeof createXSearchFormState>>;
  setXSearchError: Setter<string | null>;
}

export interface ApplyInstanceDetailConfigWebSearchNativeCodexSyncStateInput {
  config: InstanceWorkbenchSnapshot['configWebSearchNativeCodex'] | null | undefined;
  setWebSearchNativeCodexDraft: Setter<ReturnType<typeof createWebSearchNativeCodexFormState>>;
  setWebSearchNativeCodexError: Setter<string | null>;
}

export interface ApplyInstanceDetailConfigWebFetchSyncStateInput {
  config: InstanceWorkbenchSnapshot['configWebFetch'] | null | undefined;
  setWebFetchSharedDraft: Setter<ReturnType<typeof createOpenClawWebFetchDraftState>['sharedDraft']>;
  setWebFetchFallbackDraft: Setter<ReturnType<typeof createOpenClawWebFetchDraftState>['fallbackDraft']>;
  setWebFetchError: Setter<string | null>;
}

export function applyInstanceDetailConfigWebSearchSyncState({
  config,
  currentProviderId,
  setSelectedWebSearchProviderId,
  setWebSearchSharedDraft,
  setWebSearchProviderDrafts,
  setWebSearchError,
}: ApplyInstanceDetailConfigWebSearchSyncStateInput) {
  const webSearchDraftState = createOpenClawWebSearchDraftState({
    config,
    currentProviderId,
  });

  setSelectedWebSearchProviderId(webSearchDraftState.selectedProviderId);
  setWebSearchSharedDraft(webSearchDraftState.sharedDraft);
  setWebSearchProviderDrafts(webSearchDraftState.providerDrafts);
  setWebSearchError(null);
}

export function applyInstanceDetailConfigAuthCooldownsSyncState({
  config,
  setAuthCooldownsDraft,
  setAuthCooldownsError,
}: ApplyInstanceDetailConfigAuthCooldownsSyncStateInput) {
  setAuthCooldownsDraft(createAuthCooldownsFormState(config));
  setAuthCooldownsError(null);
}

export function applyInstanceDetailConfigDreamingSyncState({
  config,
  setDreamingDraft,
  setDreamingError,
}: ApplyInstanceDetailConfigDreamingSyncStateInput) {
  setDreamingDraft(createOpenClawDreamingFormState(config));
  setDreamingError(null);
}

export function applyInstanceDetailConfigXSearchSyncState({
  config,
  setXSearchDraft,
  setXSearchError,
}: ApplyInstanceDetailConfigXSearchSyncStateInput) {
  setXSearchDraft(createXSearchFormState(config));
  setXSearchError(null);
}

export function applyInstanceDetailConfigWebSearchNativeCodexSyncState({
  config,
  setWebSearchNativeCodexDraft,
  setWebSearchNativeCodexError,
}: ApplyInstanceDetailConfigWebSearchNativeCodexSyncStateInput) {
  setWebSearchNativeCodexDraft(createWebSearchNativeCodexFormState(config));
  setWebSearchNativeCodexError(null);
}

export function applyInstanceDetailConfigWebFetchSyncState({
  config,
  setWebFetchSharedDraft,
  setWebFetchFallbackDraft,
  setWebFetchError,
}: ApplyInstanceDetailConfigWebFetchSyncStateInput) {
  const webFetchDraftState = createOpenClawWebFetchDraftState(config);

  setWebFetchSharedDraft(webFetchDraftState.sharedDraft);
  setWebFetchFallbackDraft(webFetchDraftState.fallbackDraft);
  setWebFetchError(null);
}
