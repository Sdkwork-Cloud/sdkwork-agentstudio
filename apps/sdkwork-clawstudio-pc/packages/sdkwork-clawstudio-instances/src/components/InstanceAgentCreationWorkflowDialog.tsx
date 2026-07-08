import React, { startTransition, useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  AgentInstallTarget,
  AgentMarketTemplate,
  CreateKernelAgentResult,
  KernelAgentLibraryItem,
} from '@sdkwork/clawstudio-core';
import {
  AGENT_MARKET_TEMPLATES,
  agentInstallService,
  createAgentMarketCatalog,
  kernelAgentLibraryService,
  kernelOwnedAgentLibraryService,
} from '@sdkwork/clawstudio-core';
import {
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronLeft,
  CopyPlus,
  Loader2,
  Search,
  Server,
  Sparkles,
} from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  TaskStudioTabs,
  cn,
} from '@sdkwork/clawstudio-ui';
import {
  createOpenClawAgentCreateDialogState,
  createOpenClawAgentFormStateFromLibraryAgent,
  type OpenClawAgentFormState,
} from '../services/index.ts';
import {
  type AgentDialogFieldKey,
  OpenClawAgentEditorForm,
} from './OpenClawAgentEditorForm.tsx';

type AgentModelOption = {
  value: string;
  label: string;
};

type WorkflowView = 'menu' | 'library' | 'copy' | 'form' | 'market';
type WorkflowFormOrigin = 'custom' | 'library' | 'copy' | null;

