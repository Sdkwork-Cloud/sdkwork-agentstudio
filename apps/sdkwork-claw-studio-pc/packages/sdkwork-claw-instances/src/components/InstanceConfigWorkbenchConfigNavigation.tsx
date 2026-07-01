import React from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@sdkwork/claw-ui';

type Translate = (
  key: string,
  en: string,
  zh: string,
  options?: Record<string, unknown>,
) => string;

interface InstanceConfigWorkbenchConfigNavigationTab {
  key: string | null;
  label: string;
}

interface InstanceConfigWorkbenchConfigNavigationProps {
  tr: Translate;
  invalidDraftVisible: boolean;
  parseError: string | null;
  searchQuery: string;
  activeSectionKey: string | null;
  tabs: InstanceConfigWorkbenchConfigNavigationTab[];
  onSearchQueryChange: (value: string) => void;
  onSelectSection: (key: string | null) => void;
  onOpenRaw: () => void;
  onDismissValidity: () => void;
}

export function InstanceConfigWorkbenchConfigNavigation(
  props: InstanceConfigWorkbenchConfigNavigationProps,
) {
  return (
    <div className="space-y-4">
      {props.invalidDraftVisible ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-semibold">
                {props.tr(
                  'instances.detail.instanceWorkbench.config.workbench.navigation.invalidDraft',
                  'The current draft is invalid JSON5.',
                  'The current draft is invalid JSON5.',
                )}
              </div>
              {props.parseError ? <div className="mt-1 break-words">{props.parseError}</div> : null}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={props.onOpenRaw}
                className="rounded-xl border border-amber-300/80 bg-white/80 px-3 py-2 text-xs font-semibold text-amber-900 transition hover:bg-white dark:border-amber-500/30 dark:bg-zinc-950/40 dark:text-amber-200 dark:hover:bg-zinc-950/70"
              >
                {props.tr(
                  'instances.detail.instanceWorkbench.config.workbench.navigation.openRaw',
                  'Open Raw',
                  'Open Raw',
                )}
              </button>
              <button
                type="button"
                onClick={props.onDismissValidity}
                className="rounded-xl border border-amber-300/80 bg-white/80 px-3 py-2 text-xs font-semibold text-amber-900 transition hover:bg-white dark:border-amber-500/30 dark:bg-zinc-950/40 dark:text-amber-200 dark:hover:bg-zinc-950/70"
              >
                {props.tr(
                  'instances.detail.instanceWorkbench.config.workbench.navigation.dismiss',
                  'Dismiss',
                  'Dismiss',
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <Input
          type="text"
          value={props.searchQuery}
          onChange={(event) => props.onSearchQueryChange(event.target.value)}
          placeholder={props.tr(
            'instances.detail.instanceWorkbench.config.workbench.navigation.searchPlaceholder',
            'Search settings...',
            'Search settings...',
          )}
          className="w-full rounded-2xl border border-zinc-200/70 bg-white/85 py-2.5 pl-9 pr-10 text-sm text-zinc-950 outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950/55 dark:text-zinc-50 dark:focus:border-zinc-600"
        />
        {props.searchQuery ? (
          <button
            type="button"
            onClick={() => props.onSearchQueryChange('')}
            className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-max gap-2">
          {props.tabs.map((tab) => (
            <button
              key={tab.key ?? '__root__'}
              type="button"
              onClick={() => props.onSelectSection(tab.key)}
              className={`rounded-xl border px-3 py-2 text-sm transition ${
                props.activeSectionKey === tab.key
                  ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                  : 'border-zinc-200/70 bg-zinc-50/70 text-zinc-600 hover:border-zinc-300 hover:text-zinc-950 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:text-zinc-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
