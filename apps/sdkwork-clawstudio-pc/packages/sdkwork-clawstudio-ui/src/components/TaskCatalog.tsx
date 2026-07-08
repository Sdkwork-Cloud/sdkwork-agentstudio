import * as React from 'react';
import { cn } from '../lib/utils';
import {
  TaskRow,
  TaskRowActionGroup,
  TaskRowBadge,
  TaskRowList,
  TaskRowMeta,
  type TaskRowBadgeTone,
  type TaskRowTone,
} from './TaskRowList';

export interface TaskCatalogBadge {
  id?: string;
  label: React.ReactNode;
  tone?: TaskRowBadgeTone;
  icon?: React.ReactNode;
}

export interface TaskCatalogMetric {
  id?: string;
  label: React.ReactNode;
  value: React.ReactNode;
}

export interface TaskCatalogItem {
  id: string;
  name: React.ReactNode;
  tone?: TaskRowTone;
  badges?: TaskCatalogBadge[];
  description?: React.ReactNode;
  metrics?: TaskCatalogMetric[];
  summaryTitle?: React.ReactNode;
  summaryBadges?: TaskCatalogBadge[];
  summaryContent?: React.ReactNode;
  summaryDetails?: React.ReactNode;
  summaryFooter?: React.ReactNode;
  actions?: React.ReactNode;
}

export interface TaskCatalogProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  items: TaskCatalogItem[];
  emptyState?: React.ReactNode;
}

function renderBadge(badge: TaskCatalogBadge, index: number) {
  return (
    <TaskRowBadge key={badge.id ?? index} tone={badge.tone}>
      {badge.icon}
      {badge.label}
    </TaskRowBadge>
  );
}

function renderSummary(item: TaskCatalogItem) {
  if (
    !item.summaryTitle &&
    !item.summaryBadges?.length &&
    !item.summaryContent &&
    !item.summaryDetails &&
    !item.summaryFooter
  ) {
    return null;
  }

  return (
    <div data-slot="task-catalog-summary">
      {item.summaryTitle ? (
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
          {item.summaryTitle}
        </div>
      ) : null}
      {item.summaryBadges?.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.summaryBadges.map(renderBadge)}
        </div>
      ) : null}
      {item.summaryContent ? (
        <div className="mt-3 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
          {item.summaryContent}
        </div>
      ) : null}
      {item.summaryDetails ? (
        <div className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
          {item.summaryDetails}
        </div>
      ) : null}
      {item.summaryFooter ? (
        <div className="mt-4 border-t border-zinc-200/80 pt-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          {item.summaryFooter}
        </div>
      ) : null}
    </div>
  );
}

export function TaskCatalog({
  items,
  emptyState = null,
  className,
  ...props
}: TaskCatalogProps) {
  if (items.length === 0) {
    return <>{emptyState}</>;
  }

  return (
    <TaskRowList
      data-slot="task-catalog"
      className={cn(className)}
      {...props}
    >
      {items.map((item, index) => (
        <TaskRow
          key={item.id}
          isLast={index === items.length - 1}
          tone={item.tone}
          title={item.name}
          badges={
            item.badges?.length ? (
              <>{item.badges.map(renderBadge)}</>
            ) : undefined
          }
          description={item.description}
          meta={
            item.metrics?.length ? (
              <>
                {item.metrics.map((metric, metricIndex) => (
                  <TaskRowMeta
                    key={metric.id ?? metricIndex}
                    label={metric.label}
                    value={metric.value}
                  />
                ))}
              </>
            ) : undefined
          }
          summary={renderSummary(item)}
          actions={
            item.actions ? (
              <TaskRowActionGroup>{item.actions}</TaskRowActionGroup>
            ) : undefined
          }
        />
      ))}
    </TaskRowList>
  );
}
