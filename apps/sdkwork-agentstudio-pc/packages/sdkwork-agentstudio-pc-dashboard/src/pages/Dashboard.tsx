import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Coins,
  DollarSign,
  RefreshCw,
  ShoppingCart,
  TriangleAlert,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DashboardSummaryCard } from '../components/DashboardSummaryCard';
import { DistributionRingChart } from '../components/DistributionRingChart';
import { ModelDistributionChart } from '../components/ModelDistributionChart';
import { RevenueTrendChart } from '../components/RevenueTrendChart';
import { SectionHeader } from '../components/SectionHeader';
import { StatusPill } from '../components/StatusPill';
import { TokenTrendChart } from '../components/TokenTrendChart';
import { dashboardService } from '../services';
import type {
  DashboardAnalyticsGranularity,
  DashboardAnalyticsQuery,
  DashboardAnalyticsRangeMode,
  DashboardAlertItem,
  DashboardSnapshot,
} from '../types';
import {
  createInitialDashboardDeferredSections,
  mergeDashboardDeferredSections,
  scheduleDashboardSectionHydration,
} from './dashboardSectionHydration.ts';

const surfaceClass =
  'min-w-0 rounded-[2rem] border border-white/70 bg-white/78 p-6 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/6 dark:bg-zinc-900/82';
const chartPalette = [
  { dotClassName: 'bg-primary-500', sliceClassName: 'text-primary-500' },
  { dotClassName: 'bg-sky-500', sliceClassName: 'text-sky-500' },
  { dotClassName: 'bg-emerald-500', sliceClassName: 'text-emerald-500' },
  { dotClassName: 'bg-amber-500', sliceClassName: 'text-amber-500' },
  { dotClassName: 'bg-rose-500', sliceClassName: 'text-rose-500' },
  { dotClassName: 'bg-cyan-500', sliceClassName: 'text-cyan-500' },
];
const summaryCardGridClass = 'grid gap-4 xl:grid-cols-2 2xl:grid-cols-3';
const summaryMetricGridClass = 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2';
const analyticsSplitGridClass = 'grid gap-6 2xl:grid-cols-[1.35fr_0.95fr]';
const distributionSplitGridClass =
  'mt-6 grid gap-5 xl:grid-cols-[minmax(16rem,0.82fr)_minmax(0,1.18fr)]';
const tableScrollClass = 'min-w-0 overflow-x-auto [scrollbar-gutter:stable]';

type WorkbenchTab = 'api' | 'revenue' | 'products' | 'alerts';
type ApiStatusFilter = 'all' | 'success' | 'failed';

function formatMonthKey(date: Date) {
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  return `${date.getUTCFullYear()}-${month}`;
}

function parseMonthKey(value: string) {
  const [yearText, monthText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);

  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, 1));
}

function buildMonthOptions(anchorMonthKey: string, selectedMonthKey: string, count = 12) {
  const anchorDate = parseMonthKey(anchorMonthKey) ?? new Date();
  const options = Array.from({ length: count }, (_, index) => {
    const offset = count - index - 1;
    return formatMonthKey(
      new Date(Date.UTC(anchorDate.getUTCFullYear(), anchorDate.getUTCMonth() - offset, 1)),
    );
  });

  if (selectedMonthKey && !options.includes(selectedMonthKey)) {
    options.push(selectedMonthKey);
  }

  return [...new Set(options)].sort();
}

function getDeltaTone(delta: number) {
  if (delta > 0) return 'text-emerald-700 dark:text-emerald-200';
  if (delta < 0) return 'text-amber-700 dark:text-amber-200';
  return 'text-zinc-700 dark:text-zinc-200';
}

function getApiStatusTone(status: 'success' | 'failed') {
  return status === 'success' ? 'positive' : 'critical';
}

function getRevenueStatusTone(
  status:
    | 'paid'
    | 'pending'
    | 'refunded'
    | 'completed'
    | 'delivered'
    | 'cancelled'
    | 'refunding',
) {
  if (status === 'paid' || status === 'completed' || status === 'delivered') return 'positive';
  if (status === 'pending' || status === 'refunding') return 'warning';
  return 'critical';
}

