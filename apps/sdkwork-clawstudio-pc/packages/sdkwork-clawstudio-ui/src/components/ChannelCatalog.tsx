import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Settings } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './Button';
import { Switch } from './Switch';
import { ChannelRegionTabs } from './ChannelRegionTabs';
import { ChannelEmptyStateSurface, ChannelIdentityBadge } from './channelCatalogShared';
import {
  buildChannelCatalogRegionDescriptions,
  buildChannelCatalogRegionLabels,
  getChannelCatalogRegionEmptyText,
} from './channelCatalogRegionContent';
import {
  getChannelCatalogRegions,
  isChannelDownloadAppAction,
  getChannelOfficialLink,
  partitionChannelCatalogItemsByRegion,
  resolveDefaultChannelCatalogRegion,
  type ChannelCatalogRegion,
  sortChannelCatalogItems,
  type ChannelOfficialLink,
} from './channelCatalogMeta';
import { getChannelBindingGuide } from './channelBindingGuides';

export type ChannelCatalogVariant = 'management' | 'summary';

export interface ChannelCatalogItem {
  id: string;
  name: string;
  description: string;
  status: 'connected' | 'disconnected' | 'not_configured';
  enabled: boolean;
  icon?: React.ReactNode;
  configurationMode?: 'required' | 'none';
  fieldCount?: number;
  configuredFieldCount?: number;
  setupSteps?: string[];
}

export interface ChannelCatalogTexts {
  statusActive: string;
  statusConnected: string;
  statusDisconnected: string;
  statusNotConfigured: string;
  actionConnect: string;
  actionConfigure: string;
  actionDownloadApp: string;
  actionOpenOfficialSite: string;
  actionEnableChannel: (name: string) => string;
  metricConfiguredFields: string;
  metricSetupSteps: string;
  metricDeliveryState: string;
  stateEnabled: string;
  statePending: string;
  summaryFallback: string;
}

export interface ChannelCatalogProps {
  items: ChannelCatalogItem[];
  texts: ChannelCatalogTexts;
  variant?: ChannelCatalogVariant;
  emptyState?: React.ReactNode;
  showRegionTabs?: boolean;
  resolveOfficialLink?: (channel: ChannelCatalogItem) => ChannelOfficialLink | null;
  onOpenOfficialLink?: (
    channel: ChannelCatalogItem,
    link: ChannelOfficialLink,
  ) => Promise<void> | void;
  onConfigure?: (channel: ChannelCatalogItem) => void;
  onToggleEnabled?: (channel: ChannelCatalogItem, nextEnabled: boolean) => void;
}

interface StatusBadgeConfig {
  className: string;
  label: string;
}

function getOfficialActionLabel(channel: ChannelCatalogItem, texts: ChannelCatalogTexts) {
  return isChannelDownloadAppAction(channel.id) ? texts.actionDownloadApp : texts.actionOpenOfficialSite;
}

function getStatusBadge(
  channel: ChannelCatalogItem,
  texts: ChannelCatalogTexts,
  variant: ChannelCatalogVariant,
): StatusBadgeConfig {
  if (variant === 'management') {
    if (channel.status === 'connected' && channel.enabled) {
      return {
        className:
          'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400',
        label: texts.statusActive,
      };
    }

    if (channel.status === 'not_configured') {
      return {
        className:
          'border-zinc-200 bg-zinc-100 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400',
        label: texts.statusNotConfigured,
      };
    }
  }

  if (channel.status === 'connected') {
    return {
      className:
        'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300',
      label: texts.statusConnected,
    };
  }

  if (channel.status === 'disconnected') {
    return {
      className:
        'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300',
      label: texts.statusDisconnected,
    };
  }

  return {
    className:
      'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    label: texts.statusNotConfigured,
  };
}

function SummaryMetric({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div
      data-slot="channel-catalog-summary-metric"
      className="min-w-[7rem] rounded-[18px] border border-zinc-200/80 bg-white/78 px-3.5 py-3 shadow-[0_16px_36px_-32px_rgba(15,23,42,0.34)] dark:border-zinc-800 dark:bg-zinc-900/72"
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-zinc-950 dark:text-zinc-50">{value}</div>
    </div>
  );
}

