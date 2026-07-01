import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  FileCode2,
  Globe,
  Loader2,
  Palette,
  Server,
  Shield,
  Sparkles,
  Wrench,
} from 'lucide-react';
import {
  parseOpenClawConfigDocument,
  serializeOpenClawConfigDocument,
} from '@sdkwork/claw-core';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  buildInstanceConfigWorkbenchModel,
  buildInstanceConfigOverviewMetrics,
  analyzeConfigSchema,
  computeInstanceConfigWorkbenchDiff,
  countSensitiveConfigValues,
  deriveVisibleSchemaSections,
  groupInstanceConfigSectionsByCategory,
  instanceService,
  type InstanceConfigOverviewMetricId,
  type InstanceConfigWorkbenchModeId,
  type InstanceConfigWorkbenchPresentableSection,
  type InstanceConfigWorkbenchSectionCategoryId,
  type OpenClawConfigSchemaSnapshot,
} from '../services';
import type { InstanceWorkbenchSnapshot } from '../types/index.ts';
import { InstanceConfigWorkbenchDiffPanel } from './InstanceConfigWorkbenchDiffPanel.tsx';
import { InstanceConfigWorkbenchConfigNavigation } from './InstanceConfigWorkbenchConfigNavigation.tsx';
import { InstanceConfigWorkbenchOverview } from './InstanceConfigWorkbenchOverview.tsx';
import { InstanceConfigWorkbenchRawPanel } from './InstanceConfigWorkbenchRawPanel.tsx';
import { InstanceConfigSchemaSectionEditor } from './InstanceConfigSchemaSectionEditor.tsx';
import { InstanceConfigWorkbenchSectionHero } from './InstanceConfigWorkbenchSectionHero.tsx';
import { InstanceConfigWorkbenchToolbar } from './InstanceConfigWorkbenchToolbar.tsx';

type Translate = (
  key: string,
  en: string,
  zh: string,
  options?: Record<string, unknown>,
) => string;

interface InstanceConfigWorkbenchPanelProps {
  instanceId: string;
  workbench: InstanceWorkbenchSnapshot;
  onReload?: () => Promise<void> | void;
}

const CATEGORY_META: Record<
  InstanceConfigWorkbenchSectionCategoryId,
  { icon: React.ComponentType<{ className?: string }>; tone: string }
