import * as React from 'react';

export interface TaskInspectorSummaryField {
  label: React.ReactNode;
  value: React.ReactNode;
}

export interface TaskInspectorSummaryPanelProps {
  identity: React.ReactNode;
  badges?: React.ReactNode[];
  summary: React.ReactNode;
  secondarySummary?: React.ReactNode;
  overviewItems?: TaskInspectorSummaryField[];
  timelineItems?: TaskInspectorSummaryField[];
  error?: React.ReactNode;
  advancedLabel?: React.ReactNode;
  advancedItems?: TaskInspectorSummaryField[];
}

export function TaskInspectorSummaryPanel({
  identity,
  badges = [],
  summary,
  secondarySummary,
  overviewItems = [],
  timelineItems = [],
  error,
  advancedLabel,
  advancedItems = [],
}: TaskInspectorSummaryPanelProps) {
  return React.createElement(
    'div',
    {
      'data-slot': 'task-inspector-summary-panel',
      className:
        'rounded-[20px] border border-zinc-200/80 bg-white/90 p-5 dark:border-zinc-800 dark:bg-zinc-900/90',
    },
    React.createElement(
      'div',
      { className: 'flex flex-wrap items-center gap-2' },
      React.createElement(
        'span',
        { className: 'text-sm font-semibold text-zinc-950 dark:text-zinc-50' },
        identity,
      ),
      badges.length
        ? React.createElement(
            'div',
            { className: 'flex flex-wrap items-center gap-2' },
            badges,
          )
        : null,
    ),
    React.createElement(
      'div',
      { className: 'mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300' },
      summary,
    ),
    secondarySummary
      ? React.createElement(
          'div',
          { className: 'mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400' },
          secondarySummary,
        )
      : null,
    overviewItems.length
      ? React.createElement(
          'div',
          {
            'data-slot': 'task-inspector-overview',
            className: 'mt-4 flex flex-wrap gap-2.5',
          },
          overviewItems.map((item, index) =>
            React.createElement(InspectorFieldChip, {
              key: `overview-${index}`,
              label: item.label,
              value: item.value,
            }),
          ),
        )
      : null,
    timelineItems.length
      ? React.createElement(
          'div',
          {
            'data-slot': 'task-inspector-timeline',
            className:
              'mt-4 rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/70',
          },
          React.createElement(
            'div',
            { className: 'flex flex-wrap gap-2.5' },
            timelineItems.map((item, index) =>
              React.createElement(InspectorFieldChip, {
                key: `timeline-${index}`,
                label: item.label,
                value: item.value,
                subdued: true,
              }),
            ),
          ),
        )
      : null,
    error
      ? React.createElement(
          'div',
          {
            'data-slot': 'task-inspector-error',
            className:
              'mt-4 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm leading-6 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100',
          },
          error,
        )
      : null,
    advancedItems.length
      ? React.createElement(
          'details',
          {
            'data-slot': 'task-inspector-advanced',
            className:
              'mt-4 rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/60',
          },
          React.createElement(
            'summary',
            {
              className:
                'cursor-pointer list-none text-sm font-semibold text-zinc-950 marker:content-none dark:text-zinc-50',
            },
            advancedLabel || 'Details',
          ),
          React.createElement(
            'div',
            { className: 'mt-3 grid gap-3 text-sm text-zinc-600 dark:text-zinc-300 md:grid-cols-2' },
            advancedItems.map((item, index) =>
              React.createElement(
                'div',
                {
                  key: `advanced-${index}`,
                  className: 'min-w-0',
                },
                React.createElement(
                  'span',
                  { className: 'font-semibold text-zinc-950 dark:text-zinc-50' },
                  item.label,
                ),
                ': ',
                item.value,
              ),
            ),
          ),
        )
      : null,
  );
}

interface InspectorFieldChipProps extends TaskInspectorSummaryField {
  subdued?: boolean;
}

function InspectorFieldChip({
  label,
  value,
  subdued = false,
}: InspectorFieldChipProps) {
  return React.createElement(
    'div',
    {
      className: subdued
        ? 'inline-flex min-w-[12rem] flex-1 items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900'
        : 'inline-flex min-w-[11rem] flex-1 items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950',
    },
    React.createElement(
      'span',
      {
        className:
          'text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400',
      },
      label,
    ),
    React.createElement(
      'span',
      { className: 'min-w-0 truncate text-sm font-semibold text-zinc-950 dark:text-zinc-50' },
      value,
    ),
  );
}
