import { createElement, type ReactNode } from 'react';
import { CronTasksManager } from '@sdkwork/claw-commons';
import type {
  AgentWorkbenchSnapshot,
  OpenClawAgentFormState,
  OpenClawProviderFormState,
  OpenClawProviderModelFormState,
} from '../services/index.ts';
import {
  applyOpenClawProviderConfigDraftChange,
  applyOpenClawProviderFieldDraftChange,
  applyOpenClawProviderRequestDraftChange,
  createOpenClawAgentCreateDialogState,
  createInstanceDetailSilentWorkbenchReloadHandler,
  createOpenClawProviderConfigDraft,
  createOpenClawProviderCreateDialogState,
  createOpenClawProviderDialogResetDrafts,
  createOpenClawProviderModelCreateDialogState,
  createOpenClawProviderModelEditDialogState,
  createOpenClawProviderRequestDraft,
} from '../services/index.ts';
import type { InstanceWorkbenchSnapshot } from '../types/index.ts';
import type { InstanceLLMProviderUpdate } from '../types/index.ts';
import type { InstanceWorkbenchSectionId } from '../types/index.ts';
import { InstanceDetailAgentsSection } from './InstanceDetailAgentsSection.tsx';
import type { InstanceDetailAgentsSectionProps } from './InstanceDetailAgentsSection.tsx';
import { InstanceDetailLlmProvidersWorkbenchSection } from './InstanceDetailLlmProvidersWorkbenchSection.tsx';
import type { InstanceDetailLlmProviderDialogsProps } from './InstanceDetailLlmProviderDialogs.tsx';
import type { InstanceDetailLlmProvidersSectionProps } from './InstanceDetailLlmProvidersSection.tsx';
import { InstanceDetailMemoryWorkbenchSection } from './InstanceDetailMemoryWorkbenchSection.tsx';
import type { InstanceDetailMemoryWorkbenchSectionProps } from './InstanceDetailMemoryWorkbenchSection.tsx';
import { InstanceDetailConfigToolsSection } from './InstanceDetailConfigToolsSection.tsx';
import type { InstanceDetailConfigToolsSectionProps } from './InstanceDetailConfigToolsSection.tsx';

type AgentDialogDraftUpdater = (
  updater: (current: OpenClawAgentFormState) => OpenClawAgentFormState,
) => void;

type ProviderDialogDraftUpdater = (
  next:
    | OpenClawProviderFormState
    | ((current: OpenClawProviderFormState) => OpenClawProviderFormState),
) => void;

type ProviderModelDialogDraftUpdater = (
  next:
    | OpenClawProviderModelFormState
    | ((current: OpenClawProviderModelFormState) => OpenClawProviderModelFormState),
) => void;

type ProviderDraftsUpdater = (
  updater: (
    current: Record<string, InstanceLLMProviderUpdate>,
  ) => Record<string, InstanceLLMProviderUpdate>,
) => void;

type ProviderRequestDraftsUpdater = (
  updater: (current: Record<string, string>) => Record<string, string>,
) => void;

type SectionAvailabilityRenderer = (
  sectionId: InstanceWorkbenchSectionId,
  fallbackKey: string,
) => ReactNode;

export interface BuildAgentSectionPropsInput
  extends Omit<
    InstanceDetailAgentsSectionProps,
    | 'workbench'
    | 'snapshot'
    | 'errorMessage'
    | 'updatingSkillKeys'
    | 'removingSkillKeys'
    | 'onReload'
    | 'onAgentCreationWorkflowOpenChange'
    | 'onAgentCreationDraftReplace'
    | 'onAgentDialogOpenChange'
    | 'onAgentDialogFieldChange'
    | 'onAgentDialogDefaultChange'
    | 'onAgentDialogStreamingModeChange'
    | 'onAgentDeleteDialogOpenChange'
  > {
  workbench: InstanceWorkbenchSnapshot | null;
  selectedAgentWorkbench: AgentWorkbenchSnapshot | null;
  agentWorkbenchError?: string | null;
  updatingAgentSkillKeys: string[];
  removingAgentSkillKeys: string[];
  instanceId: string | undefined;
  loadWorkbench: (
    instanceId: string,
    options: { withSpinner?: boolean },
  ) => Promise<void> | void;
  setIsAgentCreationWorkflowOpen: (open: boolean) => void;
  setIsAgentDialogOpen: (open: boolean) => void;
  setEditingAgentId: (agentId: string | null) => void;
  setAgentDialogDraft: AgentDialogDraftUpdater;
  setAgentDeleteId: (agentId: string | null) => void;
}

