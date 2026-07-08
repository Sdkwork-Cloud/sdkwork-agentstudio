import type { ChannelWorkspaceItem } from '@sdkwork/clawstudio-ui';
import type {
  InstanceLLMProviderUpdate,
  InstanceWorkbenchSnapshot,
} from '../types/index.ts';
import { buildInstanceActionCapabilities } from './instanceActionCapabilities.ts';
import {
  buildInstanceManagementSummary,
  type InstanceManagementSummary,
} from './instanceManagementPresentation.ts';
import {
  buildInstanceMemoryWorkbenchState,
  type InstanceMemoryWorkbenchState,
} from './instanceMemoryWorkbenchPresentation.ts';
import { buildOpenClawAgentModelOptions } from './openClawAgentPresentation.ts';
import { buildReadonlyChannelWorkspaceItems } from './openClawChannelPresentation.ts';
import {
  buildOpenClawConfigChannelSelectionState,
  buildOpenClawConfigChannelWorkspaceItems,
  type OpenClawConfigChannelSelectionState,
} from './openClawConfigChannelPresentation.ts';
import {
  buildOpenClawWebSearchProviderSelectionState,
  type OpenClawWebSearchProviderDraftValue,
  type OpenClawWebSearchProviderSelectionState,
} from './openClawConfigDrafts.ts';
import type { OpenClawProviderFormState } from './openClawProviderDrafts.ts';
import {
  buildOpenClawProviderDialogPresentation,
  type OpenClawProviderDialogPresentation,
} from './openClawProviderPresentation.ts';
import {
  buildOpenClawProviderSelectionState,
  buildOpenClawProviderWorkspaceState,
  type OpenClawProviderSelectionState,
} from './openClawProviderWorkspacePresentation.ts';
import { buildKernelAuthorityProjection } from './kernelAuthorityProjection.ts';
import { normalizeInstanceWorkbenchSnapshot } from './instanceWorkbenchNormalization.ts';

interface TranslateFunction {
  (key: string): string;
}

export interface BuildInstanceDetailDerivedStateInput {
  id: string | null | undefined;
  workbench: InstanceWorkbenchSnapshot | null;
  selectedProviderId: string | null;
  providerDeleteId: string | null;
  providerModelDeleteId: string | null;
  providerDrafts: Record<string, InstanceLLMProviderUpdate>;
  providerRequestDrafts: Record<string, string>;
  selectedConfigChannelId: string | null;
  configChannelDrafts: Record<string, Record<string, string>>;
  selectedWebSearchProviderId: string | null;
  webSearchProviderDrafts: Record<string, OpenClawWebSearchProviderDraftValue>;
  providerDialogDraft: OpenClawProviderFormState;
  t: TranslateFunction;
}

export interface InstanceDetailDerivedState {
  workbench: InstanceWorkbenchSnapshot | null;
  instance: InstanceWorkbenchSnapshot['instance'] | null;
  detail: InstanceWorkbenchSnapshot['detail'] | null;
  configFilePath: string | null;
  configChannels: InstanceWorkbenchSnapshot['configChannels'];
  configWebSearch: InstanceWorkbenchSnapshot['configWebSearch'] | null;
  configXSearch: InstanceWorkbenchSnapshot['configXSearch'] | null;
  configWebSearchNativeCodex:
    InstanceWorkbenchSnapshot['configWebSearchNativeCodex'] | null;
  configWebFetch: InstanceWorkbenchSnapshot['configWebFetch'] | null;
  configAuthCooldowns: InstanceWorkbenchSnapshot['configAuthCooldowns'] | null;
  configDreaming: InstanceWorkbenchSnapshot['configDreaming'] | null;
  isOpenClawConfigWritable: boolean;
  canControlLifecycle: boolean;
  canRestartLifecycle: boolean;
  canStopLifecycle: boolean;
  canStartLifecycle: boolean;
  canDelete: boolean;
  canSetActive: boolean;
  canEditConfigChannels: boolean;
  canEditConfigWebSearch: boolean;
  canEditConfigXSearch: boolean;
  canEditConfigWebSearchNativeCodex: boolean;
  canEditConfigWebFetch: boolean;
  canEditConfigAuthCooldowns: boolean;
  canEditDreamingConfig: boolean;
  isProviderConfigReadonly: boolean;
  canManageOpenClawProviders: boolean;
  canOpenControlPage: boolean;
  memoryWorkbenchState: InstanceMemoryWorkbenchState;
  managementSummary: InstanceManagementSummary | null;
  providerSelectionState: OpenClawProviderSelectionState;
  configChannelSelectionState: OpenClawConfigChannelSelectionState;
  webSearchProviderSelectionState: OpenClawWebSearchProviderSelectionState;
  providerDialogPresentation: OpenClawProviderDialogPresentation;
  availableAgentModelOptions: ReturnType<typeof buildOpenClawAgentModelOptions>;
  readonlyChannelWorkspaceItems: ChannelWorkspaceItem[];
  configChannelWorkspaceItems: ChannelWorkspaceItem[];
}

