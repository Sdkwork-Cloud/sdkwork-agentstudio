import { startTransition, useEffect, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import type {
  LocalAiProxyMessageCaptureSettings,
  LocalAiProxyMessageLogRecord,
  LocalAiProxyRequestLogRecord,
  PaginatedResult,
} from '@sdkwork/agentstudio-pc-types';
import { Button, Input, Switch } from '@sdkwork/agentstudio-pc-ui';
import {
  type ApiSettingsSection,
  resolveApiSettingsSection,
} from './apiSettingsView.ts';
import {
  API_LOGS_TAB_PARAM,
  API_SECTION_PARAM,
  DEFAULT_API_SECTION_LABELS,
  MESSAGES_PAGE_PARAM,
  MESSAGES_PAGE_SIZE_PARAM,
  MESSAGES_SEARCH_PARAM,
  REQUESTS_PAGE_PARAM,
  REQUESTS_PAGE_SIZE_PARAM,
  REQUESTS_SEARCH_PARAM,
  normalizePageSize,
  normalizePositiveInt,
  translateOrFallback,
  formatDateTime,
} from './apiLogsPresentation.ts';
import {
  MessageLogsTable,
  PaginationFooter,
  RequestLogsTable,
} from './apiLogsTables.tsx';
import { ProviderConfigCenter } from './ProviderConfigCenter.ts';
import {
  localAiProxyLogsService,
  type LocalAiProxyRuntimeSummary,
} from './services/index.ts';

const EMPTY_REQUEST_LOGS: PaginatedResult<LocalAiProxyRequestLogRecord> = {
  items: [],
  pageInfo: {
    mode: 'offset',
    page: 1,
    pageSize: 20,
    hasMore: false,
    totalItems: '0',
  },
};
const EMPTY_MESSAGE_LOGS: PaginatedResult<LocalAiProxyMessageLogRecord> = {
  items: [],
  pageInfo: {
    mode: 'offset',
    page: 1,
    pageSize: 20,
    hasMore: false,
    totalItems: '0',
  },
};
const EMPTY_RUNTIME_SUMMARY: LocalAiProxyRuntimeSummary = {
  lifecycle: 'unavailable',
  observabilityDbPath: null,
  snapshotPath: null,
  logPath: null,
};

export function ApiSettings() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [requestLogs, setRequestLogs] =
    useState<PaginatedResult<LocalAiProxyRequestLogRecord>>(EMPTY_REQUEST_LOGS);
  const [messageLogs, setMessageLogs] =
    useState<PaginatedResult<LocalAiProxyMessageLogRecord>>(EMPTY_MESSAGE_LOGS);
  const [runtimeSummary, setRuntimeSummary] =
    useState<LocalAiProxyRuntimeSummary>(EMPTY_RUNTIME_SUMMARY);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [messageCaptureEnabled, setMessageCaptureEnabled] = useState(false);
  const [messageCaptureUpdatedAt, setMessageCaptureUpdatedAt] = useState<number | null>(null);
  const [isLoadingCaptureSettings, setIsLoadingCaptureSettings] = useState(false);
  const [isUpdatingMessageCapture, setIsUpdatingMessageCapture] = useState(false);
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);

  const activeSection = resolveApiSettingsSection(
    searchParams.get(API_SECTION_PARAM),
    searchParams.get(API_LOGS_TAB_PARAM),
  );
  const requestPage = normalizePositiveInt(searchParams.get(REQUESTS_PAGE_PARAM), 1);
  const requestPageSize = normalizePageSize(searchParams.get(REQUESTS_PAGE_SIZE_PARAM), 20);
  const requestSearch = searchParams.get(REQUESTS_SEARCH_PARAM) ?? '';
  const messagePage = normalizePositiveInt(searchParams.get(MESSAGES_PAGE_PARAM), 1);
  const messagePageSize = normalizePageSize(searchParams.get(MESSAGES_PAGE_SIZE_PARAM), 20);
  const messageSearch = searchParams.get(MESSAGES_SEARCH_PARAM) ?? '';

  const sectionLabels = {
    providers: translateOrFallback(
      t,
      'apiLogs.tabs.providers',
      DEFAULT_API_SECTION_LABELS.providers,
    ),
    requests: translateOrFallback(
      t,
      'apiLogs.tabs.requests',
      DEFAULT_API_SECTION_LABELS.requests,
    ),
    messages: translateOrFallback(
      t,
      'apiLogs.tabs.messages',
      DEFAULT_API_SECTION_LABELS.messages,
    ),
  };

  const requestLabels: Record<string, string> = {
    loading: t('apiLogs.logs.states.loadingRequests'),
    empty: t('apiLogs.logs.states.emptyRequests'),
    time: t('apiLogs.logs.requestTable.time'),
    provider: t('apiLogs.logs.requestTable.provider'),
    model: t('apiLogs.logs.requestTable.model'),
    duration: t('apiLogs.logs.requestTable.duration'),
    tokens: t('apiLogs.logs.requestTable.tokens'),
    baseUrl: t('apiLogs.logs.requestTable.baseUrl'),
    details: t('apiLogs.logs.requestTable.details'),
    route: t('apiLogs.logs.requestTable.route'),
    protocols: t('apiLogs.logs.requestTable.protocols'),
    endpoint: t('apiLogs.logs.requestTable.endpoint'),
    responseStatus: t('apiLogs.logs.requestTable.responseStatus'),
    requestMessages: t('apiLogs.logs.requestTable.requestMessages'),
    requestPreview: t('apiLogs.logs.requestTable.requestPreview'),
    responsePreview: t('apiLogs.logs.requestTable.responsePreview'),
    requestBody: t('apiLogs.logs.requestTable.requestBody'),
    responseBody: t('apiLogs.logs.requestTable.responseBody'),
    clickToExpand: t('apiLogs.logs.labels.clickToExpand'),
    total: t('apiLogs.logs.labels.total'),
    input: t('apiLogs.logs.labels.input'),
    output: t('apiLogs.logs.labels.output'),
    cache: t('apiLogs.logs.labels.cache'),
    ttft: t('apiLogs.logs.labels.ttft'),
    totalDuration: t('apiLogs.logs.labels.totalDuration'),
    succeeded: t('apiLogs.logs.status.succeeded'),
    failed: t('apiLogs.logs.status.failed'),
  };
  const messageLabels: Record<string, string> = {
    loading: t('apiLogs.logs.states.loadingMessages'),
    empty: t('apiLogs.logs.states.emptyMessages'),
    time: t('apiLogs.logs.messageTable.time'),
    provider: t('apiLogs.logs.messageTable.provider'),
    model: t('apiLogs.logs.messageTable.model'),
    messageCount: t('apiLogs.logs.messageTable.messageCount'),
    baseUrl: t('apiLogs.logs.messageTable.baseUrl'),
    details: t('apiLogs.logs.messageTable.details'),
    requestLogId: t('apiLogs.logs.messageTable.requestLogId'),
    preview: t('apiLogs.logs.messageTable.preview'),
    responsePreview: t('apiLogs.logs.messageTable.responsePreview'),
    messages: t('apiLogs.logs.messageTable.messages'),
    clickToExpand: t('apiLogs.logs.labels.clickToExpand'),
  };

  const updateSearchParams = (mutate: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams);
    mutate(next);
    startTransition(() => {
      setSearchParams(next, { replace: true });
    });
  };

  const syncMessageCaptureState = (settings: LocalAiProxyMessageCaptureSettings) => {
    setMessageCaptureEnabled(settings.enabled);
    setMessageCaptureUpdatedAt(settings.updatedAt ?? null);
  };

  const loadRuntimeSummary = async () => {
    try {
      setRuntimeSummary(await localAiProxyLogsService.getRuntimeSummary());
    } catch (error: any) {
      setRuntimeSummary(EMPTY_RUNTIME_SUMMARY);
      toast.error(error?.message || t('apiLogs.logs.states.loadRuntimeSummaryFailed'));
    }
  };

  const loadMessageCaptureSettings = async () => {
    setIsLoadingCaptureSettings(true);
    try {
      syncMessageCaptureState(await localAiProxyLogsService.getMessageCaptureSettings());
    } catch (error: any) {
      toast.error(error?.message || t('apiLogs.logs.states.loadCaptureFailed'));
    } finally {
      setIsLoadingCaptureSettings(false);
    }
  };

  const loadRequestLogs = async (options?: { background?: boolean }) => {
    if (options?.background) {
      setIsRefreshing(true);
    } else {
      setIsLoadingRequests(true);
    }
    try {
      setRequestLogs(
        await localAiProxyLogsService.listRequestLogs({
          page: requestPage,
          page_size: requestPageSize,
          q: requestSearch,
        }),
      );
    } catch (error: any) {
      toast.error(error?.message || t('apiLogs.logs.states.loadRequestsFailed'));
    } finally {
      if (options?.background) {
        setIsRefreshing(false);
      } else {
        setIsLoadingRequests(false);
      }
    }
  };

  const loadMessageLogs = async (options?: { background?: boolean }) => {
    if (options?.background) {
      setIsRefreshing(true);
    } else {
      setIsLoadingMessages(true);
    }
    try {
      setMessageLogs(
        await localAiProxyLogsService.listMessageLogs({
          page: messagePage,
          page_size: messagePageSize,
          q: messageSearch,
        }),
      );
    } catch (error: any) {
      toast.error(error?.message || t('apiLogs.logs.states.loadMessagesFailed'));
    } finally {
      if (options?.background) {
        setIsRefreshing(false);
      } else {
        setIsLoadingMessages(false);
      }
    }
  };

  useEffect(() => {
    if (activeSection === 'providers') {
      return;
    }
    void loadRuntimeSummary();
  }, [activeSection]);

  useEffect(() => {
    if (activeSection !== 'requests') {
      return;
    }
    void loadRequestLogs();
  }, [activeSection, requestPage, requestPageSize, requestSearch]);

  useEffect(() => {
    if (activeSection !== 'messages') {
      return;
    }
    void loadMessageCaptureSettings();
  }, [activeSection]);

  useEffect(() => {
    if (activeSection !== 'messages') {
      return;
    }
    void loadMessageLogs();
  }, [activeSection, messagePage, messagePageSize, messageSearch]);

  const handleRefresh = async () => {
    if (activeSection === 'requests') {
      await Promise.all([loadRuntimeSummary(), loadRequestLogs({ background: true })]);
      return;
    }

    if (activeSection === 'messages') {
      await Promise.all([
        loadRuntimeSummary(),
        loadMessageCaptureSettings(),
        loadMessageLogs({ background: true }),
      ]);
    }
  };

  const handleToggleMessageCapture = async (enabled: boolean) => {
    setIsUpdatingMessageCapture(true);
    try {
      syncMessageCaptureState(
        await localAiProxyLogsService.updateMessageCaptureSettings(enabled),
      );
      if (activeSection === 'messages') {
        await loadMessageLogs({ background: true });
      }
    } catch (error: any) {
      toast.error(error?.message || t('apiLogs.logs.states.toggleCaptureFailed'));
    } finally {
      setIsUpdatingMessageCapture(false);
    }
  };

  const setActiveSection = (section: ApiSettingsSection) => {
    updateSearchParams((next) => {
      if (section === 'providers') {
        next.delete(API_SECTION_PARAM);
      } else {
        next.set(API_SECTION_PARAM, section);
      }
      next.delete(API_LOGS_TAB_PARAM);
    });
  };

  const updateRequestSearch = (value: string) => {
    updateSearchParams((next) => {
      if (value.trim()) {
        next.set(REQUESTS_SEARCH_PARAM, value);
      } else {
        next.delete(REQUESTS_SEARCH_PARAM);
      }
      next.delete(REQUESTS_PAGE_PARAM);
    });
  };

  const updateMessageSearch = (value: string) => {
    updateSearchParams((next) => {
      if (value.trim()) {
        next.set(MESSAGES_SEARCH_PARAM, value);
      } else {
        next.delete(MESSAGES_SEARCH_PARAM);
      }
      next.delete(MESSAGES_PAGE_PARAM);
    });
  };

  const topTabs = [
    { id: 'providers' as const, label: sectionLabels.providers },
    { id: 'requests' as const, label: sectionLabels.requests },
    { id: 'messages' as const, label: sectionLabels.messages },
  ];

  const messageCaptureSummary = messageCaptureUpdatedAt
    ? `${messageCaptureEnabled ? t('apiLogs.logs.labels.enabled') : t('apiLogs.logs.labels.disabled')} / ${t(
        'apiLogs.logs.messageCaptureUpdatedAt',
        {
          value: formatDateTime(messageCaptureUpdatedAt),
        },
      )}`
    : messageCaptureEnabled
      ? t('apiLogs.logs.labels.enabled')
      : t('apiLogs.logs.labels.disabled');
  const messageCaptureToolbarLabel = [
    t('apiLogs.logs.messageCaptureTitle'),
    messageCaptureSummary,
  ]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(' · ');

  const runtimeSummaryFields = [
    {
      key: 'lifecycle',
      label: t('apiLogs.logs.runtimeFields.proxyLifecycle'),
      value: (() => {
        switch (runtimeSummary.lifecycle.trim().toLowerCase()) {
          case 'ready':
            return t('apiLogs.logs.runtimeLifecycle.ready');
          case 'running':
            return t('apiLogs.logs.runtimeLifecycle.running');
          case 'failed':
            return t('apiLogs.logs.runtimeLifecycle.failed');
          case 'stopped':
            return t('apiLogs.logs.runtimeLifecycle.stopped');
          default:
            return t('apiLogs.logs.runtimeLifecycle.unavailable');
        }
      })(),
      mono: false,
    },
    {
      key: 'logPath',
      label: t('apiLogs.logs.runtimeFields.logPath'),
      value: runtimeSummary.logPath || t('apiLogs.logs.values.notAvailable'),
      mono: true,
    },
    {
      key: 'snapshotPath',
      label: t('apiLogs.logs.runtimeFields.snapshotPath'),
      value: runtimeSummary.snapshotPath || t('apiLogs.logs.values.notAvailable'),
      mono: true,
    },
    {
      key: 'observabilityDbPath',
      label: t('apiLogs.logs.runtimeFields.observabilityDbPath'),
      value: runtimeSummary.observabilityDbPath || t('apiLogs.logs.values.notAvailable'),
      mono: true,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-wrap gap-2" data-slot="api-settings-top-tabs">
        {topTabs.map((section) => {
          const isActive = activeSection === section.id;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => setActiveSection(section.id)}
              className={`inline-flex items-center rounded-2xl border px-4 py-2.5 text-sm font-medium transition ${
                isActive
                  ? 'border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-900/60 dark:bg-primary-950/40 dark:text-primary-300'
                  : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-100'
              }`}
            >
              {section.label}
            </button>
          );
        })}
      </section>

      {activeSection === 'providers' ? (
        <ProviderConfigCenter />
      ) : (
        <section className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-4 dark:border-zinc-800 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative w-full max-w-3xl xl:flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
              <Input
                value={activeSection === 'messages' ? messageSearch : requestSearch}
                onChange={(event) =>
                  activeSection === 'messages'
                    ? updateMessageSearch(event.target.value)
                    : updateRequestSearch(event.target.value)
                }
                placeholder={t('apiLogs.logs.searchPlaceholder')}
                className="pl-9"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 xl:justify-end">
              {activeSection === 'messages' ? (
                <div
                  className="flex h-10 max-w-full items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
                  data-slot="api-message-capture-toggle"
                >
                  <span
                    className="min-w-0 flex-1 truncate text-sm text-zinc-700 dark:text-zinc-300"
                    title={messageCaptureToolbarLabel}
                  >
                    {messageCaptureToolbarLabel}
                  </span>
                  <Switch
                    checked={messageCaptureEnabled}
                    onCheckedChange={(checked) =>
                      void handleToggleMessageCapture(Boolean(checked))
                    }
                    disabled={isLoadingCaptureSettings || isUpdatingMessageCapture}
                    aria-label={t('apiLogs.logs.messageCaptureTitle')}
                  />
                </div>
              ) : null}

              <Button variant="outline" onClick={() => void handleRefresh()} disabled={isRefreshing}>
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {t('apiLogs.logs.refresh')}
              </Button>
            </div>
          </div>

          <div
            className="border-b border-zinc-200 bg-zinc-50/70 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/40"
            data-slot="api-log-runtime-summary"
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              {t('apiLogs.logs.runtimeSummaryTitle')}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {runtimeSummaryFields.map((field) => (
                <div
                  key={field.key}
                  className="rounded-2xl border border-zinc-200 bg-white px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                    {field.label}
                  </div>
                  <div
                    className={`mt-2 break-all text-sm text-zinc-800 dark:text-zinc-200 ${
                      field.mono ? 'font-mono' : ''
                    }`}
                  >
                    {field.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {activeSection === 'requests' ? (
            <>
              <RequestLogsTable
                logs={requestLogs}
                expandedId={expandedRequestId}
                onToggleExpanded={(requestId) =>
                  setExpandedRequestId((current) => (current === requestId ? null : requestId))
                }
                isLoading={isLoadingRequests}
                labels={requestLabels}
              />
              <PaginationFooter
                result={requestLogs}
                onPrevious={() =>
                  updateSearchParams((next) => {
                    const page = Math.max(1, requestPage - 1);
                    if (page <= 1) {
                      next.delete(REQUESTS_PAGE_PARAM);
                    } else {
                      next.set(REQUESTS_PAGE_PARAM, `${page}`);
                    }
                  })
                }
                onNext={() =>
                  updateSearchParams((next) => {
                    next.set(REQUESTS_PAGE_PARAM, `${requestPage + 1}`);
                  })
                }
                onPageSizeChange={(pageSize) =>
                  updateSearchParams((next) => {
                    if (pageSize === 20) {
                      next.delete(REQUESTS_PAGE_SIZE_PARAM);
                    } else {
                      next.set(REQUESTS_PAGE_SIZE_PARAM, `${pageSize}`);
                    }
                    next.delete(REQUESTS_PAGE_PARAM);
                  })
                }
                isLoading={isLoadingRequests}
                summaryLabel={t('apiLogs.logs.pagination.summary')}
                previousLabel={t('apiLogs.logs.pagination.previous')}
                nextLabel={t('apiLogs.logs.pagination.next')}
                pageSizeLabel={t('apiLogs.logs.pagination.pageSize')}
              />
            </>
          ) : (
            <>
              {!messageCaptureEnabled ? (
                <div className="border-b border-zinc-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-zinc-800 dark:bg-amber-950/30 dark:text-amber-200">
                  {t('apiLogs.logs.messageCaptureDisabled')}
                </div>
              ) : null}
              <MessageLogsTable
                logs={messageLogs}
                expandedId={expandedMessageId}
                onToggleExpanded={(messageLogId) =>
                  setExpandedMessageId((current) =>
                    current === messageLogId ? null : messageLogId,
                  )
                }
                isLoading={isLoadingMessages}
                labels={messageLabels}
              />
              <PaginationFooter
                result={messageLogs}
                onPrevious={() =>
                  updateSearchParams((next) => {
                    const page = Math.max(1, messagePage - 1);
                    if (page <= 1) {
                      next.delete(MESSAGES_PAGE_PARAM);
                    } else {
                      next.set(MESSAGES_PAGE_PARAM, `${page}`);
                    }
                  })
                }
                onNext={() =>
                  updateSearchParams((next) => {
                    next.set(MESSAGES_PAGE_PARAM, `${messagePage + 1}`);
                  })
                }
                onPageSizeChange={(pageSize) =>
                  updateSearchParams((next) => {
                    if (pageSize === 20) {
                      next.delete(MESSAGES_PAGE_SIZE_PARAM);
                    } else {
                      next.set(MESSAGES_PAGE_SIZE_PARAM, `${pageSize}`);
                    }
                    next.delete(MESSAGES_PAGE_PARAM);
                  })
                }
                isLoading={isLoadingMessages}
                summaryLabel={t('apiLogs.logs.pagination.summary')}
                previousLabel={t('apiLogs.logs.pagination.previous')}
                nextLabel={t('apiLogs.logs.pagination.next')}
                pageSizeLabel={t('apiLogs.logs.pagination.pageSize')}
              />
            </>
          )}
        </section>
      )}
    </div>
  );
}
