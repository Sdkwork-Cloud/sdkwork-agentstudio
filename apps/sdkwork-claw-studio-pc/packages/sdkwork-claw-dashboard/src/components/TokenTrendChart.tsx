import { useEffect, useRef, useState } from 'react';
import { CalendarRange, ChevronRight } from 'lucide-react';
import type {
  DashboardAnalyticsGranularity,
  DashboardAnalyticsRangeMode,
  DashboardTokenTrendPoint,
} from '../types';
import { useTranslation } from 'react-i18next';
import {
  Button,
  DateInput,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sdkwork/claw-ui';

export type TokenTrendSeriesKey =
  | 'totalTokens'
  | 'inputTokens'
  | 'outputTokens'
  | 'cacheCreationTokens'
  | 'cacheReadTokens';

export interface TokenTrendSeries {
  key: TokenTrendSeriesKey;
  label: string;
  dotClassName: string;
  strokeClassName: string;
}

export interface TokenTrendChartControls {
  granularity: DashboardAnalyticsGranularity;
  onGranularityChange: (value: DashboardAnalyticsGranularity) => void;
  rangeMode: DashboardAnalyticsRangeMode;
  onRangeModeChange: (value: DashboardAnalyticsRangeMode) => void;
  monthKey: string;
  monthOptions: string[];
  onMonthKeyChange: (value: string) => void;
  customStart: string;
  customEnd: string;
  onCustomStartChange: (value: string) => void;
  onCustomEndChange: (value: string) => void;
}

function buildLinePath(points: Array<{ x: number; y: number }>) {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');
}

function buildAreaPath(points: Array<{ x: number; y: number }>, baseline: number) {
  if (points.length === 0) {
    return '';
  }

  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];
  const linePath = buildLinePath(points);

  return `${linePath} L ${lastPoint.x.toFixed(2)} ${baseline.toFixed(2)} L ${firstPoint.x.toFixed(2)} ${baseline.toFixed(2)} Z`;
}

function getSeriesValue(point: DashboardTokenTrendPoint, key: TokenTrendSeriesKey) {
  return point[key];
}

