import * as React from 'react';
import { cn } from '../lib/utils';

export type TaskRowTone = 'default' | 'healthy' | 'paused' | 'danger';
export type TaskRowBadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const rowToneClassNames: Record<TaskRowTone, string> = {
  default: '',
  healthy: 'bg-emerald-50/[0.35] dark:bg-emerald-500/[0.05]',
  paused: 'bg-amber-50/[0.4] dark:bg-amber-500/[0.06]',
  danger: 'bg-rose-50/[0.45] dark:bg-rose-500/[0.06]',
};

const badgeToneClassNames: Record<TaskRowBadgeTone, string> = {
  neutral:
    'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300',
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300',
  warning:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300',
  danger:
    'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300',
  info: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300',
};

export interface TaskRowListProps extends React.HTMLAttributes<HTMLDivElement> {}

export function TaskRowList({ className, children, ...props }: TaskRowListProps) {
  return (
    <div
      data-slot="task-row-list"
      className={cn(
        'overflow-hidden rounded-[20px] border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface TaskRowProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: React.ReactNode;
  badges?: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  summary?: React.ReactNode;
  actions?: React.ReactNode;
  isLast?: boolean;
  tone?: TaskRowTone;
}

export function TaskRow({
  title,
  badges,
  description,
  meta,
  summary,
  actions,
  isLast = false,
  tone = 'default',
  className,
  ...props
}: TaskRowProps) {
  return (
    <div
      data-slot="task-row"
      className={cn(
        'px-5 py-5 transition-colors sm:px-6',
        !isLast && 'border-b border-zinc-200/80 dark:border-zinc-800',
        rowToneClassNames[tone],
        className,
      )}
      {...props}
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1.1fr)_minmax(15rem,0.95fr)] xl:items-start">
        <div data-slot="task-row-main" className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="min-w-0 text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {title}
            </div>
            {badges ? (
              <div data-slot="task-row-badges" className="flex flex-wrap items-center gap-2">
                {badges}
              </div>
            ) : null}
          </div>
          {description ? (
            <div className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              {description}
            </div>
          ) : null}
        </div>

        <div
          data-slot="task-row-meta-group"
          className={cn('flex flex-wrap gap-4', !meta && 'hidden xl:block')}
        >
          {meta}
        </div>

        {summary ? (
          <div
            data-slot="task-row-summary"
            className="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
          >
            {summary}
          </div>
        ) : null}
      </div>

      {actions ? (
        <div
          data-slot="task-row-actions-wrap"
          className="mt-5 border-t border-zinc-200/80 pt-4 dark:border-zinc-800"
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export interface TaskRowMetaProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  value: React.ReactNode;
}

export function TaskRowMeta({ label, value, className, ...props }: TaskRowMetaProps) {
  return (
    <div data-slot="task-row-meta" className={cn('min-w-[7rem]', className)} {...props}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-zinc-950 dark:text-zinc-50">{value}</div>
    </div>
  );
}

export interface TaskRowBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: TaskRowBadgeTone;
}

export function TaskRowBadge({
  tone = 'neutral',
  className,
  children,
  ...props
}: TaskRowBadgeProps) {
  return (
    <span
      data-slot="task-row-badge"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold',
        badgeToneClassNames[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export interface TaskRowActionGroupProps extends React.HTMLAttributes<HTMLDivElement> {}

export function TaskRowActionGroup({
  className,
  children,
  ...props
}: TaskRowActionGroupProps) {
  return (
    <div
      data-slot="task-row-actions"
      className={cn('flex flex-wrap gap-2', className)}
      {...props}
    >
      {children}
    </div>
  );
}
