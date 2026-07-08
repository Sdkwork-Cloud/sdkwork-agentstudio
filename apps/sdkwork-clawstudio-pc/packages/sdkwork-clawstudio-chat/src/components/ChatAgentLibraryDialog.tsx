import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  kernelAgentLibraryService,
  type KernelAgentLibraryItem,
} from '@sdkwork/clawstudio-core';
import { ChatAgentTemplatePickerDialog } from './ChatAgentTemplatePickerDialog';

export interface ChatAgentLibraryDialogProps {
  open: boolean;
  embedded?: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectAgentTemplate: (agent: KernelAgentLibraryItem) => void;
}

export function ChatAgentLibraryDialog({
  open,
  embedded = false,
  onOpenChange,
  onSelectAgentTemplate,
}: ChatAgentLibraryDialogProps) {
  const { t } = useTranslation();
  const {
    data: agents = [],
    error,
    isFetching,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['chat', 'kernel-agent-library'],
    queryFn: () => kernelAgentLibraryService.listAgents(),
    enabled: open,
    staleTime: 60_000,
  });
  const loadError = error instanceof Error
    ? error.message
    : error
      ? t('chat.sidebar.myAgentsDialog.status.loadFailed')
      : null;

  return (
    <ChatAgentTemplatePickerDialog
      open={open}
      embedded={embedded}
      title={t('chat.sidebar.createAgentFromLibrary')}
      description={t('chat.sidebar.createAgentFromLibraryDescription')}
      searchPlaceholder={t('chat.sidebar.agentSearchPlaceholder')}
      agents={agents}
      isLoading={isLoading}
      isFetching={isFetching}
      loadError={loadError}
      onRetry={() => void refetch()}
      onOpenChange={onOpenChange}
      onSelectAgentTemplate={onSelectAgentTemplate}
    />
  );
}
