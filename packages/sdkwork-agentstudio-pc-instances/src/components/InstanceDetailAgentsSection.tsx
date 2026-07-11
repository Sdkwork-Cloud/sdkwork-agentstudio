import React from 'react';
import { useTranslation } from 'react-i18next';
import type { CreateKernelAgentResult } from '@sdkwork/agentstudio-pc-core';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sdkwork/agentstudio-pc-ui';
import type { AgentWorkbenchSnapshot, OpenClawAgentFormState } from '../services/index.ts';
import type { InstanceWorkbenchSnapshot } from '../types/index.ts';
import { AgentWorkbenchPanel } from './AgentWorkbenchPanel.tsx';
import {
  type AgentDialogFieldKey,
  OpenClawAgentEditorForm,
} from './OpenClawAgentEditorForm.tsx';
import { InstanceAgentCreationWorkflowDialog } from './InstanceAgentCreationWorkflowDialog.tsx';

type AgentModelOption = {
  value: string;
  label: string;
};

export interface InstanceDetailAgentsSectionProps {
  workbench: InstanceWorkbenchSnapshot;
  snapshot: AgentWorkbenchSnapshot | null;
  errorMessage?: string | null;
  selectedAgentId: string | null;
  onSelectedAgentIdChange: (agentId: string) => void;
  instanceId: string | undefined;
  instanceName: string;
  instanceKernelId: string;
  onOpenAgentCreationWorkflow: () => void;
  onEditAgent: (agent: InstanceWorkbenchSnapshot['agents'][number]) => void;
  onRequestDeleteAgent: (agentId: string) => void;
  onInstallSkill: (slug: string) => void;
  onSetSkillEnabled: (skillKey: string, enabled: boolean) => void;
  onRemoveSkill: (skill: AgentWorkbenchSnapshot['skills'][number]) => void;
  isReadonly: boolean;
  isLoading: boolean;
  isFilesLoading: boolean;
  isInstallingSkill: boolean;
  updatingSkillKeys: string[];
  removingSkillKeys: string[];
  onReload: () => Promise<void> | void;
  isAgentCreationWorkflowOpen: boolean;
  onAgentCreationWorkflowOpenChange: (open: boolean) => void;
  onAgentCreationDraftReplace: (draft: OpenClawAgentFormState) => void;
  onAgentCreated: (result: CreateKernelAgentResult) => Promise<void> | void;
  onSaveAgentCreation: () => Promise<void> | void;
  isAgentDialogOpen: boolean;
  editingAgentId: string | null;
  agentDialogDraft: OpenClawAgentFormState;
  availableAgentModelOptions: AgentModelOption[];
  isSavingAgentDialog: boolean;
  onAgentDialogOpenChange: (open: boolean) => void;
  onAgentDialogFieldChange: (field: AgentDialogFieldKey, value: string) => void;
  onAgentDialogDefaultChange: (checked: boolean) => void;
  onAgentDialogStreamingModeChange: (mode: OpenClawAgentFormState['streamingMode']) => void;
  onSaveAgentDialog: () => Promise<void> | void;
  agentDeleteId: string | null;
  onAgentDeleteDialogOpenChange: (open: boolean) => void;
  onDeleteAgentConfirm: () => Promise<void> | void;
}

export function InstanceDetailAgentsSection({
  workbench,
  snapshot,
  errorMessage,
  selectedAgentId,
  onSelectedAgentIdChange,
  instanceId,
  instanceName,
  instanceKernelId,
  onOpenAgentCreationWorkflow,
  onEditAgent,
  onRequestDeleteAgent,
  onInstallSkill,
  onSetSkillEnabled,
  onRemoveSkill,
  isReadonly,
  isLoading,
  isFilesLoading,
  isInstallingSkill,
  updatingSkillKeys,
  removingSkillKeys,
  onReload,
  isAgentCreationWorkflowOpen,
  onAgentCreationWorkflowOpenChange,
  onAgentCreationDraftReplace,
  onAgentCreated,
  onSaveAgentCreation,
  isAgentDialogOpen,
  editingAgentId,
  agentDialogDraft,
  availableAgentModelOptions,
  isSavingAgentDialog,
  onAgentDialogOpenChange,
  onAgentDialogFieldChange,
  onAgentDialogDefaultChange,
  onAgentDialogStreamingModeChange,
  onSaveAgentDialog,
  agentDeleteId,
  onAgentDeleteDialogOpenChange,
  onDeleteAgentConfirm,
}: InstanceDetailAgentsSectionProps) {
  const { t } = useTranslation();

  return (
    <div data-slot="instance-detail-agents-section" className="space-y-6">
      <AgentWorkbenchPanel
        workbench={workbench}
        snapshot={snapshot}
        errorMessage={errorMessage}
        selectedAgentId={selectedAgentId}
        onSelectedAgentIdChange={onSelectedAgentIdChange}
        onOpenAgentCreationWorkflow={onOpenAgentCreationWorkflow}
        onEditAgent={onEditAgent}
        onDeleteAgent={onRequestDeleteAgent}
        onInstallSkill={onInstallSkill}
        onSetSkillEnabled={onSetSkillEnabled}
        onRemoveSkill={onRemoveSkill}
        isReadonly={isReadonly}
        isLoading={isLoading}
        isFilesLoading={isFilesLoading}
        isInstallingSkill={isInstallingSkill}
        updatingSkillKeys={updatingSkillKeys}
        removingSkillKeys={removingSkillKeys}
        onReload={onReload}
      />

      <InstanceAgentCreationWorkflowDialog
        open={isAgentCreationWorkflowOpen}
        instanceId={instanceId}
        instanceName={instanceName}
        instanceKernelId={instanceKernelId}
        draft={agentDialogDraft}
        availableAgentModelOptions={availableAgentModelOptions}
        isSaving={isSavingAgentDialog}
        onOpenChange={onAgentCreationWorkflowOpenChange}
        onDraftFieldChange={onAgentDialogFieldChange}
        onDraftDefaultChange={onAgentDialogDefaultChange}
        onDraftStreamingModeChange={onAgentDialogStreamingModeChange}
        onDraftReplace={onAgentCreationDraftReplace}
        onSubmitCreate={onSaveAgentCreation}
        onCreated={onAgentCreated}
      />

      <Dialog open={isAgentDialogOpen} onOpenChange={onAgentDialogOpenChange}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editingAgentId
                ? t('instances.detail.instanceWorkbench.agents.dialog.titleEdit')
                : t('instances.detail.instanceWorkbench.agents.dialog.titleCreate')}
            </DialogTitle>
            <DialogDescription>
              {t('instances.detail.instanceWorkbench.agents.dialog.description')}
            </DialogDescription>
          </DialogHeader>
          <OpenClawAgentEditorForm
            draft={agentDialogDraft}
            availableAgentModelOptions={availableAgentModelOptions}
            onFieldChange={onAgentDialogFieldChange}
            onDefaultChange={onAgentDialogDefaultChange}
            onStreamingModeChange={onAgentDialogStreamingModeChange}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => onAgentDialogOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => void onSaveAgentDialog()} disabled={isSavingAgentDialog}>
              {isSavingAgentDialog ? t('common.loading') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(agentDeleteId)}
        onOpenChange={(open) => onAgentDeleteDialogOpenChange(open)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t('instances.detail.instanceWorkbench.agents.deleteDialog.title')}
            </DialogTitle>
            <DialogDescription>
              {t('instances.detail.instanceWorkbench.agents.deleteDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onAgentDeleteDialogOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => void onDeleteAgentConfirm()}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
