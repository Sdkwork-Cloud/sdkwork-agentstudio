import React from 'react';
import { Loader2, Save } from 'lucide-react';
import { Button, Input, Label, Switch, Textarea } from '@sdkwork/claw-ui';
import type { InstanceWorkbenchSnapshot } from '../types/index.ts';
import { RowMetric } from './InstanceWorkbenchPrimitives.tsx';

type ConfigWebFetchConfig = NonNullable<InstanceWorkbenchSnapshot['configWebFetch']>;

interface ConfigWebFetchSharedDraft {
  enabled: boolean;
  maxChars: string;
  maxCharsCap: string;
  maxResponseBytes: string;
  timeoutSeconds: string;
  cacheTtlMinutes: string;
  maxRedirects: string;
  readability: boolean;
  userAgent: string;
}

interface ConfigWebFetchFallbackDraft {
  apiKeySource: string;
  baseUrl: string;
  advancedConfig: string;
}

interface InstanceDetailConfigWebFetchPanelProps {
  configWebFetch: ConfigWebFetchConfig;
  webFetchSharedDraft: ConfigWebFetchSharedDraft;
  webFetchFallbackDraft: ConfigWebFetchFallbackDraft;
  webFetchError: string | null;
  isSavingWebFetch: boolean;
  canEditConfigWebFetch: boolean;
  t: (key: string) => string;
  onSave: () => Promise<void> | void;
  onWebFetchSharedDraftChange: (
    key: keyof ConfigWebFetchSharedDraft,
    value: string | boolean,
  ) => void;
  onWebFetchFallbackDraftChange: (
    key: keyof ConfigWebFetchFallbackDraft,
    value: string,
  ) => void;
}

