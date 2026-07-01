import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from 'react';
import {
  Activity,
  Clock3,
  Coins,
  DatabaseZap,
  RefreshCw,
  Search,
  Server,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { formatCurrency, formatDate, formatNumber } from '@sdkwork/claw-i18n';
import {
  Checkbox,
  DateInput,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sdkwork/claw-ui';
import { SectionHeader } from '../components/SectionHeader';
import { StatusPill } from '../components/StatusPill';
import {
  applyShiftRangeSelection,
  applyUsageWorkspaceQuerySuggestion,
  buildUsageWorkspaceQuerySuggestions,
  extractUsageWorkspaceQueryTerms,
  filterUsageWorkspaceLogs,
  filterUsageWorkspaceSessionsByQuery,
  removeUsageWorkspaceQueryToken,
  type UsageWorkspaceParsedLogEntry,
  usageWorkspaceService,
} from '../services';
import type {
  UsageWorkspaceCompatibilityMode,
  UsageWorkspaceInstance,
  UsageWorkspaceSession,
  UsageWorkspaceSessionDetail,
  UsageWorkspaceSnapshot,
  UsageWorkspaceTimePoint,
  UsageWorkspaceTimeZone,
} from '../types/usage';

const surfaceClass =
  'min-w-0 rounded-[2rem] border border-white/70 bg-white/78 p-6 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/6 dark:bg-zinc-900/82';

const defaultVisibleColumns = ['model', 'channel', 'messages', 'errors'] as const;

type UsageSessionSort = 'recent' | 'tokens' | 'cost' | 'messages' | 'errors';
type UsageVisibleColumn =
  | 'model'
  | 'provider'
  | 'channel'
  | 'agent'
  | 'messages'
  | 'tools'
  | 'errors'
  | 'duration';

function padDatePart(value: number) {
  return `${value}`.padStart(2, '0');
}

function formatInputDate(date: Date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

function getDefaultDateRange(reference = new Date()) {
  const endDate = new Date(reference);
  const startDate = new Date(reference);
  startDate.setDate(startDate.getDate() - 29);
  return {
    startDate: formatInputDate(startDate),
    endDate: formatInputDate(endDate),
  };
}

function getStatusTone(status: UsageWorkspaceInstance['status']) {
  if (status === 'online') return 'positive' as const;
  if (status === 'starting') return 'warning' as const;
  if (status === 'offline') return 'neutral' as const;
  return 'critical' as const;
}

function getCompatibilityTone(mode: UsageWorkspaceCompatibilityMode) {
  return mode === 'date-interpretation' ? 'positive' : 'warning';
}

function getCompatibilityLabelKey(mode: UsageWorkspaceCompatibilityMode) {
  return mode === 'date-interpretation'
    ? 'dashboard.usage.compatibility.dateInterpretation'
    : 'dashboard.usage.compatibility.legacyNoDateInterpretation';
}

function getSessionSortValue(session: UsageWorkspaceSession, sort: UsageSessionSort) {
  const usage = session.usage;
  if (sort === 'tokens') return usage?.totalTokens ?? 0;
  if (sort === 'cost') return usage?.totalCost ?? 0;
  if (sort === 'messages') return usage?.messageCounts.total ?? 0;
  if (sort === 'errors') return usage?.messageCounts.errors ?? 0;
  return usage?.lastActivity ?? session.updatedAt ?? 0;
}

function matchesSearch(session: UsageWorkspaceSession, searchQuery: string) {
  if (!searchQuery) return true;
  const haystack = [
    session.key,
    session.label,
    session.sessionId,
    session.agentId,
    session.channel,
    session.modelProvider,
    session.providerOverride,
    session.model,
    session.modelOverride,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(searchQuery);
}

function formatTimestamp(
  value: number | undefined,
  language: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' },
) {
  if (!value) return null;
  return formatDate(new Date(value), language, options);
}

function formatDuration(durationMs: number | undefined, language: string) {
  if (!durationMs || durationMs <= 0) return null;
  if (durationMs < 1000) return `${formatNumber(durationMs, language)} ms`;

  const totalSeconds = Math.floor(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];

  if (hours > 0) parts.push(`${formatNumber(hours, language)}h`);
  if (minutes > 0) parts.push(`${formatNumber(minutes, language)}m`);
  if (hours === 0 || seconds > 0) parts.push(`${formatNumber(seconds, language)}s`);

  return parts.join(' ');
}

function getLogTone(role: string) {
  if (role === 'assistant') return 'positive' as const;
  if (role === 'user') return 'neutral' as const;
  if (role === 'tool') return 'warning' as const;
  return 'critical' as const;
}

function sessionMatchesSelectedDays(session: UsageWorkspaceSession, selectedDays: string[]) {
  if (selectedDays.length === 0) return true;
  if (session.usage?.activityDates.length) {
    return session.usage.activityDates.some((date) => selectedDays.includes(date));
  }
  if (!session.updatedAt) return false;
  const date = new Date(session.updatedAt);
  const dateKey = `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
  return selectedDays.includes(dateKey);
}

function UsageMetricCard({
  icon: Icon,
  label,
  value,
  detail,
  toneClassName,
}: {
  icon: typeof Coins;
  label: string;
  value: string;
  detail: string;
  toneClassName: string;
}) {
  return (
    <div className="rounded-[1.6rem] border border-zinc-200/80 bg-white/85 p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
          {label}
        </span>
        <span className={`flex h-10 w-10 items-center justify-center rounded-full ${toneClassName}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{detail}</p>
    </div>
  );
}

function SessionTimelineTable({
  language,
  points,
  t,
}: {
  language: string;
  points: UsageWorkspaceTimePoint[];
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  if (points.length === 0) return null;
  return (
    <div className="overflow-x-auto rounded-[1.5rem] border border-zinc-200/80 dark:border-zinc-800">
      <table className="min-w-[680px] w-full text-left text-sm">
        <thead className="border-b border-zinc-200/80 bg-zinc-50/90 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-400">
          <tr>
            <th className="px-4 py-3 font-medium">{t('dashboard.usage.labels.logTime')}</th>
            <th className="px-4 py-3 font-medium">{t('dashboard.usage.labels.tokens')}</th>
            <th className="px-4 py-3 font-medium">{t('dashboard.usage.labels.cost')}</th>
            <th className="px-4 py-3 font-medium">{t('dashboard.usage.labels.cumulativeTokens')}</th>
            <th className="px-4 py-3 font-medium">{t('dashboard.usage.labels.cumulativeCost')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200/80 dark:divide-zinc-800">
          {[...points].sort((left, right) => right.timestamp - left.timestamp).slice(0, 24).map((point) => (
            <tr key={`${point.timestamp}-${point.totalTokens}-${point.cost}`}>
              <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                {formatDate(new Date(point.timestamp), language, { dateStyle: 'medium', timeStyle: 'short' })}
              </td>
              <td className="px-4 py-3">{formatNumber(point.totalTokens, language)}</td>
              <td className="px-4 py-3">{formatCurrency(point.cost, language)}</td>
              <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{formatNumber(point.cumulativeTokens, language)}</td>
              <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{formatCurrency(point.cumulativeCost, language)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SessionLogsList({
  language,
  logs,
  t,
}: {
  language: string;
  logs: UsageWorkspaceParsedLogEntry[];
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  if (logs.length === 0) return null;
  return (
    <div className="space-y-3">
      {logs.map((entry, index) => (
        <div
          key={`${entry.log.timestamp}-${entry.log.role}-${index}`}
          className="rounded-[1.5rem] border border-zinc-200/80 bg-white/75 p-4 dark:border-zinc-800 dark:bg-zinc-950/45"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <StatusPill label={entry.log.role} tone={getLogTone(entry.log.role)} />
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {formatTimestamp(entry.log.timestamp, language) ?? '-'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
              <span>{t('dashboard.usage.labels.tokens')}: {formatNumber(entry.log.tokens ?? 0, language)}</span>
              <span>{t('dashboard.usage.labels.cost')}: {formatCurrency(entry.log.cost ?? 0, language)}</span>
            </div>
          </div>
          {entry.tools.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {entry.tools.map(([toolName, count]) => (
                <span
                  key={`${entry.log.timestamp}-${toolName}`}
                  className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                >
                  {toolName} ({count})
                </span>
              ))}
            </div>
          ) : null}
          <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm leading-6 text-zinc-700 dark:text-zinc-200">
            {entry.cleanContent || '-'}
          </pre>
        </div>
      ))}
    </div>
  );
}

export function UsageWorkspacePage() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const [instances, setInstances] = useState<UsageWorkspaceInstance[]>([]);
  const [activeInstanceId, setActiveInstanceId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<UsageWorkspaceSnapshot | null>(null);
  const [sessionDetail, setSessionDetail] = useState<UsageWorkspaceSessionDetail | null>(null);
  const [focusedSessionKey, setFocusedSessionKey] = useState<string | null>(null);
  const [selectedSessionKeys, setSelectedSessionKeys] = useState<string[]>([]);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [queryDraft, setQueryDraft] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [sortBy, setSortBy] = useState<UsageSessionSort>('recent');
  const [visibleColumns, setVisibleColumns] = useState<UsageVisibleColumn[]>([...defaultVisibleColumns]);
  const [timeZone, setTimeZone] = useState<UsageWorkspaceTimeZone>('local');
  const [logRoles, setLogRoles] = useState<string[]>([]);
  const [logTools, setLogTools] = useState<string[]>([]);
  const [logHasTools, setLogHasTools] = useState(false);
  const [logQuery, setLogQuery] = useState('');
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(false);
  const [isLoadingSessionDetail, setIsLoadingSessionDetail] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const defaultRange = useMemo(() => getDefaultDateRange(), []);
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);

  const activeInstance = useMemo(
    () => instances.find((instance) => instance.id === activeInstanceId) ?? null,
    [activeInstanceId, instances],
  );

  const queryResult = useMemo(() => {
    const quickQuery = deferredSearchQuery.trim().toLowerCase();
    const sessions = (snapshot?.sessions ?? [])
      .filter((session) => sessionMatchesSelectedDays(session, selectedDays))
      .filter((session) => matchesSearch(session, quickQuery));
    return filterUsageWorkspaceSessionsByQuery(sessions, appliedQuery);
  }, [appliedQuery, deferredSearchQuery, selectedDays, snapshot?.sessions]);

  const filteredSessions = useMemo(
    () =>
      [...queryResult.sessions].sort(
        (left, right) => getSessionSortValue(right, sortBy) - getSessionSortValue(left, sortBy),
      ),
    [queryResult.sessions, sortBy],
  );

  const querySuggestions = useMemo(
    () =>
      buildUsageWorkspaceQuerySuggestions(
        queryDraft,
        snapshot?.sessions ?? [],
        snapshot?.aggregates ?? null,
      ),
    [queryDraft, snapshot?.aggregates, snapshot?.sessions],
  );

  const appliedQueryTerms = useMemo(
    () => extractUsageWorkspaceQueryTerms(appliedQuery),
    [appliedQuery],
  );

  const detailSessionKey =
    selectedSessionKeys.length > 1 ? null : selectedSessionKeys[0] ?? focusedSessionKey;

  const selectedSession = useMemo(() => {
    if (!detailSessionKey) return null;
    return (
      filteredSessions.find((session) => session.key === detailSessionKey) ??
      snapshot?.sessions.find((session) => session.key === detailSessionKey) ??
      null
    );
  }, [detailSessionKey, filteredSessions, snapshot?.sessions]);

  const selectedDetail =
    sessionDetail?.sessionKey === detailSessionKey ? sessionDetail : null;

  const isRangeInvalid = startDate > endDate;

  const dailyBreakdown = useMemo(() => {
    const rows = new Map<
      string,
      { date: string; totalTokens: number; totalCost: number; messages: number; errors: number }
    >();

    for (const row of snapshot?.costDaily ?? []) {
      rows.set(row.date, {
        date: row.date,
        totalTokens: row.totalTokens,
        totalCost: row.totalCost,
        messages: 0,
        errors: 0,
      });
    }

    for (const row of snapshot?.aggregates.daily ?? []) {
      const existing = rows.get(row.date);
      rows.set(row.date, {
        date: row.date,
        totalTokens: existing?.totalTokens ?? row.tokens,
        totalCost: existing?.totalCost ?? row.cost,
        messages: row.messages,
        errors: row.errors,
      });
    }

    return [...rows.values()].sort((left, right) => right.date.localeCompare(left.date));
  }, [snapshot?.aggregates.daily, snapshot?.costDaily]);

  const filteredLogs = useMemo(
    () =>
      filterUsageWorkspaceLogs(selectedDetail?.logs ?? [], {
        roles: logRoles,
        tools: logTools,
        hasTools: logHasTools,
        query: logQuery,
      }),
    [logHasTools, logQuery, logRoles, logTools, selectedDetail?.logs],
  );

  const loadUsageInstances = useEffectEvent(async () => {
    setIsBootstrapping(true);
    try {
      const result = await usageWorkspaceService.listUsageInstances();
      startTransition(() => {
        setInstances(result.instances);
        setActiveInstanceId((current) => {
          if (current && result.instances.some((instance) => instance.id === current)) {
            return current;
          }
          return result.defaultInstanceId ?? result.instances[0]?.id ?? null;
        });
      });
      setPageError(null);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : t('dashboard.usage.page.noSnapshot'));
    } finally {
      setIsBootstrapping(false);
    }
  });

  const loadSnapshot = useEffectEvent(async (instance: UsageWorkspaceInstance) => {
    setIsLoadingSnapshot(true);
    try {
      const nextSnapshot = await usageWorkspaceService.loadUsageSnapshot({
        instanceId: instance.id,
        gatewayUrl: instance.baseUrl,
        startDate,
        endDate,
        timeZone,
      });
      startTransition(() => {
        setSnapshot(nextSnapshot);
        setFocusedSessionKey((current) =>
          current && nextSnapshot.sessions.some((session) => session.key === current)
            ? current
            : nextSnapshot.sessions[0]?.key ?? null,
        );
        setSelectedSessionKeys((current) =>
          current.filter((key) => nextSnapshot.sessions.some((session) => session.key === key)),
        );
        setSelectedDays((current) =>
          current.filter((day) => nextSnapshot.costDaily.some((entry) => entry.date === day)),
        );
      });
      setPageError(null);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : t('dashboard.usage.page.noSnapshot'));
    } finally {
      setIsLoadingSnapshot(false);
    }
  });

  const loadDetail = useEffectEvent(async (instanceId: string, sessionKey: string) => {
    setIsLoadingSessionDetail(true);
    try {
      const nextDetail = await usageWorkspaceService.loadSessionDetail({
        instanceId,
        sessionKey,
      });
      startTransition(() => setSessionDetail(nextDetail));
    } finally {
      setIsLoadingSessionDetail(false);
    }
  });

  useEffect(() => {
    void loadUsageInstances();
  }, []);

  useEffect(() => {
    if (!activeInstance) {
      setSnapshot((current) => (current === null ? current : null));
      setFocusedSessionKey((current) => (current === null ? current : null));
      setSelectedSessionKeys((current) => (current.length === 0 ? current : []));
      setSelectedDays((current) => (current.length === 0 ? current : []));
      setSessionDetail((current) => (current === null ? current : null));
      return;
    }
    if (isRangeInvalid) return;
    void loadSnapshot(activeInstance);
  }, [activeInstance, endDate, isRangeInvalid, refreshToken, startDate, timeZone]);

  useEffect(() => {
    if (!activeInstanceId || !detailSessionKey) {
      setSessionDetail((current) => (current === null ? current : null));
      return;
    }
    void loadDetail(activeInstanceId, detailSessionKey);
  }, [activeInstanceId, detailSessionKey, refreshToken]);

  useEffect(() => {
    setLogRoles([]);
    setLogTools([]);
    setLogHasTools(false);
    setLogQuery('');
  }, [detailSessionKey]);

  const handleApplyQuery = () => setAppliedQuery(queryDraft.trim());
  const handleClearQuery = () => {
    setQueryDraft('');
    setAppliedQuery('');
  };
  const handleRemoveAppliedQueryToken = (token: string) => {
    const nextValue = removeUsageWorkspaceQueryToken(`${appliedQuery} `, token).trim();
    setAppliedQuery(nextValue);
    setQueryDraft(nextValue ? `${nextValue} ` : '');
  };
  const handleSelectSession = (sessionKey: string, shiftKey: boolean) => {
    const orderedKeys = filteredSessions.map((session) => session.key);
    setSelectedSessionKeys((current) =>
      applyShiftRangeSelection(current, sessionKey, orderedKeys, shiftKey),
    );
    setFocusedSessionKey(sessionKey);
  };
  const handleSelectDay = (day: string, shiftKey: boolean) => {
    const orderedDays = dailyBreakdown.map((row) => row.date);
    setSelectedDays((current) =>
      applyShiftRangeSelection(current, day, orderedDays, shiftKey),
    );
  };
  const toggleVisibleColumn = (column: UsageVisibleColumn) =>
    setVisibleColumns((current) =>
      current.includes(column)
        ? current.filter((entry) => entry !== column)
        : [...current, column],
    );
  const toggleLogRole = (role: string) =>
    setLogRoles((current) =>
      current.includes(role) ? current.filter((entry) => entry !== role) : [...current, role],
    );
  const toggleLogTool = (tool: string) =>
    setLogTools((current) =>
      current.includes(tool) ? current.filter((entry) => entry !== tool) : [...current, tool],
    );

  const visibleColumnLabels: Array<{ id: UsageVisibleColumn; label: string }> = [
    { id: 'model', label: t('dashboard.usage.labels.model') },
    { id: 'provider', label: t('dashboard.usage.labels.provider') },
    { id: 'channel', label: t('dashboard.usage.labels.channel') },
    { id: 'agent', label: t('dashboard.usage.labels.agent') },
    { id: 'messages', label: t('dashboard.usage.labels.messages') },
    { id: 'tools', label: t('dashboard.usage.labels.toolCalls') },
    { id: 'errors', label: t('dashboard.usage.labels.errors') },
    { id: 'duration', label: t('dashboard.usage.labels.duration') },
  ];

  const logRolesAvailable = ['user', 'assistant', 'tool', 'toolResult'];

  if (isBootstrapping && instances.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6 py-10">
        <div className="max-w-md rounded-[2rem] border border-white/70 bg-white/85 p-8 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/6 dark:bg-zinc-900/85">
          <RefreshCw className="mx-auto h-6 w-6 animate-spin text-primary-500" />
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {t('dashboard.usage.page.loading')}
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            {t('dashboard.usage.page.description')}
          </p>
        </div>
      </div>
    );
  }

  if (!activeInstance) {
    return (
      <div className="flex h-full items-center justify-center px-6 py-10">
        <div className="max-w-xl rounded-[2rem] border border-white/70 bg-white/85 p-8 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/6 dark:bg-zinc-900/85">
          <Server className="mx-auto h-6 w-6 text-zinc-500" />
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {t('dashboard.usage.page.emptyTitle')}
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            {t('dashboard.usage.page.emptyDescription')}
          </p>
          <Link
            to="/instances"
            className="mt-6 inline-flex items-center rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-950"
          >
            {t('dashboard.usage.actions.openInstances')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-y-auto">
      <div className="min-h-full px-4 py-5 sm:px-6 lg:px-8 xl:px-10">
        <div className="space-y-6 xl:space-y-8">
          <section className={surfaceClass}>
            <SectionHeader
              eyebrow={t('dashboard.usage.page.eyebrow')}
              title={t('dashboard.usage.page.title')}
              description={t('dashboard.usage.page.description')}
              action={(
                <div className="flex flex-wrap gap-3">
                  <Link
                    to="/instances"
                    className="inline-flex items-center rounded-full border border-zinc-200/80 px-4 py-2 text-sm font-semibold text-zinc-700 dark:border-zinc-800 dark:text-zinc-200"
                  >
                    {t('dashboard.usage.actions.openInstances')}
                  </Link>
                  <button
                    type="button"
                    onClick={() => setRefreshToken((value) => value + 1)}
                    className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-950"
                  >
                    <RefreshCw className={`h-4 w-4 ${isLoadingSnapshot ? 'animate-spin' : ''}`} />
                    {t('dashboard.usage.filters.refresh')}
                  </button>
                </div>
              )}
            />

            <div className="mt-6 grid gap-4 xl:grid-cols-3">
              <label className="rounded-[1.5rem] border border-zinc-200/80 bg-white/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.usage.filters.instance')}</div>
                <Select value={activeInstanceId ?? ''} onValueChange={setActiveInstanceId}>
                  <SelectTrigger className="mt-3 h-11 w-full rounded-2xl border-zinc-200/80 bg-white/90 text-sm dark:border-white/8 dark:bg-zinc-950/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {instances.map((instance) => (
                      <SelectItem key={instance.id} value={instance.id}>
                        {instance.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="rounded-[1.5rem] border border-zinc-200/80 bg-white/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.usage.filters.timeZone')}</div>
                <Select value={timeZone} onValueChange={(value) => setTimeZone(value as UsageWorkspaceTimeZone)}>
                  <SelectTrigger className="mt-3 h-11 w-full rounded-2xl border-zinc-200/80 bg-white/90 text-sm dark:border-white/8 dark:bg-zinc-950/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">{t('dashboard.usage.filters.timeZoneLocal')}</SelectItem>
                    <SelectItem value="utc">{t('dashboard.usage.filters.timeZoneUtc')}</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="rounded-[1.5rem] border border-zinc-200/80 bg-white/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.usage.filters.sort')}</div>
                <Select value={sortBy} onValueChange={(value) => setSortBy(value as UsageSessionSort)}>
                  <SelectTrigger className="mt-3 h-11 w-full rounded-2xl border-zinc-200/80 bg-white/90 text-sm dark:border-white/8 dark:bg-zinc-950/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">{t('dashboard.usage.filters.sortRecent')}</SelectItem>
                    <SelectItem value="tokens">{t('dashboard.usage.filters.sortTokens')}</SelectItem>
                    <SelectItem value="cost">{t('dashboard.usage.filters.sortCost')}</SelectItem>
                    <SelectItem value="messages">{t('dashboard.usage.filters.sortMessages')}</SelectItem>
                    <SelectItem value="errors">{t('dashboard.usage.filters.sortErrors')}</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="rounded-[1.5rem] border border-zinc-200/80 bg-white/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.usage.filters.startDate')}</div>
                <DateInput value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-3 h-11 w-full rounded-2xl border-zinc-200/80 bg-white/90 text-sm dark:border-white/8 dark:bg-zinc-950/50" />
              </label>
              <label className="rounded-[1.5rem] border border-zinc-200/80 bg-white/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.usage.filters.endDate')}</div>
                <DateInput value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-3 h-11 w-full rounded-2xl border-zinc-200/80 bg-white/90 text-sm dark:border-white/8 dark:bg-zinc-950/50" />
              </label>
              <label className="rounded-[1.5rem] border border-zinc-200/80 bg-white/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.usage.filters.search')}</div>
                <div className="relative mt-3">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <Input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={t('dashboard.usage.filters.searchPlaceholder')} className="h-11 w-full rounded-2xl border-zinc-200/80 bg-white/90 pl-10 text-sm dark:border-white/8 dark:bg-zinc-950/50" />
                </div>
              </label>
            </div>

            <div className="mt-4 rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/35">
              <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.usage.filters.query')}</div>
                  <div className="mt-3 flex flex-col gap-3 lg:flex-row">
                    <Input value={queryDraft} onChange={(event) => setQueryDraft(event.target.value)} placeholder={t('dashboard.usage.filters.queryPlaceholder')} className="h-11 flex-1 rounded-2xl border-zinc-200/80 bg-white/90 text-sm dark:border-white/8 dark:bg-zinc-950/50" />
                    <div className="flex gap-3">
                      <button type="button" onClick={handleApplyQuery} className="inline-flex items-center justify-center rounded-full border border-zinc-200/80 px-4 py-2 text-sm font-semibold text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">{t('dashboard.usage.filters.applyQuery')}</button>
                      <button type="button" onClick={handleClearQuery} className="inline-flex items-center justify-center rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-950">{t('dashboard.usage.filters.clearQuery')}</button>
                    </div>
                  </div>
                  {querySuggestions.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {querySuggestions.map((suggestion) => (
                        <button
                          key={suggestion.value}
                          type="button"
                          onClick={() => setQueryDraft((current) => applyUsageWorkspaceQuerySuggestion(current, suggestion.value))}
                          className="rounded-full border border-zinc-200/80 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                        >
                          {suggestion.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {appliedQueryTerms.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {appliedQueryTerms.map((term) => (
                        <button key={term.raw} type="button" onClick={() => handleRemoveAppliedQueryToken(term.raw)} className="inline-flex items-center gap-1.5 rounded-full bg-primary-500/12 px-3 py-1.5 text-xs font-semibold text-primary-700 dark:text-primary-300">
                          <span>{term.raw}</span>
                          <X className="h-3 w-3" />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.usage.filters.visibleColumns')}</div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {visibleColumnLabels.map((column) => (
                      <label key={column.id} className="flex items-center gap-2 rounded-2xl border border-zinc-200/80 bg-white/90 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950/50 dark:text-zinc-200">
                        <Checkbox checked={visibleColumns.includes(column.id)} onCheckedChange={() => toggleVisibleColumn(column.id)} />
                        <span>{column.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <StatusPill label={t(`dashboard.status.${activeInstance.status}`)} tone={getStatusTone(activeInstance.status)} />
              {snapshot ? <StatusPill label={t(getCompatibilityLabelKey(snapshot.compatibilityMode))} tone={getCompatibilityTone(snapshot.compatibilityMode)} /> : null}
              <span className="text-sm text-zinc-500 dark:text-zinc-400">{t('dashboard.usage.summary.updatedAt')}: {snapshot ? formatTimestamp(snapshot.generatedAt, language) : t('dashboard.usage.page.noSnapshot')}</span>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">{t('dashboard.usage.labels.gateway')}: {activeInstance.baseUrl || '-'}</span>
            </div>
            {selectedDays.length > 0 || selectedSessionKeys.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedDays.length > 0 ? <button type="button" onClick={() => setSelectedDays([])} className="rounded-full bg-amber-500/12 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">{t('dashboard.usage.filters.selectedDays', { count: selectedDays.length })}</button> : null}
                {selectedSessionKeys.length > 0 ? <button type="button" onClick={() => setSelectedSessionKeys([])} className="rounded-full bg-sky-500/12 px-3 py-1.5 text-xs font-semibold text-sky-800 dark:text-sky-300">{t('dashboard.usage.filters.selectedSessions', { count: selectedSessionKeys.length })}</button> : null}
              </div>
            ) : null}
            {queryResult.warnings.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {queryResult.warnings.map((warning) => (
                  <span key={warning} className="rounded-full bg-amber-500/12 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">{warning}</span>
                ))}
              </div>
            ) : null}
            {isRangeInvalid ? <div className="mt-6 flex items-center gap-3 rounded-[1.5rem] border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200"><TriangleAlert className="h-4 w-4" />{t('dashboard.usage.filters.invalidRange')}</div> : null}
            {pageError ? <div className="mt-6 flex items-center gap-3 rounded-[1.5rem] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-800 dark:text-rose-200"><TriangleAlert className="h-4 w-4" />{pageError}</div> : null}
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <UsageMetricCard icon={DatabaseZap} label={t('dashboard.usage.metrics.totalTokens')} value={formatNumber(snapshot?.totals.totalTokens ?? 0, language)} detail={`${t('dashboard.usage.labels.inputTokens')}: ${formatNumber(snapshot?.totals.input ?? 0, language)}`} toneClassName="bg-primary-500/12 text-primary-600 dark:text-primary-300" />
            <UsageMetricCard icon={Coins} label={t('dashboard.usage.metrics.totalCost')} value={formatCurrency(snapshot?.totals.totalCost ?? 0, language)} detail={`${t('dashboard.usage.labels.missingCostEntries')}: ${formatNumber(snapshot?.totals.missingCostEntries ?? 0, language)}`} toneClassName="bg-emerald-500/12 text-emerald-600 dark:text-emerald-300" />
            <UsageMetricCard icon={Activity} label={t('dashboard.usage.metrics.sessionCount')} value={formatNumber(snapshot?.sessions.length ?? 0, language)} detail={`${t('dashboard.usage.labels.messages')}: ${formatNumber(snapshot?.aggregates.messages.total ?? 0, language)}`} toneClassName="bg-sky-500/12 text-sky-600 dark:text-sky-300" />
            <UsageMetricCard icon={TriangleAlert} label={t('dashboard.usage.metrics.errorCount')} value={formatNumber(snapshot?.aggregates.messages.errors ?? 0, language)} detail={`${t('dashboard.usage.labels.version')}: ${activeInstance.version || t('dashboard.usage.labels.noVersion')}`} toneClassName="bg-amber-500/12 text-amber-700 dark:text-amber-300" />
          </section>

          <div className="grid gap-6 2xl:grid-cols-[1.15fr_0.85fr]">
            <section className={surfaceClass}>
              <SectionHeader eyebrow={t('dashboard.usage.metrics.sessionCount')} title={t('dashboard.usage.sections.sessions')} description={t('dashboard.usage.sections.sessionsDescription')} />
              {filteredSessions.length ? (
                <div className="mt-6 overflow-x-auto rounded-[1.5rem] border border-zinc-200/80 dark:border-zinc-800">
                  <table className="min-w-[980px] w-full text-left text-sm">
                    <thead className="border-b border-zinc-200/80 bg-zinc-50/90 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-400">
                      <tr>
                        <th className="px-4 py-3 font-medium">{t('dashboard.usage.labels.sessionKey')}</th>
                        {visibleColumns.includes('model') ? <th className="px-4 py-3 font-medium">{t('dashboard.usage.labels.model')}</th> : null}
                        {visibleColumns.includes('provider') ? <th className="px-4 py-3 font-medium">{t('dashboard.usage.labels.provider')}</th> : null}
                        {visibleColumns.includes('channel') ? <th className="px-4 py-3 font-medium">{t('dashboard.usage.labels.channel')}</th> : null}
                        {visibleColumns.includes('agent') ? <th className="px-4 py-3 font-medium">{t('dashboard.usage.labels.agent')}</th> : null}
                        {visibleColumns.includes('messages') ? <th className="px-4 py-3 font-medium">{t('dashboard.usage.labels.messages')}</th> : null}
                        {visibleColumns.includes('tools') ? <th className="px-4 py-3 font-medium">{t('dashboard.usage.labels.toolCalls')}</th> : null}
                        {visibleColumns.includes('errors') ? <th className="px-4 py-3 font-medium">{t('dashboard.usage.labels.errors')}</th> : null}
                        {visibleColumns.includes('duration') ? <th className="px-4 py-3 font-medium">{t('dashboard.usage.labels.duration')}</th> : null}
                        <th className="px-4 py-3 font-medium">{t('dashboard.usage.labels.tokens')}</th>
                        <th className="px-4 py-3 font-medium">{t('dashboard.usage.labels.cost')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200/80 dark:divide-zinc-800">
                      {filteredSessions.map((session) => {
                        const rowSelected = selectedSessionKeys.length > 0 ? selectedSessionKeys.includes(session.key) : session.key === focusedSessionKey;
                        return (
                          <tr key={session.key} className={rowSelected ? 'bg-primary-500/[0.06]' : 'bg-white/60 dark:bg-zinc-950/30'}>
                            <td className="px-4 py-3">
                              <button type="button" onClick={(event) => handleSelectSession(session.key, event.shiftKey)} className="text-left">
                                <div className="font-semibold text-zinc-950 dark:text-zinc-50">{session.label || session.key}</div>
                                <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{session.key}</div>
                              </button>
                            </td>
                            {visibleColumns.includes('model') ? <td className="px-4 py-3">{session.model || session.modelOverride || '-'}</td> : null}
                            {visibleColumns.includes('provider') ? <td className="px-4 py-3">{session.modelProvider || session.providerOverride || '-'}</td> : null}
                            {visibleColumns.includes('channel') ? <td className="px-4 py-3">{session.channel || '-'}</td> : null}
                            {visibleColumns.includes('agent') ? <td className="px-4 py-3">{session.agentId || '-'}</td> : null}
                            {visibleColumns.includes('messages') ? <td className="px-4 py-3">{formatNumber(session.usage?.messageCounts.total ?? 0, language)}</td> : null}
                            {visibleColumns.includes('tools') ? <td className="px-4 py-3">{formatNumber(session.usage?.toolUsage.totalCalls ?? 0, language)}</td> : null}
                            {visibleColumns.includes('errors') ? <td className="px-4 py-3">{formatNumber(session.usage?.messageCounts.errors ?? 0, language)}</td> : null}
                            {visibleColumns.includes('duration') ? <td className="px-4 py-3">{formatDuration(session.usage?.durationMs, language) ?? '-'}</td> : null}
                            <td className="px-4 py-3">{formatNumber(session.usage?.totalTokens ?? 0, language)}</td>
                            <td className="px-4 py-3">{formatCurrency(session.usage?.totalCost ?? 0, language)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : <div className="mt-6 flex min-h-[16rem] items-center justify-center rounded-[1.6rem] border border-dashed border-zinc-300/80 bg-white/60 text-sm text-zinc-500 dark:border-zinc-700/70 dark:bg-zinc-950/35 dark:text-zinc-400">{t('dashboard.usage.labels.noSessions')}</div>}
            </section>

            <section className={surfaceClass}>
              <SectionHeader eyebrow={t('dashboard.usage.metrics.totalCost')} title={t('dashboard.usage.sections.dailyBreakdown')} description={t('dashboard.usage.sections.dailyBreakdownDescription')} />
              {dailyBreakdown.length ? (
                <div className="mt-6 overflow-x-auto rounded-[1.5rem] border border-zinc-200/80 dark:border-zinc-800">
                  <table className="min-w-[560px] w-full text-left text-sm">
                    <thead className="border-b border-zinc-200/80 bg-zinc-50/90 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-400">
                      <tr>
                        <th className="px-4 py-3 font-medium">{t('dashboard.usage.labels.logTime')}</th>
                        <th className="px-4 py-3 font-medium">{t('dashboard.usage.labels.tokens')}</th>
                        <th className="px-4 py-3 font-medium">{t('dashboard.usage.labels.cost')}</th>
                        <th className="px-4 py-3 font-medium">{t('dashboard.usage.labels.messages')}</th>
                        <th className="px-4 py-3 font-medium">{t('dashboard.usage.labels.errors')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200/80 dark:divide-zinc-800">
                      {dailyBreakdown.slice(0, 31).map((row) => (
                        <tr key={row.date} className={selectedDays.includes(row.date) ? 'bg-amber-500/[0.08]' : 'bg-white/60 dark:bg-zinc-950/30'}>
                          <td className="px-4 py-3 font-medium text-zinc-950 dark:text-zinc-50">
                            <button type="button" onClick={(event) => handleSelectDay(row.date, event.shiftKey)} className="text-left">{row.date}</button>
                          </td>
                          <td className="px-4 py-3">{formatNumber(row.totalTokens, language)}</td>
                          <td className="px-4 py-3">{formatCurrency(row.totalCost, language)}</td>
                          <td className="px-4 py-3">{formatNumber(row.messages, language)}</td>
                          <td className="px-4 py-3">{formatNumber(row.errors, language)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <div className="mt-6 flex min-h-[16rem] items-center justify-center rounded-[1.6rem] border border-dashed border-zinc-300/80 bg-white/60 text-sm text-zinc-500 dark:border-zinc-700/70 dark:bg-zinc-950/35 dark:text-zinc-400">{t('dashboard.usage.labels.noDailyBreakdown')}</div>}
            </section>
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
            <section className={surfaceClass}>
              <SectionHeader eyebrow={selectedSession?.key || t('dashboard.usage.labels.sessionKey')} title={t('dashboard.usage.sections.sessionDetail')} description={t('dashboard.usage.sections.sessionDetailDescription')} />
              {selectedSessionKeys.length > 1 ? <div className="mt-6 flex min-h-[16rem] items-center justify-center rounded-[1.6rem] border border-dashed border-zinc-300/80 bg-white/60 text-sm text-zinc-500 dark:border-zinc-700/70 dark:bg-zinc-950/35 dark:text-zinc-400">{t('dashboard.usage.labels.refineSessionSelection')}</div> : selectedSession ? (
                <div className="mt-6 space-y-4">
                  <div className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/75 p-5 dark:border-zinc-800 dark:bg-zinc-950/45">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">{selectedSession.label || selectedSession.key}</div>
                        <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{t('dashboard.usage.labels.sessionId')}: {selectedSession.sessionId || '-'}</div>
                      </div>
                      {isLoadingSessionDetail ? <div className="inline-flex items-center gap-2 rounded-full bg-primary-500/10 px-3 py-1.5 text-xs font-semibold text-primary-700 dark:text-primary-300"><RefreshCw className="h-3.5 w-3.5 animate-spin" />{t('common.loading')}</div> : null}
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[1.25rem] bg-white/80 p-4 dark:bg-zinc-900/60"><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.usage.labels.model')}</div><div className="mt-2 text-sm font-medium text-zinc-950 dark:text-zinc-100">{selectedSession.model || selectedSession.modelOverride || '-'}</div></div>
                      <div className="rounded-[1.25rem] bg-white/80 p-4 dark:bg-zinc-900/60"><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.usage.labels.provider')}</div><div className="mt-2 text-sm font-medium text-zinc-950 dark:text-zinc-100">{selectedSession.modelProvider || selectedSession.providerOverride || '-'}</div></div>
                      <div className="rounded-[1.25rem] bg-white/80 p-4 dark:bg-zinc-900/60"><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.usage.labels.lastActivity')}</div><div className="mt-2 text-sm font-medium text-zinc-950 dark:text-zinc-100">{formatTimestamp(selectedSession.usage?.lastActivity ?? selectedSession.updatedAt, language) ?? '-'}</div></div>
                      <div className="rounded-[1.25rem] bg-white/80 p-4 dark:bg-zinc-900/60"><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.usage.labels.duration')}</div><div className="mt-2 flex items-center gap-2 text-sm font-medium text-zinc-950 dark:text-zinc-100"><Clock3 className="h-4 w-4 text-zinc-400" />{formatDuration(selectedSession.usage?.durationMs, language) ?? '-'}</div></div>
                      <div className="rounded-[1.25rem] bg-white/80 p-4 dark:bg-zinc-900/60"><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.usage.labels.toolCalls')}</div><div className="mt-2 text-sm font-medium text-zinc-950 dark:text-zinc-100">{formatNumber(selectedSession.usage?.toolUsage.totalCalls ?? 0, language)}</div></div>
                      <div className="rounded-[1.25rem] bg-white/80 p-4 dark:bg-zinc-900/60"><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.usage.labels.agent')}</div><div className="mt-2 text-sm font-medium text-zinc-950 dark:text-zinc-100">{selectedSession.agentId || '-'}</div></div>
                    </div>
                  </div>
                </div>
              ) : <div className="mt-6 flex min-h-[16rem] items-center justify-center rounded-[1.6rem] border border-dashed border-zinc-300/80 bg-white/60 text-sm text-zinc-500 dark:border-zinc-700/70 dark:bg-zinc-950/35 dark:text-zinc-400">{t('dashboard.usage.labels.noSessionSelected')}</div>}
            </section>

            <div className="grid gap-6">
              <section className={surfaceClass}>
                <SectionHeader eyebrow={t('dashboard.usage.metrics.totalTokens')} title={t('dashboard.usage.sections.sessionTimeline')} description={t('dashboard.usage.sections.sessionTimelineDescription')} />
                <div className="mt-6">
                  {selectedDetail?.timeSeries.points.length ? <SessionTimelineTable language={language} points={selectedDetail.timeSeries.points} t={t} /> : <div className="flex min-h-[16rem] items-center justify-center rounded-[1.6rem] border border-dashed border-zinc-300/80 bg-white/60 text-sm text-zinc-500 dark:border-zinc-700/70 dark:bg-zinc-950/35 dark:text-zinc-400">{t('dashboard.usage.labels.noTimeline')}</div>}
                </div>
              </section>
              <section className={surfaceClass}>
                <SectionHeader eyebrow={t('dashboard.usage.metrics.totalCost')} title={t('dashboard.usage.sections.sessionLogs')} description={t('dashboard.usage.sections.sessionLogsDescription')} />
                {selectedDetail ? (
                  <div className="mt-6 space-y-4">
                    <div className="rounded-[1.5rem] border border-zinc-200/80 bg-zinc-50/75 p-4 dark:border-zinc-800 dark:bg-zinc-950/45">
                      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                        <label className="rounded-[1.25rem] bg-white/80 p-4 dark:bg-zinc-900/60"><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.usage.filters.logQuery')}</div><Input value={logQuery} onChange={(event) => setLogQuery(event.target.value)} placeholder={t('dashboard.usage.filters.logQueryPlaceholder')} className="mt-3 h-11 w-full rounded-2xl border-zinc-200/80 bg-white/90 text-sm dark:border-white/8 dark:bg-zinc-950/50" /></label>
                        <label className="rounded-[1.25rem] bg-white/80 p-4 dark:bg-zinc-900/60"><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.usage.filters.logHasTools')}</div><div className="mt-3 flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-200"><Checkbox checked={logHasTools} onCheckedChange={(checked) => setLogHasTools(checked === true)} /><span>{t('dashboard.usage.filters.logHasTools')}</span></div></label>
                      </div>
                      <div className="mt-4 grid gap-4 xl:grid-cols-2">
                        <div className="rounded-[1.25rem] bg-white/80 p-4 dark:bg-zinc-900/60">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.usage.filters.logRoles')}</div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {logRolesAvailable.map((role) => (
                              <label key={role} className="flex items-center gap-2 rounded-full border border-zinc-200/80 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">
                                <Checkbox checked={logRoles.includes(role)} onCheckedChange={() => toggleLogRole(role)} />
                                <span>{role}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-[1.25rem] bg-white/80 p-4 dark:bg-zinc-900/60">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t('dashboard.usage.filters.logTools')}</div>
                            <button type="button" onClick={() => { setLogRoles([]); setLogTools([]); setLogHasTools(false); setLogQuery(''); }} className="text-xs font-semibold text-primary-700 dark:text-primary-300">{t('dashboard.usage.filters.clearLogFilters')}</button>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {filteredLogs.toolOptions.length ? filteredLogs.toolOptions.map((tool) => (
                              <label key={tool} className="flex items-center gap-2 rounded-full border border-zinc-200/80 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">
                                <Checkbox checked={logTools.includes(tool)} onCheckedChange={() => toggleLogTool(tool)} />
                                <span>{tool}</span>
                              </label>
                            )) : <span className="text-sm text-zinc-500 dark:text-zinc-400">{t('dashboard.usage.labels.noLogTools')}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                    {filteredLogs.entries.length ? <SessionLogsList language={language} logs={filteredLogs.entries} t={t} /> : <div className="flex min-h-[12rem] items-center justify-center rounded-[1.6rem] border border-dashed border-zinc-300/80 bg-white/60 text-sm text-zinc-500 dark:border-zinc-700/70 dark:bg-zinc-950/35 dark:text-zinc-400">{t('dashboard.usage.labels.noMatchingLogs')}</div>}
                  </div>
                ) : <div className="mt-6 flex min-h-[16rem] items-center justify-center rounded-[1.6rem] border border-dashed border-zinc-300/80 bg-white/60 text-sm text-zinc-500 dark:border-zinc-700/70 dark:bg-zinc-950/35 dark:text-zinc-400">{t('dashboard.usage.labels.noLogs')}</div>}
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
