import React from 'react';
import { useTranslation } from 'react-i18next';
import type { KernelAgentLibraryItem } from '@sdkwork/claw-core';
import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from '@sdkwork/claw-ui';
import type { OpenClawAgentFormState } from '../services/index.ts';

type AgentModelOption = {
  value: string;
  label: string;
};

export type AgentDialogFieldKey =
  | 'id'
  | 'name'
  | 'avatar'
  | 'primaryModel'
  | 'fallbackModelsText'
  | 'workspace'
  | 'agentDir'
  | 'temperature'
  | 'topP'
  | 'maxTokens'
  | 'timeoutMs';

export interface OpenClawAgentEditorFormProps {
  draft: OpenClawAgentFormState;
  availableAgentModelOptions: AgentModelOption[];
  onFieldChange: (field: AgentDialogFieldKey, value: string) => void;
  onDefaultChange: (checked: boolean) => void;
  onStreamingModeChange: (mode: OpenClawAgentFormState['streamingMode']) => void;
  sourceAgent?: KernelAgentLibraryItem | null;
}

function formatAgentConfigSource(
  source: 'agent' | 'defaults' | 'runtime',
  translate: (key: string) => string,
) {
  return translate(`instances.detail.instanceWorkbench.agents.modelSources.${source}`);
}

function formatAgentStreamingMode(
  mode: OpenClawAgentFormState['streamingMode'],
  translate: (key: string) => string,
) {
  if (mode === 'enabled') {
    return translate('instances.detail.instanceWorkbench.state.enabled');
  }
  if (mode === 'disabled') {
    return translate('instances.detail.instanceWorkbench.agents.skillStates.disabled');
  }
  return translate('instances.detail.instanceWorkbench.agents.panel.inheritDefaults');
}

function formatAgentStreamingValue(value: boolean, translate: (key: string) => string) {
  return value
    ? translate('instances.detail.instanceWorkbench.state.enabled')
    : translate('instances.detail.instanceWorkbench.agents.skillStates.disabled');
}

const INHERITED_CONFIG_SEPARATOR = ' / ';

