import React from 'react';
import { FileCode2 } from 'lucide-react';
import type { InstanceConfigWorkbenchSectionCategoryId } from '../services/index.ts';

type Translate = (
  key: string,
  en: string,
  zh: string,
  options?: Record<string, unknown>,
) => string;

export interface InstanceConfigWorkbenchOverviewCategoryCard {
  id: InstanceConfigWorkbenchSectionCategoryId;
  label: string;
  sectionCount: number;
  firstSectionKey: string | null;
  firstSectionLabel: string | null;
  firstSectionDescription: string | null;
  sectionLabels: string[];
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}

export interface InstanceConfigWorkbenchOverviewMetricCard {
  id: string;
  label: string;
  value: string;
}

interface InstanceConfigWorkbenchOverviewProps {
  tr: Translate;
  invalidDraftVisible: boolean;
  unsupportedSchemaPathCount: number;
  categories: InstanceConfigWorkbenchOverviewCategoryCard[];
  metrics: InstanceConfigWorkbenchOverviewMetricCard[];
  onSelectSection: (key: string | null) => void;
}

function SummaryItem(props: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200/70 bg-zinc-50/70 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
        {props.label}
      </div>
      <div className="mt-1 text-sm text-zinc-700 dark:text-zinc-200">{props.value}</div>
    </div>
  );
}

export function InstanceConfigWorkbenchOverview(
  props: InstanceConfigWorkbenchOverviewProps,
) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(19rem,1fr)]">
      <div className="space-y-4 rounded-[1.8rem] border border-zinc-200/70 bg-white/85 p-5 dark:border-zinc-800 dark:bg-zinc-950/35">
        <div className="flex items-start gap-4">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
            <FileCode2 className="h-5 w-5" />
          </span>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
              {props.tr(
                'instances.detail.instanceWorkbench.config.workbench.overview.eyebrow',
                'Settings',
                'Settings',
              )}
            </div>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {props.tr(
                'instances.detail.instanceWorkbench.config.workbench.overview.title',
                'OpenClaw config overview',
                'OpenClaw config overview',
              )}
            </h3>
            <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              {props.tr(
                'instances.detail.instanceWorkbench.config.workbench.overview.description',
                'Review section groups and jump into a specific area before editing.',
                'Review section groups and jump into a specific area before editing.',
              )}
            </p>
          </div>
        </div>

        {props.invalidDraftVisible ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
            {props.tr(
              'instances.detail.instanceWorkbench.config.workbench.overview.invalidDraft',
              'Structured editing is paused until Raw fixes the invalid JSON5 draft.',
              'Structured editing is paused until Raw fixes the invalid JSON5 draft.',
            )}
          </div>
        ) : null}

        {!props.invalidDraftVisible && props.unsupportedSchemaPathCount > 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
            {props.tr(
              'instances.detail.instanceWorkbench.config.workbench.overview.rawOnlyPaths',
              '{{count}} schema paths remain raw-only, so some advanced settings are safer to edit in Raw mode.',
              '{{count}} schema paths remain raw-only, so some advanced settings are safer to edit in Raw mode.',
              { count: props.unsupportedSchemaPathCount },
            )}
          </div>
        ) : null}

        {props.categories.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {props.categories.map((category) => (
              <button
                key={category.id}
                type="button"
                disabled={!category.firstSectionKey}
                onClick={() => props.onSelectSection(category.firstSectionKey)}
                className="rounded-[1.4rem] border border-zinc-200/70 bg-zinc-50/75 p-4 text-left transition hover:border-zinc-300 hover:bg-white disabled:cursor-default disabled:opacity-70 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${category.tone}`}
                  >
                    {React.createElement(category.icon, { className: 'h-4 w-4' })}
                  </span>
                  <span className="rounded-full bg-zinc-950/[0.04] px-3 py-1 text-xs font-medium text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                    {category.sectionCount}
                  </span>
                </div>
                <div className="mt-4 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                  {category.label}
                </div>
                <div className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  {category.firstSectionLabel
                    ? props.tr(
                        'instances.detail.instanceWorkbench.config.workbench.overview.startWithSection',
                        'Start with {{section}} to edit this group.',
                        'Start with {{section}} to edit this group.',
                        {
                          section: category.firstSectionLabel,
                        },
                      )
                    : props.tr(
                        'instances.detail.instanceWorkbench.config.workbench.overview.jumpIntoSection',
                        'Jump into a section',
                        'Jump into a section',
                      )}
                </div>
                {category.firstSectionDescription ? (
                  <div className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                    {category.firstSectionDescription}
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {category.sectionLabels.map((label) => (
                    <span
                      key={label}
                      className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-zinc-200/80 px-4 py-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            {props.tr(
              'instances.detail.instanceWorkbench.config.workbench.overview.empty',
              'No config groups are available yet.',
              'No config groups are available yet.',
            )}
          </div>
        )}
      </div>

      <div className="space-y-3 rounded-[1.6rem] border border-zinc-200/70 bg-white/85 p-5 dark:border-zinc-800 dark:bg-zinc-950/35">
        {props.metrics.map((metric) => (
          <SummaryItem key={metric.id} label={metric.label} value={metric.value} />
        ))}
      </div>
    </div>
  );
}
