import type { StudioInstanceDetailRecord } from '@sdkwork/claw-types';
import type { InstanceLLMProviderUpdate, InstanceWorkbenchSnapshot } from '../types/index.ts';
import {
  createOpenClawProviderConfigDraft,
  createOpenClawProviderRequestDraft,
  hasPendingOpenClawProviderConfigChanges,
} from './openClawProviderDrafts.ts';
import { buildKernelAuthorityProjection } from './kernelAuthorityProjection.ts';
import { hasWritableOpenClawConfigRoute } from './openClawManagementCapabilities.ts';
import { parseOpenClawProviderRequestOverridesDraft } from './openClawProviderRequestDraft.ts';

export interface OpenClawProviderWorkspaceState {
  providerCenterControlled: boolean;
  isProviderConfigReadonly: boolean;
  canManageProviderCatalog: boolean;
}

export interface BuildOpenClawProviderWorkspaceStateInput {
  detail: StudioInstanceDetailRecord | null | undefined;
  kernelConfig?: InstanceWorkbenchSnapshot['kernelConfig'];
  kernelAuthority?: InstanceWorkbenchSnapshot['kernelAuthority'];
}

type InstanceWorkbenchLlmProvider = InstanceWorkbenchSnapshot['llmProviders'][number];
type InstanceWorkbenchLlmProviderModel = InstanceWorkbenchLlmProvider['models'][number];

export interface BuildOpenClawProviderSelectionStateInput {
  workbench: Pick<InstanceWorkbenchSnapshot, 'llmProviders'> | null;
  selectedProviderId: string | null;
  providerDeleteId: string | null;
  providerModelDeleteId: string | null;
  providerDrafts: Record<string, InstanceLLMProviderUpdate>;
  providerRequestDrafts: Record<string, string>;
  t: (key: string) => string;
}

export interface OpenClawProviderSelectionState {
  selectedProvider: InstanceWorkbenchLlmProvider | null;
  deletingProvider: InstanceWorkbenchLlmProvider | null;
  deletingProviderModel: InstanceWorkbenchLlmProviderModel | null;
  selectedProviderDraft: InstanceLLMProviderUpdate | null;
  selectedProviderRequestDraft: string;
  selectedProviderRequestParseError: string | null;
  hasPendingProviderChanges: boolean;
}

export interface BuildOpenClawProviderWorkspaceSyncStateInput {
  providers: InstanceWorkbenchSnapshot['llmProviders'] | null | undefined;
}

export interface OpenClawProviderWorkspaceSyncState {
  resolveSelectedProviderId: (currentSelectedProviderId: string | null) => string | null;
  providerDrafts: Record<string, InstanceLLMProviderUpdate>;
  providerRequestDrafts: Record<string, string>;
}

function isProviderWorkspaceStateInput(
  input: BuildOpenClawProviderWorkspaceStateInput | StudioInstanceDetailRecord | null | undefined,
): input is BuildOpenClawProviderWorkspaceStateInput {
  return Boolean(input && typeof input === 'object' && 'detail' in input);
}

function resolveProviderWorkspaceInput(
  input:
    | BuildOpenClawProviderWorkspaceStateInput
    | StudioInstanceDetailRecord
    | null
    | undefined,
): BuildOpenClawProviderWorkspaceStateInput {
  if (isProviderWorkspaceStateInput(input)) {
    return {
      detail: input.detail || null,
      kernelConfig: input.kernelConfig,
      kernelAuthority: input.kernelAuthority,
    };
  }

  return {
    detail: (input as StudioInstanceDetailRecord | null | undefined) || null,
    kernelConfig: undefined,
    kernelAuthority: undefined,
  };
}

export function buildOpenClawProviderWorkspaceState(
  input:
    | BuildOpenClawProviderWorkspaceStateInput
    | StudioInstanceDetailRecord
    | null
    | undefined,
): OpenClawProviderWorkspaceState {
  const { detail, kernelConfig, kernelAuthority } = resolveProviderWorkspaceInput(input);

  if (detail?.instance.runtimeKind !== 'openclaw') {
    return {
      providerCenterControlled: false,
      isProviderConfigReadonly: false,
      canManageProviderCatalog: true,
    };
  }

  const authority = kernelAuthority || buildKernelAuthorityProjection(detail);
  const providerCenterControlled = Boolean(
    authority?.configControl &&
      (authority.controlPlane === 'desktopHost' ||
        kernelConfig?.resolved ||
        hasWritableOpenClawConfigRoute(detail)),
  );

  return {
    providerCenterControlled,
    isProviderConfigReadonly: providerCenterControlled,
    canManageProviderCatalog: false,
  };
}

export function buildOpenClawProviderWorkspaceSyncState({
  providers,
}: BuildOpenClawProviderWorkspaceSyncStateInput): OpenClawProviderWorkspaceSyncState {
  const availableProviders = providers || [];

  return {
    resolveSelectedProviderId: (currentSelectedProviderId) => {
      if (availableProviders.length === 0) {
        return null;
      }

      return currentSelectedProviderId &&
        availableProviders.some((provider) => provider.id === currentSelectedProviderId)
        ? currentSelectedProviderId
        : availableProviders[0].id;
    },
    providerDrafts: {},
    providerRequestDrafts: {},
  };
}

export function buildOpenClawProviderSelectionState({
  workbench,
  selectedProviderId,
  providerDeleteId,
  providerModelDeleteId,
  providerDrafts,
  providerRequestDrafts,
  t,
}: BuildOpenClawProviderSelectionStateInput): OpenClawProviderSelectionState {
  const selectedProvider =
    workbench?.llmProviders.find((provider) => provider.id === selectedProviderId) || null;
  const deletingProvider =
    workbench?.llmProviders.find((provider) => provider.id === providerDeleteId) || null;
  const deletingProviderModel =
    selectedProvider?.models.find((model) => model.id === providerModelDeleteId) || null;
  const selectedProviderDraft = selectedProvider
    ? providerDrafts[selectedProvider.id] || createOpenClawProviderConfigDraft(selectedProvider)
    : null;
  const selectedProviderRequestDraft = selectedProvider
    ? Object.prototype.hasOwnProperty.call(providerRequestDrafts, selectedProvider.id)
      ? providerRequestDrafts[selectedProvider.id] || ''
      : createOpenClawProviderRequestDraft(selectedProvider)
    : '';

  let selectedProviderRequestParseError: string | null = null;
  if (selectedProvider) {
    try {
      parseOpenClawProviderRequestOverridesDraft(selectedProviderRequestDraft);
    } catch (error: any) {
      selectedProviderRequestParseError =
        error?.message || t('instances.detail.instanceWorkbench.llmProviders.requestOverridesInvalid');
    }
  }

  return {
    selectedProvider,
    deletingProvider,
    deletingProviderModel,
    selectedProviderDraft,
    selectedProviderRequestDraft,
    selectedProviderRequestParseError,
    hasPendingProviderChanges: Boolean(
      selectedProvider &&
        selectedProviderDraft &&
        hasPendingOpenClawProviderConfigChanges({
          provider: selectedProvider,
          draft: selectedProviderDraft,
          requestDraft: selectedProviderRequestDraft,
        }),
    ),
  };
}
