import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bot,
  CopyPlus,
  Loader2,
  RefreshCcw,
  Search,
  Server,
  Sparkles,
} from 'lucide-react';
import { type KernelAgentLibraryItem } from '@sdkwork/claw-core';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  cn,
} from '@sdkwork/claw-ui';
import {
  filterChatAgentTemplates,
  resolveChatAgentTemplateKey,
  resolveChatAgentTemplateSelectionKey,
} from '../services';
import { resolveKernelBadgeLabel } from './chatSidebarItemPrimitives';

export interface ChatAgentTemplatePickerDialogProps {
  open: boolean;
  embedded?: boolean;
  title: string;
  description: string;
  searchPlaceholder: string;
  agents: KernelAgentLibraryItem[];
  isLoading: boolean;
  isFetching?: boolean;
  loadError: string | null;
  onRetry: () => void;
  onOpenChange: (open: boolean) => void;
  onSelectAgentTemplate: (agent: KernelAgentLibraryItem) => void;
}

function resolveStreamingLabel(
  agent: KernelAgentLibraryItem,
  translate: (key: string, options?: Record<string, unknown>) => string,
) {
  if (agent.params.streaming === true) {
    return translate('chat.sidebar.newAgentDialog.streamingModes.enabled');
  }

  if (agent.params.streaming === false) {
    return translate('chat.sidebar.newAgentDialog.streamingModes.disabled');
  }

  return translate('chat.sidebar.newAgentDialog.streamingModes.inherit');
}

function resolveParameterLabel(
  value: number | null,
  translate: (key: string, options?: Record<string, unknown>) => string,
) {
  return value === null ? translate('chat.sidebar.myAgentsDialog.notSet') : String(value);
}

