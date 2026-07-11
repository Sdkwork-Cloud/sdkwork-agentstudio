import React from 'react';
import type { InstanceWorkbenchSnapshot } from '../types/index.ts';
import { RowMetric, WorkbenchRow, WorkbenchRowList } from './InstanceWorkbenchPrimitives.tsx';
import {
  buildInstanceInstalledSkillInformation,
  createInstanceInstalledSkillPresentationCopy,
} from './instanceInstalledSkillPresentation.ts';

interface InstanceDetailSkillsSectionProps {
  skills: InstanceWorkbenchSnapshot['skills'];
  t: (key: string, options?: Record<string, unknown>) => string;
}

export function InstanceDetailSkillsSection({
  skills,
  t,
}: InstanceDetailSkillsSectionProps) {
  const installedSkillCopy = createInstanceInstalledSkillPresentationCopy(t);

  return (
    <div data-slot="instance-detail-skills">
      <WorkbenchRowList>
        {skills.map((skill, index) => {
          const installedSkillInformation = buildInstanceInstalledSkillInformation(
            skill,
            installedSkillCopy,
          );
          const compatibilityToneClass =
            skill.instanceAsset?.compatibility === 'blocked'
              ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200'
              : skill.instanceAsset?.compatibility === 'attention'
                ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200';

          return (
            <WorkbenchRow key={skill.id} isLast={index === skills.length - 1}>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                    {skill.name}
                  </h3>
                  <span className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                    {skill.category}
                  </span>
                  {installedSkillInformation.compatibilityValue ? (
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${compatibilityToneClass}`}>
                      {installedSkillInformation.compatibilityValue}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  {skill.description}
                </p>
                {installedSkillInformation.rows.length > 0 ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {installedSkillInformation.rows.map((row) => (
                      <div
                        key={`${skill.id}-${row.id}`}
                        className="rounded-[1rem] bg-zinc-950/[0.03] px-3 py-3 dark:bg-white/[0.04]"
                      >
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                          {row.label}
                        </div>
                        <div className="mt-1 break-all text-xs text-zinc-900 dark:text-zinc-100">
                          {row.value}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-5">
                <RowMetric
                  label={t('instances.detail.instanceWorkbench.metrics.version')}
                  value={skill.version || '--'}
                />
                <RowMetric
                  label={t('instances.detail.instanceWorkbench.metrics.downloads')}
                  value={skill.downloads.toLocaleString()}
                />
                <RowMetric
                  label={t('instances.detail.instanceWorkbench.metrics.rating')}
                  value={skill.rating.toFixed(1)}
                />
              </div>
              <div className="text-right text-sm text-zinc-500 dark:text-zinc-400">
                {skill.author}
              </div>
            </WorkbenchRow>
          );
        })}
      </WorkbenchRowList>
    </div>
  );
}
