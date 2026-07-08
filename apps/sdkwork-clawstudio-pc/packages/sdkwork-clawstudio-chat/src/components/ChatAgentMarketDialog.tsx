import React, { startTransition, useDeferredValue, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Search,
  Server,
  Sparkles,
} from 'lucide-react';
import {
  agentInstallService,
  AGENT_MARKET_TEMPLATES,
  createAgentMarketCatalog,
  type AgentInstallTarget,
  type AgentMarketTemplate,
  type CreateKernelAgentResult,
} from '@sdkwork/clawstudio-core';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  TaskStudioTabs,
} from '@sdkwork/clawstudio-ui';
import {
  normalizeChatAgentCreationFollowUpResult,
  type ChatAgentCreationFollowUpResult,
  resolveChatAgentMarketSelectedTargetId,
  resolveChatAgentMarketSelectedTemplateId,
} from '../services';

function localizeTemplate(
  template: AgentMarketTemplate,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  return {
    name: t(`agentMarket.templates.${template.id}.name`, { defaultValue: template.name }),
    summary: t(`agentMarket.templates.${template.id}.summary`, {
      defaultValue: template.summary,
    }),
    description: t(`agentMarket.templates.${template.id}.description`, {
      defaultValue: template.description,
    }),
    focus: t(`agentMarket.templates.${template.id}.focus`, { defaultValue: template.focus }),
    capabilities: template.capabilities.map((capability, index) =>
      t(`agentMarket.templates.${template.id}.capabilities.${index}`, {
        defaultValue: capability,
      })),
  };
}

function buildTemplateSearchValues(
  template: AgentMarketTemplate,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  const localizedTemplate = localizeTemplate(template, t);
  const localizedCategory = t(`agentMarket.categories.${template.category}`, {
    defaultValue: template.category,
  });

  return [
    ...new Set([
      template.name,
      template.summary,
      template.description,
      template.category,
      template.focus,
      ...template.capabilities,
      localizedTemplate.name,
      localizedTemplate.summary,
      localizedTemplate.description,
      localizedCategory,
      localizedTemplate.focus,
      ...localizedTemplate.capabilities,
    ]),
  ];
}

function compareTargetPriority(
  left: AgentInstallTarget,
  right: AgentInstallTarget,
  templateId: string,
  preferredTargetId: string,
) {
  const leftInstalled = left.installedTemplateIds.includes(templateId);
  const rightInstalled = right.installedTemplateIds.includes(templateId);
  if (leftInstalled !== rightInstalled) {
    return leftInstalled ? 1 : -1;
  }

  const leftIsPreferred = preferredTargetId ? left.id === preferredTargetId : false;
  const rightIsPreferred = preferredTargetId ? right.id === preferredTargetId : false;
  if (leftIsPreferred !== rightIsPreferred) {
    return leftIsPreferred ? -1 : 1;
  }

  if (left.isBuiltIn !== right.isBuiltIn) {
    return left.isBuiltIn ? -1 : 1;
  }

  return left.name.localeCompare(right.name);
}

function sortTargetsForTemplate(
  targets: AgentInstallTarget[],
  templateId: string,
  preferredTargetId: string,
) {
  return [...targets].sort((left, right) =>
    compareTargetPriority(left, right, templateId, preferredTargetId));
}

export interface ChatAgentMarketDialogProps {
  open: boolean;
  embedded?: boolean;
  instanceId: string | null | undefined;
  onOpenChange: (open: boolean) => void;
  onInstalled: (
    result: CreateKernelAgentResult,
  ) =>
    | Promise<ChatAgentCreationFollowUpResult | void>
    | ChatAgentCreationFollowUpResult
    | void;
}

