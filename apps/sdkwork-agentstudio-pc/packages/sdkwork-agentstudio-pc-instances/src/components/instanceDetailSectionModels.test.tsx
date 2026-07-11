import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { isValidElement } from 'react';

function runTest(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

async function loadSectionModelsModule() {
  const moduleUrl = new URL('./instanceDetailSectionModels.ts', import.meta.url);

  assert.ok(
    existsSync(moduleUrl),
    'expected Instance Detail section model helper module to exist',
  );

  return import('./instanceDetailSectionModels.ts');
}

await runTest(
  'buildAgentSectionProps keeps agent skill pending keys and page-owned dialog reset wiring stable',
  async () => {
    const { buildAgentSectionProps } = await loadSectionModelsModule();
    const loadWorkbenchCalls: Array<{ instanceId: string; options: { withSpinner: boolean } }> = [];
    let isAgentDialogOpen = true;
    let isAgentCreationWorkflowOpen = true;
    let editingAgentId: string | null = 'agent-1';
    let agentDialogDraft = {
      id: 'agent-1',
      name: 'Primary Agent',
      avatar: '*',
      primaryModel: '',
      fallbackModelsText: '',
      workspace: '',
      agentDir: '',
      temperature: '',
      topP: '',
      maxTokens: '',
      timeoutMs: '',
      isDefault: false,
      streamingMode: 'inherit',
    };
    let clearedAgentDeleteId: string | null = 'agent-1';

    const props = buildAgentSectionProps({
      workbench: {
        agents: [{ id: 'agent-1' }],
      } as any,
      selectedAgentWorkbench: { id: 'agent-1' } as any,
      agentWorkbenchError: 'agent-workbench-error',
      selectedAgentId: 'agent-1',
      onSelectedAgentIdChange: () => undefined,
      instanceId: 'instance-1',
      instanceName: 'Primary Instance',
      instanceKernelId: 'openclaw',
      onOpenAgentCreationWorkflow: () => undefined,
      onEditAgent: () => undefined,
      onRequestDeleteAgent: () => undefined,
      onInstallSkill: () => undefined,
      onSetSkillEnabled: () => undefined,
      onRemoveSkill: () => undefined,
      isReadonly: false,
      isLoading: false,
      isFilesLoading: true,
      isInstallingSkill: true,
      updatingAgentSkillKeys: ['agent-1:skill-install'],
      removingAgentSkillKeys: ['agent-1:skill-remove'],
      loadWorkbench: (instanceId: string, options: { withSpinner: boolean }) => {
        loadWorkbenchCalls.push({ instanceId, options });
      },
      isAgentCreationWorkflowOpen: true,
      setIsAgentCreationWorkflowOpen: (open: boolean) => {
        isAgentCreationWorkflowOpen = open;
      },
      isAgentDialogOpen: true,
      editingAgentId: 'agent-1',
      agentDialogDraft,
      availableAgentModelOptions: [{ value: 'gpt-5.4', label: 'GPT-5.4' }],
      isSavingAgentDialog: false,
      setIsAgentDialogOpen: (open: boolean) => {
        isAgentDialogOpen = open;
      },
      setEditingAgentId: (value: string | null) => {
        editingAgentId = value;
      },
      setAgentDialogDraft: (updater: (current: typeof agentDialogDraft) => typeof agentDialogDraft) => {
        agentDialogDraft = updater(agentDialogDraft);
      },
      onAgentCreationDraftReplace: (draft: typeof agentDialogDraft) => {
        agentDialogDraft = draft;
      },
      onAgentCreated: () => undefined,
      onSaveAgentCreation: () => undefined,
      onSaveAgentDialog: () => undefined,
      agentDeleteId: 'agent-1',
      setAgentDeleteId: (value: string | null) => {
        clearedAgentDeleteId = value;
      },
      onDeleteAgentConfirm: () => undefined,
    });

    assert.ok(props);
    assert.deepEqual(props.updatingSkillKeys, ['agent-1:skill-install']);
    assert.deepEqual(props.removingSkillKeys, ['agent-1:skill-remove']);

    await props.onReload();
    assert.deepEqual(loadWorkbenchCalls, [
      {
        instanceId: 'instance-1',
        options: { withSpinner: false },
      },
    ]);

    props.onAgentDialogFieldChange('name', 'Renamed Agent');
    assert.equal(agentDialogDraft.name, 'Renamed Agent');

    props.onAgentDialogDefaultChange(true);
    assert.equal(agentDialogDraft.isDefault, true);

    props.onAgentDialogStreamingModeChange('enabled');
    assert.equal(agentDialogDraft.streamingMode, 'enabled');

    props.onAgentCreationWorkflowOpenChange(false);
    assert.equal(isAgentCreationWorkflowOpen, false);
    assert.equal(editingAgentId, null);
    assert.equal(agentDialogDraft.id, '');
    assert.equal(agentDialogDraft.name, '');
    assert.equal(agentDialogDraft.streamingMode, 'inherit');

    props.onAgentDialogOpenChange(false);
    assert.equal(isAgentDialogOpen, false);
    assert.equal(editingAgentId, null);
    assert.equal(agentDialogDraft.id, '');
    assert.equal(agentDialogDraft.name, '');
    assert.equal(agentDialogDraft.streamingMode, 'inherit');

    props.onAgentDeleteDialogOpenChange(false);
    assert.equal(clearedAgentDeleteId, null);
  },
);

await runTest(
  'buildLlmProviderSectionProps preserves empty provider workspaces and availability notice content',
  async () => {
    const { buildLlmProviderSectionProps } = await loadSectionModelsModule();
    const availabilityNotice = 'instances.detail.instanceWorkbench.empty.llmProviders';

    const props = buildLlmProviderSectionProps({
      workbench: {
        llmProviders: [],
      } as any,
      selectedProvider: null,
      selectedProviderDraft: null,
      selectedProviderRequestDraft: '',
      selectedProviderRequestParseError: null,
      hasPendingProviderChanges: false,
      isSavingProviderConfig: false,
      isProviderConfigReadonly: true,
      isOpenClawConfigWritable: false,
      canManageOpenClawProviders: false,
      configFilePath: '/managed/openclaw/providers.json',
      availabilityNotice,
      formatWorkbenchLabel: (value: string) => `label:${value}`,
      getDangerBadge: (value: string) => `danger:${value}`,
      getStatusBadge: (value: string) => `status:${value}`,
      t: (key: string) => key,
      onOpenProviderCenter: () => undefined,
      onSelectProvider: () => undefined,
      onRequestDeleteProvider: () => undefined,
      onSave: () => undefined,
      onRequestDeleteProviderModel: () => undefined,
      setIsProviderDialogOpen: () => undefined,
      setProviderDialogDraft: () => undefined,
      setIsProviderModelDialogOpen: () => undefined,
      setProviderModelDialogDraft: () => undefined,
      setProviderDrafts: () => undefined,
      setProviderRequestDrafts: () => undefined,
    });

    assert.ok(props);
    assert.deepEqual(props.providers, []);
    assert.equal(props.availabilityNotice, availabilityNotice);
    assert.equal(props.configFilePath, '/managed/openclaw/providers.json');
    assert.equal(props.isProviderConfigReadonly, true);
  },
);

await runTest(
  'buildLlmProviderSectionProps composes provider dialog launch callbacks from shared presentation helpers',
  async () => {
    const { buildLlmProviderSectionProps } = await loadSectionModelsModule();
    let isProviderDialogOpen = false;
    let isProviderModelDialogOpen = false;
    let providerDialogDraft = {
      id: 'provider-legacy',
      name: 'Legacy Provider',
      endpoint: 'https://legacy.example.com',
      apiKeySource: 'LEGACY_PROVIDER_KEY',
      defaultModelId: 'legacy-default',
      reasoningModelId: 'legacy-reasoning',
      embeddingModelId: 'legacy-embedding',
      modelsText: 'legacy-default=Legacy Default',
      requestOverridesText: '{"temperature":0.8}',
    };
    let providerModelDialogDraft: any = {
      originalId: 'legacy-model',
      id: 'legacy-model',
      name: 'Legacy Model',
    };

    const buildProps = (canManageOpenClawProviders: boolean) =>
      buildLlmProviderSectionProps({
        workbench: {
          llmProviders: [],
        } as any,
        selectedProvider: null,
        selectedProviderDraft: null,
        selectedProviderRequestDraft: '',
        selectedProviderRequestParseError: null,
        hasPendingProviderChanges: false,
        isSavingProviderConfig: false,
        isProviderConfigReadonly: false,
        isOpenClawConfigWritable: true,
        canManageOpenClawProviders,
        configFilePath: null,
        availabilityNotice: 'availability-notice',
        formatWorkbenchLabel: (value: string) => `label:${value}`,
        getDangerBadge: (value: string) => `danger:${value}`,
        getStatusBadge: (value: string) => `status:${value}`,
        t: (key: string) => key,
        onOpenProviderCenter: () => undefined,
        onSelectProvider: () => undefined,
        onRequestDeleteProvider: () => undefined,
        onFieldChange: () => undefined,
        onRequestOverridesChange: () => undefined,
        onConfigChange: () => undefined,
        onReset: () => undefined,
        onSave: () => undefined,
        onRequestDeleteProviderModel: () => undefined,
        setIsProviderDialogOpen: (open: boolean) => {
          isProviderDialogOpen = open;
        },
        setProviderDialogDraft: (
          updater: (current: typeof providerDialogDraft) => typeof providerDialogDraft,
        ) => {
          providerDialogDraft = updater(providerDialogDraft);
        },
        setIsProviderModelDialogOpen: (open: boolean) => {
          isProviderModelDialogOpen = open;
        },
        setProviderModelDialogDraft: (updater: (current: any) => any) => {
          providerModelDialogDraft = updater(providerModelDialogDraft);
        },
      });

    const readonlyProps = buildProps(false);

    assert.ok(readonlyProps);

    readonlyProps.onOpenCreateProviderDialog();
    readonlyProps.onOpenCreateProviderModelDialog();

    assert.equal(isProviderDialogOpen, false);
    assert.equal(isProviderModelDialogOpen, false);
    assert.deepEqual(providerDialogDraft, {
      id: 'provider-legacy',
      name: 'Legacy Provider',
      endpoint: 'https://legacy.example.com',
      apiKeySource: 'LEGACY_PROVIDER_KEY',
      defaultModelId: 'legacy-default',
      reasoningModelId: 'legacy-reasoning',
      embeddingModelId: 'legacy-embedding',
      modelsText: 'legacy-default=Legacy Default',
      requestOverridesText: '{"temperature":0.8}',
    });
    assert.deepEqual(providerModelDialogDraft, {
      originalId: 'legacy-model',
      id: 'legacy-model',
      name: 'Legacy Model',
    });

    const props = buildProps(true);

    assert.ok(props);

    props.onOpenCreateProviderDialog();
    assert.equal(isProviderDialogOpen, true);
    assert.deepEqual(providerDialogDraft, {
      id: '',
      name: '',
      endpoint: '',
      apiKeySource: '',
      defaultModelId: '',
      reasoningModelId: '',
      embeddingModelId: '',
      modelsText: '',
      requestOverridesText: '',
    });

    isProviderModelDialogOpen = false;
    providerModelDialogDraft = {
      originalId: 'legacy-model',
      id: 'legacy-model',
      name: 'Legacy Model',
    };

    props.onOpenCreateProviderModelDialog();
    assert.equal(isProviderModelDialogOpen, true);
    assert.deepEqual(providerModelDialogDraft, {
      id: '',
      name: '',
    });

    isProviderModelDialogOpen = false;
    props.onOpenEditProviderModelDialog({
      id: 'gpt-5.4',
      name: 'GPT-5.4',
    } as any);
    assert.equal(isProviderModelDialogOpen, true);
    assert.deepEqual(providerModelDialogDraft, {
      originalId: 'gpt-5.4',
      id: 'gpt-5.4',
      name: 'GPT-5.4',
    });
  },
);

await runTest(
  'buildLlmProviderSectionProps composes provider workspace draft callbacks from injected page state setters',
  async () => {
    const { buildLlmProviderSectionProps } = await loadSectionModelsModule();
    let providerDrafts = {
      'provider-1': {
        endpoint: 'https://provider-1.example.com',
        apiKeySource: 'PROVIDER_1_KEY',
        defaultModelId: 'model-1',
        reasoningModelId: 'reasoning-1',
        embeddingModelId: 'embedding-1',
        config: {
          retries: 3,
          request: {
            temperature: 0.2,
          },
        },
      },
    };
    let providerRequestDrafts = {
      'provider-1': '{"temperature":0.2}',
    };
    const selectedProvider = {
      id: 'provider-1',
      endpoint: 'https://provider-1.example.com',
      apiKeySource: 'PROVIDER_1_KEY',
      defaultModelId: 'model-1',
      reasoningModelId: 'reasoning-1',
      embeddingModelId: 'embedding-1',
      config: {
        retries: 3,
        request: {
          temperature: 0.2,
        },
      },
      models: [],
    } as any;
    const selectedProviderDraft = providerDrafts['provider-1'];

    const buildProps = (isProviderConfigReadonly: boolean) =>
      buildLlmProviderSectionProps({
        workbench: {
          llmProviders: [selectedProvider],
        } as any,
        selectedProvider,
        selectedProviderDraft,
        selectedProviderRequestDraft: providerRequestDrafts['provider-1'],
        selectedProviderRequestParseError: null,
        hasPendingProviderChanges: true,
        isSavingProviderConfig: false,
        isProviderConfigReadonly,
        isOpenClawConfigWritable: true,
        canManageOpenClawProviders: true,
        configFilePath: null,
        availabilityNotice: 'availability-notice',
        formatWorkbenchLabel: (value: string) => `label:${value}`,
        getDangerBadge: (value: string) => `danger:${value}`,
        getStatusBadge: (value: string) => `status:${value}`,
        t: (key: string) => key,
        onOpenProviderCenter: () => undefined,
        onSelectProvider: () => undefined,
        onRequestDeleteProvider: () => undefined,
        onSave: () => undefined,
        onRequestDeleteProviderModel: () => undefined,
        setIsProviderDialogOpen: () => undefined,
        setProviderDialogDraft: () => undefined,
        setIsProviderModelDialogOpen: () => undefined,
        setProviderModelDialogDraft: () => undefined,
        setProviderDrafts: (
          updater: (current: typeof providerDrafts) => typeof providerDrafts,
        ) => {
          providerDrafts = updater(providerDrafts);
        },
        setProviderRequestDrafts: (
          updater: (current: typeof providerRequestDrafts) => typeof providerRequestDrafts,
        ) => {
          providerRequestDrafts = updater(providerRequestDrafts);
        },
      });

    const readonlyProps = buildProps(true);
    assert.ok(readonlyProps);

    readonlyProps.onFieldChange('endpoint', 'https://readonly.example.com');
    readonlyProps.onConfigChange('retries', 5);
    readonlyProps.onRequestOverridesChange('{"temperature":0.8}');
    readonlyProps.onReset();

    assert.equal(providerDrafts['provider-1'].endpoint, 'https://provider-1.example.com');
    assert.equal(providerDrafts['provider-1'].config.retries, 3);
    assert.equal(providerRequestDrafts['provider-1'], '{"temperature":0.2}');

    const props = buildProps(false);
    assert.ok(props);

    props.onFieldChange('endpoint', 'https://override.example.com');
    assert.equal(providerDrafts['provider-1'].endpoint, 'https://override.example.com');

    props.onConfigChange('retries', 7);
    assert.equal(providerDrafts['provider-1'].config.retries, 7);

    props.onRequestOverridesChange('{"temperature":0.9}');
    assert.equal(providerRequestDrafts['provider-1'], '{"temperature":0.9}');

    providerDrafts['provider-1'].endpoint = 'https://dirty.example.com';
    providerRequestDrafts['provider-1'] = '{"temperature":0.95}';

    props.onReset();
    assert.deepEqual(providerDrafts['provider-1'], {
      endpoint: 'https://provider-1.example.com',
      apiKeySource: 'PROVIDER_1_KEY',
      defaultModelId: 'model-1',
      reasoningModelId: 'reasoning-1',
      embeddingModelId: 'embedding-1',
      config: {
        retries: 3,
        request: {
          temperature: 0.2,
        },
      },
    });
    assert.match(providerRequestDrafts['provider-1'], /temperature/);
  },
);

await runTest(
  'buildLlmProviderDialogStateHandlers centralizes provider dialog dismiss, draft reset, and delete reset callbacks',
  async () => {
    const { buildLlmProviderDialogStateHandlers } = await loadSectionModelsModule();
    let isProviderDialogOpen = true;
    let isProviderModelDialogOpen = true;
    let providerDialogDraft = {
      id: 'provider-1',
      name: 'Provider 1',
      endpoint: 'https://provider-1.example.com',
      apiKeySource: 'env:PROVIDER_1_KEY',
      defaultModelId: 'gpt-5.4',
      reasoningModelId: '',
      embeddingModelId: '',
      modelsText: 'gpt-5.4=GPT-5.4',
      requestOverridesText: '',
    };
    let providerModelDialogDraft = {
      originalId: 'gpt-5.4',
      id: 'gpt-5.4',
      name: 'GPT-5.4',
    };
    let providerDeleteId: string | null = 'provider-1';
    let providerModelDeleteId: string | null = 'model-1';
    const providerDeleteDismissCalls: Array<string | null> = [];
    const providerModelDeleteDismissCalls: Array<string | null> = [];

    const handlers = buildLlmProviderDialogStateHandlers({
      setIsProviderDialogOpen: (open: boolean) => {
        isProviderDialogOpen = open;
      },
      setProviderDialogDraft: (next) => {
        providerDialogDraft = typeof next === 'function' ? next(providerDialogDraft) : next;
      },
      setIsProviderModelDialogOpen: (open: boolean) => {
        isProviderModelDialogOpen = open;
      },
      setProviderModelDialogDraft: (next) => {
        providerModelDialogDraft =
          typeof next === 'function' ? next(providerModelDialogDraft) : next;
      },
      setProviderDeleteId: (value: string | null) => {
        providerDeleteDismissCalls.push(value);
        providerDeleteId = value;
      },
      setProviderModelDeleteId: (value: string | null) => {
        providerModelDeleteDismissCalls.push(value);
        providerModelDeleteId = value;
      },
    });

    handlers.onProviderDialogOpenChange(true);
    assert.equal(isProviderDialogOpen, true);
    assert.equal(providerDialogDraft.id, 'provider-1');

    handlers.onProviderDialogOpenChange(false);
    assert.equal(isProviderDialogOpen, false);
    assert.deepEqual(providerDialogDraft, {
      id: '',
      name: '',
      endpoint: '',
      apiKeySource: '',
      defaultModelId: '',
      reasoningModelId: '',
      embeddingModelId: '',
      modelsText: '',
      requestOverridesText: '',
    });

    providerDialogDraft = {
      ...providerDialogDraft,
      id: 'provider-2',
      name: 'Provider 2',
    };

    handlers.dismissProviderDialog();
    assert.equal(isProviderDialogOpen, false);
    assert.deepEqual(providerDialogDraft, {
      id: '',
      name: '',
      endpoint: '',
      apiKeySource: '',
      defaultModelId: '',
      reasoningModelId: '',
      embeddingModelId: '',
      modelsText: '',
      requestOverridesText: '',
    });

    handlers.onProviderModelDialogOpenChange(false);
    assert.equal(isProviderModelDialogOpen, false);
    assert.deepEqual(providerModelDialogDraft, {
      id: '',
      name: '',
    });

    providerModelDialogDraft = {
      id: 'o4-mini',
      name: 'o4-mini',
    };

    handlers.dismissProviderModelDialog();
    assert.equal(isProviderModelDialogOpen, false);
    assert.deepEqual(providerModelDialogDraft, {
      id: '',
      name: '',
    });

    handlers.onProviderDeleteDialogOpenChange(true);
    handlers.onProviderDeleteDialogOpenChange(false);
    assert.equal(providerDeleteId, null);
    assert.deepEqual(providerDeleteDismissCalls, [null]);

    handlers.onProviderModelDeleteDialogOpenChange(true);
    handlers.onProviderModelDeleteDialogOpenChange(false);
    assert.equal(providerModelDeleteId, null);
    assert.deepEqual(providerModelDeleteDismissCalls, [null]);
  },
);

await runTest(
  'buildLlmProviderDialogProps preserves delete ids and dialog field change handlers',
  async () => {
    const { buildLlmProviderDialogProps } = await loadSectionModelsModule();
    let providerDialogDraft = {
      id: 'provider-1',
      name: 'Provider One',
      endpoint: 'https://example.com',
      apiKeySource: 'OPENAI_API_KEY',
      defaultModelId: 'gpt-5.4',
      reasoningModelId: 'o4-mini',
      embeddingModelId: 'text-embedding-3-large',
      modelsText: 'gpt-5.4=GPT 5.4',
      requestOverridesText: '{"temperature":0.1}',
    };
    let providerModelDialogDraft = {
      originalId: 'model-1',
      id: 'model-1',
      name: 'Model One',
    };

    const props = buildLlmProviderDialogProps({
      isProviderDialogOpen: true,
      providerDialogDraft,
      providerDialogModels: [{ id: 'gpt-5.4', name: 'GPT-5.4' }],
      providerDialogRequestParseError: null,
      isSavingProviderDialog: false,
      onProviderDialogOpenChange: () => undefined,
      setProviderDialogDraft: (
        updater: (current: typeof providerDialogDraft) => typeof providerDialogDraft,
      ) => {
        providerDialogDraft = updater(providerDialogDraft);
      },
      onSubmitProviderDialog: () => undefined,
      isProviderModelDialogOpen: true,
      providerModelDialogDraft,
      isSavingProviderModelDialog: false,
      onProviderModelDialogOpenChange: () => undefined,
      setProviderModelDialogDraft: (
        updater: (
          current: typeof providerModelDialogDraft,
        ) => typeof providerModelDialogDraft,
      ) => {
        providerModelDialogDraft = updater(providerModelDialogDraft);
      },
      onSubmitProviderModelDialog: () => undefined,
      providerDeleteId: 'provider-1',
      deletingProviderId: 'provider-1',
      onProviderDeleteDialogOpenChange: () => undefined,
      onDeleteProvider: () => undefined,
      providerModelDeleteId: 'model-1',
      deletingProviderModelId: 'model-1',
      onProviderModelDeleteDialogOpenChange: () => undefined,
      onDeleteProviderModel: () => undefined,
      t: (key: string) => key,
    });

    assert.equal(props.providerDeleteId, 'provider-1');
    assert.equal(props.deletingProviderId, 'provider-1');
    assert.equal(props.providerModelDeleteId, 'model-1');
    assert.equal(props.deletingProviderModelId, 'model-1');

    props.onProviderDialogFieldChange('name', 'Provider Two');
    assert.equal(providerDialogDraft.name, 'Provider Two');

    props.onProviderModelDialogFieldChange('id', 'model-2');
    assert.equal(providerModelDialogDraft.id, 'model-2');
  },
);

await runTest(
  'buildMemoryWorkbenchSectionProps routes the memory availability fallback and preserves page-owned dreaming callbacks',
  async () => {
    const { buildMemoryWorkbenchSectionProps } = await loadSectionModelsModule();
    const renderSectionAvailabilityCalls: Array<{ sectionId: string; fallbackKey: string }> = [];
    const onDreamingDraftChange = () => undefined;
    const onSaveDreamingConfig = () => undefined;

    const props = buildMemoryWorkbenchSectionProps({
      isLoading: true,
      workbench: null,
      memoryWorkbenchState: {
        isEmpty: true,
        hasMemoryEntries: false,
        dreamDiaryEntries: [],
      },
      configDreaming: null,
      dreamingDraft: null,
      dreamingError: null,
      isSavingDreaming: false,
      canEditDreamingConfig: false,
      loadingLabel: 'Loading memory',
      formatWorkbenchLabel: (value: string) => `label:${value}`,
      getDangerBadge: (value: string) => `danger:${value}`,
      getStatusBadge: (value: string) => `status:${value}`,
      t: (key: string) => key,
      onDreamingDraftChange,
      onSaveDreamingConfig,
      renderSectionAvailability: (sectionId, fallbackKey) => {
        renderSectionAvailabilityCalls.push({ sectionId, fallbackKey });
        return `empty:${sectionId}`;
      },
    });

    assert.equal(props.emptyState, 'empty:memory');
    assert.equal(props.loadingLabel, 'Loading memory');
    assert.equal(props.onDreamingDraftChange, onDreamingDraftChange);
    assert.equal(props.onSaveDreamingConfig, onSaveDreamingConfig);
    assert.deepEqual(renderSectionAvailabilityCalls, [
      {
        sectionId: 'memory',
        fallbackKey: 'instances.detail.instanceWorkbench.empty.memory',
      },
    ]);
  },
);

await runTest(
  'buildConfigToolsSectionProps routes the tools availability fallback and preserves page-owned config tool callbacks',
  async () => {
    const { buildConfigToolsSectionProps } = await loadSectionModelsModule();
    const renderSectionAvailabilityCalls: Array<{ sectionId: string; fallbackKey: string }> = [];
    const onSaveWebSearchConfig = () => undefined;
    const onWebSearchSharedDraftChange = () => undefined;
    const onWebSearchProviderDraftChange = () => undefined;
    const onSelectedWebSearchProviderIdChange = () => undefined;
    const onSaveWebFetchConfig = () => undefined;
    const onWebFetchSharedDraftChange = () => undefined;
    const onWebFetchFallbackDraftChange = () => undefined;
    const onSaveWebSearchNativeCodexConfig = () => undefined;
    const onWebSearchNativeCodexDraftChange = () => undefined;
    const onSaveXSearchConfig = () => undefined;
    const onXSearchDraftChange = () => undefined;
    const onSaveAuthCooldownsConfig = () => undefined;
    const onAuthCooldownsDraftChange = () => undefined;

    const props = buildConfigToolsSectionProps({
      workbench: null,
      configWebSearch: null,
      webSearchSharedDraft: null,
      selectedWebSearchProvider: null,
      selectedWebSearchProviderDraft: null,
      webSearchError: null,
      isSavingWebSearch: false,
      canEditConfigWebSearch: false,
      onSaveWebSearchConfig,
      onWebSearchSharedDraftChange,
      onWebSearchProviderDraftChange,
      onSelectedWebSearchProviderIdChange,
      configWebFetch: null,
      webFetchSharedDraft: null,
      webFetchFallbackDraft: {
        endpoint: '',
        apiKeyEnv: '',
      },
      webFetchError: null,
      isSavingWebFetch: false,
      canEditConfigWebFetch: false,
      onSaveWebFetchConfig,
      onWebFetchSharedDraftChange,
      onWebFetchFallbackDraftChange,
      configWebSearchNativeCodex: null,
      webSearchNativeCodexDraft: null,
      webSearchNativeCodexError: null,
      isSavingWebSearchNativeCodex: false,
      canEditConfigWebSearchNativeCodex: false,
      onSaveWebSearchNativeCodexConfig,
      onWebSearchNativeCodexDraftChange,
      configXSearch: null,
      xSearchDraft: null,
      xSearchError: null,
      isSavingXSearch: false,
      canEditConfigXSearch: false,
      onSaveXSearchConfig,
      onXSearchDraftChange,
      configAuthCooldowns: null,
      authCooldownsDraft: null,
      authCooldownsError: null,
      isSavingAuthCooldowns: false,
      canEditConfigAuthCooldowns: false,
      onSaveAuthCooldownsConfig,
      onAuthCooldownsDraftChange,
      formatWorkbenchLabel: (value: string) => `label:${value}`,
      getDangerBadge: (value: string) => `danger:${value}`,
      getStatusBadge: (value: string) => `status:${value}`,
      t: (key: string) => key,
      renderSectionAvailability: (sectionId, fallbackKey) => {
        renderSectionAvailabilityCalls.push({ sectionId, fallbackKey });
        return `empty:${sectionId}`;
      },
    });

    assert.equal(props.emptyState, 'empty:tools');
    assert.equal(props.onSaveWebSearchConfig, onSaveWebSearchConfig);
    assert.equal(props.onWebSearchSharedDraftChange, onWebSearchSharedDraftChange);
    assert.equal(props.onWebSearchProviderDraftChange, onWebSearchProviderDraftChange);
    assert.equal(props.onSelectedWebSearchProviderIdChange, onSelectedWebSearchProviderIdChange);
    assert.equal(props.onSaveWebFetchConfig, onSaveWebFetchConfig);
    assert.equal(props.onWebFetchSharedDraftChange, onWebFetchSharedDraftChange);
    assert.equal(props.onWebFetchFallbackDraftChange, onWebFetchFallbackDraftChange);
    assert.equal(props.onSaveWebSearchNativeCodexConfig, onSaveWebSearchNativeCodexConfig);
    assert.equal(props.onWebSearchNativeCodexDraftChange, onWebSearchNativeCodexDraftChange);
    assert.equal(props.onSaveXSearchConfig, onSaveXSearchConfig);
    assert.equal(props.onXSearchDraftChange, onXSearchDraftChange);
    assert.equal(props.onSaveAuthCooldownsConfig, onSaveAuthCooldownsConfig);
    assert.equal(props.onAuthCooldownsDraftChange, onAuthCooldownsDraftChange);
    assert.deepEqual(renderSectionAvailabilityCalls, [
      {
        sectionId: 'tools',
        fallbackKey: 'instances.detail.instanceWorkbench.empty.tools',
      },
    ]);
  },
);

await runTest(
  'buildMemoryWorkbenchSectionContent preserves memory workbench section props',
  async () => {
    const { buildMemoryWorkbenchSectionContent } = await loadSectionModelsModule();
    const sectionProps = {
      emptyState: 'empty:memory',
      loadingLabel: 'Loading memory',
      isLoading: true,
      workbench: null,
      memoryWorkbenchState: {
        isEmpty: true,
        hasMemoryEntries: false,
        dreamDiaryEntries: [],
      },
      configDreaming: null,
      dreamingDraft: null,
      dreamingError: null,
      isSavingDreaming: false,
      canEditDreamingConfig: false,
      formatWorkbenchLabel: (value: string) => value,
      getDangerBadge: (value: string) => value,
      getStatusBadge: (value: string) => value,
      t: (key: string) => key,
      onDreamingDraftChange: () => undefined,
      onSaveDreamingConfig: () => undefined,
    } as any;

    const content = buildMemoryWorkbenchSectionContent({
      sectionProps,
    });

    assert.ok(isValidElement(content));
    assert.equal((content as any).props.loadingLabel, 'Loading memory');
    assert.equal((content as any).props.emptyState, 'empty:memory');
  },
);

await runTest(
  'buildConfigToolsSectionContent preserves config tools section props',
  async () => {
    const { buildConfigToolsSectionContent } = await loadSectionModelsModule();
    const sectionProps = {
      emptyState: 'empty:tools',
      workbench: null,
      configWebSearch: null,
      webSearchSharedDraft: null,
      selectedWebSearchProvider: null,
      selectedWebSearchProviderDraft: null,
      webSearchError: null,
      isSavingWebSearch: false,
      canEditConfigWebSearch: false,
      onSaveWebSearchConfig: () => undefined,
      onWebSearchSharedDraftChange: () => undefined,
      onWebSearchProviderDraftChange: () => undefined,
      onSelectedWebSearchProviderIdChange: () => undefined,
      configWebFetch: null,
      webFetchSharedDraft: null,
      webFetchFallbackDraft: {
        endpoint: '',
        apiKeyEnv: '',
      },
      webFetchError: null,
      isSavingWebFetch: false,
      canEditConfigWebFetch: false,
      onSaveWebFetchConfig: () => undefined,
      onWebFetchSharedDraftChange: () => undefined,
      onWebFetchFallbackDraftChange: () => undefined,
      configWebSearchNativeCodex: null,
      webSearchNativeCodexDraft: null,
      webSearchNativeCodexError: null,
      isSavingWebSearchNativeCodex: false,
      canEditConfigWebSearchNativeCodex: false,
      onSaveWebSearchNativeCodexConfig: () => undefined,
      onWebSearchNativeCodexDraftChange: () => undefined,
      configXSearch: null,
      xSearchDraft: null,
      xSearchError: null,
      isSavingXSearch: false,
      canEditConfigXSearch: false,
      onSaveXSearchConfig: () => undefined,
      onXSearchDraftChange: () => undefined,
      configAuthCooldowns: null,
      authCooldownsDraft: null,
      authCooldownsError: null,
      isSavingAuthCooldowns: false,
      canEditConfigAuthCooldowns: false,
      onSaveAuthCooldownsConfig: () => undefined,
      onAuthCooldownsDraftChange: () => undefined,
      formatWorkbenchLabel: (value: string) => value,
      getDangerBadge: (value: string) => value,
      getStatusBadge: (value: string) => value,
      t: (key: string) => key,
    } as any;

    const content = buildConfigToolsSectionContent({
      sectionProps,
    });

    assert.ok(isValidElement(content));
    assert.equal((content as any).props.emptyState, 'empty:tools');
    assert.equal((content as any).props.webFetchFallbackDraft.endpoint, '');
  },
);

await runTest(
  'buildAgentSectionContent returns null without section props and preserves agent section props when present',
  async () => {
    const { buildAgentSectionContent } = await loadSectionModelsModule();

    assert.equal(buildAgentSectionContent({ sectionProps: null }), null);

    const content = buildAgentSectionContent({
      sectionProps: {
        selectedAgentId: 'agent-1',
        onSelectedAgentIdChange: () => undefined,
        instanceId: 'instance-1',
        instanceName: 'Primary Instance',
        instanceKernelId: 'openclaw',
        onOpenAgentCreationWorkflow: () => undefined,
        onEditAgent: () => undefined,
        onRequestDeleteAgent: () => undefined,
        onInstallSkill: () => undefined,
        onSetSkillEnabled: () => undefined,
        onRemoveSkill: () => undefined,
        isReadonly: false,
        isLoading: false,
        isFilesLoading: false,
        isInstallingSkill: false,
        isAgentCreationWorkflowOpen: false,
        isAgentDialogOpen: false,
        editingAgentId: null,
        agentDialogDraft: {
          id: '',
          name: '',
          avatar: '*',
          primaryModel: '',
          fallbackModelsText: '',
          workspace: '',
          agentDir: '',
          temperature: '',
          topP: '',
          maxTokens: '',
          timeoutMs: '',
          isDefault: false,
          streamingMode: 'inherit',
        },
        availableAgentModelOptions: [],
        isSavingAgentDialog: false,
        onAgentCreationWorkflowOpenChange: () => undefined,
        onAgentCreationDraftReplace: () => undefined,
        onAgentCreated: () => undefined,
        onSaveAgentCreation: () => undefined,
        onSaveAgentDialog: () => undefined,
        agentDeleteId: null,
        onDeleteAgentConfirm: () => undefined,
        workbench: { agents: [] } as any,
        snapshot: null,
        errorMessage: null,
        updatingSkillKeys: [],
        removingSkillKeys: [],
        onReload: () => undefined,
        onAgentDialogOpenChange: () => undefined,
        onAgentDialogFieldChange: () => undefined,
        onAgentDialogDefaultChange: () => undefined,
        onAgentDialogStreamingModeChange: () => undefined,
        onAgentDeleteDialogOpenChange: () => undefined,
      },
    });

    assert.ok(isValidElement(content));
    assert.equal((content as any).props.selectedAgentId, 'agent-1');
  },
);

await runTest(
  'buildLlmProvidersSectionContent returns null without provider section props and preserves dialog wiring when present',
  async () => {
    const { buildLlmProvidersSectionContent } = await loadSectionModelsModule();
    const dialogProps = {
      isProviderDialogOpen: false,
      providerDialogDraft: {
        id: '',
        name: '',
        endpoint: '',
        apiKeySource: '',
        defaultModelId: '',
        reasoningModelId: '',
        embeddingModelId: '',
        modelsText: '',
        requestOverridesText: '',
      },
      providerDialogModels: [],
      providerDialogRequestParseError: null,
      isSavingProviderDialog: false,
      onProviderDialogOpenChange: () => undefined,
      onProviderDialogFieldChange: () => undefined,
      onSubmitProviderDialog: () => undefined,
      isProviderModelDialogOpen: false,
      providerModelDialogDraft: {
        id: '',
        name: '',
      },
      isSavingProviderModelDialog: false,
      onProviderModelDialogOpenChange: () => undefined,
      onProviderModelDialogFieldChange: () => undefined,
      onSubmitProviderModelDialog: () => undefined,
      providerDeleteId: null,
      deletingProviderId: null,
      onProviderDeleteDialogOpenChange: () => undefined,
      onDeleteProvider: () => undefined,
      providerModelDeleteId: null,
      deletingProviderModelId: null,
      onProviderModelDeleteDialogOpenChange: () => undefined,
      onDeleteProviderModel: () => undefined,
      t: (key: string) => key,
    };

    assert.equal(
      buildLlmProvidersSectionContent({
        sectionProps: null,
        dialogProps: dialogProps as any,
      }),
      null,
    );

    const content = buildLlmProvidersSectionContent({
      sectionProps: {
        selectedProvider: null,
        selectedProviderDraft: null,
        selectedProviderRequestDraft: '',
        selectedProviderRequestParseError: null,
        hasPendingProviderChanges: false,
        isSavingProviderConfig: false,
        isProviderConfigReadonly: true,
        isOpenClawConfigWritable: false,
        canManageOpenClawProviders: false,
        configFilePath: null,
        availabilityNotice: 'availability',
        formatWorkbenchLabel: (value: string) => value,
        getDangerBadge: (value: string) => value,
        getStatusBadge: (value: string) => value,
        t: (key: string) => key,
        onOpenProviderCenter: () => undefined,
        onSelectProvider: () => undefined,
        onRequestDeleteProvider: () => undefined,
        onSave: () => undefined,
        onRequestDeleteProviderModel: () => undefined,
        providers: [],
        onFieldChange: () => undefined,
        onRequestOverridesChange: () => undefined,
        onConfigChange: () => undefined,
        onReset: () => undefined,
        onOpenCreateProviderDialog: () => undefined,
        onOpenCreateProviderModelDialog: () => undefined,
        onOpenEditProviderModelDialog: () => undefined,
      } as any,
      dialogProps: dialogProps as any,
    });

    assert.ok(isValidElement(content));
    assert.equal((content as any).props.dialogProps, dialogProps);
  },
);

await runTest(
  'buildTasksSectionContent keeps cron tasks hidden until workbench exists and preserves the embedded workspace target',
  async () => {
    const { buildTasksSectionContent } = await loadSectionModelsModule();

    assert.equal(
      buildTasksSectionContent({
        workbench: null,
        instanceId: 'instance-1',
      }),
      null,
    );

    const content = buildTasksSectionContent({
      workbench: { cronTasks: { tasks: [] } } as any,
      instanceId: 'instance-1',
    });

    assert.ok(isValidElement(content));
    assert.equal((content as any).props.instanceId, 'instance-1');
    assert.equal((content as any).props.embedded, true);
  },
);