> = {
  core: {
    icon: Shield,
    tone:
      'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300',
  },
  ai: {
    icon: Sparkles,
    tone:
      'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300',
  },
  communication: {
    icon: Globe,
    tone:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300',
  },
  automation: {
    icon: Wrench,
    tone:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300',
  },
  infrastructure: {
    icon: Server,
    tone:
      'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-300',
  },
  appearance: {
    icon: Palette,
    tone:
      'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-500/20 dark:bg-fuchsia-500/10 dark:text-fuchsia-300',
  },
  other: {
    icon: FileCode2,
    tone:
      'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  },
};

function categoryMeta(id: InstanceConfigWorkbenchSectionCategoryId) {
  return CATEGORY_META[id];
}

function categoryLabel(id: InstanceConfigWorkbenchSectionCategoryId, tr: Translate) {
  if (id === 'core') {
    return tr('instances.detail.instanceWorkbench.config.workbench.categories.core', 'Core', 'Core');
  }
  if (id === 'ai') {
    return tr('instances.detail.instanceWorkbench.config.workbench.categories.ai', 'AI & Agents', 'AI & Agents');
  }
  if (id === 'communication') {
    return tr(
      'instances.detail.instanceWorkbench.config.workbench.categories.communication',
      'Communication',
      'Communication',
    );
  }
  if (id === 'automation') {
    return tr(
      'instances.detail.instanceWorkbench.config.workbench.categories.automation',
      'Automation',
      'Automation',
    );
  }
  if (id === 'infrastructure') {
    return tr(
      'instances.detail.instanceWorkbench.config.workbench.categories.infrastructure',
      'Infrastructure',
      'Infrastructure',
    );
  }
  if (id === 'appearance') {
    return tr(
      'instances.detail.instanceWorkbench.config.workbench.categories.appearance',
      'Appearance',
      'Appearance',
    );
  }
  return tr('instances.detail.instanceWorkbench.config.workbench.categories.other', 'Other', 'Other');
}

function overviewMetricLabel(id: InstanceConfigOverviewMetricId, tr: Translate) {
  if (id === 'configFile') {
    return tr(
      'instances.detail.instanceWorkbench.config.workbench.metrics.configFile',
      'OpenClaw config file',
      'OpenClaw config file',
    );
  }
  if (id === 'defaultAgent') {
    return tr('instances.detail.instanceWorkbench.config.workbench.metrics.defaultAgent', 'Default agent', 'Default agent');
  }
  if (id === 'defaultModel') {
    return tr('instances.detail.instanceWorkbench.config.workbench.metrics.defaultModel', 'Default model', 'Default model');
  }
  if (id === 'sessions') {
    return tr('instances.detail.instanceWorkbench.config.workbench.metrics.sessions', 'Sessions', 'Sessions');
  }
  if (id === 'providers') {
    return tr('instances.detail.instanceWorkbench.config.workbench.metrics.providers', 'Providers', 'Providers');
  }
  if (id === 'agents') {
    return tr('instances.detail.instanceWorkbench.config.workbench.metrics.agents', 'Agents', 'Agents');
  }
  if (id === 'channels') {
    return tr('instances.detail.instanceWorkbench.config.workbench.metrics.channels', 'Channels', 'Channels');
  }
  if (id === 'sections') {
    return tr('instances.detail.instanceWorkbench.config.workbench.metrics.sections', 'Sections', 'Sections');
  }
  if (id === 'customSections') {
    return tr(
      'instances.detail.instanceWorkbench.config.workbench.metrics.customSections',
      'Custom sections',
      'Custom sections',
    );
  }
  if (id === 'formCoverage') {
    return tr('instances.detail.instanceWorkbench.config.workbench.metrics.formCoverage', 'Form coverage', 'Form coverage');
  }
  if (id === 'schemaVersion') {
    return tr('instances.detail.instanceWorkbench.config.workbench.metrics.schemaVersion', 'Schema version', 'Schema version');
  }
  if (id === 'schemaGenerated') {
    return tr(
      'instances.detail.instanceWorkbench.config.workbench.metrics.schemaGenerated',
      'Schema generated',
      'Schema generated',
    );
  }
  if (id === 'rawLines') {
    return tr('instances.detail.instanceWorkbench.config.workbench.metrics.rawLines', 'Raw lines', 'Raw lines');
  }
  return tr('instances.detail.instanceWorkbench.config.workbench.metrics.writable', 'Writable', 'Writable');
}

function localizeSectionLabel(
  section: Pick<InstanceConfigWorkbenchPresentableSection, 'key' | 'label'>,
  tr: Translate,
) {
  return tr(
    `instances.detail.instanceWorkbench.config.sectionDefinitions.labels.${section.key}`,
    section.label,
    section.label,
  );
}

function localizeSectionTitle(
  section: Pick<InstanceConfigWorkbenchPresentableSection, 'key' | 'label'> & {
    title?: string;
  },
  tr: Translate,
) {
  const fallback = section.title || section.label;
  return tr(
    `instances.detail.instanceWorkbench.config.sectionDefinitions.titles.${section.key}`,
    fallback,
    fallback,
  );
}

function localizeSectionDescription(
  section: Pick<InstanceConfigWorkbenchPresentableSection, 'key' | 'description'> & {
    isKnownSection?: boolean;
  },
  tr: Translate,
) {
  if (!section.isKnownSection) {
    return tr(
      'instances.detail.instanceWorkbench.config.sectionDefinitions.descriptions.custom',
      section.description,
      section.description,
    );
  }

  return tr(
    `instances.detail.instanceWorkbench.config.sectionDefinitions.descriptions.${section.key}`,
    section.description,
    section.description,
  );
}

function formatTimestampLabel(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

export function InstanceConfigWorkbenchPanel(props: InstanceConfigWorkbenchPanelProps) {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const tr: Translate = (key, en, zh, options = {}) =>
    t(key, { ...options, defaultValue: isZh ? zh : en });
  const configFilePath = props.workbench.kernelConfig?.configFile || null;

  const [activeMode, setActiveMode] = useState<InstanceConfigWorkbenchModeId>('config');
  const [activeSectionKey, setActiveSectionKey] = useState<string | null>(null);
  const [rawDocument, setRawDocument] = useState('');
  const [rawDraft, setRawDraft] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaSnapshot, setSchemaSnapshot] =
    useState<OpenClawConfigSchemaSnapshot | null>(null);
  const [envSensitiveVisible, setEnvSensitiveVisible] = useState(false);
  const [rawSensitiveVisible, setRawSensitiveVisible] = useState(false);
  const [validityDismissed, setValidityDismissed] = useState(false);
  const loadedSourceKeyRef = useRef<string | null>(null);

  const loadWorkbench = async () => {
    setRawSensitiveVisible(false);
    const nextSourceKey = `${props.instanceId}:${configFilePath || ''}`;
    const sourceChanged = loadedSourceKeyRef.current !== nextSourceKey;

    if (!configFilePath) {
      setRawDocument('');
      setRawDraft('');
      setSchemaSnapshot(null);
      setErrorMessage(null);
      setSchemaError(null);
      loadedSourceKeyRef.current = nextSourceKey;
      return;
    }

    setIsLoading(true);
    setSchemaLoading(true);
    setErrorMessage(null);
    setSchemaError(null);
    if (sourceChanged) {
      setRawDocument('');
      setRawDraft('');
      setSchemaSnapshot(null);
    }

    const [rawResult, schemaResult] = await Promise.allSettled([
      instanceService.getOpenClawConfigDocument(props.instanceId),
      instanceService.getOpenClawConfigSchema(props.instanceId),
    ]);

    if (rawResult.status === 'fulfilled') {
      setRawDocument(rawResult.value);
      setRawDraft(rawResult.value);
    } else {
      if (sourceChanged) {
        setRawDocument('');
        setRawDraft('');
      }
      setErrorMessage(
        rawResult.reason?.message ||
          tr(
            'instances.detail.instanceWorkbench.config.raw.loadFailed',
            'Failed to load openclaw.json.',
            'Failed to load openclaw.json.',
          ),
      );
    }

    if (schemaResult.status === 'fulfilled') {
      setSchemaSnapshot(schemaResult.value);
    } else {
      setSchemaSnapshot(null);
      setSchemaError(
        schemaResult.reason?.message ||
          tr(
            'instances.detail.instanceWorkbench.config.workbench.errors.loadSchema',
            'Failed to load config schema.',
            'Failed to load config schema.',
          ),
      );
    }

    loadedSourceKeyRef.current = nextSourceKey;
    setIsLoading(false);
    setSchemaLoading(false);
  };

  useEffect(() => {
    void loadWorkbench();
  }, [configFilePath, props.instanceId]);

  useEffect(() => {
    setSearchQuery('');
  }, [configFilePath, props.instanceId]);

  const model = useMemo(
    () =>
      buildInstanceConfigWorkbenchModel({
        workbench: props.workbench,
        rawDocument: rawDraft,
      }),
    [props.workbench, rawDraft],
  );
  const parsedDraft = useMemo(() => parseOpenClawConfigDocument(rawDraft), [rawDraft]);
  const analyzedSchema = useMemo(
    () => analyzeConfigSchema(schemaSnapshot?.schema ?? null),
    [schemaSnapshot?.schema],
  );
  const draftDiff = useMemo(
    () => computeInstanceConfigWorkbenchDiff(rawDocument, rawDraft),
    [rawDocument, rawDraft],
  );
  const configSections = useMemo(() => {
    const schemaSections = deriveVisibleSchemaSections(analyzedSchema.schema);
    if (schemaSections.length === 0) {
      return model.sections;
    }

    const schemaSectionByKey = new Map(schemaSections.map((section) => [section.key, section]));
    return [
      ...schemaSections,
      ...model.sections.filter((section) => !schemaSectionByKey.has(section.key)),
    ];
  }, [analyzedSchema.schema, model.sections]);
  const rawSensitiveCount = useMemo(
    () => countSensitiveConfigValues(parsedDraft.parsed, [], schemaSnapshot?.uiHints ?? {}),
    [parsedDraft.parsed, schemaSnapshot?.uiHints],
  );
  const hasPendingChanges = rawDraft !== rawDocument;
  const rawSensitiveHidden = rawSensitiveCount > 0 && !rawSensitiveVisible;
  const unsupportedSchemaPathCount = schemaSnapshot?.schema
    ? analyzedSchema.unsupportedPaths.length
    : 0;
  const structuredEditorCoverage = !schemaSnapshot?.schema
    ? tr(
        'instances.detail.instanceWorkbench.config.workbench.coverage.unavailable',
        'Unavailable',
        'Unavailable',
      )
    : unsupportedSchemaPathCount > 0
      ? tr(
          'instances.detail.instanceWorkbench.config.workbench.coverage.partial',
          'Partial',
          'Partial',
        )
      : tr('instances.detail.instanceWorkbench.config.workbench.coverage.full', 'Full', 'Full');
  const schemaVersionLabel =
    schemaSnapshot?.version ||
    tr(
      'instances.detail.instanceWorkbench.config.workbench.values.unavailable',
      'Unavailable',
      'Unavailable',
    );
  const schemaGeneratedAtLabel =
    formatTimestampLabel(schemaSnapshot?.generatedAt) ||
    tr(
      'instances.detail.instanceWorkbench.config.workbench.values.unavailable',
      'Unavailable',
      'Unavailable',
    );
  const invalidDraftVisible = Boolean(parsedDraft.parseError) && !validityDismissed;
  const editorTheme =
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
      ? 'vs-dark'
      : 'vs';
  const localizedConfigSections = useMemo(
    () =>
      configSections.map((section) => ({
        ...section,
        label: localizeSectionLabel(section, tr),
        title: localizeSectionTitle(section, tr),
        description: localizeSectionDescription(section, tr),
      })),
    [configSections, tr],
  );
  const activeSection =
    localizedConfigSections.find((section) => section.key === activeSectionKey) || null;
  const activeCategory = categoryMeta(activeSection?.category ?? 'other');
  const activeRawSection =
    model.sections.find((section) => section.key === activeSection?.key) || null;

  useEffect(() => {
    if (!configSections.length) {
      if (activeSectionKey !== null) {
        setActiveSectionKey(null);
      }
      return;
    }

    if (activeSectionKey !== null && !configSections.some((section) => section.key === activeSectionKey)) {
      setActiveSectionKey(null);
    }
  }, [activeSectionKey, configSections]);

  useEffect(() => {
    if (activeSection?.key !== 'env' && envSensitiveVisible) {
      setEnvSensitiveVisible(false);
    }
  }, [activeSection?.key, envSensitiveVisible]);

  useEffect(() => {
    setValidityDismissed(false);
  }, [props.instanceId, parsedDraft.parseError]);

  const revertDraft = () => setRawDraft(rawDocument);

  const saveDraft = async () => {
    if (!model.document.isWritable || !hasPendingChanges || parsedDraft.parseError) {
      return;
    }

    setIsSaving(true);
    try {
      await instanceService.updateOpenClawConfigDocument(props.instanceId, rawDraft);
      setRawDocument(rawDraft);
      toast.success(
        tr(
          'instances.detail.instanceWorkbench.config.raw.saved',
          'openclaw.json saved.',
          'openclaw.json saved.',
        ),
      );
      await props.onReload?.();
    } catch (error: any) {
      const message =
        error?.message ||
        tr(
          'instances.detail.instanceWorkbench.config.raw.saveFailed',
          'Failed to save openclaw.json.',
          'Failed to save openclaw.json.',
        );
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const openConfigFile = async () => {
    try {
      await instanceService.openClawConfigFile(props.instanceId);
      toast.success(
        tr(
          'instances.detail.instanceWorkbench.config.workbench.toasts.opened',
          'openclaw.json opened.',
          'openclaw.json opened.',
        ),
      );
    } catch (error: any) {
      const message =
        error?.message ||
        tr(
          'instances.detail.instanceWorkbench.config.workbench.errors.openDocument',
          'Failed to open openclaw.json.',
          'Failed to open openclaw.json.',
        );
      setErrorMessage(message);
      toast.error(message);
    }
  };

  const applyDraft = async () => {
    if (!model.document.isWritable || !hasPendingChanges || parsedDraft.parseError) {
      return;
    }

    setIsApplying(true);
    try {
      await instanceService.applyOpenClawConfigDocument(props.instanceId, rawDraft);
      setRawDocument(rawDraft);
      toast.success(
        tr(
          'instances.detail.instanceWorkbench.config.workbench.toasts.applied',
          'Configuration applied. Gateway restart requested.',
          'Configuration applied. Gateway restart requested.',
        ),
      );
      await props.onReload?.();
      await loadWorkbench();
    } catch (error: any) {
      const message =
        error?.message ||
        tr(
          'instances.detail.instanceWorkbench.config.workbench.errors.applyDocument',
          'Failed to apply openclaw.json.',
          'Failed to apply openclaw.json.',
        );
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsApplying(false);
    }
  };

  const runUpdate = async () => {
    setIsUpdating(true);
    try {
      await instanceService.runOpenClawUpdate(props.instanceId);
      toast.success(
        tr(
          'instances.detail.instanceWorkbench.config.workbench.toasts.updateStarted',
          'OpenClaw update started.',
          'OpenClaw update started.',
        ),
      );
      await props.onReload?.();
    } catch (error: any) {
      const message =
        error?.message ||
        tr(
          'instances.detail.instanceWorkbench.config.workbench.errors.startUpdate',
          'Failed to start the OpenClaw update.',
          'Failed to start the OpenClaw update.',
        );
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsUpdating(false);
    }
  };

  const visibleConfigCategories = useMemo(
    () => groupInstanceConfigSectionsByCategory(localizedConfigSections),
    [localizedConfigSections],
  );
  const overviewCategoryCards = useMemo(
    () =>
      visibleConfigCategories.map((category) => {
        const meta = categoryMeta(category.id);
        return {
          id: category.id,
          label: categoryLabel(category.id, tr),
          sectionCount: category.sectionCount,
          firstSectionKey: category.firstSection?.key ?? null,
          firstSectionLabel: category.firstSection?.label ?? null,
          firstSectionDescription: category.firstSection?.description ?? null,
          sectionLabels: category.sections.slice(0, 4).map((section) => section.label),
          icon: meta.icon,
          tone: meta.tone,
        };
      }),
    [tr, visibleConfigCategories],
  );
  const overviewMetrics = useMemo(
    () =>
      buildInstanceConfigOverviewMetrics({
        document: model.document,
        configSections,
        structuredEditorCoverage,
        schemaVersionLabel,
        schemaGeneratedAtLabel,
      }),
    [
      configSections,
      model.document,
      schemaGeneratedAtLabel,
      schemaVersionLabel,
      structuredEditorCoverage,
    ],
  );
  const overviewMetricCards = useMemo(
    () =>
      overviewMetrics.map((metric) => ({
        ...metric,
        label: overviewMetricLabel(metric.id, tr),
        value:
          metric.id === 'writable'
            ? metric.value === 'Yes'
              ? tr('instances.detail.instanceWorkbench.config.workbench.values.yes', 'Yes', 'Yes')
              : tr('instances.detail.instanceWorkbench.config.workbench.values.no', 'No', 'No')
            : metric.value === 'Not configured'
              ? tr(
                  'instances.detail.instanceWorkbench.config.workbench.values.notConfigured',
                  'Not configured',
                  'Not configured',
                )
              : metric.value,
      })),
    [overviewMetrics, tr],
  );
  const sectionLabelByKey = useMemo(
    () => new Map(localizedConfigSections.map((section) => [section.key, section.label])),
    [localizedConfigSections],
  );
  const availableSectionKeys = useMemo(
    () => new Set(localizedConfigSections.map((section) => section.key)),
    [localizedConfigSections],
  );

  const configTopTabs = [
    {
      key: null as string | null,
      label: tr(
        'instances.detail.instanceWorkbench.config.workbench.navigation.settingsTab',
        'Settings',
        'Settings',
      ),
    },
    ...localizedConfigSections.map((section) => ({ key: section.key, label: section.label })),
  ];

  const updateRootValue = (nextRootValue: Record<string, unknown>) => {
    setRawDraft(serializeOpenClawConfigDocument(nextRootValue));
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-[1.6rem] border border-zinc-200/70 bg-white/75 p-4 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/35">
        <InstanceConfigWorkbenchToolbar
          tr={tr}
          activeMode={activeMode}
          onModeChange={setActiveMode}
          configFile={model.document.configFile}
          isWritable={model.document.isWritable}
          hasPendingChanges={hasPendingChanges}
          schemaVersion={schemaSnapshot?.version}
          unsupportedSchemaPathCount={unsupportedSchemaPathCount}
          isLoading={isLoading}
          schemaLoading={schemaLoading}
          isSaving={isSaving}
          isApplying={isApplying}
          isUpdating={isUpdating}
          hasParseError={Boolean(parsedDraft.parseError)}
          onOpenConfigFile={() => void openConfigFile()}
          onReload={() => void loadWorkbench()}
          onRevert={revertDraft}
          onSave={() => void saveDraft()}
          onApply={() => void applyDraft()}
          onUpdate={() => void runUpdate()}
        />

        {errorMessage ? (
          <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        {schemaError ? (
          <div className="flex items-start gap-2 rounded-2xl border border-zinc-200/70 bg-zinc-50/80 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{schemaError}</span>
          </div>
        ) : null}

        {activeMode === 'config' ? (
          <div className="space-y-4">
            <InstanceConfigWorkbenchConfigNavigation
              tr={tr}
              invalidDraftVisible={invalidDraftVisible}
              parseError={parsedDraft.parseError}
              searchQuery={searchQuery}
              activeSectionKey={activeSectionKey}
              tabs={configTopTabs}
              onSearchQueryChange={setSearchQuery}
              onSelectSection={setActiveSectionKey}
              onOpenRaw={() => setActiveMode('raw')}
              onDismissValidity={() => setValidityDismissed(true)}
            />

            {!draftDiff.parseError ? (
              <InstanceConfigWorkbenchDiffPanel
                tr={tr}
                entries={draftDiff.entries}
                sectionLabelByKey={sectionLabelByKey}
                availableSectionKeys={availableSectionKeys}
                uiHints={schemaSnapshot?.uiHints ?? {}}
                setActiveMode={setActiveMode}
                setActiveSectionKey={setActiveSectionKey}
              />
            ) : null}

            {activeSectionKey === null ? (
              <InstanceConfigWorkbenchOverview
                tr={tr}
                invalidDraftVisible={invalidDraftVisible}
                unsupportedSchemaPathCount={unsupportedSchemaPathCount}
                categories={overviewCategoryCards}
                metrics={overviewMetricCards}
                onSelectSection={setActiveSectionKey}
              />
            ) : !activeSection ? (
              <div className="rounded-[1.6rem] border border-dashed border-zinc-300/80 bg-zinc-50/70 px-6 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
                {tr(
                  'instances.detail.instanceWorkbench.config.workbench.empty.sectionsForInstance',
                  'No config sections are available for this instance.',
                  'No config sections are available for this instance.',
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <InstanceConfigWorkbenchSectionHero
                  tr={tr}
                  sectionKey={activeSection.key}
                  title={activeSection.title}
                  description={activeSection.description}
                  isKnownSection={activeSection.isKnownSection}
                  categoryLabel={categoryLabel(activeSection.category, tr)}
                  icon={activeCategory.icon}
                  tone={activeCategory.tone}
                  entryCount={activeRawSection?.entryCount ?? null}
                  envSensitiveVisible={envSensitiveVisible}
                  onToggleEnvSensitive={() => setEnvSensitiveVisible((current) => !current)}
                />

                {schemaLoading ? (
                  <div className="rounded-[1.6rem] border border-zinc-200/70 bg-white/85 p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/35 dark:text-zinc-400">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {tr(
                        'instances.detail.instanceWorkbench.config.workbench.loading.schema',
                        'Loading config schema...',
                        'Loading config schema...',
                      )}
                    </div>
                  </div>
                ) : null}

                <InstanceConfigSchemaSectionEditor
                  schema={schemaSnapshot?.schema ?? null}
                  uiHints={schemaSnapshot?.uiHints ?? {}}
                  rootValue={parsedDraft.parsed}
                  activeSectionKey={activeSection.key}
                  revealSensitive={activeSection.key === 'env' ? envSensitiveVisible : false}
                  searchQuery={searchQuery}
                  onRootValueChange={updateRootValue}
                  t={tr}
                />
              </div>
            )}
          </div>
        ) : (
          <InstanceConfigWorkbenchRawPanel
            tr={tr}
            parseError={parsedDraft.parseError}
            rawSensitiveCount={rawSensitiveCount}
            rawSensitiveVisible={rawSensitiveVisible}
            rawSensitiveHidden={rawSensitiveHidden}
            lineCount={model.raw.lineCount}
            characterCount={model.raw.characterCount}
            sectionCount={model.raw.sectionCount}
            isWritable={model.document.isWritable}
            editorTheme={editorTheme}
            rawDraft={rawDraft}
            onRawDraftChange={setRawDraft}
            onToggleRawSensitiveVisible={() =>
              setRawSensitiveVisible((current) => !current)
            }
            onRevealRawSensitive={() => setRawSensitiveVisible(true)}
          />
        )}
      </div>
    </div>
  );
}
