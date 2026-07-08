import React, { startTransition, useDeferredValue, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Search,
  Server,
  Sparkles,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Input, Modal, TaskStudioTabs } from '@sdkwork/clawstudio-ui';
import {
  AGENT_MARKET_TEMPLATES,
  agentInstallService,
  createAgentMarketCatalog,
  type AgentInstallTarget,
  type AgentMarketTemplate,
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
      }),
    ),
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

function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-[20px] border border-dashed border-zinc-300 bg-white/85 px-6 py-14 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[18px] bg-white text-zinc-500 ring-1 ring-zinc-200 dark:bg-zinc-950 dark:text-zinc-300 dark:ring-zinc-800">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        {description}
      </p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 inline-flex h-11 items-center justify-center rounded-xl border border-primary-600 bg-primary-600 px-4 text-sm font-medium text-white dark:border-primary-500 dark:bg-primary-500"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function TemplateCard({
  template,
  installCount,
  disabled,
  onInstall,
  categoryLabel,
  localizedTemplate,
  actionLabel,
  installCountLabel,
}: {
  template: AgentMarketTemplate;
  installCount: number;
  disabled: boolean;
  onInstall: () => void;
  categoryLabel: string;
  localizedTemplate: ReturnType<typeof localizeTemplate>;
  actionLabel: string;
  installCountLabel: string;
}) {
  return (
    <article className="flex h-full flex-col rounded-[20px] border border-zinc-200/80 bg-white/90 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/85">
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-zinc-100 text-2xl dark:bg-zinc-950">
          {template.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {localizedTemplate.name}
            </h3>
            <span className="rounded-full border border-primary-200 bg-primary-50 px-2.5 py-1 text-[11px] font-semibold text-primary-700 dark:border-primary-500/20 dark:bg-primary-500/10 dark:text-primary-200">
              {categoryLabel}
            </span>
            {installCount > 0 ? (
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {installCountLabel}
              </span>
            ) : null}
          </div>
          <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            {localizedTemplate.summary}
          </p>
          <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            {localizedTemplate.description}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {localizedTemplate.capabilities.map((capability) => (
          <span
            key={`${template.id}-${capability}`}
            className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
          >
            {capability}
          </span>
        ))}
      </div>

      <div className="mt-5 border-t border-zinc-200/80 pt-4 dark:border-zinc-800">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">{localizedTemplate.focus}</div>
        <button
          type="button"
          disabled={disabled}
          onClick={onInstall}
          className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl border border-primary-600 bg-primary-600 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-primary-500 dark:bg-primary-500"
        >
          {actionLabel}
        </button>
      </div>
    </article>
  );
}

function InstancePicker({
  targets,
  selectedTargetId,
  onSelect,
  selectedTemplateId,
  statusLabel,
  installedLabel,
  installedBadgeLabel,
  builtInBadgeLabel,
}: {
  targets: AgentInstallTarget[];
  selectedTargetId: string;
  onSelect: (targetId: string) => void;
  selectedTemplateId: string;
  statusLabel: (target: AgentInstallTarget) => string;
  installedLabel: (count: number) => string;
  installedBadgeLabel: string;
  builtInBadgeLabel: string;
}) {
  return (
    <div className="space-y-2">
      {targets.map((target) => {
        const isSelected = target.id === selectedTargetId;
        const isInstalled = target.installedTemplateIds.includes(selectedTemplateId);
        return (
          <button
            key={target.id}
            type="button"
            onClick={() => onSelect(target.id)}
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
                    {builtInBadgeLabel}
                  </span>
                ) : null}
                {isInstalled ? (
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {installedBadgeLabel}
                  </span>
                ) : null}
              </div>
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {statusLabel(target)}
              </div>
              <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                {installedLabel(target.agentCount)}
              </div>
            </div>
            {isSelected ? (
              <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary-600 dark:text-primary-300" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
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
    compareTargetPriority(left, right, templateId, preferredTargetId),
  );
}

function resolvePreferredTargetId(
  targets: AgentInstallTarget[],
  templateId: string,
  preferredTargetId: string,
) {
  if (targets.length === 0) {
    return '';
  }

  const preferredTarget =
    preferredTargetId ? targets.find((target) => target.id === preferredTargetId) || null : null;
  if (preferredTarget && !preferredTarget.installedTemplateIds.includes(templateId)) {
    return preferredTargetId;
  }

  return (
    targets.find((target) => !target.installedTemplateIds.includes(templateId))?.id ||
    preferredTarget?.id ||
    targets[0]?.id ||
    ''
  );
}

export function AgentMarket() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedTemplate, setSelectedTemplate] = useState<AgentMarketTemplate | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const preferredTargetId = searchParams.get('instanceId') || '';

  const {
    data: targets = [],
    error,
    isError,
    isFetched,
    isFetching,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['agent-market', 'targets'],
    queryFn: () => agentInstallService.listInstallTargets(),
    enabled: !!selectedTemplate,
    staleTime: 30_000,
  });

  const installMutation = useMutation({
    mutationFn: async (input: { instanceId: string; template: AgentMarketTemplate }) =>
      agentInstallService.installTemplate({
        instanceId: input.instanceId,
        templateId: input.template.id,
      }),
    onSuccess: (_, input) => {
      toast.success(t('agentMarket.toast.installSuccessTitle'), {
        description: t('agentMarket.toast.installSuccessDescription', {
          name: localizeTemplate(input.template, t).name,
        }),
      });
      queryClient.invalidateQueries({ queryKey: ['agent-market', 'targets'] });
      setSelectedTemplate(null);
      setSelectedTargetId('');
    },
    onError: (error: Error) => {
      toast.error(t('agentMarket.toast.installFailedTitle'), {
        description: error.message,
      });
    },
  });

  React.useEffect(() => {
    if (!selectedTemplate) {
      return;
    }

    const selectedStillExists = targets.some((target) => target.id === selectedTargetId);
    const selectedTargetSnapshot = targets.find((target) => target.id === selectedTargetId) || null;
    const hasAlternativeInstallTarget =
      !preferredTargetId &&
      targets.some((target) => !target.installedTemplateIds.includes(selectedTemplate.id));
    const selectedTargetNeedsUpgrade =
      !preferredTargetId &&
      !!selectedTargetSnapshot?.installedTemplateIds.includes(selectedTemplate.id) &&
      hasAlternativeInstallTarget;

    if (selectedStillExists && !selectedTargetNeedsUpgrade) {
      return;
    }

    setSelectedTargetId(
      resolvePreferredTargetId(targets, selectedTemplate.id, preferredTargetId),
    );
  }, [preferredTargetId, selectedTargetId, selectedTemplate, targets]);

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

  const modalTargets = useMemo(
    () =>
      selectedTemplate
        ? sortTargetsForTemplate(targets, selectedTemplate.id, preferredTargetId)
        : targets,
    [preferredTargetId, selectedTemplate, targets],
  );
  const selectedTarget = modalTargets.find((target) => target.id === selectedTargetId) || null;
  const selectedTemplateAlreadyInstalled =
    !!selectedTemplate && !!selectedTarget?.installedTemplateIds.includes(selectedTemplate.id);
  const localizedSelectedTemplate = selectedTemplate ? localizeTemplate(selectedTemplate, t) : null;
  const hasResolvedTargets = isFetched;
  const isTargetsLoading = !!selectedTemplate && !hasResolvedTargets && (isLoading || isFetching);
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

  React.useEffect(() => {
    if (!catalog.categories.includes(activeCategory)) {
      setActiveCategory('All');
    }
  }, [activeCategory, catalog.categories]);

  const handleInstall = () => {
    if (!selectedTemplate || !selectedTargetId) {
      return;
    }

    installMutation.mutate({
      instanceId: selectedTargetId,
      template: selectedTemplate,
    });
  };

  return (
    <div className="flex h-full overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="w-full space-y-4">
          <div
            className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between"
            data-slot="agent-market-topbar"
          >
            <div
              className="w-fit max-w-full min-w-0 overflow-x-auto"
              data-slot="agent-market-category-tabs"
            >
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
            <div className="relative w-full 2xl:max-w-sm">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                type="text"
                value={searchQuery}
                placeholder={t('agentMarket.searchPlaceholder')}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="h-11 rounded-[16px] border-zinc-200/80 bg-white pl-11 pr-4 text-sm shadow-none focus-visible:border-primary-300 focus-visible:bg-white focus-visible:ring-0 dark:border-zinc-800 dark:bg-zinc-900 dark:focus-visible:border-primary-500/30"
              />
            </div>
          </div>

          {selectedTemplate && isError && hasResolvedTargets ? (
            <section className="rounded-[20px] border border-amber-200 bg-amber-50/70 p-4 shadow-sm dark:border-amber-500/20 dark:bg-amber-500/10">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-white text-amber-600 ring-1 ring-amber-200 dark:bg-zinc-950 dark:text-amber-300 dark:ring-amber-500/20">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                      {t('agentMarket.error.title')}
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                      {t('agentMarket.error.description')}
                    </p>
                    {error instanceof Error ? (
                      <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                        {error.message}
                      </p>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void refetch();
                  }}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-primary-600 bg-primary-600 px-4 text-sm font-medium text-white dark:border-primary-500 dark:bg-primary-500"
                >
                  {t('agentMarket.error.retry')}
                </button>
              </div>
            </section>
          ) : null}

          <section className="w-full">
            {isLoading ? (
              <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(19rem,1fr))]">
                {Array.from({ length: 6 }, (_, index) => (
                  <div
                    key={index}
                    className="h-72 rounded-[20px] border border-zinc-200/80 bg-white/75 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70"
                  />
                ))}
              </div>
            ) : catalog.templates.length > 0 ? (
              <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(19rem,1fr))]">
                {catalog.templates.map((template) => {
                  const installCount = hasResolvedTargets
                    ? targets.filter((target) => target.installedTemplateIds.includes(template.id))
                        .length
                    : 0;
                  const localizedTemplate = localizeTemplate(template, t);
                  return (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      installCount={installCount}
                      disabled={
                        hasResolvedTargets && targets.length > 0 && installCount === targets.length
                      }
                      onInstall={() => {
                        setSelectedTemplate(template);
                        setSelectedTargetId(
                          resolvePreferredTargetId(targets, template.id, preferredTargetId),
                        );
                      }}
                      categoryLabel={t(`agentMarket.categories.${template.category}`, {
                        defaultValue: template.category,
                      })}
                      localizedTemplate={localizedTemplate}
                      actionLabel={
                        hasResolvedTargets && targets.length > 0 && installCount === targets.length
                          ? t('agentMarket.actions.installed')
                          : t('agentMarket.actions.install')
                      }
                      installCountLabel={t('agentMarket.labels.installedInCount', {
                        count: installCount,
                      })}
                    />
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={<Search className="h-6 w-6" />}
                title={t('agentMarket.empty.searchTitle')}
                description={t('agentMarket.empty.searchDescription')}
              />
            )}
          </section>
        </div>
      </div>

      <Modal
        isOpen={!!selectedTemplate}
        onClose={() => setSelectedTemplate(null)}
        title={t('agentMarket.modal.title')}
      >
        {selectedTemplate ? (
          <div className="space-y-6">
            <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl ring-1 ring-zinc-200 dark:bg-zinc-950 dark:ring-zinc-800">
                  {selectedTemplate.emoji}
                </div>
                <div>
                  {localizedSelectedTemplate ? (
                    <>
                      <h4 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                        {localizedSelectedTemplate.name}
                      </h4>
                      <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                        {localizedSelectedTemplate.summary}
                      </p>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            {isTargetsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }, (_, index) => (
                  <div
                    key={index}
                    className="h-28 rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
                  />
                ))}
              </div>
            ) : isError ? (
              <EmptyState
                icon={<AlertCircle className="h-6 w-6" />}
                title={t('agentMarket.error.title')}
                description={
                  error instanceof Error ? error.message : t('agentMarket.error.description')
                }
                actionLabel={t('agentMarket.error.retry')}
                onAction={() => {
                  void refetch();
                }}
              />
            ) : targets.length === 0 ? (
              <EmptyState
                icon={<AlertCircle className="h-6 w-6" />}
                title={t('agentMarket.empty.noTargetsTitle')}
                description={t('agentMarket.empty.noTargetsDescription')}
                actionLabel={t('common.manageInstances')}
                onAction={() => navigate('/instances')}
              />
            ) : (
              <>
                <div>
                  <div className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {t('agentMarket.modal.targetLabel')}
                  </div>
                  <InstancePicker
                    targets={modalTargets}
                    selectedTargetId={selectedTargetId}
                    onSelect={setSelectedTargetId}
                    selectedTemplateId={selectedTemplate.id}
                    installedBadgeLabel={t('agentMarket.labels.installed')}
                    builtInBadgeLabel={t('agentMarket.labels.builtIn')}
                    statusLabel={(target) =>
                      t('agentMarket.labels.instanceStatus', {
                        type: target.typeLabel,
                        host: target.host,
                        status: t(`agentMarket.status.${target.status}`),
                      })
                    }
                    installedLabel={(count) =>
                      t('agentMarket.labels.instanceAgentCount', { count })
                    }
                  />
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

                <button
                  type="button"
                  onClick={handleInstall}
                  disabled={
                    installMutation.isPending ||
                    !selectedTargetId ||
                    selectedTemplateAlreadyInstalled
                  }
                  className="flex h-12 w-full items-center justify-center rounded-xl border border-primary-600 bg-primary-600 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-primary-500 dark:bg-primary-500"
                >
                  {selectedTemplateAlreadyInstalled
                    ? t('agentMarket.actions.installed')
                    : installMutation.isPending
                      ? t('agentMarket.actions.installing')
                      : t('agentMarket.actions.installToInstance')}
                </button>
              </>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
