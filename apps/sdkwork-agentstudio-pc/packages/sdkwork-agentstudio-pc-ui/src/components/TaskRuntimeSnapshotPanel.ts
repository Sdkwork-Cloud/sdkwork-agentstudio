import * as React from 'react';

export type TaskRuntimeSnapshotMessageTone = 'neutral' | 'warning';

const messageToneClassNames: Record<TaskRuntimeSnapshotMessageTone, string> = {
  neutral:
    'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400',
  warning:
    'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100',
};

export interface TaskRuntimeSnapshotItem {
  id: string;
  title: React.ReactNode;
  badges?: React.ReactNode[];
  summary: React.ReactNode;
  meta?: React.ReactNode;
  action?: React.ReactNode;
}

export interface TaskRuntimeSnapshotBoard {
  id: string;
  title: React.ReactNode;
  count?: React.ReactNode;
  items: TaskRuntimeSnapshotItem[];
  message?: React.ReactNode;
  messageTone?: TaskRuntimeSnapshotMessageTone;
}

export interface TaskRuntimeSnapshotPanelProps {
  boards: TaskRuntimeSnapshotBoard[];
  previewLimit?: number;
}

export function TaskRuntimeSnapshotPanel({
  boards,
  previewLimit = 3,
}: TaskRuntimeSnapshotPanelProps) {
  return React.createElement(
    'section',
    {
      'data-slot': 'task-runtime-snapshot-panel',
      className:
        'w-full rounded-[20px] border border-zinc-200/70 bg-zinc-50/60 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/30 md:p-5',
    },
    React.createElement(
      'div',
      { className: 'grid gap-4 xl:grid-cols-2' },
      boards.map((board) => {
        const visibleItems = board.items.slice(0, previewLimit);
        const count = board.count ?? board.items.length;

        return React.createElement(
          'div',
          {
            key: board.id,
            'data-slot': 'task-runtime-snapshot-board',
            className:
              'rounded-[18px] border border-zinc-200/80 bg-white/90 p-4 dark:border-zinc-800 dark:bg-zinc-900/90',
          },
          React.createElement(
            'div',
            { className: 'flex items-center justify-between gap-3' },
            React.createElement(
              'h3',
              { className: 'text-sm font-semibold text-zinc-950 dark:text-zinc-50' },
              board.title,
            ),
            React.createElement(
              'span',
              {
                'data-slot': 'task-runtime-snapshot-count',
                className:
                  'inline-flex min-w-7 items-center justify-center rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200',
              },
              count,
            ),
          ),
          visibleItems.length === 0
            ? React.createElement(
                'div',
                {
                  'data-slot': 'task-runtime-snapshot-message',
                  className: `mt-3 rounded-2xl border px-4 py-3 text-sm leading-6 ${messageToneClassNames[board.messageTone ?? 'neutral']}`,
                },
                board.message ?? '-',
              )
            : React.createElement(
                'div',
                { className: 'mt-3 space-y-3' },
                visibleItems.map((item) =>
                  React.createElement(
                    'article',
                    {
                      key: item.id,
                      'data-slot': 'task-runtime-snapshot-item',
                      className:
                        'rounded-2xl border border-zinc-200/80 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/80',
                    },
                    React.createElement(
                      'div',
                      {
                        className:
                          'flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between',
                      },
                      React.createElement(
                        'div',
                        { className: 'min-w-0' },
                        React.createElement(
                          'div',
                          { className: 'text-sm font-semibold text-zinc-950 dark:text-zinc-50' },
                          item.title,
                        ),
                        item.badges?.length
                          ? React.createElement(
                              'div',
                              { className: 'mt-2 flex flex-wrap items-center gap-2' },
                              item.badges,
                            )
                          : null,
                      ),
                      item.action
                        ? React.createElement(
                            'div',
                            { className: 'shrink-0' },
                            item.action,
                          )
                        : null,
                    ),
                    React.createElement(
                      'div',
                      {
                        className:
                          'mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300',
                      },
                      item.summary,
                    ),
                    item.meta
                      ? React.createElement(
                          'div',
                          {
                            className:
                              'mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400',
                          },
                          item.meta,
                        )
                      : null,
                  ),
                ),
              ),
        );
      }),
    ),
  );
}
