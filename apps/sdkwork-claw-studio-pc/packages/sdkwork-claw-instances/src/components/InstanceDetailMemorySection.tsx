import React from 'react';
import { Button, Input, Label, Switch } from '@sdkwork/claw-ui';
import { isDreamDiaryMemoryEntry, type OpenClawDreamingFormState } from '../services/index.ts';
import type { InstanceWorkbenchSnapshot } from '../types/index.ts';
import { RowMetric, WorkbenchRow, WorkbenchRowList } from './InstanceWorkbenchPrimitives.tsx';

export interface InstanceDetailMemorySectionProps {
  memories: InstanceWorkbenchSnapshot['memories'];
  hasMemoryEntries: boolean;
  dreamingDraft: OpenClawDreamingFormState | null;
  dreamingError: string | null;
  isSavingDreaming: boolean;
  canEditDreamingConfig: boolean;
  latestDreamDiaryUpdatedAt: string | null;
  formatWorkbenchLabel: (value: string) => string;
  getDangerBadge: (status: string) => string;
  getStatusBadge: (status: string) => string;
  t: (key: string) => string;
  onDreamingDraftChange: (
    field: keyof OpenClawDreamingFormState,
    value: string | boolean,
  ) => void;
  onSaveDreamingConfig: () => Promise<void> | void;
}

export function InstanceDetailMemorySection({
  memories,
  hasMemoryEntries,
  dreamingDraft,
  dreamingError,
  isSavingDreaming,
  canEditDreamingConfig,
  latestDreamDiaryUpdatedAt,
  formatWorkbenchLabel,
  getDangerBadge,
  getStatusBadge,
  t,
  onDreamingDraftChange,
  onSaveDreamingConfig,
}: InstanceDetailMemorySectionProps) {
  return (
    <div data-slot="instance-detail-memory" className="space-y-6">
      {dreamingDraft ? (
        <div className="rounded-[1.8rem] border border-zinc-200/70 bg-white/80 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-950/35">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-primary-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-600 dark:text-primary-300">
                  {t('instances.detail.instanceWorkbench.dreaming.badge')}
                </span>
                <span className="rounded-full bg-zinc-950/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                  {formatWorkbenchLabel('managedFile')}
                </span>
              </div>
              <h3 className="mt-3 text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                {t('instances.detail.instanceWorkbench.dreaming.title')}
              </h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                {t('instances.detail.instanceWorkbench.dreaming.description')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                onClick={() => void onSaveDreamingConfig()}
                disabled={!canEditDreamingConfig || isSavingDreaming}
              >
                {isSavingDreaming ? t('common.loading') : t('common.save')}
              </Button>
            </div>
          </div>

          <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.55fr)]">
            <div className="rounded-[1.4rem] bg-zinc-950/[0.03] p-4 dark:bg-white/[0.04]">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200/70 bg-white/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                        {t('instances.detail.instanceWorkbench.dreaming.fields.enabled')}
                      </div>
                      <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                        {t('instances.detail.instanceWorkbench.dreaming.enabledDescription')}
                      </p>
                    </div>
                    <Switch
                      checked={dreamingDraft.enabled}
                      onCheckedChange={(checked) => onDreamingDraftChange('enabled', checked)}
                      disabled={!canEditDreamingConfig}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t('instances.detail.instanceWorkbench.dreaming.fields.frequency')}</Label>
                  <Input
                    value={dreamingDraft.frequency}
                    onChange={(event) => onDreamingDraftChange('frequency', event.target.value)}
                    disabled={!canEditDreamingConfig}
                    placeholder={t('instances.detail.instanceWorkbench.dreaming.placeholders.frequency')}
                  />
                </div>
              </div>

              <p className="mt-4 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                {t('instances.detail.instanceWorkbench.dreaming.note')}
              </p>

              {dreamingError ? (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                  {dreamingError}
                </div>
              ) : null}
            </div>

            <div className="rounded-[1.4rem] border border-zinc-200/70 bg-white/90 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
              <div className="grid gap-4">
                <RowMetric
                  label={t('instances.detail.instanceWorkbench.dreaming.metrics.status')}
                  value={
                    dreamingDraft.enabled
                      ? t('instances.detail.instanceWorkbench.state.enabled')
                      : t('instances.detail.instanceWorkbench.dreaming.values.disabled')
                  }
                />
                <RowMetric
                  label={t('instances.detail.instanceWorkbench.dreaming.metrics.frequency')}
                  value={
                    dreamingDraft.frequency.trim() ||
                    t('instances.detail.instanceWorkbench.dreaming.values.upstreamDefault')
                  }
                />
                <RowMetric
                  label={t('instances.detail.instanceWorkbench.dreaming.metrics.lastDreamDiary')}
                  value={latestDreamDiaryUpdatedAt || '--'}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {hasMemoryEntries ? (
        <WorkbenchRowList>
          {memories.map((entry, index) => (
            <WorkbenchRow key={entry.id} isLast={index === memories.length - 1}>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                    {t(`instances.detail.instanceWorkbench.memoryTypes.${entry.type}`)}
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${
                      entry.retention === 'expiring'
                        ? getDangerBadge('restricted')
                        : getStatusBadge('ready')
                    }`}
                  >
                    {t(`instances.detail.instanceWorkbench.retention.${entry.retention}`)}
                  </span>
                </div>
                <h3 className="mt-3 text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                  {entry.title}
                </h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  {entry.summary}
                </p>
                {isDreamDiaryMemoryEntry(entry) ? (
                  <div className="mt-4 rounded-[1.25rem] border border-zinc-200/70 bg-zinc-50/90 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                      {t('instances.detail.instanceWorkbench.dreaming.diaryReader')}
                    </div>
                    <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-6 text-zinc-700 dark:text-zinc-200">
                      {entry.content}
                    </pre>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-5">
                <RowMetric
                  label={t('instances.detail.instanceWorkbench.metrics.memorySource')}
                  value={t(`instances.detail.instanceWorkbench.memorySources.${entry.source}`)}
                />
                <RowMetric
                  label={t('instances.detail.instanceWorkbench.metrics.memoryTokens')}
                  value={entry.tokens}
                />
                <RowMetric
                  label={t('instances.detail.instanceWorkbench.metrics.updatedAt')}
                  value={entry.updatedAt}
                />
              </div>
              <div className="text-right text-sm text-zinc-500 dark:text-zinc-400">
                {t(`instances.detail.instanceWorkbench.retention.${entry.retention}`)}
              </div>
            </WorkbenchRow>
          ))}
        </WorkbenchRowList>
      ) : null}
    </div>
  );
}
