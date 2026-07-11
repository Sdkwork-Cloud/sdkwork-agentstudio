import * as React from 'react';
import { Loader2, X } from 'lucide-react';
import { OverlaySurface } from './OverlaySurface';
import { TaskRowBadge } from './TaskRowList';
import { getTaskHistoryBadgeTone } from './taskCatalogMeta';

export interface TaskExecutionHistoryEntry {
  id: string;
  status: string;
  trigger: string;
  summary: React.ReactNode;
  details?: React.ReactNode;
  startedAt: React.ReactNode;
  finishedAt?: React.ReactNode;
}

export interface TaskExecutionHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  taskName?: React.ReactNode | null;
  entries: TaskExecutionHistoryEntry[];
  isLoading?: boolean;
  title: React.ReactNode;
  getSubtitle: (taskName: React.ReactNode) => React.ReactNode;
  description: React.ReactNode;
  loadingText: React.ReactNode;
  emptyTitle: React.ReactNode;
  emptyDescription: React.ReactNode;
  startedAtLabel: React.ReactNode;
  finishedAtLabel: React.ReactNode;
  getStatusLabel: (status: string) => React.ReactNode;
  getTriggerLabel: (trigger: string) => React.ReactNode;
}

export function TaskExecutionHistoryDrawer({
  isOpen,
  onClose,
  taskName,
  entries,
  isLoading = false,
  title,
  getSubtitle,
  description,
  loadingText,
  emptyTitle,
  emptyDescription,
  startedAtLabel,
  finishedAtLabel,
  getStatusLabel,
  getTriggerLabel,
}: TaskExecutionHistoryDrawerProps) {
  return (
    <OverlaySurface
      isOpen={isOpen}
      onClose={onClose}
      variant="drawer"
      className="max-w-[560px]"
    >
      {taskName ? (
        <>
          <div className="flex items-start justify-between gap-4 border-b border-zinc-200/80 bg-zinc-50/80 px-6 py-5 dark:border-zinc-800 dark:bg-zinc-950/70">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                {title}
              </div>
              <h2 className="mt-2 text-xl font-bold text-zinc-950 dark:text-zinc-50">
                {getSubtitle(taskName)}
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                {description}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{loadingText}</p>
              </div>
            ) : entries.length === 0 ? (
              <div className="rounded-[20px] border border-dashed border-zinc-200 bg-zinc-50 px-6 py-10 text-center dark:border-zinc-800 dark:bg-zinc-950">
                <h3 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                  {emptyTitle}
                </h3>
                <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  {emptyDescription}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {entries.map((entry) => (
                  <article
                    key={entry.id}
                    className="rounded-[18px] border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="flex flex-wrap gap-2">
                      <TaskRowBadge tone={getTaskHistoryBadgeTone(entry.status)}>
                        <span className="h-2 w-2 rounded-full bg-current" />
                        {getStatusLabel(entry.status)}
                      </TaskRowBadge>
                      <TaskRowBadge tone="neutral">
                        {getTriggerLabel(entry.trigger)}
                      </TaskRowBadge>
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-zinc-950 dark:text-zinc-50">
                      {entry.summary}
                    </h3>
                    {entry.details ? (
                      <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                        {entry.details}
                      </p>
                    ) : null}
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                          {startedAtLabel}
                        </div>
                        <div className="mt-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                          {entry.startedAt}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                          {finishedAtLabel}
                        </div>
                        <div className="mt-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                          {entry.finishedAt || '-'}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </OverlaySurface>
  );
}
