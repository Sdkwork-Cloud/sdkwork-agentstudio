import { openClawGatewayClient, resolveBrowserStorage, studio } from '@sdkwork/agentstudio-pc-infrastructure';
import type { StudioInstanceRecord } from '@sdkwork/agentstudio-pc-types';
import type {
  UsageWorkspaceAggregates,
  UsageWorkspaceCompatibilityMode,
  UsageWorkspaceInstancesResult,
  UsageWorkspaceLogEntry,
  UsageWorkspaceMessageCounts,
  UsageWorkspaceModelUsage,
  UsageWorkspaceQuery,
  UsageWorkspaceSession,
  UsageWorkspaceSessionDetail,
  UsageWorkspaceSessionDetailQuery,
  UsageWorkspaceSessionSummary,
  UsageWorkspaceSnapshot,
  UsageWorkspaceTimePoint,
  UsageWorkspaceTimeSeries,
  UsageWorkspaceTimeZone,
  UsageWorkspaceToolUsage,
  UsageWorkspaceTotals,
} from '../types/usage';

interface UsageWorkspaceServiceDependencies {
  studioApi: {
    listInstances(): Promise<StudioInstanceRecord[]>;
  };
  gatewayApi: {
    getGatewaySessionUsage(instanceId: string, args?: Record<string, unknown>): Promise<unknown>;
    getUsageCost(instanceId: string, args?: Record<string, unknown>): Promise<unknown>;
    getGatewaySessionUsageTimeseries(
      instanceId: string,
      args?: Record<string, unknown>,
    ): Promise<unknown>;
    getGatewaySessionUsageLogs(
      instanceId: string,
      args?: Record<string, unknown>,
    ): Promise<unknown>;
  };
  storage: Storage | null;
}

export interface UsageWorkspaceServiceDependencyOverrides {
  studioApi?: Partial<UsageWorkspaceServiceDependencies['studioApi']>;
  gatewayApi?: Partial<UsageWorkspaceServiceDependencies['gatewayApi']>;
  storage?: Storage | null;
}