export function ChatAgentMarketDialog({
  open,
  embedded = false,
  instanceId,
  onOpenChange,
  onInstalled,
}: ChatAgentMarketDialogProps) {
  const { t, i18n } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const preferredTargetId = instanceId ?? '';

  const {
    data: targets = [],
    error,
    isFetched,
    isFetching,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['chat', 'agent-market', 'targets'],
    queryFn: () => agentInstallService.listInstallTargets(),
    enabled: open,
    staleTime: 30_000,
  });

  const installMutation = useMutation({
    mutationFn: async (input: { instanceId: string; templateId: string }) =>
      agentInstallService.installTemplate(input),
  });
  const resetInstallMutation = React.useEffectEvent(() => {
    installMutation.reset();
  });

  React.useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setActiveCategory('All');
      setSelectedTemplateId(null);
      setSelectedTargetId('');
      setFollowUpError(null);
      resetInstallMutation();
    }
  }, [open, resetInstallMutation]);

  const catalog = useMemo(
    () =>
      createAgentMarketCatalog({
        templates: AGENT_MARKET_TEMPLATES,
        keyword: deferredSearchQuery,
        activeCategory,
        searchValueResolver: (template) => buildTemplateSearchValues(template, t),
      }),
    [activeCategory, deferredSearchQuery, i18n.resolvedLanguage, t],
  );
  const effectiveSelectedTemplateId = React.useMemo(
    () => resolveChatAgentMarketSelectedTemplateId(catalog.templates, selectedTemplateId),
    [catalog.templates, selectedTemplateId],
  );
  const selectedTemplate = React.useMemo(
    () =>
      catalog.templates.find((template) => template.id === effectiveSelectedTemplateId)
      || AGENT_MARKET_TEMPLATES.find((template) => template.id === effectiveSelectedTemplateId)
      || null,
    [catalog.templates, effectiveSelectedTemplateId],
  );

  const modalTargets = useMemo(
    () =>
      selectedTemplate
        ? sortTargetsForTemplate(targets, selectedTemplate.id, preferredTargetId)
        : targets,
    [preferredTargetId, selectedTemplate, targets],
  );
  const effectiveSelectedTargetId = React.useMemo(
    () =>
      resolveChatAgentMarketSelectedTargetId({
        targets: modalTargets,
        templateId: selectedTemplate?.id ?? null,
        preferredTargetId,
        selectedTargetId,
      }),
    [modalTargets, preferredTargetId, selectedTargetId, selectedTemplate?.id],
  );
  const selectedTarget =
    modalTargets.find((target) => target.id === effectiveSelectedTargetId) || null;
  const selectedTemplateAlreadyInstalled
    = !!selectedTemplate && !!selectedTarget?.installedTemplateIds.includes(selectedTemplate.id);
  const localizedSelectedTemplate = selectedTemplate ? localizeTemplate(selectedTemplate, t) : null;

  const categoryTabs = useMemo(
    () =>
      catalog.categories.map((category) => ({
        id: category,
        label:
          category === 'All'
            ? t('agentMarket.categories.All')
            : t(`agentMarket.categories.${category}`, { defaultValue: category }),
        count:
          category === 'All'
            ? AGENT_MARKET_TEMPLATES.length
            : AGENT_MARKET_TEMPLATES.filter((template) => template.category === category).length,
      })),
    [catalog.categories, t],
  );

  const mutationErrorMessage = installMutation.error instanceof Error
    ? installMutation.error.message
    : null;

  const content = (
    <>
      <DialogHeader>
        <DialogTitle>{t('chat.sidebar.createAgentFromMarket')}</DialogTitle>
        <DialogDescription>{t('chat.sidebar.createAgentFromMarketDescription')}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.9fr)]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-col gap-3">
            <div className="w-fit max-w-full min-w-0 overflow-x-auto">
              <TaskStudioTabs
                activeTab={activeCategory}
                tabs={categoryTabs}
                onChange={(tabId) => {
                  startTransition(() => {
                    setActiveCategory(tabId);
                  });
                }}
              />
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                type="search"
                value={searchQuery}
                placeholder={t('agentMarket.searchPlaceholder')}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="h-11 rounded-[16px] border-zinc-200/80 bg-white pl-11 pr-4 text-sm shadow-none focus-visible:border-primary-300 focus-visible:bg-white focus-visible:ring-0 dark:border-zinc-800 dark:bg-zinc-900 dark:focus-visible:border-primary-500/30"
              />
            </div>
          </div>

          {catalog.templates.length > 0 ? (
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(17rem,1fr))]">
              {catalog.templates.map((template) => {
                const localizedTemplate = localizeTemplate(template, t);
                const installCount = targets.filter((target) => target.installedTemplateIds.includes(template.id)).length;
                const isSelected = template.id === effectiveSelectedTemplateId;
                const isFullyInstalled = isFetched && targets.length > 0 && installCount === targets.length;

                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => setSelectedTemplateId(template.id)}
                    className={`flex h-full flex-col rounded-[20px] border p-5 text-left shadow-sm transition-colors ${
                      isSelected
                        ? 'border-primary-300 bg-primary-50/90 dark:border-primary-500/30 dark:bg-primary-500/10'
                        : 'border-zinc-200/80 bg-white/90 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/85 dark:hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-zinc-100 text-2xl dark:bg-zinc-950">
                        {template.emoji}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-base font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                            {localizedTemplate.name}
                          </h3>
                          <span className="rounded-full border border-primary-200 bg-primary-50 px-2.5 py-1 text-[11px] font-semibold text-primary-700 dark:border-primary-500/20 dark:bg-primary-500/10 dark:text-primary-200">
                            {t(`agentMarket.categories.${template.category}`, {
                              defaultValue: template.category,
                            })}
                          </span>
                          {installCount > 0 ? (
                            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                              {t('agentMarket.labels.installedInCount', { count: installCount })}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                          {localizedTemplate.summary}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {localizedTemplate.capabilities.map((capability) => (
                        <span
                          key={`${template.id}:${capability}`}
                          className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                        >
                          {capability}
                        </span>
                      ))}
                    </div>

                    <div className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
                      {localizedTemplate.focus}
                    </div>
                    {isFullyInstalled ? (
                      <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                        <CheckCircle2 className="h-4 w-4" />
                        {t('agentMarket.actions.installed')}
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-[24rem] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-zinc-200/80 bg-zinc-50/80 px-6 py-8 text-center dark:border-zinc-800 dark:bg-zinc-950/40">
              <Search className="mb-3 h-8 w-8 text-zinc-300 dark:text-zinc-700" />
              <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                {t('agentMarket.empty.searchTitle')}
              </p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                {t('agentMarket.empty.searchDescription')}
              </p>
            </div>
          )}
        </div>

        <div className="min-w-0 rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/85 p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
          {selectedTemplate ? (
            <div className="space-y-5">
              <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl ring-1 ring-zinc-200 dark:bg-zinc-950 dark:ring-zinc-800">
                    {selectedTemplate.emoji}
                  </div>
                  <div className="min-w-0">
                    {localizedSelectedTemplate ? (
                      <>
                        <h4 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                          {localizedSelectedTemplate.name}
                        </h4>
                        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                          {localizedSelectedTemplate.summary}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                          {localizedSelectedTemplate.description}
                        </p>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>

              {isLoading || (isFetching && !isFetched) ? (
                <div className="flex min-h-[18rem] items-center justify-center rounded-[1.5rem] border border-dashed border-zinc-200/80 bg-zinc-50/80 px-6 py-8 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
                  <Loader2 className="mr-3 h-4 w-4 animate-spin" />
                  {t('chat.sidebar.myAgentsDialog.status.loading')}
                </div>
              ) : error ? (
                <div className="space-y-3 rounded-[1.5rem] border border-red-200 bg-red-50/90 px-5 py-5 dark:border-red-900/60 dark:bg-red-950/30">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-300" />
                    <div>
                      <p className="text-sm font-medium text-red-700 dark:text-red-200">
                        {t('agentMarket.error.title')}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-red-700/85 dark:text-red-200/85">
                        {error instanceof Error ? error.message : t('agentMarket.error.description')}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => void refetch()}>
                    {t('agentMarket.error.retry')}
                  </Button>
                </div>
              ) : modalTargets.length === 0 ? (
                <div className="space-y-3 rounded-[1.5rem] border border-dashed border-zinc-200/80 bg-zinc-50/80 px-6 py-8 text-center dark:border-zinc-800 dark:bg-zinc-950/40">
                  <Sparkles className="mx-auto h-8 w-8 text-zinc-300 dark:text-zinc-700" />
                  <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                    {t('agentMarket.empty.noTargetsTitle')}
                  </p>
                  <p className="text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                    {t('agentMarket.empty.noTargetsDescription')}
                  </p>
                  <Button variant="outline" onClick={() => void refetch()}>
                    {t('agentMarket.error.retry')}
                  </Button>
                </div>
              ) : (
                <>
                  <div>
                    <div className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      {t('agentMarket.modal.targetLabel')}
                    </div>
                    <div className="space-y-2">
                      {modalTargets.map((target) => {
                        const isSelected = target.id === effectiveSelectedTargetId;
                        const isInstalled = target.installedTemplateIds.includes(selectedTemplate.id);

                        return (
                          <button
                            key={target.id}
                            type="button"
                            onClick={() => setSelectedTargetId(target.id)}
                            className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-4 text-left ${
                              isSelected
                                ? 'border-primary-300 bg-primary-50 dark:border-primary-500/30 dark:bg-primary-500/10'
                                : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950'
                            }`}
                          >
                            <div
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                                isSelected
                                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-200'
                                  : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300'
                              }`}
                            >
                              <Server className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="truncate text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                                  {target.name}
                                </div>
                                {target.isBuiltIn ? (
                                  <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-200">
                                    {t('agentMarket.labels.builtIn')}
                                  </span>
                                ) : null}
                                {isInstalled ? (
                                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                                    {t('agentMarket.labels.installed')}
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                {t('agentMarket.labels.instanceStatus', {
                                  type: target.typeLabel,
                                  host: target.host,
                                  status: t(`agentMarket.status.${target.status}`),
                                })}
                              </div>
                              <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                                {t('agentMarket.labels.instanceAgentCount', {
                                  count: target.agentCount,
                                })}
                              </div>
                            </div>
                            {isSelected ? (
                              <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary-600 dark:text-primary-300" />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {selectedTarget ? (
                    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                      <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        <Sparkles className="h-4 w-4 text-primary-600 dark:text-primary-300" />
                        {t('agentMarket.modal.instanceSummaryTitle')}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedTarget.installedAgentIds.map((agentId) => (
                          <span
                            key={agentId}
                            className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                          >
                            {agentId}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {mutationErrorMessage ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
                      {mutationErrorMessage}
                    </div>
                  ) : null}

                  {followUpError ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                      {followUpError}
                    </div>
                  ) : null}

                  <Button
                    className="h-12 w-full"
                    disabled={
                      installMutation.isPending
                      || !effectiveSelectedTargetId
                      || selectedTemplateAlreadyInstalled
                    }
                    onClick={() => {
                      const installTarget = modalTargets.find(
                        (target) => target.id === effectiveSelectedTargetId,
                      ) || null;
                      if (!selectedTemplate || !effectiveSelectedTargetId || !installTarget) {
                        return;
                      }

                      setFollowUpError(null);
                      installMutation.mutate(
                        {
                          instanceId: effectiveSelectedTargetId,
                          templateId: selectedTemplate.id,
                        },
                        {
                          onSuccess: async () => {
                            const followUpResult =
                              normalizeChatAgentCreationFollowUpResult(
                                await onInstalled({
                                  instanceId: effectiveSelectedTargetId,
                                  kernelId: installTarget.kernelId,
                                  agentId: selectedTemplate.id,
                                  displayName: selectedTemplate.name,
                                }),
                              );

                            if (followUpResult.status === 'activationFailed') {
                              setFollowUpError(
                                followUpResult.errorMessage
                                || t('chat.sidebar.agentActivationFailed', {
                                  agent: selectedTemplate.name,
                                }),
                              );
                              await refetch().catch(() => null);
                              return;
                            }

                            onOpenChange(false);
                          },
                        },
                      );
                    }}
                  >
                    {selectedTemplateAlreadyInstalled ? (
                      t('agentMarket.actions.installed')
                    ) : installMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('agentMarket.actions.installing')}
                      </>
                    ) : (
                      t('agentMarket.actions.installToInstance')
                    )}
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="flex h-full min-h-[24rem] flex-col items-center justify-center rounded-[1.25rem] border border-dashed border-zinc-200/80 px-6 text-center dark:border-zinc-800/80">
              <Sparkles className="mb-3 h-8 w-8 text-zinc-300 dark:text-zinc-700" />
              <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                {t('agentMarket.empty.searchTitle')}
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                {t('agentMarket.empty.searchDescription')}
              </p>
            </div>
          )}
        </div>
      </div>
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
