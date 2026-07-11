import type { DashboardTokenModelBreakdown } from '../types';
import { useTranslation } from 'react-i18next';
import { DistributionRingChart } from './DistributionRingChart';

export function ModelDistributionChart({
  rows,
  sliceClassNames,
  centerLabel,
  centerValue,
}: {
  rows: DashboardTokenModelBreakdown[];
  sliceClassNames: string[];
  centerLabel: string;
  centerValue: string;
}) {
  const { t } = useTranslation();

  return (
    <DistributionRingChart
      rows={rows}
      sliceClassNames={sliceClassNames}
      centerLabel={centerLabel}
      centerValue={centerValue}
      ariaLabel={t('dashboard.charts.modelDistribution')}
      valueAccessor={(row) => row.tokens}
    />
  );
}