const STORAGE_KEY = 'agent-studio.usage.date-params.v1';
const DEFAULT_GATEWAY_KEY = '__default__';
const MODE_RE = /unexpected property ['"]mode['"]/i;
const OFFSET_RE = /unexpected property ['"]utcoffset['"]/i;
const INVALID_PARAMS_RE = /invalid sessions\.usage params/i;

function getStorage(): Storage | null {
  return resolveBrowserStorage('localStorage');
}

function createDefaultDependencies(): UsageWorkspaceServiceDependencies {
  return {
    studioApi: {
      listInstances: () => studio.listInstances(),
    },
    gatewayApi: {
      getGatewaySessionUsage: (instanceId, args) =>
        openClawGatewayClient.getGatewaySessionUsage(instanceId, args),
      getUsageCost: (instanceId, args) => openClawGatewayClient.getUsageCost(instanceId, args),
      getGatewaySessionUsageTimeseries: (instanceId, args) =>
        openClawGatewayClient.getGatewaySessionUsageTimeseries(instanceId, args),
      getGatewaySessionUsageLogs: (instanceId, args) =>
        openClawGatewayClient.getGatewaySessionUsageLogs(instanceId, args),
    },
    storage: getStorage(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function getOptionalNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function getString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function emptyTotals(): UsageWorkspaceTotals {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    totalCost: 0,
    inputCost: 0,
    outputCost: 0,
    cacheReadCost: 0,
    cacheWriteCost: 0,
    missingCostEntries: 0,
  };
}

function normalizeTotals(value: unknown): UsageWorkspaceTotals {
  if (!isRecord(value)) return emptyTotals();
  return {
    input: getNumber(value.input),
    output: getNumber(value.output),
    cacheRead: getNumber(value.cacheRead),
    cacheWrite: getNumber(value.cacheWrite),
    totalTokens: getNumber(value.totalTokens),
    totalCost: getNumber(value.totalCost),
    inputCost: getNumber(value.inputCost),
    outputCost: getNumber(value.outputCost),
    cacheReadCost: getNumber(value.cacheReadCost),
    cacheWriteCost: getNumber(value.cacheWriteCost),
    missingCostEntries: getNumber(value.missingCostEntries),
  };
}

function normalizeMessages(value: unknown): UsageWorkspaceMessageCounts {
  if (!isRecord(value)) {
    return { total: 0, user: 0, assistant: 0, toolCalls: 0, toolResults: 0, errors: 0 };
  }
  return {
    total: getNumber(value.total),
    user: getNumber(value.user),
    assistant: getNumber(value.assistant),
    toolCalls: getNumber(value.toolCalls),
    toolResults: getNumber(value.toolResults),
    errors: getNumber(value.errors),
  };
}

function normalizeTools(value: unknown): UsageWorkspaceToolUsage {
  return {
    totalCalls: isRecord(value) ? getNumber(value.totalCalls) : 0,
    uniqueTools: isRecord(value) ? getNumber(value.uniqueTools) : 0,
    tools:
      isRecord(value) && Array.isArray(value.tools)
        ? value.tools
            .filter(isRecord)
            .map((tool) => ({
              name: getString(tool.name) ?? 'Unknown',
              count: getNumber(tool.count),
            }))
        : [],
  };
}

function normalizeLatency(value: unknown) {
  if (!isRecord(value)) return null;
  return {
    count: getNumber(value.count),
    avgMs: getNumber(value.avgMs),
    p95Ms: getNumber(value.p95Ms),
    minMs: getNumber(value.minMs),
    maxMs: getNumber(value.maxMs),
  };
}

function normalizeModelUsage(value: unknown): UsageWorkspaceModelUsage[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((entry) => ({
    provider: getString(entry.provider),
    model: getString(entry.model),
    count: getNumber(entry.count),
    totals: normalizeTotals(entry.totals),
  }));
}

function emptySessionSummary(): UsageWorkspaceSessionSummary {
  return {
    ...emptyTotals(),
    activityDates: [],
    messageCounts: normalizeMessages(undefined),
    toolUsage: normalizeTools(undefined),
    modelUsage: [],
    latency: null,
  };
}

function normalizeSessionSummary(value: unknown): UsageWorkspaceSessionSummary | null {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) return emptySessionSummary();
  return {
    ...normalizeTotals(value),
    sessionId: getString(value.sessionId),
    firstActivity: getOptionalNumber(value.firstActivity),
    lastActivity: getOptionalNumber(value.lastActivity),
    durationMs: getOptionalNumber(value.durationMs),
    activityDates: Array.isArray(value.activityDates)
      ? value.activityDates.map(getString).filter(Boolean) as string[]
      : [],
    messageCounts: normalizeMessages(value.messageCounts),
    toolUsage: normalizeTools(value.toolUsage),
    modelUsage: normalizeModelUsage(value.modelUsage),
    latency: normalizeLatency(value.latency),
  };
}

function normalizeSession(value: unknown): UsageWorkspaceSession {
  if (!isRecord(value)) return { key: '', usage: null };
  return {
    key: getString(value.key) ?? '',
    label: getString(value.label),
    sessionId: getString(value.sessionId),
    updatedAt: getOptionalNumber(value.updatedAt),
    agentId: getString(value.agentId),
    channel: getString(value.channel),
    modelOverride: getString(value.modelOverride),
    providerOverride: getString(value.providerOverride),
    modelProvider: getString(value.modelProvider),
    model: getString(value.model),
    usage: normalizeSessionSummary(value.usage),
  };
}

function normalizeAggregates(value: unknown): UsageWorkspaceAggregates {
  if (!isRecord(value)) {
    return {
      messages: normalizeMessages(undefined),
      tools: normalizeTools(undefined),
      byModel: [],
      byProvider: [],
      byAgent: [],
      byChannel: [],
      daily: [],
    };
  }
  return {
    messages: normalizeMessages(value.messages),
    tools: normalizeTools(value.tools),
    byModel: normalizeModelUsage(value.byModel),
    byProvider: normalizeModelUsage(value.byProvider),
    byAgent:
      Array.isArray(value.byAgent)
        ? value.byAgent.filter(isRecord).map((entry) => ({
            agentId: getString(entry.agentId) ?? 'unknown',
            totals: normalizeTotals(entry.totals),
          }))
        : [],
    byChannel:
      Array.isArray(value.byChannel)
        ? value.byChannel.filter(isRecord).map((entry) => ({
            channel: getString(entry.channel) ?? 'unknown',
            totals: normalizeTotals(entry.totals),
          }))
        : [],
    daily:
      Array.isArray(value.daily)
        ? value.daily.filter(isRecord).map((entry) => ({
            date: getString(entry.date) ?? '',
            tokens: getNumber(entry.tokens),
            cost: getNumber(entry.cost),
            messages: getNumber(entry.messages),
            toolCalls: getNumber(entry.toolCalls),
            errors: getNumber(entry.errors),
          }))
        : [],
  };
}

function normalizeDailyEntries(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((entry) => ({
    date: getString(entry.date) ?? '',
    ...normalizeTotals(entry),
  }));
}

function normalizeTimePoint(value: Record<string, unknown>): UsageWorkspaceTimePoint {
  return {
    timestamp: getNumber(value.timestamp),
    input: getNumber(value.input),
    output: getNumber(value.output),
    cacheRead: getNumber(value.cacheRead),
    cacheWrite: getNumber(value.cacheWrite),
    totalTokens: getNumber(value.totalTokens),
    cost: getNumber(value.cost),
    cumulativeTokens: getNumber(value.cumulativeTokens),
    cumulativeCost: getNumber(value.cumulativeCost),
  };
}

function normalizeTimeSeries(value: unknown): UsageWorkspaceTimeSeries {
  if (!isRecord(value)) return { points: [] };
  return {
    sessionId: getString(value.sessionId),
    points: Array.isArray(value.points)
      ? value.points.filter(isRecord).map((point) => normalizeTimePoint(point))
      : [],
  };
}

function normalizeLogs(value: unknown): UsageWorkspaceLogEntry[] {
  if (!isRecord(value) || !Array.isArray(value.logs)) return [];
  return value.logs.filter(isRecord).map((entry) => ({
    timestamp: getNumber(entry.timestamp),
    role: getString(entry.role) ?? 'assistant',
    content: getString(entry.content) ?? '',
    tokens: getOptionalNumber(entry.tokens),
    cost: getOptionalNumber(entry.cost),
  }));
}

function normalizeGatewayKey(gatewayUrl?: string | null) {
  const trimmed = gatewayUrl?.trim();
  if (!trimmed) return DEFAULT_GATEWAY_KEY;
  try {
    const parsed = new URL(trimmed);
    const pathname = parsed.pathname === '/' ? '' : parsed.pathname;
    return `${parsed.protocol}//${parsed.host}${pathname}`.toLowerCase();
  } catch {
    return trimmed.toLowerCase();
  }
}

function formatUtcOffset(offsetMinutes: number) {
  const offsetFromUtcMinutes = -offsetMinutes;
  const sign = offsetFromUtcMinutes >= 0 ? '+' : '-';
  const absoluteMinutes = Math.abs(offsetFromUtcMinutes);
  const hours = Math.floor(absoluteMinutes / 60);
  const minutes = absoluteMinutes % 60;
  return minutes === 0
    ? `UTC${sign}${hours}`
    : `UTC${sign}${hours}:${minutes.toString().padStart(2, '0')}`;
}

function buildDateInterpretationParams(
  timeZone: UsageWorkspaceTimeZone,
  includeDateInterpretation: boolean,
) {
  if (!includeDateInterpretation) return {};
  if (timeZone === 'utc') return { mode: 'utc' };
  return { mode: 'specific', utcOffset: formatUtcOffset(new Date().getTimezoneOffset()) };
}

function toErrorMessage(error: unknown) {
  if (typeof error === 'string') return error;
  if (error instanceof Error && error.message.trim()) return error.message;
  if (isRecord(error)) {
    try {
      return JSON.stringify(error);
    } catch {
      return 'request failed';
    }
  }
  return 'request failed';
}

function isLegacyDateInterpretationUnsupportedError(error: unknown) {
  const message = toErrorMessage(error);
  return INVALID_PARAMS_RE.test(message) && (MODE_RE.test(message) || OFFSET_RE.test(message));
}

function sortInstances(left: StudioInstanceRecord, right: StudioInstanceRecord) {
  return (
    Number(right.isDefault) - Number(left.isDefault) ||
    statusWeight(right.status) - statusWeight(left.status) ||
    Number(right.isBuiltIn) - Number(left.isBuiltIn) ||
    left.name.localeCompare(right.name)
  );
}

function statusWeight(status: StudioInstanceRecord['status']) {
  if (status === 'online') return 4;
  if (status === 'starting') return 3;
  if (status === 'offline') return 2;
  return 1;
}

function mergeTotals(primary: UsageWorkspaceTotals, fallback: UsageWorkspaceTotals) {
  if (primary.totalCost > 0 || fallback.totalCost === 0) return primary;
  return { ...primary, ...fallback };
}

export function createUsageWorkspaceService(
  overrides: UsageWorkspaceServiceDependencyOverrides = {},
) {
  const defaults = createDefaultDependencies();
  const dependencies: UsageWorkspaceServiceDependencies = {
    studioApi: { ...defaults.studioApi, ...(overrides.studioApi || {}) },
    gatewayApi: { ...defaults.gatewayApi, ...(overrides.gatewayApi || {}) },
    storage: overrides.storage === undefined ? defaults.storage : overrides.storage,
  };
  let legacyCompatibilityCache: Set<string> | null = null;

  function loadCompatibilityCache() {
    if (legacyCompatibilityCache) return legacyCompatibilityCache;
    const storage = dependencies.storage;
    if (!storage) return (legacyCompatibilityCache = new Set<string>());
    try {
      const rawValue = storage.getItem(STORAGE_KEY);
      const parsed = rawValue ? (JSON.parse(rawValue) as { unsupportedGatewayKeys?: unknown }) : null;
      const values = Array.isArray(parsed?.unsupportedGatewayKeys)
        ? parsed.unsupportedGatewayKeys.filter(
            (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0,
          )
        : [];
      legacyCompatibilityCache = new Set(values);
    } catch {
      legacyCompatibilityCache = new Set<string>();
    }
    return legacyCompatibilityCache;
  }

  function persistCompatibilityCache(cache: Set<string>) {
    const storage = dependencies.storage;
    if (!storage) return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify({ unsupportedGatewayKeys: [...cache] }));
    } catch {
      // Ignore storage write failures.
    }
  }

  function shouldSendDateInterpretation(gatewayUrl?: string | null) {
    return !loadCompatibilityCache().has(normalizeGatewayKey(gatewayUrl));
  }

  function rememberLegacyGateway(gatewayUrl?: string | null) {
    const cache = loadCompatibilityCache();
    cache.add(normalizeGatewayKey(gatewayUrl));
    persistCompatibilityCache(cache);
  }

  async function listUsageInstances(): Promise<UsageWorkspaceInstancesResult> {
    const instances = (await dependencies.studioApi.listInstances())
      .filter((instance) => instance.transportKind === 'openclawGatewayWs')
      .sort(sortInstances)
      .map((instance) => ({
        id: instance.id,
        name: instance.name,
        status: instance.status,
        runtimeKind: instance.runtimeKind,
        deploymentMode: instance.deploymentMode,
        transportKind: instance.transportKind,
        isBuiltIn: instance.isBuiltIn,
        isDefault: instance.isDefault,
        baseUrl: instance.baseUrl ?? null,
        version: instance.version,
      }));
    return { instances, defaultInstanceId: instances[0]?.id ?? null };
  }

  async function loadUsageSnapshot(query: UsageWorkspaceQuery): Promise<UsageWorkspaceSnapshot> {
    const execute = async (includeDateInterpretation: boolean) => {
      const params = buildDateInterpretationParams(query.timeZone, includeDateInterpretation);
      return Promise.all([
        dependencies.gatewayApi.getGatewaySessionUsage(query.instanceId, {
          startDate: query.startDate,
          endDate: query.endDate,
          ...params,
          limit: 1000,
          includeContextWeight: true,
        }),
        dependencies.gatewayApi.getUsageCost(query.instanceId, {
          startDate: query.startDate,
          endDate: query.endDate,
          ...params,
        }),
      ]);
    };

    let usageResponse: unknown;
    let costResponse: unknown;
    let compatibilityMode: UsageWorkspaceCompatibilityMode = 'date-interpretation';
    const includeDateInterpretation = shouldSendDateInterpretation(query.gatewayUrl);

    try {
      [usageResponse, costResponse] = await execute(includeDateInterpretation);
      if (!includeDateInterpretation) compatibilityMode = 'legacy-no-date-interpretation';
    } catch (error) {
      if (!includeDateInterpretation || !isLegacyDateInterpretationUnsupportedError(error)) {
        throw error;
      }
      rememberLegacyGateway(query.gatewayUrl);
      [usageResponse, costResponse] = await execute(false);
      compatibilityMode = 'legacy-no-date-interpretation';
    }

    const usageRecord = isRecord(usageResponse) ? usageResponse : {};
    const costRecord = isRecord(costResponse) ? costResponse : {};
    return {
      generatedAt: Date.now(),
      instanceId: query.instanceId,
      startDate: query.startDate,
      endDate: query.endDate,
      timeZone: query.timeZone,
      compatibilityMode,
      sessions: Array.isArray(usageRecord.sessions)
        ? usageRecord.sessions.map(normalizeSession).filter((session) => session.key)
        : [],
      totals: mergeTotals(normalizeTotals(usageRecord.totals), normalizeTotals(costRecord.totals)),
      aggregates: normalizeAggregates(usageRecord.aggregates),
      costDaily: normalizeDailyEntries(costRecord.daily),
    };
  }

  async function loadSessionDetail(
    query: UsageWorkspaceSessionDetailQuery,
  ): Promise<UsageWorkspaceSessionDetail> {
    const [timeSeriesResponse, logsResponse] = await Promise.all([
      dependencies.gatewayApi
        .getGatewaySessionUsageTimeseries(query.instanceId, { key: query.sessionKey })
        .catch(() => ({ points: [] })),
      dependencies.gatewayApi
        .getGatewaySessionUsageLogs(query.instanceId, { key: query.sessionKey, limit: 1000 })
        .catch(() => ({ logs: [] })),
    ]);
    return {
      generatedAt: Date.now(),
      sessionKey: query.sessionKey,
      timeSeries: normalizeTimeSeries(timeSeriesResponse),
      logs: normalizeLogs(logsResponse),
    };
  }

  return {
    listUsageInstances,
    loadUsageSnapshot,
    loadSessionDetail,
  };
}

export const usageWorkspaceService = createUsageWorkspaceService();
