import React from 'react';
import { presentOpenClawSecretSource } from '@sdkwork/claw-core';
import { Button, Input, Label, Switch, Textarea } from '@sdkwork/claw-ui';
import { RowMetric } from './InstanceWorkbenchPrimitives.tsx';

interface ConfigXSearchDraft {
  enabled: boolean;
  apiKeySource: string;
  model: string;
  inlineCitations: boolean;
  maxTurns: string;
  timeoutSeconds: string;
  cacheTtlMinutes: string;
  advancedConfig: string;
}

interface InstanceDetailConfigXSearchPanelProps {
  xSearchDraft: ConfigXSearchDraft;
  xSearchError: string | null;
  isSavingXSearch: boolean;
  canEditConfigXSearch: boolean;
  formatWorkbenchLabel: (value: string) => string;
  t: (key: string) => string;
  onSave: () => Promise<void> | void;
  onDraftChange: (key: keyof ConfigXSearchDraft, value: string | boolean) => void;
}

export function InstanceDetailConfigXSearchPanel({
  xSearchDraft,
  xSearchError,
  isSavingXSearch,
  canEditConfigXSearch,
  formatWorkbenchLabel,
  t,
  onSave,
  onDraftChange,
}: InstanceDetailConfigXSearchPanelProps) {
  return (
    <div
      data-slot="instance-detail-config-x-search"
      className="rounded-[1.8rem] border border-zinc-200/70 bg-white/80 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-950/35"
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-primary-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-600 dark:text-primary-300">
              {t('instances.detail.instanceWorkbench.xSearch.badge')}
            </span>
            <span className="rounded-full bg-zinc-950/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
              {formatWorkbenchLabel('managedFile')}
            </span>
          </div>
          <h3 className="mt-3 text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {t('instances.detail.instanceWorkbench.xSearch.title')}
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            {t('instances.detail.instanceWorkbench.xSearch.description')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            onClick={() => void onSave()}
            disabled={!canEditConfigXSearch || isSavingXSearch}
          >
            {isSavingXSearch ? t('common.loading') : t('common.save')}
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-[1.4rem] bg-zinc-950/[0.03] p-4 dark:bg-white/[0.04]">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200/70 bg-white/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                    {t('instances.detail.instanceWorkbench.xSearch.fields.enabled')}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                    {t('instances.detail.instanceWorkbench.xSearch.enabledDescription')}
                  </p>
                </div>
                <Switch
                  checked={xSearchDraft.enabled}
                  onCheckedChange={(checked) => onDraftChange('enabled', checked)}
                  disabled={!canEditConfigXSearch}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200/70 bg-white/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                    {t('instances.detail.instanceWorkbench.xSearch.fields.inlineCitations')}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                    {t('instances.detail.instanceWorkbench.xSearch.inlineCitationsDescription')}
                  </p>
                </div>
                <Switch
                  checked={xSearchDraft.inlineCitations}
                  onCheckedChange={(checked) => onDraftChange('inlineCitations', checked)}
                  disabled={!canEditConfigXSearch}
                />
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>{t('instances.detail.instanceWorkbench.xSearch.fields.apiKeySource')}</Label>
              <Input
                value={xSearchDraft.apiKeySource}
                onChange={(event) => onDraftChange('apiKeySource', event.target.value)}
                disabled={!canEditConfigXSearch}
                placeholder={t('instances.detail.instanceWorkbench.xSearch.placeholders.apiKeySource')}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>{t('instances.detail.instanceWorkbench.xSearch.fields.model')}</Label>
              <Input
                value={xSearchDraft.model}
                onChange={(event) => onDraftChange('model', event.target.value)}
                disabled={!canEditConfigXSearch}
                placeholder={t('instances.detail.instanceWorkbench.xSearch.placeholders.model')}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('instances.detail.instanceWorkbench.xSearch.fields.maxTurns')}</Label>
              <Input
                value={xSearchDraft.maxTurns}
                onChange={(event) => onDraftChange('maxTurns', event.target.value)}
                disabled={!canEditConfigXSearch}
                inputMode="numeric"
              />
            </div>

            <div className="space-y-2">
              <Label>{t('instances.detail.instanceWorkbench.xSearch.fields.timeoutSeconds')}</Label>
              <Input
                value={xSearchDraft.timeoutSeconds}
                onChange={(event) => onDraftChange('timeoutSeconds', event.target.value)}
                disabled={!canEditConfigXSearch}
                inputMode="numeric"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>{t('instances.detail.instanceWorkbench.xSearch.fields.cacheTtlMinutes')}</Label>
              <Input
                value={xSearchDraft.cacheTtlMinutes}
                onChange={(event) => onDraftChange('cacheTtlMinutes', event.target.value)}
                disabled={!canEditConfigXSearch}
                inputMode="numeric"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-4">
            <RowMetric
              label={t('instances.detail.instanceWorkbench.xSearch.metrics.sharedAuth')}
              value={presentOpenClawSecretSource(xSearchDraft.apiKeySource)}
            />
            <RowMetric
              label={t('instances.detail.instanceWorkbench.xSearch.metrics.model')}
              value={xSearchDraft.model.trim() || '--'}
            />
          </div>
        </div>

        <div className="rounded-[1.4rem] border border-zinc-200/70 bg-white/90 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
          <div className="space-y-2">
            <Label>{t('instances.detail.instanceWorkbench.xSearch.fields.advancedConfig')}</Label>
            <Textarea
              value={xSearchDraft.advancedConfig}
              onChange={(event) => onDraftChange('advancedConfig', event.target.value)}
              disabled={!canEditConfigXSearch}
              rows={10}
              placeholder={t('instances.detail.instanceWorkbench.xSearch.placeholders.advancedConfig')}
            />
            <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              {t('instances.detail.instanceWorkbench.xSearch.advancedDescription')}
            </p>
          </div>

          {xSearchError ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
              {xSearchError}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