export function OpenClawAgentEditorForm({
  draft,
  availableAgentModelOptions,
  onFieldChange,
  onDefaultChange,
  onStreamingModeChange,
  sourceAgent = null,
}: OpenClawAgentEditorFormProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      {sourceAgent ? (
        <div className="rounded-2xl border border-primary-200/80 bg-primary-50/80 px-4 py-4 dark:border-primary-500/30 dark:bg-primary-500/10">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-700 dark:text-primary-200">
                {t('instances.detail.instanceWorkbench.agents.creationWorkflow.labels.sourceAgent')}
              </div>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                <span className="truncate text-sm font-semibold text-primary-950 dark:text-primary-50">
                  {sourceAgent.displayName}
                </span>
                <span className="rounded-full border border-primary-200/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-primary-700 dark:border-primary-400/30 dark:text-primary-100">
                  {sourceAgent.sourceKernelId}
                </span>
              </div>
            </div>
            <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-primary-800 shadow-sm dark:bg-primary-950/70 dark:text-primary-100">
              {sourceAgent.sourceInstanceName}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-primary-800/85 dark:text-primary-100/80">
            {sourceAgent.description}
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 py-2 md:grid-cols-2">
        <label className="block">
          <Label className="mb-2">
            {t('instances.detail.instanceWorkbench.agents.dialog.agentId')}
          </Label>
          <Input
            value={draft.id}
            onChange={(event) => onFieldChange('id', event.target.value)}
            placeholder={t('instances.detail.instanceWorkbench.agents.dialog.placeholders.agentId')}
          />
        </label>
        <label className="block">
          <Label className="mb-2">
            {t('instances.detail.instanceWorkbench.agents.dialog.displayName')}
          </Label>
          <Input
            value={draft.name}
            onChange={(event) => onFieldChange('name', event.target.value)}
            placeholder={t('instances.detail.instanceWorkbench.agents.dialog.placeholders.displayName')}
          />
        </label>
        <label className="block">
          <Label className="mb-2">
            {t('instances.detail.instanceWorkbench.agents.dialog.avatar')}
          </Label>
          <Input
            value={draft.avatar}
            onChange={(event) => onFieldChange('avatar', event.target.value)}
            placeholder="*"
          />
        </label>
        <label className="block">
          <Label className="mb-2">
            {t('instances.detail.instanceWorkbench.agents.panel.primaryModel')}
          </Label>
          <Select
            value={draft.primaryModel || '__inherit__'}
            onValueChange={(value) =>
              onFieldChange('primaryModel', value === '__inherit__' ? '' : value)
            }
          >
            <SelectTrigger className="rounded-2xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__inherit__">
                {t('instances.detail.instanceWorkbench.agents.panel.inheritDefaults')}
              </SelectItem>
              {availableAgentModelOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {draft.fieldSources.model === 'defaults' &&
          (draft.inherited.primaryModel || draft.inherited.fallbackModelsText) ? (
            <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              {formatAgentConfigSource(draft.fieldSources.model, t)}
              {INHERITED_CONFIG_SEPARATOR}
              {draft.inherited.primaryModel || t('common.none')}
            </div>
          ) : null}
        </label>
        <label className="block md:col-span-2">
          <Label className="mb-2">
            {t('instances.detail.instanceWorkbench.agents.panel.fallbackModels')}
          </Label>
          <Textarea
            value={draft.fallbackModelsText}
            onChange={(event) => onFieldChange('fallbackModelsText', event.target.value)}
            placeholder={t('instances.detail.instanceWorkbench.agents.dialog.placeholders.fallbackModels')}
            rows={4}
          />
          {draft.fieldSources.model === 'defaults' && draft.inherited.fallbackModelsText ? (
            <div className="mt-2 whitespace-pre-line text-xs text-zinc-500 dark:text-zinc-400">
              {formatAgentConfigSource(draft.fieldSources.model, t)}
              {INHERITED_CONFIG_SEPARATOR}
              {draft.inherited.fallbackModelsText}
            </div>
          ) : null}
        </label>
        <label className="block md:col-span-2">
          <Label className="mb-2">
            {t('instances.detail.instanceWorkbench.agents.dialog.workspace')}
          </Label>
          <Input
            value={draft.workspace}
            onChange={(event) => onFieldChange('workspace', event.target.value)}
            placeholder={t('instances.detail.instanceWorkbench.agents.dialog.placeholders.workspace')}
          />
        </label>
        <label className="block md:col-span-2">
          <Label className="mb-2">
            {t('instances.detail.instanceWorkbench.agents.dialog.agentDir')}
          </Label>
          <Input
            value={draft.agentDir}
            onChange={(event) => onFieldChange('agentDir', event.target.value)}
            placeholder={t('instances.detail.instanceWorkbench.agents.dialog.placeholders.agentDir')}
          />
        </label>
        <label className="block">
          <Label className="mb-2">
            {t('instances.detail.instanceWorkbench.llmProviders.temperature')}
          </Label>
          <Input
            value={draft.temperature}
            onChange={(event) => onFieldChange('temperature', event.target.value)}
            placeholder={draft.inherited.temperature || '0.2'}
          />
          {draft.fieldSources.temperature === 'defaults' && draft.inherited.temperature ? (
            <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              {formatAgentConfigSource(draft.fieldSources.temperature, t)}
              {INHERITED_CONFIG_SEPARATOR}
              {draft.inherited.temperature}
            </div>
          ) : null}
        </label>
        <label className="block">
          <Label className="mb-2">
            {t('instances.detail.instanceWorkbench.llmProviders.topP')}
          </Label>
          <Input
            value={draft.topP}
            onChange={(event) => onFieldChange('topP', event.target.value)}
            placeholder={draft.inherited.topP || '1'}
          />
          {draft.fieldSources.topP === 'defaults' && draft.inherited.topP ? (
            <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              {formatAgentConfigSource(draft.fieldSources.topP, t)}
              {INHERITED_CONFIG_SEPARATOR}
              {draft.inherited.topP}
            </div>
          ) : null}
        </label>
        <label className="block">
          <Label className="mb-2">
            {t('instances.detail.instanceWorkbench.llmProviders.maxTokens')}
          </Label>
          <Input
            value={draft.maxTokens}
            onChange={(event) => onFieldChange('maxTokens', event.target.value)}
            placeholder={draft.inherited.maxTokens || '32000'}
          />
          {draft.fieldSources.maxTokens === 'defaults' && draft.inherited.maxTokens ? (
            <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              {formatAgentConfigSource(draft.fieldSources.maxTokens, t)}
              {INHERITED_CONFIG_SEPARATOR}
              {draft.inherited.maxTokens}
            </div>
          ) : null}
        </label>
        <label className="block">
          <Label className="mb-2">
            {t('instances.detail.instanceWorkbench.llmProviders.timeoutMs')}
          </Label>
          <Input
            value={draft.timeoutMs}
            onChange={(event) => onFieldChange('timeoutMs', event.target.value)}
            placeholder={draft.inherited.timeoutMs || '60000'}
          />
          {draft.fieldSources.timeoutMs === 'defaults' && draft.inherited.timeoutMs ? (
            <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              {formatAgentConfigSource(draft.fieldSources.timeoutMs, t)}
              {INHERITED_CONFIG_SEPARATOR}
              {draft.inherited.timeoutMs}
            </div>
          ) : null}
        </label>
        <label className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white px-4 py-3 md:col-span-2 dark:border-zinc-700 dark:bg-zinc-950">
          <div>
            <div className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
              {t('instances.detail.instanceWorkbench.agents.dialog.defaultAgent')}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              {t('instances.detail.instanceWorkbench.agents.dialog.defaultAgentDescription')}
            </div>
          </div>
          <Switch checked={draft.isDefault} onCheckedChange={onDefaultChange} />
        </label>
        <label className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white px-4 py-3 md:col-span-2 dark:border-zinc-700 dark:bg-zinc-950">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
              {t('instances.detail.instanceWorkbench.llmProviders.streaming')}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              {t('instances.detail.instanceWorkbench.agents.dialog.streamingDescription')}
            </div>
            {draft.fieldSources.streaming === 'defaults' &&
            draft.inherited.streaming !== null ? (
              <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                {formatAgentConfigSource(draft.fieldSources.streaming, t)}
                {INHERITED_CONFIG_SEPARATOR}
                {formatAgentStreamingValue(draft.inherited.streaming, t)}
              </div>
            ) : null}
          </div>
          <Select
            value={draft.streamingMode}
            onValueChange={(value) =>
              onStreamingModeChange(value as OpenClawAgentFormState['streamingMode'])
            }
          >
            <SelectTrigger className="w-[12rem] rounded-2xl">
              <SelectValue>{formatAgentStreamingMode(draft.streamingMode, t)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inherit">
                {t('instances.detail.instanceWorkbench.agents.panel.inheritDefaults')}
              </SelectItem>
              <SelectItem value="enabled">
                {t('instances.detail.instanceWorkbench.state.enabled')}
              </SelectItem>
              <SelectItem value="disabled">
                {t('instances.detail.instanceWorkbench.agents.skillStates.disabled')}
              </SelectItem>
            </SelectContent>
          </Select>
        </label>
      </div>
    </div>
  );
}
