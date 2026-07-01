import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  Check,
  ChevronDown,
  Database,
  LoaderCircle,
  PencilLine,
  Plus,
  Rocket,
  Route,
  Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sdkwork/claw-ui';
import {
  createProviderConfigDraftFromForm,
  createProviderConfigFormState,
  listProviderConfigKnownProviderOptions,
  providerConfigCenterService,
  providerConfigCenterWorkspaceService,
  type ProviderConfigCenterActionSupport,
  type ProviderConfigCenterActionSupportItem,
  type ProviderConfigImportSource,
  type ProviderConfigRecord,
  type ProviderConfigFormState,
} from './services/index.ts';
import {
  formatLatestTestPresentation,
  formatRouteHealthLabel,
  formatRouteLatency,
  formatRouteUpdatedAt,
  formatRouteUsageSummary,
  resolveProviderRouteHealth,
  resolveRouteHealthToneClasses,
  type ProviderConfigCenterPresentationLabels,
} from './providerConfigCenterPresentation.ts';
import { listProviderConfigCenterRowActionIds } from './providerConfigCenterActionPolicy.ts';
import { ProviderConfigEditorSheet } from './ProviderConfigEditorSheet';
import { ProviderRouteHealthIndicator } from './ProviderRouteHealthIndicator';
import { ProviderRouteDetailDialog } from './ProviderRouteDetailDialog';

const CUSTOM_PROVIDER_OPTION_VALUE = '__custom__';
type ProviderConfigEditorMode = 'view' | 'edit';

const IMPORT_SOURCE_ORDER: ProviderConfigImportSource[] = [
  'codex',
  'claude-code',
  'opencode',
];
const DEFAULT_ACTION_SUPPORT: ProviderConfigCenterActionSupport = {
  quickApply: {
    available: false,
  },
  test: {
    available: false,
  },
};

function formatCompactNumber(value?: number | null) {
  if (!Number.isFinite(value ?? NaN)) {
    return '--';
  }

  const normalized = Number(value);
  if (normalized >= 1_000_000) {
    return `${(normalized / 1_000_000).toFixed(1)}M`;
  }
  if (normalized >= 1_000) {
    return `${(normalized / 1_000).toFixed(1)}k`;
  }

  return `${normalized}`;
}

function buildRouteModelSummary(record: ProviderConfigRecord, t: (key: string) => string) {
  return [
    `${record.models.length} ${t('providerCenter.table.models')}`,
    record.defaultModelId
      ? `${t('providerCenter.table.llmDefault')}: ${record.defaultModelId}`
      : null,
    record.reasoningModelId
      ? `${t('providerCenter.table.reasoning')}: ${record.reasoningModelId}`
      : null,
    record.embeddingModelId
      ? `${t('providerCenter.table.embedding')}: ${record.embeddingModelId}`
      : null,
  ].filter((value): value is string => Boolean(value));
}

function resolveActionSupportReasonLabel(
  t: (key: string) => string,
  support: ProviderConfigCenterActionSupportItem,
) {
  switch (support.reasonKey) {
    case 'runtimeUnavailable':
      return t('providerCenter.actionSupportReasons.runtimeUnavailable');
    case 'runtimeStatusUnavailable':
      return t('providerCenter.actionSupportReasons.runtimeStatusUnavailable');
    case 'quickApplyRequiresLoopback':
      return t('providerCenter.actionSupportReasons.quickApplyRequiresLoopback');
    case 'quickApplyTargetsUnavailable':
      return t('providerCenter.actionSupportReasons.quickApplyTargetsUnavailable');
    case 'quickApplyInstanceUnavailable':
      return t('providerCenter.actionSupportReasons.quickApplyInstanceUnavailable');
    default:
      return support.reason || '';
  }
}