interface TemplateCollectionState {
  agents: KernelAgentLibraryItem[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  selectedKey: string | null;
}

const EMPTY_TEMPLATE_COLLECTION_STATE: TemplateCollectionState = {
  agents: [],
  isLoading: false,
  error: null,
  searchQuery: '',
  selectedKey: null,
};

const CREATION_WORKFLOW_KEY_PREFIX =
  'instances.detail.instanceWorkbench.agents.creationWorkflow.';

function workflowKey(suffix: string) {
  return `${CREATION_WORKFLOW_KEY_PREFIX}${suffix}`;
}

export interface InstanceAgentCreationWorkflowDialogProps {
  open: boolean;
  instanceId: string | undefined;
  instanceName: string;
  instanceKernelId: string;
  draft: OpenClawAgentFormState;
  availableAgentModelOptions: AgentModelOption[];
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onDraftFieldChange: (field: AgentDialogFieldKey, value: string) => void;
  onDraftDefaultChange: (checked: boolean) => void;
  onDraftStreamingModeChange: (mode: OpenClawAgentFormState['streamingMode']) => void;
  onDraftReplace: (draft: OpenClawAgentFormState) => void;
  onSubmitCreate: () => Promise<void> | void;
  onCreated: (result: CreateKernelAgentResult) => Promise<void> | void;
}

function resolveTemplateKey(agent: KernelAgentLibraryItem) {
  return `${agent.sourceInstanceId}:${agent.sourceKernelId}:${agent.agentId}`;
}

function resolveWorkflowKernelLabel(kernelId: string) {
  const normalizedKernelId = kernelId.trim().toLowerCase();
  if (normalizedKernelId === 'openclaw') {
    return 'OpenClaw';
  }
  if (normalizedKernelId === 'hermes') {
    return 'Hermes';
  }

  return kernelId || 'Kernel';
}

function resolveStreamingLabel(
  agent: KernelAgentLibraryItem,
  translate: (key: string, options?: Record<string, unknown>) => string,
) {
  if (agent.params.streaming === true) {
    return translate(workflowKey('streamingModes.enabled'));
  }

  if (agent.params.streaming === false) {
    return translate(workflowKey('streamingModes.disabled'));
  }

  return translate(workflowKey('streamingModes.inherit'));
}

function resolveParameterLabel(
  value: number | null,
  translate: (key: string, options?: Record<string, unknown>) => string,
) {
  return value === null ? translate(workflowKey('notSet')) : String(value);
}

function filterTemplateAgents(agents: KernelAgentLibraryItem[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return agents;
  }

  return agents.filter((agent) =>
    [
      agent.displayName,
      agent.description,
      agent.agentId,
      agent.sourceInstanceName,
      agent.sourceKernelId,
      agent.model.primary ?? '',
      ...agent.model.fallbacks,
    ].some((value) => value.toLowerCase().includes(normalizedQuery)),
  );
}

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

function resolveSelectedTemplateId(
  templates: AgentMarketTemplate[],
  selectedTemplateId: string | null,
) {
  if (selectedTemplateId && templates.some((template) => template.id === selectedTemplateId)) {
    return selectedTemplateId;
  }

  return templates[0]?.id ?? null;
}

function renderCollectionStatusMessage(input: {
  t: (key: string, options?: Record<string, unknown>) => string;
  isLoading: boolean;
  error: string | null;
  hasResults: boolean;
}) {
  if (input.isLoading) {
    return (
      <div className="flex min-h-[26rem] items-center justify-center rounded-[1.5rem] border border-dashed border-zinc-200/80 bg-zinc-50/80 px-6 py-8 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
        <Loader2 className="mr-3 h-4 w-4 animate-spin" />
        {input.t(workflowKey('status.loading'))}
      </div>
    );
  }

  if (input.error) {
    return (
      <div className="space-y-3 rounded-[1.5rem] border border-red-200 bg-red-50/90 px-5 py-5 dark:border-red-900/60 dark:bg-red-950/30">
        <p className="text-sm font-medium text-red-700 dark:text-red-200">{input.error}</p>
      </div>
    );
  }

  if (!input.hasResults) {
    return (
      <div className="flex min-h-[26rem] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-zinc-200/80 bg-zinc-50/80 px-6 py-8 text-center dark:border-zinc-800 dark:bg-zinc-950/40">
        <Sparkles className="mb-3 h-8 w-8 text-zinc-300 dark:text-zinc-700" />
        <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
          {input.t(workflowKey('status.emptyTitle'))}
        </p>
        <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500 dark:text-zinc-400">
          {input.t(workflowKey('status.emptyDescription'))}
        </p>
      </div>
    );
  }

  return null;
}

export function InstanceAgentCreationWorkflowDialog({
  open,
  instanceId,
  instanceName,
  instanceKernelId,
  draft,
  availableAgentModelOptions,
  isSaving,
  onOpenChange,
  onDraftFieldChange,
  onDraftDefaultChange,
  onDraftStreamingModeChange,
  onDraftReplace,
  onSubmitCreate,
  onCreated,
}: InstanceAgentCreationWorkflowDialogProps) {
  const { t, i18n } = useTranslation();
  const [view, setView] = useState<WorkflowView>('menu');
  const [formOrigin, setFormOrigin] = useState<WorkflowFormOrigin>(null);
  const [sourceAgent, setSourceAgent] = useState<KernelAgentLibraryItem | null>(null);
  const [libraryState, setLibraryState] = useState<TemplateCollectionState>(
    EMPTY_TEMPLATE_COLLECTION_STATE,
  );
  const [libraryReloadRevision, setLibraryReloadRevision] = useState(0);
  const [ownedState, setOwnedState] = useState<TemplateCollectionState>(
    EMPTY_TEMPLATE_COLLECTION_STATE,
  );
  const [ownedReloadRevision, setOwnedReloadRevision] = useState(0);
  const [marketSearchQuery, setMarketSearchQuery] = useState('');
  const [marketCategory, setMarketCategory] = useState('All');
  const [marketTargets, setMarketTargets] = useState<AgentInstallTarget[]>([]);
  const [isMarketLoading, setIsMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [selectedMarketTemplateId, setSelectedMarketTemplateId] = useState<string | null>(null);
  const [marketInstallError, setMarketInstallError] = useState<string | null>(null);
  const [isInstallingTemplate, setIsInstallingTemplate] = useState(false);
  const deferredMarketSearchQuery = useDeferredValue(marketSearchQuery);
  const collectionLoadFailedLabel = t(workflowKey('status.loadFailed'));
  const marketLoadingLabel = t(workflowKey('market.status.loading'));

  React.useEffect(() => {
    if (!open) {
      setView('menu');
      setFormOrigin(null);
      setSourceAgent(null);
      setLibraryState(EMPTY_TEMPLATE_COLLECTION_STATE);
      setLibraryReloadRevision(0);
      setOwnedState(EMPTY_TEMPLATE_COLLECTION_STATE);
      setOwnedReloadRevision(0);
      setMarketSearchQuery('');
      setMarketCategory('All');
      setMarketTargets([]);
      setIsMarketLoading(false);
      setMarketError(null);
      setSelectedMarketTemplateId(null);
      setMarketInstallError(null);
      setIsInstallingTemplate(false);
    }
  }, [open]);

  React.useEffect(() => {
    if (!open || view !== 'library') {
      return;
    }

    let cancelled = false;
    setLibraryState((current) => ({
      ...current,
      isLoading: true,
      error: null,
    }));

    void kernelAgentLibraryService
      .listAgents()
      .then((agents) => {
        if (cancelled) {
          return;
        }

        setLibraryState((current) => ({
          ...current,
          agents,
          isLoading: false,
          error: null,
        }));
      })
      .catch((error: any) => {
        if (cancelled) {
          return;
        }

        setLibraryState((current) => ({
          ...current,
          agents: [],
          isLoading: false,
          error: error?.message || collectionLoadFailedLabel,
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [collectionLoadFailedLabel, libraryReloadRevision, open, view]);

  React.useEffect(() => {
    if (!open || view !== 'copy' || !instanceId) {
      return;
    }

    let cancelled = false;
    setOwnedState((current) => ({
      ...current,
      isLoading: true,
      error: null,
    }));

    void kernelOwnedAgentLibraryService
      .listAgents(instanceId)
      .then((agents) => {
        if (cancelled) {
          return;
        }

        setOwnedState((current) => ({
          ...current,
          agents,
          isLoading: false,
          error: null,
        }));
      })
      .catch((error: any) => {
        if (cancelled) {
          return;
        }

        setOwnedState((current) => ({
          ...current,
          agents: [],
          isLoading: false,
          error: error?.message || collectionLoadFailedLabel,
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [collectionLoadFailedLabel, instanceId, open, ownedReloadRevision, view]);

  React.useEffect(() => {
    if (!open || view !== 'market' || !instanceId) {
      return;
    }

    let cancelled = false;
    setIsMarketLoading(true);
    setMarketError(null);

    void agentInstallService
      .listInstallTargets()
      .then((targets) => {
        if (cancelled) {
          return;
        }

        setMarketTargets(targets.filter((target) => target.id === instanceId));
      })
      .catch((error: any) => {
        if (cancelled) {
          return;
        }

        setMarketTargets([]);
        setMarketError(error?.message || t('agentMarket.error.description'));
      })
      .finally(() => {
        if (!cancelled) {
          setIsMarketLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [instanceId, open, t, view]);

  const currentMarketTarget =
    marketTargets.find((target) => target.id === instanceId) ?? null;
  const libraryAgents = useMemo(
    () => filterTemplateAgents(libraryState.agents, libraryState.searchQuery),
    [libraryState.agents, libraryState.searchQuery],
  );
  const ownedAgents = useMemo(
    () => filterTemplateAgents(ownedState.agents, ownedState.searchQuery),
    [ownedState.agents, ownedState.searchQuery],
  );
  const selectedLibraryAgent = useMemo(() => {
    const effectiveKey =
      libraryState.selectedKey
      && libraryAgents.some((agent) => resolveTemplateKey(agent) === libraryState.selectedKey)
        ? libraryState.selectedKey
        : libraryAgents[0]
          ? resolveTemplateKey(libraryAgents[0])
          : null;

    return (
      libraryAgents.find((agent) => resolveTemplateKey(agent) === effectiveKey) ?? null
    );
  }, [libraryAgents, libraryState.selectedKey]);
  const selectedOwnedAgent = useMemo(() => {
    const effectiveKey =
      ownedState.selectedKey
      && ownedAgents.some((agent) => resolveTemplateKey(agent) === ownedState.selectedKey)
        ? ownedState.selectedKey
        : ownedAgents[0]
          ? resolveTemplateKey(ownedAgents[0])
          : null;

    return ownedAgents.find((agent) => resolveTemplateKey(agent) === effectiveKey) ?? null;
  }, [ownedAgents, ownedState.selectedKey]);
  const marketCatalog = useMemo(
    () =>
      createAgentMarketCatalog({
        templates: AGENT_MARKET_TEMPLATES,
        keyword: deferredMarketSearchQuery,
        activeCategory: marketCategory,
        searchValueResolver: (template) => buildTemplateSearchValues(template, t),
      }),
    [deferredMarketSearchQuery, i18n.resolvedLanguage, marketCategory, t],
  );
  const effectiveSelectedMarketTemplateId = useMemo(
    () =>
      resolveSelectedTemplateId(marketCatalog.templates, selectedMarketTemplateId),
    [marketCatalog.templates, selectedMarketTemplateId],
  );
  const selectedMarketTemplate = useMemo(
    () =>
      marketCatalog.templates.find((template) => template.id === effectiveSelectedMarketTemplateId)
      || AGENT_MARKET_TEMPLATES.find(
        (template) => template.id === effectiveSelectedMarketTemplateId,
      )
      || null,
    [effectiveSelectedMarketTemplateId, marketCatalog.templates],
  );
  const localizedSelectedMarketTemplate = selectedMarketTemplate
    ? localizeTemplate(selectedMarketTemplate, t)
    : null;
  const selectedTemplateAlreadyInstalled = Boolean(
    selectedMarketTemplate
    && currentMarketTarget?.installedTemplateIds.includes(selectedMarketTemplate.id),
  );

  const openCustomCreate = () => {
    onDraftReplace(createOpenClawAgentCreateDialogState().draft);
    setSourceAgent(null);
    setFormOrigin('custom');
    setView('form');
  };

  const handleUseTemplate = (agent: KernelAgentLibraryItem, origin: WorkflowFormOrigin) => {
    onDraftReplace(createOpenClawAgentFormStateFromLibraryAgent(agent));
    setSourceAgent(agent);
    setFormOrigin(origin);
    setView('form');
  };

  const handleBack = () => {
    if (view === 'form' && formOrigin === 'library') {
      setView('library');
      return;
    }

    if (view === 'form' && formOrigin === 'copy') {
      setView('copy');
      return;
    }

    setView('menu');
  };

  const categoryTabs = useMemo(
    () =>
      marketCatalog.categories.map((category) => ({
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
    [marketCatalog.categories, t],
  );

  const renderTemplatePicker = (input: {
    title: string;
    description: string;
    state: TemplateCollectionState;
    filteredAgents: KernelAgentLibraryItem[];
    selectedAgent: KernelAgentLibraryItem | null;
    onSearchQueryChange: (value: string) => void;
    onSelectedKeyChange: (value: string) => void;
    onRetry: () => void;
    onConfirm: () => void;
  }) => {
    const statusContent = renderCollectionStatusMessage({
      t,
      isLoading: input.state.isLoading,
      error: input.state.error,
      hasResults: input.filteredAgents.length > 0,
    });

    return (
      <>
        <DialogHeader>
          <div className="flex items-start gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="mt-0.5 h-9 px-2 text-zinc-500 dark:text-zinc-400"
              aria-label={t(workflowKey('actions.back'))}
              title={t(workflowKey('actions.back'))}
            >
              <ChevronLeft className="h-4 w-4" />
              <span>{t(workflowKey('actions.back'))}</span>
            </Button>
            <div className="min-w-0 space-y-1.5">
              <DialogTitle>{input.title}</DialogTitle>
              <DialogDescription>{input.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-4 py-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.9fr)]">
          <div className="min-w-0 space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
              <Input
                type="search"
                value={input.state.searchQuery}
                onChange={(event) => input.onSearchQueryChange(event.target.value)}
                placeholder={t(workflowKey('searchPlaceholder'))}
                className="h-11 rounded-2xl border-zinc-200/80 bg-white pl-10 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
              />
            </div>

            {statusContent ? (
              <>
                {statusContent}
                {input.state.error ? (
                  <Button variant="outline" onClick={input.onRetry}>
                    {t(workflowKey('actions.retry'))}
                  </Button>
                ) : null}
              </>
            ) : (
              <div className="max-h-[32rem] overflow-y-auto rounded-[1.5rem] border border-zinc-200/80 bg-white/95 p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/80">
                <div className="space-y-1.5">
                  {input.filteredAgents.map((agent) => {
                    const agentKey = resolveTemplateKey(agent);
                    const isSelected =
                      input.selectedAgent && resolveTemplateKey(input.selectedAgent) === agentKey;

                    return (
                      <button
                        key={agentKey}
                        type="button"
                        onClick={() => input.onSelectedKeyChange(agentKey)}
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
                              {resolveWorkflowKernelLabel(agent.sourceKernelId)}
                            </span>
                            {agent.isDefault ? (
                              <span className="shrink-0 rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-primary-700 dark:bg-primary-500/20 dark:text-primary-100">
                                {t(workflowKey('badges.default'))}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 truncate text-[12px] leading-5 text-zinc-500 dark:text-zinc-400">
                            {agent.description}
                          </p>
                          <div className="mt-2 flex min-w-0 items-center gap-2 text-[11px] text-zinc-400 dark:text-zinc-500">
                            <Server className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{agent.sourceInstanceName}</span>
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
            {input.selectedAgent ? (
              <div className="space-y-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem] bg-white text-base font-semibold text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100">
                    {input.selectedAgent.avatar || 'AI'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <h3 className="truncate text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                        {input.selectedAgent.displayName}
                      </h3>
                      <span className="rounded-full border border-zinc-200/80 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                        {resolveWorkflowKernelLabel(input.selectedAgent.sourceKernelId)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                      {input.selectedAgent.description}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200/80 bg-white/90 p-4 dark:border-zinc-800 dark:bg-zinc-950/80">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
                    {t(workflowKey('sections.source'))}
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-zinc-400 dark:text-zinc-500">
                        {t(workflowKey('labels.sourceAgent'))}
                      </span>
                      <span className="truncate font-medium">{input.selectedAgent.agentId}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-zinc-400 dark:text-zinc-500">
                        {t(workflowKey('labels.instance'))}
                      </span>
                      <span className="truncate font-medium">
                        {input.selectedAgent.sourceInstanceName}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-zinc-400 dark:text-zinc-500">
                        {t(workflowKey('labels.kernel'))}
                      </span>
                      <span className="truncate font-medium">
                        {resolveWorkflowKernelLabel(input.selectedAgent.sourceKernelId)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="rounded-2xl border border-zinc-200/80 bg-white/90 p-4 dark:border-zinc-800 dark:bg-zinc-950/80">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
                      {t(workflowKey('sections.model'))}
                    </div>
                    <div className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {input.selectedAgent.model.primary || t(workflowKey('modelInherit'))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-200/80 bg-white/90 p-4 dark:border-zinc-800 dark:bg-zinc-950/80">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
                      {t(workflowKey('sections.fallbackModels'))}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {input.selectedAgent.model.fallbacks.length > 0 ? (
                        input.selectedAgent.model.fallbacks.map((model) => (
                          <span
                            key={model}
                            className="rounded-full bg-zinc-100 px-2.5 py-1 text-[12px] text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
                          >
                            {model}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-zinc-500 dark:text-zinc-400">
                          {t(workflowKey('notSet'))}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-200/80 bg-white/90 p-4 dark:border-zinc-800 dark:bg-zinc-950/80">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
                      {t(workflowKey('sections.parameters'))}
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-zinc-400 dark:text-zinc-500">
                          {t(workflowKey('labels.temperature'))}
                        </span>
                        <span>{resolveParameterLabel(input.selectedAgent.params.temperature, t)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-zinc-400 dark:text-zinc-500">
                          {t(workflowKey('labels.topP'))}
                        </span>
                        <span>{resolveParameterLabel(input.selectedAgent.params.topP, t)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-zinc-400 dark:text-zinc-500">
                          {t(workflowKey('labels.maxTokens'))}
                        </span>
                        <span>{resolveParameterLabel(input.selectedAgent.params.maxTokens, t)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-zinc-400 dark:text-zinc-500">
                          {t(workflowKey('labels.timeoutMs'))}
                        </span>
                        <span>{resolveParameterLabel(input.selectedAgent.params.timeoutMs, t)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-zinc-400 dark:text-zinc-500">
                          {t(workflowKey('labels.streaming'))}
                        </span>
                        <span>{resolveStreamingLabel(input.selectedAgent, t)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[26rem] flex-col items-center justify-center rounded-[1.25rem] border border-dashed border-zinc-200/80 px-6 text-center dark:border-zinc-800/80">
                <Bot className="mb-3 h-8 w-8 text-zinc-300 dark:text-zinc-700" />
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                  {t(workflowKey('status.emptyTitle'))}
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  {t(workflowKey('status.emptyDescription'))}
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button disabled={!input.selectedAgent || input.state.isLoading} onClick={input.onConfirm}>
            <CopyPlus className="mr-2 h-4 w-4" />
            {t(workflowKey('actions.useTemplate'))}
          </Button>
        </DialogFooter>
      </>
    );
  };

  const renderFormView = () => {
    const title =
      formOrigin === 'copy' ? t(workflowKey('form.copyTitle')) : t(workflowKey('form.title'));
    const description =
      formOrigin === 'copy' || formOrigin === 'library'
        ? t(workflowKey('form.copyDescription'))
        : t(workflowKey('form.description'));
    const submitLabel =
      formOrigin === 'copy' || formOrigin === 'library'
        ? t(workflowKey('actions.createCopy'))
        : t(workflowKey('actions.create'));

    return (
      <>
        <DialogHeader>
          <div className="flex items-start gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="mt-0.5 h-9 px-2 text-zinc-500 dark:text-zinc-400"
              aria-label={t(workflowKey('actions.back'))}
              title={t(workflowKey('actions.back'))}
            >
              <ChevronLeft className="h-4 w-4" />
              <span>{t(workflowKey('actions.back'))}</span>
            </Button>
            <div className="min-w-0 space-y-1.5">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-200/80 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/60">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
              {t(workflowKey('labels.instance'))}
            </span>
            <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100">
              {instanceName}
            </span>
            <span className="text-zinc-300 dark:text-zinc-700">/</span>
            <span className="rounded-full border border-zinc-200/80 px-3 py-1 text-sm font-semibold text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
              {resolveWorkflowKernelLabel(instanceKernelId)}
            </span>
          </div>

          <OpenClawAgentEditorForm
            draft={draft}
            availableAgentModelOptions={availableAgentModelOptions}
            onFieldChange={onDraftFieldChange}
            onDefaultChange={onDraftDefaultChange}
            onStreamingModeChange={onDraftStreamingModeChange}
            sourceAgent={sourceAgent}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void onSubmitCreate()} disabled={isSaving || !instanceId}>
            {isSaving ? t('common.loading') : submitLabel}
          </Button>
        </DialogFooter>
      </>
    );
  };

  const renderMarketView = () => {
    return (
      <>
        <DialogHeader>
          <div className="flex items-start gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="mt-0.5 h-9 px-2 text-zinc-500 dark:text-zinc-400"
              aria-label={t(workflowKey('actions.back'))}
              title={t(workflowKey('actions.back'))}
            >
              <ChevronLeft className="h-4 w-4" />
              <span>{t(workflowKey('actions.back'))}</span>
            </Button>
            <div className="min-w-0 space-y-1.5">
              <DialogTitle>{t(workflowKey('market.title'))}</DialogTitle>
              <DialogDescription>
                {t(workflowKey('market.description'))}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-4 py-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.9fr)]">
          <div className="min-w-0 space-y-4">
            <div className="flex flex-col gap-3">
              <div className="w-fit max-w-full min-w-0 overflow-x-auto">
                <TaskStudioTabs
                  activeTab={marketCategory}
                  tabs={categoryTabs}
                  onChange={(tabId) => {
                    startTransition(() => {
                      setMarketCategory(tabId);
                    });
                  }}
                />
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  type="search"
                  value={marketSearchQuery}
                  placeholder={t('agentMarket.searchPlaceholder')}
                  onChange={(event) => setMarketSearchQuery(event.target.value)}
                  className="h-11 rounded-[16px] border-zinc-200/80 bg-white pl-11 pr-4 text-sm shadow-none focus-visible:border-primary-300 focus-visible:bg-white focus-visible:ring-0 dark:border-zinc-800 dark:bg-zinc-900 dark:focus-visible:border-primary-500/30"
                />
              </div>
            </div>

            {marketCatalog.templates.length > 0 ? (
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(17rem,1fr))]">
                {marketCatalog.templates.map((template) => {
                  const localizedTemplate = localizeTemplate(template, t);
                  const isSelected = template.id === effectiveSelectedMarketTemplateId;
                  const installCount = currentMarketTarget?.installedTemplateIds.includes(template.id)
                    ? 1
                    : 0;

                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setSelectedMarketTemplateId(template.id)}
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
                                {t('agentMarket.labels.installed')}
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
            {selectedMarketTemplate ? (
              <div className="space-y-5">
                <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl ring-1 ring-zinc-200 dark:bg-zinc-950 dark:ring-zinc-800">
                      {selectedMarketTemplate.emoji}
                    </div>
                    <div className="min-w-0">
                      {localizedSelectedMarketTemplate ? (
                        <>
                          <h4 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                            {localizedSelectedMarketTemplate.name}
                          </h4>
                          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                            {localizedSelectedMarketTemplate.summary}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                            {localizedSelectedMarketTemplate.description}
                          </p>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>

                {isMarketLoading ? (
                  <div className="flex min-h-[18rem] items-center justify-center rounded-[1.5rem] border border-dashed border-zinc-200/80 bg-zinc-50/80 px-6 py-8 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
                    <Loader2 className="mr-3 h-4 w-4 animate-spin" />
                    {marketLoadingLabel}
                  </div>
                ) : marketError ? (
                  <div className="space-y-3 rounded-[1.5rem] border border-red-200 bg-red-50/90 px-5 py-5 dark:border-red-900/60 dark:bg-red-950/30">
                    <p className="text-sm font-medium text-red-700 dark:text-red-200">
                      {marketError}
                    </p>
                  </div>
                ) : !currentMarketTarget ? (
                  <div className="space-y-3 rounded-[1.5rem] border border-dashed border-zinc-200/80 bg-zinc-50/80 px-6 py-8 text-center dark:border-zinc-800 dark:bg-zinc-950/40">
                    <Sparkles className="mx-auto h-8 w-8 text-zinc-300 dark:text-zinc-700" />
                    <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                      {t('agentMarket.empty.noTargetsTitle')}
                    </p>
                    <p className="text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                      {t('agentMarket.empty.noTargetsDescription')}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                      <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        <Server className="h-4 w-4 text-primary-600 dark:text-primary-300" />
                        {t('agentMarket.modal.instanceSummaryTitle')}
                      </div>
                      <div className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-zinc-400 dark:text-zinc-500">
                            {t(workflowKey('labels.instance'))}
                          </span>
                          <span className="truncate font-medium">{instanceName}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-zinc-400 dark:text-zinc-500">
                            {t(workflowKey('labels.kernel'))}
                          </span>
                          <span className="truncate font-medium">
                            {resolveWorkflowKernelLabel(currentMarketTarget.kernelId)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-zinc-400 dark:text-zinc-500">
                            {t('agentMarket.modal.targetLabel')}
                          </span>
                          <span className="truncate font-medium">{currentMarketTarget.host}</span>
                        </div>
                      </div>
                      {currentMarketTarget.installedAgentIds.length > 0 ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {currentMarketTarget.installedAgentIds.map((agentId) => (
                            <span
                              key={agentId}
                              className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                            >
                              {agentId}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    {marketInstallError ? (
                      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
                        {marketInstallError}
                      </div>
                    ) : null}

                    <Button
                      className="h-12 w-full"
                      disabled={
                        isInstallingTemplate
                        || !instanceId
                        || selectedTemplateAlreadyInstalled
                        || !currentMarketTarget
                      }
                      onClick={() => {
                        if (!instanceId || !selectedMarketTemplate || !currentMarketTarget) {
                          return;
                        }

                        setMarketInstallError(null);
                        setIsInstallingTemplate(true);
                        void agentInstallService
                          .installTemplate({
                            instanceId,
                            templateId: selectedMarketTemplate.id,
                          })
                          .then(async () => {
                            await onCreated({
                              instanceId,
                              kernelId: currentMarketTarget.kernelId,
                              agentId: selectedMarketTemplate.id,
                              displayName: selectedMarketTemplate.name,
                            });
                            onOpenChange(false);
                          })
                          .catch((error: any) => {
                            setMarketInstallError(
                              error?.message || t('agentMarket.error.description'),
                            );
                          })
                          .finally(() => {
                            setIsInstallingTemplate(false);
                          });
                      }}
                    >
                      {selectedTemplateAlreadyInstalled ? (
                        t('agentMarket.actions.installed')
                      ) : isInstallingTemplate ? (
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
  };

  const content =
    view === 'library'
      ? renderTemplatePicker({
          title: t(workflowKey('library.title')),
          description: t(workflowKey('library.description')),
          state: libraryState,
          filteredAgents: libraryAgents,
          selectedAgent: selectedLibraryAgent,
          onSearchQueryChange: (value) =>
            setLibraryState((current) => ({
              ...current,
              searchQuery: value,
            })),
          onSelectedKeyChange: (value) =>
            setLibraryState((current) => ({
              ...current,
              selectedKey: value,
            })),
          onRetry: () => setLibraryReloadRevision((current) => current + 1),
          onConfirm: () => {
            if (!selectedLibraryAgent) {
              return;
            }

            handleUseTemplate(selectedLibraryAgent, 'library');
          },
        })
      : view === 'copy'
        ? renderTemplatePicker({
            title: t(workflowKey('copy.title')),
            description: t(workflowKey('copy.description')),
            state: ownedState,
            filteredAgents: ownedAgents,
            selectedAgent: selectedOwnedAgent,
            onSearchQueryChange: (value) =>
              setOwnedState((current) => ({
                ...current,
                searchQuery: value,
              })),
            onSelectedKeyChange: (value) =>
              setOwnedState((current) => ({
                ...current,
                selectedKey: value,
              })),
            onRetry: () => setOwnedReloadRevision((current) => current + 1),
            onConfirm: () => {
              if (!selectedOwnedAgent) {
                return;
              }

              handleUseTemplate(selectedOwnedAgent, 'copy');
            },
          })
        : view === 'form'
          ? renderFormView()
          : view === 'market'
            ? renderMarketView()
            : (
              <>
                <DialogHeader>
                  <DialogTitle>{t(workflowKey('menu.title'))}</DialogTitle>
                  <DialogDescription>
                    {t(workflowKey('menu.description'))}
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-3 py-2 md:grid-cols-2">
                  {[
                    {
                      id: 'custom',
                      title: t(workflowKey('menu.options.custom.title')),
                      description: t(workflowKey('menu.options.custom.description')),
                      icon: Sparkles,
                      onClick: openCustomCreate,
                    },
                    {
                      id: 'library',
                      title: t(workflowKey('menu.options.library.title')),
                      description: t(workflowKey('menu.options.library.description')),
                      icon: Bot,
                      onClick: () => setView('library'),
                    },
                    {
                      id: 'copy',
                      title: t(workflowKey('menu.options.copy.title')),
                      description: t(workflowKey('menu.options.copy.description')),
                      icon: CopyPlus,
                      onClick: () => setView('copy'),
                    },
                    {
                      id: 'market',
                      title: t(workflowKey('menu.options.market.title')),
                      description: t(workflowKey('menu.options.market.description')),
                      icon: BriefcaseBusiness,
                      onClick: () => setView('market'),
                    },
                  ].map((entry) => {
                    const Icon = entry.icon;

                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={entry.onClick}
                        className="rounded-[1.35rem] border border-zinc-200/80 bg-white/90 p-5 text-left shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/80 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                              {entry.title}
                            </div>
                            <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                              {entry.description}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    {t('common.cancel')}
                  </Button>
                </DialogFooter>
              </>
            );

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if ((isSaving || isInstallingTemplate) && !nextOpen) {
          return;
        }

        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="left-1/2 top-1/2 w-[min(72rem,calc(100vw-2rem))] max-w-none translate-x-[-50%] translate-y-[-50%]">
        {content}
      </DialogContent>
    </Dialog>
  );
}
