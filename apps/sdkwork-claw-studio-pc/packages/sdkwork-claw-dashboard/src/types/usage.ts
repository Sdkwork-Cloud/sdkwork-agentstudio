import type { StudioInstanceRecord } from '@sdkwork/claw-types';

export type UsageWorkspaceTimeZone = 'local' | 'utc';
export type UsageWorkspaceCompatibilityMode =
  | 'date-interpretation'
  | 'legacy-no-date-interpretation';

export interface UsageWorkspaceInstance {
  id: string;
  name: string;
  status: StudioInstanceRecord['status'];
  runtimeKind: StudioInstanceRecord['runtimeKind'];
  deploymentMode: StudioInstanceRecord['deploymentMode'];
  transportKind: StudioInstanceRecord['transportKind'];
  isBuiltIn: boolean;
  isDefault: boolean;
  baseUrl: string | null;
  version: string;
}

export interface UsageWorkspaceInstancesResult {
  instances: UsageWorkspaceInstance[];
  defaultInstanceId: string | null;
}

export interface UsageWorkspaceTotals {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  totalCost: number;
  inputCost: number;
  outputCost: number;
  cacheReadCost: number;
  cacheWriteCost: number;
  missingCostEntries: number;
}

export interface UsageWorkspaceDailyEntry extends UsageWorkspaceTotals {
  date: string;
}

export interface UsageWorkspaceMessageCounts {
  total: number;
  user: number;
  assistant: number;
  toolCalls: number;
  toolResults: number;
  errors: number;
}

export interface UsageWorkspaceToolUsage {
  totalCalls: number;
  uniqueTools: number;
  tools: Array<{ name: string; count: number }>;
}

export interface UsageWorkspaceLatencyStats {
  count: number;
  avgMs: number;
  p95Ms: number;
  minMs: number;
  maxMs: number;
}

export interface UsageWorkspaceModelUsage {
  provider?: string;
  model?: string;
  count: number;
  totals: UsageWorkspaceTotals;
}

export interface UsageWorkspaceSessionSummary extends UsageWorkspaceTotals {
  sessionId?: string;
  firstActivity?: number;
  lastActivity?: number;
  durationMs?: number;
  activityDates: string[];
  messageCounts: UsageWorkspaceMessageCounts;
  toolUsage: UsageWorkspaceToolUsage;
  modelUsage: UsageWorkspaceModelUsage[];
  latency: UsageWorkspaceLatencyStats | null;
}

export interface UsageWorkspaceSession {
  key: string;
  label?: string;
  sessionId?: string;
  updatedAt?: number;
  agentId?: string;
  channel?: string;
  modelOverride?: string;
  providerOverride?: string;
  modelProvider?: string;
  model?: string;
  usage: UsageWorkspaceSessionSummary | null;
}

export interface UsageWorkspaceAggregates {
  messages: UsageWorkspaceMessageCounts;
  tools: UsageWorkspaceToolUsage;
  byModel: UsageWorkspaceModelUsage[];
  byProvider: UsageWorkspaceModelUsage[];
  byAgent: Array<{ agentId: string; totals: UsageWorkspaceTotals }>;
  byChannel: Array<{ channel: string; totals: UsageWorkspaceTotals }>;
  daily: Array<{
    date: string;
    tokens: number;
    cost: number;
    messages: number;
    toolCalls: number;
    errors: number;
  }>;
}

export interface UsageWorkspaceQuery {
  instanceId: string;
  gatewayUrl?: string | null;
  startDate: string;
  endDate: string;
  timeZone: UsageWorkspaceTimeZone;
}

export interface UsageWorkspaceSnapshot {
  generatedAt: number;
  instanceId: string;
  startDate: string;
  endDate: string;
  timeZone: UsageWorkspaceTimeZone;
  compatibilityMode: UsageWorkspaceCompatibilityMode;
  sessions: UsageWorkspaceSession[];
  totals: UsageWorkspaceTotals;
  aggregates: UsageWorkspaceAggregates;
  costDaily: UsageWorkspaceDailyEntry[];
}

export interface UsageWorkspaceTimePoint {
  timestamp: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  cost: number;
  cumulativeTokens: number;
  cumulativeCost: number;
}

export interface UsageWorkspaceTimeSeries {
  sessionId?: string;
  points: UsageWorkspaceTimePoint[];
}

export interface UsageWorkspaceLogEntry {
  timestamp: number;
  role: string;
  content: string;
  tokens?: number;
  cost?: number;
}

export interface UsageWorkspaceSessionDetailQuery {
  instanceId: string;
  sessionKey: string;
}

export interface UsageWorkspaceSessionDetail {
  generatedAt: number;
  sessionKey: string;
  timeSeries: UsageWorkspaceTimeSeries;
  logs: UsageWorkspaceLogEntry[];
}
