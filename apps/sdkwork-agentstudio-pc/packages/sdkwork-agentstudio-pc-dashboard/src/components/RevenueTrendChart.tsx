import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DashboardRevenueTrendPoint } from '../types';

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

export function RevenueTrendChart({
  points = [],
  yAxisFormatter = (value) => `${value}`,
}: {
  points?: DashboardRevenueTrendPoint[];
  yAxisFormatter?: (value: number) => string;
}) {
  const { t, i18n } = useTranslation();
  const chartFrameRef = useRef<HTMLDivElement | null>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 0 }),
    [i18n.language],
  );

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

  const hasRenderableData = points.length > 0;
  const width = Math.max(chartWidth, 320);
  const height = width < 520 ? 320 : 352;
  const paddingTop = 18;
  const paddingBottom = width < 520 ? 34 : 38;
  const chartPaddingX = width < 520 ? 12 : 16;
  const yAxisLabelWidth = width < 520 ? 36 : 42;
  const plotLeft = chartPaddingX + yAxisLabelWidth;
  const plotRight = width - chartPaddingX;
  const usableWidth = plotRight - plotLeft;
  const usableHeight = height - paddingTop - paddingBottom;
  const maxValue = hasRenderableData ? Math.max(...points.map((point) => point.revenue), 1) : 1;
  const xAxisStep = usableWidth / Math.max(points.length - 1, 1);
  const coordinates = hasRenderableData
    ? points.map((point, index) => ({
        point,
        x: plotLeft + xAxisStep * index,
        y: paddingTop + usableHeight - (Math.max(point.revenue, 0) / maxValue) * usableHeight,
      }))
    : [];
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
  const linePath = buildLinePath(coordinates);
  const areaPath = buildAreaPath(coordinates, height - paddingBottom);
  const lastPoint = coordinates[coordinates.length - 1];
  const peakRevenue = hasRenderableData
    ? points.reduce((currentPeak, point) => {
        return point.revenue > currentPeak.revenue ? point : currentPeak;
      }, points[0])
    : null;

  return (
    <div className="overflow-hidden rounded-[1.6rem] border border-white/70 bg-white/65 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] dark:border-white/6 dark:bg-zinc-950/35">
      <div className="mx-4 mb-4 mt-4 flex flex-col gap-3 rounded-[1.4rem] border border-zinc-200/70 bg-zinc-50/85 px-4 py-3 sm:flex-row sm:items-start sm:justify-between dark:border-white/6 dark:bg-white/[0.04]">
        <div className="flex min-w-0 items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
              {t('dashboard.charts.revenueTrend')}
            </div>
            <div className="mt-1 text-sm font-medium leading-5 text-zinc-700 dark:text-zinc-200">
              {t('dashboard.labels.totalOrders')}: {numberFormatter.format(points.reduce((sum, point) => sum + point.orders, 0))}
            </div>
          </div>
        </div>
        {peakRevenue ? (
          <div className="max-w-full rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-200">
            {t('dashboard.labels.peakRevenue')} {peakRevenue.label}
          </div>
        ) : null}
      </div>

      {hasRenderableData ? (
        <div ref={chartFrameRef} className="w-full">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-[20rem] w-full sm:h-[22rem]"
            role="img"
            aria-label={t('dashboard.charts.revenueTrend')}
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

            <g className="text-emerald-500">
              <path d={areaPath} fill="currentColor" className="opacity-12" />
              <path
                d={linePath}
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3.2}
              />
            </g>

            {coordinates.map((coordinate, index) => (
              <circle
                key={`${coordinate.point.bucketKey}-${index}`}
                cx={coordinate.x}
                cy={coordinate.y}
                r={index === coordinates.length - 1 ? 5 : 3.5}
                fill="rgb(16 185 129)"
                className={index === coordinates.length - 1 ? 'drop-shadow-[0_0_10px_rgba(16,185,129,0.32)]' : ''}
              />
            ))}

            {lastPoint ? (
              <text
                x={Math.min(lastPoint.x + 10, width - 90)}
                y={Math.max(lastPoint.y - 12, paddingTop + 12)}
                className="fill-emerald-600 text-[12px] font-semibold dark:fill-emerald-300"
              >
                {yAxisFormatter(lastPoint.point.revenue)}
              </text>
            ) : null}
          </svg>
        </div>
      ) : (
        <div className="flex h-[22rem] items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
          {t('dashboard.charts.noRevenueTrendData')}
        </div>
      )}
    </div>
  );
}