export function ChatAgentTemplatePickerDialog({
  open,
  embedded = false,
  title,
  description,
  searchPlaceholder,
  agents,
  isLoading,
  isFetching = false,
  loadError,
  onRetry,
  onOpenChange,
  onSelectAgentTemplate,
}: ChatAgentTemplatePickerDialogProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedAgentKey, setSelectedAgentKey] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setSelectedAgentKey(null);
    }
  }, [open]);

  const filteredAgents = React.useMemo(
    () => filterChatAgentTemplates(agents, searchQuery),
    [agents, searchQuery],
  );
  const effectiveSelectedAgentKey = React.useMemo(
    () => resolveChatAgentTemplateSelectionKey(filteredAgents, selectedAgentKey),
    [filteredAgents, selectedAgentKey],
  );
  const selectedAgent = React.useMemo(
    () =>
      filteredAgents.find(
        (agent) => resolveChatAgentTemplateKey(agent) === effectiveSelectedAgentKey,
      ) ?? null,
    [effectiveSelectedAgentKey, filteredAgents],
  );

  const content = (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.9fr)]">
        <div className="min-w-0 space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
            <Input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-11 rounded-2xl border-zinc-200/80 bg-white pl-10 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            />
          </div>

          {isLoading ? (
            <div className="flex min-h-[26rem] items-center justify-center rounded-[1.5rem] border border-dashed border-zinc-200/80 bg-zinc-50/80 px-6 py-8 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
              <Loader2 className="mr-3 h-4 w-4 animate-spin" />
              {t('chat.sidebar.myAgentsDialog.status.loading')}
            </div>
          ) : loadError ? (
            <div className="space-y-3 rounded-[1.5rem] border border-red-200 bg-red-50/90 px-5 py-5 dark:border-red-900/60 dark:bg-red-950/30">
              <p className="text-sm font-medium text-red-700 dark:text-red-200">{loadError}</p>
              <Button variant="outline" onClick={onRetry}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                {t('chat.sidebar.myAgentsDialog.actions.retry')}
              </Button>
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="flex min-h-[26rem] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-zinc-200/80 bg-zinc-50/80 px-6 py-8 text-center dark:border-zinc-800 dark:bg-zinc-950/40">
              <Sparkles className="mb-3 h-8 w-8 text-zinc-300 dark:text-zinc-700" />
              <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                {t('chat.sidebar.myAgentsDialog.status.emptyTitle')}
              </p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                {t('chat.sidebar.myAgentsDialog.status.emptyDescription')}
              </p>
            </div>
          ) : (
            <div className="max-h-[32rem] overflow-y-auto rounded-[1.5rem] border border-zinc-200/80 bg-white/95 p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/80">
              <div className="space-y-1.5">
                {filteredAgents.map((agent) => {
                  const agentKey = resolveChatAgentTemplateKey(agent);
                  const isSelected = effectiveSelectedAgentKey === agentKey;

                  return (
                    <button
                      key={agentKey}
                      type="button"
                      onClick={() => setSelectedAgentKey(agentKey)}
                      className={cn(
                        'flex w-full items-start gap-3 rounded-[1.15rem] px-3 py-3 text-left transition-all',
                        isSelected
                          ? 'bg-primary-100/92 text-primary-950 ring-1 ring-primary-300/80 shadow-sm shadow-primary-500/10 dark:bg-primary-500/18 dark:text-primary-50 dark:ring-primary-400/35 dark:shadow-primary-950/30'
                          : 'text-zinc-700 hover:bg-zinc-100/85 dark:text-zinc-300 dark:hover:bg-zinc-900/80',
                      )}
                    >
                      <div
                        className={cn(
                          'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold',
                          isSelected
                            ? 'bg-white/90 text-primary-800 dark:bg-primary-950/75 dark:text-primary-100'
                            : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200',
                        )}
                      >
                        {agent.avatar || 'AI'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-sm font-semibold">
                            {agent.displayName}
                          </span>
                          <span className="shrink-0 rounded-full border border-zinc-200/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                            {resolveKernelBadgeLabel(agent.sourceKernelId)}
                          </span>
                          {agent.isDefault ? (
                            <span className="shrink-0 rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-primary-700 dark:bg-primary-500/20 dark:text-primary-100">
                              {t('chat.sidebar.myAgentsDialog.badges.default')}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 truncate text-[12px] leading-5 text-zinc-500 dark:text-zinc-400">
                          {agent.description}
                        </p>
                        <div className="mt-2 flex min-w-0 items-center gap-2 text-[11px] text-zinc-400 dark:text-zinc-500">
                          <Server className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{agent.sourceInstanceName}</span>
                          {agent.sourceInstanceBuiltIn ? (
                            <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                              {t('chat.sidebar.myAgentsDialog.badges.builtIn')}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="min-w-0 rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/85 p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
          {selectedAgent ? (
            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem] bg-white text-base font-semibold text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100">
                  {selectedAgent.avatar || 'AI'}
                </div>
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h3 className="truncate text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                      {selectedAgent.displayName}
                    </h3>
                    <span className="rounded-full border border-zinc-200/80 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                      {resolveKernelBadgeLabel(selectedAgent.sourceKernelId)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                    {selectedAgent.description}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200/80 bg-white/90 p-4 dark:border-zinc-800 dark:bg-zinc-950/80">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
                  <Bot className="h-3.5 w-3.5" />
                  <span>{t('chat.sidebar.myAgentsDialog.sections.source')}</span>
                </div>
                <div className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-zinc-400 dark:text-zinc-500">
                      {t('chat.sidebar.newAgentDialog.labels.sourceAgent')}
                    </span>
                    <span className="truncate font-medium">{selectedAgent.agentId}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-zinc-400 dark:text-zinc-500">
                      {t('chat.sidebar.newAgentDialog.instance')}
                    </span>
                    <span className="truncate font-medium">{selectedAgent.sourceInstanceName}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-zinc-400 dark:text-zinc-500">
                      {t('chat.sidebar.newAgentDialog.labels.kernel')}
                    </span>
                    <span className="truncate font-medium">
                      {resolveKernelBadgeLabel(selectedAgent.sourceKernelId)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid gap-3">
                <div className="rounded-2xl border border-zinc-200/80 bg-white/90 p-4 dark:border-zinc-800 dark:bg-zinc-950/80">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
                    {t('chat.sidebar.myAgentsDialog.sections.model')}
                  </div>
                  <div className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {selectedAgent.model.primary || t('chat.sidebar.newAgentDialog.modelInherit')}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200/80 bg-white/90 p-4 dark:border-zinc-800 dark:bg-zinc-950/80">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
                    {t('chat.sidebar.myAgentsDialog.sections.fallbackModels')}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedAgent.model.fallbacks.length > 0 ? (
                      selectedAgent.model.fallbacks.map((model) => (
                        <span
                          key={model}
                          className="rounded-full bg-zinc-100 px-2.5 py-1 text-[12px] text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
                        >
                          {model}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-zinc-500 dark:text-zinc-400">
                        {t('chat.sidebar.myAgentsDialog.notSet')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200/80 bg-white/90 p-4 dark:border-zinc-800 dark:bg-zinc-950/80">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
                    {t('chat.sidebar.myAgentsDialog.sections.parameters')}
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-zinc-400 dark:text-zinc-500">
                        {t('chat.sidebar.newAgentDialog.labels.temperature')}
                      </span>
                      <span>{resolveParameterLabel(selectedAgent.params.temperature, t)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-zinc-400 dark:text-zinc-500">
                        {t('chat.sidebar.newAgentDialog.labels.topP')}
                      </span>
                      <span>{resolveParameterLabel(selectedAgent.params.topP, t)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-zinc-400 dark:text-zinc-500">
                        {t('chat.sidebar.newAgentDialog.labels.maxTokens')}
                      </span>
                      <span>{resolveParameterLabel(selectedAgent.params.maxTokens, t)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-zinc-400 dark:text-zinc-500">
                        {t('chat.sidebar.newAgentDialog.labels.timeoutMs')}
                      </span>
                      <span>{resolveParameterLabel(selectedAgent.params.timeoutMs, t)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-zinc-400 dark:text-zinc-500">
                        {t('chat.sidebar.newAgentDialog.labels.streaming')}
                      </span>
                      <span>{resolveStreamingLabel(selectedAgent, t)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[26rem] flex-col items-center justify-center rounded-[1.25rem] border border-dashed border-zinc-200/80 px-6 text-center dark:border-zinc-800/80">
              <Bot className="mb-3 h-8 w-8 text-zinc-300 dark:text-zinc-700" />
              <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                {t('chat.sidebar.myAgentsDialog.status.emptyTitle')}
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                {t('chat.sidebar.myAgentsDialog.status.emptyDescription')}
              </p>
            </div>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t('common.cancel')}
        </Button>
        <Button
          disabled={!selectedAgent || isFetching}
          onClick={() => {
            if (!selectedAgent) {
              return;
            }

            onSelectAgentTemplate(selectedAgent);
          }}
        >
          <CopyPlus className="mr-2 h-4 w-4" />
          {t('chat.sidebar.myAgentsDialog.actions.copy')}
        </Button>
      </DialogFooter>
    </>
  );

  if (embedded) {
    return content;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="left-1/2 top-1/2 w-[min(72rem,calc(100vw-2rem))] max-w-none translate-x-[-50%] translate-y-[-50%]">
        {content}
      </DialogContent>
    </Dialog>
  );
}
