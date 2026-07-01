import React from 'react';
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
import type { InstanceWorkbenchSnapshot } from '../types/index.ts';
import { RowMetric } from './InstanceWorkbenchPrimitives.tsx';

type ConfigWebSearchConfig = NonNullable<InstanceWorkbenchSnapshot['configWebSearch']>;
type ConfigWebSearchProvider = ConfigWebSearchConfig['providers'][number];

interface ConfigWebSearchSharedDraft {
  enabled: boolean;
  provider: string;
  maxResults: string;
  timeoutSeconds: string;
  cacheTtlMinutes: string;
}

interface ConfigWebSearchProviderDraft {
  apiKeySource: string;
  baseUrl: string;
  model: string;
  advancedConfig: string;
}

interface InstanceDetailConfigWebSearchPanelProps {
  configWebSearch: ConfigWebSearchConfig;
  webSearchSharedDraft: ConfigWebSearchSharedDraft;
  selectedWebSearchProvider: ConfigWebSearchProvider;
  selectedWebSearchProviderDraft: ConfigWebSearchProviderDraft;
  webSearchError: string | null;
  isSavingWebSearch: boolean;
  canEditConfigWebSearch: boolean;
  formatWorkbenchLabel: (value: string) => string;
  t: (key: string) => string;
  onSave: () => Promise<void> | void;
  onWebSearchSharedDraftChange: (
    key: keyof ConfigWebSearchSharedDraft,
    value: string | boolean,
  ) => void;
  onWebSearchProviderDraftChange: (
    key: keyof ConfigWebSearchProviderDraft,
    value: string,
  ) => void;
  onSelectedWebSearchProviderIdChange: (providerId: string) => void;
}

