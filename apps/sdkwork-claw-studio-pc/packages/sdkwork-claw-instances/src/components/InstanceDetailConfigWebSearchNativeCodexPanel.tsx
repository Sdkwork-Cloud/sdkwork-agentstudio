import React from 'react';
import { Button, Input, Label, Switch, Textarea } from '@sdkwork/claw-ui';
import { RowMetric } from './InstanceWorkbenchPrimitives.tsx';

interface ConfigWebSearchNativeCodexDraft {
  enabled: boolean;
  mode: string;
  allowedDomains: string;
  contextSize: string;
  userLocationCountry: string;
  userLocationCity: string;
  userLocationTimezone: string;
  advancedConfig: string;
}

interface InstanceDetailConfigWebSearchNativeCodexPanelProps {
  webSearchNativeCodexDraft: ConfigWebSearchNativeCodexDraft;
  webSearchNativeCodexError: string | null;
  isSavingWebSearchNativeCodex: boolean;
  canEditConfigWebSearchNativeCodex: boolean;
  formatWorkbenchLabel: (value: string) => string;
  t: (key: string) => string;
  onSave: () => Promise<void> | void;
  onDraftChange: (
    key: keyof ConfigWebSearchNativeCodexDraft,
    value: string | boolean,
  ) => void;
}

export function InstanceDetailConfigWebSearchNativeCodexPanel({
  webSearchNativeCodexDraft,
  webSearchNativeCodexError,
  isSavingWebSearchNativeCodex,
  canEditConfigWebSearchNativeCodex,
  formatWorkbenchLabel,
  t,
  onSave,
  onDraftChange,
}: InstanceDetailConfigWebSearchNativeCodexPanelProps) {
  const allowedDomains = webSearchNativeCodexDraft.allowedDomains
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  return (
    <div
      data-slot="instance-detail-config-web-search-native-codex"
      className="rounded-[1.8rem] border border-zinc-200/70 bg-white/80 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-950/35"
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-primary-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-600 dark:text-primary-300">
              {t('instances.detail.instanceWorkbench.webSearchNativeCodex.badge')}
            </span>
            <span className="rounded-full bg-zinc-950/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
              {formatWorkbenchLabel('managedFile')}
            </span>
          </div>
          <h3 className="mt-3 text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {t('instances.detail.instanceWorkbench.webSearchNativeCodex.title')}
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            {t('instances.detail.instanceWorkbench.webSearchNativeCodex.description')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            onClick={() => void onSave()}
            disabled={!canEditConfigWebSearchNativeCodex || isSavingWebSearchNativeCodex}
          >
            {isSavingWebSearchNativeCodex ? t('common.loading') : t('common.save')}
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
                    {t('instances.detail.instanceWorkbench.webSearchNativeCodex.fields.enabled')}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                    {t('instances.detail.instanceWorkbench.webSearchNativeCodex.enabledDescription')}
                  </p>
                </div>
                <Switch
                  checked={webSearchNativeCodexDraft.enabled}
                  onCheckedChange={(checked) => onDraftChange('enabled', checked)}
                  disabled={!canEditConfigWebSearchNativeCodex}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('instances.detail.instanceWorkbench.webSearchNativeCodex.fields.mode')}</Label>
              <Input
                value={webSearchNativeCodexDraft.mode}
                onChange={(event) => onDraftChange('mode', event.target.value)}
                disabled={!canEditConfigWebSearchNativeCodex}
                placeholder={t('instances.detail.instanceWorkbench.webSearchNativeCodex.placeholders.mode')}
              />
            </div>

            <div className="space-y-2">
              <Label>
                {t('instances.detail.instanceWorkbench.webSearchNativeCodex.fields.contextSize')}
              </Label>
              <Input
                value={webSearchNativeCodexDraft.contextSize}
                onChange={(event) => onDraftChange('contextSize', event.target.value)}
                disabled={!canEditConfigWebSearchNativeCodex}
                placeholder={t('instances.detail.instanceWorkbench.webSearchNativeCodex.placeholders.contextSize')}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>
                {t('instances.detail.instanceWorkbench.webSearchNativeCodex.fields.allowedDomains')}
              </Label>
              <Textarea
                value={webSearchNativeCodexDraft.allowedDomains}
                onChange={(event) => onDraftChange('allowedDomains', event.target.value)}
                disabled={!canEditConfigWebSearchNativeCodex}
                rows={5}
                placeholder={t('instances.detail.instanceWorkbench.webSearchNativeCodex.placeholders.allowedDomains')}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-4">
            <RowMetric
              label={t('instances.detail.instanceWorkbench.webSearchNativeCodex.metrics.mode')}
              value={webSearchNativeCodexDraft.mode || '--'}
            />
            <RowMetric
              label={t('instances.detail.instanceWorkbench.webSearchNativeCodex.metrics.allowedDomains')}
              value={String(allowedDomains.length)}
            />
          </div>
        </div>

        <div className="rounded-[1.4rem] border border-zinc-200/70 bg-white/90 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>
                {t('instances.detail.instanceWorkbench.webSearchNativeCodex.fields.userLocationCountry')}
              </Label>
              <Input
                value={webSearchNativeCodexDraft.userLocationCountry}
                onChange={(event) => onDraftChange('userLocationCountry', event.target.value)}
                disabled={!canEditConfigWebSearchNativeCodex}
                placeholder={t('instances.detail.instanceWorkbench.webSearchNativeCodex.placeholders.userLocationCountry')}
              />
            </div>

            <div className="space-y-2">
              <Label>
                {t('instances.detail.instanceWorkbench.webSearchNativeCodex.fields.userLocationCity')}
              </Label>
              <Input
                value={webSearchNativeCodexDraft.userLocationCity}
                onChange={(event) => onDraftChange('userLocationCity', event.target.value)}
                disabled={!canEditConfigWebSearchNativeCodex}
                placeholder={t('instances.detail.instanceWorkbench.webSearchNativeCodex.placeholders.userLocationCity')}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>
                {t('instances.detail.instanceWorkbench.webSearchNativeCodex.fields.userLocationTimezone')}
              </Label>
              <Input
                value={webSearchNativeCodexDraft.userLocationTimezone}
                onChange={(event) => onDraftChange('userLocationTimezone', event.target.value)}
                disabled={!canEditConfigWebSearchNativeCodex}
                placeholder={t('instances.detail.instanceWorkbench.webSearchNativeCodex.placeholders.userLocationTimezone')}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>
                {t('instances.detail.instanceWorkbench.webSearchNativeCodex.fields.advancedConfig')}
              </Label>
              <Textarea
                value={webSearchNativeCodexDraft.advancedConfig}
                onChange={(event) => onDraftChange('advancedConfig', event.target.value)}
                disabled={!canEditConfigWebSearchNativeCodex}
                rows={7}
                placeholder={t('instances.detail.instanceWorkbench.webSearchNativeCodex.placeholders.advancedConfig')}
              />
              <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                {t('instances.detail.instanceWorkbench.webSearchNativeCodex.advancedDescription')}
              </p>
            </div>
          </div>

          {webSearchNativeCodexError ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
              {webSearchNativeCodexError}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
