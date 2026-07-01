import type { LocalAiProxyRequestLogRecord } from '@sdkwork/claw-types';

export const REQUESTS_PAGE_PARAM = 'apiRequestsPage';
export const REQUESTS_PAGE_SIZE_PARAM = 'apiRequestsPageSize';
export const REQUESTS_SEARCH_PARAM = 'apiRequestsSearch';
export const MESSAGES_PAGE_PARAM = 'apiMessagesPage';
export const MESSAGES_PAGE_SIZE_PARAM = 'apiMessagesPageSize';
export const MESSAGES_SEARCH_PARAM = 'apiMessagesSearch';
export const API_SECTION_PARAM = 'apiSection';
export const API_LOGS_TAB_PARAM = 'apiLogsTab';
export const PAGE_SIZE_OPTIONS = [20, 50, 100];
export const DEFAULT_API_SECTION_LABELS = {
  providers: 'Provider Center',
  requests: 'Request Logs',
  messages: 'Message Records',
} as const;

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

export function normalizePositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function normalizePageSize(value: string | null, fallback: number) {
  const parsed = normalizePositiveInt(value, fallback);
  return PAGE_SIZE_OPTIONS.includes(parsed) ? parsed : fallback;
}

export function formatDateTime(value?: number | null) {
  if (!Number.isFinite(value ?? NaN)) {
    return '--';
  }

  return DATE_TIME_FORMATTER.format(new Date(Number(value)));
}

export function formatDuration(value?: number | null) {
  if (!Number.isFinite(value ?? NaN)) {
    return '--';
  }

  const normalized = Number(value);
  if (normalized < 1_000) {
    return `${normalized} ms`;
  }

  return `${(normalized / 1_000).toFixed(2)} s`;
}

export function formatCount(value?: number | null) {
  if (!Number.isFinite(value ?? NaN)) {
    return '--';
  }

  return new Intl.NumberFormat().format(Number(value));
}

export function formatRequestTokenSummary(
  record: LocalAiProxyRequestLogRecord,
  labels: Record<'total' | 'input' | 'output' | 'cache', string>,
) {
  return [
    `${labels.total}: ${formatCount(record.totalTokens)}`,
    `${labels.input}: ${formatCount(record.promptTokens ?? record.inputTokens)}`,
    `${labels.output}: ${formatCount(record.completionTokens ?? record.outputTokens)}`,
    `${labels.cache}: ${formatCount(record.cacheTokens)}`,
  ].join(' / ');
}

export function resolveStatusToneClassName(status: LocalAiProxyRequestLogRecord['status']) {
  return status === 'succeeded'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300'
    : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300';
}

export function translateOrFallback(
  translate: (key: string, options?: Record<string, unknown>) => string,
  key: string,
  fallback: string,
) {
  const value = translate(key);
  return value === key ? fallback : value;
}