export function InstanceDetailConfigWebFetchPanel({
  configWebFetch,
  webFetchSharedDraft,
  webFetchFallbackDraft,
  webFetchError,
  isSavingWebFetch,
  canEditConfigWebFetch,
  t,
  onSave,
  onWebFetchSharedDraftChange,
  onWebFetchFallbackDraftChange,
}: InstanceDetailConfigWebFetchPanelProps) {
  return (
    <div
      data-slot="instance-detail-config-web-fetch"
      className="overflow-hidden rounded-[1.75rem] border border-zinc-200/70 bg-white/95 shadow-[0_20px_70px_-55px_rgba(15,23,42,0.45)] dark:border-zinc-800 dark:bg-zinc-950/55"
    >
      <div className="border-b border-zinc-200/70 bg-zinc-950/[0.03] px-6 py-5 dark:border-zinc-800 dark:bg-white/[0.02]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="inline-flex rounded-full border border-zinc-200 bg-white px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
              {t('instances.detail.instanceWorkbench.webFetch.badge')}
            </span>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {t('instances.detail.instanceWorkbench.webFetch.title')}
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              {t('instances.detail.instanceWorkbench.webFetch.description')}
            </p>
          </div>
          <Button
            onClick={() => void onSave()}
            disabled={!canEditConfigWebFetch || isSavingWebFetch}
            className="rounded-full px-5"
          >
            {isSavingWebFetch ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {isSavingWebFetch
              ? t('instances.detail.actions.saving')
              : t('instances.detail.actions.saveConfiguration')}
          </Button>
        </div>
      </div>

      <div className="space-y-6 px-6 py-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-[1.4rem] border border-zinc-200/70 bg-white/90 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  {t('instances.detail.instanceWorkbench.webFetch.fields.enabled')}
                </div>
                <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  {t('instances.detail.instanceWorkbench.webFetch.enabledDescription')}
                </p>
              </div>
              <Switch
                checked={webFetchSharedDraft.enabled}
                onCheckedChange={(checked) => onWebFetchSharedDraftChange('enabled', checked)}
                disabled={!canEditConfigWebFetch}
              />
            </div>
          </div>

          <div className="rounded-[1.4rem] border border-zinc-200/70 bg-white/90 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  {t('instances.detail.instanceWorkbench.webFetch.fields.readability')}
                </div>
                <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  {t('instances.detail.instanceWorkbench.webFetch.readabilityDescription')}
                </p>
              </div>
              <Switch
                checked={webFetchSharedDraft.readability}
                onCheckedChange={(checked) => onWebFetchSharedDraftChange('readability', checked)}
                disabled={!canEditConfigWebFetch}
              />
            </div>
          </div>

          <RowMetric
            label={t('instances.detail.instanceWorkbench.webFetch.metrics.fallbackProvider')}
            value={configWebFetch.fallbackProvider.name}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-2">
            <Label>{t('instances.detail.instanceWorkbench.webFetch.fields.maxChars')}</Label>
            <Input
              value={webFetchSharedDraft.maxChars}
              onChange={(event) => onWebFetchSharedDraftChange('maxChars', event.target.value)}
              disabled={!canEditConfigWebFetch}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('instances.detail.instanceWorkbench.webFetch.fields.maxCharsCap')}</Label>
            <Input
              value={webFetchSharedDraft.maxCharsCap}
              onChange={(event) => onWebFetchSharedDraftChange('maxCharsCap', event.target.value)}
              disabled={!canEditConfigWebFetch}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('instances.detail.instanceWorkbench.webFetch.fields.maxResponseBytes')}</Label>
            <Input
              value={webFetchSharedDraft.maxResponseBytes}
              onChange={(event) =>
                onWebFetchSharedDraftChange('maxResponseBytes', event.target.value)
              }
              disabled={!canEditConfigWebFetch}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('instances.detail.instanceWorkbench.webFetch.fields.timeoutSeconds')}</Label>
            <Input
              value={webFetchSharedDraft.timeoutSeconds}
              onChange={(event) =>
                onWebFetchSharedDraftChange('timeoutSeconds', event.target.value)
              }
              disabled={!canEditConfigWebFetch}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('instances.detail.instanceWorkbench.webFetch.fields.cacheTtlMinutes')}</Label>
            <Input
              value={webFetchSharedDraft.cacheTtlMinutes}
              onChange={(event) =>
                onWebFetchSharedDraftChange('cacheTtlMinutes', event.target.value)
              }
              disabled={!canEditConfigWebFetch}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('instances.detail.instanceWorkbench.webFetch.fields.maxRedirects')}</Label>
            <Input
              value={webFetchSharedDraft.maxRedirects}
              onChange={(event) =>
                onWebFetchSharedDraftChange('maxRedirects', event.target.value)
              }
              disabled={!canEditConfigWebFetch}
            />
          </div>
          <div className="space-y-2 md:col-span-2 xl:col-span-3">
            <Label>{t('instances.detail.instanceWorkbench.webFetch.fields.userAgent')}</Label>
            <Input
              value={webFetchSharedDraft.userAgent}
              onChange={(event) => onWebFetchSharedDraftChange('userAgent', event.target.value)}
              disabled={!canEditConfigWebFetch}
              placeholder={t('instances.detail.instanceWorkbench.webFetch.placeholders.userAgent')}
            />
          </div>
        </div>

        <div className="rounded-[1.4rem] border border-zinc-200/70 bg-white/90 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                {t('instances.detail.instanceWorkbench.webFetch.providerPanel')}
              </div>
              <h4 className="mt-2 text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                {configWebFetch.fallbackProvider.name}
              </h4>
              <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                {configWebFetch.fallbackProvider.description}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>{t('instances.detail.instanceWorkbench.webFetch.fields.apiKeySource')}</Label>
              <Input
                value={webFetchFallbackDraft.apiKeySource}
                onChange={(event) =>
                  onWebFetchFallbackDraftChange('apiKeySource', event.target.value)
                }
                disabled={!canEditConfigWebFetch}
                placeholder={t('instances.detail.instanceWorkbench.webFetch.placeholders.apiKeySource')}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>{t('instances.detail.instanceWorkbench.webFetch.fields.baseUrl')}</Label>
              <Input
                value={webFetchFallbackDraft.baseUrl}
                onChange={(event) => onWebFetchFallbackDraftChange('baseUrl', event.target.value)}
                disabled={!canEditConfigWebFetch}
                placeholder={t('instances.detail.instanceWorkbench.webFetch.placeholders.baseUrl')}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>{t('instances.detail.instanceWorkbench.webFetch.fields.advancedConfig')}</Label>
              <Textarea
                value={webFetchFallbackDraft.advancedConfig}
                onChange={(event) =>
                  onWebFetchFallbackDraftChange('advancedConfig', event.target.value)
                }
                disabled={!canEditConfigWebFetch}
                rows={8}
                placeholder={t('instances.detail.instanceWorkbench.webFetch.placeholders.advancedConfig')}
              />
              <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                {t('instances.detail.instanceWorkbench.webFetch.advancedDescription')}
              </p>
            </div>
          </div>
        </div>

        {webFetchError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
            {webFetchError}
          </div>
        ) : null}
      </div>
    </div>
  );
}