export interface BuildLlmProviderSectionPropsInput
  extends Omit<
    InstanceDetailLlmProvidersSectionProps,
    | 'providers'
    | 'onFieldChange'
    | 'onRequestOverridesChange'
    | 'onConfigChange'
    | 'onReset'
    | 'onOpenCreateProviderDialog'
    | 'onOpenCreateProviderModelDialog'
    | 'onOpenEditProviderModelDialog'
  > {
  workbench: Pick<InstanceWorkbenchSnapshot, 'llmProviders'> | null;
  setIsProviderDialogOpen: (open: boolean) => void;
  setProviderDialogDraft: ProviderDialogDraftUpdater;
  setIsProviderModelDialogOpen: (open: boolean) => void;
  setProviderModelDialogDraft: ProviderModelDialogDraftUpdater;
  setProviderDrafts: ProviderDraftsUpdater;
  setProviderRequestDrafts: ProviderRequestDraftsUpdater;
}

export interface BuildLlmProviderDialogPropsInput
  extends Omit<
    InstanceDetailLlmProviderDialogsProps,
    'onProviderDialogFieldChange' | 'onProviderModelDialogFieldChange'
  > {
  setProviderDialogDraft: ProviderDialogDraftUpdater;
  setProviderModelDialogDraft: ProviderModelDialogDraftUpdater;
}

export interface BuildLlmProviderDialogStateHandlersInput {
  setIsProviderDialogOpen: (open: boolean) => void;
  setProviderDialogDraft: ProviderDialogDraftUpdater;
  setIsProviderModelDialogOpen: (open: boolean) => void;
  setProviderModelDialogDraft: ProviderModelDialogDraftUpdater;
  setProviderDeleteId: (providerId: string | null) => void;
  setProviderModelDeleteId: (providerModelId: string | null) => void;
}

export interface BuildMemoryWorkbenchSectionPropsInput
  extends Omit<InstanceDetailMemoryWorkbenchSectionProps, 'emptyState'> {
  renderSectionAvailability: SectionAvailabilityRenderer;
}

export interface BuildConfigToolsSectionPropsInput
  extends Omit<InstanceDetailConfigToolsSectionProps, 'emptyState'> {
  renderSectionAvailability: SectionAvailabilityRenderer;
}

export interface BuildMemoryWorkbenchSectionContentInput {
  sectionProps: InstanceDetailMemoryWorkbenchSectionProps;
}

export interface BuildConfigToolsSectionContentInput {
  sectionProps: InstanceDetailConfigToolsSectionProps;
}

export interface BuildAgentSectionContentInput {
  sectionProps: InstanceDetailAgentsSectionProps | null;
}

export interface BuildLlmProvidersSectionContentInput {
  sectionProps: InstanceDetailLlmProvidersSectionProps | null;
  dialogProps: InstanceDetailLlmProviderDialogsProps;
}

export interface BuildTasksSectionContentInput {
  workbench: InstanceWorkbenchSnapshot | null;
  instanceId: string | undefined;
}

