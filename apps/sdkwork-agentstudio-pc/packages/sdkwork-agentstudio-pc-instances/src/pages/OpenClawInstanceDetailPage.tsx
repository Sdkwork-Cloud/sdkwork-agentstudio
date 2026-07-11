import React, { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Copy,
  Edit2,
  Loader2,
  MessageSquare,
  Pause,
  Play,
  Plus,
  Save,
  Zap,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  instanceDirectoryService,
  type CreateKernelAgentResult,
  useInstanceStore,
} from '@sdkwork/agentstudio-pc-core';
import { openDiagnosticPath, openExternalUrl, runtime } from '@sdkwork/agentstudio-pc-infrastructure';
import {
  Button,
} from '@sdkwork/agentstudio-pc-ui';
import { InstanceDetailHeader } from '../components/InstanceDetailHeader';
import {
  InstanceDetailSectionContent,
  renderInstanceDetailSectionAvailability,
} from '../components/InstanceDetailSectionContent';
import { InstanceDetailWorkbenchChrome } from '../components/InstanceDetailWorkbenchChrome';
import {
  buildAgentSectionContent,
  buildAgentSectionProps,
  buildLlmProvidersSectionContent,
  buildLlmProviderDialogStateHandlers,
  buildLlmProviderDialogProps,
  buildLlmProviderSectionProps,
  buildMemoryWorkbenchSectionContent,
  buildMemoryWorkbenchSectionProps,
  buildConfigToolsSectionContent,
  buildConfigToolsSectionProps,
  buildTasksSectionContent,
} from '../components/instanceDetailSectionModels';
import {
  buildTaskScheduleSummary,
  getCapabilityTone,
  getDangerBadge,
  getManagementEntryTone,
  getRuntimeStatusTone,
  getStatusBadge,
} from '../components/instanceDetailWorkbenchPresentation';
import {
  applyInstanceDetailInstanceSwitchResetState,
  buildOpenClawAgentDialogStateHandlers,
  createOpenClawAgentCreateDialogState,
  applyInstanceDetailAgentWorkbenchSyncState,
  createInstanceDetailAgentMutationExecutors,
  createInstanceDetailAgentSkillMutationExecutors,
  createInstanceDetailAgentMutationStateBindings,
  createInstanceDetailConsoleErrorReporters,
  createInstanceDetailConfigMutationExecutors,
  createInstanceDetailDeleteHandlerBindings,
  createInstanceDetailConfigChannelMutationExecutors,
  createInstanceDetailLifecycleMutationExecutors,
  createInstanceDetailProviderDeleteStateBindings,
  buildInstanceDetailNavigationHandlers,
  createInstanceDetailProviderCatalogMutationExecutors,
  createInstanceDetailSilentWorkbenchReloadHandler,
  createInstanceDetailWorkbenchReloadHandlers,
  createInstanceDetailWorkbenchLoaderBindings,
  createInstanceDetailToastReporters,
  createInstanceDetailSectionAvailabilityRenderer,
  applyInstanceDetailConfigAuthCooldownsSyncState,
  applyInstanceDetailConfigDreamingSyncState,
  applyInstanceDetailConfigWebFetchSyncState,
  applyInstanceDetailConfigWebSearchNativeCodexSyncState,
  applyInstanceDetailConfigWebSearchSyncState,
  applyInstanceDetailConfigXSearchSyncState,
  buildOpenClawAgentMutationHandlers,
  buildOpenClawAgentSkillMutationHandlers,
  buildInstanceDeleteHandler,
  buildInstanceLifecycleActionHandlers,
  buildBundledStartupRecoveryHandler,
  buildInstanceConsoleHandlers,
  createInstanceLifecycleActionRunner,
  buildOpenClawConfigChannelStateHandlers,
  createOpenClawAgentMutationRunner,
  createOpenClawAgentSkillMutationRunner,
  createSharedStatusLabelGetter,
  createOpenClawWebFetchDraftState,
  buildOpenClawConfigChannelWorkspaceSyncState,
  buildOpenClawConfigChannelMutationHandlers,
  createOpenClawConfigChannelMutationRunner,
  buildOpenClawConfigDraftChangeHandlers,
  buildOpenClawConfigMutationHandlers,
  createOpenClawConfigSaveRunner,
  buildOpenClawProviderMutationHandlers,
  createOpenClawProviderCatalogMutationRunner,
  createOpenClawProviderDialogResetDrafts,
  buildOpenClawProviderWorkspaceSyncState,
  formatWorkbenchLabel,
  getOpenClawWorkbenchFromModulePayload,
  startLoadInstanceDetailAgentWorkbench,
  startLoadInstanceDetailWorkbench,
  startLazyLoadInstanceWorkbenchFiles,
  startLazyLoadInstanceWorkbenchMemory,
  type OpenClawAuthCooldownsDraftValue as OpenClawAuthCooldownsFormState,
  type OpenClawDreamingFormState,
  type OpenClawWebFetchFallbackDraftValue as OpenClawWebFetchFallbackFormState,
  type OpenClawWebFetchSharedDraftValue as OpenClawWebFetchSharedFormState,
  type OpenClawWebSearchNativeCodexDraftValue as OpenClawWebSearchNativeCodexFormState,
  type OpenClawWebSearchProviderDraftValue as OpenClawWebSearchProviderFormState,
  type OpenClawWebSearchSharedDraftValue as OpenClawWebSearchSharedFormState,
  type OpenClawXSearchDraftValue as OpenClawXSearchFormState,
  type OpenClawProviderFormState,
  type OpenClawProviderModelFormState,
} from '../services';
import {
  agentWorkbenchService,
  agentSkillManagementService,
  type AgentWorkbenchSnapshot,
  buildInstanceDetailDerivedState,
  BUILT_IN_OPENCLAW_STARTUP_REFRESH_INTERVAL_MS,
  createOpenClawAgentFormState,
  hasPendingBuiltInOpenClawWorkbenchStartup,
  instanceService,
  instanceWorkbenchService,
  shouldRefreshWorkbenchForBuiltInOpenClawStatusChange,
  type InstanceDetailPageProps,
  type OpenClawAgentFormState,
} from '../services';
import type {
  InstanceConfig,
  InstanceLLMProviderUpdate,
  InstanceWorkbenchSectionId,
  InstanceWorkbenchSnapshot,
} from '../types';

const INSTANCE_DETAIL_DEEP_LINK_SECTIONS = new Set<InstanceWorkbenchSectionId>([
  'overview',
  'channels',
  'cronTasks',
  'llmProviders',
  'agents',
  'skills',
  'files',
  'memory',
  'tools',
  'config',
]);

