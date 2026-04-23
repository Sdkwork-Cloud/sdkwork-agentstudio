import * as React from 'react';
import { cn } from '../lib/utils';
import type { ChannelCatalogRegion } from './channelCatalogMeta';

interface ChannelRegionTabsProps {
  activeRegion: ChannelCatalogRegion;
  labels: Record<ChannelCatalogRegion, string>;
  counts: Record<ChannelCatalogRegion, number>;
  descriptions?: Partial<Record<ChannelCatalogRegion, string>>;
  onChange: (region: ChannelCatalogRegion) => void;
  className?: string;
}

export function ChannelRegionTabs({
  activeRegion,
  labels,
  counts,
  descriptions,
  onChange,
  className,
}: ChannelRegionTabsProps) {
  const regions: ChannelCatalogRegion[] = ['domestic', 'global', 'media', 'all'];
  const railClassName =
    'inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-[0.95rem] border border-zinc-200/80 bg-white/92 p-1 shadow-[0_16px_40px_-24px_rgba(15,23,42,0.35)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/55';
  const triggerClassName =
    'inline-flex h-10 min-w-[10rem] shrink-0 items-start justify-between gap-2.5 rounded-[0.8rem] border border-transparent px-3 py-2 text-left transition-all duration-200';
  const countClassName = 'rounded-full px-1.5 py-0.5 text-[11px] font-semibold';

  return (
    <div
      data-slot="channel-region-tabs"
      className={cn(
        railClassName,
        className,
      )}
    >
      {regions.map((region) => {
        const isActive = region === activeRegion;

        return (
          <button
            key={region}
            type="button"
            onClick={() => onChange(region)}
            className={cn(
              triggerClassName,
              isActive
                ? 'bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-800 text-white shadow-[0_16px_36px_-24px_rgba(15,23,42,0.95)] ring-1 ring-white/10 dark:from-zinc-100 dark:via-zinc-100 dark:to-zinc-200 dark:text-zinc-950 dark:ring-zinc-950/10'
                : 'text-zinc-600 hover:border-zinc-200 hover:bg-zinc-50/90 hover:text-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-100',
            )}
          >
            <div className="min-w-0 flex-1">
              <div
                data-slot="channel-region-tab-label"
                className="truncate text-[12px] font-semibold tracking-tight"
              >
                {labels[region]}
              </div>
              {descriptions?.[region] ? (
                <div
                  data-slot="channel-region-tab-description"
                  className={cn(
                    'mt-0.5 line-clamp-2 text-[10.5px] leading-4',
                    isActive
                      ? 'text-white/72 dark:text-zinc-700'
                      : 'text-zinc-500 dark:text-zinc-400',
                  )}
                >
                  {descriptions?.[region]}
                </div>
              ) : null}
            </div>
            <span
              className={cn(
                countClassName,
                'mt-0.5 shrink-0 self-start',
                isActive
                  ? 'bg-white/15 text-white dark:bg-zinc-950/10 dark:text-zinc-950'
                  : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300',
              )}
            >
              {counts[region]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