export function TokenTrendChart({
  points = [],
  series = [],
  controls,
  yAxisFormatter = (value) => `${value}`,
}: {
  points?: DashboardTokenTrendPoint[];
  series?: TokenTrendSeries[];
  controls?: TokenTrendChartControls;
  yAxisFormatter?: (value: number) => string;
}) {
  const { t } = useTranslation();
  const chartFrameRef = useRef<HTMLDivElement | null>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const [isRangeDialogOpen, setIsRangeDialogOpen] = useState(false);
  const [draftRangeMode, setDraftRangeMode] =
    useState<DashboardAnalyticsRangeMode>('seven_days');
  const [draftMonthKey, setDraftMonthKey] = useState('');
  const [draftCustomStart, setDraftCustomStart] = useState('');
  const [draftCustomEnd, setDraftCustomEnd] = useState('');

  useEffect(() => {
    const frame = chartFrameRef.current;
    if (!frame) {
      return;
    }

    const syncWidth = (nextWidth: number) => {
      const roundedWidth = Math.round(nextWidth);
      setChartWidth((currentWidth) => (currentWidth === roundedWidth ? currentWidth : roundedWidth));
    };

    syncWidth(frame.clientWidth);

    if (typeof ResizeObserver === 'undefined') {
      const handleResize = () => syncWidth(frame.clientWidth);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        syncWidth(entry.contentRect.width);
      }
    });

    observer.observe(frame);

    return () => observer.disconnect();
  }, []);

  const selectedRangeLabel = controls
    ? controls.rangeMode === 'month'
      ? `${t('dashboard.filters.month')} ${controls.monthKey}`
      : controls.rangeMode === 'custom'
        ? `${controls.customStart} - ${controls.customEnd}`
        : t('dashboard.filters.sevenDays')
    : null;
  const granularityLabel = controls
    ? controls.granularity === 'hour'
      ? t('dashboard.filters.hour')
      : t('dashboard.filters.day')
    : null;
  const rangeSummaryLabel =
    controls && granularityLabel && selectedRangeLabel
      ? t('dashboard.labels.rangeSummary', {
          granularity: granularityLabel,
          range: selectedRangeLabel,
        })
      : null;
  const rangeModeOptions: Array<{
    value: DashboardAnalyticsRangeMode;
    label: string;
    description: string;
  }> = [
    {
      value: 'seven_days',
      label: t('dashboard.filters.sevenDays'),
      description: t('dashboard.filters.sevenDaysHint'),
    },
    {
      value: 'month',
      label: t('dashboard.filters.month'),
      description: t('dashboard.filters.monthHint'),
    },
    {
      value: 'custom',
      label: t('dashboard.filters.custom'),
      description: t('dashboard.filters.customHint'),
    },
  ];
  const hasRenderableData = points.length > 0 && series.length > 0;
  const hasInvalidCustomRange =
    draftRangeMode === 'custom' &&
    Boolean(draftCustomStart) &&
    Boolean(draftCustomEnd) &&
    draftCustomStart > draftCustomEnd;
  const isApplyDisabled =
    draftRangeMode === 'custom' &&
    (!draftCustomStart || !draftCustomEnd || hasInvalidCustomRange);

  useEffect(() => {
    if (!controls || isRangeDialogOpen) {
      return;
    }

    setDraftRangeMode(controls.rangeMode);
    setDraftMonthKey(controls.monthKey || controls.monthOptions[0] || '');
    setDraftCustomStart(controls.customStart);
    setDraftCustomEnd(controls.customEnd);
  }, [
    controls,
    controls?.customEnd,
    controls?.customStart,
    controls?.monthKey,
    controls?.monthOptions,
    controls?.rangeMode,
    isRangeDialogOpen,
  ]);

  const width = Math.max(chartWidth, 320);
  const height = width < 520 ? 320 : 352;
  const paddingTop = 18;
  const paddingBottom = width < 520 ? 34 : 38;
  const chartPaddingX = width < 520 ? 12 : 16;
  const yAxisLabelWidth = width < 520 ? 32 : 36;
  const plotLeft = chartPaddingX + yAxisLabelWidth;
  const plotRight = width - chartPaddingX;
  const usableWidth = plotRight - plotLeft;
  const usableHeight = height - paddingTop - paddingBottom;
  const maxValue = hasRenderableData
    ? Math.max(...series.flatMap((item) => points.map((point) => getSeriesValue(point, item.key))), 1)
    : 1;
  const xAxisStep = usableWidth / Math.max(points.length - 1, 1);
  const yForValue = (value: number) =>
    paddingTop + usableHeight - (Math.max(value, 0) / maxValue) * usableHeight;
  const coordinatesBySeries = (
    hasRenderableData
      ? Object.fromEntries(
          series.map((item) => [
            item.key,
            points.map((point, index) => ({
              point,
              x: plotLeft + xAxisStep * index,
              y: yForValue(getSeriesValue(point, item.key)),
            })),
          ]),
        )
      : {}
  ) as Record<TokenTrendSeriesKey, Array<{ point: DashboardTokenTrendPoint; x: number; y: number }>>;
  const yAxisTicks = Array.from({ length: 5 }, (_, index) => {
    const ratio = 1 - index / 4;
    return Math.round(maxValue * ratio);
  });
  const targetXAxisLabelCount = width < 520 ? 4 : width < 760 ? 6 : 8;
  const labelStep = Math.max(1, Math.ceil(points.length / targetXAxisLabelCount));
  const xAxisIndices = hasRenderableData
    ? Array.from(
        new Set(
          points
            .map((_, index) => index)
            .filter(
              (index) => index === 0 || index === points.length - 1 || index % labelStep === 0,
            ),
        ),
      )
    : [];
  const totalSeriesPoints = coordinatesBySeries.totalTokens ?? [];
  const totalAreaPath = buildAreaPath(totalSeriesPoints, height - paddingBottom);

  const openRangeDialog = () => {
    if (!controls) {
      return;
    }

    setDraftRangeMode(controls.rangeMode);
    setDraftMonthKey(controls.monthKey || controls.monthOptions[0] || '');
    setDraftCustomStart(controls.customStart);
    setDraftCustomEnd(controls.customEnd);
    setIsRangeDialogOpen(true);
  };

  const applyRangeConfig = () => {
    if (!controls || isApplyDisabled) {
      return;
    }

    controls.onRangeModeChange(draftRangeMode);

    if (draftRangeMode === 'month') {
      controls.onMonthKeyChange(draftMonthKey || controls.monthOptions[0] || controls.monthKey);
    }

    if (draftRangeMode === 'custom') {
      controls.onCustomStartChange(draftCustomStart);
      controls.onCustomEndChange(draftCustomEnd);
    }

    setIsRangeDialogOpen(false);
  };

  return (
    <div className="overflow-hidden rounded-[1.6rem] border border-white/70 bg-white/65 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] dark:border-white/6 dark:bg-zinc-950/35">
      {controls ? (
        <div className="mx-4 mb-5 mt-4 rounded-[1.4rem] border border-zinc-200/70 bg-zinc-50/85 p-4 dark:border-white/6 dark:bg-white/[0.04]">
          <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-end 2xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                {t('dashboard.charts.tokenUsageTrend')}
              </div>
              <div className="mt-1 text-sm font-medium leading-5 text-zinc-700 dark:text-zinc-200">
                {rangeSummaryLabel}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end xl:flex-nowrap 2xl:shrink-0">
              <div className="min-w-0 sm:min-w-[11rem] sm:flex-1 xl:w-44 xl:flex-none">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                  {t('dashboard.filters.granularity')}
                </Label>
                <Select
                  value={controls.granularity}
                  onValueChange={(value) =>
                    controls.onGranularityChange(value as DashboardAnalyticsGranularity)
                  }
                >
                  <SelectTrigger className="mt-2 h-11 w-full rounded-2xl border-zinc-200/80 bg-white/90 px-3 text-sm dark:border-white/8 dark:bg-zinc-950/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">{t('dashboard.filters.day')}</SelectItem>
                    <SelectItem value="hour">{t('dashboard.filters.hour')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="min-w-0 sm:min-w-[14rem] sm:flex-1 xl:w-56 xl:flex-none">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                  {t('dashboard.filters.range')}
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  onClick={openRangeDialog}
                  className="mt-2 h-11 w-full justify-between rounded-2xl border-zinc-200/80 bg-white/90 px-3 text-sm hover:bg-zinc-50 dark:border-white/8 dark:bg-zinc-950/50 dark:hover:bg-zinc-900"
                >
                  <span className="flex min-w-0 items-center gap-2.5 text-left">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-300">
                      <CalendarRange className="h-4 w-4" />
                    </span>
                    <span className="truncate text-sm font-medium text-zinc-950 dark:text-zinc-100">
                      {selectedRangeLabel}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />
                  <span className="sr-only">{t('dashboard.filters.configureRange')}</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <Dialog open={isRangeDialogOpen} onOpenChange={setIsRangeDialogOpen}>
        <DialogContent className="max-w-[34rem] rounded-[2rem] border border-zinc-200/80 bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
          <DialogHeader>
            <DialogTitle>{t('dashboard.filters.rangeDialogTitle')}</DialogTitle>
            <DialogDescription>{t('dashboard.filters.rangeDialogDescription')}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-3">
            {rangeModeOptions.map((option) => {
              const isActive = draftRangeMode === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setDraftRangeMode(option.value)}
                  className={`rounded-[1.4rem] border px-4 py-4 text-left transition-colors ${
                    isActive
                      ? 'border-primary-300 bg-primary-50/80 shadow-sm dark:border-primary-500/40 dark:bg-primary-500/10'
                      : 'border-zinc-200/80 bg-zinc-50/75 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950/40 dark:hover:bg-zinc-900'
                  }`}
                >
                  <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">
                    {option.label}
                  </div>
                  <div className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                    {option.description}
                  </div>
                </button>
              );
            })}
          </div>

          {draftRangeMode === 'month' ? (
            <div className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                {t('dashboard.filters.month')}
              </Label>
              <Select value={draftMonthKey} onValueChange={setDraftMonthKey}>
                <SelectTrigger className="h-auto rounded-2xl border-zinc-200/80 bg-white/90 py-3 dark:border-white/8 dark:bg-zinc-950/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {controls?.monthOptions.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {draftRangeMode === 'custom' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                  {t('dashboard.filters.customStart')}
                </Label>
                <DateInput
                  calendarLabel={t('dashboard.filters.customStart')}
                  value={draftCustomStart}
                  onChange={(event) => setDraftCustomStart(event.target.value)}
                  className="h-auto rounded-2xl border-zinc-200/80 bg-white/90 py-3 dark:border-white/8 dark:bg-zinc-950/50"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                  {t('dashboard.filters.customEnd')}
                </Label>
                <DateInput
                  calendarLabel={t('dashboard.filters.customEnd')}
                  value={draftCustomEnd}
                  onChange={(event) => setDraftCustomEnd(event.target.value)}
                  className="h-auto rounded-2xl border-zinc-200/80 bg-white/90 py-3 dark:border-white/8 dark:bg-zinc-950/50"
                />
              </div>
            </div>
          ) : null}

          {hasInvalidCustomRange ? (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-200">
              {t('dashboard.filters.invalidCustomRange')}
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setIsRangeDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={applyRangeConfig} disabled={isApplyDisabled}>
              {t('dashboard.filters.applyRange')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {hasRenderableData ? (
        <div ref={chartFrameRef} className="w-full">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-[20rem] w-full sm:h-[22rem]"
            role="img"
            aria-label={t('dashboard.charts.tokenUsageTrend')}
          >
            {yAxisTicks.map((value, index) => {
              const y = paddingTop + (usableHeight / Math.max(yAxisTicks.length - 1, 1)) * index;

              return (
                <g key={`${value}-${index}`}>
                  <line
                    x1={plotLeft}
                    y1={y}
                    x2={plotRight}
                    y2={y}
                    className="stroke-zinc-200/90 dark:stroke-zinc-800/85"
                    strokeDasharray="4 8"
                  />
                  <text
                    x={plotLeft - 12}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-zinc-400 text-[11px] font-medium dark:fill-zinc-500"
                  >
                    {yAxisFormatter(value)}
                  </text>
                </g>
              );
            })}

            {xAxisIndices.map((index) => {
              const point = points[index];
              const x = plotLeft + xAxisStep * index;

              return (
                <g key={point.bucketKey}>
                  <line
                    x1={x}
                    y1={paddingTop}
                    x2={x}
                    y2={height - paddingBottom}
                    className="stroke-zinc-100 dark:stroke-zinc-900"
                  />
                  <text
                    x={x}
                    y={height - 8}
                    textAnchor="middle"
                    className="fill-zinc-400 text-[11px] font-medium dark:fill-zinc-500"
                  >
                    {point.label}
                  </text>
                </g>
              );
            })}

            <g className="text-primary-500">
              <path d={totalAreaPath} fill="currentColor" className="opacity-10" />
            </g>

            {series.map((item) => {
              const coordinates = coordinatesBySeries[item.key];
              const linePath = buildLinePath(coordinates);
              const lastPoint = coordinates[coordinates.length - 1];

              return (
                <g key={item.key} className={item.strokeClassName}>
                  <path
                    d={linePath}
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={item.key === 'totalTokens' ? 3.2 : 2.2}
                  />
                  <circle
                    cx={lastPoint.x}
                    cy={lastPoint.y}
                    r={item.key === 'totalTokens' ? 5 : 4}
                    fill="currentColor"
                    className="drop-shadow-[0_0_10px_rgba(15,23,42,0.14)]"
                  />
                  <circle
                    cx={lastPoint.x}
                    cy={lastPoint.y}
                    r={item.key === 'totalTokens' ? 2.4 : 1.6}
                    className="fill-white dark:fill-zinc-950"
                  />
                </g>
              );
            })}
          </svg>
        </div>
      ) : (
        <div className="flex h-[22rem] items-center justify-center rounded-[1.5rem] border border-dashed border-zinc-300/80 bg-white/60 text-sm text-zinc-500 dark:border-zinc-700/70 dark:bg-zinc-950/35 dark:text-zinc-400">
          {t('dashboard.charts.noTokenTrendData')}
        </div>
      )}
    </div>
  );
}