function OfficialLinkButton({
  channel,
  link,
  label,
  className,
  dataSlot,
  variant = 'outline',
  size = 'sm',
  onOpenOfficialLink,
}: {
  channel: ChannelCatalogItem;
  link: ChannelOfficialLink;
  label: string;
  className?: string;
  dataSlot?: string;
  variant?: React.ComponentProps<typeof Button>['variant'];
  size?: React.ComponentProps<typeof Button>['size'];
  onOpenOfficialLink?: (
    channel: ChannelCatalogItem,
    link: ChannelOfficialLink,
  ) => Promise<void> | void;
}) {
  if (onOpenOfficialLink) {
    return (
      <Button
        data-slot={dataSlot}
        variant={variant}
        size={size}
        className={className}
        type="button"
        title={link.label}
        onClick={() => {
          void onOpenOfficialLink(channel, link);
        }}
      >
        {label}
        <ExternalLink className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button data-slot={dataSlot} variant={variant} size={size} className={className} asChild>
      <a href={link.href} target="_blank" rel="noreferrer" title={link.label}>
        {label}
        <ExternalLink className="h-4 w-4" />
      </a>
    </Button>
  );
}

function shouldUseDownloadOnlyAction(channel: ChannelCatalogItem) {
  const supportsQrConnection = Boolean(getChannelBindingGuide(channel.id));
  if (isChannelDownloadAppAction(channel.id) && !supportsQrConnection) {
    return true;
  }

  return false;
}

function supportsChannelQrConnection(channel: ChannelCatalogItem) {
  return Boolean(getChannelBindingGuide(channel.id));
}

export function ChannelCatalog({
  items,
  texts,
  variant = 'management',
  emptyState = null,
  showRegionTabs = true,
  resolveOfficialLink = (channel) => getChannelOfficialLink(channel.id),
  onOpenOfficialLink,
  onConfigure,
  onToggleEnabled,
}: ChannelCatalogProps) {
  const { t } = useTranslation();
  const sortedItems = sortChannelCatalogItems(items);
  const regionGroups = partitionChannelCatalogItemsByRegion(sortedItems);
  const [activeRegion, setActiveRegion] = React.useState<ChannelCatalogRegion>(() =>
    resolveDefaultChannelCatalogRegion(regionGroups),
  );

  React.useEffect(() => {
    const preferredRegion = resolveDefaultChannelCatalogRegion(regionGroups);
    if (regionGroups[activeRegion].length === 0 && regionGroups[preferredRegion].length > 0) {
      setActiveRegion(preferredRegion);
    }
  }, [activeRegion, regionGroups]);

  const visibleItems = showRegionTabs ? regionGroups[activeRegion] : sortedItems;
  const regionLabels: Record<ChannelCatalogRegion, string> = buildChannelCatalogRegionLabels(t);
  const regionDescriptions: Partial<Record<ChannelCatalogRegion, string>> =
    buildChannelCatalogRegionDescriptions(t);
  const regionCounts: Record<ChannelCatalogRegion, number> = {
    domestic: regionGroups.domestic.length,
    global: regionGroups.global.length,
    media: regionGroups.media.length,
    all: regionGroups.all.length,
  };
  const regionEmptyText = getChannelCatalogRegionEmptyText(t, activeRegion);

  if (items.length === 0) {
    return <>{emptyState}</>;
  }

  if (visibleItems.length === 0) {
    return (
      <div className="space-y-4">
        {showRegionTabs ? (
          <ChannelRegionTabs
            activeRegion={activeRegion}
            labels={regionLabels}
            counts={regionCounts}
            descriptions={regionDescriptions}
            onChange={setActiveRegion}
          />
        ) : null}
        <ChannelEmptyStateSurface
          dataSlot="channel-catalog-empty-state"
          title={regionEmptyText}
          className="rounded-[24px] border border-dashed border-zinc-300/80 bg-gradient-to-br from-white via-white to-zinc-50/90 p-6 text-sm text-zinc-500 shadow-[0_18px_46px_-40px_rgba(15,23,42,0.35)] dark:border-zinc-700 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950/90 dark:text-zinc-400"
        />
      </div>
    );
  }

  if (variant === 'summary') {
    return (
      <div className="space-y-4">
        {showRegionTabs ? (
          <ChannelRegionTabs
            activeRegion={activeRegion}
            labels={regionLabels}
            counts={regionCounts}
            descriptions={regionDescriptions}
            onChange={setActiveRegion}
          />
        ) : null}
        <div
          data-slot="channel-catalog-summary"
          className="overflow-hidden rounded-[24px] border border-zinc-200/70 bg-white/85 shadow-[0_22px_60px_-42px_rgba(15,23,42,0.4)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/45"
        >
          {visibleItems.map((channel, index) => {
            const badge = getStatusBadge(channel, texts, variant);
            const officialLink = resolveOfficialLink(channel);
            const channelRegions = getChannelCatalogRegions(channel.id);
            const shouldShowConfiguredFieldMetric =
              typeof channel.configuredFieldCount === 'number' &&
              typeof channel.fieldCount === 'number' &&
              channel.fieldCount > 0;

            return (
              <div
                key={channel.id}
                className={cn(
                  'grid gap-4 px-5 py-5 xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_auto] xl:items-center',
                  index === visibleItems.length - 1
                    ? ''
                    : 'border-b border-zinc-200/70 dark:border-zinc-800',
                )}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                      {channel.name}
                    </h3>
                    <span
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em]',
                        badge.className,
                      )}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                    {channel.description}
                  </p>
                  <div
                    data-slot="channel-catalog-summary-meta"
                    className="mt-4 flex flex-wrap items-center gap-2.5"
                  >
                    {channelRegions.map((region) => (
                      <span
                        key={`${channel.id}-${region}`}
                        data-slot="channel-catalog-summary-region"
                        className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-300"
                      >
                        {regionLabels[region]}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-5">
                  {shouldShowConfiguredFieldMetric ? (
                    <SummaryMetric
                      label={texts.metricConfiguredFields}
                      value={`${channel.configuredFieldCount}/${channel.fieldCount}`}
                    />
                  ) : null}
                  <SummaryMetric
                    label={texts.metricSetupSteps}
                    value={channel.setupSteps?.length || 0}
                  />
                  <SummaryMetric
                    label={texts.metricDeliveryState}
                    value={channel.enabled ? texts.stateEnabled : texts.statePending}
                  />
                </div>

                <div className="xl:max-w-sm">
                  <div
                    data-slot="channel-catalog-summary-guide"
                    className="rounded-[20px] border border-zinc-200/70 bg-gradient-to-br from-zinc-50 via-white to-zinc-100/80 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800/80 dark:text-zinc-300"
                  >
                    {channel.setupSteps?.[0] || texts.summaryFallback}
                  </div>
                  {officialLink ? (
                    <OfficialLinkButton
                      channel={channel}
                      link={officialLink}
                      label={getOfficialActionLabel(channel, texts)}
                      className="mt-3"
                      onOpenOfficialLink={onOpenOfficialLink}
                    />
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showRegionTabs ? (
        <ChannelRegionTabs
          activeRegion={activeRegion}
          labels={regionLabels}
          counts={regionCounts}
          descriptions={regionDescriptions}
          onChange={setActiveRegion}
        />
      ) : null}
      <div
        data-slot="channel-catalog-management"
        className="overflow-hidden rounded-[24px] border border-zinc-200/80 bg-white/92 shadow-[0_22px_60px_-42px_rgba(15,23,42,0.42)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/92"
      >
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {visibleItems.map((channel) => {
            const badge = getStatusBadge(channel, texts, variant);
            const officialLink = resolveOfficialLink(channel);
            const supportsQrConnection = supportsChannelQrConnection(channel);
            const isDownloadAppChannel = shouldUseDownloadOnlyAction(channel);
            const channelRegions = getChannelCatalogRegions(channel.id);
            const shouldShowConfiguredFieldMetric =
              typeof channel.configuredFieldCount === 'number' &&
              typeof channel.fieldCount === 'number' &&
              channel.fieldCount > 0;
            const setupStepCount = channel.setupSteps?.length || 0;

            return (
              <div
                key={channel.id}
                className="group flex flex-col justify-between gap-6 p-6 transition-colors hover:bg-gradient-to-r hover:from-zinc-50/95 hover:via-white hover:to-white dark:hover:from-zinc-900/80 dark:hover:via-zinc-900/60 dark:hover:to-zinc-900/40 sm:flex-row sm:items-center"
              >
                <div className="flex flex-1 items-start gap-5">
                  <ChannelIdentityBadge
                    channelId={channel.id}
                    channelName={channel.name}
                    icon={channel.icon}
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border shadow-sm transition-transform duration-300 group-hover:scale-105"
                    monogramClassName="text-sm font-bold uppercase tracking-[0.18em]"
                  />
                  <div className="min-w-0 flex-1">
                    <div
                      data-slot="channel-catalog-management-heading"
                      className="mb-2 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-lg font-bold text-zinc-900 transition-colors group-hover:text-primary-600 dark:text-zinc-100 dark:group-hover:text-primary-400">
                            {channel.name}
                          </h3>
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider',
                              badge.className,
                            )}
                          >
                            {badge.label}
                          </span>
                        </div>
                      </div>
                      {officialLink ? (
                        <div
                          data-slot="channel-catalog-management-link-action"
                          className="shrink-0"
                        >
                          <OfficialLinkButton
                            channel={channel}
                            link={officialLink}
                            label={getOfficialActionLabel(channel, texts)}
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg border-zinc-200/80 bg-white/85 px-2.5 text-xs font-semibold text-zinc-600 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.45)] hover:border-zinc-300 hover:bg-white hover:text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                            onOpenOfficialLink={onOpenOfficialLink}
                          />
                        </div>
                      ) : null}
                    </div>
                    <p className="max-w-2xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                      {channel.description}
                    </p>
                    <div
                      data-slot="channel-catalog-management-meta"
                      className="mt-4 flex flex-wrap items-center gap-2.5"
                    >
                      {channelRegions.map((region) => (
                        <span
                          key={`${channel.id}-${region}`}
                          data-slot="channel-catalog-management-region"
                          className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-300"
                        >
                          {regionLabels[region]}
                        </span>
                      ))}
                      <span className="inline-flex items-center rounded-full bg-zinc-950/[0.045] px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:bg-white/[0.07] dark:text-zinc-300">
                        {texts.metricSetupSteps}
                        <span className="mx-1.5 h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                        {setupStepCount}
                      </span>
                      {shouldShowConfiguredFieldMetric ? (
                        <span className="inline-flex items-center rounded-full bg-zinc-950/[0.045] px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:bg-white/[0.07] dark:text-zinc-300">
                          {texts.metricConfiguredFields}
                          <span className="mx-1.5 h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                          {channel.configuredFieldCount}/{channel.fieldCount}
                        </span>
                      ) : null}
                      <span className="inline-flex items-center rounded-full bg-zinc-950/[0.045] px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:bg-white/[0.07] dark:text-zinc-300">
                        {texts.metricDeliveryState}
                        <span className="mx-1.5 h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                        {channel.enabled ? texts.stateEnabled : texts.statePending}
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  data-slot="channel-catalog-management-actions"
                  className="sm:border-l sm:border-zinc-100 sm:pl-6 dark:sm:border-zinc-800"
                >
                  <div
                    data-slot="channel-catalog-management-action-panel"
                    className="flex flex-wrap items-center gap-3 rounded-[20px] border border-zinc-200/80 bg-zinc-50/80 px-3 py-3 transition-colors group-hover:border-zinc-300/80 group-hover:bg-white dark:border-zinc-800 dark:bg-zinc-900/78 dark:group-hover:border-zinc-700 dark:group-hover:bg-zinc-900"
                  >
                    {isDownloadAppChannel ? (
                      onConfigure && supportsQrConnection ? (
                        <Button onClick={() => onConfigure(channel)}>{texts.actionConnect}</Button>
                      ) : onToggleEnabled ? (
                        <Switch
                          checked={channel.enabled}
                          onCheckedChange={(checked) => onToggleEnabled(channel, checked === true)}
                          aria-label={texts.actionEnableChannel(channel.name)}
                        />
                      ) : null
                    ) : channel.status === 'not_configured' ? (
                      onConfigure ? (
                        <Button onClick={() => onConfigure(channel)}>{texts.actionConnect}</Button>
                      ) : null
                    ) : (
                      <>
                        {onConfigure ? (
                          <Button variant="ghost" onClick={() => onConfigure(channel)}>
                            <Settings className="h-4 w-4" />
                            {texts.actionConfigure}
                          </Button>
                        ) : null}
                        {onToggleEnabled ? (
                          <Switch
                            checked={channel.enabled}
                            onCheckedChange={(checked) => onToggleEnabled(channel, checked === true)}
                            aria-label={texts.actionEnableChannel(channel.name)}
                          />
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
