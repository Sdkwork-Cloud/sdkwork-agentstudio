import React from 'react';
import { MemoryStick, Settings, type LucideIcon } from 'lucide-react';
import type { Instance, InstanceWorkbenchSectionId, InstanceWorkbenchSnapshot } from '../types';
import {
  buildInstanceWorkbenchResourceMetrics,
  buildInstanceWorkbenchSummaryMetrics,
  workbenchSections,
} from './instanceDetailWorkbenchPresentation';
import { SectionHeading } from './InstanceWorkbenchPrimitives';

interface InstanceDetailWorkbenchChromeProps {
  activeSection: InstanceWorkbenchSectionId;
  instance: Pick<Instance, 'cpu' | 'memory' | 'totalMemory'>;
  workbench: Pick<
    InstanceWorkbenchSnapshot,
    | 'healthScore'
    | 'connectedChannelCount'
    | 'activeTaskCount'
    | 'readyToolCount'
    | 'agents'
    | 'installedSkillCount'
    | 'sectionCounts'
  >;
  t: (key: string) => string;
  onSectionSelect: (sectionId: InstanceWorkbenchSectionId) => void;
  children: React.ReactNode;
}

const resourceMetricIcons: Record<'cpuLoad' | 'memoryPressure', LucideIcon> = {
  cpuLoad: Settings,
  memoryPressure: MemoryStick,
};

export function InstanceDetailWorkbenchChrome({
  activeSection,
  instance,
  workbench,
  t,
  onSectionSelect,
  children,
}: InstanceDetailWorkbenchChromeProps) {
  const activeSectionMeta =
    workbenchSections.find((section) => section.id === activeSection) || null;
  const summaryMetrics = buildInstanceWorkbenchSummaryMetrics(workbench);
  const resourceMetrics = buildInstanceWorkbenchResourceMetrics(instance);

  return (
    <>
      <div
        data-slot="instance-workbench-summary-metrics"
        className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-6"
      >
        {summaryMetrics.map((metric) => (
          <div
            key={metric.id}
            className="rounded-[1.5rem] bg-zinc-950/[0.03] p-4 dark:bg-white/[0.04]"
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
              {t(metric.labelKey)}
            </div>
            <div className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {metric.value}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div
            data-slot="instance-workbench-sidebar"
            className="flex gap-2 overflow-x-auto xl:flex-col"
          >
            {workbenchSections.map((section) => {
              const Icon = section.icon;
              const isActive = section.id === activeSection;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => onSectionSelect(section.id)}
                  className={`min-w-[14rem] rounded-[1.4rem] px-4 py-4 text-left transition-colors xl:min-w-0 ${
                    isActive
                      ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                      : 'bg-zinc-950/[0.03] text-zinc-700 hover:bg-zinc-950/[0.06] dark:bg-white/[0.04] dark:text-zinc-200 dark:hover:bg-white/[0.08]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                          isActive
                            ? 'bg-white/12 text-white dark:bg-zinc-950/10 dark:text-zinc-950'
                            : 'bg-white/70 text-zinc-700 dark:bg-zinc-950/50 dark:text-zinc-200'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{t(section.labelKey)}</div>
                        <div
                          className={`mt-1 text-xs leading-5 ${
                            isActive
                              ? 'text-white/75 dark:text-zinc-700'
                              : 'text-zinc-500 dark:text-zinc-400'
                          }`}
                        >
                          {t(section.descriptionKey)}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        isActive
                          ? 'bg-white/12 text-white dark:bg-zinc-950/10 dark:text-zinc-950'
                          : 'bg-white/70 text-zinc-700 dark:bg-zinc-950/50 dark:text-zinc-200'
                      }`}
                    >
                      {workbench.sectionCounts[section.id]}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div
            data-slot="instance-workbench-resource-metrics"
            className="grid grid-cols-2 gap-3 xl:grid-cols-1"
          >
            {resourceMetrics.map((metric) => {
              const Icon = resourceMetricIcons[metric.id];
              return (
                <div
                  key={metric.id}
                  className="rounded-[1.4rem] bg-zinc-950/[0.03] p-4 dark:bg-white/[0.04]"
                >
                  <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                    <Icon className="h-4 w-4" />
                    {t(metric.labelKey)}
                  </div>
                  <div className="mt-3 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
                    {metric.value}
                  </div>
                  {metric.detail ? (
                    <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {metric.detail}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </aside>

        <section className="rounded-[1.8rem] bg-zinc-950/[0.03] p-5 dark:bg-white/[0.04] md:p-6">
          <SectionHeading
            title={activeSectionMeta ? t(activeSectionMeta.sectionTitleKey) : ''}
            description={activeSectionMeta ? t(activeSectionMeta.sectionDescriptionKey) : ''}
          />
          {children}
        </section>
      </div>
    </>
  );
}
