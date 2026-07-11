import { getIntlLocale } from './config.ts';

function asDate(value: Date | number | string) {
  return value instanceof Date ? value : new Date(value);
}

export function formatDate(
  value: Date | number | string,
  language?: string | null,
  options?: Intl.DateTimeFormatOptions,
) {
  return new Intl.DateTimeFormat(getIntlLocale(language), options).format(asDate(value));
}

export function formatTime(
  value: Date | number | string,
  language?: string | null,
  options?: Intl.DateTimeFormatOptions,
) {
  return new Intl.DateTimeFormat(getIntlLocale(language), {
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  }).format(asDate(value));
}

export function formatNumber(
  value: number,
  language?: string | null,
  options?: Intl.NumberFormatOptions,
) {
  return new Intl.NumberFormat(getIntlLocale(language), options).format(value);
}

export function formatCurrency(
  value: number,
  language?: string | null,
  currency = 'USD',
  options?: Omit<Intl.NumberFormatOptions, 'currency' | 'style'>,
) {
  return new Intl.NumberFormat(getIntlLocale(language), {
    style: 'currency',
    currency,
    ...options,
  }).format(value);
}

const relativeTimeDivisions: Array<{
  amount: number;
  unit: Intl.RelativeTimeFormatUnit;
}> = [
  { amount: 60, unit: 'second' },
  { amount: 60, unit: 'minute' },
  { amount: 24, unit: 'hour' },
  { amount: 7, unit: 'day' },
  { amount: 4.34524, unit: 'week' },
  { amount: 12, unit: 'month' },
  { amount: Number.POSITIVE_INFINITY, unit: 'year' },
];

export function formatRelativeTime(
  value: Date | number | string,
  language?: string | null,
  now: Date | number | string = Date.now(),
) {
  const formatter = new Intl.RelativeTimeFormat(getIntlLocale(language), {
    numeric: 'auto',
  });
  let delta = (asDate(value).getTime() - asDate(now).getTime()) / 1000;

  for (const division of relativeTimeDivisions) {
    if (Math.abs(delta) < division.amount) {
      return formatter.format(Math.round(delta), division.unit);
    }

    delta /= division.amount;
  }

  return formatter.format(Math.round(delta), 'year');
}
