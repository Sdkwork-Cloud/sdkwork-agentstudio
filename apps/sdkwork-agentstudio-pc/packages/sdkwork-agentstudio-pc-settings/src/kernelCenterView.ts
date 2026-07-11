import type { KernelCenterDashboard } from './services';

function formatIsoTimestampValue(timestamp?: number | null) {
  return timestamp === null || timestamp === undefined
    ? null
    : new Date(timestamp).toISOString();
}

export function formatLocalAiProxyRouteMetricSummary(
  metric: KernelCenterDashboard['localAiProxy']['routeMetrics'][number],
  labels: {
    health: string;
    requests: string;
    successes: string;
    failures: string;
    rpm: string;
    totalTokens: string;
    averageLatency: string;
    lastLatency: string;
    lastUsedAt: string;
    lastError: string;
  },
) {
  const parts = [
    labels.health,
    `${labels.requests} ${metric.requestCount}`,
    `${labels.successes} ${metric.successCount}`,
    `${labels.failures} ${metric.failureCount}`,
    `${labels.rpm} ${metric.rpm}`,
    `${labels.totalTokens} ${metric.totalTokens}`,
    `${labels.averageLatency} ${metric.averageLatencyMs} ms`,
  ];

  if (metric.lastLatencyMs !== null && metric.lastLatencyMs !== undefined) {
    parts.push(`${labels.lastLatency} ${metric.lastLatencyMs} ms`);
  }

  const lastUsedAt = formatIsoTimestampValue(metric.lastUsedAt);
  if (lastUsedAt) {
    parts.push(`${labels.lastUsedAt} ${lastUsedAt}`);
  }

  if (metric.lastError) {
    parts.push(`${labels.lastError} ${metric.lastError}`);
  }

  return parts.join(' | ');
}

export function formatLocalAiProxyRouteTestSummary(
  test: Omit<KernelCenterDashboard['localAiProxy']['routeTests'][number], 'checkedCapability'> & {
    checkedCapability: string;
  },
  labels: {
    status: string;
    capability: string;
    testedAt: string;
    latency: string;
    model: string;
    error: string;
  },
) {
  const parts = [labels.status, `${labels.capability} ${test.checkedCapability}`];
  const testedAt = formatIsoTimestampValue(test.testedAt);

  if (testedAt) {
    parts.push(`${labels.testedAt} ${testedAt}`);
  }

  if (test.latencyMs !== null && test.latencyMs !== undefined) {
    parts.push(`${labels.latency} ${test.latencyMs} ms`);
  }

  if (test.modelId) {
    parts.push(`${labels.model} ${test.modelId}`);
  }

  if (test.error) {
    parts.push(`${labels.error} ${test.error}`);
  }

  return parts.join(' | ');
}

export function resolveEndpointPortValue(
  dashboard: KernelCenterDashboard | null,
  portKey: 'preferredPort' | 'activePort',
): string | null {
  const value = dashboard?.endpoint?.[portKey] ?? null;
  return value === null || value === undefined ? null : String(value);
}

export function resolveLocalAiProxyPortValue(
  dashboard: KernelCenterDashboard | null,
): string | null {
  const value = dashboard?.localAiProxy?.activePort ?? null;
  return value === null || value === undefined ? null : String(value);
}