export function ProviderConfigCenter() {
  const { t } = useTranslation();
  const presets = providerConfigCenterService.listPresets();
  const knownProviderOptions = listProviderConfigKnownProviderOptions(presets);
  const [records, setRecords] = useState<ProviderConfigRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<ProviderConfigEditorMode>('edit');
  const [editorDraft, setEditorDraft] = useState<ProviderConfigFormState>(
    createProviderConfigFormState(presets[0]?.draft),
  );
  const [providerSearchQuery, setProviderSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProviderConfigRecord | null>(null);
  const [detailTarget, setDetailTarget] = useState<ProviderConfigRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [applyTarget, setApplyTarget] = useState<ProviderConfigRecord | null>(null);
  const [actionSupport, setActionSupport] =
    useState<ProviderConfigCenterActionSupport>(DEFAULT_ACTION_SUPPORT);
  const [applyInstances, setApplyInstances] = useState<
    Awaited<ReturnType<typeof providerConfigCenterWorkspaceService.loadApplyInstances>>['instances']
  >([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState('');
  const [instanceTarget, setInstanceTarget] = useState<
    Awaited<ReturnType<typeof providerConfigCenterWorkspaceService.loadApplyInstanceTarget>>['instanceTarget']
  >(null);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [isApplying, setIsApplying] = useState(false);
  const [isLoadingApplyTargets, setIsLoadingApplyTargets] = useState(false);
  const [testingRouteId, setTestingRouteId] = useState('');
  const [isImportMenuOpen, setIsImportMenuOpen] = useState(false);
  const [importingSource, setImportingSource] = useState<ProviderConfigImportSource | null>(null);
  const importMenuRef = useRef<HTMLDivElement | null>(null);
  const presentationLabels: ProviderConfigCenterPresentationLabels = {
    health: {
      healthy: t('providerCenter.health.healthy'),
      degraded: t('providerCenter.health.degraded'),
      failed: t('providerCenter.health.failed'),
      disabled: t('providerCenter.health.disabled'),
    },
    states: {
      notTested: t('providerCenter.states.notTested'),
    },
    table: {
      totalTokensShort: t('providerCenter.table.totalTokensShort'),
      inputTokensShort: t('providerCenter.table.inputTokensShort'),
      outputTokensShort: t('providerCenter.table.outputTokensShort'),
      cacheTokensShort: t('providerCenter.table.cacheTokensShort'),
    },
    testStatus: {
      passed: t('providerCenter.testStatus.passed'),
      failed: t('providerCenter.testStatus.failed'),
    },
  };
  const importSources = [
    {
      id: 'codex' as const,
      label: t('providerCenter.import.sources.codex.label'),
      description: t('providerCenter.import.sources.codex.description'),
    },
    {
      id: 'claude-code' as const,
      label: t('providerCenter.import.sources.claudeCode.label'),
      description: t('providerCenter.import.sources.claudeCode.description'),
    },
    {
      id: 'opencode' as const,
      label: t('providerCenter.import.sources.openCode.label'),
      description: t('providerCenter.import.sources.openCode.description'),
    },
  ];

  const loadRecords = async (options?: { background?: boolean }) => {
    if (options?.background) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    try {
      const overview = await providerConfigCenterWorkspaceService.loadOverview();
      setRecords(overview.records);
      setActionSupport(overview.actionSupport);
    } catch (error: any) {
      setActionSupport(DEFAULT_ACTION_SUPPORT);
      toast.error(error?.message || t('providerCenter.toasts.loadFailed'));
    } finally {
      if (options?.background) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadRecords();
  }, []);

  useEffect(() => {
    if (!isImportMenuOpen || typeof document === 'undefined') {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) {
        return;
      }
      if (!importMenuRef.current?.contains(event.target)) {
        setIsImportMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isImportMenuOpen]);

  useEffect(() => {
    if (!applyTarget) {
      setApplyInstances([]);
      setSelectedInstanceId('');
      setInstanceTarget(null);
      setSelectedAgentIds([]);
      return;
    }

    let cancelled = false;
    const loadApplyInstances = async () => {
      setIsLoadingApplyTargets(true);
      try {
        const nextState = await providerConfigCenterWorkspaceService.loadApplyInstances();
        if (cancelled) {
          return;
        }
        setApplyInstances(nextState.instances);
        setSelectedInstanceId(nextState.selectedInstanceId);
      } catch (error: any) {
        if (!cancelled) {
          toast.error(error?.message || t('providerCenter.toasts.loadInstancesFailed'));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingApplyTargets(false);
        }
      }
    };

    void loadApplyInstances();
    return () => {
      cancelled = true;
    };
  }, [applyTarget, t]);

  useEffect(() => {
    if (!applyTarget || !selectedInstanceId) {
      setInstanceTarget(null);
      setSelectedAgentIds([]);
      return;
    }

    let cancelled = false;
    const loadInstanceTarget = async () => {
      setIsLoadingApplyTargets(true);
      try {
        const nextState =
          await providerConfigCenterWorkspaceService.loadApplyInstanceTarget(selectedInstanceId);
        if (cancelled) {
          return;
        }
        setInstanceTarget(nextState.instanceTarget);
        setSelectedAgentIds(nextState.selectedAgentIds);
      } catch (error: any) {
        if (!cancelled) {
          setInstanceTarget(null);
          setSelectedAgentIds([]);
          toast.error(error?.message || t('providerCenter.toasts.loadInstanceTargetFailed'));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingApplyTargets(false);
        }
      }
    };

    void loadInstanceTarget();
    return () => {
      cancelled = true;
    };
  }, [applyTarget, selectedInstanceId, t]);

  const openCreateDialog = () => {
    setIsImportMenuOpen(false);
    setProviderSearchQuery('');
    setEditorMode('edit');
    setEditorDraft(createProviderConfigFormState(presets[0]?.draft));
    setIsEditorOpen(true);
  };

  const openViewDialog = (record: ProviderConfigRecord) => {
    setProviderSearchQuery('');
    setEditorMode('view');
    setEditorDraft(createProviderConfigFormState(record));
    setIsEditorOpen(true);
  };

  const openEditDialog = (record: ProviderConfigRecord) => {
    setDetailTarget(null);
    setProviderSearchQuery('');
    setEditorMode('edit');
    setEditorDraft(createProviderConfigFormState(record));
    setIsEditorOpen(true);
  };

  const handleSelectPreset = (presetId: string) => {
    if (presetId === CUSTOM_PROVIDER_OPTION_VALUE) {
      setEditorDraft((current) => ({ ...current, presetId: '' }));
      return;
    }
    const preset = presets.find((item) => item.id === presetId);
    if (!preset) {
      return;
    }
    setEditorDraft((current) => {
      const nextPresetDraft = createProviderConfigFormState({
        ...preset.draft,
        apiKey: current.apiKey,
      });

      return {
        ...nextPresetDraft,
        id: current.id,
        name: current.id ? current.name : nextPresetDraft.name,
        notes: current.notes,
        enabled: current.enabled,
        isDefault: current.isDefault,
        temperature: current.temperature,
        topP: current.topP,
        maxTokens: current.maxTokens,
        timeoutMs: current.timeoutMs,
        streaming: current.streaming,
      };
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await providerConfigCenterService.saveProviderConfig(createProviderConfigDraftFromForm(editorDraft));
      toast.success(t('providerCenter.toasts.saved'));
      setIsEditorOpen(false);
      await loadRecords();
    } catch (error: any) {
      toast.error(error?.message || t('providerCenter.toasts.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }
    setIsDeleting(true);
    try {
      await providerConfigCenterService.deleteProviderConfig(deleteTarget.id);
      toast.success(t('providerCenter.toasts.deleted'));
      setDeleteTarget(null);
      await loadRecords();
    } catch (error: any) {
      toast.error(error?.message || t('providerCenter.toasts.deleteFailed'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveRouteDetail = async (draft: ReturnType<typeof createProviderConfigDraftFromForm>) => {
    const savedRecord = await providerConfigCenterService.saveProviderConfig(draft);

    setRecords((current) =>
      current.map((record) =>
        record.id === savedRecord.id
          ? {
              ...record,
              ...savedRecord,
            }
          : record,
      ),
    );
    setDetailTarget((current) =>
      current?.id === savedRecord.id
        ? {
            ...current,
            ...savedRecord,
          }
        : current,
    );

    void loadRecords({ background: true });
    return savedRecord;
  };

  const handleImportSource = async (source: ProviderConfigImportSource) => {
    setIsImportMenuOpen(false);
    setImportingSource(source);
    try {
      const execution = await providerConfigCenterWorkspaceService.importProviderConfigs({
        source,
        existingRecords: records,
      });
      const result = execution.result;
      if (result.drafts.length === 0) {
        toast.error(
          result.warnings[0] ||
            t('providerCenter.toasts.importEmpty', {
              source: result.sourceLabel,
            }),
        );
        return;
      }

      const description = result.warnings.length > 0
        ? result.warnings.join(' ')
        : execution.savedNames.join(' · ');

      toast.success(
        result.drafts.length === 1
          ? t('providerCenter.toasts.importedSingle', {
              source: result.sourceLabel,
              name: result.drafts[0]?.draft.name,
            })
          : t('providerCenter.toasts.importedMultiple', {
              source: result.sourceLabel,
              count: result.drafts.length,
            }),
        description
          ? {
              description,
            }
          : undefined,
      );

      await loadRecords({ background: true });
    } catch (error: any) {
      toast.error(
        error?.message ||
          t('providerCenter.toasts.importFailed', {
            source:
              importSources.find((item) => item.id === source)?.label || source,
          }),
      );
    } finally {
      setImportingSource(null);
    }
  };

  const handleTestRoute = async (routeId: string) => {
    setTestingRouteId(routeId);
    try {
      const result = await providerConfigCenterService.testProviderConfigRoute(routeId);
      if (!result) {
        toast.error(t('providerCenter.toasts.testFailed'));
      } else if (result.status === 'passed') {
        toast.success(t('providerCenter.toasts.testPassed'));
      } else {
        toast.error(result.error || t('providerCenter.toasts.testFailed'));
      }
      await loadRecords({ background: true });
    } catch (error: any) {
      toast.error(error?.message || t('providerCenter.toasts.testFailed'));
    } finally {
      setTestingRouteId('');
    }
  };

  const handleApply = async () => {
    if (!applyTarget || !selectedInstanceId) {
      return;
    }
    setIsApplying(true);
    try {
      await providerConfigCenterService.applyProviderConfig({
        instanceId: selectedInstanceId,
        config: applyTarget,
        agentIds: selectedAgentIds,
      });
      toast.success(t('providerCenter.toasts.applied'));
      setApplyTarget(null);
    } catch (error: any) {
      toast.error(error?.message || t('providerCenter.toasts.applyFailed'));
    } finally {
      setIsApplying(false);
    }
  };

  const setAgentSelected = (agentId: string, checked: boolean) => {
    setSelectedAgentIds((current) =>
      checked ? (current.includes(agentId) ? current : [...current, agentId]) : current.filter((value) => value !== agentId),
    );
  };

  return (
    <div className="h-full w-full overflow-auto" data-slot="provider-center-page">
      <div className="flex w-full flex-col gap-6">
        <section className="rounded-[32px] border border-zinc-200/80 bg-white/95 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.35)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
          <div
            data-slot="provider-center-summary"
            className="grid gap-4 border-b border-zinc-200/80 p-6 dark:border-zinc-800 md:p-7 xl:p-8"
          >
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
                  <Route className="h-3.5 w-3.5" />
                  {t('providerCenter.page.eyebrow')}
                </div>
                <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 md:text-[2rem]">
                  {t('providerCenter.page.title')}
                </h1>
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                {records.length} {t('providerCenter.summary.routeConfigs')}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[24px] border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/80">
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  {t('providerCenter.summary.routeConfigs')}
                </div>
                <div className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
                  {records.length}
                </div>
              </div>
              <div className="rounded-[24px] border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/80">
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  {t('providerCenter.summary.llmReady')}
                </div>
                <div className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
                  {records.filter((record) => record.enabled).length}
                </div>
              </div>
              <div className="rounded-[24px] border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/80">
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  {t('providerCenter.summary.embeddingReady')}
                </div>
                <div className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
                  {records.filter((record) => record.isDefault).length}
                </div>
              </div>
            </div>
          </div>

          <div
            data-slot="provider-center-table-toolbar"
            className="flex flex-col gap-4 border-b border-zinc-200/80 px-6 py-5 dark:border-zinc-800 md:px-7 xl:flex-row xl:items-center xl:justify-between xl:px-8"
          >
            <div className="min-w-0">
              <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                {t('providerCenter.summary.routeConfigs')}
              </div>
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {records.length} {t('providerCenter.summary.routeConfigs')}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3 xl:justify-end">
              <Button
                variant="outline"
                onClick={() => void loadRecords({ background: true })}
                disabled={isLoading || isRefreshing}
              >
                <Database className="h-4 w-4" />
                {t('providerCenter.actions.refresh')}
              </Button>
              <div
                ref={importMenuRef}
                className="relative"
                data-slot="provider-center-import-menu"
              >
                <Button
                  variant="outline"
                  onClick={() => setIsImportMenuOpen((current) => !current)}
                  disabled={isLoading || isRefreshing || Boolean(importingSource)}
                >
                  <ArrowDownToLine className="h-4 w-4" />
                  {importingSource
                    ? t('providerCenter.actions.importing')
                    : t('providerCenter.actions.import')}
                  <ChevronDown className="h-4 w-4" />
                </Button>
                {isImportMenuOpen ? (
                  <div className="absolute right-0 top-full z-20 mt-2 w-[320px] overflow-hidden rounded-[24px] border border-zinc-200 bg-white/98 p-2 shadow-[0_24px_60px_-30px_rgba(15,23,42,0.45)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/98">
                    <div className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                      {t('providerCenter.actions.import')}
                    </div>
                    <div className="grid gap-1">
                      {IMPORT_SOURCE_ORDER.map((sourceId) => {
                        const source = importSources.find((entry) => entry.id === sourceId);
                        if (!source) {
                          return null;
                        }

                        const isImportingCurrent = importingSource === source.id;

                        return (
                          <button
                            key={source.id}
                            type="button"
                            className="flex w-full items-start gap-3 rounded-[18px] px-3 py-3 text-left transition-colors hover:bg-zinc-100/80 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-zinc-900/80"
                            onClick={() => void handleImportSource(source.id)}
                            disabled={Boolean(importingSource)}
                          >
                            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                              {isImportingCurrent ? (
                                <LoaderCircle className="h-4 w-4 animate-spin" />
                              ) : (
                                <ArrowDownToLine className="h-4 w-4" />
                              )}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                                {source.label}
                              </span>
                              <span className="mt-1 block text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                                {source.description}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4" />
                {t('providerCenter.actions.addRouteConfig')}
              </Button>
            </div>
          </div>

          <div data-slot="provider-center-table">
            {isLoading ? (
              <div className="flex min-h-[240px] items-center justify-center p-8 text-sm text-zinc-500 dark:text-zinc-400">
                {t('providerCenter.states.loading')}
              </div>
            ) : records.length === 0 ? (
              <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 p-8 text-center">
                <Route className="h-8 w-8 text-zinc-400" />
                <div>
                  <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                    {t('providerCenter.states.emptyTitle')}
                  </h2>
                  <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                    {t('providerCenter.states.emptyDescription')}
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <table className="w-full min-w-[1400px] text-sm">
                  <thead className="sticky top-0 z-10 bg-zinc-50/95 text-left text-xs uppercase tracking-[0.18em] text-zinc-500 backdrop-blur dark:bg-zinc-950/95 dark:text-zinc-400">
                    <tr>
                      <th className="px-5 py-4">{t('providerCenter.table.name')}</th>
                      <th className="w-[460px] px-5 py-4">{t('providerCenter.table.provider')}</th>
                      <th className="w-[180px] min-w-[180px] px-5 py-4">{t('providerCenter.table.health')}</th>
                      <th className="w-[280px] px-5 py-4">{t('providerCenter.table.usage')}</th>
                      <th className="px-5 py-4">{t('providerCenter.table.avgLatency')}</th>
                      <th className="px-5 py-4">{t('providerCenter.table.rpm')}</th>
                      <th className="px-5 py-4">{t('providerCenter.table.status')}</th>
                      <th className="px-5 py-4">{t('providerCenter.table.updatedAt')}</th>
                      <th className="px-5 py-4">{t('providerCenter.table.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {records.map((record) => {
                      const resolvedHealth = resolveProviderRouteHealth(record);
                      const latestTest = formatLatestTestPresentation(record, presentationLabels);
                      const usageSummary = formatRouteUsageSummary(record, presentationLabels);
                      const routeModelSummary = buildRouteModelSummary(record, t);
                      const isTestingRoute = testingRouteId === record.id;
                      const healthTone = resolveRouteHealthToneClasses(resolvedHealth);
                      const routeBaseUrl = record.baseUrl || t('providerCenter.states.notSet');
                      const latestTestDetail = latestTest.detail || t('providerCenter.states.notTested');
                      const lastErrorMessage = record.runtimeMetrics?.lastError || t('providerCenter.states.noIncidents');
                      const averageLatencyLabel = formatRouteLatency(record.runtimeMetrics?.averageLatencyMs);
                      const rpmLabel = record.runtimeMetrics
                        ? `${formatCompactNumber(record.runtimeMetrics.rpm)} /m`
                        : '--';
                      const updatedAtLabel = formatRouteUpdatedAt(record.updatedAt);

                      return (
                        <tr
                          key={record.id}
                          onDoubleClick={() => openViewDialog(record)}
                          className="cursor-pointer align-top transition-colors hover:bg-zinc-50/80 dark:hover:bg-zinc-950/40"
                        >
                        <td className="px-5 py-4">
                          <div className="font-semibold text-zinc-950 dark:text-zinc-50">
                            {record.name}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {record.isDefault ? (
                              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                                {t('providerCenter.table.defaultRoute')}
                              </span>
                            ) : null}
                            {record.managedBy === 'system-default' ? (
                              <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
                                {t('providerCenter.table.systemDefault')}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                            {record.notes || t('providerCenter.states.noNotes')}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div
                            className="max-w-[460px] rounded-[22px] border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/80"
                            data-slot="provider-center-route-summary-cell"
                            onDoubleClick={(event) => event.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="w-full text-left transition-colors hover:text-zinc-950 dark:hover:text-zinc-50"
                              onClick={(event) => {
                                event.stopPropagation();
                                setDetailTarget(record);
                              }}
                              onDoubleClick={(event) => event.stopPropagation()}
                            >
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                                {t('providerCenter.table.endpoint')}
                              </div>
                              <div
                                className="mt-2 break-all font-mono text-xs text-zinc-700 dark:text-zinc-200"
                                title={routeBaseUrl}
                              >
                                {routeBaseUrl}
                              </div>
                              <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                                {t('providerCenter.dialogs.editor.models')}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                                {routeModelSummary.map((entry) => (
                                  <span
                                    key={`${record.id}-${entry}`}
                                    className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 dark:border-zinc-700 dark:bg-zinc-900"
                                  >
                                    {entry}
                                  </span>
                                ))}
                              </div>
                            </button>

                            <div className="mt-4 flex flex-wrap items-start justify-between gap-3 border-t border-zinc-200/80 pt-3 dark:border-zinc-800/80">
                              <div className="min-w-0">
                                <div className="font-medium text-zinc-900 dark:text-zinc-100">
                                  {record.providerId}
                                </div>
                                <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                  {record.clientProtocol}
                                  {' -> '}
                                  {record.upstreamProtocol}
                                </div>
                              </div>
                              {record.managedBy === 'user' ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openEditDialog(record);
                                  }}
                                  onDoubleClick={(event) => event.stopPropagation()}
                                >
                                  {t('providerCenter.actions.edit')}
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="w-[180px] min-w-[180px] px-5 py-4">
                          <ProviderRouteHealthIndicator
                            health={resolvedHealth}
                            toneClassName={healthTone}
                            healthLabel={formatRouteHealthLabel(resolvedHealth, presentationLabels.health)}
                            lastErrorMessage={lastErrorMessage}
                            averageLatencyLabel={averageLatencyLabel}
                            rpmLabel={rpmLabel}
                            latestTestDetail={latestTestDetail}
                            updatedAtLabel={updatedAtLabel}
                          />
                        </td>
                        <td className="w-[280px] px-5 py-4 text-xs text-zinc-600 dark:text-zinc-300">
                          <div className="grid min-w-[240px] gap-1.5">
                            {usageSummary.map((entry) => (
                              <div key={`${record.id}-${entry}`}>{entry}</div>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-zinc-600 dark:text-zinc-300">
                          {formatRouteLatency(record.runtimeMetrics?.averageLatencyMs)}
                        </td>
                        <td className="px-5 py-4 text-zinc-600 dark:text-zinc-300">{rpmLabel}</td>
                        <td className="px-5 py-4 text-xs text-zinc-600 dark:text-zinc-300">
                          <div>
                            <span className="font-semibold">{t('providerCenter.table.enabled')}</span>{' '}
                            {record.enabled ? t('providerCenter.states.enabled') : t('providerCenter.states.disabled')}
                          </div>
                          <div className="mt-1">
                            <span className="font-semibold">{t('providerCenter.table.exposeTo')}</span>{' '}
                            {record.exposeTo.join(', ') || t('providerCenter.states.notSet')}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-zinc-600 dark:text-zinc-300">{updatedAtLabel}</td>
                        <td className="px-5 py-4">
                          <div className="flex min-w-[300px] flex-wrap gap-2">
                            {listProviderConfigCenterRowActionIds(record).map((actionId) => {
                              switch (actionId) {
                                case 'quickApply':
                                  return (
                                    <Button
                                      key={`${record.id}-quick-apply`}
                                      size="sm"
                                      variant="outline"
                                      disabled={!actionSupport.quickApply.available}
                                      onClick={() => setApplyTarget(record)}
                                      title={resolveActionSupportReasonLabel(t, actionSupport.quickApply) || undefined}
                                    >
                                      <Rocket className="h-4 w-4" />
                                      {t('providerCenter.actions.quickApply')}
                                    </Button>
                                  );
                                case 'edit':
                                  return (
                                    <Button
                                      key={`${record.id}-edit`}
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => openEditDialog(record)}
                                    >
                                      <PencilLine className="h-4 w-4" />
                                      {t('providerCenter.actions.edit')}
                                    </Button>
                                  );
                                case 'delete':
                                  return (
                                    <Button
                                      key={`${record.id}-delete`}
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setDeleteTarget(record)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      {t('providerCenter.actions.delete')}
                                    </Button>
                                  );
                                case 'test':
                                  return (
                                    <Button
                                      key={`${record.id}-test`}
                                      size="sm"
                                      variant="outline"
                                      onClick={() => void handleTestRoute(record.id)}
                                      disabled={!actionSupport.test.available || Boolean(testingRouteId)}
                                      title={actionSupport.test.available ? undefined : resolveActionSupportReasonLabel(t, actionSupport.test) || undefined}
                                    >
                                      <Check className="h-4 w-4" />
                                      {isTestingRoute
                                        ? t('providerCenter.actions.testing')
                                        : t('providerCenter.actions.test')}
                                    </Button>
                                  );
                                default:
                                  return null;
                              }
                            })}
                          </div>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
        <ProviderConfigEditorSheet
          open={isEditorOpen}
          mode={editorMode}
          draft={editorDraft}
          presets={presets}
          knownProviderOptions={knownProviderOptions}
          providerSearchQuery={providerSearchQuery}
          isSaving={isSaving}
          onOpenChange={setIsEditorOpen}
          onEditRequest={() => setEditorMode('edit')}
          onProviderSearchQueryChange={setProviderSearchQuery}
          onDraftChange={setEditorDraft}
          onSelectPreset={handleSelectPreset}
          onSave={() => void handleSave()}
        />
        <ProviderRouteDetailDialog
          open={Boolean(detailTarget)}
          record={detailTarget}
          onOpenChange={(open) => !open && setDetailTarget(null)}
          onEditRequest={(record) => openEditDialog(record)}
          onSaveRequest={handleSaveRouteDetail}
        />

        <Dialog open={Boolean(applyTarget)} onOpenChange={(open) => !open && setApplyTarget(null)}>
          <DialogContent className="max-h-[85vh] max-w-6xl overflow-y-auto xl:max-w-7xl">
            <DialogHeader>
              <DialogTitle>{t('providerCenter.dialogs.apply.title')}</DialogTitle>
              <DialogDescription>{t('providerCenter.dialogs.apply.description')}</DialogDescription>
            </DialogHeader>

            <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
              <div className="space-y-4">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                  <Label>{t('providerCenter.dialogs.apply.instance')}</Label>
                  <div className="mt-2">
                    <Select
                      value={selectedInstanceId || '__none__'}
                      onValueChange={(value) => setSelectedInstanceId(value === '__none__' ? '' : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('providerCenter.dialogs.apply.instancePlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {applyInstances.length > 0 ? (
                          applyInstances.map((instance) => (
                            <SelectItem key={instance.id} value={instance.id}>
                              {instance.name}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="__none__">{t('providerCenter.states.noInstances')}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  {instanceTarget ? (
                    <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
                      <div className="font-medium text-zinc-950 dark:text-zinc-50">
                        {instanceTarget.instance.name}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {instanceTarget.instance.deploymentMode}
                      </div>
                      <div className="mt-2 break-all text-xs text-zinc-500 dark:text-zinc-400">
                        {t('providerCenter.dialogs.apply.configFile')}: {instanceTarget.instance.configFile}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                      {applyInstances.length === 0
                        ? t('providerCenter.states.noInstances')
                        : t('providerCenter.states.selectInstance')}
                    </p>
                  )}
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="font-semibold text-zinc-950 dark:text-zinc-50">
                    {t('providerCenter.dialogs.apply.targetSummary')}
                  </div>
                  {applyTarget ? (
                    <div className="mt-3 space-y-2 text-zinc-600 dark:text-zinc-300">
                      <div><span className="font-medium">{t('providerCenter.table.provider')}</span> {applyTarget.providerId}</div>
                      <div><span className="font-medium">{t('providerCenter.table.llmDefault')}</span> {applyTarget.defaultModelId}</div>
                      <div><span className="font-medium">{t('providerCenter.table.reasoning')}</span> {applyTarget.reasoningModelId || t('providerCenter.states.notSet')}</div>
                      <div><span className="font-medium">{t('providerCenter.table.embedding')}</span> {applyTarget.embeddingModelId || t('providerCenter.states.notSet')}</div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                      {t('providerCenter.dialogs.apply.agents')}
                    </h3>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {t('providerCenter.dialogs.apply.agentHint')}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedAgentIds(instanceTarget?.agents.map((agent) => agent.id) || [])}
                      disabled={!instanceTarget || instanceTarget.agents.length === 0}
                    >
                      {t('providerCenter.actions.selectAllAgents')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedAgentIds([])}
                      disabled={selectedAgentIds.length === 0}
                    >
                      {t('providerCenter.actions.clearAgentSelection')}
                    </Button>
                  </div>
                </div>

                {isLoadingApplyTargets ? (
                  <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
                    {t('providerCenter.states.loading')}
                  </div>
                ) : !instanceTarget ? (
                  <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
                    {applyInstances.length === 0
                      ? t('providerCenter.states.noInstances')
                      : t('providerCenter.states.selectInstance')}
                  </div>
                ) : instanceTarget.agents.length === 0 ? (
                  <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
                    {t('providerCenter.states.noAgents')}
                  </div>
                ) : (
                  <div className="max-h-[380px] space-y-3 overflow-y-auto rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                    {instanceTarget.agents.map((agent) => {
                      const isSelected = selectedAgentIds.includes(agent.id);
                      return (
                        <label key={agent.id} className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 ${isSelected ? 'border-primary-300 bg-primary-50 dark:border-primary-500/40 dark:bg-primary-500/10' : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'}`}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => setAgentSelected(agent.id, checked === true)}
                            className="mt-1"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                                {agent.name}
                              </div>
                              {agent.isDefault ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                                  <Check className="h-3 w-3" />
                                  {t('providerCenter.dialogs.apply.defaultAgent')}
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-1 break-all text-xs text-zinc-500 dark:text-zinc-400">
                              {t('providerCenter.dialogs.apply.currentModel')}: {agent.primaryModel || t('providerCenter.states.notSet')}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setApplyTarget(null)} disabled={isApplying}>
                {t('providerCenter.actions.cancel')}
              </Button>
              <Button onClick={() => void handleApply()} disabled={!selectedInstanceId || isApplying || isLoadingApplyTargets}>
                <Rocket className="h-4 w-4" />
                {t('providerCenter.actions.applyConfig')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('providerCenter.dialogs.delete.title')}</DialogTitle>
              <DialogDescription>
                {t('providerCenter.dialogs.delete.description', { name: deleteTarget?.name || '' })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
                {t('providerCenter.actions.cancel')}
              </Button>
              <Button variant="destructive" onClick={() => void handleDelete()} disabled={isDeleting}>
                <Trash2 className="h-4 w-4" />
                {t('providerCenter.actions.delete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

