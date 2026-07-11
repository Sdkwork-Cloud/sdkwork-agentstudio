import React from 'react';
import { InstanceConfigWorkbenchStatusChip } from './InstanceConfigWorkbenchStatusChip.tsx';

type Translate = (
  key: string,
  en: string,
  zh: string,
  options?: Record<string, unknown>,
) => string;

interface InstanceConfigWorkbenchSectionHeroProps {
  tr: Translate;
  sectionKey: string;
  title: string;
  description: string;
  isKnownSection: boolean;
  categoryLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  entryCount: number | null;
  envSensitiveVisible: boolean;
  onToggleEnvSensitive: () => void;
}

export function InstanceConfigWorkbenchSectionHero(
  props: InstanceConfigWorkbenchSectionHeroProps,
) {
  return (
    <div className="rounded-[1.8rem] border border-zinc-200/70 bg-white/85 p-5 dark:border-zinc-800 dark:bg-zinc-950/35">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <span
            className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${props.tone}`}
          >
            {React.createElement(props.icon, { className: 'h-5 w-5' })}
          </span>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
              {props.tr(
                'instances.detail.instanceWorkbench.config.workbench.section.label',
                'Config section',
                'Config section',
              )}
            </div>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {props.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              {props.description}
            </p>
          </div>
        </div>
        {props.sectionKey === 'env' ? (
          <button
            type="button"
            onClick={props.onToggleEnvSensitive}
            className="rounded-full border border-zinc-200/70 bg-white/70 px-3 py-1 text-xs font-semibold text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-zinc-50"
          >
            {props.envSensitiveVisible
              ? props.tr(
                  'instances.detail.instanceWorkbench.config.workbench.section.hideSensitiveValues',
                  'Hide sensitive values',
                  'Hide sensitive values',
                )
              : props.tr(
                  'instances.detail.instanceWorkbench.config.workbench.section.revealSensitiveValues',
                  'Reveal sensitive values',
                  'Reveal sensitive values',
                )}
          </button>
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <InstanceConfigWorkbenchStatusChip>{props.sectionKey}</InstanceConfigWorkbenchStatusChip>
        <InstanceConfigWorkbenchStatusChip>{props.categoryLabel}</InstanceConfigWorkbenchStatusChip>
        {props.entryCount !== null ? (
          <InstanceConfigWorkbenchStatusChip>
            {props.tr(
              'instances.detail.instanceWorkbench.config.sections.entries',
              '{{count}} entries',
              '{{count}} entries',
              {
                count: props.entryCount,
              },
            )}
          </InstanceConfigWorkbenchStatusChip>
        ) : null}
        {!props.isKnownSection ? (
          <InstanceConfigWorkbenchStatusChip>
            {props.tr(
              'instances.detail.instanceWorkbench.config.workbench.section.customSection',
              'Custom section',
              'Custom section',
            )}
          </InstanceConfigWorkbenchStatusChip>
        ) : null}
      </div>
    </div>
  );
}
