import * as React from 'react';
import { Loader2 } from 'lucide-react';

type TaskRowBadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const badgeToneClassNames: Record<TaskRowBadgeTone, string> = {
  neutral:
    'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300',
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300',
  warning:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300',
  danger:
    'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300',
  info:
    'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300',
};

export interface TaskExecutionFeedPanelEntry {
  id: string;
  taskName: React.ReactNode;
  status: React.ReactNode;
  trigger: React.ReactNode;
  taskStatus: React.ReactNode;
  summary: React.ReactNode;
  details?: React.ReactNode;
  schedule: React.ReactNode;
  runId: React.ReactNode;
  startedAt: React.ReactNode;
  finishedAt?: React.ReactNode;
  statusTone?: TaskRowBadgeTone;
  triggerTone?: TaskRowBadgeTone;
  taskStatusTone?: TaskRowBadgeTone;
  action?: React.ReactNode;
}

export interface TaskExecutionFeedPanelProps {
  title: React.ReactNode;
  description: React.ReactNode;
  loading?: boolean;
  loadingText: React.ReactNode;
  emptyTitle: React.ReactNode;
  emptyDescription: React.ReactNode;
  taskNameLabel: React.ReactNode;
  scheduleLabel: React.ReactNode;
  runIdLabel: React.ReactNode;
  startedAtLabel: React.ReactNode;
  finishedAtLabel: React.ReactNode;
  entries: TaskExecutionFeedPanelEntry[];
}

export function TaskExecutionFeedPanel({
  title,
  description,
  loading = false,
  loadingText,
  emptyTitle,
  emptyDescription,
  taskNameLabel,
  scheduleLabel,
  runIdLabel,
  startedAtLabel,
  finishedAtLabel,
  entries,
}: TaskExecutionFeedPanelProps) {
  return React.createElement(
    'section',
    {
      'data-slot': 'task-execution-feed-panel',
      className:
        'w-full rounded-[20px] border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:p-6',
    },
    React.createElement(
      'div',
      { className: 'flex flex-col gap-2' },
      React.createElement(
        'h2',
        { className: 'text-xl font-bold text-zinc-950 dark:text-zinc-50' },
        title,
      ),
      React.createElement(
        'p',
        { className: 'text-sm leading-6 text-zinc-500 dark:text-zinc-400' },
        description,
      ),
    ),
    loading
      ? React.createElement(
          'div',
          { className: 'flex flex-col items-center justify-center gap-4 py-16 text-center' },
          React.createElement(Loader2, { className: 'h-8 w-8 animate-spin text-primary-500' }),
          React.createElement(
            'p',
            { className: 'text-sm text-zinc-500 dark:text-zinc-400' },
            loadingText,
          ),
        )
      : entries.length === 0
        ? React.createElement(
            'div',
            {
              className:
                'mt-5 rounded-[20px] border border-dashed border-zinc-300 bg-zinc-50/80 px-6 py-10 text-center dark:border-zinc-700 dark:bg-zinc-950/50',
            },
            React.createElement(
              'h3',
              { className: 'text-lg font-semibold text-zinc-950 dark:text-zinc-50' },
              emptyTitle,
            ),
            React.createElement(
              'p',
              { className: 'mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400' },
              emptyDescription,
            ),
          )
        : React.createElement(
            'div',
            { className: 'mt-5 space-y-4' },
            entries.map((entry) =>
              React.createElement(
                'article',
                {
                  key: entry.id,
                  className:
                    'rounded-[18px] border border-zinc-200/80 bg-zinc-50/70 p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50',
                },
                React.createElement(
                  'div',
                  {
                    className:
                      'flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between',
                  },
                  React.createElement(
                    'div',
                    { className: 'min-w-0' },
                    React.createElement(
                      'div',
                      { className: 'flex flex-wrap items-center gap-2' },
                      React.createElement(
                        'div',
                        {
                          className:
                            'text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400',
                        },
                        runIdLabel,
                      ),
                      React.createElement(
                        'div',
                        {
                          'data-slot': 'task-execution-feed-run-id',
                          className: 'text-base font-semibold text-zinc-950 dark:text-zinc-50',
                        },
                        entry.runId,
                      ),
                    ),
                    React.createElement(
                      'div',
                      {
                        className:
                          'mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400',
                      },
                      React.createElement(
                        'span',
                        { className: 'font-medium text-zinc-500 dark:text-zinc-500' },
                        taskNameLabel,
                      ),
                      React.createElement(
                        'span',
                        {
                          'data-slot': 'task-execution-feed-task-name',
                          className: 'font-medium text-zinc-700 dark:text-zinc-300',
                        },
                        entry.taskName,
                      ),
                    ),
                  ),
                  React.createElement(
                    'div',
                    { className: 'flex flex-wrap items-center gap-2' },
                    React.createElement(
                      TaskExecutionBadge,
                      { tone: entry.statusTone ?? 'success' },
                      entry.status,
                    ),
                    React.createElement(
                      TaskExecutionBadge,
                      { tone: entry.triggerTone ?? 'neutral' },
                      entry.trigger,
                    ),
                    React.createElement(
                      TaskExecutionBadge,
                      { tone: entry.taskStatusTone ?? 'neutral' },
                      entry.taskStatus,
                    ),
                  ),
                ),
                React.createElement(
                  'div',
                  { className: 'mt-3 text-sm font-semibold text-zinc-950 dark:text-zinc-50' },
                  entry.summary,
                ),
                entry.details
                  ? React.createElement(
                      'p',
                      { className: 'mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400' },
                      entry.details,
                    )
                  : null,
                React.createElement(
                  'div',
                  {
                    'data-slot': 'task-execution-feed-meta-strip',
                    className:
                      'mt-4 flex flex-wrap gap-2.5 border-t border-zinc-200/80 pt-4 text-sm dark:border-zinc-800',
                  },
                  React.createElement(MetaItem, {
                    label: scheduleLabel,
                    value: entry.schedule,
                  }),
                  React.createElement(MetaItem, {
                    label: startedAtLabel,
                    value: entry.startedAt,
                  }),
                  React.createElement(MetaItem, {
                    label: finishedAtLabel,
                    value: entry.finishedAt || '-',
                  }),
                ),
                entry.action
                  ? React.createElement(
                      'div',
                      {
                        className:
                          'mt-4 flex justify-end border-t border-zinc-200/80 pt-4 dark:border-zinc-800',
                      },
                      entry.action,
                    )
                  : null,
              ),
            ),
          ),
  );
}

interface MetaItemProps {
  label: React.ReactNode;
  value: React.ReactNode;
}

interface TaskExecutionBadgeProps {
  tone?: TaskRowBadgeTone;
  children?: React.ReactNode;
}

function TaskExecutionBadge({
  tone = 'neutral',
  children,
}: TaskExecutionBadgeProps) {
  return React.createElement(
    'span',
    {
      'data-slot': 'task-execution-feed-badge',
      className: `inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${badgeToneClassNames[tone]}`,
    },
    children,
  );
}

function MetaItem({ label, value }: MetaItemProps) {
  return React.createElement(
    'div',
    {
      'data-slot': 'task-execution-feed-meta-item',
      className:
        'inline-flex min-w-[12rem] flex-1 items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900',
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