export function buildAgentSectionProps({
  workbench,
  selectedAgentWorkbench,
  agentWorkbenchError,
  updatingAgentSkillKeys,
  removingAgentSkillKeys,
  instanceId,
  loadWorkbench,
  setIsAgentCreationWorkflowOpen,
  setIsAgentDialogOpen,
  setEditingAgentId,
  setAgentDialogDraft,
  setAgentDeleteId,
  ...rest
}: BuildAgentSectionPropsInput): InstanceDetailAgentsSectionProps | null {
  if (!workbench) {
    return null;
  }

  const reloadAgentWorkbenchSilently = createInstanceDetailSilentWorkbenchReloadHandler({
    instanceId,
    reloadWorkbench: loadWorkbench,
  });

  return {
    ...rest,
    workbench,
    snapshot: selectedAgentWorkbench,
    errorMessage: agentWorkbenchError,
    instanceId,
    updatingSkillKeys: updatingAgentSkillKeys,
    removingSkillKeys: removingAgentSkillKeys,
    onReload: reloadAgentWorkbenchSilently,
    onAgentCreationWorkflowOpenChange: (open) => {
      setIsAgentCreationWorkflowOpen(open);
      if (!open) {
        const dialogState = createOpenClawAgentCreateDialogState();
        setEditingAgentId(dialogState.editingAgentId);
        setAgentDialogDraft(() => dialogState.draft);
      }
    },
    onAgentCreationDraftReplace: (draft) => {
      setEditingAgentId(null);
      setAgentDialogDraft(() => draft);
    },
    onAgentDialogOpenChange: (open) => {
      setIsAgentDialogOpen(open);
      if (!open) {
        const dialogState = createOpenClawAgentCreateDialogState();
        setEditingAgentId(dialogState.editingAgentId);
        setAgentDialogDraft(() => dialogState.draft);
      }
    },
    onAgentDialogFieldChange: (field, value) =>
      setAgentDialogDraft((current) => ({
        ...current,
        [field]: value,
      })),
    onAgentDialogDefaultChange: (checked) =>
      setAgentDialogDraft((current) => ({
        ...current,
        isDefault: checked,
      })),
    onAgentDialogStreamingModeChange: (mode) =>
      setAgentDialogDraft((current) => ({
        ...current,
        streamingMode: mode,
      })),
    onAgentDeleteDialogOpenChange: (open) => {
      if (!open) {
        setAgentDeleteId(null);
      }
    },
  };
}

export function buildLlmProviderSectionProps({
  workbench,
  selectedProvider,
  selectedProviderDraft,
  isProviderConfigReadonly,
  canManageOpenClawProviders,
  setIsProviderDialogOpen,
  setProviderDialogDraft,
  setIsProviderModelDialogOpen,
  setProviderModelDialogDraft,
  setProviderDrafts,
  setProviderRequestDrafts,
  ...rest
}: BuildLlmProviderSectionPropsInput): InstanceDetailLlmProvidersSectionProps | null {
  if (!workbench) {
    return null;
  }

  return {
    ...rest,
    selectedProvider,
    selectedProviderDraft,
    isProviderConfigReadonly,
    canManageOpenClawProviders,
    providers: workbench.llmProviders,
    onFieldChange: (field, value) => {
      if (isProviderConfigReadonly || !selectedProvider || !selectedProviderDraft) {
        return;
      }

      setProviderDrafts((current) =>
        applyOpenClawProviderFieldDraftChange({
          drafts: current,
          providerId: selectedProvider.id,
          draft: selectedProviderDraft,
          field,
          value,
        }),
      );
    },
    onRequestOverridesChange: (value) => {
      if (isProviderConfigReadonly || !selectedProvider) {
        return;
      }

      setProviderRequestDrafts((current) =>
        applyOpenClawProviderRequestDraftChange({
          requestDrafts: current,
          providerId: selectedProvider.id,
          value,
        }),
      );
    },
    onConfigChange: (field, value) => {
      if (isProviderConfigReadonly || !selectedProvider || !selectedProviderDraft) {
        return;
      }

      setProviderDrafts((current) =>
        applyOpenClawProviderConfigDraftChange({
          drafts: current,
          providerId: selectedProvider.id,
          draft: selectedProviderDraft,
          field,
          value,
        }),
      );
    },
    onReset: () => {
      if (isProviderConfigReadonly || !selectedProvider) {
        return;
      }

      setProviderDrafts((current) => ({
        ...current,
        [selectedProvider.id]: createOpenClawProviderConfigDraft(selectedProvider),
      }));
      setProviderRequestDrafts((current) => ({
        ...current,
        [selectedProvider.id]: createOpenClawProviderRequestDraft(selectedProvider),
      }));
    },
    onOpenCreateProviderDialog: () => {
      if (!canManageOpenClawProviders) {
        return;
      }
      const dialogState = createOpenClawProviderCreateDialogState();
      setProviderDialogDraft(() => dialogState.draft);
      setIsProviderDialogOpen(true);
    },
    onOpenCreateProviderModelDialog: () => {
      if (!canManageOpenClawProviders) {
        return;
      }
      const dialogState = createOpenClawProviderModelCreateDialogState();
      setProviderModelDialogDraft(() => dialogState.draft);
      setIsProviderModelDialogOpen(true);
    },
    onOpenEditProviderModelDialog: (model) => {
      const dialogState = createOpenClawProviderModelEditDialogState(model);
      setProviderModelDialogDraft(() => dialogState.draft);
      setIsProviderModelDialogOpen(true);
    },
  };
}

