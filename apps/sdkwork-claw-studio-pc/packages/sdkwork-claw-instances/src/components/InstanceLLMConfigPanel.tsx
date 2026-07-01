import React from 'react';
import { RefreshCw, RotateCcw, Save, Settings, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Button,
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
import type { InstanceLLMProviderUpdate, InstanceWorkbenchLLMProvider } from '../types';

interface InstanceLLMConfigPanelProps {
  provider: InstanceWorkbenchLLMProvider | null;
  draft: InstanceLLMProviderUpdate | null;
  hasPendingChanges: boolean;
  isSaving: boolean;
  isReadonly: boolean;
  readonlyMessage?: string;
  onOpenProviderCenter?: () => void;
  openProviderCenterLabel?: string;
  requestOverridesText: string;
  requestOverridesError?: string | null;
  onFieldChange: (
    field: 'endpoint' | 'apiKeySource' | 'defaultModelId' | 'reasoningModelId' | 'embeddingModelId',
    value: string,
  ) => void;
  onRequestOverridesChange: (value: string) => void;
  onConfigChange: (
    field: keyof InstanceLLMProviderUpdate['config'],
    value: number | boolean,
  ) => void;
  onReset: () => void;
  onSave: () => void;
}

export function InstanceLLMConfigPanel({
  provider,
  draft,
  hasPendingChanges,
  isSaving,
  isReadonly,
  readonlyMessage,
  onOpenProviderCenter,
  openProviderCenterLabel,
  requestOverridesText,
  requestOverridesError,
  onFieldChange,
  onRequestOverridesChange,
  onConfigChange,
  onReset,
  onSave,
}: InstanceLLMConfigPanelProps) {
  const { t } = useTranslation();
  const noneValue = '__none__';

  if (!provider || !draft) {
    return (
      <aside
        data-slot="instance-llm-config-panel"
        className="flex min-h-[36rem] items-center justify-center rounded-[1.5rem] border border-zinc-200/70 bg-white/80 p-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400"
      >
        {t('instances.detail.instanceWorkbench.llmProviders.selectProvider')}
      </aside>
    );
  }

  const config = draft.config;

  return (
    <aside
      data-slot="instance-llm-config-panel"
      className="rounded-[1.5rem] border border-zinc-200/70 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/40"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-950 text-sm font-semibold text-white dark:bg-white dark:text-zinc-950">
          {provider.icon}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {provider.name}
            </h3>
            <span className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
              {provider.provider}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            {provider.description}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {provider.capabilities.map((capability) => (
          <span
            key={capability}
            className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300"
          >
            {capability}
          </span>
        ))}
      </div>

      {isReadonly && readonlyMessage ? (
        <div className="mt-5 rounded-[1.25rem] border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm leading-6 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
          <div>{readonlyMessage}</div>
          {onOpenProviderCenter && openProviderCenterLabel ? (
            <Button
              type="button"
              variant="outline"
              onClick={onOpenProviderCenter}
              className="mt-3 rounded-2xl border-amber-300/80 bg-white/80 px-4 py-2 text-amber-900 hover:bg-white dark:border-amber-400/30 dark:bg-zinc-950/30 dark:text-amber-100 dark:hover:bg-zinc-950/50"
            >
              <Settings className="h-4 w-4" />
              {openProviderCenterLabel}
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 space-y-4">
        <label className="block">
          <Label className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
            {t('instances.detail.instanceWorkbench.llmProviders.endpoint')}
          </Label>
          <Input
            type="text"
            value={draft.endpoint}
            disabled={isReadonly}
            onChange={(event) => onFieldChange('endpoint', event.target.value)}
            className="rounded-2xl bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>

        <label className="block">
          <Label className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
            {t('instances.detail.instanceWorkbench.llmProviders.apiKeySource')}
          </Label>
          <Input
            type="text"
            value={draft.apiKeySource}
            disabled={isReadonly}
            onChange={(event) => onFieldChange('apiKeySource', event.target.value)}
            className="rounded-2xl bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <Label className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
              {t('instances.detail.instanceWorkbench.llmProviders.defaultModel')}
            </Label>
            <Select
              value={draft.defaultModelId}
              disabled={isReadonly}
              onValueChange={(value) => onFieldChange('defaultModelId', value)}
            >
              <SelectTrigger className="h-auto rounded-2xl bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-950">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {provider.models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="block">
            <Label className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
              {t('instances.detail.instanceWorkbench.llmProviders.reasoningModel')}
            </Label>
            <Select
              value={draft.reasoningModelId || noneValue}
              disabled={isReadonly}
              onValueChange={(value) =>
                onFieldChange('reasoningModelId', value === noneValue ? '' : value)
              }
            >
              <SelectTrigger className="h-auto rounded-2xl bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-950">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={noneValue}>{t('common.none')}</SelectItem>
                {provider.models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="block md:col-span-2">
            <Label className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
              {t('instances.detail.instanceWorkbench.llmProviders.embeddingModel')}
            </Label>
            <Select
              value={draft.embeddingModelId || noneValue}
              disabled={isReadonly}
              onValueChange={(value) =>
                onFieldChange('embeddingModelId', value === noneValue ? '' : value)
              }
            >
              <SelectTrigger className="h-auto rounded-2xl bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-950">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={noneValue}>{t('common.none')}</SelectItem>
                {provider.models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>

        <div className="rounded-[1.4rem] bg-zinc-950/[0.03] p-4 dark:bg-white/[0.04]">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            <SlidersHorizontal className="h-4 w-4" />
            {t('instances.detail.instanceWorkbench.llmProviders.parameters')}
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block">
              <Label className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                {t('instances.detail.instanceWorkbench.llmProviders.temperature')}
              </Label>
              <Input
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={config.temperature}
                disabled={isReadonly}
                onChange={(event) => onConfigChange('temperature', Number(event.target.value))}
                className="rounded-2xl bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>

            <label className="block">
              <Label className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                {t('instances.detail.instanceWorkbench.llmProviders.topP')}
              </Label>
              <Input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={config.topP}
                disabled={isReadonly}
                onChange={(event) => onConfigChange('topP', Number(event.target.value))}
                className="rounded-2xl bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>

            <label className="block">
              <Label className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                {t('instances.detail.instanceWorkbench.llmProviders.maxTokens')}
              </Label>
              <Input
                type="number"
                min="1"
                step="1"
                value={config.maxTokens}
                disabled={isReadonly}
                onChange={(event) => onConfigChange('maxTokens', Number(event.target.value))}
                className="rounded-2xl bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>

            <label className="block">
              <Label className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                {t('instances.detail.instanceWorkbench.llmProviders.timeoutMs')}
              </Label>
              <Input
                type="number"
                min="1000"
                step="1000"
                value={config.timeoutMs}
                disabled={isReadonly}
                onChange={(event) => onConfigChange('timeoutMs', Number(event.target.value))}
                className="rounded-2xl bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>
          </div>

          <label className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-950">
            <div>
              <div className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                {t('instances.detail.instanceWorkbench.llmProviders.streaming')}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                {t('instances.detail.instanceWorkbench.llmProviders.streamingDescription')}
              </div>
            </div>
            <Switch
              checked={config.streaming}
              disabled={isReadonly}
              onCheckedChange={(checked) => onConfigChange('streaming', checked)}
            />
          </label>
        </div>

        <div className="rounded-[1.4rem] bg-zinc-950/[0.03] p-4 dark:bg-white/[0.04]">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            <Settings className="h-4 w-4" />
            {t('instances.detail.instanceWorkbench.llmProviders.requestOverrides')}
          </div>
          <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            {t('instances.detail.instanceWorkbench.llmProviders.requestOverridesDescription')}
          </p>
          <Textarea
            value={requestOverridesText}
            disabled={isReadonly}
            onChange={(event) => onRequestOverridesChange(event.target.value)}
            placeholder={t('instances.detail.instanceWorkbench.llmProviders.requestOverridesPlaceholder')}
            className="mt-4 min-h-[10rem] rounded-2xl bg-white px-4 py-3 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
          />
          {requestOverridesError ? (
            <p className="mt-3 text-sm text-rose-600 dark:text-rose-300">{requestOverridesError}</p>
          ) : (
            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              {t('instances.detail.instanceWorkbench.llmProviders.requestOverridesHint')}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button
          onClick={onReset}
          disabled={isReadonly || !hasPendingChanges}
          variant="outline"
          className="rounded-2xl px-4 py-3"
        >
          <RotateCcw className="h-4 w-4" />
          {t('instances.detail.instanceWorkbench.llmProviders.revertConfig')}
        </Button>
        <Button
          onClick={onSave}
          disabled={isReadonly || !hasPendingChanges || isSaving || Boolean(requestOverridesError)}
          className="rounded-2xl px-4 py-3"
        >
          {isSaving ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              {t('instances.detail.instanceWorkbench.llmProviders.saving')}
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              {t('instances.detail.instanceWorkbench.llmProviders.saveConfig')}
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
