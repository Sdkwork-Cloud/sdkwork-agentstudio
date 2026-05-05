import * as React from 'react';
import { cn } from '../lib/utils.ts';

export interface TaskStudioTabItem {
  id: string;
  label: React.ReactNode;
  count?: React.ReactNode;
}

export interface TaskStudioTabsProps {
  activeTab: string;
  tabs: TaskStudioTabItem[];
  onChange: (tabId: string) => void;
  className?: string;
}

export function TaskStudioTabs({
  activeTab,
  tabs,
  onChange,
  className,
}: TaskStudioTabsProps) {
  const railClassName =
    'inline-flex w-fit max-w-full flex-wrap items-center gap-1 rounded-[0.875rem] border border-zinc-200/80 bg-white/80 p-1 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/40';
  const triggerClassName =
    'inline-flex h-9 min-w-[9rem] shrink-0 items-center justify-between gap-2 rounded-[0.75rem] border border-transparent px-3 text-left text-[13px] font-semibold transition-colors';
  const countClassName = 'rounded-full px-1.5 py-0.5 text-[11px] font-semibold';

  return (
    React.createElement(
      'div',
        {
          'data-slot': 'task-studio-tabs',
          role: 'tablist',
          className: cn(
            railClassName,
            className,
          ),
        },
      tabs.map((tab) => {
        const isActive = tab.id === activeTab;

        return React.createElement(
          'button',
          {
            key: tab.id,
            type: 'button',
            role: 'tab',
            'aria-selected': isActive,
            onClick: () => onChange(tab.id),
            className: cn(
              triggerClassName,
              isActive
                ? 'border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-500/30 dark:bg-primary-500/10 dark:text-primary-300'
                : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900',
            ),
          },
          React.createElement('span', null, tab.label),
          tab.count !== undefined
            ? React.createElement(
                'span',
                {
                  className: cn(
                    countClassName,
                    isActive
                      ? 'bg-primary-100 text-primary-700 dark:bg-primary-500/15 dark:text-primary-200'
                      : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300',
                  ),
                },
                tab.count,
              )
            : null,
        );
      }),
    )
  );
}
