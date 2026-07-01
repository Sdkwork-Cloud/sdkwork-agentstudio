import React from 'react';
import { Button, Input, Label } from '@sdkwork/claw-ui';
import { RowMetric } from './InstanceWorkbenchPrimitives.tsx';

interface ConfigAuthCooldownsDraft {
  rateLimitedProfileRotations: string;
  overloadedProfileRotations: string;
  overloadedBackoffMs: string;
  billingBackoffHours: string;
  billingMaxHours: string;
  failureWindowHours: string;
}

interface InstanceDetailConfigAuthCooldownsPanelProps {
  authCooldownsDraft: ConfigAuthCooldownsDraft;
  authCooldownsError: string | null;
  isSavingAuthCooldowns: boolean;
  canEditConfigAuthCooldowns: boolean;
  formatWorkbenchLabel: (value: string) => string;
  t: (key: string) => string;
  onSave: () => Promise<void> | void;
  onDraftChange: (key: keyof ConfigAuthCooldownsDraft, value: string) => void;
}

export function InstanceDetailConfigAuthCooldownsPanel({
  authCooldownsDraft,
  authCooldownsError,
  isSavingAuthCooldowns,
  canEditConfigAuthCooldowns,
  formatWorkbenchLabel,
  t,
  onSave,
  onDraftChange,
}: InstanceDetailConfigAuthCooldownsPanelProps) {
  const configuredFieldCount = [
    authCooldownsDraft.rateLimitedProfileRotations,
    authCooldownsDraft.overloadedProfileRotations,
    authCooldownsDraft.overloadedBackoffMs,
    authCooldownsDraft.billingBackoffHours,
    authCooldownsDraft.billingMaxHours,
    authCooldownsDraft.failureWindowHours,
  ].filter((value) => Boolean(value.trim())).length;

  return (
    <div
      data-slot="instance-detail-config-auth-cooldowns"
      className="rounded-[1.8rem] border border-zinc-200/70 bg-white/80 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-950/35"
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-primary-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-600 dark:text-primary-300">
              {t('instances.detail.instanceWorkbench.authCooldowns.badge')}
            </span>
            <span className="rounded-full bg-zinc-950/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
              {formatWorkbenchLabel('managedFile')}
            </span>
          </div>
          <h3 className="mt-3 text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {t('instances.detail.instanceWorkbench.authCooldowns.title')}
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            {t('instances.detail.instanceWorkbench.authCooldowns.description')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            onClick={() => void onSave()}
            disabled={!canEditConfigAuthCooldowns || isSavingAuthCooldowns}
          >
            {isSavingAuthCooldowns ? t('common.loading') : t('common.save')}
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.55fr)]">
        <div className="rounded-[1.4rem] bg-zinc-950/[0.03] p-4 dark:bg-white/[0.04]">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-2">
              <Label>
                {t('instances.detail.instanceWorkbench.authCooldowns.fields.rateLimitedProfileRotations')}
              </Label>
              <Input
                value={authCooldownsDraft.rateLimitedProfileRotations}
                onChange={(event) => onDraftChange('rateLimitedProfileRotations', event.target.value)}
                disabled={!canEditConfigAuthCooldowns}
                inputMode="numeric"
                placeholder={t('instances.detail.instanceWorkbench.authCooldowns.placeholders.defaultValue')}
              />
            </div>

            <div className="space-y-2">
              <Label>
                {t('instances.detail.instanceWorkbench.authCooldowns.fields.overloadedProfileRotations')}
              </Label>
              <Input
                value={authCooldownsDraft.overloadedProfileRotations}
                onChange={(event) => onDraftChange('overloadedProfileRotations', event.target.value)}
                disabled={!canEditConfigAuthCooldowns}
                inputMode="numeric"
                placeholder={t('instances.detail.instanceWorkbench.authCooldowns.placeholders.defaultValue')}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('instances.detail.instanceWorkbench.authCooldowns.fields.overloadedBackoffMs')}</Label>
              <Input
                value={authCooldownsDraft.overloadedBackoffMs}
                onChange={(event) => onDraftChange('overloadedBackoffMs', event.target.value)}
                disabled={!canEditConfigAuthCooldowns}
                inputMode="numeric"
                placeholder={t('instances.detail.instanceWorkbench.authCooldowns.placeholders.defaultValue')}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('instances.detail.instanceWorkbench.authCooldowns.fields.billingBackoffHours')}</Label>
              <Input
                value={authCooldownsDraft.billingBackoffHours}
                onChange={(event) => onDraftChange('billingBackoffHours', event.target.value)}
                disabled={!canEditConfigAuthCooldowns}
                inputMode="numeric"
                placeholder={t('instances.detail.instanceWorkbench.authCooldowns.placeholders.defaultValue')}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('instances.detail.instanceWorkbench.authCooldowns.fields.billingMaxHours')}</Label>
              <Input
                value={authCooldownsDraft.billingMaxHours}
                onChange={(event) => onDraftChange('billingMaxHours', event.target.value)}
                disabled={!canEditConfigAuthCooldowns}
                inputMode="numeric"
                placeholder={t('instances.detail.instanceWorkbench.authCooldowns.placeholders.defaultValue')}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('instances.detail.instanceWorkbench.authCooldowns.fields.failureWindowHours')}</Label>
              <Input
                value={authCooldownsDraft.failureWindowHours}
                onChange={(event) => onDraftChange('failureWindowHours', event.target.value)}
                disabled={!canEditConfigAuthCooldowns}
                inputMode="numeric"
                placeholder={t('instances.detail.instanceWorkbench.authCooldowns.placeholders.defaultValue')}
              />
            </div>
          </div>

          <p className="mt-4 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            {t('instances.detail.instanceWorkbench.authCooldowns.note')}
          </p>

          {authCooldownsError ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
              {authCooldownsError}
            </div>
          ) : null}
        </div>

        <div className="rounded-[1.4rem] border border-zinc-200/70 bg-white/90 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
          <div className="grid gap-4">
            <RowMetric
              label={t('instances.detail.instanceWorkbench.metrics.configuredFields')}
              value={configuredFieldCount}
            />
            <RowMetric
              label={t('instances.detail.instanceWorkbench.authCooldowns.metrics.overloadedBackoff')}
              value={
                authCooldownsDraft.overloadedBackoffMs.trim() ||
                t('instances.detail.instanceWorkbench.authCooldowns.values.upstreamDefault')
              }
            />
            <RowMetric
              label={t('instances.detail.instanceWorkbench.authCooldowns.metrics.failureWindow')}
              value={
                authCooldownsDraft.failureWindowHours.trim() ||
                t('instances.detail.instanceWorkbench.authCooldowns.values.upstreamDefault')
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