function getAlertTone(severity: DashboardAlertItem['severity']) {
  if (severity === 'critical') return 'critical';
  if (severity === 'warning') return 'warning';
  return 'positive';
}

function DeferredDashboardSurface({
  eyebrow,
  title,
  description,
  minHeightClass = 'min-h-[22rem]',
}: {
  eyebrow: string;
  title: string;
  description: string;
  minHeightClass?: string;
}) {
  const { t } = useTranslation();

  return (
    <section className={surfaceClass}>
      <SectionHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
      />
      <div
        className={`mt-6 flex items-center justify-center rounded-[1.6rem] border border-dashed border-zinc-300/80 bg-white/60 text-sm text-zinc-500 dark:border-zinc-700/70 dark:bg-zinc-950/35 dark:text-zinc-400 ${minHeightClass}`}
      >
        {t('common.loading')}
      </div>
    </section>
  );
}

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [granularity, setGranularity] = useState<DashboardAnalyticsGranularity>('day');
  const [rangeMode, setRangeMode] = useState<DashboardAnalyticsRangeMode>('seven_days');
  const [monthKey, setMonthKey] = useState('2026-03');
  const [customStart, setCustomStart] = useState('2026-03-01');
  const [customEnd, setCustomEnd] = useState('2026-03-18');
  const [activeTab, setActiveTab] = useState<WorkbenchTab>('api');
  const [apiStatusFilter, setApiStatusFilter] = useState<ApiStatusFilter>('all');
  const [hydratedSections, setHydratedSections] = useState(
    createInitialDashboardDeferredSections(),
  );
  const dashboardHydrationBootstrappedRef = useRef(false);

  const analyticsQuery = useMemo<DashboardAnalyticsQuery>(() => {
    if (rangeMode === 'month') return { granularity, rangeMode, monthKey };
    if (rangeMode === 'custom') return { granularity, rangeMode, customStart, customEnd };
    return { granularity, rangeMode };
  }, [customEnd, customStart, granularity, monthKey, rangeMode]);

  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 0 }),
    [i18n.language],
  );
  const compactNumberFormatter = useMemo(
    () =>
      new Intl.NumberFormat(i18n.language, {
        maximumFractionDigits: 1,
        notation: 'compact',
      }),
    [i18n.language],
  );
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(i18n.language, {
        currency: 'USD',
        style: 'currency',
        maximumFractionDigits: 2,
      }),
    [i18n.language],
  );
  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [i18n.language],
  );

  const formatTokens = (value: number) => compactNumberFormatter.format(value);
  const formatInteger = (value: number) => numberFormatter.format(value);
  const formatCurrency = (value: number) => currencyFormatter.format(value);
  const formatPercent = (value: number) => `${numberFormatter.format(value)}%`;
  const formatSignedPercent = (value: number) =>
    `${value >= 0 ? '+' : ''}${numberFormatter.format(value)}%`;
  const formatTimestamp = (value: string) => dateTimeFormatter.format(new Date(value));

  const loadSnapshot = async (query: DashboardAnalyticsQuery) => {
    setIsLoading(true);
    setError(null);
    try {
      setSnapshot(await dashboardService.getSnapshot(query));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unknown dashboard error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadSnapshot(analyticsQuery);
  }, [analyticsQuery]);

  useEffect(() => {
    if (!snapshot || dashboardHydrationBootstrappedRef.current) {
      return;
    }

    dashboardHydrationBootstrappedRef.current = true;

    return scheduleDashboardSectionHydration({
      onBatchReady: (nextState) => {
        startTransition(() => {
          setHydratedSections((current) =>
            mergeDashboardDeferredSections(current, nextState),
          );
        });
      },
    });
  }, [Boolean(snapshot)]);

  const businessSummary = snapshot?.businessSummary;
  const tokenSummary = snapshot?.tokenSummary;
  const tokenAnalytics = snapshot?.tokenAnalytics;
  const revenueAnalytics = snapshot?.revenueAnalytics;
  const activityFeed = snapshot?.activityFeed;
  const latestApiTimestamp = activityFeed?.recentApiCalls[0]?.timestamp;
  const latestAvailableMonthKey = useMemo(() => {
    return formatMonthKey(latestApiTimestamp ? new Date(latestApiTimestamp) : new Date());
  }, [latestApiTimestamp]);
  const monthOptions = useMemo(() => {
    return buildMonthOptions(latestAvailableMonthKey, monthKey);
  }, [latestAvailableMonthKey, monthKey]);

  const selectedRangeLabel =
    rangeMode === 'month'
      ? `${t('dashboard.filters.month')} ${monthKey}`
      : rangeMode === 'custom'
        ? `${customStart} - ${customEnd}`
        : t('dashboard.filters.sevenDays');
  const granularityLabel =
    granularity === 'hour' ? t('dashboard.filters.hour') : t('dashboard.filters.day');
  const rangeSummaryLabel = t('dashboard.labels.rangeSummary', {
    granularity: granularityLabel,
    range: selectedRangeLabel,
  });

  const apiRecords = useMemo(() => {
    const rows = activityFeed?.recentApiCalls ?? [];
    if (apiStatusFilter === 'all') {
      return rows;
    }
    return rows.filter((row) => row.status === apiStatusFilter);
  }, [activityFeed?.recentApiCalls, apiStatusFilter]);

  const shouldShowCacheSeries = Boolean(
    tokenAnalytics &&
      (tokenAnalytics.cacheCreationTokens > 0 || tokenAnalytics.cacheReadTokens > 0),
  );
  const chartSeries = [
    {
      key: 'totalTokens' as const,
      label: t('dashboard.series.totalTokens'),
      dotClassName: 'bg-primary-500',
      strokeClassName: 'text-primary-500',
    },
    {
      key: 'inputTokens' as const,
      label: t('dashboard.series.inputTokens'),
      dotClassName: 'bg-sky-500',
      strokeClassName: 'text-sky-500',
    },
    {
      key: 'outputTokens' as const,
      label: t('dashboard.series.outputTokens'),
      dotClassName: 'bg-emerald-500',
      strokeClassName: 'text-emerald-500',
    },
    ...(shouldShowCacheSeries
      ? [
          {
            key: 'cacheCreationTokens' as const,
            label: t('dashboard.series.cacheCreation'),
            dotClassName: 'bg-amber-500',
            strokeClassName: 'text-amber-500',
          },
          {
            key: 'cacheReadTokens' as const,
            label: t('dashboard.series.cacheRead'),
            dotClassName: 'bg-violet-500',
            strokeClassName: 'text-violet-500',
          },
        ]
      : []),
  ];

  if (error && !snapshot) {
    return (
      <div className="flex h-full items-center justify-center px-6 py-10">
        <div className="max-w-md rounded-[2rem] border border-white/70 bg-white/85 p-8 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/6 dark:bg-zinc-900/85">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/12 text-rose-500">
            <Activity className="h-6 w-6" />
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {t('dashboard.empty.loadingFailed')}
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            {t('dashboard.empty.loadingDescription')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-y-auto">
      <div className="min-h-full px-4 py-5 sm:px-6 lg:px-8 xl:px-10">
        <div className="w-full space-y-6 xl:space-y-8">
          <div className={summaryCardGridClass}>
            <DashboardSummaryCard
              eyebrow={t('dashboard.metrics.revenue.eyebrow')}
              title={t('dashboard.metrics.revenue.label')}
              description={t('dashboard.metrics.revenue.description')}
              accent={<DollarSign className="h-5 w-5 text-emerald-500" />}
              changeLabel={businessSummary ? formatSignedPercent(businessSummary.revenueDelta) : undefined}
            >
              <div className="grid gap-4">
                <div className="rounded-[1.5rem] bg-emerald-500/[0.08] p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-200">
                    {t('dashboard.labels.today')}
                  </div>
                  <div className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                    {businessSummary ? formatCurrency(businessSummary.todayRevenue) : '--'}
                  </div>
                  <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                    {businessSummary
                      ? `${t('dashboard.labels.totalOrders')} ${formatInteger(businessSummary.todayOrders)}`
                      : '--'}
                  </div>
                </div>
                <div className={summaryMetricGridClass}>
                  <div className="rounded-[1.4rem] bg-zinc-950/[0.03] p-4 dark:bg-white/[0.04]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.labels.week')}</div>
                    <div className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                      {businessSummary ? formatCurrency(businessSummary.weekRevenue) : '--'}
                    </div>
                  </div>
                  <div className="rounded-[1.4rem] bg-zinc-950/[0.03] p-4 dark:bg-white/[0.04]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.labels.month')}</div>
                    <div className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                      {businessSummary ? formatCurrency(businessSummary.monthRevenue) : '--'}
                    </div>
                  </div>
                  <div className="rounded-[1.4rem] bg-zinc-950/[0.03] p-4 dark:bg-white/[0.04]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.labels.year')}</div>
                    <div className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                      {businessSummary ? formatCurrency(businessSummary.yearRevenue) : '--'}
                    </div>
                  </div>
                </div>
              </div>
            </DashboardSummaryCard>

            <DashboardSummaryCard
              eyebrow={t('dashboard.metrics.tokenUsage.eyebrow')}
              title={t('dashboard.metrics.tokenUsage.label')}
              description={t('dashboard.metrics.tokenUsage.description')}
              accent={<Coins className="h-5 w-5 text-primary-500" />}
              changeLabel={tokenSummary ? formatSignedPercent(tokenSummary.usageDelta) : undefined}
            >
              <div className="grid gap-4">
                <div className={summaryMetricGridClass}>
                  <div className="rounded-[1.5rem] bg-primary-500/[0.08] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-700 dark:text-primary-200">{t('dashboard.labels.dailyRequests')}</div>
                    <div className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
                      {tokenSummary ? formatInteger(tokenSummary.dailyRequestCount) : '--'}
                    </div>
                  </div>
                  <div className="rounded-[1.5rem] bg-sky-500/[0.08] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-200">{t('dashboard.labels.dailyTokens')}</div>
                    <div className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
                      {tokenSummary ? formatTokens(tokenSummary.dailyTokenCount) : '--'}
                    </div>
                  </div>
                  <div className="rounded-[1.5rem] bg-emerald-500/[0.08] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-200">{t('dashboard.labels.dailySpend')}</div>
                    <div className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
                      {tokenSummary ? formatCurrency(tokenSummary.dailySpend) : '--'}
                    </div>
                  </div>
                </div>
                <div className={summaryMetricGridClass}>
                  <div className="rounded-[1.4rem] bg-zinc-950/[0.03] p-4 dark:bg-white/[0.04]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.labels.week')}</div>
                    <div className="mt-2 space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
                      <div>{t('dashboard.values.requestCountShort', { value: formatInteger(tokenSummary?.weeklyRequestCount ?? 0) })}</div>
                      <div>{t('dashboard.values.tokenCountShort', { value: formatTokens(tokenSummary?.weeklyTokenCount ?? 0) })}</div>
                      <div>{formatCurrency(tokenSummary?.weeklySpend ?? 0)}</div>
                    </div>
                  </div>
                  <div className="rounded-[1.4rem] bg-zinc-950/[0.03] p-4 dark:bg-white/[0.04]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.labels.month')}</div>
                    <div className="mt-2 space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
                      <div>{t('dashboard.values.requestCountShort', { value: formatInteger(tokenSummary?.monthlyRequestCount ?? 0) })}</div>
                      <div>{t('dashboard.values.tokenCountShort', { value: formatTokens(tokenSummary?.monthlyTokenCount ?? 0) })}</div>
                      <div>{formatCurrency(tokenSummary?.monthlySpend ?? 0)}</div>
                    </div>
                  </div>
                  <div className="rounded-[1.4rem] bg-zinc-950/[0.03] p-4 dark:bg-white/[0.04]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.labels.year')}</div>
                    <div className="mt-2 space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
                      <div>{t('dashboard.values.requestCountShort', { value: formatInteger(tokenSummary?.yearlyRequestCount ?? 0) })}</div>
                      <div>{t('dashboard.values.tokenCountShort', { value: formatTokens(tokenSummary?.yearlyTokenCount ?? 0) })}</div>
                      <div>{formatCurrency(tokenSummary?.yearlySpend ?? 0)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </DashboardSummaryCard>

            <DashboardSummaryCard
              eyebrow={t('dashboard.metrics.businessConversion.eyebrow')}
              title={t('dashboard.metrics.businessConversion.label')}
              description={t('dashboard.metrics.businessConversion.description')}
              accent={<ShoppingCart className="h-5 w-5 text-amber-500" />}
              changeLabel={businessSummary ? formatSignedPercent(businessSummary.revenueDelta * 0.6) : undefined}
            >
              <div className="grid gap-4">
                <div className={summaryMetricGridClass}>
                  <div className="rounded-[1.5rem] bg-amber-500/[0.08] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-200">{t('dashboard.labels.todayOrders')}</div>
                    <div className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
                      {businessSummary ? formatInteger(businessSummary.todayOrders) : '--'}
                    </div>
                  </div>
                  <div className="rounded-[1.5rem] bg-rose-500/[0.08] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-700 dark:text-rose-200">{t('dashboard.labels.averageOrderValue')}</div>
                    <div className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
                      {businessSummary ? formatCurrency(businessSummary.averageOrderValue) : '--'}
                    </div>
                  </div>
                  <div className="rounded-[1.5rem] bg-cyan-500/[0.08] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-200">{t('dashboard.labels.conversionRate')}</div>
                    <div className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
                      {businessSummary ? formatPercent(businessSummary.conversionRate) : '--'}
                    </div>
                  </div>
                </div>
                <div className={summaryMetricGridClass}>
                  <div className="rounded-[1.4rem] bg-zinc-950/[0.03] p-4 dark:bg-white/[0.04]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.labels.week')}</div>
                    <div className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">{formatInteger(businessSummary?.weekOrders ?? 0)}</div>
                  </div>
                  <div className="rounded-[1.4rem] bg-zinc-950/[0.03] p-4 dark:bg-white/[0.04]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.labels.month')}</div>
                    <div className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">{formatInteger(businessSummary?.monthOrders ?? 0)}</div>
                  </div>
                  <div className="rounded-[1.4rem] bg-zinc-950/[0.03] p-4 dark:bg-white/[0.04]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.labels.year')}</div>
                    <div className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">{formatInteger(businessSummary?.yearOrders ?? 0)}</div>
                  </div>
                </div>
              </div>
            </DashboardSummaryCard>
          </div>

          <div className={analyticsSplitGridClass}>
            {hydratedSections.revenueAnalytics ? (
              <>
                <section className={surfaceClass}>
                  <SectionHeader
                    eyebrow={t('dashboard.metrics.revenue.eyebrow')}
                    title={t('dashboard.sections.revenueTrend')}
                    description={t('dashboard.sections.revenueTrendDescription')}
                    action={
                      <div className="inline-flex max-w-full rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-200">
                        {rangeSummaryLabel}
                      </div>
                    }
                  />
                  <div className="mt-6">
                    {revenueAnalytics ? (
                      <RevenueTrendChart
                        points={revenueAnalytics.revenueTrend}
                        yAxisFormatter={(value) => formatCurrency(value)}
                      />
                    ) : (
                      <div className="flex h-64 items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">--</div>
                    )}
                  </div>
                </section>
                <section className={surfaceClass}>
                  <SectionHeader
                    eyebrow={t('dashboard.metrics.revenue.eyebrow')}
                    title={t('dashboard.sections.revenueDistribution')}
                    description={t('dashboard.sections.revenueDistributionDescription')}
                  />
                  <div className={distributionSplitGridClass}>
                    {revenueAnalytics ? (
                      <DistributionRingChart
                        rows={revenueAnalytics.productBreakdown}
                        sliceClassNames={chartPalette.map((item) => item.sliceClassName)}
                        centerLabel={t('dashboard.table.revenue')}
                        centerValue={formatCurrency(revenueAnalytics.totalRevenue)}
                        ariaLabel={t('dashboard.charts.revenueDistribution')}
                        valueAccessor={(row) => row.revenue}
                      />
                    ) : (
                      <div className="flex min-h-[20rem] items-center justify-center rounded-[1.6rem] border border-dashed border-zinc-300/80 bg-white/60 text-sm text-zinc-500 dark:border-zinc-700/70 dark:bg-zinc-950/35 dark:text-zinc-400">--</div>
                    )}
                    <div className="min-w-0 overflow-hidden rounded-[1.5rem] border border-zinc-200/70 dark:border-white/6">
                      <div className={tableScrollClass}>
                        <table className="w-full min-w-[40rem] border-collapse text-left">
                          <thead className="bg-zinc-50/80 dark:bg-zinc-900/85">
                            <tr>
                              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.table.productName')}</th>
                              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.table.orders')}</th>
                              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.table.revenue')}</th>
                              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.labels.shareOfTotal')}</th>
                              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.table.dailyRevenue')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-200/70 dark:divide-white/6">
                            {revenueAnalytics?.productBreakdown.map((row, index) => (
                              <tr key={row.id} className="bg-white/70 dark:bg-zinc-950/35">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    <span className={`h-2.5 w-2.5 rounded-full ${chartPalette[index % chartPalette.length].dotClassName}`} />
                                    <span className="font-semibold text-zinc-950 dark:text-zinc-50">{row.productName}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">{formatInteger(row.orders)}</td>
                                <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">{formatCurrency(row.revenue)}</td>
                                <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">{formatPercent(row.share)}</td>
                                <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">{formatCurrency(row.dailyRevenue)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </section>
              </>
            ) : (
              <>
                <DeferredDashboardSurface
                  eyebrow={t('dashboard.metrics.revenue.eyebrow')}
                  title={t('dashboard.sections.revenueTrend')}
                  description={t('dashboard.sections.revenueTrendDescription')}
                />
                <DeferredDashboardSurface
                  eyebrow={t('dashboard.metrics.revenue.eyebrow')}
                  title={t('dashboard.sections.revenueDistribution')}
                  description={t('dashboard.sections.revenueDistributionDescription')}
                  minHeightClass="min-h-[20rem]"
                />
              </>
            )}
          </div>

          <div className={analyticsSplitGridClass}>
            {hydratedSections.tokenAnalytics ? (
              <>
                <section className={surfaceClass}>
                  <SectionHeader
                    eyebrow={t('dashboard.metrics.tokenUsage.eyebrow')}
                    title={t('dashboard.sections.tokenIntelligence')}
                    description={t('dashboard.sections.tokenIntelligenceDescription')}
                  />
                  <div className="mt-6">
                    {tokenAnalytics ? (
                      <TokenTrendChart
                        points={tokenAnalytics.usageTrend}
                        series={chartSeries}
                        controls={{
                          granularity,
                          onGranularityChange: setGranularity,
                          rangeMode,
                          onRangeModeChange: setRangeMode,
                          monthKey,
                          monthOptions,
                          onMonthKeyChange: setMonthKey,
                          customStart,
                          customEnd,
                          onCustomStartChange: setCustomStart,
                          onCustomEndChange: setCustomEnd,
                        }}
                        yAxisFormatter={(value) => formatTokens(value)}
                      />
                    ) : (
                      <div className="flex h-64 items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">--</div>
                    )}
                  </div>
                </section>
                <section className={surfaceClass}>
                  <SectionHeader
                    eyebrow={t('dashboard.metrics.tokenUsage.eyebrow')}
                    title={t('dashboard.sections.modelDistribution')}
                    description={t('dashboard.sections.modelDistributionDescription')}
                  />
                  <div className={distributionSplitGridClass}>
                    {tokenAnalytics ? (
                      <ModelDistributionChart
                        rows={tokenAnalytics.modelBreakdown}
                        sliceClassNames={chartPalette.map((item) => item.sliceClassName)}
                        centerLabel={t('dashboard.table.requestCount')}
                        centerValue={formatInteger(tokenAnalytics.totalRequestCount)}
                      />
                    ) : (
                      <div className="flex min-h-[20rem] items-center justify-center rounded-[1.6rem] border border-dashed border-zinc-300/80 bg-white/60 text-sm text-zinc-500 dark:border-zinc-700/70 dark:bg-zinc-950/35 dark:text-zinc-400">--</div>
                    )}
                    <div className="min-w-0 overflow-hidden rounded-[1.5rem] border border-zinc-200/70 dark:border-white/6">
                      <div className={tableScrollClass}>
                        <table className="w-full min-w-[44rem] border-collapse text-left">
                          <thead className="bg-zinc-50/80 dark:bg-zinc-900/85">
                            <tr>
                              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.table.modelName')}</th>
                              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.table.requestCount')}</th>
                              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.table.token')}</th>
                              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.table.actualAmount')}</th>
                              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.table.standardAmount')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-200/70 dark:divide-white/6">
                            {tokenAnalytics?.modelBreakdown.map((row, index) => (
                              <tr key={row.id} className="bg-white/70 dark:bg-zinc-950/35">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    <span className={`h-2.5 w-2.5 rounded-full ${chartPalette[index % chartPalette.length].dotClassName}`} />
                                    <div>
                                      <div className="font-semibold text-zinc-950 dark:text-zinc-50">{row.modelName}</div>
                                      <div className="text-xs text-zinc-500 dark:text-zinc-400">{formatPercent(row.share)}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">{formatInteger(row.requestCount)}</td>
                                <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">{formatTokens(row.tokens)}</td>
                                <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">{formatCurrency(row.actualAmount)}</td>
                                <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">{formatCurrency(row.standardAmount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </section>
              </>
            ) : (
              <>
                <DeferredDashboardSurface
                  eyebrow={t('dashboard.metrics.tokenUsage.eyebrow')}
                  title={t('dashboard.sections.tokenIntelligence')}
                  description={t('dashboard.sections.tokenIntelligenceDescription')}
                />
                <DeferredDashboardSurface
                  eyebrow={t('dashboard.metrics.tokenUsage.eyebrow')}
                  title={t('dashboard.sections.modelDistribution')}
                  description={t('dashboard.sections.modelDistributionDescription')}
                  minHeightClass="min-h-[20rem]"
                />
              </>
            )}
          </div>

          {hydratedSections.activityWorkbench ? (
            <section className={surfaceClass}>
              <SectionHeader
                eyebrow={t('dashboard.sections.activityWorkbench')}
                title={t('dashboard.sections.activityWorkbench')}
                description={t('dashboard.sections.activityWorkbenchDescription')}
              />

              <div className="mt-6 flex flex-wrap gap-2">
              {[
                { id: 'api' as const, label: t('dashboard.tabs.recentApiCalls') },
                { id: 'revenue' as const, label: t('dashboard.tabs.recentRevenueRecords') },
                { id: 'products' as const, label: t('dashboard.tabs.productPerformance') },
                { id: 'alerts' as const, label: t('dashboard.tabs.alerts') },
              ].map((tab) => {
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                      isActive
                        ? 'bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

              <div className="mt-6">
              {activeTab === 'api' ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'all' as const, label: t('dashboard.filters.all') },
                      { id: 'success' as const, label: t('dashboard.filters.success') },
                      { id: 'failed' as const, label: t('dashboard.filters.failed') },
                    ].map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setApiStatusFilter(option.id)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] transition-colors ${
                          apiStatusFilter === option.id
                            ? 'bg-primary-500 text-white'
                            : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  <div className="overflow-hidden rounded-[1.5rem] border border-zinc-200/70 dark:border-white/6">
                    <div className={tableScrollClass}>
                      <table className="w-full min-w-[72rem] border-collapse text-left">
                        <thead className="bg-zinc-50/80 dark:bg-zinc-900/85">
                          <tr>
                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.table.time')}</th>
                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.table.modelName')}</th>
                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.table.providerName')}</th>
                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.table.endpoint')}</th>
                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.table.requestCount')}</th>
                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.table.token')}</th>
                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.table.costAmount')}</th>
                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.table.latency')}</th>
                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.table.status')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200/70 dark:divide-white/6">
                          {apiRecords.map((row) => (
                            <tr key={row.id} className="bg-white/70 dark:bg-zinc-950/35">
                              <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">{formatTimestamp(row.timestamp)}</td>
                              <td className="px-4 py-3 font-semibold text-zinc-950 dark:text-zinc-50">{row.modelName}</td>
                              <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">{row.providerName}</td>
                              <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">{row.endpoint}</td>
                              <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">{formatInteger(row.requestCount)}</td>
                              <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">{formatTokens(row.tokenCount)}</td>
                              <td className="px-4 py-3 text-sm font-semibold text-zinc-950 dark:text-zinc-50">{formatCurrency(row.costAmount)}</td>
                              <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">
                                {t('dashboard.values.milliseconds', {
                                  value: formatInteger(row.latencyMs),
                                })}
                              </td>
                              <td className="px-4 py-3">
                                <StatusPill label={t(`dashboard.status.${row.status}`)} tone={getApiStatusTone(row.status)} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : null}

              {activeTab === 'revenue' ? (
                <div className="overflow-hidden rounded-[1.5rem] border border-zinc-200/70 dark:border-white/6">
                  <div className={tableScrollClass}>
                    <table className="w-full min-w-[60rem] border-collapse text-left">
                      <thead className="bg-zinc-50/80 dark:bg-zinc-900/85">
                        <tr>
                          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.table.time')}</th>
                          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.table.productName')}</th>
                          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.table.orderNo')}</th>
                          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.table.revenue')}</th>
                          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.table.channel')}</th>
                          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.table.status')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200/70 dark:divide-white/6">
                        {activityFeed?.recentRevenueRecords.map((row) => (
                          <tr key={row.id} className="bg-white/70 dark:bg-zinc-950/35">
                            <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">{formatTimestamp(row.timestamp)}</td>
                            <td className="px-4 py-3 font-semibold text-zinc-950 dark:text-zinc-50">{row.productName}</td>
                            <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">{row.orderNo}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-zinc-950 dark:text-zinc-50">{formatCurrency(row.revenueAmount)}</td>
                            <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">{row.channel}</td>
                            <td className="px-4 py-3">
                              <StatusPill label={t(`dashboard.status.${row.status}`)} tone={getRevenueStatusTone(row.status)} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {activeTab === 'products' ? (
                <div className="overflow-hidden rounded-[1.5rem] border border-zinc-200/70 dark:border-white/6">
                  <div className={tableScrollClass}>
                    <table className="w-full min-w-[48rem] border-collapse text-left">
                      <thead className="bg-zinc-50/80 dark:bg-zinc-900/85">
                        <tr>
                          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.table.productName')}</th>
                          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.table.revenue')}</th>
                          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.table.orders')}</th>
                          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.labels.shareOfTotal')}</th>
                          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.table.trendDelta')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200/70 dark:divide-white/6">
                        {activityFeed?.productPerformance.map((row) => (
                          <tr key={row.id} className="bg-white/70 dark:bg-zinc-950/35">
                            <td className="px-4 py-3 font-semibold text-zinc-950 dark:text-zinc-50">{row.productName}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-zinc-950 dark:text-zinc-50">{formatCurrency(row.revenue)}</td>
                            <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">{formatInteger(row.orders)}</td>
                            <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">{formatPercent(row.share)}</td>
                            <td className={`px-4 py-3 text-sm font-semibold ${getDeltaTone(row.trendDelta)}`}>{formatSignedPercent(row.trendDelta)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {activeTab === 'alerts' ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {activityFeed?.alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="rounded-[1.5rem] border border-zinc-200/70 bg-zinc-50/70 p-5 dark:border-white/6 dark:bg-zinc-950/35"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <StatusPill label={t(`dashboard.severity.${alert.severity}`)} tone={getAlertTone(alert.severity)} />
                        <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{alert.value}</div>
                      </div>
                      <h3 className="mt-4 text-base font-semibold text-zinc-950 dark:text-zinc-50">{alert.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{alert.description}</p>
                    </div>
                  ))}
                </div>
              ) : null}
              </div>
            </section>
          ) : (
            <DeferredDashboardSurface
              eyebrow={t('dashboard.sections.activityWorkbench')}
              title={t('dashboard.sections.activityWorkbench')}
              description={t('dashboard.sections.activityWorkbenchDescription')}
              minHeightClass="min-h-[28rem]"
            />
          )}

          {error ? (
            <div className="flex items-center gap-3 rounded-[1.5rem] border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
              <TriangleAlert className="h-4 w-4" />
              {error}
            </div>
          ) : null}

          {isLoading ? (
            <div className="flex items-center gap-3 rounded-[1.5rem] border border-primary-500/15 bg-primary-500/10 px-4 py-3 text-sm text-primary-700 dark:text-primary-200">
              <RefreshCw className="h-4 w-4 animate-spin" />
              {t('common.loading')}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
