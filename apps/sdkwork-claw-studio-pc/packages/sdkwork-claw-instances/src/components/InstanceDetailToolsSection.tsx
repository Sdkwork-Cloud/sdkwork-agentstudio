import React from 'react';
import type { InstanceWorkbenchSnapshot } from '../types/index.ts';
import { RowMetric, WorkbenchRow, WorkbenchRowList } from './InstanceWorkbenchPrimitives.tsx';

export interface InstanceDetailToolsSectionProps {
  configAuthCooldownsPanel: React.ReactNode;
  configWebSearchPanel: React.ReactNode;
  configWebSearchNativeCodexPanel: React.ReactNode;
  configXSearchPanel: React.ReactNode;
  configWebFetchPanel: React.ReactNode;
  hasRuntimeTools: boolean;
  tools: InstanceWorkbenchSnapshot['tools'];
  emptyState: React.ReactNode;
  getDangerBadge: (status: string) => string;
  getStatusBadge: (status: string) => string;
  t: (key: string) => string;
}

export function InstanceDetailToolsSection({
  configAuthCooldownsPanel,
  configWebSearchPanel,
  configWebSearchNativeCodexPanel,
  configXSearchPanel,
  configWebFetchPanel,
  hasRuntimeTools,
  tools,
  emptyState,
  getDangerBadge,
  getStatusBadge,
  t,
}: InstanceDetailToolsSectionProps) {
  return (
    <div data-slot="instance-detail-tools" className="space-y-6">
      {configAuthCooldownsPanel}
      {configWebSearchPanel}
      {configWebSearchNativeCodexPanel}
      {configXSearchPanel}
      {configWebFetchPanel}

      {hasRuntimeTools ? (
        <WorkbenchRowList>
          {tools.map((tool, index) => (
            <WorkbenchRow key={tool.id} isLast={index === tools.length - 1}>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                    {tool.name}
                  </h3>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${
                      tool.status === 'restricted'
                        ? getDangerBadge(tool.status)
                        : getStatusBadge(tool.status)
                    }`}
                  >
                    {t(`instances.detail.instanceWorkbench.toolStatus.${tool.status}`)}
                  </span>
                </div>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  {tool.description}
                </p>
                <div className="mt-3 rounded-2xl bg-zinc-950/[0.04] px-4 py-3 text-sm font-mono text-zinc-600 dark:bg-white/[0.05] dark:text-zinc-300">
                  {tool.command}
                </div>
              </div>
              <div className="flex flex-wrap gap-5">
                <RowMetric
                  label={t('instances.detail.instanceWorkbench.sections.tools.title')}
                  value={t(`instances.detail.instanceWorkbench.toolCategories.${tool.category}`)}
                />
                <RowMetric
                  label={t('instances.detail.instanceWorkbench.sidebar.agents')}
                  value={tool.agentNames?.join(', ') || tool.agentIds?.join(', ') || '--'}
                />
                <RowMetric
                  label={t('instances.detail.instanceWorkbench.metrics.actionType')}
                  value={t(`instances.detail.instanceWorkbench.toolAccess.${tool.access}`)}
                />
                <RowMetric
                  label={t('instances.detail.instanceWorkbench.metrics.lastRun')}
                  value={tool.lastUsedAt || '--'}
                />
              </div>
              <div className="text-right text-sm text-zinc-500 dark:text-zinc-400">
                {tool.lastUsedAt || '--'}
              </div>
            </WorkbenchRow>
          ))}
        </WorkbenchRowList>
      ) : (
        emptyState
      )}
    </div>
  );
}
