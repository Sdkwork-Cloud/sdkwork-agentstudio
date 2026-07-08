import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';
import {
  Button,
  Dialog,
  OverlaySurface,
} from '@sdkwork/clawstudio-ui';
import type {
  CreateKernelAgentResult,
  KernelAgentLibraryItem,
} from '@sdkwork/clawstudio-core';
import {
  createChatAgentDraftFromLibraryAgent,
  type ChatAgentCreationFollowUpResult,
  type ChatAgentDraft,
} from '../services';
import type { ChatSidebarCreateAgentMenuActionId } from './ChatSidebarCreateAgentMenu';
import { ChatAgentLibraryDialog } from './ChatAgentLibraryDialog';
import { ChatAgentMarketDialog } from './ChatAgentMarketDialog';
import { ChatMyAgentsDialog } from './ChatMyAgentsDialog';
import { ChatNewAgentDialog } from './ChatNewAgentDialog';

export interface ChatAgentCreationWorkflowDialogProps {
  open: boolean;
  mode: ChatSidebarCreateAgentMenuActionId | null;
  instanceId: string | null | undefined;
  onOpenChange: (open: boolean) => void;
  onCreated?: (
    result: CreateKernelAgentResult,
  ) =>
    | Promise<ChatAgentCreationFollowUpResult | void>
    | ChatAgentCreationFollowUpResult
    | void;
}

export function ChatAgentCreationWorkflowDialog({
  open,
  mode,
  instanceId,
  onOpenChange,
  onCreated,
}: ChatAgentCreationWorkflowDialogProps) {
  const { t } = useTranslation();
  const [selectedTemplateAgent, setSelectedTemplateAgent] = React.useState<KernelAgentLibraryItem | null>(null);
  const [selectedTemplateDraft, setSelectedTemplateDraft] = React.useState<ChatAgentDraft | null>(null);

  React.useEffect(() => {
    if (!open) {
      setSelectedTemplateAgent(null);
      setSelectedTemplateDraft(null);
      return;
    }

    if (mode === 'custom' || mode === 'market') {
      setSelectedTemplateAgent(null);
      setSelectedTemplateDraft(null);
    }
  }, [mode, open]);

  const workflowView = React.useMemo(() => {
    if (mode === 'market') {
      return 'market';
    }

    if (mode === 'custom') {
      return 'form';
    }

    if (selectedTemplateAgent) {
      return 'form';
    }

    return 'template';
  }, [mode, selectedTemplateAgent]);

  const handleSelectTemplateAgent = React.useCallback((agent: KernelAgentLibraryItem,) => {
    setSelectedTemplateAgent(agent);
    setSelectedTemplateDraft(createChatAgentDraftFromLibraryAgent(agent));
  }, []);

  const handleBackToTemplates = React.useCallback(() => {
    setSelectedTemplateAgent(null);
    setSelectedTemplateDraft(null);
  }, []);

  const copyFormHeaderLeading = mode === 'custom' ? null : (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleBackToTemplates}
      className="mt-0.5 h-9 px-2 text-zinc-500 dark:text-zinc-400"
      aria-label={t('chat.sidebar.newAgentDialog.actions.backToTemplates')}
      title={t('chat.sidebar.newAgentDialog.actions.backToTemplates')}
    >
      <ChevronLeft className="h-4 w-4" />
      <span>{t('chat.sidebar.newAgentDialog.actions.backToTemplates')}</span>
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <OverlaySurface
        isOpen={open}
        onClose={() => onOpenChange(false)}
        className="max-h-[calc(100dvh-2rem)] w-[min(72rem,calc(100vw-2rem))] max-w-none overflow-y-auto p-6"
      >
        <div role="dialog" aria-modal="true" aria-label={t('chat.sidebar.createButtonLabel')} className="grid gap-4">
          {workflowView === 'market' ? (
            <ChatAgentMarketDialog
              open={open}
              embedded
              instanceId={instanceId}
              onOpenChange={onOpenChange}
              onInstalled={async (result) => {
                return await onCreated?.(result);
              }}
            />
          ) : workflowView === 'form' ? (
            <ChatNewAgentDialog
              open={open}
              embedded
              onOpenChange={onOpenChange}
              instanceId={instanceId}
              mode={mode === 'custom' ? 'create' : 'copy'}
              initialDraft={selectedTemplateDraft}
              sourceAgent={selectedTemplateAgent}
              headerLeading={copyFormHeaderLeading}
              onCreated={async (result) => {
                return await onCreated?.(result);
              }}
            />
          ) : mode === 'copy' ? (
            <ChatMyAgentsDialog
              open={open}
              embedded
              instanceId={instanceId}
              onOpenChange={onOpenChange}
              onSelectAgentTemplate={handleSelectTemplateAgent}
            />
          ) : (
            <ChatAgentLibraryDialog
              open={open}
              embedded
              onOpenChange={onOpenChange}
              onSelectAgentTemplate={handleSelectTemplateAgent}
            />
          )}
        </div>
      </OverlaySurface>
    </Dialog>
  );
}