export function OpenClawInstanceDetailPage({
  source,
  onOpenAgentMarketModal,
}: InstanceDetailPageProps) {
  const { t } = useTranslation();
  const { id: routeInstanceId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const id = source.instanceId ?? routeInstanceId;
  const navigate = useNavigate();
  const { activeInstanceId, setActiveInstanceId } = useInstanceStore();
  const [activeSection, setActiveSection] = useState<InstanceWorkbenchSectionId>('overview');
  const [workbench, setWorkbench] = useState<InstanceWorkbenchSnapshot | null>(null);
  const [config, setConfig] = useState<InstanceConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorkbenchFilesLoading, setIsWorkbenchFilesLoading] = useState(false);
  const [isWorkbenchMemoryLoading, setIsWorkbenchMemoryLoading] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [providerDrafts, setProviderDrafts] = useState<Record<string, InstanceLLMProviderUpdate>>({});
  const [providerRequestDrafts, setProviderRequestDrafts] = useState<Record<string, string>>({});
  const [isSavingProviderConfig, setIsSavingProviderConfig] = useState(false);
  const [isProviderDialogOpen, setIsProviderDialogOpen] = useState(false);
  const [providerDialogDraft, setProviderDialogDraft] = useState<OpenClawProviderFormState>(
    () => createOpenClawProviderDialogResetDrafts().providerDialogDraft,
  );
  const [isSavingProviderDialog, setIsSavingProviderDialog] = useState(false);
  const [isProviderModelDialogOpen, setIsProviderModelDialogOpen] = useState(false);
  const [providerModelDialogDraft, setProviderModelDialogDraft] =
    useState<OpenClawProviderModelFormState>(
      () => createOpenClawProviderDialogResetDrafts().providerModelDialogDraft,
    );
  const [isSavingProviderModelDialog, setIsSavingProviderModelDialog] = useState(false);
  const [providerModelDeleteId, setProviderModelDeleteId] = useState<string | null>(null);
  const [providerDeleteId, setProviderDeleteId] = useState<string | null>(null);
  const [selectedConfigChannelId, setSelectedConfigChannelId] = useState<string | null>(null);
  const [configChannelDrafts, setConfigChannelDrafts] = useState<Record<string, Record<string, string>>>({});
  const [configChannelError, setConfigChannelError] = useState<string | null>(null);
  const [isSavingConfigChannel, setIsSavingConfigChannel] = useState(false);
  const [selectedWebSearchProviderId, setSelectedWebSearchProviderId] = useState<string | null>(null);
  const [webSearchSharedDraft, setWebSearchSharedDraft] =
    useState<OpenClawWebSearchSharedFormState | null>(null);
  const [webSearchProviderDrafts, setWebSearchProviderDrafts] =
    useState<Record<string, OpenClawWebSearchProviderFormState>>({});
  const [webSearchError, setWebSearchError] = useState<string | null>(null);
  const [isSavingWebSearch, setIsSavingWebSearch] = useState(false);
  const [xSearchDraft, setXSearchDraft] = useState<OpenClawXSearchFormState | null>(null);
  const [xSearchError, setXSearchError] = useState<string | null>(null);
  const [isSavingXSearch, setIsSavingXSearch] = useState(false);
  const [webSearchNativeCodexDraft, setWebSearchNativeCodexDraft] =
    useState<OpenClawWebSearchNativeCodexFormState | null>(null);
  const [webSearchNativeCodexError, setWebSearchNativeCodexError] = useState<string | null>(null);
  const [isSavingWebSearchNativeCodex, setIsSavingWebSearchNativeCodex] = useState(false);
  const [webFetchSharedDraft, setWebFetchSharedDraft] =
    useState<OpenClawWebFetchSharedFormState | null>(null);
  const [webFetchFallbackDraft, setWebFetchFallbackDraft] =
    useState<OpenClawWebFetchFallbackFormState>(createOpenClawWebFetchDraftState(null).fallbackDraft);
  const [webFetchError, setWebFetchError] = useState<string | null>(null);
  const [isSavingWebFetch, setIsSavingWebFetch] = useState(false);
  const [authCooldownsDraft, setAuthCooldownsDraft] =
    useState<OpenClawAuthCooldownsFormState | null>(null);
  const [authCooldownsError, setAuthCooldownsError] = useState<string | null>(null);
  const [isSavingAuthCooldowns, setIsSavingAuthCooldowns] = useState(false);
  const [dreamingDraft, setDreamingDraft] = useState<OpenClawDreamingFormState | null>(null);
  const [dreamingError, setDreamingError] = useState<string | null>(null);
  const [isSavingDreaming, setIsSavingDreaming] = useState(false);
  const [isRetryingBundledStartup, setIsRetryingBundledStartup] = useState(false);
  const [isAgentCreationWorkflowOpen, setIsAgentCreationWorkflowOpen] = useState(false);
  const [isAgentDialogOpen, setIsAgentDialogOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedAgentWorkbench, setSelectedAgentWorkbench] =
    useState<Awaited<ReturnType<typeof agentWorkbenchService.getAgentWorkbench>> | null>(null);
  const [agentWorkbenchError, setAgentWorkbenchError] = useState<string | null>(null);
  const [isAgentWorkbenchLoading, setIsAgentWorkbenchLoading] = useState(false);
  const [agentDialogDraft, setAgentDialogDraft] = useState<OpenClawAgentFormState>(
    createOpenClawAgentFormState(null),
  );
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [isSavingAgentDialog, setIsSavingAgentDialog] = useState(false);
  const [agentDeleteId, setAgentDeleteId] = useState<string | null>(null);
  const [isInstallingAgentSkill, setIsInstallingAgentSkill] = useState(false);
  const [updatingAgentSkillKeys, setUpdatingAgentSkillKeys] = useState<string[]>([]);
  const [removingAgentSkillKeys, setRemovingAgentSkillKeys] = useState<string[]>([]);
  const requestedSectionId = searchParams.get('section')?.trim() ?? null;
  const requestedAgentId = searchParams.get('agentId')?.trim() ?? null;
  const loadWorkbenchRequestRef = useRef<ReturnType<typeof startLoadInstanceDetailWorkbench> | null>(null);
  const consoleErrorReporters = createInstanceDetailConsoleErrorReporters({
    console,
  });
  const getDiagnosticOpenFailureLabel = () => {
    const translated = t('instances.detail.toasts.failedToOpenDiagnosticPath');
    return translated === 'instances.detail.toasts.failedToOpenDiagnosticPath'
      ? 'Failed to open the diagnostic location'
      : translated;
  };

  const loadWorkbench = async (
    targetInstanceId: string,
    options: {
      withSpinner?: boolean;
      preserveStateOnError?: boolean;
    } = {},
  ) => {
    loadWorkbenchRequestRef.current?.cancel();
    const request = startLoadInstanceDetailWorkbench({
      targetInstanceId,
      withSpinner: options.withSpinner,
      preserveStateOnError: options.preserveStateOnError,
      setWorkbench,
      setConfig,
      setIsLoading,
      loadWorkbench: async (instanceId) => (
        source.instanceId === instanceId
          ? getOpenClawWorkbenchFromModulePayload(await source.loadModulePayload())
              ?? await instanceWorkbenchService.getInstanceWorkbench(instanceId)
              ?? null
          : await instanceWorkbenchService.getInstanceWorkbench(instanceId)
      ),
      reportError: consoleErrorReporters.reportWorkbenchLoadError,
    });
    loadWorkbenchRequestRef.current = request;
    await request.promise;
  };

  useEffect(() => () => {
    loadWorkbenchRequestRef.current?.cancel();
  }, []);

  useEffect(() => {
    if (!id) {
      loadWorkbenchRequestRef.current?.cancel();
      setIsLoading(false);
      setWorkbench(null);
      setConfig(null);
      return;
    }

    void loadWorkbench(id);
  }, [id]);

  useEffect(() => {
    if (!requestedSectionId || !INSTANCE_DETAIL_DEEP_LINK_SECTIONS.has(requestedSectionId as InstanceWorkbenchSectionId)) {
      return;
    }

    setActiveSection(requestedSectionId as InstanceWorkbenchSectionId);
  }, [requestedSectionId]);

  useEffect(() => {
    if (!requestedAgentId) {
      return;
    }

    setSelectedAgentId(requestedAgentId);
  }, [requestedAgentId]);

  const handleBuiltInOpenClawStatusChanged = useEffectEvent(
    (event: { instanceId: string }) => {
      if (!shouldRefreshWorkbenchForBuiltInOpenClawStatusChange(id, workbench, event)) {
        return;
      }

      void loadWorkbench(event.instanceId, {
        withSpinner: false,
        preserveStateOnError: true,
      });
    },
  );

  useEffect(() => {
    let disposed = false;
    let unsubscribe = () => {};

    void runtime
      .subscribeBuiltInOpenClawStatusChanged((event) => {
        handleBuiltInOpenClawStatusChanged(event);
      })
      .then((nextUnsubscribe) => {
        if (disposed) {
          void nextUnsubscribe();
          return;
        }

        unsubscribe = nextUnsubscribe;
      })
      .catch((error) => {
        console.warn('Failed to subscribe to built-in OpenClaw status changes:', error);
      });

    return () => {
      disposed = true;
      void unsubscribe();
    };
  }, [handleBuiltInOpenClawStatusChanged]);

  useEffect(() => {
    if (!id || !hasPendingBuiltInOpenClawWorkbenchStartup(workbench)) {
      return;
    }

    const timeoutHandle = window.setTimeout(() => {
      void loadWorkbench(id, {
        withSpinner: false,
        preserveStateOnError: true,
      });
    }, BUILT_IN_OPENCLAW_STARTUP_REFRESH_INTERVAL_MS);

    return () => {
      window.clearTimeout(timeoutHandle);
    };
  }, [id, workbench]);

  useEffect(() => {
    const providers = workbench?.llmProviders || [];
    const providerWorkspaceSyncState = buildOpenClawProviderWorkspaceSyncState({
      providers,
    });

    setSelectedProviderId(providerWorkspaceSyncState.resolveSelectedProviderId);
    setProviderDrafts(providerWorkspaceSyncState.providerDrafts);
    setProviderRequestDrafts(providerWorkspaceSyncState.providerRequestDrafts);
  }, [workbench?.llmProviders]);

  useEffect(() => {
    const configChannels = workbench?.configChannels || [];
    const configChannelWorkspaceSyncState = buildOpenClawConfigChannelWorkspaceSyncState({
      configChannels,
    });

    setSelectedConfigChannelId(configChannelWorkspaceSyncState.resolveSelectedConfigChannelId);
    setConfigChannelDrafts(configChannelWorkspaceSyncState.configChannelDrafts);
    setConfigChannelError(configChannelWorkspaceSyncState.configChannelError);
  }, [workbench?.configChannels]);

  useEffect(() => {
    const configWebSearch = workbench?.configWebSearch || null;

    applyInstanceDetailConfigWebSearchSyncState({
      config: configWebSearch,
      currentProviderId: selectedWebSearchProviderId,
      setSelectedWebSearchProviderId,
      setWebSearchSharedDraft,
      setWebSearchProviderDrafts,
      setWebSearchError,
    });
  }, [workbench?.configWebSearch]);

  useEffect(() => {
    const configAuthCooldowns = workbench?.configAuthCooldowns || null;

    applyInstanceDetailConfigAuthCooldownsSyncState({
      config: configAuthCooldowns,
      setAuthCooldownsDraft,
      setAuthCooldownsError,
    });
  }, [workbench?.configAuthCooldowns]);

  useEffect(() => {
    const configDreaming = workbench?.configDreaming || null;

    applyInstanceDetailConfigDreamingSyncState({
      config: configDreaming,
      setDreamingDraft,
      setDreamingError,
    });
  }, [workbench?.configDreaming]);

  useEffect(() => {
    const configXSearch = workbench?.configXSearch || null;

    applyInstanceDetailConfigXSearchSyncState({
      config: configXSearch,
      setXSearchDraft,
      setXSearchError,
    });
  }, [workbench?.configXSearch]);

  useEffect(() => {
    const configWebSearchNativeCodex = workbench?.configWebSearchNativeCodex || null;

    applyInstanceDetailConfigWebSearchNativeCodexSyncState({
      config: configWebSearchNativeCodex,
      setWebSearchNativeCodexDraft,
      setWebSearchNativeCodexError,
    });
  }, [workbench?.configWebSearchNativeCodex]);

  useEffect(() => {
    const configWebFetch = workbench?.configWebFetch || null;

    applyInstanceDetailConfigWebFetchSyncState({
      config: configWebFetch,
      setWebFetchSharedDraft,
      setWebFetchFallbackDraft,
      setWebFetchError,
    });
  }, [workbench?.configWebFetch]);

  useEffect(() => {
    const agents = workbench?.agents || [];

    applyInstanceDetailAgentWorkbenchSyncState({
      agents,
      setSelectedAgentId,
      setSelectedAgentWorkbench,
      setAgentWorkbenchError,
      setIsAgentWorkbenchLoading,
    });
  }, [workbench?.agents]);

  useEffect(() => {
    applyInstanceDetailInstanceSwitchResetState({
      providerDialogResetDrafts: createOpenClawProviderDialogResetDrafts(),
      setIsWorkbenchFilesLoading,
      setIsWorkbenchMemoryLoading,
      setIsProviderDialogOpen,
      setProviderDialogDraft,
      setProviderRequestDrafts,
      setIsProviderModelDialogOpen,
      setProviderModelDialogDraft,
      setProviderModelDeleteId,
      setProviderDeleteId,
      setSelectedWebSearchProviderId,
      setWebSearchSharedDraft,
      setWebSearchProviderDrafts,
      setWebSearchError,
      setIsSavingWebSearch,
      setXSearchDraft,
      setXSearchError,
      setIsSavingXSearch,
      setWebSearchNativeCodexDraft,
      setWebSearchNativeCodexError,
      setIsSavingWebSearchNativeCodex,
      setWebFetchSharedDraft,
      setWebFetchFallbackDraft,
      setWebFetchError,
      setIsSavingWebFetch,
      setAuthCooldownsDraft,
      setAuthCooldownsError,
      setIsSavingAuthCooldowns,
      setDreamingDraft,
      setDreamingError,
      setIsSavingDreaming,
      setIsAgentCreationWorkflowOpen,
      setIsAgentDialogOpen,
      setSelectedAgentId,
      setSelectedAgentWorkbench,
      setAgentWorkbenchError,
      setIsAgentWorkbenchLoading,
      setAgentDialogDraft,
      setEditingAgentId,
      setAgentDeleteId,
      setIsInstallingAgentSkill,
      setUpdatingAgentSkillKeys,
      setRemovingAgentSkillKeys,
    });
  }, [id]);

  const instance = workbench?.instance || null;
  const instanceDetailDerivedState = useMemo(
    () =>
      buildInstanceDetailDerivedState({
        id,
        workbench,
        selectedProviderId,
        providerDeleteId,
        providerModelDeleteId,
        providerDrafts,
        providerRequestDrafts,
        selectedConfigChannelId,
        configChannelDrafts,
        selectedWebSearchProviderId,
        webSearchProviderDrafts,
        providerDialogDraft,
        t,
      }),
    [
      id,
      configChannelDrafts,
      providerDeleteId,
      providerDialogDraft,
      providerDrafts,
      providerModelDeleteId,
      providerRequestDrafts,
      selectedConfigChannelId,
      selectedProviderId,
      selectedWebSearchProviderId,
      t,
      webSearchProviderDrafts,
      workbench,
    ],
  );
  const {
    workbench: displayWorkbench,
    detail,
    configFilePath,
    configChannels,
    configWebSearch,
    configXSearch,
    configWebSearchNativeCodex,
    configWebFetch,
    configAuthCooldowns,
    configDreaming,
    isOpenClawConfigWritable,
    canControlLifecycle,
    canRestartLifecycle,
    canStopLifecycle,
    canStartLifecycle,
    canDelete,
    canSetActive,
    canEditConfigChannels,
    canEditConfigWebSearch,
    canEditConfigXSearch,
    canEditConfigWebSearchNativeCodex,
    canEditConfigWebFetch,
    canEditConfigAuthCooldowns,
    canEditDreamingConfig,
    isProviderConfigReadonly,
    canManageOpenClawProviders,
    canOpenControlPage,
    memoryWorkbenchState,
    managementSummary,
    providerSelectionState,
    configChannelSelectionState,
    webSearchProviderSelectionState,
    providerDialogPresentation,
    availableAgentModelOptions,
    readonlyChannelWorkspaceItems,
    configChannelWorkspaceItems,
  } = instanceDetailDerivedState;
  const {
    selectedProvider,
    deletingProvider,
    deletingProviderModel,
    selectedProviderDraft,
    selectedProviderRequestDraft,
    selectedProviderRequestParseError,
    hasPendingProviderChanges,
  } = providerSelectionState;
  const { selectedConfigChannel, selectedConfigChannelDraft } = configChannelSelectionState;
  const { selectedProvider: selectedWebSearchProvider, selectedProviderDraft: selectedWebSearchProviderDraft } =
    webSearchProviderSelectionState;
  const {
    models: providerDialogModels,
    requestParseError: providerDialogRequestParseError,
  } = providerDialogPresentation;
  const workbenchLoaderBindings = createInstanceDetailWorkbenchLoaderBindings({
    agentWorkbenchService,
    instanceWorkbenchService,
  });

  useEffect(() => {
    return startLoadInstanceDetailAgentWorkbench({
      activeSection,
      instanceId: id,
      workbench: displayWorkbench,
      selectedAgentId,
      setSelectedAgentWorkbench,
      setAgentWorkbenchError,
      setIsAgentWorkbenchLoading,
      loadAgentWorkbench: workbenchLoaderBindings.loadAgentWorkbench,
      reportError: consoleErrorReporters.reportAgentWorkbenchLoadError,
      fallbackErrorMessage: 'Failed to load agent detail.',
    });
  }, [activeSection, displayWorkbench, id, selectedAgentId]);

  useEffect(() => {
    return startLazyLoadInstanceWorkbenchFiles({
      activeSection,
      detail,
      instanceId: id,
      workbench: displayWorkbench,
      setIsLoading: setIsWorkbenchFilesLoading,
      setWorkbench,
      loadFiles: workbenchLoaderBindings.loadFiles,
      reportError: consoleErrorReporters.reportInstanceFilesLoadError,
    });
  }, [activeSection, detail, displayWorkbench, id]);

  useEffect(() => {
    return startLazyLoadInstanceWorkbenchMemory({
      activeSection,
      detail,
      instanceId: id,
      workbench: displayWorkbench,
      setIsLoading: setIsWorkbenchMemoryLoading,
      setWorkbench,
      loadMemories: workbenchLoaderBindings.loadMemories,
      reportError: consoleErrorReporters.reportInstanceMemoriesLoadError,
    });
  }, [activeSection, detail, displayWorkbench, id]);
  const editorTheme =
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
      ? 'vs-dark'
      : 'vs';
  const workbenchReloadHandlers = createInstanceDetailWorkbenchReloadHandlers({
    loadWorkbench,
  });
  const toastReporters = createInstanceDetailToastReporters({
    toast,
  });

  const getSharedStatusLabel = createSharedStatusLabelGetter(t);
  const detailNavigationHandlers = buildInstanceDetailNavigationHandlers({
    instance,
    navigate,
    openAgentMarketModal: () => {
      onOpenAgentMarketModal({
        instanceId: id ?? null,
        onInstalled: async (result: CreateKernelAgentResult) => {
          if (!id || result.instanceId !== id) {
            return;
          }

          setSelectedAgentId(result.agentId);
          await loadWorkbench(result.instanceId, {
            withSpinner: false,
            preserveStateOnError: true,
          });
        },
      });
    },
    setActiveInstanceId,
  });
  const handleAgentCreated = useEffectEvent(async (result: CreateKernelAgentResult) => {
    if (!id || result.instanceId !== id) {
      return;
    }

    setSelectedAgentId(result.agentId);
    await loadWorkbench(result.instanceId, {
      withSpinner: false,
      preserveStateOnError: true,
    });
  });
  const openAgentCreationWorkflow = () => {
    const dialogState = createOpenClawAgentCreateDialogState();

    setEditingAgentId(dialogState.editingAgentId);
    setAgentDialogDraft(dialogState.draft);
    setIsAgentCreationWorkflowOpen(true);
  };

  const agentDialogStateHandlers = buildOpenClawAgentDialogStateHandlers({
    selectedAgentWorkbench,
    setEditingAgentId,
    setAgentDialogDraft,
    setIsAgentDialogOpen,
  });
  const agentMutationStateBindings = createInstanceDetailAgentMutationStateBindings({
    setIsAgentCreationWorkflowOpen,
    setIsAgentDialogOpen,
    setEditingAgentId,
    setAgentDeleteId,
  });
  const providerDeleteStateBindings = createInstanceDetailProviderDeleteStateBindings({
    setProviderDeleteId,
    setProviderModelDeleteId,
  });

  const providerDialogStateHandlers = buildLlmProviderDialogStateHandlers({
    setIsProviderDialogOpen: setIsProviderDialogOpen,
    setProviderDialogDraft: setProviderDialogDraft,
    setIsProviderModelDialogOpen: setIsProviderModelDialogOpen,
    setProviderModelDialogDraft: setProviderModelDialogDraft,
    setProviderDeleteId: providerDeleteStateBindings.setProviderDeleteId,
    setProviderModelDeleteId: providerDeleteStateBindings.setProviderModelDeleteId,
  });
  const providerCatalogMutationExecutors = createInstanceDetailProviderCatalogMutationExecutors({
    instanceService,
  });

  const runProviderCatalogMutation = createOpenClawProviderCatalogMutationRunner({
    ...providerCatalogMutationExecutors,
    reloadWorkbench: workbenchReloadHandlers.reloadWorkbench,
    setSelectedProviderId,
    reportSuccess: toastReporters.reportSuccess,
    reportError: toastReporters.reportError,
    t,
  });

  const providerMutationHandlers = buildOpenClawProviderMutationHandlers({
    isReadonly: isProviderConfigReadonly,
    instanceId: id,
    selectedProvider,
    selectedProviderDraft,
    selectedProviderRequestDraft,
    setSavingProviderConfig: setIsSavingProviderConfig,
    providerDialogDraft,
    providerDialogModels,
    dismissProviderDialog: providerDialogStateHandlers.dismissProviderDialog,
    setSavingProviderDialog: setIsSavingProviderDialog,
    providerModelDialogDraft,
    dismissProviderModelDialog: providerDialogStateHandlers.dismissProviderModelDialog,
    setSavingProviderModelDialog: setIsSavingProviderModelDialog,
    providerModelDeleteId,
    clearProviderModelDeleteId: providerDeleteStateBindings.clearProviderModelDeleteId,
    providerDeleteId,
    clearProviderDeleteId: providerDeleteStateBindings.clearProviderDeleteId,
    executeMutation: runProviderCatalogMutation,
    reportError: toastReporters.reportError,
    t,
  });

  const runAgentSkillMutation = createOpenClawAgentSkillMutationRunner({
    reloadWorkbench: workbenchReloadHandlers.reloadWorkbench,
    reportSuccess: toastReporters.reportSuccess,
    reportError: toastReporters.reportError,
    t,
  });
  const agentSkillMutationExecutors = createInstanceDetailAgentSkillMutationExecutors({
    agentSkillManagementService,
  });

  const agentSkillMutationHandlers = buildOpenClawAgentSkillMutationHandlers({
    instanceId: id,
    selectedAgent: selectedAgentWorkbench,
    setInstallingSkill: setIsInstallingAgentSkill,
    setUpdatingSkillKeys: setUpdatingAgentSkillKeys,
    setRemovingSkillKeys: setRemovingAgentSkillKeys,
    ...agentSkillMutationExecutors,
    executeMutation: runAgentSkillMutation,
  });

  const agentMutationExecutors = createInstanceDetailAgentMutationExecutors({
    instanceService,
  });
  const runAgentMutation = createOpenClawAgentMutationRunner({
    ...agentMutationExecutors,
    reloadWorkbench: workbenchReloadHandlers.reloadWorkbench,
    reportSuccess: toastReporters.reportSuccess,
    reportError: toastReporters.reportError,
    t,
  });

  const agentMutationHandlers = buildOpenClawAgentMutationHandlers({
    instanceId: id,
    editingAgentId,
    agentDialogDraft,
    setSavingAgentDialog: setIsSavingAgentDialog,
    dismissAgentDialog: agentMutationStateBindings.dismissAgentDialog,
    agentDeleteId,
    clearAgentDeleteId: agentMutationStateBindings.clearAgentDeleteId,
    executeMutation: runAgentMutation,
    afterSaveSuccess: async (agent, kind) => {
      if (kind !== 'create' || !id) {
        return;
      }

      await handleAgentCreated({
        instanceId: id,
        kernelId: displayWorkbench?.detail.instance.runtimeKind || 'openclaw',
        agentId: agent.id,
        displayName: agent.name || agent.id,
      });
    },
    reportError: toastReporters.reportError,
    t,
  });

  const baseRunLifecycleAction = createInstanceLifecycleActionRunner({
    reloadWorkbench: workbenchReloadHandlers.reloadWorkbenchImmediately,
    reportSuccess: toastReporters.reportSuccess,
    reportError: toastReporters.reportError,
    t,
  });
  const lifecycleMutationExecutors = createInstanceDetailLifecycleMutationExecutors({
    instanceService,
  });
  const runLifecycleAction = async (request: {
    instanceId: string;
    execute: (instanceId: string) => Promise<void>;
    successKey: string;
    failureKey: string;
  }) => {
    const didSucceed = await baseRunLifecycleAction(request);
    if (
      didSucceed &&
      (request.successKey === 'instances.detail.toasts.started' ||
        request.successKey === 'instances.detail.toasts.restarted' ||
        request.successKey === 'instances.detail.toasts.retriedBundledStartup')
    ) {
      setActiveInstanceId(request.instanceId);
    }
    await instanceDirectoryService.refresh().catch(() => undefined);
    return didSucceed;
  };
  const lifecycleActionHandlers = buildInstanceLifecycleActionHandlers({
    instanceId: id,
    runLifecycleAction,
    ...lifecycleMutationExecutors,
  });
  const canRetryBundledStartup = Boolean(
    managementSummary?.alert && (canStartLifecycle || canRestartLifecycle),
  );
  const onRetryBundledStartup = buildBundledStartupRecoveryHandler({
    instanceId: id,
    canRetryBundledStartup,
    preferRestart: canRestartLifecycle,
    runLifecycleAction: async (request) => {
      setIsRetryingBundledStartup(true);
      try {
        await runLifecycleAction(request);
      } finally {
        setIsRetryingBundledStartup(false);
      }
    },
    executeRestart: lifecycleMutationExecutors.executeRestart,
    executeStart: lifecycleMutationExecutors.executeStart,
  });
  const onOpenDiagnosticPath = async (
    diagnostic: NonNullable<NonNullable<typeof managementSummary>['alert']>['diagnostics'][number],
  ) => {
    const mode =
      diagnostic.id === 'desktopMainLogPath'
        ? 'reveal'
        : diagnostic.id === 'gatewayLogPath'
          ? 'open'
          : null;
    if (!mode) {
      return;
    }

    try {
      await openDiagnosticPath(diagnostic.value, { mode });
    } catch (error: any) {
      toast.error(getDiagnosticOpenFailureLabel(), {
        description: error?.message,
      });
    }
  };
  const consoleHandlers = buildInstanceConsoleHandlers({
    consoleTarget: detail?.consoleAccess,
    openExternalLink: openExternalUrl,
    reportInfo: toastReporters.reportInfo,
    reportError: toastReporters.reportError,
    t,
  });
  const deleteHandlerBindings = createInstanceDetailDeleteHandlerBindings({
    confirmDelete: window.confirm,
    navigate,
    instanceService,
  });
  const deleteHandler = buildInstanceDeleteHandler({
    instanceId: id,
    canDelete,
    activeInstanceId,
    ...deleteHandlerBindings,
    setActiveInstanceId,
    reportSuccess: toastReporters.reportSuccess,
    reportError: toastReporters.reportError,
    t,
  });

  const configChannelMutationExecutors = createInstanceDetailConfigChannelMutationExecutors({
    instanceService,
  });
  const runConfigChannelMutation = createOpenClawConfigChannelMutationRunner({
    ...configChannelMutationExecutors,
    reloadWorkbench: workbenchReloadHandlers.reloadWorkbench,
    reportSuccess: toastReporters.reportSuccess,
    reportError: toastReporters.reportError,
  });
  const configChannelStateHandlers = buildOpenClawConfigChannelStateHandlers({
    selectedConfigChannel,
    setConfigChannelError,
    setSelectedConfigChannelId,
    setConfigChannelDrafts,
  });
  const configChannelMutationHandlers = buildOpenClawConfigChannelMutationHandlers({
    instanceId: id,
    configChannels,
    selectedConfigChannel,
    selectedConfigChannelDraft,
    setSavingConfigChannel: setIsSavingConfigChannel,
    setConfigChannelError,
    setSelectedConfigChannelId,
    setConfigChannelDrafts,
    executeMutation: runConfigChannelMutation,
  });

  const runConfigSave = createOpenClawConfigSaveRunner({
    reloadWorkbench: workbenchReloadHandlers.reloadWorkbench,
    reportSuccess: toastReporters.reportSuccess,
    t,
  });
  const configDraftChangeHandlers = buildOpenClawConfigDraftChangeHandlers({
    selectedWebSearchProvider,
    setWebSearchError,
    setWebSearchSharedDraft,
    setWebSearchProviderDrafts,
    setXSearchError,
    setXSearchDraft,
    setWebSearchNativeCodexError,
    setWebSearchNativeCodexDraft,
    setWebFetchError,
    setWebFetchSharedDraft,
    setWebFetchFallbackDraft,
    setAuthCooldownsError,
    setAuthCooldownsDraft,
    setDreamingError,
    setDreamingDraft,
  });
  const configMutationExecutors = createInstanceDetailConfigMutationExecutors({
    instanceService,
  });

  const configMutationHandlers = buildOpenClawConfigMutationHandlers({
    instanceId: id,
    executeSaveRequest: runConfigSave,
    t,
    webSearch: {
      sharedDraft: webSearchSharedDraft,
      selectedProvider: selectedWebSearchProvider,
      selectedProviderDraft: selectedWebSearchProviderDraft,
      setSaving: setIsSavingWebSearch,
      setError: setWebSearchError,
      executeSave: configMutationExecutors.webSearch.executeSave,
    },
    xSearch: {
      draft: xSearchDraft,
      setSaving: setIsSavingXSearch,
      setError: setXSearchError,
      executeSave: configMutationExecutors.xSearch.executeSave,
    },
    webSearchNativeCodex: {
      draft: webSearchNativeCodexDraft,
      setSaving: setIsSavingWebSearchNativeCodex,
      setError: setWebSearchNativeCodexError,
      executeSave: configMutationExecutors.webSearchNativeCodex.executeSave,
    },
    webFetch: {
      sharedDraft: webFetchSharedDraft,
      fallbackDraft: webFetchFallbackDraft,
      setSaving: setIsSavingWebFetch,
      setError: setWebFetchError,
      executeSave: configMutationExecutors.webFetch.executeSave,
    },
    authCooldowns: {
      draft: authCooldownsDraft,
      setSaving: setIsSavingAuthCooldowns,
      setError: setAuthCooldownsError,
      executeSave: configMutationExecutors.authCooldowns.executeSave,
    },
    dreaming: {
      draft: dreamingDraft,
      setSaving: setIsSavingDreaming,
      setError: setDreamingError,
      executeSave: configMutationExecutors.dreaming.executeSave,
    },
  });

  const renderWorkbenchSectionAvailability = createInstanceDetailSectionAvailabilityRenderer({
    workbench: displayWorkbench,
    t,
    formatWorkbenchLabel,
    getCapabilityTone,
    renderAvailability: renderInstanceDetailSectionAvailability,
  });
  const reloadCurrentWorkbenchSilently = createInstanceDetailSilentWorkbenchReloadHandler({
    instanceId: id,
    reloadWorkbench: workbenchReloadHandlers.reloadWorkbench,
  });

  const agentSectionProps = buildAgentSectionProps({
    workbench: displayWorkbench,
    selectedAgentWorkbench,
    agentWorkbenchError,
    selectedAgentId,
    onSelectedAgentIdChange: setSelectedAgentId,
    instanceId: id,
    instanceName: displayWorkbench?.instance.name || detail?.instance.name || '',
    instanceKernelId: displayWorkbench?.detail.instance.runtimeKind || 'openclaw',
    onOpenAgentCreationWorkflow: openAgentCreationWorkflow,
    onEditAgent: agentDialogStateHandlers.openEditAgentDialog,
    onRequestDeleteAgent: setAgentDeleteId,
    onInstallSkill: agentSkillMutationHandlers.onInstallAgentSkill,
    onSetSkillEnabled: agentSkillMutationHandlers.onSetAgentSkillEnabled,
    onRemoveSkill: agentSkillMutationHandlers.onRemoveAgentSkill,
    isReadonly: !isOpenClawConfigWritable,
    isLoading: isAgentWorkbenchLoading,
    isFilesLoading: isWorkbenchFilesLoading,
    isInstallingSkill: isInstallingAgentSkill,
    updatingAgentSkillKeys,
    removingAgentSkillKeys,
    loadWorkbench,
    isAgentCreationWorkflowOpen,
    isAgentDialogOpen,
    editingAgentId,
    agentDialogDraft,
    availableAgentModelOptions,
    isSavingAgentDialog,
    setIsAgentCreationWorkflowOpen,
    setIsAgentDialogOpen,
    setEditingAgentId,
    setAgentDialogDraft,
    onAgentCreated: handleAgentCreated,
    onSaveAgentCreation: agentMutationHandlers.onSaveAgentDialog,
    onSaveAgentDialog: agentMutationHandlers.onSaveAgentDialog,
    agentDeleteId,
    setAgentDeleteId,
    onDeleteAgentConfirm: agentMutationHandlers.onDeleteAgent,
  });

  const llmProviderSectionProps = buildLlmProviderSectionProps({
    workbench: displayWorkbench,
    selectedProvider,
    selectedProviderDraft,
    selectedProviderRequestDraft,
    selectedProviderRequestParseError,
    hasPendingProviderChanges,
    isSavingProviderConfig,
    isProviderConfigReadonly,
    isOpenClawConfigWritable,
    canManageOpenClawProviders,
    configFilePath,
    availabilityNotice: renderWorkbenchSectionAvailability(
      'llmProviders',
      'instances.detail.instanceWorkbench.empty.llmProviders',
    ),
    formatWorkbenchLabel,
    getDangerBadge,
    getStatusBadge,
    t,
    onOpenProviderCenter: detailNavigationHandlers.onOpenProviderCenter,
    setIsProviderDialogOpen,
    setProviderDialogDraft,
    onSelectProvider: setSelectedProviderId,
    onRequestDeleteProvider: setProviderDeleteId,
    setProviderDrafts,
    setProviderRequestDrafts,
    onSave: providerMutationHandlers.onSaveProviderConfig,
    setIsProviderModelDialogOpen,
    setProviderModelDialogDraft,
    onRequestDeleteProviderModel: setProviderModelDeleteId,
  });

  const llmProviderDialogProps = buildLlmProviderDialogProps({
    isProviderDialogOpen,
    providerDialogDraft,
    providerDialogModels,
    providerDialogRequestParseError,
    isSavingProviderDialog,
    onProviderDialogOpenChange: providerDialogStateHandlers.onProviderDialogOpenChange,
    setProviderDialogDraft,
    onSubmitProviderDialog: providerMutationHandlers.onSubmitProviderDialog,
    isProviderModelDialogOpen,
    providerModelDialogDraft,
    isSavingProviderModelDialog,
    onProviderModelDialogOpenChange: providerDialogStateHandlers.onProviderModelDialogOpenChange,
    setProviderModelDialogDraft,
    onSubmitProviderModelDialog: providerMutationHandlers.onSubmitProviderModelDialog,
    providerDeleteId,
    deletingProviderId: deletingProvider?.id || null,
    onProviderDeleteDialogOpenChange: providerDialogStateHandlers.onProviderDeleteDialogOpenChange,
    onDeleteProvider: providerMutationHandlers.onDeleteProvider,
    providerModelDeleteId,
    deletingProviderModelId: deletingProviderModel?.id || null,
    onProviderModelDeleteDialogOpenChange:
      providerDialogStateHandlers.onProviderModelDeleteDialogOpenChange,
    onDeleteProviderModel: providerMutationHandlers.onDeleteProviderModel,
    t,
  });

  const agentSectionContent = buildAgentSectionContent({
    sectionProps: agentSectionProps,
  });

  const llmProvidersSectionContent = buildLlmProvidersSectionContent({
    sectionProps: llmProviderSectionProps,
    dialogProps: llmProviderDialogProps,
  });

  const tasksSectionContent = buildTasksSectionContent({
    workbench: displayWorkbench,
    instanceId: id,
  });

  const memorySectionProps = buildMemoryWorkbenchSectionProps({
    isLoading: isWorkbenchMemoryLoading,
    loadingLabel: t('common.loading'),
    workbench: displayWorkbench,
    memoryWorkbenchState,
    configDreaming,
    dreamingDraft,
    dreamingError,
    isSavingDreaming,
    canEditDreamingConfig,
    formatWorkbenchLabel,
    getDangerBadge,
    getStatusBadge,
    t,
    onDreamingDraftChange: configDraftChangeHandlers.onDreamingDraftChange,
    onSaveDreamingConfig: configMutationHandlers.onSaveDreamingConfig,
    renderSectionAvailability: renderWorkbenchSectionAvailability,
  });

  const memorySectionContent = buildMemoryWorkbenchSectionContent({
    sectionProps: memorySectionProps,
  });

  const toolsSectionProps = buildConfigToolsSectionProps({
    workbench: displayWorkbench,
    configWebSearch,
    webSearchSharedDraft,
    selectedWebSearchProvider,
    selectedWebSearchProviderDraft,
    webSearchError,
    isSavingWebSearch,
    canEditConfigWebSearch,
    onSaveWebSearchConfig: configMutationHandlers.onSaveWebSearchConfig,
    onWebSearchSharedDraftChange: configDraftChangeHandlers.onWebSearchSharedDraftChange,
    onWebSearchProviderDraftChange:
      configDraftChangeHandlers.onWebSearchProviderDraftChange,
    onSelectedWebSearchProviderIdChange: setSelectedWebSearchProviderId,
    configWebFetch,
    webFetchSharedDraft,
    webFetchFallbackDraft,
    webFetchError,
    isSavingWebFetch,
    canEditConfigWebFetch,
    onSaveWebFetchConfig: configMutationHandlers.onSaveWebFetchConfig,
    onWebFetchSharedDraftChange: configDraftChangeHandlers.onWebFetchSharedDraftChange,
    onWebFetchFallbackDraftChange:
      configDraftChangeHandlers.onWebFetchFallbackDraftChange,
    configWebSearchNativeCodex,
    webSearchNativeCodexDraft,
    webSearchNativeCodexError,
    isSavingWebSearchNativeCodex,
    canEditConfigWebSearchNativeCodex,
    onSaveWebSearchNativeCodexConfig:
      configMutationHandlers.onSaveWebSearchNativeCodexConfig,
    onWebSearchNativeCodexDraftChange:
      configDraftChangeHandlers.onWebSearchNativeCodexDraftChange,
    configXSearch,
    xSearchDraft,
    xSearchError,
    isSavingXSearch,
    canEditConfigXSearch,
    onSaveXSearchConfig: configMutationHandlers.onSaveXSearchConfig,
    onXSearchDraftChange: configDraftChangeHandlers.onXSearchDraftChange,
    configAuthCooldowns,
    authCooldownsDraft,
    authCooldownsError,
    isSavingAuthCooldowns,
    canEditConfigAuthCooldowns,
    onSaveAuthCooldownsConfig: configMutationHandlers.onSaveAuthCooldownsConfig,
    onAuthCooldownsDraftChange:
      configDraftChangeHandlers.onAuthCooldownsDraftChange,
    formatWorkbenchLabel,
    getDangerBadge,
    getStatusBadge,
    t,
    renderSectionAvailability: renderWorkbenchSectionAvailability,
  });

  const toolsSectionContent = buildConfigToolsSectionContent({ sectionProps: toolsSectionProps });

  if (isLoading) {
    return (
      <div className="mx-auto flex h-64 max-w-6xl items-center justify-center p-4 md:p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!instance || !displayWorkbench || !config) {
    return (
      <div className="mx-auto max-w-6xl p-4 text-center md:p-8">
        <h2 className="mb-4 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          {t('instances.detail.notFoundTitle')}
        </h2>
        <button
          onClick={detailNavigationHandlers.onBackToInstances}
          className="text-primary-600 hover:underline dark:text-primary-400"
        >
          {t('instances.detail.returnToInstances')}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full p-4 md:p-6 xl:p-8 2xl:p-10">
      <button
        onClick={detailNavigationHandlers.onBackToInstances}
        className="mb-6 flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('instances.detail.backToInstances')}
      </button>

      <div className="rounded-[2rem] bg-white/80 p-6 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur dark:bg-zinc-900/82 md:p-8">
        <InstanceDetailHeader
          activeInstanceId={activeInstanceId}
          instance={instance}
          canSetActive={canSetActive}
          canOpenControlPage={canOpenControlPage}
          canControlLifecycle={canControlLifecycle}
          canRestartLifecycle={canRestartLifecycle}
          canStopLifecycle={canStopLifecycle}
          canStartLifecycle={canStartLifecycle}
          canDelete={canDelete}
          t={t}
          getSharedStatusLabel={getSharedStatusLabel}
          getStatusBadge={getStatusBadge}
          onSetActive={detailNavigationHandlers.onSetActive}
          onOpenControlPage={consoleHandlers.onOpenControlPage}
          onRestart={lifecycleActionHandlers.onRestart}
          onStop={lifecycleActionHandlers.onStop}
          onStart={lifecycleActionHandlers.onStart}
          onDelete={deleteHandler}
        />

        <InstanceDetailWorkbenchChrome
          activeSection={activeSection}
          instance={instance}
          workbench={displayWorkbench}
          t={t}
          onSectionSelect={setActiveSection}
        >
          <InstanceDetailSectionContent
            activeSection={activeSection}
            workbench={displayWorkbench}
            detail={detail ?? null}
            managementSummary={managementSummary}
            canRetryBundledStartup={canRetryBundledStartup}
            instanceId={id}
            isRetryingBundledStartup={isRetryingBundledStartup}
            config={config}
            selectedAgentId={selectedAgentId}
            isWorkbenchFilesLoading={isWorkbenchFilesLoading}
            canEditConfigChannels={canEditConfigChannels}
            configChannelWorkspaceItems={configChannelWorkspaceItems}
            readonlyChannelWorkspaceItems={readonlyChannelWorkspaceItems}
            configFilePath={configFilePath}
            selectedConfigChannelId={selectedConfigChannel?.id || null}
            configChannelDrafts={configChannelDrafts}
            configChannelError={configChannelError}
            isSavingConfigChannel={isSavingConfigChannel}
            agentSection={agentSectionContent}
            tasksSection={tasksSectionContent}
            llmProvidersSection={llmProvidersSectionContent}
            memorySection={memorySectionContent}
            toolsSection={toolsSectionContent}
            t={t}
            formatWorkbenchLabel={formatWorkbenchLabel}
            getCapabilityTone={getCapabilityTone}
            getRuntimeStatusTone={getRuntimeStatusTone}
            getManagementEntryTone={getManagementEntryTone}
            onOpenOfficialLink={consoleHandlers.onOpenOfficialLink}
            onOpenDiagnosticPath={onOpenDiagnosticPath}
            onRetryBundledStartup={onRetryBundledStartup}
            onSelectedConfigChannelIdChange={configChannelStateHandlers.onSelectedConfigChannelIdChange}
            onConfigChannelFieldChange={configChannelStateHandlers.onConfigChannelFieldChange}
            onSaveConfigChannel={configChannelMutationHandlers.onSaveConfigChannel}
            onDeleteConfigChannelConfiguration={
              configChannelMutationHandlers.onDeleteConfigChannelConfiguration
            }
            onToggleConfigChannel={configChannelMutationHandlers.onToggleConfigChannel}
            onSelectedAgentIdChange={setSelectedAgentId}
            onReloadFiles={reloadCurrentWorkbenchSilently}
            onReloadConfig={reloadCurrentWorkbenchSilently}
          />
        </InstanceDetailWorkbenchChrome>
      </div>

    </div>
  );
}