export function buildInstanceDetailDerivedState({
  id,
  workbench,
  selectedProviderId,
  providerDeleteId,
  providerModelDeleteId,
  providerDrafts,
  providerRequestDrafts,
  selectedConfigChannelId,
  configChannelDrafts,
  selectedWebSearchProviderId,
  webSearchProviderDrafts,
  providerDialogDraft,
  t,
}: BuildInstanceDetailDerivedStateInput): InstanceDetailDerivedState {
  const normalizedWorkbench = normalizeInstanceWorkbenchSnapshot(workbench);
  const detail = normalizedWorkbench?.detail || null;
  const instance = normalizedWorkbench?.instance || null;
  const kernelConfig = normalizedWorkbench?.kernelConfig || null;
  const kernelAuthority =
    normalizedWorkbench?.kernelAuthority || buildKernelAuthorityProjection(detail);
  const configFilePath = kernelConfig?.configFile || null;
  const configChannels = normalizedWorkbench?.configChannels || [];
  const configWebSearch = normalizedWorkbench?.configWebSearch || null;
  const configXSearch = normalizedWorkbench?.configXSearch || null;
  const configWebSearchNativeCodex = normalizedWorkbench?.configWebSearchNativeCodex || null;
  const configWebFetch = normalizedWorkbench?.configWebFetch || null;
  const configAuthCooldowns = normalizedWorkbench?.configAuthCooldowns || null;
  const configDreaming = normalizedWorkbench?.configDreaming || null;
  const actionCapabilityInstance = instance
    ? {
        ...instance,
        isBuiltIn: instance.isBuiltIn ?? detail?.instance.isBuiltIn,
      }
    : null;
  const actionCapabilities = buildInstanceActionCapabilities(actionCapabilityInstance, detail);
  const isOpenClawConfigWritable =
    detail?.instance.runtimeKind === 'openclaw' &&
    Boolean(kernelConfig?.resolved && kernelConfig.writable && kernelAuthority?.configControl);
  const providerWorkspaceState = buildOpenClawProviderWorkspaceState({
    detail,
    kernelConfig,
    kernelAuthority,
  });
  const consoleAccess = detail?.consoleAccess || null;

  return {
    workbench: normalizedWorkbench,
    instance,
    detail,
    configFilePath,
    configChannels,
    configWebSearch,
    configXSearch,
    configWebSearchNativeCodex,
    configWebFetch,
    configAuthCooldowns,
    configDreaming,
    isOpenClawConfigWritable,
    canControlLifecycle: actionCapabilities.canControlLifecycle,
    canRestartLifecycle: actionCapabilities.canRestart,
    canStopLifecycle: actionCapabilities.canStop,
    canStartLifecycle: actionCapabilities.canStart,
    canDelete: actionCapabilities.canDelete,
    canSetActive: actionCapabilities.canSetActive,
    canEditConfigChannels: Boolean(id && isOpenClawConfigWritable && configChannels.length),
    canEditConfigWebSearch: Boolean(
      id && isOpenClawConfigWritable && configWebSearch?.providers.length,
    ),
    canEditConfigXSearch: Boolean(id && isOpenClawConfigWritable && configXSearch),
    canEditConfigWebSearchNativeCodex: Boolean(
      id && isOpenClawConfigWritable && configWebSearchNativeCodex,
    ),
    canEditConfigWebFetch: Boolean(id && isOpenClawConfigWritable && configWebFetch),
    canEditConfigAuthCooldowns: Boolean(
      id && isOpenClawConfigWritable && configAuthCooldowns,
    ),
    canEditDreamingConfig: Boolean(id && isOpenClawConfigWritable && configDreaming),
    isProviderConfigReadonly: providerWorkspaceState.isProviderConfigReadonly,
    canManageOpenClawProviders: providerWorkspaceState.canManageProviderCatalog,
    canOpenControlPage: Boolean(
      consoleAccess?.available && (consoleAccess.autoLoginUrl || consoleAccess.url),
    ),
    memoryWorkbenchState: buildInstanceMemoryWorkbenchState(normalizedWorkbench),
    managementSummary: normalizedWorkbench
      ? buildInstanceManagementSummary(normalizedWorkbench)
      : null,
    providerSelectionState: buildOpenClawProviderSelectionState({
      workbench: normalizedWorkbench,
      selectedProviderId,
      providerDeleteId,
      providerModelDeleteId,
      providerDrafts,
      providerRequestDrafts,
      t,
    }),
    configChannelSelectionState: buildOpenClawConfigChannelSelectionState({
      configChannels,
      selectedConfigChannelId,
      configChannelDrafts,
    }),
    webSearchProviderSelectionState: buildOpenClawWebSearchProviderSelectionState({
      config: configWebSearch,
      selectedProviderId: selectedWebSearchProviderId,
      providerDrafts: webSearchProviderDrafts,
    }),
    providerDialogPresentation: buildOpenClawProviderDialogPresentation({
      draft: providerDialogDraft,
      t,
    }),
    availableAgentModelOptions: buildOpenClawAgentModelOptions(workbench?.llmProviders),
    readonlyChannelWorkspaceItems: buildReadonlyChannelWorkspaceItems(normalizedWorkbench?.channels),
    configChannelWorkspaceItems: buildOpenClawConfigChannelWorkspaceItems({
      configChannels,
      runtimeChannels: normalizedWorkbench?.channels,
      configChannelDrafts,
    }),
  };
}