export function buildLlmProviderDialogStateHandlers({
  setIsProviderDialogOpen,
  setProviderDialogDraft,
  setIsProviderModelDialogOpen,
  setProviderModelDialogDraft,
  setProviderDeleteId,
  setProviderModelDeleteId,
}: BuildLlmProviderDialogStateHandlersInput) {
  const onProviderDialogOpenChange = (open: boolean) => {
    setIsProviderDialogOpen(open);
    if (!open) {
      const providerDialogResetDrafts = createOpenClawProviderDialogResetDrafts();
      setProviderDialogDraft(providerDialogResetDrafts.providerDialogDraft);
    }
  };
  const onProviderModelDialogOpenChange = (open: boolean) => {
    setIsProviderModelDialogOpen(open);
    if (!open) {
      const providerDialogResetDrafts = createOpenClawProviderDialogResetDrafts();
      setProviderModelDialogDraft(providerDialogResetDrafts.providerModelDialogDraft);
    }
  };

  return {
    onProviderDialogOpenChange,
    dismissProviderDialog: () => onProviderDialogOpenChange(false),
    onProviderModelDialogOpenChange,
    dismissProviderModelDialog: () => onProviderModelDialogOpenChange(false),
    onProviderDeleteDialogOpenChange: (open: boolean) => {
      if (!open) {
        setProviderDeleteId(null);
      }
    },
    onProviderModelDeleteDialogOpenChange: (open: boolean) => {
      if (!open) {
        setProviderModelDeleteId(null);
      }
    },
  };
}

export function buildLlmProviderDialogProps({
  setProviderDialogDraft,
  setProviderModelDialogDraft,
  ...rest
}: BuildLlmProviderDialogPropsInput): InstanceDetailLlmProviderDialogsProps {
  return {
    ...rest,
    onProviderDialogFieldChange: (field, value) =>
      setProviderDialogDraft((current) => ({
        ...current,
        [field]: value,
      })),
    onProviderModelDialogFieldChange: (field, value) =>
      setProviderModelDialogDraft((current) => ({
        ...current,
        [field]: value,
      })),
  };
}

export function buildMemoryWorkbenchSectionProps({
  renderSectionAvailability,
  ...rest
}: BuildMemoryWorkbenchSectionPropsInput): InstanceDetailMemoryWorkbenchSectionProps {
  return {
    ...rest,
    emptyState: renderSectionAvailability(
      'memory',
      'instances.detail.instanceWorkbench.empty.memory',
    ),
  };
}

export function buildConfigToolsSectionProps({
  renderSectionAvailability,
  ...rest
}: BuildConfigToolsSectionPropsInput): InstanceDetailConfigToolsSectionProps {
  return {
    ...rest,
    emptyState: renderSectionAvailability(
      'tools',
      'instances.detail.instanceWorkbench.empty.tools',
    ),
  };
}

export function buildMemoryWorkbenchSectionContent({
  sectionProps,
}: BuildMemoryWorkbenchSectionContentInput): ReactNode {
  return createElement(InstanceDetailMemoryWorkbenchSection, sectionProps);
}

export function buildConfigToolsSectionContent({
  sectionProps,
}: BuildConfigToolsSectionContentInput): ReactNode {
  return createElement(InstanceDetailConfigToolsSection, sectionProps);
}

export function buildAgentSectionContent({
  sectionProps,
}: BuildAgentSectionContentInput): ReactNode {
  return sectionProps ? createElement(InstanceDetailAgentsSection, sectionProps) : null;
}

export function buildLlmProvidersSectionContent({
  sectionProps,
  dialogProps,
}: BuildLlmProvidersSectionContentInput): ReactNode {
  return sectionProps
    ? createElement(InstanceDetailLlmProvidersWorkbenchSection, {
        sectionProps,
        dialogProps,
      })
    : null;
}

export function buildTasksSectionContent({
  workbench,
  instanceId,
}: BuildTasksSectionContentInput): ReactNode {
  return workbench
    ? createElement(CronTasksManager, {
        instanceId,
        embedded: true,
      })
    : null;
}