export function InstanceDetailConfigWebSearchPanel({
  configWebSearch,
  webSearchSharedDraft,
  selectedWebSearchProvider,
  selectedWebSearchProviderDraft,
  webSearchError,
  isSavingWebSearch,
  canEditConfigWebSearch,
  formatWorkbenchLabel,
  t,
  onSave,
  onWebSearchSharedDraftChange,
  onWebSearchProviderDraftChange,
  onSelectedWebSearchProviderIdChange,
}: InstanceDetailConfigWebSearchPanelProps) {
  return (
    <div
      data-slot="instance-detail-config-web-search"
      className="rounded-[1.8rem] border border-zinc-200/70 bg-white/80 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-950/35"
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-primary-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-600 dark:text-primary-300">
              {t('instances.detail.instanceWorkbench.webSearch.badge')}
            </span>
            <span className="rounded-full bg-zinc-950/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
              {formatWorkbenchLabel('managedFile')}
            </span>
          </div>
          <h3 className="mt-3 text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {t('instances.detail.instanceWorkbench.webSearch.title')}
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            {t('instances.detail.instanceWorkbench.webSearch.description')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            onClick={() => void onSave()}
            disabled={!canEditConfigWebSearch || isSavingWebSearch}
          >
            {isSavingWebSearch ? t('common.loading') : t('common.save')}
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="rounded-[1.4rem] bg-zinc-950/[0.03] p-4 dark:bg-white/[0.04]">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200/70 bg-white/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                    {t('instances.detail.instanceWorkbench.webSearch.fields.enabled')}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                    {t('instances.detail.instanceWorkbench.webSearch.enabledDescription')}
                  </p>
                </div>
                <Switch
                  checked={webSearchSharedDraft.enabled}
                  onCheckedChange={(checked) => onWebSearchSharedDraftChange('enabled', checked)}
                  disabled={!canEditConfigWebSearch}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('instances.detail.instanceWorkbench.webSearch.fields.provider')}</Label>
              <Select
                value={webSearchSharedDraft.provider || ''}
                onValueChange={(value) => onWebSearchSharedDraftChange('provider', value)}
                disabled={!canEditConfigWebSearch}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={t('instances.detail.instanceWorkbench.webSearch.placeholders.provider')}
                  />
                </SelectTrigger>
                <SelectContent>
                  {configWebSearch.providers.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('instances.detail.instanceWorkbench.webSearch.fields.maxResults')}</Label>
              <Input
                value={webSearchSharedDraft.maxResults}
                onChange={(event) => onWebSearchSharedDraftChange('maxResults', event.target.value)}
                disabled={!canEditConfigWebSearch}
                inputMode="numeric"
              />
            </div>

            <div className="space-y-2">
              <Label>{t('instances.detail.instanceWorkbench.webSearch.fields.timeoutSeconds')}</Label>
              <Input
                value={webSearchSharedDraft.timeoutSeconds}
                onChange={(event) =>
                  onWebSearchSharedDraftChange('timeoutSeconds', event.target.value)
                }
                disabled={!canEditConfigWebSearch}
                inputMode="numeric"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>{t('instances.detail.instanceWorkbench.webSearch.fields.cacheTtlMinutes')}</Label>
              <Input
                value={webSearchSharedDraft.cacheTtlMinutes}
                onChange={(event) =>
                  onWebSearchSharedDraftChange('cacheTtlMinutes', event.target.value)
                }
                disabled={!canEditConfigWebSearch}
                inputMode="numeric"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-4">
            <RowMetric
              label={t('instances.detail.instanceWorkbench.webSearch.metrics.activeProvider')}
              value={webSearchSharedDraft.provider || '--'}
            />
            <RowMetric
              label={t('instances.detail.instanceWorkbench.webSearch.metrics.configuredProviders')}
              value={String(configWebSearch.providers.length)}
            />
          </div>
        </div>

        <div className="rounded-[1.4rem] border border-zinc-200/70 bg-white/90 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                {t('instances.detail.instanceWorkbench.webSearch.providerPanel')}
              </div>
              <h4 className="mt-2 text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                {selectedWebSearchProvider.name}
              </h4>
              <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                {selectedWebSearchProvider.description}
              </p>
            </div>
            <div className="min-w-[14rem] space-y-2">
              <Label>{t('instances.detail.instanceWorkbench.webSearch.fields.providerEditor')}</Label>
              <Select
                value={selectedWebSearchProvider.id}
                onValueChange={onSelectedWebSearchProviderIdChange}
                disabled={!canEditConfigWebSearch}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {configWebSearch.providers.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {selectedWebSearchProvider.supportsApiKey ? (
              <div className="space-y-2 md:col-span-2">
                <Label>{t('instances.detail.instanceWorkbench.webSearch.fields.apiKeySource')}</Label>
                <Input
                  value={selectedWebSearchProviderDraft.apiKeySource}
                  onChange={(event) =>
                    onWebSearchProviderDraftChange('apiKeySource', event.target.value)
                  }
                  disabled={!canEditConfigWebSearch}
                  placeholder={t('instances.detail.instanceWorkbench.webSearch.placeholders.apiKeySource')}
                />
              </div>
            ) : null}

            {selectedWebSearchProvider.supportsBaseUrl ? (
              <div className="space-y-2 md:col-span-2">
                <Label>{t('instances.detail.instanceWorkbench.webSearch.fields.baseUrl')}</Label>
                <Input
                  value={selectedWebSearchProviderDraft.baseUrl}
                  onChange={(event) => onWebSearchProviderDraftChange('baseUrl', event.target.value)}
                  disabled={!canEditConfigWebSearch}
                  placeholder={t('instances.detail.instanceWorkbench.webSearch.placeholders.baseUrl')}
                />
              </div>
            ) : null}

            {selectedWebSearchProvider.supportsModel ? (
              <div className="space-y-2 md:col-span-2">
                <Label>{t('instances.detail.instanceWorkbench.webSearch.fields.model')}</Label>
                <Input
                  value={selectedWebSearchProviderDraft.model}
                  onChange={(event) => onWebSearchProviderDraftChange('model', event.target.value)}
                  disabled={!canEditConfigWebSearch}
                  placeholder={t('instances.detail.instanceWorkbench.webSearch.placeholders.model')}
                />
              </div>
            ) : null}

            <div className="space-y-2 md:col-span-2">
              <Label>{t('instances.detail.instanceWorkbench.webSearch.fields.advancedConfig')}</Label>
              <Textarea
                value={selectedWebSearchProviderDraft.advancedConfig}
                onChange={(event) =>
                  onWebSearchProviderDraftChange('advancedConfig', event.target.value)
                }
                disabled={!canEditConfigWebSearch}
                rows={8}
                placeholder={t('instances.detail.instanceWorkbench.webSearch.placeholders.advancedConfig')}
              />
              <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                {t('instances.detail.instanceWorkbench.webSearch.advancedDescription')}
              </p>
            </div>
          </div>

          {webSearchError ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
              {webSearchError}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
