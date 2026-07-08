import type {
  KernelAgentLibraryItem,
  OpenClawAgentInput,
  OpenClawAgentParamSource,
  OpenClawAgentParamValue,
} from '@sdkwork/clawstudio-core';
import {
  normalizeLocalApiProxyLegacyProviderId as normalizeLegacyProviderId,
  normalizeLocalApiProxyLegacyProviderModelRef as normalizeLegacyProviderModelRef,
} from '@sdkwork/local-api-proxy';
import type {
  InstanceWorkbenchAgent,
  InstanceWorkbenchLLMProvider,
} from '../types/index.ts';

export type OpenClawAgentModelSource = 'agent' | 'defaults' | 'runtime';
export type OpenClawAgentParamDisplaySource = OpenClawAgentParamSource | 'runtime';
export type OpenClawAgentParamKey =
  | 'temperature'
  | 'topP'
  | 'maxTokens'
  | 'timeoutMs'
  | 'streaming';
export type OpenClawStreamingMode = 'inherit' | 'enabled' | 'disabled';

export interface OpenClawAgentFormState {
  id: string;
  name: string;
  avatar: string;
  workspace: string;
  agentDir: string;
  isDefault: boolean;
  primaryModel: string;
  fallbackModelsText: string;
  temperature: string;
  topP: string;
  maxTokens: string;
  timeoutMs: string;
  streamingMode: OpenClawStreamingMode;
  fieldSources: {
    model: OpenClawAgentModelSource;
    temperature: OpenClawAgentParamDisplaySource;
    topP: OpenClawAgentParamDisplaySource;
    maxTokens: OpenClawAgentParamDisplaySource;
    timeoutMs: OpenClawAgentParamDisplaySource;
    streaming: OpenClawAgentParamDisplaySource;
  };
  inherited: {
    primaryModel: string;
    fallbackModelsText: string;
    temperature: string;
    topP: string;
    maxTokens: string;
    timeoutMs: string;
    streaming: boolean | null;
  };
}

export interface OpenClawAgentParamEntry {
  key: OpenClawAgentParamKey;
  value: string;
  source: OpenClawAgentParamDisplaySource;
}

export interface OpenClawAgentModelOption {
  value: string;
  label: string;
}

export interface OpenClawAgentDialogState {
  editingAgentId: string | null;
  draft: OpenClawAgentFormState;
}

export interface OpenClawAgentWorkspaceResetState {
  isCreationWorkflowOpen: boolean;
  isDialogOpen: boolean;
  selectedAgentId: string | null;
  selectedAgentWorkbench: null;
  workbenchError: string | null;
  isWorkbenchLoading: boolean;
  dialogState: OpenClawAgentDialogState;
  deleteId: string | null;
  isInstallingSkill: boolean;
  updatingSkillKeys: string[];
  removingSkillKeys: string[];
}

export interface OpenClawSelectedAgentWorkbenchState {
  agent: Pick<InstanceWorkbenchAgent, 'agent'>;
  model: {
    source: OpenClawAgentModelSource;
  };
}

type StateSetter<T> = (value: T) => void;

export interface BuildOpenClawAgentDialogStateHandlersArgs {
  selectedAgentWorkbench: OpenClawSelectedAgentWorkbenchState | null;
  setEditingAgentId: StateSetter<string | null>;
  setAgentDialogDraft: StateSetter<OpenClawAgentFormState>;
  setIsAgentDialogOpen: StateSetter<boolean>;
}

const KNOWN_AGENT_PARAM_KEYS: OpenClawAgentParamKey[] = [
  'temperature',
  'topP',
  'maxTokens',
  'timeoutMs',
  'streaming',
];

function formatAgentParamValue(
  key: OpenClawAgentParamKey,
  value: OpenClawAgentParamValue | undefined,
) {
  if (value === undefined) {
    return '';
  }

  if (key === 'streaming') {
    return value === true ? 'true' : value === false ? 'false' : String(value);
  }

  return String(value);
}

function slugifyOpenClawAgentId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function resolveParamSource(
  agent: InstanceWorkbenchAgent | null,
  key: OpenClawAgentParamKey,
): OpenClawAgentParamDisplaySource {
  return agent?.paramSources?.[key] || 'runtime';
}

function resolveStreamingMode(value: boolean | null): OpenClawStreamingMode {
  if (value === true) {
    return 'enabled';
  }

  if (value === false) {
    return 'disabled';
  }

  return 'inherit';
}

