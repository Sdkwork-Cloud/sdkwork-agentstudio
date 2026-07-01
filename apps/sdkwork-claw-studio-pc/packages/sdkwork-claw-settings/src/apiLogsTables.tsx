import { Fragment } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type {
  LocalAiProxyMessageLogRecord,
  LocalAiProxyRequestLogRecord,
  PaginatedResult,
} from '@sdkwork/claw-types';
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sdkwork/claw-ui';
import {
  PAGE_SIZE_OPTIONS,
  formatCount,
  formatDateTime,
  formatDuration,
  formatRequestTokenSummary,
  resolveStatusToneClassName,
} from './apiLogsPresentation.ts';

interface PaginationFooterProps {
  result: PaginatedResult<unknown>;
  onPrevious: () => void;
  onNext: () => void;
  onPageSizeChange: (nextPageSize: number) => void;
  isLoading: boolean;
  summaryLabel: string;
  previousLabel: string;
  nextLabel: string;
  pageSizeLabel: string;
}

export function PaginationFooter({
  result,
  onPrevious,
  onNext,
  onPageSizeChange,
  isLoading,
  summaryLabel,
  previousLabel,
  nextLabel,
  pageSizeLabel,
}: PaginationFooterProps) {
  const start = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const end = result.total === 0 ? 0 : Math.min(result.page * result.pageSize, result.total);
  const summary = summaryLabel
    .replace('{{page}}', `${result.page}`)
    .replace('{{start}}', `${start}`)
    .replace('{{end}}', `${end}`)
    .replace('{{total}}', `${result.total}`);

  return (
    <div className="flex flex-col gap-3 border-t border-zinc-200 px-4 py-4 text-sm dark:border-zinc-800 md:flex-row md:items-center md:justify-between">
      <div className="text-zinc-500 dark:text-zinc-400">{summary}</div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
          <span>{pageSizeLabel}</span>
          <Select
            value={`${result.pageSize}`}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger className="w-[96px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((option) => (
                <SelectItem key={option} value={`${option}`}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onPrevious}
            disabled={isLoading || result.page <= 1}
          >
            {previousLabel}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onNext}
            disabled={isLoading || !result.hasMore}
          >
            {nextLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface RequestLogsTableProps {
  logs: PaginatedResult<LocalAiProxyRequestLogRecord>;
  expandedId: string | null;
  onToggleExpanded: (requestId: string) => void;
  isLoading: boolean;
  labels: Record<string, string>;
}

export function RequestLogsTable({
  logs,
  expandedId,
  onToggleExpanded,
  isLoading,
  labels,
}: RequestLogsTableProps) {
  if (isLoading) {
    return (
      <div className="px-4 py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
        {labels.loading}
      </div>
    );
  }

  if (logs.items.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
        {labels.empty}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto" data-slot="api-request-logs-table">
      <table className="min-w-full border-collapse">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-[0.16em] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            <th className="px-4 py-3">{labels.time}</th>
            <th className="px-4 py-3">{labels.provider}</th>
            <th className="px-4 py-3">{labels.model}</th>
            <th className="px-4 py-3">{labels.duration}</th>
            <th className="px-4 py-3">{labels.tokens}</th>
            <th className="px-4 py-3">{labels.baseUrl}</th>
            <th className="px-4 py-3">{labels.details}</th>
          </tr>
        </thead>
        <tbody>
          {logs.items.map((record) => {
            const isExpanded = expandedId === record.id;
            return (
              <Fragment key={record.id}>
                <tr
                  onClick={() => onToggleExpanded(record.id)}
                  className="cursor-pointer border-b border-zinc-100 transition hover:bg-zinc-50 dark:border-zinc-900 dark:hover:bg-zinc-900/50"
                >
                  <td className="px-4 py-4 align-top text-sm text-zinc-700 dark:text-zinc-200">
                    <div className="font-medium">{formatDateTime(record.createdAt)}</div>
                    <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {record.routeName}
                    </div>
                  </td>
                  <td className="px-4 py-4 align-top text-sm text-zinc-700 dark:text-zinc-200">
                    <div className="font-medium">{record.providerId}</div>
                    <div className="mt-1">
                      <span
                        className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-medium ${resolveStatusToneClassName(record.status)}`}
                      >
                        {record.status === 'succeeded' ? labels.succeeded : labels.failed}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 align-top text-sm text-zinc-700 dark:text-zinc-200">
                    <div className="font-medium">{record.modelId || '--'}</div>
                    <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {record.endpoint}
                    </div>
                  </td>
                  <td className="px-4 py-4 align-top text-sm text-zinc-700 dark:text-zinc-200">
                    <div>{`${labels.ttft}: ${formatDuration(record.ttftMs)}`}</div>
                    <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {`${labels.totalDuration}: ${formatDuration(record.totalDurationMs)}`}
                    </div>
                  </td>
                  <td className="px-4 py-4 align-top text-sm text-zinc-700 dark:text-zinc-200">
                    {formatRequestTokenSummary(record, labels as Record<'total' | 'input' | 'output' | 'cache', string>)}
                  </td>
                  <td className="px-4 py-4 align-top text-sm text-zinc-700 dark:text-zinc-200">
                    <div className="max-w-[280px] break-all">{record.baseUrl}</div>
                  </td>
                  <td className="px-4 py-4 align-top text-sm text-zinc-700 dark:text-zinc-200">
                    <div className="flex items-center justify-end gap-2 text-zinc-500 dark:text-zinc-400">
                      <span className="hidden text-xs md:inline">{labels.clickToExpand}</span>
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </div>
                  </td>
                </tr>
                {isExpanded ? (
                  <tr className="border-b border-zinc-100 bg-zinc-50/80 dark:border-zinc-900 dark:bg-zinc-950/60">
                    <td colSpan={7} className="px-4 py-4">
                      <div className="grid gap-4 xl:grid-cols-2">
                        <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                          <div className="grid gap-3 text-sm sm:grid-cols-2">
                            <div>
                              <div className="text-xs uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">{labels.route}</div>
                              <div className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">{record.routeId}</div>
                            </div>
                            <div>
                              <div className="text-xs uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">{labels.protocols}</div>
                              <div className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">{`${record.clientProtocol} -> ${record.upstreamProtocol}`}</div>
                            </div>
                            <div>
                              <div className="text-xs uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">{labels.endpoint}</div>
                              <div className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">{record.endpoint}</div>
                            </div>
                            <div>
                              <div className="text-xs uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">{labels.responseStatus}</div>
                              <div className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">{record.responseStatus ?? '--'}</div>
                            </div>
                            <div>
                              <div className="text-xs uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">{labels.requestMessages}</div>
                              <div className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">{formatCount(record.requestMessageCount)}</div>
                            </div>
                            <div className="sm:col-span-2">
                              <div className="text-xs uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">{labels.tokens}</div>
                              <div className="mt-2 grid gap-2 sm:grid-cols-4">
                                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/60">
                                  <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">{labels.total}</div>
                                  <div className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">{formatCount(record.totalTokens)}</div>
                                </div>
                                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/60">
                                  <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">{labels.input}</div>
                                  <div className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">{formatCount(record.promptTokens ?? record.inputTokens)}</div>
                                </div>
                                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/60">
                                  <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">{labels.output}</div>
                                  <div className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">{formatCount(record.completionTokens ?? record.outputTokens)}</div>
                                </div>
                                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/60">
                                  <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">{labels.cache}</div>
                                  <div className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">{formatCount(record.cacheTokens)}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                          <div>
                            <div className="text-xs uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">{labels.requestPreview}</div>
                            <div className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-700 dark:text-zinc-200">{record.requestPreview || '--'}</div>
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">{labels.responsePreview}</div>
                            <div className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-700 dark:text-zinc-200">{record.responsePreview || record.error || '--'}</div>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                          <div className="text-xs uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">{labels.requestBody}</div>
                          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-zinc-950 px-3 py-3 text-xs text-zinc-100">{record.requestBody || '--'}</pre>
                        </div>
                        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                          <div className="text-xs uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">{labels.responseBody}</div>
                          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-zinc-950 px-3 py-3 text-xs text-zinc-100">{record.responseBody || '--'}</pre>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface MessageLogsTableProps {
  logs: PaginatedResult<LocalAiProxyMessageLogRecord>;
  expandedId: string | null;
  onToggleExpanded: (messageLogId: string) => void;
  isLoading: boolean;
  labels: Record<string, string>;
}

export function MessageLogsTable({
  logs,
  expandedId,
  onToggleExpanded,
  isLoading,
  labels,
}: MessageLogsTableProps) {
  if (isLoading) {
    return <div className="px-4 py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">{labels.loading}</div>;
  }

  if (logs.items.length === 0) {
    return <div className="px-4 py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">{labels.empty}</div>;
  }

  return (
    <div className="overflow-x-auto" data-slot="api-message-logs-table">
      <table className="min-w-full border-collapse">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-[0.16em] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            <th className="px-4 py-3">{labels.time}</th>
            <th className="px-4 py-3">{labels.provider}</th>
            <th className="px-4 py-3">{labels.model}</th>
            <th className="px-4 py-3">{labels.messageCount}</th>
            <th className="px-4 py-3">{labels.baseUrl}</th>
            <th className="px-4 py-3">{labels.details}</th>
          </tr>
        </thead>
        <tbody>
          {logs.items.map((record) => {
            const isExpanded = expandedId === record.id;
            return (
              <Fragment key={record.id}>
                <tr
                  onClick={() => onToggleExpanded(record.id)}
                  className="cursor-pointer border-b border-zinc-100 transition hover:bg-zinc-50 dark:border-zinc-900 dark:hover:bg-zinc-900/50"
                >
                  <td className="px-4 py-4 align-top text-sm text-zinc-700 dark:text-zinc-200">
                    <div className="font-medium">{formatDateTime(record.createdAt)}</div>
                    <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{record.routeName}</div>
                  </td>
                  <td className="px-4 py-4 align-top text-sm text-zinc-700 dark:text-zinc-200">
                    <div className="font-medium">{record.providerId}</div>
                    <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{record.clientProtocol}</div>
                  </td>
                  <td className="px-4 py-4 align-top text-sm text-zinc-700 dark:text-zinc-200">
                    <div className="font-medium">{record.modelId || '--'}</div>
                    <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{record.upstreamProtocol}</div>
                  </td>
                  <td className="px-4 py-4 align-top text-sm text-zinc-700 dark:text-zinc-200">{formatCount(record.messageCount)}</td>
                  <td className="px-4 py-4 align-top text-sm text-zinc-700 dark:text-zinc-200">
                    <div className="max-w-[280px] break-all">{record.baseUrl}</div>
                  </td>
                  <td className="px-4 py-4 align-top text-sm text-zinc-700 dark:text-zinc-200">
                    <div className="flex items-center justify-end gap-2 text-zinc-500 dark:text-zinc-400">
                      <span className="hidden text-xs md:inline">{labels.clickToExpand}</span>
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </div>
                  </td>
                </tr>
                {isExpanded ? (
                  <tr className="border-b border-zinc-100 bg-zinc-50/80 dark:border-zinc-900 dark:bg-zinc-950/60">
                    <td colSpan={6} className="px-4 py-4">
                      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
                        <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                          <div>
                            <div className="text-xs uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">{labels.requestLogId}</div>
                            <div className="mt-1 break-all text-sm font-medium text-zinc-900 dark:text-zinc-100">{record.requestLogId || '--'}</div>
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">{labels.preview}</div>
                            <div className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-700 dark:text-zinc-200">{record.preview || '--'}</div>
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">{labels.responsePreview}</div>
                            <div className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-700 dark:text-zinc-200">{record.responsePreview || '--'}</div>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                          <div className="text-xs uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">{labels.messages}</div>
                          <div className="mt-3 space-y-3">
                            {record.messages.map((message) => (
                              <div
                                key={`${record.id}-${message.index}`}
                                className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950"
                              >
                                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                                  <span className="inline-flex rounded-full border border-zinc-300 px-2 py-1 dark:border-zinc-700">{message.role}</span>
                                  {message.kind ? <span>{message.kind}</span> : null}
                                  {message.name ? <span>{message.name}</span> : null}
                                </div>
                                <div className="mt-2 whitespace-pre-wrap break-words text-sm text-zinc-700 dark:text-zinc-200">{message.content || '--'}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
