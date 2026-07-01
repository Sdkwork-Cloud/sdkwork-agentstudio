import type { TaskRuntimeOverview } from '@sdkwork/claw-core';

type TaskRuntimeFlowRecord = TaskRuntimeOverview['taskFlows']['items'][number];
type TaskRuntimeFlowLinkedTaskRecord = {
  sourceId?: string;
  sessionKey?: string;
  childSessionKey?: string;
  parentTaskId?: string;
  cleanupAfter?: string;
  terminalSummary?: string;
  progressSummary?: string;
  label?: string;
  title?: string;
  terminalOutcome?: string | null;
};

const ACTIVE_RUNTIME_STATUSES = new Set(['running', 'queued', 'pending', 'blocked', 'waiting']);

function readTrimmedText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function isActiveRuntimeStatus(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  return normalized ? ACTIVE_RUNTIME_STATUSES.has(normalized) : false;
}

export function getTaskFlowCardSummary(flow: TaskRuntimeFlowRecord, fallback: string) {
  return readTrimmedText(flow.goal) || readTrimmedText(flow.summary) || fallback;
}

export function formatTaskFlowActivity(flow: TaskRuntimeFlowRecord) {
  if (flow.taskCount == null && flow.activeTaskCount == null) {
    return '-';
  }

  return `${flow.activeTaskCount ?? 0}/${flow.taskCount ?? 0}`;
}

export function formatTaskFlowDetailPayload(value: unknown) {
  if (value == null) {
    return '-';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `array(${value.length})`;
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return keys.length > 0 ? keys.join(', ') : 'object';
  }

  return String(value);
}

function readThreadToken(value?: string | number | null) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }

  return readTrimmedText(typeof value === 'string' ? value : undefined);
}

export function formatTaskFlowRequesterOrigin(origin?: TaskRuntimeFlowRecord['requesterOrigin'] | null) {
  const channel = readTrimmedText(origin?.channel);
  const to = readTrimmedText(origin?.to);
  const accountId = readTrimmedText(origin?.accountId);
  const threadId = readThreadToken(origin?.threadId);

  const route = channel && to ? `${channel} -> ${to}` : channel || to;
  const metadata = [accountId ? `@${accountId}` : null, threadId ? `#${threadId}` : null]
    .filter(Boolean)
    .join(' ');
  const summary = [route, metadata].filter(Boolean).join(' ');

  return summary || '-';
}

export function getTaskFlowLinkedTaskSummary(task?: TaskRuntimeFlowLinkedTaskRecord | null) {
  return (
    readTrimmedText(task?.terminalSummary) ||
    readTrimmedText(task?.progressSummary) ||
    readTrimmedText(task?.label) ||
    readTrimmedText(task?.title) ||
    '-'
  );
}

export function getTaskFlowLinkedTaskRequesterSession(task?: TaskRuntimeFlowLinkedTaskRecord | null) {
  const sessionKey = readTrimmedText(task?.sessionKey);
  const childSessionKey = readTrimmedText(task?.childSessionKey);

  if (!sessionKey) {
    return null;
  }

  return sessionKey === childSessionKey ? null : sessionKey;
}

export function getTaskFlowLinkedTaskSourceId(task?: TaskRuntimeFlowLinkedTaskRecord | null) {
  return readTrimmedText(task?.sourceId) || '-';
}

export function getTaskFlowLinkedTaskParentTaskId(task?: TaskRuntimeFlowLinkedTaskRecord | null) {
  return readTrimmedText(task?.parentTaskId) || '-';
}

export function formatTaskFlowLinkedTaskCleanupAfter(task?: TaskRuntimeFlowLinkedTaskRecord | null) {
  return readTrimmedText(task?.cleanupAfter) || '-';
}

export function formatTaskFlowLinkedTaskResult(task?: TaskRuntimeFlowLinkedTaskRecord | null) {
  return readTrimmedText(task?.terminalOutcome) || '-';
}

export function getTaskFlowBlockedSummary(
  blocked?: {
    taskId?: string;
    summary?: string;
  } | null,
) {
  const summary = readTrimmedText(blocked?.summary);
  if (summary) {
    return summary;
  }

  const taskId = readTrimmedText(blocked?.taskId);
  return taskId ? `blocked by ${taskId}` : null;
}

export function formatTaskFlowTaskSummary(
  summary?: {
    total?: number;
    active?: number;
    terminal?: number;
    failures?: number;
  } | null,
) {
  if (!summary) {
    return '-';
  }

  const parts: string[] = [];
  if (typeof summary.active === 'number') {
    parts.push(`${summary.active} active`);
  }
  if (typeof summary.total === 'number') {
    parts.push(`${summary.total} total`);
  }
  if (typeof summary.failures === 'number') {
    parts.push(`${summary.failures} failures`);
  }
  if (typeof summary.terminal === 'number') {
    parts.push(`${summary.terminal} terminal`);
  }

  return parts.length > 0 ? parts.join(' / ') : '-';
}