export function buildOpenClawAgentModelOptions(
  llmProviders: InstanceWorkbenchLLMProvider[] | null | undefined,
): OpenClawAgentModelOption[] {
  const options = new Map<string, OpenClawAgentModelOption>();

  (llmProviders || []).forEach((provider) => {
    const providerId = normalizeLegacyProviderId(provider.id);
    const providerName = provider.name.trim() || providerId;
    if (!providerId) {
      return;
    }

    provider.models.forEach((model) => {
      const modelId = model.id.trim();
      if (!modelId) {
        return;
      }

      const normalizedModelRef = normalizeLegacyProviderModelRef(modelId);
      const value = normalizedModelRef.includes('/')
        ? normalizedModelRef
        : `${providerId}/${normalizedModelRef}`;
      if (options.has(value)) {
        return;
      }

      options.set(value, {
        value,
        label: `${providerName} / ${model.name.trim() || modelId}`,
      });
    });
  });

  return [...options.values()];
}

export function parseAgentFallbackModels(value: string) {
  return Array.from(
    new Set(
      value
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

export function createOpenClawAgentFormState(
  agent: InstanceWorkbenchAgent | null,
  modelSource: OpenClawAgentModelSource = 'agent',
): OpenClawAgentFormState {
  const fallbackModelsText = agent?.model?.fallbacks.join('\n') || '';
  const paramValues = agent?.params || {};
  const temperatureSource = resolveParamSource(agent, 'temperature');
  const topPSource = resolveParamSource(agent, 'topP');
  const maxTokensSource = resolveParamSource(agent, 'maxTokens');
  const timeoutMsSource = resolveParamSource(agent, 'timeoutMs');
  const streamingSource = resolveParamSource(agent, 'streaming');
  const streamingValue =
    typeof paramValues.streaming === 'boolean' ? paramValues.streaming : null;

  return {
    id: agent?.agent.id || '',
    name: agent?.agent.name || '',
    avatar: agent?.agent.avatar || '',
    workspace: agent?.workspace || '',
    agentDir: agent?.agentDir || '',
    isDefault: Boolean(agent?.isDefault),
    primaryModel:
      modelSource === 'defaults' ? '' : agent?.model?.primary || '',
    fallbackModelsText: modelSource === 'defaults' ? '' : fallbackModelsText,
    temperature:
      temperatureSource === 'defaults'
        ? ''
        : typeof paramValues.temperature === 'number'
          ? String(paramValues.temperature)
          : '',
    topP:
      topPSource === 'defaults'
        ? ''
        : typeof paramValues.topP === 'number'
          ? String(paramValues.topP)
          : '',
    maxTokens:
      maxTokensSource === 'defaults'
        ? ''
        : typeof paramValues.maxTokens === 'number'
          ? String(paramValues.maxTokens)
          : '',
    timeoutMs:
      timeoutMsSource === 'defaults'
        ? ''
        : typeof paramValues.timeoutMs === 'number'
          ? String(paramValues.timeoutMs)
          : '',
    streamingMode:
      streamingSource === 'defaults'
        ? 'inherit'
        : streamingValue === false
          ? 'disabled'
          : streamingValue === true
            ? 'enabled'
            : 'inherit',
    fieldSources: {
      model: modelSource,
      temperature: temperatureSource,
      topP: topPSource,
      maxTokens: maxTokensSource,
      timeoutMs: timeoutMsSource,
      streaming: streamingSource,
    },
    inherited: {
      primaryModel: modelSource === 'defaults' ? agent?.model?.primary || '' : '',
      fallbackModelsText: modelSource === 'defaults' ? fallbackModelsText : '',
      temperature:
        temperatureSource === 'defaults'
          ? formatAgentParamValue('temperature', paramValues.temperature)
          : '',
      topP:
        topPSource === 'defaults'
          ? formatAgentParamValue('topP', paramValues.topP)
          : '',
      maxTokens:
        maxTokensSource === 'defaults'
          ? formatAgentParamValue('maxTokens', paramValues.maxTokens)
          : '',
      timeoutMs:
        timeoutMsSource === 'defaults'
          ? formatAgentParamValue('timeoutMs', paramValues.timeoutMs)
          : '',
      streaming: streamingSource === 'defaults' ? streamingValue : null,
    },
  };
}

export function createOpenClawAgentFormStateFromLibraryAgent(
  agent: KernelAgentLibraryItem,
): OpenClawAgentFormState {
  return {
    ...createOpenClawAgentFormState(null),
    id: `${slugifyOpenClawAgentId(agent.agentId) || 'agent'}-copy`,
    name: `${agent.displayName} Copy`,
    avatar: agent.avatar,
    primaryModel: agent.model.primary ?? '',
    fallbackModelsText: agent.model.fallbacks.join('\n'),
    temperature:
      typeof agent.params.temperature === 'number' ? String(agent.params.temperature) : '',
    topP: typeof agent.params.topP === 'number' ? String(agent.params.topP) : '',
    maxTokens:
      typeof agent.params.maxTokens === 'number' ? String(agent.params.maxTokens) : '',
    timeoutMs:
      typeof agent.params.timeoutMs === 'number' ? String(agent.params.timeoutMs) : '',
    isDefault: false,
    streamingMode: resolveStreamingMode(agent.params.streaming),
  };
}

export function createOpenClawAgentCreateDialogState(): OpenClawAgentDialogState {
  return {
    editingAgentId: null,
    draft: createOpenClawAgentFormState(null),
  };
}

export function createOpenClawAgentWorkspaceResetState(): OpenClawAgentWorkspaceResetState {
  return {
    isCreationWorkflowOpen: false,
    isDialogOpen: false,
    selectedAgentId: null,
    selectedAgentWorkbench: null,
    workbenchError: null,
    isWorkbenchLoading: false,
    dialogState: createOpenClawAgentCreateDialogState(),
    deleteId: null,
    isInstallingSkill: false,
    updatingSkillKeys: [],
    removingSkillKeys: [],
  };
}

export function buildOpenClawAgentDialogStateHandlers(
  args: BuildOpenClawAgentDialogStateHandlersArgs,
) {
  return {
    openCreateAgentDialog: () => {
      const dialogState = createOpenClawAgentCreateDialogState();

      args.setEditingAgentId(dialogState.editingAgentId);
      args.setAgentDialogDraft(dialogState.draft);
      args.setIsAgentDialogOpen(true);
    },
    openEditAgentDialog: (agent: InstanceWorkbenchAgent) => {
      const dialogState = createOpenClawAgentEditDialogState({
        agent,
        selectedAgentWorkbench: args.selectedAgentWorkbench,
      });

      args.setEditingAgentId(dialogState.editingAgentId);
      args.setAgentDialogDraft(dialogState.draft);
      args.setIsAgentDialogOpen(true);
    },
  };
}

export function createOpenClawAgentEditDialogState({
  agent,
  selectedAgentWorkbench,
}: {
  agent: InstanceWorkbenchAgent;
  selectedAgentWorkbench: OpenClawSelectedAgentWorkbenchState | null;
}): OpenClawAgentDialogState {
  const modelSource =
    selectedAgentWorkbench?.agent.agent.id === agent.agent.id
      ? selectedAgentWorkbench.model.source
      : 'agent';

  return {
    editingAgentId: agent.agent.id,
    draft: createOpenClawAgentFormState(agent, modelSource),
  };
}

export function buildOpenClawAgentInputFromForm(
  draft: OpenClawAgentFormState,
): OpenClawAgentInput {
  const params: Record<string, string | number | boolean | null | undefined> = {};
  const fallbackModels = parseAgentFallbackModels(draft.fallbackModelsText);
  const primaryModel = draft.primaryModel.trim();

  if (draft.temperature.trim()) {
    params.temperature = Number(draft.temperature);
  }
  if (draft.topP.trim()) {
    params.topP = Number(draft.topP);
  }
  if (draft.maxTokens.trim()) {
    params.maxTokens = Number(draft.maxTokens);
  }
  if (draft.timeoutMs.trim()) {
    params.timeoutMs = Number(draft.timeoutMs);
  }
  if (draft.streamingMode === 'enabled') {
    params.streaming = true;
  }
  if (draft.streamingMode === 'disabled') {
    params.streaming = false;
  }

  return {
    id: draft.id.trim(),
    name: draft.name.trim(),
    avatar: draft.avatar.trim(),
    workspace: draft.workspace.trim(),
    agentDir: draft.agentDir.trim(),
    isDefault: draft.isDefault,
    model:
      primaryModel || fallbackModels.length > 0
        ? {
            primary: primaryModel || undefined,
            fallbacks: fallbackModels,
          }
        : null,
    params,
  };
}

export function buildOpenClawAgentParamEntries(
  agent: InstanceWorkbenchAgent,
): OpenClawAgentParamEntry[] {
  return KNOWN_AGENT_PARAM_KEYS.flatMap((key) => {
    const value = agent.params?.[key];
    if (value === undefined) {
      return [];
    }

    return [
      {
        key,
        value: formatAgentParamValue(key, value),
        source: agent.paramSources?.[key] || 'runtime',
      },
    ];
  });
}
