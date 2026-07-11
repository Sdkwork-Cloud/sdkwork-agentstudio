import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  kernelOwnedAgentLibraryService,
  type KernelAgentLibraryItem,
} from '@sdkwork/agentstudio-pc-core';
import { ChatAgentTemplatePickerDialog } from './ChatAgentTemplatePickerDialog';

export interface ChatMyAgentsDialogProps {
  open: boolean;
  embedded?: boolean;
  instanceId: string | null | undefined;
  onOpenChange: (open: boolean) => void;
  onSelectAgentTemplate: (agent: KernelAgentLibraryItem) => void;
}

export function ChatMyAgentsDialog({
  open,
  embedded = false,
  instanceId,
  onOpenChange,
  onSelectAgentTemplate,
}: ChatMyAgentsDialogProps) {
  const { t } = useTranslation();
  const {
    data: agents = [],
    error,
    isFetching,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['chat', 'owned-kernel-agent-library', instanceId],
    queryFn: () => kernelOwnedAgentLibraryService.listAgents(instanceId),
    enabled: open && Boolean(instanceId),
    staleTime: 60_000,
  });
  const loadError =
    error instanceof Error
      ? error.message
      : error
        ? t('chat.sidebar.myAgentsDialog.status.loadFailed')
        : null;

  return (
    <ChatAgentTemplatePickerDialog
      open={open}
      embedded={embedded}
      title={t('chat.sidebar.myAgentsDialog.title')}
      description={t('chat.sidebar.myAgentsDialog.description')}
      searchPlaceholder={t('chat.sidebar.myAgentsDialog.searchPlaceholder')}
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
